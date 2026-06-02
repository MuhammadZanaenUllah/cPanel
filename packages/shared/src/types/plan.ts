export interface Plan {
  id: string;
  name: string;
  diskMb: number;
  bandwidthMb: number;
  maxEmailAccounts: number;
  maxDatabases: number;
  maxFtpAccounts: number;
  maxSubdomains: number;
  maxAddonDomains: number;
  maxCronJobs: number;
  phpVersions: string;
  priceMonthly: number;
  isActive: boolean;
  createdAt: Date;
}
