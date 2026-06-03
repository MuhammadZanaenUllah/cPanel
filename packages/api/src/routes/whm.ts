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
  fastify.get('/stats', async () => {
    const [accountCount, domainCount, emailCount, planCount, suspendedCount, provisioningCount, ftpCount, dbCount] = await Promise.all([
      db('accounts').count('id as c').first(),
      db('domains').count('id as c').first(),
      db('email_accounts').count('id as c').first(),
      db('plans').where({ is_active: true }).count('id as c').first(),
      db('accounts').where({ status: 'suspended' }).count('id as c').first(),
      db('accounts').where({ status: 'provisioning' }).count('id as c').first(),
      db('ftp_accounts').count('id as c').first(),
      db('mysql_databases').count('id as c').first(),
    ]);
    return {
      accounts: parseInt((accountCount?.c as string) || '0'),
      domains: parseInt((domainCount?.c as string) || '0'),
      emails: parseInt((emailCount?.c as string) || '0'),
      plans: parseInt((planCount?.c as string) || '0'),
      suspended: parseInt((suspendedCount?.c as string) || '0'),
      provisioning: parseInt((provisioningCount?.c as string) || '0'),
      ftp_accounts: parseInt((ftpCount?.c as string) || '0'),
      databases: parseInt((dbCount?.c as string) || '0'),
    };
  });

  // 9. Account detail
  fastify.get('/accounts/:id', async (request, reply) => {
    const { id } = request.params as any;
    const account = await db('accounts').where({ id }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });
    const plan = await db('plans').where({ id: account.plan_id }).first();
    const emailCount = await db('email_accounts').where({ account_id: id }).count('id as c').first();
    const dbCount = await db('mysql_databases').where({ account_id: id }).count('id as c').first();
    const ftpCount = await db('ftp_accounts').where({ account_id: id }).count('id as c').first();
    const domainCount = await db('domains').where({ account_id: id }).count('id as c').first();
    const { password_hash, ...safe } = account;
    return {
      ...safe,
      plan,
      usage: {
        email_accounts: parseInt((emailCount?.c as string) || '0'),
        databases: parseInt((dbCount?.c as string) || '0'),
        ftp_accounts: parseInt((ftpCount?.c as string) || '0'),
        addon_domains: parseInt((domainCount?.c as string) || '0'),
      }
    };
  });

  // 10. Change account plan
  fastify.post('/accounts/:id/change-plan', async (request, reply) => {
    const { id } = request.params as any;
    const { planId } = request.body as any;
    const account = await db('accounts').where({ id }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });
    const plan = await db('plans').where({ id: planId }).first();
    if (!plan) return reply.code(404).send({ error: 'Plan not found' });
    await db('accounts').where({ id }).update({ plan_id: planId });
    return { success: true, message: `Plan changed to ${plan.name}` };
  });

  // 11. Change account password
  fastify.post('/accounts/:id/change-password', async (request, reply) => {
    const { id } = request.params as any;
    const { password } = request.body as any;
    if (!password || password.length < 6) return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    await db('accounts').where({ id }).update({ password_hash: hash });
    return { success: true, message: 'Password updated' };
  });

  // 12. Edit plan
  fastify.put('/plans/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { name, disk_mb, bandwidth_mb, max_email_accounts, max_databases,
      max_ftp_accounts, max_subdomains, max_addon_domains, max_cron_jobs, price_monthly } = request.body as any;
    const plan = await db('plans').where({ id }).first();
    if (!plan) return reply.code(404).send({ error: 'Plan not found' });
    await db('plans').where({ id }).update({
      name: name ?? plan.name,
      disk_mb: disk_mb ?? plan.disk_mb,
      bandwidth_mb: bandwidth_mb ?? plan.bandwidth_mb,
      max_email_accounts: max_email_accounts ?? plan.max_email_accounts,
      max_databases: max_databases ?? plan.max_databases,
      max_ftp_accounts: max_ftp_accounts ?? plan.max_ftp_accounts,
      max_subdomains: max_subdomains ?? plan.max_subdomains,
      max_addon_domains: max_addon_domains ?? plan.max_addon_domains,
      max_cron_jobs: max_cron_jobs ?? plan.max_cron_jobs,
      price_monthly: price_monthly ?? plan.price_monthly,
    });
    return { success: true };
  });

  // 13. Toggle plan active/inactive
  fastify.patch('/plans/:id/toggle', async (request, reply) => {
    const { id } = request.params as any;
    const plan = await db('plans').where({ id }).first();
    if (!plan) return reply.code(404).send({ error: 'Plan not found' });
    await db('plans').where({ id }).update({ is_active: !plan.is_active });
    return { success: true, is_active: !plan.is_active };
  });

  // 14. Delete plan (only if no accounts use it)
  fastify.delete('/plans/:id', async (request, reply) => {
    const { id } = request.params as any;
    const using = await db('accounts').where({ plan_id: id }).count('id as c').first();
    if (parseInt((using?.c as string) || '0') > 0) {
      return reply.code(400).send({ error: 'Cannot delete plan with active accounts' });
    }
    await db('plans').where({ id }).del();
    return { success: true };
  });

  // 15. Service status (ping each service)
  fastify.get('/service-status', async () => {
    const ping = async (fn: () => Promise<void>): Promise<{ online: boolean; latency?: number }> => {
      const start = process.hrtime.bigint();
      try {
        await fn();
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        return { online: true, latency: Math.round(ms) };
      } catch {
        return { online: false };
      }
    };
    const [mysql, redis] = await Promise.all([
      ping(async () => { await db.raw('SELECT 1'); }),
      ping(async () => {
        const Redis = require('ioredis');
        const r = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379'), connectTimeout: 2000, lazyConnect: true });
        await r.connect(); await r.ping(); r.disconnect();
      }),
    ]);
    return { mysql, redis, api: { online: true, latency: 0 } };
  });

  // 16. Recent activity (last 20 account actions from accounts table)
  fastify.get('/activity', async () => {
    const recent = await db('accounts')
      .orderBy('created_at', 'desc')
      .limit(10)
      .select('id', 'username', 'primary_domain', 'status', 'role', 'created_at', 'suspended_at');
    return recent.map((a: any) => ({
      id: a.id,
      username: a.username,
      domain: a.primary_domain,
      status: a.status,
      role: a.role,
      event: a.status === 'suspended' ? 'Account Suspended' : a.status === 'provisioning' ? 'Account Created' : 'Account Active',
      time: a.suspended_at || a.created_at,
    }));
  });

  // 17. Get all plans (including inactive for admin view)
  fastify.get('/plans/all', async () => {
    const plans = await db('plans').orderBy('price_monthly', 'asc');
    const counts = await db('accounts').groupBy('plan_id').select('plan_id').count('id as c');
    const countMap: Record<string, number> = {};
    counts.forEach((r: any) => { countMap[r.plan_id] = parseInt(r.c); });
    return plans.map((p: any) => ({ ...p, account_count: countMap[p.id] || 0 }));
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
