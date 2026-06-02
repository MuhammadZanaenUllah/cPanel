export interface MysqlDatabase {
  id: string;
  accountId: string;
  dbName: string;
  displayName: string;
  createdAt: Date;
}

export interface MysqlUser {
  id: string;
  accountId: string;
  username: string;
  createdAt: Date;
}

export interface MysqlAssignment {
  id: string;
  accountId: string;
  dbName: string;
  dbUser: string;
  privileges: string;
}
