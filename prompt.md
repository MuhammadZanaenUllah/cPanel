# cPanel Clone — Claude Code Master Prompt

> Paste everything below this line into Claude Code at the start of the project.
> Claude Code will read this once and use it as the source of truth for all decisions.

---

## MISSION

You are building a **production-grade cPanel clone** — a Linux web hosting control panel — from scratch. This is a real system that will be deployed on a live Ubuntu 22.04 server and used by real hosting customers. It must actually work: it must talk to real Linux daemons, manage real files, and provision real hosting accounts.

Do not simulate, stub, or mock system-level behaviour. Every service must perform real operations against the underlying OS and daemons.

---

## ABSOLUTE RULES (read before writing a single line)

1. **MySQL only** — the entire stack uses MySQL 8. No PostgreSQL, no SQLite, no MariaDB branding. One MySQL instance serves the app database, PowerDNS, Postfix virtual mailboxes, Dovecot, and ProFTPd.
2. **TypeScript everywhere** — all Node.js code is TypeScript (strict mode). No plain `.js` files except generated output.
3. **Never run as root** — the API server process runs as an unprivileged user. All operations that require root (useradd, quota, nginx reload, certbot) go through a dedicated `privileged-worker` process that listens on a Unix socket and accepts only a strict whitelist of signed commands.
4. **Idempotent provisioning** — every provisioning step must check if it has already been applied before executing. Re-running a provisioning job must never create duplicates.
5. **Path traversal protection on every file operation** — all filesystem operations must go through a `resolveSafe(username, userPath)` function that resolves to an absolute path and asserts it starts with `/home/{username}/`. No exceptions.
6. **Snapshot financial/config data** — prices, tax rates, and config values are stored at creation time. Never re-read live values when displaying or converting existing records.
7. **No framework magic that hides SQL** — use `mysql2/promise` directly for all database queries. No ORM for the core domain logic. Prisma is acceptable only for migrations.
8. **Monorepo** — pnpm workspaces. All packages live under `packages/`.

---

## TECH STACK (non-negotiable)

### Application

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5 (strict) |
| API framework | Fastify 4 |
| Validation | Zod |
| DB client | mysql2/promise |
| Migrations | Prisma (MySQL provider) or db-migrate |
| Job queue | BullMQ + Redis 7 |
| Auth | JWT (RS256) for admin/client; HMAC-SHA256 for privileged worker IPC |
| Frontend | React 18 + Vite 5 |
| UI components | shadcn/ui + Tailwind CSS 3 |
| Package manager | pnpm (workspaces) |

### Server Daemons (your services configure these — they are pre-installed)

