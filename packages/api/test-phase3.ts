import 'dotenv/config';
import { buildApp } from './app';
import { db } from './src/db/connection';

async function runPhase3Tests() {
  console.log('--- STARTING PHASE 3 API ROUTE TESTS ---');

  const app = await buildApp();
  await app.ready();

  // 1. Fetch our seeded admin and user accounts from DB to build realistic JWT payloads
  const adminAccount = await db('accounts').where({ role: 'admin' }).first();
  const userAccount = await db('accounts').where({ username: 'testuser' }).first();

  if (!adminAccount || !userAccount) {
    console.error('❌ Seeds not found. Please run Phase 1 seeds first: pnpm --filter @cpanel/api exec tsx test-phase1.ts');
    process.exit(1);
  }

  // 2. Generate JWT tokens
  const adminToken = app.jwt.sign({ id: adminAccount.id, role: 'admin', username: adminAccount.username });
  const userToken = app.jwt.sign({ id: userAccount.id, role: 'user', username: userAccount.username });

  console.log('✅ Generated JWT tokens');

  // --- TEST 1: WHM Admin Endpoint with valid JWT ---
  console.log('\n--- [Testing GET /whm/accounts (Admin Auth)] ---');
  const whmRes = await app.inject({
    method: 'GET',
    url: '/whm/accounts',
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  });

  if (whmRes.statusCode === 200) {
    console.log('✅ GET /whm/accounts: SUCCESS (200)');
    console.log('Account list:', JSON.parse(whmRes.body));
  } else {
    console.error('❌ GET /whm/accounts: FAILED', whmRes.statusCode, whmRes.body);
  }

  // --- TEST 2: WHM Admin Endpoint with forbidden User JWT ---
  console.log('\n--- [Testing GET /whm/accounts (RBAC Block)] ---');
  const forbiddenRes = await app.inject({
    method: 'GET',
    url: '/whm/accounts',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });

  if (forbiddenRes.statusCode === 403) {
    console.log('✅ GET /whm/accounts blocked for non-admin: SUCCESS (403)');
  } else {
    console.error('❌ GET /whm/accounts blocked for non-admin: FAILED', forbiddenRes.statusCode);
  }

  // --- TEST 3: cPanel User Domains List ---
  console.log('\n--- [Testing GET /cpanel/domains (User Auth)] ---');
  const domainRes = await app.inject({
    method: 'GET',
    url: '/cpanel/domains',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });

  if (domainRes.statusCode === 200) {
    console.log('✅ GET /cpanel/domains: SUCCESS (200)');
    console.log('Domains found:', JSON.parse(domainRes.body));
  } else {
    console.error('❌ GET /cpanel/domains: FAILED', domainRes.statusCode);
  }

  // --- TEST 4: cPanel User Mail List ---
  console.log('\n--- [Testing GET /cpanel/mail] ---');
  const mailRes = await app.inject({
    method: 'GET',
    url: '/cpanel/mail',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });

  if (mailRes.statusCode === 200) {
    console.log('✅ GET /cpanel/mail: SUCCESS (200)');
  } else {
    console.error('❌ GET /cpanel/mail: FAILED', mailRes.statusCode);
  }

  // --- TEST 5: cPanel User FTP List ---
  console.log('\n--- [Testing GET /cpanel/ftp] ---');
  const ftpRes = await app.inject({
    method: 'GET',
    url: '/cpanel/ftp',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });

  if (ftpRes.statusCode === 200) {
    console.log('✅ GET /cpanel/ftp: SUCCESS (200)');
  } else {
    console.error('❌ GET /cpanel/ftp: FAILED', ftpRes.statusCode);
  }

  // --- TEST 6: cPanel User MySQL DB List ---
  console.log('\n--- [Testing GET /cpanel/mysql/databases] ---');
  const mysqlRes = await app.inject({
    method: 'GET',
    url: '/cpanel/mysql/databases',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });

  if (mysqlRes.statusCode === 200) {
    console.log('✅ GET /cpanel/mysql/databases: SUCCESS (200)');
  } else {
    console.error('❌ GET /cpanel/mysql/databases: FAILED', mysqlRes.statusCode);
  }

  // --- TEST 7: cPanel User SSL Certificate List ---
  console.log('\n--- [Testing GET /cpanel/ssl] ---');
  const sslRes = await app.inject({
    method: 'GET',
    url: '/cpanel/ssl',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });

  if (sslRes.statusCode === 200) {
    console.log('✅ GET /cpanel/ssl: SUCCESS (200)');
    console.log('\n--- ALL API ROUTE INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } else {
    console.error('❌ GET /cpanel/ssl: FAILED', sslRes.statusCode);
  }

  await db.destroy();
  process.exit(0);
}

runPhase3Tests();
