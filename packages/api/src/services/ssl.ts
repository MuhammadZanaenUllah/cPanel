import { db } from '../db/connection';
import { sendPrivilegedCommand } from '../privileged/client';

export class SslService {
  static async requestCertificate(accountId: string, domain: string, documentRoot: string) {
    const account = await db('accounts').where({ id: accountId }).first();
    if (!account) throw new Error('Hosting account not found');

    const email = account.email;

    // 1. Issue Let's Encrypt Certificate via Certbot on the host
    await sendPrivilegedCommand('generate_ssl_cert', {
      domain,
      documentRoot,
      email
    });

    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiration standard

    // 2. Save SSL info in Database
    await db('ssl_certificates').insert({
      id: require('crypto').randomUUID(),
      account_id: accountId,
      domain,
      issuer: 'letsencrypt',
      cert_path: certPath,
      key_path: keyPath,
      expires_at: expiresAt,
      auto_renew: true
    });

    // 3. Mark domain as SSL enabled
    await db('domains').where({ account_id: accountId, domain }).update({
      ssl_enabled: true,
      ssl_cert_path: certPath,
      ssl_key_path: keyPath,
      ssl_expires_at: expiresAt
    });
  }

  static async revokeCertificate(accountId: string, domain: string) {
    // 1. Delete certificate via Certbot
    await sendPrivilegedCommand('delete_ssl_cert', { domain });

    // 2. Remove certificate records
    await db('ssl_certificates').where({ account_id: accountId, domain }).del();

    // 3. Disable SSL on the domain
    await db('domains').where({ account_id: accountId, domain }).update({
      ssl_enabled: false,
      ssl_cert_path: null,
      ssl_key_path: null,
      ssl_expires_at: null
    });
  }
}
