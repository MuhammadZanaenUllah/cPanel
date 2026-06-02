import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';
import { SslService } from '../services/ssl';

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

export async function sslRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. Request Let's Encrypt Certificate
  fastify.post('/ssl', async (request: any, reply) => {
    const { domain } = request.body;
    const accountId = request.accountId;

    // Validate domain ownership and retrieve document root
    const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
    if (!domainRecord) return reply.code(403).send({ error: 'Domain unauthorized or missing' });

    try {
      await SslService.requestCertificate(accountId, domain, domainRecord.document_root);
      reply.code(201).send({ success: true, message: `SSL certificate issued for ${domain}` });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 2. List SSL Certificates
  fastify.get('/ssl', async (request: any) => {
    const certificates = await db('ssl_certificates').where({ account_id: request.accountId });
    return certificates;
  });

  // 3. Toggle Auto-Renew
  fastify.put('/ssl/:domain/autorenew', async (request: any, reply) => {
    const { domain } = request.params;
    const { autoRenew } = request.body;
    const accountId = request.accountId;

    try {
      await db('ssl_certificates').where({ account_id: accountId, domain }).update({
        auto_renew: autoRenew
      });
      return { success: true, autoRenew };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 4. Revoke/Delete SSL Certificate
  fastify.delete('/ssl/:domain', async (request: any, reply) => {
    const { domain } = request.params;
    const accountId = request.accountId;

    const certRecord = await db('ssl_certificates').where({ account_id: accountId, domain }).first();
    if (!certRecord) return reply.code(404).send({ error: 'Certificate not found or unauthorized' });

    try {
      await SslService.revokeCertificate(accountId, domain);
      return { success: true, message: 'SSL certificate revoked successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
