import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';

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

function isValidCronField(value: string): boolean {
  // Supports: * | */n | n | n-m | n,m | n-m/n | combinations
  return /^(\*|(\*|\d+(-\d+)?)(\/\d+)?)(,(\*|\d+(-\d+)?)(\/\d+)?)*$/.test(value);
}

export async function cronRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  fastify.get('/cron', async (request: any) => {
    const jobs = await db('cron_jobs').where({ account_id: request.accountId }).orderBy('created_at', 'desc');
    return jobs;
  });

  fastify.post('/cron', async (request: any, reply) => {
    const { minute = '*', hour = '*', day = '*', month = '*', weekday = '*', command } = request.body;
    const accountId = request.accountId;

    if (!command || command.trim().length === 0) {
      return reply.code(400).send({ error: 'Command is required' });
    }

    for (const [field, val] of [['minute', minute], ['hour', hour], ['day', day], ['month', month], ['weekday', weekday]]) {
      if (!isValidCronField(val as string)) {
        return reply.code(400).send({ error: `Invalid cron field: ${field}` });
      }
    }

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    const plan = await db('plans').where({ id: account.plan_id }).first();
    if (plan) {
      const countRow = await db('cron_jobs').where({ account_id: accountId }).count('id as c').first();
      const count = parseInt((countRow?.c as string) || '0');
      if (count >= plan.max_cron_jobs) {
        return reply.code(400).send({ error: `Cron job limit of ${plan.max_cron_jobs} reached for your plan` });
      }
    }

    const id = require('crypto').randomUUID();
    await db('cron_jobs').insert({
      id,
      account_id: accountId,
      minute,
      hour,
      day,
      month,
      weekday,
      command: command.trim(),
      enabled: true
    });

    reply.code(201).send({ success: true, id });
  });

  fastify.patch('/cron/:id', async (request: any, reply) => {
    const { id } = request.params as any;
    const { enabled } = request.body as any;

    const job = await db('cron_jobs').where({ id, account_id: request.accountId }).first();
    if (!job) return reply.code(404).send({ error: 'Cron job not found' });

    await db('cron_jobs').where({ id }).update({ enabled: Boolean(enabled) });
    return { success: true };
  });

  fastify.delete('/cron/:id', async (request: any, reply) => {
    const { id } = request.params as any;

    const job = await db('cron_jobs').where({ id, account_id: request.accountId }).first();
    if (!job) return reply.code(404).send({ error: 'Cron job not found' });

    await db('cron_jobs').where({ id }).del();
    return { success: true, message: 'Cron job deleted' };
  });
}
