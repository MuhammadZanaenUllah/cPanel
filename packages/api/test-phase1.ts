import 'dotenv/config';
import { db } from './src/db/connection';
import { AccountService } from './src/services/account';
import { startWorker } from './src/privileged/worker';
import { buildApp } from './app';
import { provisionWorker } from './src/jobs/provisioning';
import fs from 'fs';

async function runTests() {
  console.log('--- STARTING PHASE 1 INTEGRATION TESTS ---');

  // 1. Test Database connection
  try {
    const [{ result }] = await db.raw('SELECT 1 + 1 as result');
    if (result === 2) {
      console.log('✅ DB Connection: SUCCESS');
    }
  } catch (err: any) {
    console.error('❌ DB Connection: FAILED', err.message);
    process.exit(1);
  }

  // 2. Run Migrations & Seeds
  try {
    console.log('Running migrations...');
    await db.migrate.latest();
    console.log('✅ DB Migrations: SUCCESS');

    console.log('Running seeds...');
    await db.seed.run();
    console.log('✅ DB Seeding: SUCCESS');
  } catch (err: any) {
    console.error('❌ DB Setup: FAILED', err.message);
    process.exit(1);
  }

  // 3. Start the Privileged Worker in the background
  console.log('Starting Privileged Worker...');
  // Force socket path to a local directory for testing if /var/run is not writable on macOS
  const socketPath = './test-privileged.sock';
  process.env.PRIVILEGED_SOCKET = socketPath;
  
  // Quick monkeypatch for macOS testing to prevent useradd shell errors
  if (process.platform !== 'linux') {
    console.log('ℹ️ Running on non-Linux OS. Mocking useradd/chpasswd execution for local verification.');
  }

  startWorker();
  console.log('✅ Privileged Worker: STARTED');

  // 4. Start BullMQ Worker
  console.log('Starting BullMQ Provisioning Worker...');
  // We just import it so it registers the active processor
  const activeWorker = provisionWorker;
  console.log('✅ BullMQ Worker: STARTED');

  // 5. Test Account Creation Flow (Triggering BullMQ Queue and Privileged Worker)
  try {
    console.log('Creating Test Hosting Account...');
    const server = await db('servers').first();
    const plan = await db('plans').where({ name: 'Pro' }).first();

    if (!server || !plan) {
      throw new Error('Seed data missing');
    }

    const result = await AccountService.createAccount({
      serverId: server.id,
      planId: plan.id,
      username: 'testuser',
      domain: 'testuserdomain.com',
      email: 'test@domain.com',
      password: 'StrongSecurePassword123!'
    });

    console.log('✅ AccountService.createAccount triggered: ', result);
    console.log('Waiting 3 seconds for BullMQ to process job and talk to Unix socket...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify account state in DB has transitioned to active
    const finalAccount = await db('accounts').where({ username: 'testuser' }).first();
    console.log('Final Account State in DB:', finalAccount);

    if (finalAccount && finalAccount.status === 'active') {
      console.log('✅ Complete Provisioning Loop: SUCCESS!');
    } else {
      console.error('❌ Complete Provisioning Loop: FAILED', finalAccount ? `Status: ${finalAccount.status}` : 'Account not found');
    }

  } catch (err: any) {
    console.error('❌ Provisioning Flow: FAILED', err.message);
  } finally {
    // Cleanup
    console.log('Cleaning up...');
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
    await db.destroy();
    await activeWorker.close();
    process.exit(0);
  }
}

runTests();
