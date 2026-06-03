import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Default Addresses table
  if (!(await knex.schema.hasTable('default_addresses'))) {
    await knex.schema.createTable('default_addresses', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().index();
      table.string('domain', 255).notNullable();
      table.enum('action', ['discard', 'bounce', 'forward']).notNullable().defaultTo('discard');
      table.string('forward_to', 255).nullable();
      table.timestamps(true, true);
      table.unique(['account_id', 'domain']);
    });
  }

  // 2. Mailing Lists table
  if (!(await knex.schema.hasTable('mailing_lists'))) {
    await knex.schema.createTable('mailing_lists', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().index();
      table.string('list_name', 100).notNullable();
      table.string('domain', 255).notNullable();
      table.text('description').nullable();
      table.string('admin_email', 255).notNullable();
      table.string('password_hash', 255).notNullable();
      table.timestamps(true, true);
      table.unique(['list_name', 'domain']);
    });
  }

  // 3. Mailing List Subscribers table
  if (!(await knex.schema.hasTable('mailing_list_subscribers'))) {
    await knex.schema.createTable('mailing_list_subscribers', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('list_id').notNullable().references('id').inTable('mailing_lists').onDelete('CASCADE');
      table.string('email', 255).notNullable();
      table.datetime('subscribed_at').notNullable().defaultTo(knex.fn.now());
      table.index(['list_id']);
      table.unique(['list_id', 'email']);
    });
  }

  // 4. Email Filters table
  if (!(await knex.schema.hasTable('email_filters'))) {
    await knex.schema.createTable('email_filters', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().index();
      table.uuid('email_account_id').nullable();
      table.string('filter_name', 255).notNullable();
      table.enum('scope', ['global', 'account']).notNullable().defaultTo('global');
      table.json('rules').notNullable();
      table.string('action_type', 100).notNullable();
      table.string('action_value', 500).nullable();
      table.integer('priority').notNullable().defaultTo(0);
      table.boolean('enabled').notNullable().defaultTo(true);
      table.timestamps(true, true);
    });
  }

  // 5. Spam Filter Configs table
  if (!(await knex.schema.hasTable('spam_filter_configs'))) {
    await knex.schema.createTable('spam_filter_configs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().unique();
      table.boolean('enabled').notNullable().defaultTo(false);
      table.decimal('spam_threshold', 3, 1).notNullable().defaultTo(5.0);
      table.boolean('rewrite_subject').notNullable().defaultTo(false);
      table.text('whitelist').nullable();
      table.text('blacklist').nullable();
      table.timestamps(true, true);
    });
  }

  // 6. GPG Keys table
  if (!(await knex.schema.hasTable('gpg_keys'))) {
    await knex.schema.createTable('gpg_keys', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().index();
      table.string('key_id', 100).notNullable();
      table.string('name', 255).notNullable();
      table.string('email', 255).notNullable();
      table.text('public_key').notNullable();
      table.timestamps(true, true);
    });
  }

  // 7. BoxTrapper Configs table
  if (!(await knex.schema.hasTable('boxtrapper_configs'))) {
    await knex.schema.createTable('boxtrapper_configs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().unique();
      table.boolean('enabled').notNullable().defaultTo(false);
      table.integer('queue_days').notNullable().defaultTo(7);
      table.text('whitelist').nullable();
      table.text('blacklist').nullable();
      table.timestamps(true, true);
    });
  }

  // 8. CalDAV Configs table
  if (!(await knex.schema.hasTable('caldav_configs'))) {
    await knex.schema.createTable('caldav_configs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().unique();
      table.boolean('enabled').notNullable().defaultTo(false);
      table.timestamps(true, true);
    });
  }

  // 9. Calendars table
  if (!(await knex.schema.hasTable('calendars'))) {
    await knex.schema.createTable('calendars', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().index();
      table.string('name', 255).notNullable();
      table.string('color', 20).notNullable().defaultTo('#3b82f6');
      table.text('description').nullable();
      table.boolean('is_shared').notNullable().defaultTo(false);
      table.timestamps(true, true);
    });
  }

  // 10. Contacts table
  if (!(await knex.schema.hasTable('contacts'))) {
    await knex.schema.createTable('contacts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().index();
      table.string('first_name', 255).notNullable();
      table.string('last_name', 255).nullable();
      table.string('email', 255).nullable();
      table.string('phone', 50).nullable();
      table.string('company', 255).nullable();
      table.timestamps(true, true);
    });
  }

  // 11. Email Delivery Logs table
  if (!(await knex.schema.hasTable('email_delivery_logs'))) {
    await knex.schema.createTable('email_delivery_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
      table.uuid('account_id').notNullable().index();
      table.string('sender', 255).notNullable();
      table.string('recipient', 255).notNullable();
      table.string('subject', 500).nullable();
      table.enum('status', ['sent', 'delivered', 'bounced', 'deferred']).notNullable().defaultTo('sent');
      table.text('error_message').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_delivery_logs');
  await knex.schema.dropTableIfExists('contacts');
  await knex.schema.dropTableIfExists('calendars');
  await knex.schema.dropTableIfExists('caldav_configs');
  await knex.schema.dropTableIfExists('boxtrapper_configs');
  await knex.schema.dropTableIfExists('gpg_keys');
  await knex.schema.dropTableIfExists('spam_filter_configs');
  await knex.schema.dropTableIfExists('email_filters');
  await knex.schema.dropTableIfExists('mailing_list_subscribers');
  await knex.schema.dropTableIfExists('mailing_lists');
  await knex.schema.dropTableIfExists('default_addresses');
}