| Purpose | Daemon |
|---|---|
| Web server | Nginx |
| PHP runtime | PHP-FPM 8.1, 8.2, 8.3 (per-account pools) |
| DNS | PowerDNS with MySQL backend |
| SMTP | Postfix with MySQL virtual mailboxes |
| IMAP/POP3 | Dovecot with MySQL virtual mailboxes |
| FTP | ProFTPd with MySQL virtual users |
| SSL | Certbot (Let's Encrypt) |
| Database (app + account DBs) | MySQL 8 |
| Cache / queue backend | Redis 7 |

### Ports

| Interface | Port |
|---|---|
| cPanel UI (client dashboard) | 2083 |
| WHM UI (admin/reseller dashboard) | 2087 |
| Webmail (Roundcube embed) | 2096 |
| API (internal) | 3000 |

---

## PROJECT STRUCTURE

```
cpanel-clone/
├── packages/
│   ├── api/                        # Fastify API — Node.js + TypeScript
│   │   └── src/
│   │       ├── domain/             # Business logic, entities, domain services
│   │       │   ├── accounts/
│   │       │   ├── dns/
│   │       │   ├── email/
│   │       │   ├── databases/
│   │       │   ├── files/
│   │       │   ├── ftp/
│   │       │   ├── ssl/
│   │       │   ├── backups/
│   │       │   ├── domains/
│   │       │   ├── cron/
│   │       │   └── quotas/
│   │       ├── infrastructure/     # Adapters for each daemon
│   │       │   ├── nginx/          # NginxService — vhost config writer
│   │       │   ├── powerdns/       # DnsService — PowerDNS MySQL writes
│   │       │   ├── postfix/        # EmailService (SMTP side)
│   │       │   ├── dovecot/        # EmailService (IMAP side)
│   │       │   ├── proftpd/        # FtpService
│   │       │   ├── mysql/          # DatabaseService — account DB management
│   │       │   └── certbot/        # SslService — Certbot subprocess wrapper
│   │       ├── jobs/               # BullMQ workers
│   │       │   ├── provision.job.ts
│   │       │   ├── terminate.job.ts
│   │       │   ├── backup.job.ts
│   │       │   ├── ssl-renew.job.ts
│   │       │   ├── quota-check.job.ts
│   │       │   └── bandwidth-parse.job.ts
│   │       ├── privileged/         # Unix socket worker (runs as root separately)
│   │       │   ├── worker.ts
│   │       │   └── commands/       # One file per allowed command
│   │       ├── routers/            # Fastify route handlers
│   │       │   ├── accounts.router.ts
│   │       │   ├── dns.router.ts
│   │       │   ├── email.router.ts
│   │       │   ├── databases.router.ts
│   │       │   ├── files.router.ts
│   │       │   ├── ftp.router.ts
│   │       │   ├── ssl.router.ts
│   │       │   ├── domains.router.ts
│   │       │   ├── cron.router.ts
│   │       │   ├── backups.router.ts
│   │       │   └── whm.router.ts   # WHM API compat (WHMCS integration)
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT verification
│   │       │   ├── rbac.ts         # Role-based access control
│   │       │   └── quota-check.ts  # Inline quota enforcement
│   │       ├── db/
│   │       │   ├── connection.ts   # mysql2 pool setup
│   │       │   └── migrations/     # SQL migration files
│   │       └── app.ts              # Fastify app factory
│   │
│   ├── cpanel-ui/                  # React — client hosting dashboard (port 2083)
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx   # Usage overview + module grid
│   │       │   ├── FileManager.tsx
│   │       │   ├── Email.tsx
│   │       │   ├── Databases.tsx
│   │       │   ├── Domains.tsx
│   │       │   ├── DnsEditor.tsx
│   │       │   ├── FtpAccounts.tsx
│   │       │   ├── SslManager.tsx
│   │       │   ├── CronJobs.tsx
│   │       │   └── Backups.tsx
│   │       └── components/
│   │
│   ├── whm-ui/                     # React — admin/reseller dashboard (port 2087)
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx   # Server stats + account overview
│   │       │   ├── Accounts.tsx    # Account list + create + manage
│   │       │   ├── Plans.tsx       # Hosting plan management
│   │       │   ├── Resellers.tsx
│   │       │   ├── ServerHealth.tsx
│   │       │   └── ApiKeys.tsx     # WHMCS API token management
│   │       └── components/
│   │
│   └── shared/                     # Shared TypeScript types + utilities
│       └── src/
│           ├── types/              # Shared interfaces (Account, Plan, DnsRecord, etc.)
│           └── utils/              # generatePassword, validateCronExpression, etc.
│
├── scripts/
│   ├── server-setup.sh             # Bootstrap Ubuntu 22.04 with all daemons
│   └── dev-setup.sh               # Local dev environment setup
├── nginx/
│   └── panel.conf                  # Nginx config for the panel itself
├── docker-compose.dev.yml          # Dev environment (MySQL + Redis)
├── pnpm-workspace.yaml
└── package.json
```

---

## DATABASE SCHEMA (MySQL 8)

Create these tables in order. Use `CHAR(36)` for UUIDs with `DEFAULT (UUID())`. Use `DATETIME` not `TIMESTAMP` for dates beyond 2038.

```sql
-- ── servers ──────────────────────────────────────────────
CREATE TABLE servers (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  hostname    VARCHAR(253) NOT NULL,
  ip_address  VARCHAR(45)  NOT NULL,
  os_version  VARCHAR(100),
  max_accounts INT         NOT NULL DEFAULT 500,
  status      ENUM('active','maintenance','offline') NOT NULL DEFAULT 'active',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── plans ────────────────────────────────────────────────
CREATE TABLE plans (
  id                  CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  name                VARCHAR(100) NOT NULL UNIQUE,
  disk_mb             INT          NOT NULL,
  bandwidth_mb        INT          NOT NULL DEFAULT 0,   -- 0 = unlimited
  max_email_accounts  INT          NOT NULL DEFAULT 10,
  max_databases       INT          NOT NULL DEFAULT 5,
  max_ftp_accounts    INT          NOT NULL DEFAULT 5,
  max_subdomains      INT          NOT NULL DEFAULT 10,
  max_addon_domains   INT          NOT NULL DEFAULT 5,
  max_cron_jobs       INT          NOT NULL DEFAULT 10,
  php_versions        VARCHAR(200) NOT NULL DEFAULT '8.1,8.2,8.3',
  price_monthly       DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── accounts ─────────────────────────────────────────────
CREATE TABLE accounts (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  server_id       CHAR(36)     NOT NULL,
  plan_id         CHAR(36)     NOT NULL,
  reseller_id     CHAR(36)     DEFAULT NULL,
  username        VARCHAR(32)  NOT NULL,
  primary_domain  VARCHAR(253) NOT NULL,
  email           VARCHAR(254) NOT NULL,
  password_hash   TEXT         NOT NULL,
  system_uid      INT          NOT NULL,
  system_gid      INT          NOT NULL DEFAULT 1001,
  home_dir        VARCHAR(300) AS (CONCAT('/home/', username)) STORED,
  status          ENUM('active','suspended','terminated','provisioning') NOT NULL DEFAULT 'provisioning',
  suspended_at    DATETIME     DEFAULT NULL,
  suspend_reason  TEXT         DEFAULT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_domain (primary_domain),
  UNIQUE KEY uq_uid (system_uid),
  FOREIGN KEY (server_id)   REFERENCES servers(id),
  FOREIGN KEY (plan_id)     REFERENCES plans(id),
  FOREIGN KEY (reseller_id) REFERENCES accounts(id)
);

-- ── domains ──────────────────────────────────────────────
CREATE TABLE domains (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id      CHAR(36)     NOT NULL,
  domain          VARCHAR(253) NOT NULL UNIQUE,
  type            ENUM('primary','addon','parked','subdomain','redirect') NOT NULL,
  document_root   VARCHAR(500) NOT NULL,
  redirect_url    VARCHAR(2048) DEFAULT NULL,
  redirect_type   ENUM('301','302') DEFAULT NULL,
  ssl_enabled     TINYINT(1)   NOT NULL DEFAULT 0,
  ssl_cert_path   VARCHAR(500) DEFAULT NULL,
  ssl_key_path    VARCHAR(500) DEFAULT NULL,
  ssl_expires_at  DATETIME     DEFAULT NULL,
  php_version     VARCHAR(10)  NOT NULL DEFAULT '8.2',
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_account_id (account_id)
);

-- ── email_accounts ────────────────────────────────────────
CREATE TABLE email_accounts (
  id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id    CHAR(36)     NOT NULL,
  local_part    VARCHAR(64)  NOT NULL,
  domain        VARCHAR(253) NOT NULL,
  password_hash TEXT         NOT NULL,
  quota_mb      INT          NOT NULL DEFAULT 500,
  status        ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email (local_part, domain),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── email_forwarders ──────────────────────────────────────
CREATE TABLE email_forwarders (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)     NOT NULL,
  source      VARCHAR(320) NOT NULL,
  destination VARCHAR(320) NOT NULL,
  status      ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── mysql_databases ───────────────────────────────────────
CREATE TABLE mysql_databases (
  id           CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id   CHAR(36)     NOT NULL,
  db_name      VARCHAR(64)  NOT NULL UNIQUE,   -- full prefixed name: username_dbname
  display_name VARCHAR(48)  NOT NULL,           -- user-visible short name
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── mysql_users ───────────────────────────────────────────
CREATE TABLE mysql_users (
  id          CHAR(36)    PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)    NOT NULL,
  username    VARCHAR(32) NOT NULL UNIQUE,      -- full prefixed: username_dbuser
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── mysql_assignments ─────────────────────────────────────
CREATE TABLE mysql_assignments (
  id          CHAR(36)    PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)    NOT NULL,
  db_name     VARCHAR(64) NOT NULL,
  db_user     VARCHAR(32) NOT NULL,
  privileges  TEXT        NOT NULL,             -- JSON array: ["SELECT","INSERT",...]
  UNIQUE KEY uq_assign (db_name, db_user),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── ftp_accounts ──────────────────────────────────────────
CREATE TABLE ftp_accounts (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)     NOT NULL,
  username    VARCHAR(64)  NOT NULL UNIQUE,     -- full: username_ftpuser
  password_hash TEXT       NOT NULL,
  homedir     VARCHAR(500) NOT NULL,
  quota_mb    INT          NOT NULL DEFAULT 500,
  uid         INT          NOT NULL,
  gid         INT          NOT NULL,
  status      ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login  DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── ssl_certificates ──────────────────────────────────────
CREATE TABLE ssl_certificates (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)     NOT NULL,
  domain      VARCHAR(253) NOT NULL,
  issuer      ENUM('letsencrypt','custom','self-signed') NOT NULL DEFAULT 'letsencrypt',
  cert_path   VARCHAR(500) NOT NULL,
  key_path    VARCHAR(500) NOT NULL,
  chain_path  VARCHAR(500) DEFAULT NULL,
  expires_at  DATETIME     NOT NULL,
  auto_renew  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ssl_domain (domain),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── dns_records ───────────────────────────────────────────
CREATE TABLE dns_records (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)     NOT NULL,
  domain      VARCHAR(253) NOT NULL,
  name        VARCHAR(253) NOT NULL,
  type        ENUM('A','AAAA','CNAME','MX','TXT','NS','SRV','CAA','PTR') NOT NULL,
  content     TEXT         NOT NULL,
  ttl         INT          NOT NULL DEFAULT 3600,
  priority    INT          DEFAULT NULL,        -- MX, SRV only
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_domain (domain),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── cron_jobs ─────────────────────────────────────────────
CREATE TABLE cron_jobs (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)     NOT NULL,
  minute      VARCHAR(20)  NOT NULL DEFAULT '*',
  hour        VARCHAR(20)  NOT NULL DEFAULT '*',
  day         VARCHAR(20)  NOT NULL DEFAULT '*',
  month       VARCHAR(20)  NOT NULL DEFAULT '*',
  weekday     VARCHAR(20)  NOT NULL DEFAULT '*',
  command     TEXT         NOT NULL,
  enabled     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── backups ───────────────────────────────────────────────
CREATE TABLE backups (
  id           CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id   CHAR(36)     NOT NULL,
  name         VARCHAR(200) NOT NULL,
  storage_path TEXT         NOT NULL,
  size_bytes   BIGINT       NOT NULL DEFAULT 0,
  type         ENUM('full','homedir','databases') NOT NULL DEFAULT 'full',
  status       ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
  error        TEXT         DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME     DEFAULT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_account_created (account_id, created_at)
);

-- ── bandwidth_logs ────────────────────────────────────────
CREATE TABLE bandwidth_logs (
  id          CHAR(36)    PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)    NOT NULL,
  year_month  CHAR(7)     NOT NULL,             -- 'YYYY-MM'
  bytes_used  BIGINT      NOT NULL DEFAULT 0,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_account_month (account_id, year_month),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── api_keys ──────────────────────────────────────────────
CREATE TABLE api_keys (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id  CHAR(36)     NOT NULL,
  name        VARCHAR(100) NOT NULL,
  key_hash    VARCHAR(64)  NOT NULL UNIQUE,     -- SHA-256 of the raw key
  last_used   DATETIME     DEFAULT NULL,
  expires_at  DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ── users (panel login) ───────────────────────────────────
CREATE TABLE users (
  id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  account_id    CHAR(36)     NOT NULL UNIQUE,
  role          ENUM('root','reseller','owner') NOT NULL DEFAULT 'owner',
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  last_login    DATETIME     DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
```

---

## CORE SERVICE IMPLEMENTATIONS

Implement each service exactly as described below. Do not deviate from these interfaces.

### 1. Privileged Worker (packages/api/src/privileged/worker.ts)

Runs as root. Listens on `/var/run/cpanel-privileged.sock`. Accepts JSON commands over the socket. Verifies HMAC-SHA256 signature on every command using `PRIVILEGED_WORKER_SECRET` env var. Returns JSON response.

**Allowed commands — implement exactly these, no others:**

```
create_linux_user       { username, password, uid, gid }
delete_linux_user       { username, removeHome: boolean }
set_disk_quota          { username, softMb, hardMb }
write_nginx_vhost       { filename, config }
delete_nginx_vhost      { filename }
reload_nginx            {}
run_certbot             { domain, webroot, email }
set_php_fpm_pool        { username, phpVersion, socketPath }
reload_php_fpm          { phpVersion }
write_file_as_user      { username, path, content }  -- for wp-config etc.
create_maildir          { domain, localPart }
delete_maildir          { domain, localPart }
set_ftp_user_dir        { username, homedir }
```

### 2. AccountService (packages/api/src/domain/accounts/AccountService.ts)

```typescript
interface CreateAccountParams {
  serverIp: string;
  username: string;         // must be unique, 1-32 chars, [a-z0-9_] only
  primaryDomain: string;
  email: string;
  password: string;         // plain — hashed before storage
  planId: string;
  resellerId?: string;
}

class AccountService {
  async createAccount(params: CreateAccountParams): Promise<{ jobId: string }>;
  async suspend(accountId: string, reason: string): Promise<void>;
  async unsuspend(accountId: string): Promise<void>;
  async terminate(accountId: string): Promise<void>;
  async changePlan(accountId: string, newPlanId: string): Promise<void>;
  async changePassword(accountId: string, newPassword: string): Promise<void>;
  async getUsageSummary(accountId: string): Promise<UsageSummary>;
}
```

**Provisioning job sequence (idempotent — check before each step):**

1. Create Linux user: `useradd -m -u {uid} -s /bin/false {username}`
2. Set password: `chpasswd`
3. Create directory structure: `public_html/`, `logs/`, `tmp/`
4. Set disk quota via privileged worker
5. Write PHP-FPM pool config for default PHP version
6. Write Nginx vhost config
7. Reload Nginx
8. Create PowerDNS zone with default records (A, www A, mail A, MX, SPF TXT)
9. Insert `accounts` row with `status='active'`
10. Emit `account.provisioned` event

**Suspension sequence:**

1. Write suspended Nginx vhost (points to `/var/www/html/suspended.html`)
2. Lock Linux user: `usermod -L {username}`
3. Set all email accounts for this account to `status='suspended'` in DB
4. Update `accounts.status = 'suspended'`

### 3. DnsService (packages/api/src/domain/dns/DnsService.ts)

Write DNS records directly to PowerDNS MySQL tables (`domains`, `records`). PowerDNS reads from MySQL in real time — no reload needed for record changes. Only zone creation/deletion needs a PowerDNS API call or service restart.

```typescript
interface DnsRecord {
  name: string;     // FQDN with trailing dot or relative
  type: 'A'|'AAAA'|'CNAME'|'MX'|'TXT'|'NS'|'SRV'|'CAA';
  content: string;
  ttl: number;      // default 3600
  priority?: number; // MX only
}

class DnsService {
  async createZone(domain: string, serverIp: string): Promise<void>;
  async deleteZone(domain: string): Promise<void>;
  async addRecord(accountId: string, domain: string, record: DnsRecord): Promise<string>;
  async updateRecord(accountId: string, recordId: string, record: Partial<DnsRecord>): Promise<void>;
  async deleteRecord(accountId: string, recordId: string): Promise<void>;
  async getZone(domain: string): Promise<DnsRecord[]>;
  private assertOwnership(account: Account, recordName: string): void; // prevent cross-domain writes
}
```

**Default zone records on account creation:**

```
{domain}      A     {serverIp}   3600
www.{domain}  A     {serverIp}   3600
mail.{domain} A     {serverIp}   3600
{domain}      MX    mail.{domain} 3600 priority=10
{domain}      TXT   "v=spf1 a mx ip4:{serverIp} ~all"  3600
```

### 4. EmailService (packages/api/src/domain/email/EmailService.ts)

```typescript
class EmailService {
  async createMailbox(accountId: string, params: {
    localPart: string; domain: string; password: string; quotaMb: number;
  }): Promise<void>;
  // Writes to email_accounts table (Postfix queries this directly)
  // Creates physical maildir at /var/mail/vhosts/{domain}/{localPart}/{cur,new,tmp}
  // Hashes password in Dovecot SHA512-CRYPT format: {SHA512-CRYPT}$6$...
  // Sets Dovecot quota via maildirsize file

  async deleteMailbox(accountId: string, email: string): Promise<void>;
  async changePassword(accountId: string, email: string, newPassword: string): Promise<void>;
  async setQuota(accountId: string, email: string, quotaMb: number): Promise<void>;
  async createForwarder(accountId: string, source: string, destination: string): Promise<void>;
  async deleteForwarder(accountId: string, forwarderId: string): Promise<void>;
}
```

**Postfix virtual mailbox MySQL queries — set these up in /etc/postfix/mysql-*.cf:**

```sql
-- mysql-virtual-domains.cf query:
SELECT domain FROM email_accounts WHERE domain='%s' AND status='active' LIMIT 1
-- mysql-virtual-mailboxes.cf query:
SELECT CONCAT(domain,'/',local_part,'/') FROM email_accounts
  WHERE local_part='%u' AND domain='%d' AND status='active' LIMIT 1
-- mysql-virtual-aliases.cf query:
SELECT destination FROM email_forwarders
  WHERE source='%s' AND status='active'
```

### 5. FileService (packages/api/src/domain/files/FileService.ts)

```typescript
class FileService {
  private resolveSafe(username: string, userPath: string): string {
    // MUST be implemented exactly:
    const root = `/home/${username}`;
    const resolved = path.resolve(root, userPath.replace(/^\/+/, ''));
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new ForbiddenError('Path traversal attempt');
    }
    return resolved;
  }

  async listDirectory(username: string, dirPath: string): Promise<FileEntry[]>;
  async readFile(username: string, filePath: string): Promise<string>;
  // Reject files > 2MB or binary files
  async writeFile(username: string, filePath: string, content: string): Promise<void>;
  async uploadFile(username: string, destDir: string, file: MultipartFile): Promise<void>;
  // Max upload size: 512MB. After write, chown to username:username
  async deleteFile(username: string, filePath: string): Promise<void>;
  async deletePath(username: string, targetPath: string): Promise<void>;
  async rename(username: string, from: string, to: string): Promise<void>;
  async changePermissions(username: string, filePath: string, mode: string): Promise<void>;
  // Validate mode is 3-digit octal, max 755
  async compress(username: string, paths: string[], destName: string): Promise<void>;
  async extract(username: string, archivePath: string, destDir: string): Promise<void>;
  // Zip slip protection: validate every entry path before extracting
  async createDirectory(username: string, dirPath: string): Promise<void>;
}
```

### 6. DatabaseService (packages/api/src/domain/databases/DatabaseService.ts)

```typescript
class DatabaseService {
  // adminPool: mysql2 pool with root-level MySQL credentials (separate from app DB)

  async createDatabase(accountId: string, displayName: string): Promise<void>;
  // Prefixed name: {username}_{displayName}
  // Validate: /^[a-z0-9_]{1,48}$/ on displayName
  // Check count against plan.maxDatabases

  async dropDatabase(accountId: string, dbId: string): Promise<void>;
  async createDbUser(accountId: string, displayName: string, password: string): Promise<void>;
  // Prefixed name: {username}_{displayName}
  // Max total length 32 chars (MySQL username limit)

  async dropDbUser(accountId: string, dbUserId: string): Promise<void>;
  async assignUserToDatabase(accountId: string, dbId: string, dbUserId: string, privileges: string[]): Promise<void>;
  async revokeUserFromDatabase(accountId: string, dbId: string, dbUserId: string): Promise<void>;
  async generatePhpMyAdminSSOToken(accountId: string, dbUser: string): Promise<string>;
  // Store token in Redis with 60s TTL
}
```

### 7. SslService (packages/api/src/domain/ssl/SslService.ts)

```typescript
class SslService {
  async issueLetsEncrypt(accountId: string, domain: string): Promise<void>;
  // 1. Verify domain A record resolves to server IP (dns.resolve4)
  // 2. Run certbot via privileged worker
  // 3. Update nginx vhost via NginxService.enableSsl()
  // 4. Upsert ssl_certificates row
  // 5. Update domains.ssl_enabled = 1

  async installCustomCertificate(accountId: string, domain: string, cert: string, key: string, chain?: string): Promise<void>;
  // Validate cert + key pair match using openssl (execFile)
  // Write to /etc/ssl/custom/{domain}/
  // Update nginx vhost

  async renewExpiringCerts(): Promise<void>;
  // Called by daily cron job
  // Find all ssl_certificates where expires_at < NOW() + INTERVAL 30 DAY AND auto_renew = 1
  // Re-issue via issueLetsEncrypt for each
}
```

### 8. NginxService (packages/api/src/infrastructure/nginx/NginxService.ts)

```typescript
class NginxService {
  private configDir = '/etc/nginx/sites-available';
  private enabledDir = '/etc/nginx/sites-enabled';

  async writeVhostConfig(params: VhostParams): Promise<void>;
  // Generates config string from template, writes via privileged worker
  // Symlinks to sites-enabled
  // Calls reloadNginx()

  async enableSsl(domain: string, certPath: string, keyPath: string): Promise<void>;
  // Updates existing vhost to add SSL listen + cert directives
  // Adds HTTPS redirect from port 80

  async removeVhost(domain: string, username: string): Promise<void>;
  async reloadNginx(): Promise<void>; // nginx -t first, then nginx -s reload

  private generateVhostConfig(params: VhostParams): string;
}
```

**Nginx vhost template (generate this string):**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name {domain} www.{domain};

    root {documentRoot};
    index index.php index.html index.htm;

    access_log /var/log/nginx/{username}_access.log combined buffer=16k;
    error_log  /var/log/nginx/{username}_error.log;

    client_max_body_size 512M;

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/{phpVersion}-fpm-{username}.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }

    location ~ /\.ht { deny all; }
    location ~ /\.git { deny all; }
}
```

---

## API ROUTES

All routes are prefixed `/api/v1`. Authentication: `Authorization: Bearer {jwt}`. JWT payload contains `{ sub: userId, accountId, role: 'root'|'reseller'|'owner' }`.

### Accounts

```
POST   /accounts                    Create account (root/reseller only)
GET    /accounts                    List accounts (scoped by role)
GET    /accounts/:id                Get account + usage summary
PATCH  /accounts/:id                Update plan, email, contact info
DELETE /accounts/:id                Terminate (queued job)
POST   /accounts/:id/suspend        Suspend with reason
POST   /accounts/:id/unsuspend      Reactivate
POST   /accounts/:id/change-password Change cPanel password
GET    /accounts/:id/usage          Disk, bandwidth, counts
```

### DNS

```
GET    /accounts/:id/dns/:domain            Get zone records
POST   /accounts/:id/dns/:domain/records    Add record
PUT    /accounts/:id/dns/:domain/records/:rid Update record
DELETE /accounts/:id/dns/:domain/records/:rid Delete record
POST   /accounts/:id/dns/:domain/reset      Reset zone to defaults
```

### Email

```
GET    /accounts/:id/email/accounts         List mailboxes
POST   /accounts/:id/email/accounts         Create mailbox
DELETE /accounts/:id/email/accounts/:email  Delete mailbox
PATCH  /accounts/:id/email/accounts/:email  Change password / quota
GET    /accounts/:id/email/forwarders       List forwarders
POST   /accounts/:id/email/forwarders       Create forwarder
DELETE /accounts/:id/email/forwarders/:fid  Delete forwarder
```

### Databases

```
GET    /accounts/:id/mysql/databases           List databases
POST   /accounts/:id/mysql/databases           Create database
DELETE /accounts/:id/mysql/databases/:db       Drop database
GET    /accounts/:id/mysql/users               List DB users
POST   /accounts/:id/mysql/users               Create DB user
DELETE /accounts/:id/mysql/users/:uid          Drop DB user
POST   /accounts/:id/mysql/assign              Grant user to DB
DELETE /accounts/:id/mysql/assign              Revoke user from DB
GET    /accounts/:id/mysql/phpmyadmin-sso      Get SSO token
```

### Files

```
GET    /accounts/:id/files          List directory (?path=)
GET    /accounts/:id/files/content  Get file content (?path=)
POST   /accounts/:id/files/content  Write file content
POST   /accounts/:id/files/upload   Multipart upload
DELETE /accounts/:id/files          Delete file/dir
POST   /accounts/:id/files/rename   Rename/move
POST   /accounts/:id/files/chmod    Change permissions
POST   /accounts/:id/files/mkdir    Create directory
POST   /accounts/:id/files/compress Compress to archive
POST   /accounts/:id/files/extract  Extract archive
```

### FTP

```
GET    /accounts/:id/ftp            List FTP accounts
POST   /accounts/:id/ftp            Create FTP account
DELETE /accounts/:id/ftp/:ftpId     Delete FTP account
PATCH  /accounts/:id/ftp/:ftpId     Change password / quota / directory
```

### SSL

```
GET    /accounts/:id/ssl            List certificates
POST   /accounts/:id/ssl/letsencrypt Issue Let's Encrypt cert
POST   /accounts/:id/ssl/custom     Install custom cert
DELETE /accounts/:id/ssl/:certId    Remove certificate
```

### Domains

```
GET    /accounts/:id/domains        List all domains
POST   /accounts/:id/domains        Add addon/parked/subdomain/redirect
DELETE /accounts/:id/domains/:did   Remove domain
PATCH  /accounts/:id/domains/:did   Update redirect / PHP version
```

### Cron

```
GET    /accounts/:id/cron           List cron jobs
POST   /accounts/:id/cron           Create cron job
PUT    /accounts/:id/cron/:cid      Update cron job
DELETE /accounts/:id/cron/:cid      Delete cron job
```

### Backups

```
GET    /accounts/:id/backups        List backups
POST   /accounts/:id/backups        Create backup (queued)
POST   /accounts/:id/backups/:bid/restore Restore backup (queued)
DELETE /accounts/:id/backups/:bid   Delete backup
GET    /accounts/:id/backups/:bid/download Download backup
```

### WHM API (WHMCS compatibility — separate router at /whm)

```
POST   /whm/json-api/createacct     Create account (WHMCS provisioning)
POST   /whm/json-api/suspendacct    Suspend account
POST   /whm/json-api/unsuspendacct  Unsuspend account
POST   /whm/json-api/terminateacct  Terminate account
GET    /whm/json-api/accountsummary Get usage for WHMCS
POST   /whm/json-api/changepackage  Change plan
```

WHM auth: HTTP Basic Auth where username is `root` and password is a stored API key hash. Validate with constant-time comparison.

---

## ENVIRONMENT VARIABLES

Create a `.env.example` file with all required variables:

```env
# App
NODE_ENV=development
PORT=3000
JWT_SECRET=                        # RS256 private key (PEM)
JWT_PUBLIC_KEY=                    # RS256 public key (PEM)

