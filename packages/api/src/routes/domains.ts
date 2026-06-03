import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';
import { NginxService } from '../services/nginx';
import { DnsService } from '../services/dns';
import { resolveSafe } from '@cpanel/shared';

async function cpanelAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin') {
      request.accountId = request.user.id;
    } else {
      request.accountId = request.query.accountId || request.body?.accountId || request.user.id;
    }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function domainRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. Create Domain (Subdomain or Addon Domain)
  fastify.post('/domains', async (request: any, reply) => {
    const { domain, type, relativeDocumentRoot } = request.body;
    const accountId = request.accountId;

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    try {
      // Securely resolve document root with resolveSafe to prevent path traversals
      const resolvedRoot = resolveSafe(account.home_dir, relativeDocumentRoot || 'public_html');

      // 1. Save Domain to DB
      const domainId = require('crypto').randomUUID();
      await db('domains').insert({
        id: domainId,
        account_id: accountId,
        domain,
        type: type || 'addon',
        document_root: resolvedRoot,
        php_version: '8.2',
        status: 'active'
      });

      // 2. Setup Nginx Virtual Host
      await NginxService.setupDomain(domain, resolvedRoot, '8.2');

      // 3. Setup DNS Zone (PowerDNS)
      await DnsService.addZone(domain, process.env.SERVER_IP || '127.0.0.1');

      reply.code(201).send({ success: true, domainId, domain });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 2. List Domains — always includes the primary domain as the first entry
  fastify.get('/domains', async (request: any) => {
    const account = await db('accounts').where({ id: request.accountId }).first();
    const addonDomains = await db('domains').where({ account_id: request.accountId });
    const primaryEntry = account?.primary_domain
      ? [{ id: `primary-${request.accountId}`, domain: account.primary_domain, document_root: `/home/${account.username}/public_html`, is_primary: true, account_id: request.accountId }]
      : [];
    const addonAlreadyHasPrimary = addonDomains.some((d: any) => d.domain === account?.primary_domain);
    return addonAlreadyHasPrimary ? addonDomains : [...primaryEntry, ...addonDomains];
  });

  // 3. Delete Domain
  fastify.delete('/domains/:domainName', async (request: any, reply) => {
    const { domainName } = request.params;
    const accountId = request.accountId;

    const domainRecord = await db('domains').where({ account_id: accountId, domain: domainName }).first();
    if (!domainRecord) return reply.code(404).send({ error: 'Domain not found' });

    try {
      // 1. Remove Nginx configuration
      await NginxService.removeDomain(domainName);

      // 2. Remove DNS entries
      await DnsService.removeZone(domainName);

      // 3. Delete from DB
      await db('domains').where({ account_id: accountId, domain: domainName }).del();

      return { success: true, message: 'Domain deleted successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 4. List Redirects
  fastify.get('/domains/redirects', async (request: any) => {
    return db('domains')
      .where({ account_id: request.accountId })
      .whereNotNull('redirect_url');
  });

  // 5. Create or Update Redirect
  fastify.post('/domains/redirects', async (request: any, reply) => {
    const { domain, redirectUrl, redirectType } = request.body;
    const accountId = request.accountId;

    if (!domain || !redirectUrl) {
      return reply.code(400).send({ error: 'Domain and redirectUrl are required' });
    }

    try {
      const existing = await db('domains').where({ account_id: accountId, domain }).first();
      if (existing) {
        await db('domains').where({ id: existing.id }).update({
          redirect_url: redirectUrl,
          redirect_type: redirectType || '301',
          type: 'redirect',
          updated_at: new Date()
        });
      } else {
        await db('domains').insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          domain,
          type: 'redirect',
          document_root: '/home/testuser/public_html',
          redirect_url: redirectUrl,
          redirect_type: redirectType || '301',
          php_version: '8.2',
          status: 'active'
        });
      }
      return { success: true, domain, redirectUrl };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 6. Delete Redirect
  fastify.delete('/domains/redirects/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;

    try {
      await db('domains').where({ id, account_id: accountId }).update({
        redirect_url: null,
        redirect_type: null,
        type: 'addon' // revert type to standard
      });
      return { success: true, message: 'Redirect deleted successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
