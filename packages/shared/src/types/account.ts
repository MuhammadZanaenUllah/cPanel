export interface Account {
  id: string;
  serverId: string;
  planId: string;
  resellerId?: string;
  username: string;
  primaryDomain: string;
  email: string;
  systemUid: number;
  systemGid: number;
  homeDir: string;
  status: 'active' | 'suspended' | 'terminated' | 'provisioning';
  suspendedAt?: Date;
  suspendReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
