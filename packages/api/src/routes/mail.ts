import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';
import { MailService } from '../services/mail';

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

export async function mailRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. Create Virtual Email Account
  fastify.post('/mail', async (request: any, reply) => {
    const { localPart, domain, password, quotaMb } = request.body;
    const accountId = request.accountId;

    // Check domain ownership first
    const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
    if (!domainRecord) return reply.code(403).send({ error: 'Unauthorized domain' });

    try {
      await MailService.createEmailAccount(accountId, localPart, domain, password, quotaMb);
      reply.code(201).send({ success: true, email: `${localPart}@${domain}` });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 2. List Email Accounts
  fastify.get('/mail', async (request: any) => {
    const accounts = await db('email_accounts').where({ account_id: request.accountId });
    return accounts;
  });

  // 3. Delete Email Account
  fastify.delete('/mail/:emailAddress', async (request: any, reply) => {
    const { emailAddress } = request.params;
    const accountId = request.accountId;

    const [localPart, domain] = emailAddress.split('@');
    if (!localPart || !domain) return reply.code(400).send({ error: 'Invalid email address format' });

    // Validate ownership
    const emailRecord = await db('email_accounts').where({
      account_id: accountId,
      local_part: localPart,
      domain
    }).first();

    if (!emailRecord) return reply.code(404).send({ error: 'Email account not found or unauthorized' });

    try {
      await MailService.deleteEmailAccount(accountId, localPart, domain);
      return { success: true, message: 'Email account deleted successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 4. Create Forwarder
  fastify.post('/mail/forwarders', async (request: any, reply) => {
    const { source, destination } = request.body;
    const accountId = request.accountId;

    const [, domain] = source.split('@');
    const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
    if (!domainRecord) return reply.code(403).send({ error: 'Unauthorized source domain' });

    try {
      await MailService.createForwarder(accountId, source, destination);
      reply.code(201).send({ success: true, source, destination });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 5. List Forwarders
  fastify.get('/mail/forwarders', async (request: any) => {
    const forwarders = await db('email_forwarders').where({ account_id: request.accountId });
    return forwarders;
  });

  // 6. Delete Forwarder
  fastify.delete('/mail/forwarders/:forwarderId', async (request: any, reply) => {
    const { forwarderId } = request.params;
    const accountId = request.accountId;

    try {
      await db('email_forwarders').where({ id: forwarderId, account_id: accountId }).del();
      return { success: true, message: 'Email forwarder deleted successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 7. Get Email Routing settings
  fastify.get('/mail/routing', async (request: any) => {
    const routing = await db('email_routing').where({ account_id: request.accountId });
    return routing;
  });

  // 8. Create or Update Email Routing
  fastify.post('/mail/routing', async (request: any, reply) => {
    const { domain, routingType } = request.body;
    const accountId = request.accountId;

    if (!domain || !routingType) {
      return reply.code(400).send({ error: 'Domain and routingType are required' });
    }

    const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
    if (!domainRecord) {
      return reply.code(403).send({ error: 'Unauthorized domain' });
    }

    try {
      const existing = await db('email_routing').where({ account_id: accountId, domain }).first();
      if (existing) {
        await db('email_routing')
          .where({ id: existing.id })
          .update({ routing_type: routingType, updated_at: new Date() });
      } else {
        await db('email_routing').insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          domain,
          routing_type: routingType
        });
      }
      return { success: true, domain, routingType };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 9. Get Autoresponders
  fastify.get('/mail/autoresponders', async (request: any) => {
    const autoresponders = await db('email_autoresponders').where({ account_id: request.accountId });
    return autoresponders;
  });

  // 10. Create or Update Autoresponder
  fastify.post('/mail/autoresponders', async (request: any, reply) => {
    const { email, fromName, subject, body, intervalHours } = request.body;
    const accountId = request.accountId;

    if (!email || !fromName || !subject || !body) {
      return reply.code(400).send({ error: 'Missing required autoresponder fields' });
    }

    try {
      const existing = await db('email_autoresponders').where({ account_id: accountId, email }).first();
      if (existing) {
        await db('email_autoresponders')
          .where({ id: existing.id })
          .update({
            from_name: fromName,
            subject,
            body,
            interval_hours: Number(intervalHours) || 1,
            updated_at: new Date()
          });
      } else {
        await db('email_autoresponders').insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          email,
          from_name: fromName,
          subject,
          body,
          interval_hours: Number(intervalHours) || 1,
          status: 'active'
        });
      }
      return { success: true, email };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 11. Delete Autoresponder
  fastify.delete('/mail/autoresponders/:autoresponderId', async (request: any, reply) => {
    const { autoresponderId } = request.params;
    const accountId = request.accountId;

    try {
      await db('email_autoresponders').where({ id: autoresponderId, account_id: accountId }).del();
      return { success: true, message: 'Autoresponder deleted successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}