# MySQL (app database)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=cpanel_clone
DB_USER=cpanel_app
DB_PASSWORD=

# MySQL (account databases — separate high-privilege connection)
DB_ADMIN_HOST=127.0.0.1
DB_ADMIN_PORT=3306
DB_ADMIN_USER=cpanel_admin
DB_ADMIN_PASSWORD=

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Privileged worker
PRIVILEGED_SOCKET=/var/run/cpanel-privileged.sock
PRIVILEGED_WORKER_SECRET=          # HMAC key for command signing

# Server
SERVER_IP=                         # This server's public IP
SERVER_HOSTNAME=                   # e.g. server1.yourdomain.com
NAMESERVER_1=ns1.yourdomain.com
NAMESERVER_2=ns2.yourdomain.com

# PowerDNS
PDNS_DB_NAME=powerdns
PDNS_DB_USER=pdns
PDNS_DB_PASSWORD=

# Certbot
CERTBOT_EMAIL=admin@yourdomain.com

# Backups
BACKUP_STORAGE=local               # 'local' or 's3'
BACKUP_LOCAL_PATH=/var/backups/cpanel
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# WHM API
WHM_API_KEY=                       # Generated once, stored hashed in DB
```

---

## SECURITY REQUIREMENTS

Implement all of these. They are not optional.

### Command injection prevention

```typescript
// NEVER do this:
await execAsync(`useradd ${username}`);  // username could be "; rm -rf /"

