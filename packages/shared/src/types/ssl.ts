export interface SslCertificate {
  id: string;
  accountId: string;
  domain: string;
  issuer: 'letsencrypt' | 'custom' | 'self-signed';
  certPath: string;
  keyPath: string;
  chainPath?: string;
  expiresAt: Date;
  autoRenew: boolean;
  createdAt: Date;
}
