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

export async function calendarContactsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // ─── Spam Filters ──────────────────────────────────────────────────────────

  // GET /email/spam-config
  fastify.get('/email/spam-config', async (request: any) => {
    const accountId = request.accountId;

    const config = await db('spam_filter_configs').where({ account_id: accountId }).first();

    if (!config) {
      return {
        enabled: false,
        spam_threshold: 5.0,
        rewrite_subject: false,
        whitelist: '',
        blacklist: ''
      };
    }

    return {
      id: config.id,
      enabled: Boolean(config.enabled),
      spam_threshold: parseFloat(config.spam_threshold),
      rewrite_subject: Boolean(config.rewrite_subject),
      whitelist: config.whitelist || '',
      blacklist: config.blacklist || ''
    };
  });

  // POST /email/spam-config — upsert
  fastify.post('/email/spam-config', async (request: any, reply) => {
    const accountId = request.accountId;
    const { enabled, spam_threshold, rewrite_subject, whitelist, blacklist } = request.body;

    if (spam_threshold !== undefined && (isNaN(Number(spam_threshold)) || Number(spam_threshold) < 0)) {
      return reply.code(400).send({ error: 'spam_threshold must be a non-negative number' });
    }

    try {
      const existing = await db('spam_filter_configs').where({ account_id: accountId }).first();

      if (existing) {
        await db('spam_filter_configs')
          .where({ account_id: accountId })
          .update({
            enabled: enabled !== undefined ? Boolean(enabled) : existing.enabled,
            spam_threshold: spam_threshold !== undefined ? Number(spam_threshold) : existing.spam_threshold,
            rewrite_subject: rewrite_subject !== undefined ? Boolean(rewrite_subject) : existing.rewrite_subject,
            whitelist: whitelist !== undefined ? whitelist : existing.whitelist,
            blacklist: blacklist !== undefined ? blacklist : existing.blacklist,
            updated_at: new Date()
          });
      } else {
        await db('spam_filter_configs').insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          enabled: Boolean(enabled ?? false),
          spam_threshold: Number(spam_threshold ?? 5.0),
          rewrite_subject: Boolean(rewrite_subject ?? false),
          whitelist: whitelist || '',
          blacklist: blacklist || ''
        });
      }

      const updated = await db('spam_filter_configs').where({ account_id: accountId }).first();
      return {
        success: true,
        config: {
          id: updated.id,
          enabled: Boolean(updated.enabled),
          spam_threshold: parseFloat(updated.spam_threshold),
          rewrite_subject: Boolean(updated.rewrite_subject),
          whitelist: updated.whitelist || '',
          blacklist: updated.blacklist || ''
        }
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── CalDAV Config ─────────────────────────────────────────────────────────

  // GET /caldav/config
  fastify.get('/caldav/config', async (request: any) => {
    const accountId = request.accountId;

    const config = await db('caldav_configs').where({ account_id: accountId }).first();

    const connectionUrl = `caldav://localhost:3000/caldav/${accountId}/`;

    if (!config) {
      return {
        enabled: false,
        connection_url: connectionUrl
      };
    }

    return {
      id: config.id,
      enabled: Boolean(config.enabled),
      connection_url: connectionUrl
    };
  });

  // POST /caldav/config — upsert
  fastify.post('/caldav/config', async (request: any, reply) => {
    const accountId = request.accountId;
    const { enabled } = request.body;

    try {
      const existing = await db('caldav_configs').where({ account_id: accountId }).first();

      if (existing) {
        await db('caldav_configs')
          .where({ account_id: accountId })
          .update({
            enabled: enabled !== undefined ? Boolean(enabled) : existing.enabled,
            updated_at: new Date()
          });
      } else {
        await db('caldav_configs').insert({
          id: require('crypto').randomUUID(),
          account_id: accountId,
          enabled: Boolean(enabled ?? false)
        });
      }

      const updated = await db('caldav_configs').where({ account_id: accountId }).first();
      const connectionUrl = `caldav://localhost:3000/caldav/${accountId}/`;

      return {
        success: true,
        config: {
          id: updated.id,
          enabled: Boolean(updated.enabled),
          connection_url: connectionUrl
        }
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── Calendars ─────────────────────────────────────────────────────────────

  // GET /caldav/calendars
  fastify.get('/caldav/calendars', async (request: any) => {
    const calendars = await db('calendars').where({ account_id: request.accountId });
    return calendars;
  });

  // POST /caldav/calendars
  fastify.post('/caldav/calendars', async (request: any, reply) => {
    const accountId = request.accountId;
    const { name, color, description } = request.body;

    if (!name) {
      return reply.code(400).send({ error: 'Calendar name is required' });
    }

    try {
      const id = require('crypto').randomUUID();
      await db('calendars').insert({
        id,
        account_id: accountId,
        name,
        color: color || '#3b82f6',
        description: description || ''
      });

      const calendar = await db('calendars').where({ id }).first();
      return reply.code(201).send({ success: true, calendar });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // PUT /caldav/calendars/:id
  fastify.put('/caldav/calendars/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;
    const { name, color, description } = request.body;

    const calendar = await db('calendars').where({ id, account_id: accountId }).first();
    if (!calendar) {
      return reply.code(404).send({ error: 'Calendar not found or unauthorized' });
    }

    try {
      await db('calendars')
        .where({ id, account_id: accountId })
        .update({
          name: name !== undefined ? name : calendar.name,
          color: color !== undefined ? color : calendar.color,
          description: description !== undefined ? description : calendar.description,
          updated_at: new Date()
        });

      const updated = await db('calendars').where({ id }).first();
      return { success: true, calendar: updated };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // DELETE /caldav/calendars/:id
  fastify.delete('/caldav/calendars/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;

    const calendar = await db('calendars').where({ id, account_id: accountId }).first();
    if (!calendar) {
      return reply.code(404).send({ error: 'Calendar not found or unauthorized' });
    }

    try {
      await db('calendars').where({ id, account_id: accountId }).del();
      return { success: true, message: 'Calendar deleted successfully' };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ─── Contacts ──────────────────────────────────────────────────────────────

  // GET /caldav/contacts
  fastify.get('/caldav/contacts', async (request: any) => {
    const contacts = await db('contacts').where({ account_id: request.accountId });
    return contacts;
  });

  // POST /caldav/contacts
  fastify.post('/caldav/contacts', async (request: any, reply) => {
    const accountId = request.accountId;
    const { firstName, lastName, email, phone, company } = request.body;

    if (!firstName) {
      return reply.code(400).send({ error: 'firstName is required' });
    }

    try {
      const id = require('crypto').randomUUID();
      await db('contacts').insert({
        id,
        account_id: accountId,
        first_name: firstName,
        last_name: lastName || '',
        email: email || '',
        phone: phone || '',
        company: company || ''
      });

      const contact = await db('contacts').where({ id }).first();
      return reply.code(201).send({ success: true, contact });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // PUT /caldav/contacts/:id
  fastify.put('/caldav/contacts/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;
    const { firstName, lastName, email, phone, company } = request.body;

    const contact = await db('contacts').where({ id, account_id: accountId }).first();
    if (!contact) {
      return reply.code(404).send({ error: 'Contact not found or unauthorized' });
    }

    try {
      await db('contacts')
        .where({ id, account_id: accountId })
        .update({
          first_name: firstName !== undefined ? firstName : contact.first_name,
          last_name: lastName !== undefined ? lastName : contact.last_name,
          email: email !== undefined ? email : contact.email,
          phone: phone !== undefined ? phone : contact.phone,
          company: company !== undefined ? company : contact.company,
          updated_at: new Date()
        });

      const updated = await db('contacts').where({ id }).first();
      return { success: true, contact: updated };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // DELETE /caldav/contacts/:id
  fastify.delete('/caldav/contacts/:id', async (request: any, reply) => {
    const { id } = request.params;
    const accountId = request.accountId;

    const contact = await db('contacts').where({ id, account_id: accountId }).first();
    if (!contact) {
      return reply.code(404).send({ error: 'Contact not found or unauthorized' });
    }

    try {
      await db('contacts').where({ id, account_id: accountId }).del();
      return { success: true, message: 'Contact deleted successfully' };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
