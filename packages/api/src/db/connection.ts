import knex from 'knex';
import config from '../../knexfile';

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

export const db = knex(dbConfig);

export const dbAdmin = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_ADMIN_HOST || '127.0.0.1',
    port: Number(process.env.DB_ADMIN_PORT) || 3306,
    user: process.env.DB_ADMIN_USER || 'cpanel_admin',
    password: process.env.DB_ADMIN_PASSWORD || 'admin_password',
    database: 'cpanel_clone'
  },
  pool: {
    min: 2,
    max: 10
  }
});
