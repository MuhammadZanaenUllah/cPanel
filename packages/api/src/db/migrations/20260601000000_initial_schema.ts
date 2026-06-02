import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Servers table
  await knex.schema.createTable('servers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('hostname', 255).notNullable().unique();
    table.string('ip_address', 45).notNullable();
    table.timestamps(true, true);
  });

  // Accounts table
  await knex.schema.createTable('accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('server_id').notNullable().references('id').inTable('servers');
    table.uuid('plan_id').notNullable();
    table.uuid('reseller_id').nullable();
    table.string('username', 32).notNullable().unique();
    table.string('primary_domain', 255).notNullable().unique();
    table.string('email', 255).notNullable();
    table.string('password_hash', 255).notNullable();
    table.enum('role', ['admin', 'reseller', 'user']).defaultTo('user');
    table.integer('system_uid').unsigned().notNullable().unique();
    table.integer('system_gid').unsigned().notNullable().unique();
    table.string('home_dir', 255).notNullable();
    table.enum('status', ['active', 'suspended', 'terminated', 'provisioning']).defaultTo('provisioning');
    table.timestamp('suspended_at').nullable();
    table.string('suspend_reason', 255).nullable();
    table.timestamps(true, true);
  });

  // Plans table
  await knex.schema.createTable('plans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 255).notNullable();
    table.integer('disk_mb').unsigned().notNullable();
    table.integer('bandwidth_mb').unsigned().notNullable();
    table.integer('max_email_accounts').notNullable();
    table.integer('max_databases').notNullable();
    table.integer('max_ftp_accounts').notNullable();
    table.integer('max_subdomains').notNullable();
    table.integer('max_addon_domains').notNullable();
    table.integer('max_cron_jobs').notNullable();
    table.string('php_versions', 255).notNullable().defaultTo('8.1,8.2,8.3');
    table.decimal('price_monthly', 10, 2).nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // Domains table
  await knex.schema.createTable('domains', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('domain', 255).notNullable().unique();
    table.enum('type', ['primary', 'addon', 'parked', 'subdomain', 'redirect']).notNullable();
    table.string('document_root', 255).notNullable();
    table.string('redirect_url', 255).nullable();
    table.enum('redirect_type', ['301', '302']).nullable();
    table.boolean('ssl_enabled').defaultTo(false);
    table.string('ssl_cert_path', 255).nullable();
    table.string('ssl_key_path', 255).nullable();
    table.timestamp('ssl_expires_at').nullable();
    table.string('php_version', 10).notNullable();
    table.enum('status', ['active', 'suspended']).defaultTo('active');
    table.timestamps(true, true);
  });

  // DNS Records table
  await knex.schema.createTable('dns_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('domain', 255).notNullable().index();
    table.string('name', 255).notNullable();
    table.enum('type', ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']).notNullable();
    table.text('content').notNullable();
    table.integer('ttl').notNullable().defaultTo(14400);
    table.integer('priority').nullable();
    table.timestamps(true, true);
  });

  // Email Accounts table
  await knex.schema.createTable('email_accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('local_part', 128).notNullable();
    table.string('domain', 255).notNullable();
    table.string('password_hash', 255).notNullable();
    table.integer('quota_mb').notNullable().defaultTo(1024);
    table.enum('status', ['active', 'suspended']).defaultTo('active');
    table.timestamps(true, true);
    table.unique(['local_part', 'domain']);
  });

  // Email Forwarders table
  await knex.schema.createTable('email_forwarders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('source', 255).notNullable();
    table.string('destination', 255).notNullable();
    table.enum('status', ['active', 'disabled']).defaultTo('active');
    table.timestamps(true, true);
  });

  // MySQL Databases table
  await knex.schema.createTable('mysql_databases', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('db_name', 64).notNullable().unique();
    table.string('display_name', 64).notNullable();
    table.timestamps(true, true);
  });

  // MySQL Users table
  await knex.schema.createTable('mysql_users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('username', 64).notNullable().unique();
    table.timestamps(true, true);
  });

  // MySQL Assignments table
  await knex.schema.createTable('mysql_assignments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('db_name', 64).notNullable();
    table.string('db_user', 64).notNullable();
    table.string('privileges', 255).notNullable().defaultTo('ALL PRIVILEGES');
    table.unique(['db_name', 'db_user']);
  });

  // FTP Accounts table
  await knex.schema.createTable('ftp_accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('username', 128).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('homedir', 255).notNullable();
    table.integer('quota_mb').notNullable().defaultTo(0); // 0 = unlimited
    table.integer('uid').unsigned().notNullable();
    table.integer('gid').unsigned().notNullable();
    table.enum('status', ['active', 'disabled']).defaultTo('active');
    table.timestamp('last_login').nullable();
    table.timestamps(true, true);
  });

  // SSL Certificates table
  await knex.schema.createTable('ssl_certificates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('domain', 255).notNullable().unique();
    table.enum('issuer', ['letsencrypt', 'custom', 'self-signed']).notNullable();
    table.string('cert_path', 255).notNullable();
    table.string('key_path', 255).notNullable();
    table.string('chain_path', 255).nullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('auto_renew').defaultTo(true);
    table.timestamps(true, true);
  });

  // Backups table
  await knex.schema.createTable('backups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('storage_path', 512).notNullable();
    table.bigInteger('size_bytes').unsigned().defaultTo(0);
    table.enum('type', ['full', 'homedir', 'databases']).notNullable();
    table.enum('status', ['pending', 'running', 'completed', 'failed']).defaultTo('pending');
    table.text('error').nullable();
    table.timestamps(true, true);
    table.timestamp('completed_at').nullable();
  });

  // Cron Jobs table
  await knex.schema.createTable('cron_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('minute', 64).notNullable();
    table.string('hour', 64).notNullable();
    table.string('day', 64).notNullable();
    table.string('month', 64).notNullable();
    table.string('weekday', 64).notNullable();
    table.text('command').notNullable();
    table.boolean('enabled').defaultTo(true);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cron_jobs');
  await knex.schema.dropTableIfExists('backups');
  await knex.schema.dropTableIfExists('ssl_certificates');
  await knex.schema.dropTableIfExists('ftp_accounts');
  await knex.schema.dropTableIfExists('mysql_assignments');
  await knex.schema.dropTableIfExists('mysql_users');
  await knex.schema.dropTableIfExists('mysql_databases');
  await knex.schema.dropTableIfExists('email_forwarders');
  await knex.schema.dropTableIfExists('email_accounts');
  await knex.schema.dropTableIfExists('dns_records');
  await knex.schema.dropTableIfExists('domains');
  await knex.schema.dropTableIfExists('plans');
  await knex.schema.dropTableIfExists('accounts');
  await knex.schema.dropTableIfExists('servers');
}
