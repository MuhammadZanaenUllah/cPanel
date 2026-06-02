export interface Backup {
  id: string;
  accountId: string;
  name: string;
  storagePath: string;
  sizeBytes: number;
  type: 'full' | 'homedir' | 'databases';
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
