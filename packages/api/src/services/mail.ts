import { db } from '../db/connection';
import bcrypt from 'bcryptjs';
import { sendPrivilegedCommand } from '../privileged/client';

export class MailService {
  static async createEmailAccount(accountId: string, localPart: string, domain: string, rawPassword: string, quotaMb = 1024) {
    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) throw new Error('Hosting account not found');

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 1. Create DB record for Postfix/Dovecot queries
    await db('email_accounts').insert({
      id: require('crypto').randomUUID(),
      account_id: accountId,
      local_part: localPart,
      domain,
      password_hash: passwordHash,
      quota_mb: quotaMb,
      status: 'active'
    });

    // 2. Provision directory structure via Privileged Worker
    await sendPrivilegedCommand('create_maildir', {
      username: account.username,
      domain,
      localPart,
      uid: account.system_uid,
      gid: account.system_gid
    });
  }

  static async deleteEmailAccount(accountId: string, localPart: string, domain: string) {
    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) throw new Error('Hosting account not found');

    // 1. Delete directory via Privileged Worker
    await sendPrivilegedCommand('delete_maildir', {
      username: account.username,
      domain,
      localPart
    });

    // 2. Delete DB record
    await db('email_accounts').where({
      account_id: accountId,
      local_part: localPart,
      domain
    }).del();
  }

  static async createForwarder(accountId: string, source: string, destination: string) {
    await db('email_forwarders').insert({
      id: require('crypto').randomUUID(),
      account_id: accountId,
      source,
      destination,
      status: 'active'
    });
  }

  static async deleteForwarder(accountId: string, source: string, destination: string) {
    await db('email_forwarders').where({
      account_id: accountId,
      source,
      destination
    }).del();
  }
}
