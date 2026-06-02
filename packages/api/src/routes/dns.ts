import { FastifyInstance } from 'fastify';
import { db, dbAdmin } from '../db/connection';

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

export async function dnsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. List DNS records for a domain
  fastify.get('/dns/:domainName', async (request: any, reply) => {
    const { domainName } = request.params;
    const accountId = request.accountId;

    // Validate ownership
    const domainRecord = await db('domains').where({ account_id: accountId, domain: domainName }).first();
    if (!domainRecord) return reply.code(404).send({ error: 'Domain not found or unauthorized' });

    const pdnsDomain = await dbAdmin('powerdns.domains').where({ name: domainName }).first();
    if (!pdnsDomain) return [];

    const records = await dbAdmin('powerdns.records').where({ domain_id: pdnsDomain.id });
    return records;
  });

  // 2. Add DNS Record
  fastify.post('/dns/:domainName', async (request: any, reply) => {
    const { domainName } = request.params;
    const { name, type, content, ttl, priority } = request.body;
    const accountId = request.accountId;

    const domainRecord = await db('domains').where({ account_id: accountId, domain: domainName }).first();
    if (!domainRecord) return reply.code(404).send({ error: 'Domain not found or unauthorized' });

    const pdnsDomain = await dbAdmin('powerdns.domains').where({ name: domainName }).first();
    if (!pdnsDomain) return reply.code(404).send({ error: 'DNS zone not found' });

    try {
      const [recordId] = await dbAdmin('powerdns.records').insert({
        domain_id: pdnsDomain.id,
        name: name,
        type: type,
        content: content,
        ttl: ttl || 3600,
        prio: priority || null
      });

      // Mirror record to cpanel DB for metadata / statistics (optional)
      await db('dns_records').insert({
        id: require('crypto').randomUUID(),
        account_id: accountId,
        domain: domainName,
        name: name,
        type: type,
        content: content,
        ttl: ttl || 3600,
        priority: priority || null
      });

      reply.code(201).send({ success: true, recordId });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 3. Delete DNS Record
  fastify.delete('/dns/:domainName/:recordId', async (request: any, reply) => {
    const { domainName, recordId } = request.params;
    const accountId = request.accountId;

    const domainRecord = await db('domains').where({ account_id: accountId, domain: domainName }).first();
    if (!domainRecord) return reply.code(404).send({ error: 'Domain not found or unauthorized' });

    const pdnsDomain = await dbAdmin('powerdns.domains').where({ name: domainName }).first();
    if (!pdnsDomain) return reply.code(404).send({ error: 'DNS zone not found' });

    try {
      await dbAdmin('powerdns.records').where({ id: recordId, domain_id: pdnsDomain.id }).del();
      return { success: true, message: 'DNS record deleted successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
