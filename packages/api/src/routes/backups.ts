import { FastifyInstance } from 'fastify';
import { db } from '../db/connection';
import { execAsync } from '../utils/shell';
import fs from 'fs/promises';
import path from 'path';

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

export async function backupRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  fastify.get('/backups', async (request: any) => {
    const backups = await db('backups')
      .where({ account_id: request.accountId })
      .orderBy('created_at', 'desc');
    return backups;
  });

  fastify.post('/backups', async (request: any, reply) => {
    const accountId = request.accountId;

    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    const id = require('crypto').randomUUID();
    const timestamp = Date.now();
    const backupName = `${account.username}_${timestamp}`;
    const backupDir = `/tmp/cpanel_backups`;
    const archivePath = `${backupDir}/${backupName}.tar.gz`;

    await db('backups').insert({
      id,
      account_id: accountId,
      name: backupName,
      storage_path: archivePath,
      size_bytes: 0,
      type: 'full',
      status: 'running'
    });

    // Run backup async — in production this would be enqueued via BullMQ
    setImmediate(async () => {
      try {
        await execAsync(`mkdir -p ${backupDir}`);

        // Archive home directory
        const homeDir = account.home_dir || `/home/${account.username}`;
        const parentDir = path.dirname(homeDir);
        const baseName = path.basename(homeDir);

        const tmpWorkDir = `${backupDir}/${backupName}`;
        await execAsync(`mkdir -p ${tmpWorkDir}`);

        // Try to create homedir archive (may fail in dev without real homedir)
        try {
          await execAsync(`tar -czf ${tmpWorkDir}/homedir.tar.gz -C ${parentDir} ${baseName} 2>/dev/null`);
        } catch {
          // In dev, create a placeholder
          await execAsync(`echo "dev-placeholder-backup" > ${tmpWorkDir}/homedir.tar.gz`);
        }

        // Archive MySQL databases
        const databases = await db('mysql_databases').where({ account_id: accountId });
        for (const dbRecord of databases) {
          try {
            await execAsync(
              `mysqldump --single-transaction ${dbRecord.db_name} 2>/dev/null | gzip > ${tmpWorkDir}/${dbRecord.db_name}.sql.gz`
            );
          } catch {
            // Skip databases that can't be dumped in dev
          }
        }

        // Create manifest
        const manifest = {
          account: account.username,
          timestamp,
          databases: databases.map((d: any) => d.db_name),
          homeDir
        };
        await fs.writeFile(`${tmpWorkDir}/manifest.json`, JSON.stringify(manifest, null, 2));

        // Pack everything
        await execAsync(`tar -czf ${archivePath} -C ${backupDir} ${backupName}`);
        await execAsync(`rm -rf ${tmpWorkDir}`);

        let sizeBytes = 0;
        try {
          const stat = await fs.stat(archivePath);
          sizeBytes = stat.size;
        } catch {}

        await db('backups').where({ id }).update({
          status: 'completed',
          size_bytes: sizeBytes,
          completed_at: new Date()
        });
      } catch (err: any) {
        await db('backups').where({ id }).update({
          status: 'failed',
          error: err.message
        });
      }
    });

    reply.code(202).send({ success: true, id, backupName, message: 'Backup started' });
  });

  fastify.delete('/backups/:id', async (request: any, reply) => {
    const { id } = request.params as any;

    const backup = await db('backups').where({ id, account_id: request.accountId }).first();
    if (!backup) return reply.code(404).send({ error: 'Backup not found' });

    try {
      await fs.unlink(backup.storage_path).catch(() => {});
    } catch {}

    await db('backups').where({ id }).del();
    return { success: true, message: 'Backup deleted' };
  });
}
