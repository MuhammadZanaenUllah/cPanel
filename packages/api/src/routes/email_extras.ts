import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';
import bcrypt from 'bcryptjs';

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

export async function emailExtrasRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // ─── Default Address ────────────────────────────────────────────────────────

  fastify.get('/email/default-address', async (request: any) => {
    const row = await db('default_addresses')
      .where({ account_id: request.accountId })
      .first();
    return row ?? {};
  });

  fastify.post('/email/default-address', async (request: any, reply) => {
    const { domain, action, forwardTo } = request.body;
    const accountId = request.accountId;

    if (!domain || !action) {
      return reply.code(400).send({ error: 'domain and action are required' });
    }
    const validActions = ['discard', 'bounce', 'forward'];
    if (!validActions.includes(action)) {
      return reply.code(400).send({ error: `action must be one of: ${validActions.join(', ')}` });
    }
    if (action === 'forward' && !forwardTo) {
      return reply.code(400).send({ error: 'forwardTo is required when action is forward' });
    }

    const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
    if (!domainRecord) {
      return reply.code(403).send({ error: 'Unauthorized domain' });
    }

    try {
      await db('default_addresses')
        .insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          domain,
          action,
          forward_to: action === 'forward' ? forwardTo : null,
        })
        .onConflict(['account_id', 'domain'])
        .merge({
          action,
          forward_to: action === 'forward' ? forwardTo : null,
          updated_at: db.fn.now(),
        });

      const result = await db('default_addresses').where({ account_id: accountId, domain }).first();
      return result;
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── Mailing Lists ───────────────────────────────────────────────────────────

  fastify.get('/email/mailing-lists', async (request: any) => {
    const lists = await db('mailing_lists')
      .where({ account_id: request.accountId })
      .select('id', 'list_name', 'domain', 'description', 'admin_email', 'created_at', 'updated_at');
    return lists;
  });

  fastify.post('/email/mailing-lists', async (request: any, reply) => {
    const { listName, domain, description, adminEmail, password } = request.body;
    const accountId = request.accountId;

    if (!listName || !domain || !adminEmail || !password) {
      return reply.code(400).send({ error: 'listName, domain, adminEmail, and password are required' });
    }

    const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
    if (!domainRecord) {
      return reply.code(403).send({ error: 'Unauthorized domain' });
    }

    const existing = await db('mailing_lists').where({ list_name: listName, domain }).first();
    if (existing) {
      return reply.code(409).send({ error: 'Mailing list already exists for that name and domain' });
    }

    try {
      const password_hash = await bcrypt.hash(password, 10);
      const id = require('crypto').randomUUID();
      await db('mailing_lists').insert({
        id,
        account_id: accountId,
        list_name: listName,
        domain,
        description: description ?? null,
        admin_email: adminEmail,
        password_hash,
      });
      const created = await db('mailing_lists')
        .where({ id })
        .select('id', 'list_name', 'domain', 'description', 'admin_email', 'created_at')
        .first();
      return reply.code(201).send(created);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.delete('/email/mailing-lists/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;

    const list = await db('mailing_lists').where({ id, account_id: accountId }).first();
    if (!list) {
      return reply.code(404).send({ error: 'Mailing list not found or unauthorized' });
    }

    try {
      await db('mailing_lists').where({ id }).del();
      return { success: true, message: 'Mailing list deleted' };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Subscribers sub-resource

  fastify.get('/email/mailing-lists/:id/subscribers', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;

    const list = await db('mailing_lists').where({ id, account_id: accountId }).first();
    if (!list) {
      return reply.code(404).send({ error: 'Mailing list not found or unauthorized' });
    }

    const subscribers = await db('mailing_list_subscribers')
      .where({ list_id: id })
      .select('id', 'email', 'subscribed_at');
    return subscribers;
  });

  fastify.post('/email/mailing-lists/:id/subscribers', async (request: any, reply) => {
    const { id } = request.params;
    const { email } = request.body;
    const accountId = request.accountId;

    if (!email) {
      return reply.code(400).send({ error: 'email is required' });
    }

    const list = await db('mailing_lists').where({ id, account_id: accountId }).first();
    if (!list) {
      return reply.code(404).send({ error: 'Mailing list not found or unauthorized' });
    }

    const existing = await db('mailing_list_subscribers').where({ list_id: id, email }).first();
    if (existing) {
      return reply.code(409).send({ error: 'Email is already subscribed' });
    }

    try {
      const subId = require('crypto').randomUUID();
      await db('mailing_list_subscribers').insert({
        id: subId,
        list_id: id,
        email,
        subscribed_at: new Date(),
      });
      const created = await db('mailing_list_subscribers').where({ id: subId }).first();
      return reply.code(201).send(created);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.delete('/email/mailing-lists/:id/subscribers/:email', async (request: any, reply) => {
    const { id, email } = request.params;
    const accountId = request.accountId;

    const list = await db('mailing_lists').where({ id, account_id: accountId }).first();
    if (!list) {
      return reply.code(404).send({ error: 'Mailing list not found or unauthorized' });
    }

    const sub = await db('mailing_list_subscribers').where({ list_id: id, email }).first();
    if (!sub) {
      return reply.code(404).send({ error: 'Subscriber not found' });
    }

    try {
      await db('mailing_list_subscribers').where({ list_id: id, email }).del();
      return { success: true, message: 'Subscriber removed' };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── Email Filters ───────────────────────────────────────────────────────────

  fastify.get('/email/filters', async (request: any, reply) => {
    const { scope } = request.query as { scope?: string };
    const accountId = request.accountId;

    const validScopes = ['global', 'account'];
    if (scope && !validScopes.includes(scope)) {
      return reply.code(400).send({ error: `scope must be one of: ${validScopes.join(', ')}` });
    }

    const query = db('email_filters').where({ account_id: accountId });
    if (scope) {
      query.andWhere({ scope });
    }

    const filters = await query.select(
      'id', 'filter_name', 'scope', 'rules', 'action_type', 'action_value',
      'priority', 'enabled', 'created_at', 'updated_at'
    );

    return filters.map((f: any) => ({
      ...f,
      rules: typeof f.rules === 'string' ? JSON.parse(f.rules) : f.rules,
    }));
  });

  fastify.post('/email/filters', async (request: any, reply) => {
    const { filterName, scope, rules, actionType, actionValue, priority, enabled } = request.body;
    const accountId = request.accountId;

    if (!filterName || !scope || !rules || !actionType) {
      return reply.code(400).send({ error: 'filterName, scope, rules, and actionType are required' });
    }

    const validScopes = ['global', 'account'];
    if (!validScopes.includes(scope)) {
      return reply.code(400).send({ error: `scope must be one of: ${validScopes.join(', ')}` });
    }

    const validActionTypes = ['move_to_folder', 'forward_to', 'delete', 'mark_as_spam', 'discard'];
    if (!validActionTypes.includes(actionType)) {
      return reply.code(400).send({ error: `actionType must be one of: ${validActionTypes.join(', ')}` });
    }

    if (!Array.isArray(rules) || rules.length === 0) {
      return reply.code(400).send({ error: 'rules must be a non-empty array' });
    }

    const validFields = ['from', 'to', 'subject', 'body'];
    const validOperators = ['contains', 'equals', 'starts_with', 'regex'];
    for (const rule of rules) {
      if (!validFields.includes(rule.field)) {
        return reply.code(400).send({ error: `rule.field must be one of: ${validFields.join(', ')}` });
      }
      if (!validOperators.includes(rule.operator)) {
        return reply.code(400).send({ error: `rule.operator must be one of: ${validOperators.join(', ')}` });
      }
      if (typeof rule.value !== 'string') {
        return reply.code(400).send({ error: 'rule.value must be a string' });
      }
    }

    try {
      const id = require('crypto').randomUUID();
      await db('email_filters').insert({
        id,
        account_id: accountId,
        filter_name: filterName,
        scope,
        rules: JSON.stringify(rules),
        action_type: actionType,
        action_value: actionValue ?? null,
        priority: priority ?? 0,
        enabled: enabled !== undefined ? enabled : true,
      });
      const created = await db('email_filters').where({ id }).first();
      return reply.code(201).send({
        ...created,
        rules: typeof created.rules === 'string' ? JSON.parse(created.rules) : created.rules,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.put('/email/filters/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;
    const { filterName, scope, rules, actionType, actionValue, priority, enabled } = request.body;

    const filter = await db('email_filters').where({ id, account_id: accountId }).first();
    if (!filter) {
      return reply.code(404).send({ error: 'Filter not found or unauthorized' });
    }

    const updates: Record<string, any> = { updated_at: new Date() };

    if (filterName !== undefined) updates.filter_name = filterName;
    if (scope !== undefined) {
      const validScopes = ['global', 'account'];
      if (!validScopes.includes(scope)) {
        return reply.code(400).send({ error: `scope must be one of: ${validScopes.join(', ')}` });
      }
      updates.scope = scope;
    }
    if (rules !== undefined) {
      if (!Array.isArray(rules) || rules.length === 0) {
        return reply.code(400).send({ error: 'rules must be a non-empty array' });
      }
      updates.rules = JSON.stringify(rules);
    }
    if (actionType !== undefined) {
      const validActionTypes = ['move_to_folder', 'forward_to', 'delete', 'mark_as_spam', 'discard'];
      if (!validActionTypes.includes(actionType)) {
        return reply.code(400).send({ error: `actionType must be one of: ${validActionTypes.join(', ')}` });
      }
      updates.action_type = actionType;
    }
    if (actionValue !== undefined) updates.action_value = actionValue;
    if (priority !== undefined) updates.priority = priority;
    if (enabled !== undefined) updates.enabled = enabled;

    try {
      await db('email_filters').where({ id }).update(updates);
      const updated = await db('email_filters').where({ id }).first();
      return {
        ...updated,
        rules: typeof updated.rules === 'string' ? JSON.parse(updated.rules) : updated.rules,
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.delete('/email/filters/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;

    const filter = await db('email_filters').where({ id, account_id: accountId }).first();
    if (!filter) {
      return reply.code(404).send({ error: 'Filter not found or unauthorized' });
    }

    try {
      await db('email_filters').where({ id }).del();
      return { success: true, message: 'Filter deleted' };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── Address Importer ────────────────────────────────────────────────────────

  fastify.post('/email/import', async (request: any, reply) => {
    const { accounts } = request.body as {
      accounts: Array<{ email: string; password: string; quota_mb?: number }>;
    };
    const accountId = request.accountId;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return reply.code(400).send({ error: 'accounts must be a non-empty array' });
    }

    const imported: string[] = [];
    const failed: Array<{ email: string; reason: string }> = [];

    for (const entry of accounts) {
      const { email, password, quota_mb } = entry;

      if (!email || !password) {
        failed.push({ email: email ?? '(missing)', reason: 'email and password are required' });
        continue;
      }

      const atIndex = email.indexOf('@');
      if (atIndex < 1 || atIndex === email.length - 1) {
        failed.push({ email, reason: 'Invalid email format' });
        continue;
      }

      const local_part = email.substring(0, atIndex);
      const domain = email.substring(atIndex + 1);

      const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
      if (!domainRecord) {
        failed.push({ email, reason: `Domain ${domain} not found or unauthorized` });
        continue;
      }

      const existing = await db('email_accounts')
        .where({ account_id: accountId, local_part, domain })
        .first();
      if (existing) {
        failed.push({ email, reason: 'Email account already exists' });
        continue;
      }

      try {
        const password_hash = await bcrypt.hash(password, 10);
        await db('email_accounts').insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          local_part,
          domain,
          password_hash,
          quota_mb: quota_mb ?? 250,
          used_mb: 0,
          status: 'active',
        });
        imported.push(email);
      } catch (err: any) {
        failed.push({ email, reason: err.message });
      }
    }

    return { imported: imported.length, failed };
  });

  // ─── BoxTrapper ──────────────────────────────────────────────────────────────

  fastify.get('/email/boxtrapper', async (request: any) => {
    const config = await db('boxtrapper_configs')
      .where({ account_id: request.accountId })
      .first();
    return config ?? { account_id: request.accountId, enabled: false };
  });

  fastify.post('/email/boxtrapper', async (request: any, reply) => {
    const { enabled, queueDays, whitelist, blacklist } = request.body;
    const accountId = request.accountId;

    try {
      await db('boxtrapper_configs')
        .insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          enabled: enabled ?? false,
          queue_days: queueDays ?? 7,
          whitelist: whitelist ?? null,
          blacklist: blacklist ?? null,
        })
        .onConflict(['account_id'])
        .merge({
          enabled: enabled ?? false,
          queue_days: queueDays ?? 7,
          whitelist: whitelist ?? null,
          blacklist: blacklist ?? null,
          updated_at: db.fn.now(),
        });

      const config = await db('boxtrapper_configs').where({ account_id: accountId }).first();
      return config;
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── GPG Keys / Encryption ───────────────────────────────────────────────────

  fastify.get('/email/gpg-keys', async (request: any) => {
    const keys = await db('gpg_keys')
      .where({ account_id: request.accountId })
      .select('id', 'key_id', 'name', 'email', 'created_at');
    return keys;
  });

  fastify.post('/email/gpg-keys', async (request: any, reply) => {
    const { keyId, name, email, publicKey } = request.body;
    const accountId = request.accountId;

    if (!keyId || !name || !email || !publicKey) {
      return reply.code(400).send({ error: 'keyId, name, email, and publicKey are required' });
    }

    try {
      const id = require('crypto').randomUUID();
      await db('gpg_keys').insert({
        id,
        account_id: accountId,
        key_id: keyId,
        name,
        email,
        public_key: publicKey,
      });
      const created = await db('gpg_keys')
        .where({ id })
        .select('id', 'key_id', 'name', 'email', 'created_at')
        .first();
      return reply.code(201).send(created);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.delete('/email/gpg-keys/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;

    const key = await db('gpg_keys').where({ id, account_id: accountId }).first();
    if (!key) {
      return reply.code(404).send({ error: 'GPG key not found or unauthorized' });
    }

    try {
      await db('gpg_keys').where({ id }).del();
      return { success: true, message: 'GPG key deleted' };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── Track Delivery ──────────────────────────────────────────────────────────

  fastify.get('/email/delivery-log', async (request: any, reply) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const accountId = request.accountId;

    const parsedLimit = Math.min(parseInt(limit ?? '50', 10), 500);
    const parsedOffset = parseInt(offset ?? '0', 10);

    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return reply.code(400).send({ error: 'limit must be a positive integer' });
    }
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return reply.code(400).send({ error: 'offset must be a non-negative integer' });
    }

    const logs = await db('email_delivery_logs')
      .where({ account_id: accountId })
      .orderBy('created_at', 'desc')
      .limit(parsedLimit)
      .offset(parsedOffset)
      .select('id', 'sender', 'recipient', 'subject', 'status', 'error_message', 'created_at');

    const [{ total }] = await db('email_delivery_logs')
      .where({ account_id: accountId })
      .count('id as total');

    return { logs, total: Number(total), limit: parsedLimit, offset: parsedOffset };
  });

  // ─── Email Deliverability ────────────────────────────────────────────────────

  fastify.get('/email/deliverability', async (request: any, reply) => {
    const { domain } = request.query as { domain?: string };
    const accountId = request.accountId;

    if (!domain) {
      return reply.code(400).send({ error: 'domain query parameter is required' });
    }

    // Allow primary domain from accounts table as well as addon domains
    const domainRecord = await db('domains').where({ account_id: accountId, domain }).first();
    const account = await db('accounts').where({ id: accountId }).first();
    if (!domainRecord && account?.primary_domain !== domain) {
      return reply.code(403).send({ error: 'Domain not found or unauthorized' });
    }

    return {
      domain,
      spf: {
        status: 'missing',
        recommendation: `Add a TXT record to ${domain}: v=spf1 include:mail.${domain} ~all`,
      },
      dkim: {
        status: 'missing',
        recommendation: `Generate a DKIM key pair and publish the public key as a TXT record at default._domainkey.${domain}`,
      },
      dmarc: {
        status: 'missing',
        recommendation: `Add a TXT record at _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      },
    };
  });

  // ─── Email Disk Usage ────────────────────────────────────────────────────────

  fastify.get('/email/disk-usage', async (request: any) => {
    const accountId = request.accountId;

    const accounts = await db('email_accounts')
      .where({ account_id: accountId })
      .select('local_part', 'domain', 'quota_mb');

    const formatted = accounts.map((a: any) => ({
      email: `${a.local_part}@${a.domain}`,
      quota_mb: Number(a.quota_mb) || 0,
      used_mb: 0, // actual usage requires filesystem scan; 0 in dev
    }));

    const total_quota_mb = formatted.reduce((sum: number, a: any) => sum + a.quota_mb, 0);
    const total_used_mb = formatted.reduce((sum: number, a: any) => sum + a.used_mb, 0);

    return { accounts: formatted, total_quota_mb, total_used_mb };
  });
}
