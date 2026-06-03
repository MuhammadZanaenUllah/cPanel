import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create wordpress_installations table
  await knex.schema.createTable('wordpress_installations', (table) => {
    table.uuid('id').primary();
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('domain').notNullable();
    table.string('path').notNullable();
    table.string('site_title').notNullable();
    table.string('admin_user').notNullable();
    table.string('db_name').notNullable();
    table.string('version').defaultTo('6.4.2');
    table.string('status').defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('wordpress_installations');
}
