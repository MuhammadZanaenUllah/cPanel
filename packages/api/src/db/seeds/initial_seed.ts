import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  // Skip seeding if data already exists — prevents UUID churn on restarts
  const existingServer = await knex('servers').first();
  if (existingServer) return;

  const serverId = randomUUID();
  const planIds = [randomUUID(), randomUUID(), randomUUID()];

  // 1. Seed Server
  await knex('servers').insert({
    id: serverId,
    hostname: 'server1.cpanelclone.local',
    ip_address: '127.0.0.1'
  });

  // 2. Seed Plans
  const plans = [
    {
      id: planIds[0],
      name: 'Basic',
      disk_mb: 5000,
      bandwidth_mb: 50000,
      max_email_accounts: 10,
      max_databases: 5,
      max_ftp_accounts: 5,
      max_subdomains: 10,
      max_addon_domains: 0,
      max_cron_jobs: 2,
      price_monthly: 5.00
    },
    {
      id: planIds[1],
      name: 'Pro',
      disk_mb: 20000,
      bandwidth_mb: 200000,
      max_email_accounts: 50,
      max_databases: 20,
      max_ftp_accounts: 20,
      max_subdomains: 50,
      max_addon_domains: 5,
      max_cron_jobs: 10,
      price_monthly: 15.00
    },
    {
      id: planIds[2],
      name: 'Unlimited',
      disk_mb: 100000,
      bandwidth_mb: 1000000,
      max_email_accounts: 9999,
      max_databases: 9999,
      max_ftp_accounts: 9999,
      max_subdomains: 9999,
      max_addon_domains: 9999,
      max_cron_jobs: 9999,
      price_monthly: 35.00
    }
  ];

  await knex('plans').insert(plans);

  // 3. Seed Root Admin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  await knex('accounts').insert({
    server_id: serverId,
    plan_id: planIds[0],
    username: 'rootadmin',
    primary_domain: 'admin.cpanelclone.local',
    email: 'admin@cpanelclone.local',
    password_hash: passwordHash,
    role: 'admin',
    system_uid: 0, // Root doesn't map to a standard provisioned hosting account
    system_gid: 0,
    home_dir: '/root',
    status: 'active'
  });
}
