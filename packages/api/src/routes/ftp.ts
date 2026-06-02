import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';
import { FtpService } from '../services/ftp';

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

export async function ftpRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. Create FTP Account
  fastify.post('/ftp', async (request: any, reply) => {
    const { username, password, relativeHomedir, quotaMb } = request.body;
    const accountId = request.accountId;

    try {
      await FtpService.createFtpAccount(accountId, username, password, relativeHomedir, quotaMb);
      const account = await db('accounts').where({ id: accountId }).first();
      const domain = account?.primary_domain || 'localhost';
      reply.code(201).send({ success: true, username: `${username}@${domain}` });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 2. List FTP Accounts
  fastify.get('/ftp', async (request: any) => {
    const accounts = await db('ftp_accounts').where({ account_id: request.accountId });
    return accounts;
  });

  // 3. Delete FTP Account
  fastify.delete('/ftp/:ftpUsername', async (request: any, reply) => {
    const { ftpUsername } = request.params;
    const accountId = request.accountId;

    const [username] = ftpUsername.split('@');

    // Validate ownership
    const ftpRecord = await db('ftp_accounts').where({
      account_id: accountId,
      username: ftpUsername
    }).first();

    if (!ftpRecord) return reply.code(404).send({ error: 'FTP account not found or unauthorized' });

    try {
      await FtpService.deleteFtpAccount(accountId, username);
      return { success: true, message: 'FTP account deleted successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
