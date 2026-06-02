export interface EmailAccount {
  id: string;
  accountId: string;
  localPart: string;
  domain: string;
  passwordHash: string;
  quotaMb: number;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface EmailForwarder {
  id: string;
  accountId: string;
  source: string;
  destination: string;
  status: 'active' | 'disabled';
  createdAt: Date;
}
