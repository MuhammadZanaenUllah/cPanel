export interface DnsRecord {
  id?: string;
  accountId?: string;
  domain?: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA' | 'PTR';
  content: string;
  ttl: number;
  priority?: number;
  createdAt?: Date;
}
