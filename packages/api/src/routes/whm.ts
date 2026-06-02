import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';
import { AccountService } from '../services/account';
import { sendPrivilegedCommand } from '../privileged/client';

async function whmAuth(request: any, reply: any) {
  const token = request.headers['x-whm-api-token'];
  
  if (token) {
    // Authenticating via WHM API Token
    // In production, we compare against a hashed token in the DB.
    // For this implementation, we compare against a configure key in .env
    const expectedToken = process.env.WHM_API_KEY || 'default-whm-key';
    if (token !== expectedToken) {
      return reply.code(401).send({ error: 'Invalid WHM API Token' });
    }
  } else {
    // Authenticate via standard Admin JWT
    try {
      await request.jwtVerify();
      if (request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden: Admin access required' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  }
}

export async function whmRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', whmAuth);

  // 1. Create Hosting Account (Provisioning)
  fastify.post('/accounts', async (request, reply) => {
    const { serverId, planId, username, domain, email, password } = request.body as any;
    
    try {
      const result = await AccountService.createAccount({
        serverId,
        planId,
        username,
        domain,
        email,
        password
      });
      reply.code(202).send(result);
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 2. List Hosting Accounts
  fastify.get('/accounts', async (request, reply) => {
    const accounts = await db('accounts').select(
      'id', 'username', 'primary_domain', 'email', 'status', 'role', 'created_at'
    );
    return accounts;
  });

  // 3. Suspend Hosting Account
  fastify.post('/accounts/:id/suspend', async (request, reply) => {
    const { id } = request.params as any;
    const { reason } = request.body as any;

    const account = await db('accounts').where({ id }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    try {
      // Suspend system user via root privileged worker
      await sendPrivilegedCommand('suspend_system_user', { username: account.username });
      
      await db('accounts').where({ id }).update({
        status: 'suspended',
        suspended_at: new Date(),
        suspend_reason: reason || 'Suspended by Administrator'
      });

      return { success: true, message: 'Account suspended successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 4. Unsuspend Hosting Account
  fastify.post('/accounts/:id/unsuspend', async (request, reply) => {
    const { id } = request.params as any;

    const account = await db('accounts').where({ id }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    try {
      // Unsuspend system user via root privileged worker
      await sendPrivilegedCommand('unsuspend_system_user', { username: account.username });
      
      await db('accounts').where({ id }).update({
        status: 'active',
        suspended_at: null,
        suspend_reason: null
      });

      return { success: true, message: 'Account unsuspended successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 5. Terminate Hosting Account (Delete)
  fastify.delete('/accounts/:id', async (request, reply) => {
    const { id } = request.params as any;

    const account = await db('accounts').where({ id }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    try {
      // Delete system user and home directory via root privileged worker
      await sendPrivilegedCommand('delete_system_user', { username: account.username });
      
      // Cascade delete DB entries
      await db('accounts').where({ id }).del();

      return { success: true, message: 'Account terminated successfully' };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 6. List Plans
  fastify.get('/plans', async () => {
    const plans = await db('plans').where({ is_active: true });
    return plans;
  });

  // 7. Create Plan
  fastify.post('/plans', async (request, reply) => {
    const {
      name, disk_mb, bandwidth_mb, max_email_accounts, max_databases,
      max_ftp_accounts, max_subdomains, max_addon_domains, max_cron_jobs,
      price_monthly
    } = request.body as any;

    if (!name || !disk_mb) return reply.code(400).send({ error: 'name and disk_mb are required' });

    const id = require('crypto').randomUUID();
    await db('plans').insert({
      id, name,
      disk_mb: disk_mb || 10240,
      bandwidth_mb: bandwidth_mb || 102400,
      max_email_accounts: max_email_accounts ?? 50,
      max_databases: max_databases ?? 20,
      max_ftp_accounts: max_ftp_accounts ?? 20,
      max_subdomains: max_subdomains ?? 20,
      max_addon_domains: max_addon_domains ?? 10,
      max_cron_jobs: max_cron_jobs ?? 20,
      php_versions: '8.1,8.2,8.3',
      price_monthly: price_monthly || 0,
      is_active: true
    });

    reply.code(201).send({ success: true, id });
  });

  // 8. Server health stats (root only)
  fastify.get('/stats', async (_request, _reply) => {
    const accountCount = await db('accounts').count('id as c').first();
    const domainCount = await db('domains').count('id as c').first();
    const emailCount = await db('email_accounts').count('id as c').first();
    return {
      accounts: parseInt((accountCount?.c as string) || '0'),
      domains: parseInt((domainCount?.c as string) || '0'),
      emails: parseInt((emailCount?.c as string) || '0')
    };
  });

  // ---- WHMCS-Compatible WHM API1 Endpoints ----
  // WHMCS calls these when managing hosting accounts

  fastify.post('/json-api/createacct', async (request, reply) => {
    const { username, domain, password, plan: planName, contactemail } = request.body as any;

    if (!username || !domain) {
      return reply.code(400).send({ result: [{ status: 0, statusmsg: 'username and domain are required' }] });
    }

    try {
      const server = await db('servers').first();
      if (!server) return reply.code(500).send({ result: [{ status: 0, statusmsg: 'No server configured' }] });

      let plan = await db('plans').where({ name: planName }).first();
      if (!plan) plan = await db('plans').where({ is_active: true }).first();
      if (!plan) return reply.code(500).send({ result: [{ status: 0, statusmsg: 'No plans configured' }] });

      const result = await AccountService.createAccount({
        serverId: server.id,
        planId: plan.id,
        username,
        domain,
        email: contactemail || `${username}@${domain}`,
        password
      });

      return {
        result: [{
          status: 1,
          statusmsg: 'Account Creation OK',
          options: { ip: server.ip_address, uid: 1000, jobId: result.accountId }
        }]
      };
    } catch (err: any) {
      return { result: [{ status: 0, statusmsg: err.message }] };
    }
  });

  fastify.post('/json-api/suspendacct', async (request, reply) => {
    const { user, reason } = request.body as any;

    const account = await db('accounts').where({ username: user }).first();
    if (!account) return reply.code(404).send({ result: [{ status: 0, statusmsg: 'Account not found' }] });

    try {
      await sendPrivilegedCommand('suspend_system_user', { username: account.username });
      await db('accounts').where({ id: account.id }).update({
        status: 'suspended',
        suspended_at: new Date(),
        suspend_reason: reason || 'Suspended via WHMCS'
      });
      return { result: [{ status: 1, statusmsg: 'Account Suspended' }] };
    } catch (err: any) {
      return { result: [{ status: 0, statusmsg: err.message }] };
    }
  });

  fastify.post('/json-api/unsuspendacct', async (request, reply) => {
    const { user } = request.body as any;

    const account = await db('accounts').where({ username: user }).first();
    if (!account) return reply.code(404).send({ result: [{ status: 0, statusmsg: 'Account not found' }] });

    try {
      await sendPrivilegedCommand('unsuspend_system_user', { username: account.username });
      await db('accounts').where({ id: account.id }).update({
        status: 'active',
        suspended_at: null,
        suspend_reason: null
      });
      return { result: [{ status: 1, statusmsg: 'Account Unsuspended' }] };
    } catch (err: any) {
      return { result: [{ status: 0, statusmsg: err.message }] };
    }
  });

  fastify.post('/json-api/terminateacct', async (request, reply) => {
    const { user } = request.body as any;

    const account = await db('accounts').where({ username: user }).first();
    if (!account) return reply.code(404).send({ result: [{ status: 0, statusmsg: 'Account not found' }] });

    try {
      await sendPrivilegedCommand('delete_system_user', { username: account.username });
      await db('accounts').where({ id: account.id }).del();
      return { result: [{ status: 1, statusmsg: 'Account Termination Complete' }] };
    } catch (err: any) {
      return { result: [{ status: 0, statusmsg: err.message }] };
    }
  });

  fastify.get('/json-api/accountsummary', async (request, reply) => {
    const { user } = request.query as any;

    const account = await db('accounts').where({ username: user }).first();
    if (!account) return reply.code(404).send({ acct: [] });

    const plan = await db('plans').where({ id: account.plan_id }).first();
    const emailCount = await db('email_accounts').where({ account_id: account.id }).count('id as c').first();
    const dbCount = await db('mysql_databases').where({ account_id: account.id }).count('id as c').first();

    return {
      acct: [{
        user: account.username,
        domain: account.primary_domain,
        email: account.email,
        plan: plan?.name || 'unknown',
        status: account.status,
        diskused: 0,
        disklimit: plan?.disk_mb || 0,
        emailaccounts: parseInt((emailCount?.c as string) || '0'),
        mysqldbs: parseInt((dbCount?.c as string) || '0'),
        created: account.created_at
      }]
    };
  });
}