// ALWAYS do this:
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
await execFileAsync('useradd', ['-m', '-u', uid, '-s', '/bin/false', username]);
```

### Privileged worker IPC signature

```typescript
// Every command from API → privileged worker must be signed:
import { createHmac } from 'crypto';

function signCommand(command: string, args: object, secret: string): string {
  const payload = JSON.stringify({ command, args });
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Privileged worker verifies before executing:
function verifySignature(command: string, args: object, signature: string, secret: string): boolean {
  const expected = signCommand(command, args, secret);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Rate limiting (implement via Fastify rate-limit plugin)

```
Login endpoint:           5 requests / 15 minutes / IP
API (general):          300 requests / minute / account
File upload:             50 requests / minute / account
SSL issuance:             5 requests / hour / account
Account creation:        10 requests / hour / admin IP
```

### Input validation rules

- `username`: `/^[a-z0-9][a-z0-9_]{0,30}[a-z0-9]$/` — no leading underscores, no reserved names (root, admin, mysql, nginx, www, mail, ftp, cpanel, whm)
- `domain`: valid RFC hostname, no localhost, no IP addresses
- `cron expression`: validate each field individually (minute 0-59, hour 0-23, etc.)
- `chmod mode`: `/^[0-7]{3}$/`, max `755`
- `email local part`: `/^[a-z0-9._%+-]{1,64}$/`
- `db display name`: `/^[a-z0-9_]{1,48}$/`

---

## BUILD ORDER

Build in this exact sequence. Do not skip ahead. Each phase must be fully functional before starting the next.

### Phase 1 — Foundation (implement first)

1. Monorepo setup: `pnpm-workspace.yaml`, root `package.json`, `tsconfig.json` base
2. Shared package: types, interfaces, utility functions
3. Database connection module with connection pool
4. All MySQL table migrations (run-and-verify against a real MySQL instance)
5. Privileged worker: Unix socket server + HMAC auth + all whitelisted commands
6. Fastify app skeleton: plugins, error handler, health check endpoint
7. JWT auth middleware + RBAC middleware
8. AccountService + provisioning BullMQ job (the core of the whole system)
9. Seed script: one server, three plans (Starter 5GB, Business 20GB, Pro 50GB), one root admin user

### Phase 2 — Core Services

10. DnsService (PowerDNS MySQL integration)
2. NginxService (vhost template + reload)
3. EmailService (Postfix + Dovecot virtual mailboxes)
4. DatabaseService (account MySQL DB management)
5. FileService (with full path traversal protection)
6. SslService (Certbot wrapper)
7. FtpService (ProFTPd virtual users)
8. DomainService (addon domains, parked, subdomains, redirects)
9. CronService (crontab read/write per user)
10. BackupService (homedir + DB backup/restore)
11. QuotaService (disk + bandwidth tracking)

### Phase 3 — API Routes

21. Wire all services to Fastify routes (per the route table above)
2. Add Zod validation schemas for every request body
3. Add quota enforcement middleware on resource-creating endpoints
4. WHM compatibility router (WHMCS integration endpoints)

### Phase 4 — Frontend

25. cPanel UI (port 2083): Dashboard → File Manager → Email → Databases → DNS → FTP → SSL → Domains → Cron → Backups
2. WHM UI (port 2087): Account list → Create account → Plans → Server health → API keys

### Phase 5 — Jobs & Automation

27. BullMQ workers: `ssl-renew`, `quota-check`, `bandwidth-parse`, `backup-cleanup`
2. Bandwidth log parser: parse Nginx access logs daily, aggregate by account
3. Scheduled jobs setup (BullMQ repeatable jobs)

---

## WHAT NOT TO BUILD

Do not build these. They are out of scope:

- Billing / payment processing (handled by separate WHMCS installation)
- Email spam filtering UI (SpamAssassin is preconfigured at the server level)
- Mailing list management
- AWStats or Webalizer integration
- Softaculous / auto-installer for apps other than WordPress
- Multi-server clustering
- DNS cluster / slave zone syncing
- Server-to-server migration tools
- Mobile app

---

## DEVELOPMENT ENVIRONMENT

Provide a `docker-compose.dev.yml` that starts:

- MySQL 8 (port 3306, with `cpanel_clone` and `powerdns` databases pre-created)
- Redis 7 (port 6379)
- phpMyAdmin (port 8080, for development inspection)

The actual daemons (Nginx, Postfix, Dovecot, PowerDNS, ProFTPd, PHP-FPM) are NOT dockerised — they run on the real host OS. The docker-compose is only for MySQL and Redis in development.

Provide a `scripts/server-setup.sh` that installs and configures all daemons on a fresh Ubuntu 22.04 server. The script must be idempotent.

---

## CODING STANDARDS

- All async functions must have proper error handling. Never swallow errors silently.
- All database queries that modify data must run inside transactions where multiple writes are needed.
- Log every provisioning action with timestamp and result (success or error + stack trace).
- Use structured logging (JSON format in production) via `pino`.
- Every public method on every service class must have a JSDoc comment describing what it does, what it talks to, and what it returns.
- Test files go in `__tests__/` next to the source file. Write unit tests for: `resolveSafe()`, `QuotaService`, `DnsService.assertOwnership()`, `signCommand()`, and all input validation functions.
- No `any` types. Use `unknown` and narrow where necessary.
- All secret comparisons use `crypto.timingSafeEqual()`.

---

## START HERE

When you begin, do the following in order:

1. Read this entire prompt before writing any code.
2. Set up the monorepo structure (`pnpm-workspace.yaml`, `package.json` files, `tsconfig.json` files).
3. Create `docker-compose.dev.yml` and run it to verify MySQL and Redis are reachable.
4. Write and run all database migrations. Verify all tables exist with the correct schema.
5. Implement the privileged worker and write a test that sends a signed `create_linux_user` command and verifies the response.
6. Then proceed through Phase 1 → Phase 5 in order.

Ask no clarifying questions. All decisions have been made in this document. When a decision is not specified, use the most secure and production-appropriate default.
