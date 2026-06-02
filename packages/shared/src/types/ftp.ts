export interface FtpAccount {
  id: string;
  accountId: string;
  username: string;
  passwordHash: string;
  homedir: string;
  quotaMb: number;
  uid: number;
  gid: number;
  status: 'active' | 'disabled';
  lastLogin?: Date;
  createdAt: Date;
}
