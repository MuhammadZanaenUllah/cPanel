export interface Domain {
  id: string;
  accountId: string;
  domain: string;
  type: 'primary' | 'addon' | 'parked' | 'subdomain' | 'redirect';
  documentRoot: string;
  redirectUrl?: string;
  redirectType?: '301' | '302';
  sslEnabled: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslExpiresAt?: Date;
  phpVersion: string;
  status: 'active' | 'suspended';
  createdAt: Date;
}
