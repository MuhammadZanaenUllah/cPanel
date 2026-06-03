import { FastifyInstance } from 'fastify';
import { db, dbAdmin } from '../db/connection';
import { resolveSafe } from '@cpanel/shared/dist/utils/fs';
import * as fs from 'fs';
import * as path from 'path';

async function cpanelAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin') {
      request.accountId = request.user.id;
      request.username = request.user.username;
    } else {
      request.accountId = request.query.accountId || request.body?.accountId || request.user.id;
      request.username = request.query.username || request.body?.username || 'testuser';
    }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function wordpressRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. List WordPress installations
  fastify.get('/wordpress/installations', async (request: any) => {
    const installations = await db('wordpress_installations')
      .where({ account_id: request.accountId });
    return installations;
  });

  // 2. Install WordPress
  fastify.post('/wordpress/install', async (request: any, reply) => {
    const { domain, installDir = '', siteTitle = 'My WordPress Site', adminUser = 'admin', adminPass = 'admin123', adminEmail = 'admin@example.com' } = request.body;
    const accountId = request.accountId;

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    // Validate the domain exists and matches the account
    const targetDomain = await db('domains')
      .where({ account_id: accountId, domain })
      .orWhere({ id: `primary-${accountId}`, domain })
      .first();

    const docRoot = targetDomain 
      ? targetDomain.document_root 
      : path.join(account.home_dir, 'public_html');

    const installPath = installDir 
      ? resolveSafe(docRoot, installDir) 
      : docRoot;

    // Generate unique DB details
    const dbSuffix = Math.random().toString(36).substring(2, 7);
    const dbName = `${account.username}_wp${dbSuffix}`;
    const dbUser = `${account.username}_wp${dbSuffix}`;
    const dbPass = require('crypto').randomBytes(12).toString('hex');

    try {
      // 1. Create DB and User
      await dbAdmin.raw(`CREATE DATABASE ??`, [dbName]);
      await dbAdmin.raw(`CREATE USER ?@'%' IDENTIFIED BY ?`, [dbUser, dbPass]);
      await dbAdmin.raw(`GRANT ALL PRIVILEGES ON ??.* TO ?@'%'`, [dbName, dbUser]);
      await dbAdmin.raw('FLUSH PRIVILEGES');

      // Record database configuration
      const dbId = require('crypto').randomUUID();
      await db('mysql_databases').insert({
        id: dbId,
        account_id: accountId,
        db_name: dbName,
        display_name: `wp${dbSuffix}`
      });

      const userId = require('crypto').randomUUID();
      await db('mysql_users').insert({
        id: userId,
        account_id: accountId,
        username: dbUser
      });

      await db('mysql_assignments').insert({
        id: require('crypto').randomUUID(),
        account_id: accountId,
        db_name: dbName,
        db_user: dbUser,
        privileges: 'ALL PRIVILEGES'
      });

      // 2. Scaffold mock WordPress files in target directory
      if (!fs.existsSync(installPath)) {
        fs.mkdirSync(installPath, { recursive: true });
      }

      // Generate mock wp-config.php and basic index.php
      const wpConfigContent = `<?define('DB_NAME', '${dbName}');
define('DB_USER', '${dbUser}');
define('DB_PASSWORD', '${dbPass}');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8');
define('DB_COLLATE', '');
$table_prefix = 'wp_';
define('WP_DEBUG', false);
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
`;

      const indexPhpContent = `<?php
/**
 * Front to the WordPress application. This file doesn't do anything, but loads
 * wp-blog-header.php which does and tells WordPress to template the theme.
 */
define( 'WP_USE_THEMES', true );
require __DIR__ . '/wp-blog-header.php';
`;

      const wpBlogHeaderContent = `<?php
echo "<h1>${siteTitle}</h1>";
echo "<p>Welcome to WordPress. This is a successfully simulated installation managed by cPanel WordPress Toolkit.</p>";
echo "<p>Running on database: <code>${dbName}</code></p>";
`;

      fs.writeFileSync(path.join(installPath, 'wp-config.php'), wpConfigContent);
      fs.writeFileSync(path.join(installPath, 'index.php'), indexPhpContent);
      fs.writeFileSync(path.join(installPath, 'wp-blog-header.php'), wpBlogHeaderContent);

      // Save WordPress installation details in database
      const wpId = require('crypto').randomUUID();
      await db('wordpress_installations').insert({
        id: wpId,
        account_id: accountId,
        domain,
        path: installPath,
        site_title: siteTitle,
        admin_user: adminUser,
        db_name: dbName,
        version: '6.4.2',
        status: 'active',
        created_at: new Date()
      });

      return { success: true, message: 'WordPress installed successfully!', siteUrl: `http://${domain}/${installDir}` };
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 3. Uninstall WordPress
  fastify.post('/wordpress/uninstall', async (request: any, reply) => {
    const { id } = request.body;
    const accountId = request.accountId;

    const wp = await db('wordpress_installations')
      .where({ id, account_id: accountId })
      .first();

    if (!wp) return reply.code(404).send({ error: 'WordPress installation not found' });

    try {
      // 1. Drop associated database
      if (wp.db_name) {
        await dbAdmin.raw(`DROP DATABASE IF EXISTS ??`, [wp.db_name]);
        await db('mysql_assignments').where({ db_name: wp.db_name }).del();
        await db('mysql_databases').where({ db_name: wp.db_name }).del();
        await db('mysql_users').where({ username: wp.db_name }).del(); // assuming same username
      }

      // 2. Remove files recursively
      if (wp.path && fs.existsSync(wp.path)) {
        // Safe check to avoid deleting root directories
        if (wp.path.includes('public_html') || wp.path.includes('zanaen')) {
          fs.rmSync(wp.path, { recursive: true, force: true });
        }
      }

      // 3. Delete installation record
      await db('wordpress_installations').where({ id }).del();
      return { success: true, message: 'WordPress uninstalled successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
