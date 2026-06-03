import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebSocket from '@fastify/websocket';
import bcrypt from 'bcryptjs';
import { db } from './src/db/connection';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  // Plugins
  await app.register(fastifyWebSocket);
  await app.register(fastifyCors, {
    origin: true // Adjust in production
  });

  if (process.env.JWT_SECRET && process.env.JWT_PUBLIC_KEY && process.env.JWT_SECRET.includes('BEGIN PRIVATE KEY')) {
    await app.register(fastifyJwt, {
      secret: {
        private: process.env.JWT_SECRET,
        public: process.env.JWT_PUBLIC_KEY
      },
      sign: { algorithm: 'RS256' }
    });
  } else {
    await app.register(fastifyJwt, {
      secret: process.env.JWT_SECRET || 'supersecret'
    });
  }

  await app.register(require('./src/plugins/auth').authPlugin);

  // Register routes
  await app.register(require('./src/routes/whm').whmRoutes, { prefix: '/whm' });
  await app.register(require('./src/routes/terminal_ws').terminalWsRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/domains').domainRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/dns').dnsRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/mail').mailRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/ftp').ftpRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/mysql').mysqlRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/ssl').sslRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/files').filesRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/metrics').metricsRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/cron').cronRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/backups').backupRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/email_extras').emailExtrasRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/calendar_contacts').calendarContactsRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/smtp').smtpRoutes, { prefix: '/cpanel' });
  await app.register(require('./src/routes/wordpress').wordpressRoutes, { prefix: '/cpanel' });

  // ── Sync all cPanel email accounts → mail server (admin only) ──────────────
  // Real cPanel does this via scripts run during account creation/restore.
  app.post('/admin/mail/sync', async (request: any, reply) => {
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
    if (request.user.role !== 'admin') return reply.code(403).send({ error: 'Admin only' });

    const { MailServerService } = require('./src/services/mailserver');
    const accounts = await db('email_accounts').select('local_part', 'domain');
    const emailList = accounts.map((a: any) => ({ email: `${a.local_part}@${a.domain}` }));
    const result = await MailServerService.syncAccounts(emailList);
    return result;
  });

  // ── Webmail auto-login token — returns URL to open RoundCube ───────────────
  // Real cPanel generates a session token and passes it to RoundCube for
  // auto-login when you click "Check Email". We return the direct login URL.
  app.get('/cpanel/mail/webmail-url', async (request: any, reply) => {
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
    const { email } = request.query as { email?: string };
    // RoundCube URL with _user pre-filled (user still needs to enter password)
    const base = process.env.WEBMAIL_URL || 'http://localhost:2096';
    const url = email ? `${base}/?_user=${encodeURIComponent(email)}` : base;
    return { url };
  });

  // Account info: real server IP (from servers table) + client's current IP
  app.get('/cpanel/account/info', async (request: any, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const accountId = request.user.role !== 'admin'
      ? request.user.id
      : (request.query.accountId || request.user.id);

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    const server = await db('servers').where({ id: account.server_id }).first();
    const serverIp = server?.ip_address || request.hostname || '127.0.0.1';

    // Record last login IP and timestamp
    const clientIp = request.headers['x-forwarded-for']?.split(',')[0].trim()
      || request.ip
      || '0.0.0.0';

    await db('accounts').where({ id: accountId }).update({
      last_login_ip: clientIp,
      last_login_at: new Date()
    }).catch(() => {
      // Columns may not exist yet in older migrations — silently skip
    });

    return { serverIp, lastLoginIp: clientIp };
  });

  // WHM Login — admin only
  app.post('/whm/login', async (request: any, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' });
    }
    const account = await db('accounts').where({ username }).first();
    if (!account || account.role !== 'admin') {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const token = app.jwt.sign(
      { id: account.id, role: account.role, username: account.username },
      { expiresIn: '8h' }
    );
    return { token, username: account.username, role: account.role };
  });

  // cPanel Login — any user role (user / reseller / admin)
  app.post('/cpanel/login', async (request: any, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' });
    }
    const account = await db('accounts')
      .where(function () { this.where({ username }).orWhere({ email: username }); })
      .first();
    if (!account) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const token = app.jwt.sign(
      { id: account.id, role: account.role, username: account.username },
      { expiresIn: '8h' }
    );
    return { token, username: account.username, role: account.role };
  });

  // Dev Token helper route to seamlessly authenticate frontend in local dev
  app.get('/dev-token', async () => {
    const user = await db('accounts').where({ username: 'testuser' }).first() || 
                 await db('accounts').first();
    if (!user) {
      return { error: 'No user accounts found in database. Please run migrations & seeds first.' };
    }
    const token = app.jwt.sign({ id: user.id, role: user.role, username: user.username });
    return { token, username: user.username };
  });

  // Ensure the new tables exist
  try {
    const hasRouting = await db.schema.hasTable('email_routing');
    if (!hasRouting) {
      await db.schema.createTable('email_routing', (table) => {
        table.uuid('id').primary();
        table.uuid('account_id').notNullable();
        table.string('domain', 255).notNullable().unique();
        table.string('routing_type', 50).notNullable().defaultTo('local');
        table.timestamps(true, true);
      });
    }

    const hasAutoresponders = await db.schema.hasTable('email_autoresponders');
    if (!hasAutoresponders) {
      await db.schema.createTable('email_autoresponders', (table) => {
        table.uuid('id').primary();
        table.uuid('account_id').notNullable();
        table.string('email', 255).notNullable();
        table.string('from_name', 255).notNullable();
        table.string('subject', 255).notNullable();
        table.text('body').notNullable();
        table.integer('interval_hours').notNullable().defaultTo(1);
        table.string('status', 50).defaultTo('active');
        table.timestamps(true, true);
        table.unique(['account_id', 'email']);
      });
    }
  } catch (err) {
    app.log.error(err, 'Error creating dynamic schemas');
  }

  return app;
}
