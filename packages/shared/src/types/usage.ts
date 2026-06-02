export interface UsageSummary {
  diskUsedMb: number;
  diskQuotaMb: number;
  bandwidthUsedMb: number;
  bandwidthQuotaMb: number;
  emailAccountsUsed: number;
  emailAccountsQuota: number;
  databasesUsed: number;
  databasesQuota: number;
  ftpAccountsUsed: number;
  ftpAccountsQuota: number;
  subdomainsUsed: number;
  subdomainsQuota: number;
  addonDomainsUsed: number;
  addonDomainsQuota: number;
  cronJobsUsed: number;
  cronJobsQuota: number;
}
