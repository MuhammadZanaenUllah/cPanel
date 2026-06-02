export interface CronJob {
  id: string;
  accountId: string;
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
  command: string;
  enabled: boolean;
  createdAt: Date;
}
