import { db } from '../db/connection';
import { provisionQueue } from '../jobs/queue';
import { generatePassword, isValidUsername, isValidDomain } from '@cpanel/shared';
import bcrypt from 'bcryptjs';

export class AccountService {
  static async createAccount(data: {
    serverId: string;
    planId: string;
    username: string;
    domain: string;
    email: string;
    resellerId?: string;
    password?: string;
  }) {
    if (!isValidUsername(data.username)) {
      throw new Error('Invalid username format');
    }
    if (!isValidDomain(data.domain)) {
      throw new Error('Invalid domain format');
    }

    const plan = await db('plans').where({ id: data.planId }).first();
    if (!plan) throw new Error('Plan not found');

    // Resolve 'auto' or any non-UUID server id to the first available server
    let resolvedServerId = data.serverId;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(resolvedServerId)) {
      const server = await db('servers').first();
      if (!server) throw new Error('No servers configured');
      resolvedServerId = server.id;
    }

    // Find next UID/GID starting from 1000
    const lastAccount = await db('accounts').orderBy('system_uid', 'desc').first();
    const systemUid = lastAccount ? lastAccount.system_uid + 1 : 1000;
    const systemGid = systemUid; // One group per user
    
    const homeDir = `/home/${data.username}`;
    const rawPassword = data.password || generatePassword(16);
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const accountId = require('crypto').randomUUID();

    await db('accounts').insert({
      id: accountId,
      server_id: resolvedServerId,
      plan_id: data.planId,
      reseller_id: data.resellerId || null,
      username: data.username,
      primary_domain: data.domain,
      email: data.email,
      password_hash: passwordHash,
      system_uid: systemUid,
      system_gid: systemGid,
      home_dir: homeDir,
      status: 'provisioning',
      role: 'user'
    });

    // Add to provisioning queue
    await provisionQueue.add('provision', {
      accountId: accountId,
      rawPassword: rawPassword
    });

    return {
      accountId,
      username: data.username,
      rawPassword, // Only returned once
      status: 'provisioning'
    };
  }
}
