import { db } from '../db/connection';
import bcrypt from 'bcryptjs';
import { sendPrivilegedCommand } from '../privileged/client';

export class FtpService {
  static async createFtpAccount(accountId: string, ftpUsername: string, rawPassword: string, relativeHomedir = 'public_html', quotaMb = 0) {
    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) throw new Error('Hosting account not found');

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const fullFtpUsername = `${ftpUsername}@${account.primary_domain}`;
    const virtualHomedir = `/home/${account.username}/${relativeHomedir}`;

    // 1. Create FTP directory via Privileged Worker (with ResolveSafe protection)
    await sendPrivilegedCommand('create_ftp_dir', {
      username: account.username,
      homedir: relativeHomedir,
      uid: account.system_uid,
      gid: account.system_gid
    });

    // 2. Create DB record for ProFTPd SQL Auth
    await db('ftp_accounts').insert({
      id: require('crypto').randomUUID(),
      account_id: accountId,
      username: fullFtpUsername,
      password_hash: passwordHash,
      homedir: virtualHomedir,
      quota_mb: quotaMb,
      uid: account.system_uid,
      gid: account.system_gid,
      status: 'active'
    });
  }

  static async deleteFtpAccount(accountId: string, ftpUsername: string) {
    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) throw new Error('Hosting account not found');

    const fullFtpUsername = `${ftpUsername}@${account.primary_domain}`;

    await db('ftp_accounts').where({
      account_id: accountId,
      username: fullFtpUsername
    }).del();
  }
}
