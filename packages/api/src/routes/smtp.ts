import { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { db } from '../db/connection';

// ── Ensure email_delivery_log table exists ────────────────────────────────────
async function ensureDeliveryLog() {
  const has = await db.schema.hasTable('email_delivery_log');
  if (!has) {
    await db.schema.createTable('email_delivery_log', (t) => {
      t.uuid('id').primary();
      t.uuid('account_id').notNullable().index();
      t.string('sender', 320).notNullable();
      t.string('recipient', 320).notNullable();
      t.string('subject', 998).notNullable().defaultTo('');
      t.text('body').defaultTo('');
      t.string('status', 50).notNullable().defaultTo('delivered');
      t.string('message_id', 500).nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }
}
ensureDeliveryLog().catch(() => {});

// ── Lazy SMTP transporter ─────────────────────────────────────────────────────
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  // Always build fresh — reads current env vars so hot-swap works after container restart
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mailhog',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: (process.env.SMTP_USER && process.env.SMTP_PASS)
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return _transporter;
}

const MAILHOG_API = `http://mailhog:8025/api/v2`;
const isMailhog = () => (process.env.SMTP_HOST || 'mailhog') === 'mailhog';

async function cpanelAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
    request.accountId = request.user.role !== 'admin'
      ? request.user.id
      : (request.query.accountId || request.body?.accountId || request.user.id);
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function smtpRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // ── POST /mail/send ───────────────────────────────────────────────────────
  fastify.post('/mail/send', async (request: any, reply) => {
    const { from, to, cc, subject, body, html } = request.body as {
      from: string; to: string; cc?: string; subject: string; body?: string; html?: string;
    };

    if (!from || !to || !subject) {
      return reply.code(400).send({ error: 'from, to, and subject are required' });
    }

    const [localPart, domain] = from.split('@');
    if (!localPart || !domain) return reply.code(400).send({ error: 'Invalid from address' });

    // Verify sender belongs to this cPanel account
    const emailRecord = await db('email_accounts').where({
      account_id: request.accountId, local_part: localPart, domain,
    }).first();
    if (!emailRecord) {
      return reply.code(403).send({ error: `${from} does not belong to your account` });
    }

    try {
      const info = await getTransporter().sendMail({
        from: `cPanel Mail <${from}>`,
        to,
        cc: cc || undefined,
        subject,
        text: body || '',
        html: html || undefined,
      });

      // Persist to delivery log
      try {
        await db('email_delivery_log').insert({
          id: require('crypto').randomUUID(),
          account_id: request.accountId,
          sender: from,
          recipient: to,
          subject,
          body: body || '',
          status: 'delivered',
          message_id: info.messageId || null,
          created_at: new Date(),
        });
      } catch { /* best-effort */ }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: isMailhog() ? 'http://localhost:8025' : undefined,
      };
    } catch (err: any) {
      fastify.log.error(err, 'SMTP send failed');
      // Still persist as failed
      try {
        await db('email_delivery_log').insert({
          id: require('crypto').randomUUID(),
          account_id: request.accountId,
          sender: from, recipient: to, subject, body: body || '',
          status: 'failed', message_id: null, created_at: new Date(),
        });
      } catch { /* ignore */ }
      return reply.code(502).send({ error: `SMTP error: ${err.message}` });
    }
  });

  // ── GET /mail/sent ────────────────────────────────────────────────────────
  fastify.get('/mail/sent', async (request: any) => {
    const limit = Math.min(parseInt((request.query as any).limit || '50', 10), 200);
    const rows = await db('email_delivery_log')
      .where({ account_id: request.accountId })
      .orderBy('created_at', 'desc')
      .limit(limit);

    return rows.map((r: any) => ({
      id: r.id,
      from: r.sender,
      to: r.recipient,
      subject: r.subject,
      body: r.body || '',
      preview: (r.body || '').slice(0, 120),
      status: r.status,
      messageId: r.message_id,
      date: r.created_at,
      read: true,
    }));
  });

  // ── GET /mail/inbox ───────────────────────────────────────────────────────
  // For MailHog: proxy MailHog's HTTP API, filter by the user's email accounts.
  // For production (non-MailHog): returns empty — IMAP integration required.
  fastify.get('/mail/inbox', async (request: any) => {
    const { account } = request.query as { account?: string };

    if (!isMailhog()) {
      return { messages: [], note: 'Inbox requires IMAP — not supported with this SMTP relay.' };
    }

    try {
      // Fetch all messages from MailHog (up to 100)
      const res = await fetch(`${MAILHOG_API}/messages?limit=100`);
      if (!res.ok) return { messages: [] };
      const data: any = await res.json();

      // Get all email addresses belonging to this cPanel account
      const myEmails: string[] = await db('email_accounts')
        .where({ account_id: request.accountId })
        .then((rows: any[]) => rows.map((r: any) => `${r.local_part}@${r.domain}`.toLowerCase()));

      // Also include the primary domain address
      const acct = await db('accounts').where({ id: request.accountId }).first();
      if (acct?.username && acct?.primary_domain) {
        myEmails.push(`${acct.username}@${acct.primary_domain}`.toLowerCase());
      }

      const filterTo = account ? [account.toLowerCase()] : myEmails;

      const messages = (data.items || [])
        .filter((msg: any) => {
          const recipients: string[] = (msg.To || []).map(
            (t: any) => `${t.Mailbox}@${t.Domain}`.toLowerCase()
          );
          return recipients.some((r: string) => filterTo.includes(r));
        })
        .map((msg: any) => {
          const headers = msg.Content?.Headers || {};
          const fromHeader = (headers.From?.[0] || '').replace(/^.*<(.+)>$/, '$1') || `${msg.From?.Mailbox}@${msg.From?.Domain}`;
          const toHeader = (msg.To || []).map((t: any) => `${t.Mailbox}@${t.Domain}`).join(', ');
          const body = msg.Content?.Body || '';
          return {
            id: msg.ID,
            from: fromHeader,
            to: toHeader,
            subject: headers.Subject?.[0] || '(no subject)',
            body,
            preview: body.slice(0, 120),
            date: msg.Created,
            read: false,
          };
        })
        // Newest first
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { messages };
    } catch (err: any) {
      fastify.log.warn(err, 'MailHog inbox fetch failed');
      return { messages: [], error: 'Could not reach MailHog' };
    }
  });

  // ── POST /mail/test-smtp — send a test message to verify SMTP config ────────
  fastify.post('/mail/test-smtp', async (request: any, reply) => {
    const { to } = request.body as { to: string };
    if (!to) return reply.code(400).send({ error: 'to address required' });
    try {
      const info = await getTransporter().sendMail({
        from: `${process.env.SMTP_FROM_NAME || 'cPanel Mail'} <${process.env.SMTP_FROM_ADDRESS || 'noreply@localhost'}>`,
        to,
        subject: 'cPanel Clone — SMTP test',
        text: `Your SMTP configuration is working.\n\nSMTP host: ${process.env.SMTP_HOST}\nPort: ${process.env.SMTP_PORT}`,
      });
      return { success: true, messageId: info.messageId, host: process.env.SMTP_HOST, port: process.env.SMTP_PORT };
    } catch (err: any) {
      return reply.code(502).send({ error: err.message, host: process.env.SMTP_HOST, port: process.env.SMTP_PORT });
    }
  });

  // ── GET /mail/smtp-config ─────────────────────────────────────────────────
  fastify.get('/mail/smtp-config', async () => {
    const host = process.env.SMTP_HOST || 'mailhog';
    const mailhog = isMailhog();
    let provider = 'custom';
    if (mailhog) provider = 'mailhog';
    else if (host.includes('sendgrid')) provider = 'sendgrid';
    else if (host.includes('mailgun')) provider = 'mailgun';
    else if (host.includes('amazonaws')) provider = 'ses';
    else if (host.includes('gmail')) provider = 'gmail';

    return {
      host,
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      fromAddress: process.env.SMTP_FROM_ADDRESS || 'noreply@localhost',
      fromName: process.env.SMTP_FROM_NAME || 'cPanel Mail',
      isMailhog: mailhog,
      provider,
      ready: !mailhog && !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    };
  });
}
