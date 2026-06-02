import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { db } from './src/db/connection';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  // Plugins
  await app.register(fastifyCors, {
    origin: true // Adjust in production
  });

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret'
  });

  await app.register(require('./src/plugins/auth').authPlugin);

  // Register routes
  await app.register(require('./src/routes/whm').whmRoutes, { prefix: '/whm' });
  await app.register(require('./src/routes/domains').domainRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/dns').dnsRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/mail').mailRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/ftp').ftpRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/mysql').mysqlRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/ssl').sslRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/files').filesRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/metrics').metricsRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/cron').cronRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/backups').backupRoutes, { prefix: '/cpanel' });

  // Account info: real server IP (from servers table) + client's current IP
  app.get('/cpanel/account/info', async (request: any, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const accountId = request.user.role !== 'admin'
      ? request.user.id
      : (request.query.accountId || request.user.id);

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    const server = await db('servers').where({ id: account.server_id }).first();
    const serverIp = server?.ip_address || request.hostname || '127.0.0.1';

    // Record last login IP and timestamp
    const clientIp = request.headers['x-forwarded-for']?.split(',')[0].trim()
      || request.ip
      || '0.0.0.0';

    await db('accounts').where({ id: accountId }).update({
      last_login_ip: clientIp,
      last_login_at: new Date()
    }).catch(() => {
      // Columns may not exist yet in older migrations — silently skip
    });

    return { serverIp, lastLoginIp: clientIp };
  });

  // Dev Token helper route to seamlessly authenticate frontend in local dev
  app.get('/dev-token', async () => {
    const user = await db('accounts').where({ username: 'testuser' }).first() || 
                 await db('accounts').first();
    if (!user) {
      return { error: 'No user accounts found in database. Please run migrations & seeds first.' };
    }
    const token = app.jwt.sign({ id: user.id, role: user.role, username: user.username });
    return { token, username: user.username };
  });

  // Ensure the new tables exist
  try {
    const hasRouting = await db.schema.hasTable('email_routing');
    if (!hasRouting) {
      await db.schema.createTable('email_routing', (table) => {
        table.uuid('id').primary();
        table.uuid('account_id').notNullable();
        table.string('domain', 255).notNullable().unique();
        table.string('routing_type', 50).notNullable().defaultTo('local');
        table.timestamps(true, true);
      });
    }

    const hasAutoresponders = await db.schema.hasTable('email_autoresponders');
    if (!hasAutoresponders) {
      await db.schema.createTable('email_autoresponders', (table) => {
        table.uuid('id').primary();
        table.uuid('account_id').notNullable();
        table.string('email', 255).notNullable();
        table.string('from_name', 255).notNullable();
        table.string('subject', 255).notNullable();
        table.text('body').notNullable();
        table.integer('interval_hours').notNullable().defaultTo(1);
        table.string('status', 50).defaultTo('active');
        table.timestamps(true, true);
        table.unique(['account_id', 'email']);
      });
    }
  } catch (err) {
    app.log.error(err, 'Error creating dynamic schemas');
  }

  return app;
}
