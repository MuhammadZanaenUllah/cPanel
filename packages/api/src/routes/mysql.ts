import { FastifyInstance } from 'fastify';
import { db, dbAdmin } from '../db/connection';

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

export async function mysqlRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. Create MySQL Database
  fastify.post('/mysql/databases', async (request: any, reply) => {
    const { name } = request.body; // e.g., "blog"
    const accountId = request.accountId;

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    // Enforce cPanel prefix formatting: username_dbname
    const fullDbName = `${account.username}_${name}`;

    try {
      // 1. Create database dynamically using high-privilege admin pool
      await dbAdmin.raw(`CREATE DATABASE ??`, [fullDbName]);

      // 2. Insert metadata record in cpanel DB
      const dbId = require('crypto').randomUUID();
      await db('mysql_databases').insert({
        id: dbId,
        account_id: accountId,
        db_name: fullDbName,
        display_name: name
      });

      reply.code(201).send({ success: true, dbId, dbName: fullDbName });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 2. List Databases
  fastify.get('/mysql/databases', async (request: any) => {
    const databases = await db('mysql_databases').where({ account_id: request.accountId });
    return databases;
  });

  // 3. Create MySQL User
  fastify.post('/mysql/users', async (request: any, reply) => {
    const { username, password } = request.body;
    const accountId = request.accountId;

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    const fullUsername = `${account.username}_${username}`;

    try {
      // 1. Create MySQL user dynamically using high-privilege admin pool
      await dbAdmin.raw(`CREATE USER ?@'%' IDENTIFIED BY ?`, [fullUsername, password]);

      // 2. Insert metadata record in cpanel DB
      const userId = require('crypto').randomUUID();
      await db('mysql_users').insert({
        id: userId,
        account_id: accountId,
        username: fullUsername
      });

      reply.code(201).send({ success: true, userId, username: fullUsername });
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 3b. List MySQL Users
  fastify.get('/mysql/users', async (request: any) => {
    const users = await db('mysql_users').where({ account_id: request.accountId });
    return users;
  });

  // 3c. Delete MySQL Database
  fastify.delete('/mysql/databases/:dbName', async (request: any, reply) => {
    const { dbName } = request.params as any;
    const accountId = request.accountId;

    const database = await db('mysql_databases').where({ account_id: accountId, db_name: dbName }).first();
    if (!database) return reply.code(403).send({ error: 'Database not found or unauthorized' });

    try {
      await dbAdmin.raw(`DROP DATABASE IF EXISTS ??`, [dbName]);
      await db('mysql_assignments').where({ db_name: dbName }).del();
      await db('mysql_databases').where({ id: database.id }).del();
      return { success: true, message: `Database ${dbName} dropped` };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // 4. Assign Privileges
  fastify.post('/mysql/assign', async (request: any, reply) => {
    const { dbName, dbUser, privileges } = request.body;
    const accountId = request.accountId;

    // Validate ownership
    const database = await db('mysql_databases').where({ account_id: accountId, db_name: dbName }).first();
    const user = await db('mysql_users').where({ account_id: accountId, username: dbUser }).first();

    if (!database || !user) {
      return reply.code(403).send({ error: 'Unauthorized or missing database/user mapping' });
    }

    try {
      // Grant permissions securely using high-privilege connection
      // NOTE: ?? placeholder resolves schema names dynamically preventing SQL injections
      await dbAdmin.raw(`GRANT ALL PRIVILEGES ON ??.* TO ?@'%'`, [dbName, dbUser]);
      await dbAdmin.raw('FLUSH PRIVILEGES');

      // Record assignment in DB
      await db('mysql_assignments').insert({
        id: require('crypto').randomUUID(),
        account_id: accountId,
        db_name: dbName,
        db_user: dbUser,
        privileges: privileges || 'ALL PRIVILEGES'
      });

      return { success: true, message: `Privileges granted successfully to ${dbUser} on ${dbName}` };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
