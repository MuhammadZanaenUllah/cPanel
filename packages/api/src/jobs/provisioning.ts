import { Worker } from 'bullmq';
import { redisConnection } from './queue';
import { db } from '../db/connection';
import { sendPrivilegedCommand } from '../privileged/client';

export const provisionWorker = new Worker('provision-account', async job => {
  const { accountId, rawPassword } = job.data;
  
  const account = await db('accounts').where({ id: accountId }).first();
  if (!account) throw new Error(`Account ${accountId} not found`);

  try {
    // 1. Create system user
    await sendPrivilegedCommand('create_system_user', {
      username: account.username,
      password: rawPassword,
      homedir: account.home_dir
    });

    // 2. Add DNS zone (example)
    // await sendPrivilegedCommand('add_dns_zone', { domain: account.primary_domain, ip: process.env.SERVER_IP });

    // 3. Update DB status
    await db('accounts').where({ id: accountId }).update({ status: 'active' });
    
  } catch (err: any) {
    await db('accounts').where({ id: accountId }).update({ 
      status: 'suspended',
      suspend_reason: `Provisioning failed: ${err.message}`
    });
    throw err;
  }
}, { connection: redisConnection });

provisionWorker.on('failed', (job, err) => {
  console.error(`Provisioning job failed for account ${job?.data.accountId}:`, err);
});
