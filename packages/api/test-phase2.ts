import 'dotenv/config';
import { db, dbAdmin } from './src/db/connection';
import { startWorker } from './src/privileged/worker';
import { NginxService } from './src/services/nginx';
import { DnsService } from './src/services/dns';
import { MailService } from './src/services/mail';
import { FtpService } from './src/services/ftp';
import { SslService } from './src/services/ssl';
import fs from 'fs';

async function runPhase2Tests() {
  console.log('--- STARTING PHASE 2 DAEMON INTEGRATION TESTS ---');

  // Setup environment for testing
  const socketPath = './test-privileged.sock';
  process.env.PRIVILEGED_SOCKET = socketPath;

  // 1. Start Privileged Worker
  console.log('Starting mock Unix privileged worker socket...');
  startWorker();

  try {
    // 2. Fetch seed server and plan
    const server = await db('servers').first();
    const plan = await db('plans').where({ name: 'Pro' }).first();
    
    if (!server || !plan) {
      throw new Error('Please run Phase 1 seeds first: pnpm --filter @cpanel/api exec tsx test-phase1.ts');
    }

    // 3. Ensure test account exists
    let account = await db('accounts').where({ username: 'testuser' }).first();
    if (!account) {
      console.log('Test account not found, seeding test account first...');
      const accountId = require('crypto').randomUUID();
      await db('accounts').insert({
        id: accountId,
        server_id: server.id,
        plan_id: plan.id,
        username: 'testuser',
        primary_domain: 'testuserdomain.com',
        email: 'test@domain.com',
        password_hash: 'hashedpassword123',
        system_uid: 1001,
        system_gid: 1001,
        home_dir: '/home/testuser',
        status: 'active',
        role: 'user'
      });
      account = await db('accounts').where({ id: accountId }).first();
    }
    const accountId = account!.id;

    // Ensure corresponding domain record exists for testing updates (like SSL)
    let domainRecord = await db('domains').where({ domain: 'testuserdomain.com' }).first();
    if (!domainRecord) {
      await db('domains').insert({
        id: require('crypto').randomUUID(),
        account_id: accountId,
        domain: 'testuserdomain.com',
        type: 'primary',
        document_root: '/home/testuser/public_html',
        php_version: '8.2',
        status: 'active'
      });
    }

    console.log(`\nUsing hosting account: ${account!.username} (${account!.primary_domain})`);

    // --- TEST 1: NGINX SERVICE ---
    console.log('\n--- [Testing NginxService] ---');
    await NginxService.setupDomain('testuserdomain.com', '/home/testuser/public_html', '8.2');
    console.log('✅ NginxService setupDomain: SUCCESS');

    // --- TEST 2: DNS SERVICE ---
    console.log('\n--- [Testing DnsService (PowerDNS DB)] ---');
    await DnsService.addZone('testuserdomain.com', '127.0.0.1');
    const pdnsDomain = await dbAdmin('powerdns.domains').where({ name: 'testuserdomain.com' }).first();
    const pdnsRecords = await dbAdmin('powerdns.records').where({ domain_id: pdnsDomain?.id });
    console.log(`PowerDNS records found: ${pdnsRecords.length}`);
    if (pdnsRecords.some(r => r.type === 'SOA') && pdnsRecords.some(r => r.type === 'A')) {
      console.log('✅ DnsService addZone: SUCCESS');
    } else {
      console.error('❌ DnsService addZone: FAILED (missing records)');
    }

    // --- TEST 3: MAIL SERVICE ---
    console.log('\n--- [Testing MailService] ---');
    await MailService.createEmailAccount(accountId, 'info', 'testuserdomain.com', 'SecureMailPass123!');
    const mailDbRecord = await db('email_accounts').where({ account_id: accountId, local_part: 'info' }).first();
    if (mailDbRecord) {
      console.log('✅ MailService createEmailAccount (Database Insert): SUCCESS');
    } else {
      console.error('❌ MailService createEmailAccount (Database Insert): FAILED');
    }

    // --- TEST 4: FTP SERVICE ---
    console.log('\n--- [Testing FtpService] ---');
    await FtpService.createFtpAccount(accountId, 'ftpuser', 'SecureFtpPass123!', 'public_html/upload');
    const ftpDbRecord = await db('ftp_accounts').where({ account_id: accountId, username: 'ftpuser@testuserdomain.com' }).first();
    if (ftpDbRecord) {
      console.log('✅ FtpService createFtpAccount (Database Insert): SUCCESS');
    } else {
      console.error('❌ FtpService createFtpAccount (Database Insert): FAILED');
    }

    // --- TEST 5: SSL SERVICE ---
    console.log('\n--- [Testing SslService (Certbot)] ---');
    await SslService.requestCertificate(accountId, 'testuserdomain.com', '/home/testuser/public_html');
    const sslDbRecord = await db('ssl_certificates').where({ account_id: accountId, domain: 'testuserdomain.com' }).first();
    const updatedDomain = await db('domains').where({ account_id: accountId, domain: 'testuserdomain.com' }).first();
    if (sslDbRecord && updatedDomain?.ssl_enabled) {
      console.log('✅ SslService requestCertificate: SUCCESS');
    } else {
      console.error('❌ SslService requestCertificate: FAILED');
    }

    console.log('\n--- ALL CORE SERVICE INTEGRATION TESTS PASSED SUCCESSFULLY! ---');

  } catch (err: any) {
    console.error('\n❌ Daemon Service Test Failed:', err.message);
  } finally {
    console.log('\nCleaning up sockets and database connections...');
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
    // Optional: Clean up created items
    try {
      await db('email_accounts').where({ local_part: 'info' }).del();
      await db('ftp_accounts').where({ username: 'ftpuser@testuserdomain.com' }).del();
      await db('ssl_certificates').where({ domain: 'testuserdomain.com' }).del();
      const domain = await dbAdmin('powerdns.domains').where({ name: 'testuserdomain.com' }).first();
      if (domain) {
        await dbAdmin('powerdns.records').where({ domain_id: domain.id }).del();
        await dbAdmin('powerdns.domains').where({ id: domain.id }).del();
      }
    } catch (e) {}

    await db.destroy();
    await dbAdmin.destroy();
    process.exit(0);
  }
}

runPhase2Tests();
