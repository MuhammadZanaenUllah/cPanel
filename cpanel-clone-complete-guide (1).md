::: wrap
::: nav-brand
::: nav-brand-title
cPanel Clone Blueprint
:::

::: nav-brand-sub
COMPLETE TECHNICAL GUIDE
:::
:::

::: nav-group-label
Foundation
:::

[1 --- What Is cPanel?](#s1) [2 --- System Architecture](#s2) [3 ---
Module Breakdown](#s3) [4 --- User Roles & Hierarchy](#s4)

::: nav-group-label
Core Modules
:::

[5 --- DNS Management](#s5) [6 --- Email System](#s6) [7 --- File
Manager](#s7) [8 --- Database Management](#s8) [9 --- FTP Accounts](#s9)
[10 --- SSL / TLS](#s10)

::: nav-group-label
Infrastructure
:::

[11 --- Domain & Subdomain Logic](#s11) [12 --- Resource Quotas](#s12)
[13 --- Backup System](#s13) [14 --- Software Installer](#s14)

::: nav-group-label
Platform
:::

[15 --- Database Design](#s15) [16 --- API Design](#s16) [17 ---
Security Layer](#s17) [18 --- WHM (Reseller Layer)](#s18)

::: nav-group-label
Build
:::

[19 --- Tech Stack](#s19) [20 --- Implementation Roadmap](#s20) [21 ---
WHMCS Integration](#s21)

::: {.main role="main"}
::: hero

# cPanel Clone *Complete Technical Blueprint*

::: hero-sub
FROM ARCHITECTURE TO PRODUCTION --- NODE.JS · TYPESCRIPT · MYSQL · REACT
:::

::: tag-row
[Node.js]{.tag .t-node} [TypeScript]{.tag .t-ts} [MySQL]{.tag .t-pg}
[React]{.tag .t-react} [Docker]{.tag .t-docker} [Redis]{.tag .t-redis}
:::
:::

::: {#s1 .section .section}
::: sec-hdr
[§ 01]{.sec-num}

## What Is cPanel?

:::

cPanel is a Linux-based web hosting control panel that provides a
graphical interface for managing all aspects of a web hosting account.
It sits between the raw Linux server and the end user, wrapping complex
system administration tasks into a web UI that non-technical clients can
operate.

::: grid2
::: {.card .accent-l}

##### What cPanel manages on the server

DNS zones, Apache/Nginx vhosts, email accounts (Dovecot/Exim), MySQL
databases, FTP accounts (Pure-FTPd), filesystem quotas, SSL
certificates, cron jobs, PHP version per-domain, and application
installers (Softaculous).
:::

::: {.card .blue-l}

##### The three-tier hierarchy

**WHM** (root/reseller admin) → **cPanel** (hosting account holder) →
**Webmail/phpMyAdmin** (end-user subapps). Each tier has its own port,
auth, and permission scope.
:::
:::

### What Your Clone Must Replicate

::: grid3
::: card

##### Server orchestration

Your backend talks to real server daemons --- Nginx, Postfix, Dovecot,
ProFTPd, BIND/PowerDNS, MySQL. It does not simulate them.
:::

::: card

##### Provisioning engine

When WHMCS creates an account, your system must provision all
server-side resources automatically and atomically.
:::

::: card

##### Resource isolation

Each hosting account must be a separate Linux user with filesystem, disk
quota, bandwidth, and process limits enforced at the OS level.
:::

::: card

##### Web UI (cPanel equivalent)

A React dashboard the client logs into to manage domains, email,
databases, files --- their slice of the server.
:::

::: card

##### WHM equivalent

An admin/reseller dashboard for creating accounts, setting resource
limits, managing shared server config, and billing integration.
:::

::: card

##### API surface

WHMCS and other billing systems talk to cPanel via its API. Your clone
needs a compatible or equivalent REST API for WHMCS integration.
:::
:::
:::

------------------------------------------------------------------------

::: {#s2 .section .section}
::: sec-hdr
[§ 02]{.sec-num}

## System Architecture

:::

The clone has four layers: a React frontend, a Node.js API gateway, a
set of service modules that each own one server subsystem, and the
underlying Linux daemons. A message queue handles long-running
provisioning tasks asynchronously.

::: layers
::: layer
::: layer-name
Client Layer
:::

::: layer-items
[React (Vite)]{.chip} [cPanel UI (port 2083)]{.chip} [WHM UI (port
2087)]{.chip} [Webmail UI (port 2096)]{.chip}
:::
:::

::: layer
::: layer-name
API Gateway
:::

::: layer-items
[Fastify / Express]{.chip} [JWT auth]{.chip} [Rate limiter]{.chip} [RBAC
middleware]{.chip} [Request validation (Zod)]{.chip}
:::
:::

::: layer
::: layer-name
Service Layer
:::

::: layer-items
[AccountService]{.chip} [DnsService]{.chip} [EmailService]{.chip}
[DatabaseService]{.chip} [FileService]{.chip} [FtpService]{.chip}
[SslService]{.chip} [BackupService]{.chip} [QuotaService]{.chip}
[CronService]{.chip}
:::
:::

::: layer
::: layer-name
Job Queue
:::

::: layer-items
[BullMQ]{.chip} [Redis]{.chip} [Account provisioning jobs]{.chip}
[Backup jobs]{.chip} [SSL renewal jobs]{.chip}
:::
:::

::: layer
::: layer-name
Data Layer
:::

::: layer-items
[MySQL 8]{.chip} [Redis (cache + sessions)]{.chip} [Filesystem
(/home/{username})]{.chip}
:::
:::

::: layer
::: layer-name
System Daemons
:::

::: layer-items
[Nginx (web server)]{.chip} [PHP-FPM (multi-version)]{.chip} [PowerDNS
(DNS)]{.chip} [Postfix (SMTP)]{.chip} [Dovecot (IMAP/POP3)]{.chip}
[ProFTPd (FTP)]{.chip} [MySQL 8 (databases)]{.chip} [Let\'s Encrypt
(SSL)]{.chip}
:::
:::
:::

### Provisioning Flow (Account Creation)

::: dia
::: mermaid
sequenceDiagram participant WHMCS as WHMCS/Admin participant API as API
Gateway participant Queue as BullMQ Queue participant Worker as
Provision Worker participant OS as Linux OS participant DB as MySQL
WHMCS-\>\>API: POST /api/accounts {username, domain, plan} API-\>\>DB:
Insert account record (status=provisioning) API-\>\>Queue: Enqueue
provision job API\--\>\>WHMCS: 202 Accepted {jobId} Queue-\>\>Worker:
Dequeue job Worker-\>\>OS: useradd {username} + set password
Worker-\>\>OS: mkdir /home/{username}, chown, quota set Worker-\>\>OS:
Write Nginx vhost config Worker-\>\>OS: nginx -s reload Worker-\>\>OS:
Create DNS zone in PowerDNS Worker-\>\>OS: Create Postfix mailbox
routing Worker-\>\>OS: Create ProFTPd virtual user Worker-\>\>OS: Create
MySQL user + grant privileges Worker-\>\>DB: Update account
status=active Worker-\>\>WHMCS: Webhook: account.provisioned
:::
:::

::: {.call .warn}
[Critical Design Rule]{.call-lbl}

Account provisioning must be **idempotent**. If the worker crashes
mid-provisioning, re-running the job must not create duplicate users,
duplicate DNS zones, or partial states. Each provisioning step must
check if it\'s already been applied before executing.
:::
:::

------------------------------------------------------------------------

::: {#s3 .section .section}
::: sec-hdr
[§ 03]{.sec-num}

## Module Breakdown

:::

cPanel has approximately 60 modules. A production-viable clone needs the
core 15. Below are all modules, grouped by priority.

#### Priority 1 --- Must Have (MVP)

::: mod-grid
::: mod
::: mod-icon
🌐
:::

<div>

::: mod-name
Domains
:::

::: mod-desc
Addon, parked, redirects
:::

</div>
:::

::: mod
::: mod-icon
🔤
:::

<div>

::: mod-name
Subdomains
:::

::: mod-desc
Create, delete, redirect
:::

</div>
:::

::: mod
::: mod-icon
📧
:::

<div>

::: mod-name
Email Accounts
:::

::: mod-desc
Create, quota, password
:::

</div>
:::

::: mod
::: mod-icon
📬
:::

<div>

::: mod-name
Email Forwarders
:::

::: mod-desc
Address & domain forwarders
:::

</div>
:::

::: mod
::: mod-icon
🗄️
:::

<div>

::: mod-name
MySQL Databases
:::

::: mod-desc
Create DB + user + assign
:::

</div>
:::

::: mod
::: mod-icon
🛡️
:::

<div>

::: mod-name
SSL/TLS
:::

::: mod-desc
Let\'s Encrypt auto-issue
:::

</div>
:::

::: mod
::: mod-icon
📁
:::

<div>

::: mod-name
File Manager
:::

::: mod-desc
Browse, upload, edit, chmod
:::

</div>
:::

::: mod
::: mod-icon
📡
:::

<div>

::: mod-name
FTP Accounts
:::

::: mod-desc
Accounts + directory scope
:::

</div>
:::

::: mod
::: mod-icon
🕐
:::

<div>

::: mod-name
Cron Jobs
:::

::: mod-desc
Add/edit system crontab entries
:::

</div>
:::

::: mod
::: mod-icon
🌍
:::

<div>

::: mod-name
DNS Zone Editor
:::

::: mod-desc
A, CNAME, MX, TXT records
:::

</div>
:::
:::

#### Priority 2 --- Should Have

::: mod-grid
::: mod
::: mod-icon
🔒
:::

<div>

::: mod-name
Directory Privacy
:::

::: mod-desc
HTTP Basic Auth on paths
:::

</div>
:::

::: mod
::: mod-icon
📊
:::

<div>

::: mod-name
Bandwidth / Stats
:::

::: mod-desc
Awstats / Nginx log parser
:::

</div>
:::

::: mod
::: mod-icon
🛑
:::

<div>

::: mod-name
IP Blocker
:::

::: mod-desc
Deny IPs via Nginx deny
:::

</div>
:::

::: mod
::: mod-icon
🔄
:::

<div>

::: mod-name
Redirects
:::

::: mod-desc
301/302 per-domain rules
:::

</div>
:::

::: mod
::: mod-icon
💾
:::

<div>

::: mod-name
Backups
:::

::: mod-desc
Home dir + DB backup + restore
:::

</div>
:::

::: mod
::: mod-icon
🐘
:::

<div>

::: mod-name
PHP Version Selector
:::

::: mod-desc
Per-domain PHP-FPM pool
:::

</div>
:::

::: mod
::: mod-icon
📮
:::

<div>

::: mod-name
Email Spam Filter
:::

::: mod-desc
SpamAssassin rules per account
:::

</div>
:::

::: mod
::: mod-icon
📑
:::

<div>

::: mod-name
Error Pages
:::

::: mod-desc
Custom 404/500 per domain
:::

</div>
:::
:::

#### Priority 3 --- Nice to Have

::: mod-grid
::: mod
::: mod-icon
🚀
:::

<div>

::: mod-name
App Installer
:::

::: mod-desc
WordPress one-click deploy
:::

</div>
:::

::: mod
::: mod-icon
🔑
:::

<div>

::: mod-name
SSH Key Manager
:::

::: mod-desc
Authorized_keys management
:::

</div>
:::

::: mod
::: mod-icon
📬
:::

<div>

::: mod-name
Webmail
:::

::: mod-desc
Roundcube embed
:::

</div>
:::

::: mod
::: mod-icon
🗂️
:::

<div>

::: mod-name
Disk Usage Viewer
:::

::: mod-desc
du -sh tree visualization
:::

</div>
:::

::: mod
::: mod-icon
🔐
:::

<div>

::: mod-name
Hotlink Protection
:::

::: mod-desc
Nginx referer rules
:::

</div>
:::
:::
:::

------------------------------------------------------------------------

::: {#s4 .section .section}
::: sec-hdr
[§ 04]{.sec-num}

## User Roles & Hierarchy

:::

::: grid2
::: card

##### Root / Server Admin

Full access. Can create resellers, set server-wide config, view all
accounts, access WHM. Maps to WHM root login.
:::

::: card

##### Reseller

Can create and manage their own pool of hosting accounts up to their
allocated resource limits. Cannot touch other resellers\' accounts.
:::

::: card

##### Account Owner (cPanel user)

Can manage only their own hosting account: domains, email, databases,
files. Cannot exceed their plan quota.
:::

::: card

##### Sub-account (DAV/FTP user)

Limited to a specific directory or service. Cannot login to cPanel UI.
Created by the account owner.
:::
:::

### Permission Matrix

::: pm-wrap
  Action                         Root   Reseller           Account Owner   Sub-account
  ------------------------------ ------ ------------------ --------------- ----------------
  Create hosting account         ✓      ✓ (within quota)   ✗               ✗
  Suspend / terminate account    ✓      ✓ (own accounts)   ✗               ✗
  Manage DNS zone                ✓      ✓                  ✓               ✗
  Create email accounts          ✓      ✓                  ✓               ✗
  Create MySQL databases         ✓      ✓                  ✓               ✗
  Access file manager            ✓      ✓                  ✓ (own home)    ✓ (scoped dir)
  Install SSL certificate        ✓      ✓                  ✓               ✗
  Modify PHP version             ✓      ✓                  ✓               ✗
  View server-wide stats         ✓      ✗                  ✗               ✗
  Set reseller resource limits   ✓      ✗                  ✗               ✗
:::
:::

------------------------------------------------------------------------

::: {#s5 .section .section}
::: sec-hdr
[§ 05]{.sec-num}

## DNS Management

:::

DNS is managed via **PowerDNS** with its MySQL backend. Your service
reads and writes DNS records directly into the PowerDNS database, then
signals PowerDNS to reload. Never parse zone files manually --- PowerDNS
API handles all record types cleanly.

### PowerDNS MySQL Schema (relevant tables)

``` sql
-- PowerDNS uses these tables (you write to them)
domains (id, name, master, last_check, type, notified_serial, account)
records (id, domain_id, name, type, content, ttl, prio, disabled, auth)

-- Example: creating a zone for example.com
INSERT INTO domains (name, type) VALUES ('example.com', 'NATIVE');
-- SOA record (mandatory)
INSERT INTO records (domain_id, name, type, content, ttl) VALUES
  (LAST_INSERT_ID(), 'example.com', 'SOA',
   'ns1.yourserver.com. admin.example.com. 2025060101 3600 900 604800 300', 3600);
-- NS records
INSERT INTO records (domain_id, name, type, content, ttl) VALUES
  (LAST_INSERT_ID(), 'example.com', 'NS', 'ns1.yourserver.com.', 3600),
  (LAST_INSERT_ID(), 'example.com', 'NS', 'ns2.yourserver.com.', 3600);
-- Default A record pointing to server IP
INSERT INTO records (domain_id, name, type, content, ttl) VALUES
  (LAST_INSERT_ID(), 'example.com',     'A', '203.0.113.5', 3600),
  (LAST_INSERT_ID(), 'www.example.com', 'A', '203.0.113.5', 3600);
```

### DnsService --- TypeScript Implementation

``` ts
// services/DnsService.ts
import { PowerdnsClient } from './clients/PowerdnsClient';

export class DnsService {
  constructor(private pdns: PowerdnsClient, private db: Database) {}

  async createZone(domain: string, serverIp: string): Promise<void> {
    await this.pdns.createZone({
      name: domain + '.',
      kind: 'Native',
      nameservers: ['ns1.yourserver.com.', 'ns2.yourserver.com.'],
    });

    // Default records for new hosting account
    const defaultRecords = [
      { name: domain,          type: 'A',   content: serverIp,        ttl: 3600 },
      { name: `www.${domain}`, type: 'A',   content: serverIp,        ttl: 3600 },
      { name: `mail.${domain}`,type: 'A',   content: serverIp,        ttl: 3600 },
      { name: domain,          type: 'MX',  content: `mail.${domain}`,ttl: 3600, prio: 10 },
      { name: domain,          type: 'TXT', content: `"v=spf1 a mx ip4:${serverIp} ~all"`, ttl: 3600 },
    ];

    await this.pdns.addRecords(domain, defaultRecords);
  }

  async addRecord(accountId: string, record: DnsRecord): Promise<void> {
    const account = await this.db.accounts.findById(accountId);
    this.assertRecordOwnership(account, record.name); // prevent hijacking other domains

    await this.pdns.addRecord(account.domain, record);
    await this.db.dnsRecords.create({ ...record, accountId });
  }

  async deleteZone(domain: string): Promise<void> {
    await this.pdns.deleteZone(domain + '.');
    await this.db.dnsRecords.deleteByDomain(domain);
  }

  private assertRecordOwnership(account: Account, recordName: string): void {
    const normalised = recordName.replace(/\.$/, '').toLowerCase();
    if (!normalised.endsWith(account.domain) && normalised !== account.domain) {
      throw new Error(`Record ${recordName} is outside account domain ${account.domain}`);
    }
  }
}
```

### Supported Record Types

::: tw
  Type    Purpose                          Validation
  ------- -------------------------------- -------------------------------------
  A       Maps hostname to IPv4            Must be valid IPv4 address
  AAAA    Maps hostname to IPv6            Must be valid IPv6 address
  CNAME   Alias to another hostname        Cannot be set on apex domain
  MX      Mail server routing              Priority 0--65535, must be hostname
  TXT     SPF, DKIM, DMARC, verification   Max 255 chars per string
  NS      Nameserver delegation            Admin-only --- must end with dot
  SRV     Service location records         Priority, weight, port, target
  CAA     SSL certificate authority auth   issue/issuewild/iodef tags
:::
:::

------------------------------------------------------------------------

::: {#s6 .section .section}
::: sec-hdr
[§ 06]{.sec-num}

## Email System

:::

Email is the most complex subsystem. You need Postfix (SMTP), Dovecot
(IMAP/POP3), and a virtual mailbox setup backed by your database. Never
use system Linux users for mailboxes --- use virtual users stored in
MySQL.

### Stack: Postfix + Dovecot + Virtual Mailboxes

``` bash
# /etc/postfix/main.cf (relevant virtual mailbox settings)
virtual_mailbox_domains = mysql:/etc/postfix/mysql-virtual-domains.cf
virtual_mailbox_maps    = mysql:/etc/postfix/mysql-virtual-mailboxes.cf
virtual_alias_maps      = mysql:/etc/postfix/mysql-virtual-aliases.cf
virtual_transport       = dovecot
virtual_uid_maps        = static:5000
virtual_gid_maps        = static:5000
virtual_mailbox_base    = /var/mail/vhosts

# /etc/postfix/mysql-virtual-mailboxes.cf
user     = postfix_user
password = secret
hosts    = 127.0.0.1
dbname   = cpanel_clone
query    = SELECT CONCAT(domain,'/',local_part,'/') FROM email_accounts
           WHERE local_part='%u' AND domain='%d' AND status='active'
```

### EmailService

``` ts
// services/EmailService.ts
import { execAsync } from '../utils/shell';
import bcrypt from 'bcrypt';

export class EmailService {
  async createMailbox(accountId: string, params: CreateMailboxParams): Promise<void> {
    const account = await this.db.accounts.findById(accountId);
    const { localPart, domain, password, quota } = params;

    // Validate domain belongs to this account
    if (!account.domains.includes(domain)) throw new Error('Domain not owned by account');

    // Validate quota within plan limits
    const usedQuota = await this.getUsedEmailQuota(accountId);
    if (usedQuota + quota > account.plan.emailQuota) throw new Error('Email quota exceeded');

    // Hash password for Dovecot CRAM-MD5 / SHA512
    const hashedPw = await bcrypt.hash(password, 12);
    const dovecotHash = await this.generateDovecotHash(password); // {SHA512-CRYPT}$6$...

    // Persist to DB (Postfix reads from here)
    await this.db.emailAccounts.create({
      accountId,
      localPart: localPart.toLowerCase(),
      domain: domain.toLowerCase(),
      passwordHash: dovecotHash,
      quotaMb: quota,
      status: 'active',
    });

    // Create physical maildir
    const maildir = `/var/mail/vhosts/${domain}/${localPart}`;
    await execAsync(`mkdir -p ${maildir}/{cur,new,tmp}`);
    await execAsync(`chown -R vmail:vmail ${maildir}`);

    // Set Dovecot quota
    await this.setDovecotQuota(localPart, domain, quota);
  }

  async createForwarder(accountId: string, params: CreateForwarderParams): Promise<void> {
    // Forwarders are rows in email_forwarders table
    // Postfix virtual_alias_maps query picks them up automatically
    const { source, destination } = params;
    await this.db.emailForwarders.create({ accountId, source, destination, status: 'active' });
  }

  async deleteMailbox(accountId: string, email: string): Promise<void> {
    const [localPart, domain] = email.split('@');
    await this.db.emailAccounts.setStatus(email, 'deleted');
    // Optionally archive the maildir before deletion
    const maildir = `/var/mail/vhosts/${domain}/${localPart}`;
    await execAsync(`mv ${maildir} ${maildir}.deleted.${Date.now()}`);
  }
}
```

### Email Subsystems

::: grid2
::: card

##### Spam filtering --- SpamAssassin

Run as a Postfix content filter. Per-account rules stored in DB.
Adjustable score threshold via UI.
:::

::: card

##### DKIM signing

OpenDKIM generates a key pair per domain. Public key goes into DNS as a
TXT record. Private key is stored in `/etc/opendkim/keys/{domain}/`.
:::

::: card

##### Autoresponders

Implemented as Postfix transport rules + a simple Node.js SMTP daemon
that sends the canned reply and stores a suppression list (max one reply
per sender per 24h).
:::

::: card

##### Mailing lists

Powered by Mailman 3 or a lightweight alternative. The UI creates the
list config; Mailman handles subscriber management and archiving.
:::
:::
:::

------------------------------------------------------------------------

::: {#s7 .section .section}
::: sec-hdr
[§ 07]{.sec-num}

## File Manager

:::

The file manager is a web-based filesystem browser scoped strictly to
the account\'s home directory (`/home/{username}/`). It must enforce
that all operations stay within that boundary --- path traversal attacks
are the number one risk here.

### Security-First Path Resolution

``` ts
// services/FileService.ts
import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';

export class FileService {
  private getAccountRoot(username: string): string {
    return `/home/${username}`;
  }

  private resolveSafe(username: string, userPath: string): string {
    const root = this.getAccountRoot(username);
    // Resolve to absolute path, then check it starts with root
    const resolved = path.resolve(root, userPath.replace(/^\/+/, ''));
    if (!resolved.startsWith(root + '/') && resolved !== root) {
      throw new Error('Path traversal attempt detected');
    }
    return resolved;
  }

  async listDirectory(username: string, dirPath: string): Promise<FileEntry[]> {
    const safePath = this.resolveSafe(username, dirPath);
    const entries = await fs.readdir(safePath, { withFileTypes: true });

    return Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(safePath, entry.name);
      const stat = await fs.stat(fullPath);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        permissions: (stat.mode & 0o777).toString(8), // e.g. "755"
        modifiedAt: stat.mtime,
        mimeType: entry.isFile() ? await this.getMimeType(fullPath) : null,
      };
    }));
  }

  async uploadFile(username: string, destDir: string, filename: string, buffer: Buffer): Promise<void> {
    const safeDest = this.resolveSafe(username, path.join(destDir, filename));
    await fs.writeFile(safeDest, buffer);
    // Restore proper ownership (files uploaded as root must be chowned)
    await execAsync(`chown ${username}:${username} "${safeDest}"`);
  }

  async changePermissions(username: string, filePath: string, mode: string): Promise<void> {
    // Validate mode: must be 3-digit octal string, max 755 for files
    if (!/^[0-7]{3}$/.test(mode)) throw new Error('Invalid permission mode');
    if (parseInt(mode, 8) > 0o755) throw new Error('Permission too permissive');
    const safePath = this.resolveSafe(username, filePath);
    await fs.chmod(safePath, parseInt(mode, 8));
  }

  async compress(username: string, paths: string[], destName: string): Promise<void> {
    const root = this.getAccountRoot(username);
    const safePaths = paths.map(p => this.resolveSafe(username, p));
    const destPath = this.resolveSafe(username, destName);
    // Use archiver to create zip/tar.gz
    const output = require('fs').createWriteStream(destPath);
    const archive = archiver('zip');
    archive.pipe(output);
    for (const p of safePaths) archive.file(p, { name: path.relative(root, p) });
    await archive.finalize();
  }
}
```

### File Manager UI Operations

::: tw
  Operation            Backend Action                          Risk
  -------------------- --------------------------------------- ------------------------------------------
  Browse directory     `fs.readdir` + `stat`                   Path traversal → safePath check
  Upload file          Multipart stream → `fs.writeFile`       File size limit, MIME type check
  Edit file            Read → return content → write on save   Max edit size 2 MB; binary files blocked
  Delete file/dir      `fs.unlink` / `fs.rm --recursive`       Confirm prompt; soft-delete to trash dir
  Rename / Move        `fs.rename`                             Destination path traversal check
  Change permissions   `fs.chmod`                              Max 755 for files, 755 for dirs
  Compress             `archiver` → zip/tar.gz                 Bomb check: max output 2 GB
  Extract archive      `unzipper` / `tar`                      Path traversal inside archive (zip slip)
:::

::: {.call .danger}
[Zip Slip Attack]{.call-lbl}

When extracting archives, check every entry path. An archive can contain
entries like `../../etc/passwd`. Always resolve each entry path and
verify it stays within the account\'s home directory before writing.
:::
:::

------------------------------------------------------------------------

::: {#s8 .section .section}
::: sec-hdr
[§ 08]{.sec-num}

## Database Management

:::

Each hosting account gets its own set of MySQL databases and users,
isolated by prefix (`{username}_`). Your DatabaseService executes DDL
statements against the server\'s MySQL instance with a highly-privileged
service account, then grants appropriate permissions to the
account-level MySQL user.

``` ts
// services/DatabaseService.ts
import mysql from 'mysql2/promise';

export class DatabaseService {
  constructor(private adminPool: mysql.Pool) {} // root-level MySQL connection

  async createDatabase(accountId: string, dbName: string): Promise<void> {
    const account = await this.accountRepo.findById(accountId);
    const prefixed = `${account.username}_${dbName}`;

    // Check count limit from plan
    const count = await this.db.mysqlDatabases.countForAccount(accountId);
    if (count >= account.plan.maxDatabases) throw new Error('Database limit reached');

    // Validate name: alphanumeric + underscore only, max 64 chars after prefix
    if (!/^[a-z0-9_]{1,48}$/.test(dbName)) throw new Error('Invalid database name');

    await this.adminPool.execute(`CREATE DATABASE IF NOT EXISTS \`${prefixed}\``);
    await this.db.mysqlDatabases.create({ accountId, name: prefixed, displayName: dbName });
  }

  async createUser(accountId: string, params: CreateDbUserParams): Promise<void> {
    const account = await this.accountRepo.findById(accountId);
    const { username, password } = params;
    const prefixed = `${account.username}_${username}`;

    // MySQL usernames have a 32-char limit
    if (prefixed.length > 32) throw new Error('Username too long');

    await this.adminPool.execute(
      `CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`,
      [prefixed, password]
    );
    await this.db.mysqlUsers.create({ accountId, username: prefixed });
  }

  async assignUserToDatabase(
    accountId: string, dbName: string, dbUser: string, privileges: string[]
  ): Promise<void> {
    const validPrivileges = ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'INDEX', 'ALTER'];
    const sanitised = privileges.filter(p => validPrivileges.includes(p.toUpperCase()));

    await this.adminPool.execute(
      `GRANT ${sanitised.join(',')} ON \`${dbName}\`.* TO ?@'localhost'`,
      [dbUser]
    );
    await this.adminPool.execute('FLUSH PRIVILEGES');

    await this.db.mysqlAssignments.upsert({ accountId, dbName, dbUser, privileges: sanitised });
  }

  async dropDatabase(accountId: string, dbName: string): Promise<void> {
    await this.assertDatabaseOwnership(accountId, dbName);
    await this.adminPool.execute(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await this.db.mysqlDatabases.delete(dbName);
  }
}
```

### phpMyAdmin Integration

Rather than rebuilding a database GUI, embed phpMyAdmin running behind
your auth proxy. When a user clicks \"phpMyAdmin\" in the UI, your
backend creates a temporary single-sign-on token, and the user is
redirected to a pre-authenticated phpMyAdmin session scoped to their
databases only.

``` ts
// SSO token for phpMyAdmin
async function generatePhpMyAdminSSOToken(username: string, dbUser: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await redis.setex(`pma:sso:${token}`, 60, JSON.stringify({ dbUser })); // 60s TTL
  return token;
}

// phpMyAdmin config.inc.php reads the token
// $cfg['Servers'][$i]['auth_type'] = 'signon';
// $cfg['Servers'][$i]['SignonSession'] = 'SignonSession';
// $cfg['Servers'][$i]['SignonURL'] = 'https://yourpanel.com/pma-sso?token=...';
```

:::

------------------------------------------------------------------------

::: {#s9 .section .section}
::: sec-hdr
[§ 09]{.sec-num}

## FTP Accounts

:::

Use **ProFTPd** with virtual users stored in your MySQL database. This
avoids creating real Linux users for every FTP account. ProFTPd queries
your DB directly for auth and directory scoping.

``` bash
# /etc/proftpd/conf.d/sql.conf
<IfModule mod_sql.c>
  SQLBackend               mysql
  SQLConnectInfo           cpanel_clone@localhost cpanel_user secret
  SQLAuthTypes             SHA512
  SQLAuthenticate          users groups
  SQLUserInfo              ftp_accounts username password uid gid homedir shell
  SQLGroupInfo             ftp_groups groupname gid members
  SQLLog PASS              updateLastLogin
  SQLNamedQuery            updateLastLogin UPDATE "last_login=NOW() WHERE username='%u'" ftp_accounts
</IfModule>

<IfModule mod_quotatab_sql.c>
  QuotaEngine              on
  SQLNamedQuery            get-quota-limit SELECT "quota_mb FROM ftp_accounts WHERE username='%u'"
</IfModule>
```

### FTP Service

``` ts
// services/FtpService.ts
export class FtpService {
  async createFtpAccount(accountId: string, params: CreateFtpParams): Promise<void> {
    const account = await this.accountRepo.findById(accountId);
    const { username, password, directory, quota } = params;

    const fullUsername = `${account.username}_${username}`;
    const homeDir = this.resolveScopeDir(account.username, directory);

    // Password hashed for ProFTPd SHA512
    const hashedPw = await this.hashFtpPassword(password);

    await this.db.ftpAccounts.create({
      accountId,
      username: fullUsername,
      password: hashedPw,
      homedir: homeDir,
      quotaMb: quota ?? account.plan.ftpQuota,
      uid: account.systemUid,
      gid: account.systemGid,
    });

    // Ensure directory exists
    await execAsync(`mkdir -p "${homeDir}" && chown ${account.username}: "${homeDir}"`);
  }

  private resolveScopeDir(username: string, dir: string): string {
    const home = `/home/${username}`;
    if (!dir || dir === '/') return `${home}/public_html`;
    const resolved = path.resolve(home, dir.replace(/^\/+/, ''));
    if (!resolved.startsWith(home)) throw new Error('Directory outside account home');
    return resolved;
  }
}
```

:::

------------------------------------------------------------------------

::: {#s10 .section .section}
::: sec-hdr
[§ 10]{.sec-num}

## SSL / TLS Management

:::

Integrate **Certbot** (Let\'s Encrypt) for automatic certificate
issuance and renewal. Your SslService runs Certbot as a subprocess, then
configures Nginx with the resulting certificate files.

``` ts
// services/SslService.ts
export class SslService {
  async issueLetsEncrypt(accountId: string, domain: string): Promise<void> {
    // Verify domain's A record points to this server
    const resolved = await dns.resolve4(domain);
    if (!resolved.includes(this.serverIp)) {
      throw new Error(`Domain ${domain} does not point to this server`);
    }

    const email = await this.getAccountEmail(accountId);

    // Run certbot
    const { stdout, stderr } = await execAsync(
      `certbot certonly --webroot -w /home/${await this.getUsername(accountId)}/public_html ` +
      `-d ${domain} -d www.${domain} --email ${email} --agree-tos --non-interactive`
    );

    // Update Nginx vhost to use new cert
    await this.nginxService.enableSsl(domain, {
      certPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
      keyPath:  `/etc/letsencrypt/live/${domain}/privkey.pem`,
    });

    await this.db.sslCertificates.upsert({
      accountId, domain,
      issuer: 'letsencrypt',
      expiresAt: addDays(new Date(), 90),
      autoRenew: true,
    });
  }

  async installCustomCertificate(accountId: string, domain: string, cert: string, key: string, chain?: string): Promise<void> {
    // Validate cert + key match
    await this.validateCertKeyPair(cert, key);

    const certDir = `/etc/ssl/custom/${domain}`;
    await execAsync(`mkdir -p ${certDir}`);
    await fs.writeFile(`${certDir}/cert.pem`,  cert);
    await fs.writeFile(`${certDir}/key.pem`,   key);
    if (chain) await fs.writeFile(`${certDir}/chain.pem`, chain);

    await this.nginxService.enableSsl(domain, {
      certPath: `${certDir}/cert.pem`,
      keyPath:  `${certDir}/key.pem`,
    });
  }
}

// Renewal cron — runs daily via BullMQ
async function renewExpiringSslCerts(): Promise<void> {
  const expiring = await db.sslCertificates.findExpiringWithin(30, { autoRenew: true });
  for (const cert of expiring) {
    await sslService.issueLetsEncrypt(cert.accountId, cert.domain);
  }
}
```

:::

------------------------------------------------------------------------

::: {#s11 .section .section}
::: sec-hdr
[§ 11]{.sec-num}

## Domain & Subdomain Logic

:::

### Domain Types

::: tw
  Type                 What It Is                                                               What Gets Created
  -------------------- ------------------------------------------------------------------------ ---------------------------------------------------------------------
  **Primary domain**   The main domain of the hosting account                                   Nginx vhost, DNS zone, home dir at `/home/{user}/public_html`
  **Addon domain**     A fully separate domain pointing to a different dir within the account   Nginx vhost, DNS zone, dir at `/home/{user}/addon_domains/{domain}`
  **Parked domain**    An alias domain that shows same content as primary                       Nginx server_name alias added to primary vhost
  **Subdomain**        `sub.domain.com` pointing to a dir                                       Nginx location or separate vhost, DNS A record
  **Redirect**         Domain or path that 301/302 redirects elsewhere                          Nginx return directive
:::

### Nginx Vhost Template (per account)

``` nginx
# /etc/nginx/sites-available/{username}_{domain}.conf
# Generated by NginxService.writeVhostConfig()
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    root /home/johndoe/public_html;
    index index.php index.html;

    access_log /var/log/nginx/johndoe_access.log combined;
    error_log  /var/log/nginx/johndoe_error.log;

    # PHP-FPM — pool per account (resource isolation)
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/fpm-johndoe.sock;
    }

    location ~ /\.ht { deny all; }

    # SSL block added by SslService after cert issuance
    # listen 443 ssl http2;
    # ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    # include snippets/ssl-params.conf;
}
```

### NginxService --- Vhost Management

``` ts
export class NginxService {
  private configDir = '/etc/nginx/sites-available';
  private enabledDir = '/etc/nginx/sites-enabled';

  async writeVhostConfig(domain: string, username: string, root: string): Promise<void> {
    const config = this.renderTemplate({ domain, username, root });
    const filePath = `${this.configDir}/${username}_${domain}.conf`;
    await fs.writeFile(filePath, config);
    // Symlink to sites-enabled
    await execAsync(`ln -sf ${filePath} ${this.enabledDir}/`);
    await this.reload();
  }

  async reload(): Promise<void> {
    const { stderr } = await execAsync('nginx -t'); // test config first
    if (stderr.includes('failed')) throw new Error('Nginx config test failed:\n' + stderr);
    await execAsync('nginx -s reload');
  }

  async removeVhost(domain: string, username: string): Promise<void> {
    const filename = `${username}_${domain}.conf`;
    await execAsync(`rm -f ${this.enabledDir}/${filename}`);
    await execAsync(`rm -f ${this.configDir}/${filename}`);
    await this.reload();
  }
}
```

:::

------------------------------------------------------------------------

::: {#s12 .section .section}
::: sec-hdr
[§ 12]{.sec-num}

## Resource Quotas

:::

Resource limits are enforced at two levels: application-level (tracked
in your DB) and OS-level (enforced by the kernel). Never rely on
application-level alone --- a client could bypass your API and write
directly via FTP.

### Plan Resource Types

::: tw
  Resource              OS Enforcement                                       App Enforcement
  --------------------- ---------------------------------------------------- -----------------------------------------------
  Disk space            `quota` command --- sets hard limit per Linux user   Check before file upload, backup restore
  Bandwidth             Nginx log parsing (monthly cumulative)               Check against plan limit; suspend if exceeded
  Email accounts        ---                                                  Count check before creating new mailbox
  MySQL databases       ---                                                  Count check before create
  FTP accounts          ---                                                  Count check before create
  Subdomains            ---                                                  Count check before create
  Addon domains         ---                                                  Count check before create
  Cron jobs             ---                                                  Count check before create
  Inodes (file count)   `quota -i` inode limit                               ---
  CPU / memory          PHP-FPM per-pool limits (`pm.max_children`)          ---
:::

``` bash
# Set disk quota for a Linux user (requires quota kernel module)
# Block limit (1 block = 1 KB), soft limit = plan_mb, hard limit = plan_mb * 1.1
setquota -u johndoe 10485760 11534336 0 0 /home
# Verify
repquota -u /home | grep johndoe
```

``` ts
// services/QuotaService.ts
export class QuotaService {
  async setDiskQuota(username: string, planMb: number): Promise<void> {
    const softBlocks = planMb * 1024;           // MB to KB blocks
    const hardBlocks = Math.ceil(softBlocks * 1.1); // 10% grace
    await execAsync(`setquota -u ${username} ${softBlocks} ${hardBlocks} 0 0 /home`);
  }

  async getDiskUsage(username: string): Promise<{ usedMb: number; quotaMb: number }> {
    const { stdout } = await execAsync(`quota -u ${username} --hide-device -q 2>/dev/null || true`);
    const match = stdout.match(/(\d+)\s+(\d+)/);
    return {
      usedMb: match ? Math.ceil(parseInt(match[1]) / 1024) : 0,
      quotaMb: match ? Math.ceil(parseInt(match[2]) / 1024) : 0,
    };
  }

  async getBandwidthUsed(accountId: string, month?: Date): Promise<number> {
    // Sum from bandwidth_logs table (populated by nginx log parser job)
    return this.db.bandwidthLogs.sumForMonth(accountId, month ?? new Date());
  }
}
```

:::

------------------------------------------------------------------------

::: {#s13 .section .section}
::: sec-hdr
[§ 13]{.sec-num}

## Backup System

:::

Backups cover two things: the account\'s `/home/{username}` directory
and all MySQL databases owned by the account. Both are compressed and
stored --- either locally or on remote object storage (S3-compatible).

``` ts
// services/BackupService.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { exec } from 'child_process';

export class BackupService {
  constructor(private s3: S3Client, private bucket: string) {}

  async createFullBackup(accountId: string): Promise<BackupRecord> {
    const account = await this.accountRepo.findById(accountId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${account.username}_${timestamp}`;
    const tmpPath = `/tmp/backups/${backupName}`;

    await execAsync(`mkdir -p ${tmpPath}`);

    // 1. Archive home directory
    await execAsync(
      `tar -czf ${tmpPath}/homedir.tar.gz -C /home ${account.username} ` +
      `--exclude='${account.username}/.cache' --exclude='${account.username}/tmp'`
    );

    // 2. Dump all MySQL databases for this account
    const databases = await this.db.mysqlDatabases.findByAccount(accountId);
    for (const db of databases) {
      await execAsync(
        `mysqldump --single-transaction --routines --triggers ` +
        `${db.name} | gzip > ${tmpPath}/${db.name}.sql.gz`
      );
    }

    // 3. Create manifest
    const manifest = { account: account.username, timestamp, databases: databases.map(d => d.name) };
    await fs.writeFile(`${tmpPath}/manifest.json`, JSON.stringify(manifest, null, 2));

    // 4. Pack everything into one archive
    const archivePath = `/tmp/${backupName}.tar.gz`;
    await execAsync(`tar -czf ${archivePath} -C /tmp/backups ${backupName}`);

    // 5. Upload to S3 (or keep local)
    const s3Key = `backups/${account.username}/${backupName}.tar.gz`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket, Key: s3Key,
      Body: createReadStream(archivePath),
    }));

    // 6. Cleanup temp files
    await execAsync(`rm -rf ${tmpPath} ${archivePath}`);

    return this.db.backups.create({
      accountId, name: backupName, s3Key,
      sizeBytes: (await fs.stat(archivePath)).size,
      type: 'full', status: 'completed',
    });
  }

  async restore(accountId: string, backupId: string): Promise<void> {
    // Download from S3, extract, restore files + databases
    // ... (reverse of above)
  }
}
```

:::

------------------------------------------------------------------------

::: {#s14 .section .section}
::: sec-hdr
[§ 14]{.sec-num}

## Software Installer (WordPress)

:::

Equivalent to Softaculous. For MVP, implement only WordPress. The
installer downloads WordPress core, configures `wp-config.php`, creates
a database, runs the install script, and sets up the correct file
permissions.

``` ts
// services/AppInstallerService.ts
export class AppInstallerService {

  async installWordPress(accountId: string, params: WpInstallParams): Promise<void> {
    const account   = await this.accountRepo.findById(accountId);
    const { domain, path: installPath, dbName, adminUser, adminPassword, adminEmail, siteTitle } = params;

    const installDir = this.fileService.resolveSafe(account.username, installPath);

    // 1. Download & extract WordPress
    await execAsync(`wget -qO /tmp/wp.tar.gz https://wordpress.org/latest.tar.gz`);
    await execAsync(`tar -xzf /tmp/wp.tar.gz -C /tmp`);
    await execAsync(`rsync -a /tmp/wordpress/ ${installDir}/`);
    await execAsync(`chown -R ${account.username}: ${installDir}`);

    // 2. Create database + user
    const dbUser = `${account.username}_wp`;
    const dbPass = generatePassword(20);
    const prefixedDb = `${account.username}_${dbName}`;
    await this.dbService.createDatabase(accountId, dbName);
    await this.dbService.createUser(accountId, { username: 'wp', password: dbPass });
    await this.dbService.assignUserToDatabase(accountId, prefixedDb, dbUser, ['ALL']);

    // 3. Write wp-config.php
    await execAsync(`
      cp ${installDir}/wp-config-sample.php ${installDir}/wp-config.php
      sed -i "s/database_name_here/${prefixedDb}/g" ${installDir}/wp-config.php
      sed -i "s/username_here/${dbUser}/g" ${installDir}/wp-config.php
      sed -i "s/password_here/${dbPass}/g" ${installDir}/wp-config.php
    `);

    // 4. Inject unique salts (fetch from WordPress API)
    const salts = await fetch('https://api.wordpress.org/secret-key/1.1/salt/').then(r => r.text());
    // Replace the placeholder salt block in wp-config.php

    // 5. Run WP-CLI to complete installation
    await execAsync(
      `sudo -u ${account.username} wp core install ` +
      `--path=${installDir} --url=https://${domain}${installPath} ` +
      `--title="${siteTitle}" --admin_user=${adminUser} ` +
      `--admin_password=${adminPassword} --admin_email=${adminEmail} --skip-email`
    );

    // 6. Set file permissions
    await execAsync(`find ${installDir} -type f -exec chmod 644 {} \\;`);
    await execAsync(`find ${installDir} -type d -exec chmod 755 {} \\;`);

    await this.db.installedApps.create({ accountId, domain, path: installPath, app: 'wordpress' });
  }
}
```

:::

------------------------------------------------------------------------

::: {#s15 .section .section}
::: sec-hdr
[§ 15]{.sec-num}

## Database Design

:::

### Entity Relationship Diagram

::: dia
::: mermaid
erDiagram SERVERS { uuid id PK string hostname string ip_address string
os_version int max_accounts string status } PLANS { uuid id PK string
name int disk_mb int bandwidth_mb int max_email_accounts int
max_databases int max_ftp_accounts int max_subdomains int
max_addon_domains int max_cron_jobs string php_versions } ACCOUNTS {
uuid id PK uuid server_id FK uuid plan_id FK uuid reseller_id FK string
username string primary_domain string email string password_hash int
system_uid int system_gid string status timestamp suspended_at string
suspend_reason timestamp created_at } DOMAINS { uuid id PK uuid
account_id FK string domain string type string document_root boolean
ssl_enabled string ssl_cert_path timestamp ssl_expires_at string status
} EMAIL_ACCOUNTS { uuid id PK uuid account_id FK string local_part
string domain string password_hash int quota_mb string status }
EMAIL_FORWARDERS { uuid id PK uuid account_id FK string source string
destination string status } MYSQL_DATABASES { uuid id PK uuid account_id
FK string name string display_name timestamp created_at } MYSQL_USERS {
uuid id PK uuid account_id FK string username timestamp created_at }
FTP_ACCOUNTS { uuid id PK uuid account_id FK string username string
password_hash string homedir int quota_mb string status }
SSL_CERTIFICATES { uuid id PK uuid account_id FK string domain string
issuer string cert_path string key_path timestamp expires_at boolean
auto_renew } BACKUPS { uuid id PK uuid account_id FK string name string
storage_path bigint size_bytes string type string status timestamp
created_at } DNS_RECORDS { uuid id PK uuid account_id FK string domain
string name string type string content int ttl int priority } SERVERS
\|\|\--o{ ACCOUNTS : \"hosts\" PLANS \|\|\--o{ ACCOUNTS : \"governs\"
ACCOUNTS \|\|\--o{ DOMAINS : \"owns\" ACCOUNTS \|\|\--o{ EMAIL_ACCOUNTS
: \"has\" ACCOUNTS \|\|\--o{ EMAIL_FORWARDERS : \"has\" ACCOUNTS
\|\|\--o{ MYSQL_DATABASES : \"has\" ACCOUNTS \|\|\--o{ MYSQL_USERS :
\"has\" ACCOUNTS \|\|\--o{ FTP_ACCOUNTS : \"has\" ACCOUNTS \|\|\--o{
SSL_CERTIFICATES : \"has\" ACCOUNTS \|\|\--o{ BACKUPS : \"has\" ACCOUNTS
\|\|\--o{ DNS_RECORDS : \"manages\"
:::
:::

### Core Accounts Table

``` sql
CREATE TABLE accounts (
  id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  server_id       CHAR(36) NOT NULL,
  plan_id         CHAR(36) NOT NULL,
  reseller_id     CHAR(36) DEFAULT NULL,
  username        VARCHAR(32) NOT NULL,
  primary_domain  VARCHAR(253) NOT NULL,
  email           VARCHAR(254) NOT NULL,
  password_hash   TEXT NOT NULL,
  system_uid      INT NOT NULL,
  system_gid      INT NOT NULL,
  home_dir        VARCHAR(300) AS (CONCAT('/home/', username)) STORED,
  status          ENUM('active','suspended','terminated','provisioning') NOT NULL DEFAULT 'active',
  suspended_at    DATETIME DEFAULT NULL,
  suspend_reason  TEXT DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_server   FOREIGN KEY (server_id)   REFERENCES servers(id),
  CONSTRAINT fk_accounts_plan     FOREIGN KEY (plan_id)     REFERENCES plans(id),
  CONSTRAINT fk_accounts_reseller FOREIGN KEY (reseller_id) REFERENCES accounts(id),
  UNIQUE KEY uq_accounts_username (username),
  UNIQUE KEY uq_accounts_domain   (primary_domain),
  UNIQUE KEY uq_accounts_uid      (system_uid)
);

CREATE INDEX idx_accounts_reseller ON accounts(reseller_id);
CREATE INDEX idx_accounts_status   ON accounts(status);
```

:::

------------------------------------------------------------------------

::: {#s16 .section .section}
::: sec-hdr
[§ 16]{.sec-num}

## API Design

:::

#### Account Management

::: ep
[POST]{.m .post}[/api/v1/accounts]{.ep-path}[Create hosting account
(provision)]{.ep-note}
:::

::: ep
[GET]{.m .get}[/api/v1/accounts]{.ep-path}[List accounts
(admin/reseller)]{.ep-note}
:::

::: ep
[GET]{.m .get}[/api/v1/accounts/:id]{.ep-path}[Get account details +
usage]{.ep-note}
:::

::: ep
[PATCH]{.m .patch}[/api/v1/accounts/:id]{.ep-path}[Update plan,
password, email]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/suspend]{.ep-path}[Suspend
account]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/unsuspend]{.ep-path}[Reactivate
account]{.ep-note}
:::

::: ep
[DELETE]{.m .del}[/api/v1/accounts/:id]{.ep-path}[Terminate (async,
queue job)]{.ep-note}
:::

#### DNS

::: ep
[GET]{.m .get}[/api/v1/accounts/:id/dns/:domain]{.ep-path}[Get zone
records]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/dns/:domain/records]{.ep-path}[Add
record]{.ep-note}
:::

::: ep
[PUT]{.m
.put}[/api/v1/accounts/:id/dns/:domain/records/:rid]{.ep-path}[Update
record]{.ep-note}
:::

::: ep
[DELETE]{.m
.del}[/api/v1/accounts/:id/dns/:domain/records/:rid]{.ep-path}[Delete
record]{.ep-note}
:::

#### Email

::: ep
[GET]{.m .get}[/api/v1/accounts/:id/email/accounts]{.ep-path}[List
mailboxes]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/email/accounts]{.ep-path}[Create
mailbox]{.ep-note}
:::

::: ep
[DELETE]{.m
.del}[/api/v1/accounts/:id/email/accounts/:email]{.ep-path}[Delete
mailbox]{.ep-note}
:::

::: ep
[GET]{.m .get}[/api/v1/accounts/:id/email/forwarders]{.ep-path}[List
forwarders]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/email/forwarders]{.ep-path}[Create
forwarder]{.ep-note}
:::

#### Databases

::: ep
[GET]{.m .get}[/api/v1/accounts/:id/mysql/databases]{.ep-path}[List
databases]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/mysql/databases]{.ep-path}[Create
database]{.ep-note}
:::

::: ep
[DELETE]{.m
.del}[/api/v1/accounts/:id/mysql/databases/:db]{.ep-path}[Drop
database]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/mysql/users]{.ep-path}[Create
MySQL user]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/mysql/assign]{.ep-path}[Grant user
to database]{.ep-note}
:::

#### Files, FTP, SSL

::: ep
[GET]{.m .get}[/api/v1/accounts/:id/files]{.ep-path}[List directory
(query: path)]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/files/upload]{.ep-path}[Multipart
file upload]{.ep-note}
:::

::: ep
[DELETE]{.m .del}[/api/v1/accounts/:id/files]{.ep-path}[Delete file/dir
(body: path)]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/ftp]{.ep-path}[Create FTP
account]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/ssl/letsencrypt]{.ep-path}[Issue
Let\'s Encrypt cert]{.ep-note}
:::

::: ep
[POST]{.m .post}[/api/v1/accounts/:id/ssl/custom]{.ep-path}[Install
custom cert/key]{.ep-note}
:::

### WHMCS-Compatible Endpoint

WHMCS talks to cPanel via its API2/UAPI. To receive provisioning calls
from WHMCS, implement these three endpoints that map to WHMCS\'s
\"cPanel\" module actions:

``` ts
// WHMCS sends these requests to your panel's API
// POST /whm/createacct   → create account
// POST /whm/suspendacct  → suspend
// POST /whm/unsuspendacct→ unsuspend
// POST /whm/terminateacct→ terminate
// GET  /whm/accountsummary?user={username} → usage stats

// Authentication: WHMCS uses HTTP Basic Auth with WHM root credentials
// Your panel validates these against an API key stored in the DB
```

:::

------------------------------------------------------------------------

::: {#s17 .section .section}
::: sec-hdr
[§ 17]{.sec-num}

## Security Layer

:::

::: grid2
::: {.card .red-l}

##### Command injection prevention

Never interpolate user input directly into shell commands. Use
parameterised `execFile` or validate all inputs against strict
allowlists before shell use.
:::

::: {.card .red-l}

##### Path traversal prevention

All filesystem operations go through `resolveSafe()`. Resolved paths are
checked to start with the account\'s home dir before any
read/write/delete.
:::

::: {.card .gold-l}

##### Privilege separation

API server runs as an unprivileged user. Commands that need root are
dispatched to a separate `privileged-worker` process via Unix socket
with a strict allowlist of permitted operations.
:::

::: {.card .gold-l}

##### Rate limiting

Login: 5 attempts / 15 min per IP. API: 300 req/min per account. File
upload: 50 req/min. SSL issue: 5 req/hour (Let\'s Encrypt rate limits).
:::
:::

### Privileged Worker Pattern

``` ts
// privileged-worker.ts — runs as root, listens on Unix socket
// API server sends signed commands via this socket only
const ALLOWED_COMMANDS = [
  'create_linux_user', 'delete_linux_user', 'set_quota',
  'write_nginx_vhost',  'reload_nginx', 'run_certbot',
  'create_ftp_user',   'set_php_version',
] as const;

socketServer.on('connection', (socket) => {
  socket.on('data', async (data) => {
    const { command, args, signature } = JSON.parse(data.toString());

    // Verify HMAC signature (API server signs with shared secret)
    if (!verifySignature(command, args, signature)) {
      socket.write(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }

    if (!ALLOWED_COMMANDS.includes(command)) {
      socket.write(JSON.stringify({ error: 'Command not allowed' }));
      return;
    }

    const result = await executeCommand(command, args);
    socket.write(JSON.stringify({ result }));
  });
});
```

### Account Isolation

::: {.call .info}
[OS-Level Isolation]{.call-lbl}

Each hosting account is a separate Linux user. PHP-FPM runs as that
user\'s UID via per-account pools. This means a PHP script in account A
cannot read files from account B, even if the script tries --- the
kernel enforces it. This is the most critical security property of a
multi-tenant hosting environment.
:::
:::

------------------------------------------------------------------------

::: {#s18 .section .section}
::: sec-hdr
[§ 18]{.sec-num}

## WHM --- The Reseller / Admin Layer

:::

WHM (Web Host Manager) is the admin panel that sits above cPanel. It\'s
where resellers create, manage, suspend, and terminate hosting accounts.
In your clone, this is a separate React app at port 2087, backed by the
same API with admin/reseller-scoped permissions.

### WHM Features to Implement

::: grid2
::: card

##### Account management

Create, list, search, suspend, terminate, change plan, change password
for any account in the reseller\'s pool.
:::

::: card

##### Package / plan management

Create plans (disk, bandwidth, email count limits). Assign plans to new
accounts. Upgrade/downgrade existing accounts.
:::

::: card

##### DNS cluster

View all zones on the server. Add/remove records globally. Manage
nameserver A records.
:::

::: card

##### Server health

CPU, RAM, disk usage. Apache/Nginx status. MySQL status. Per-account
bandwidth consumption. Top accounts by resource use.
:::

::: card

##### Reseller resource limits

Root sets limits per reseller: max accounts, max disk across all their
accounts, max bandwidth. Reseller cannot exceed these.
:::

::: card

##### WHMCS API token

Generate API keys for WHMCS integration. Revoke tokens. View API call
logs.
:::
:::

### Account Suspension Logic

``` ts
// services/AccountService.ts
async suspend(accountId: string, reason: string): Promise<void> {
  const account = await this.accountRepo.findById(accountId);

  // 1. Disable Nginx vhost (redirect to suspended page)
  await this.nginxService.writeVhostConfig(account.primaryDomain, account.username, '/var/www/suspended');

  // 2. Lock Linux user (prevents SSH/FTP login)
  await execAsync(`usermod -L ${account.username}`);

  // 3. Disable email delivery (Postfix sets account status filter)
  await this.db.emailAccounts.suspendByAccount(accountId);

  // 4. Update account status
  await this.accountRepo.update(accountId, { status: 'suspended', suspendedAt: new Date(), suspendReason: reason });

  // 5. Log event
  await this.db.accountLogs.create({ accountId, action: 'suspended', details: reason });
}

async unsuspend(accountId: string): Promise<void> {
  const account = await this.accountRepo.findById(accountId);
  await this.nginxService.writeVhostConfig(account.primaryDomain, account.username, `${account.homeDir}/public_html`);
  await execAsync(`usermod -U ${account.username}`);
  await this.db.emailAccounts.activateByAccount(accountId);
  await this.accountRepo.update(accountId, { status: 'active', suspendedAt: null, suspendReason: null });
}
```

:::

------------------------------------------------------------------------

::: {#s19 .section .section}
::: sec-hdr
[§ 19]{.sec-num}

## Full Tech Stack

:::

::: tw
  Layer                     Technology                      Why
  ------------------------- ------------------------------- -----------------------------------------------------------------------------------------------
  **Web server**            Nginx                           Per-vhost config, PHP-FPM proxying, reverse proxy for panel itself
  **PHP runtime**           PHP-FPM (8.1, 8.2, 8.3 pools)   Per-account pools for OS-level isolation
  **DNS server**            PowerDNS + MySQL backend        Programmatic zone management via DB; REST API available
  **Mail server**           Postfix + Dovecot               Industry standard; virtual mailbox via DB
  **FTP server**            ProFTPd                         Virtual user support; SQL auth; directory jail
  **SSL**                   Certbot (Let\'s Encrypt)        Free, automated, wildcard support
  **Database (app)**        MySQL 8                         Main application data store --- also used by PowerDNS, Postfix, Dovecot, and ProFTPd backends
  **Database (accounts)**   MySQL 8 (separate schema)       Hosting account databases --- isolated schema prefix per account (`{username}_`)
  **Cache / queue**         Redis 7                         Sessions, BullMQ backend, rate limit counters
  **Job queue**             BullMQ                          Async provisioning, backups, SSL renewal
  **API backend**           Node.js 20 + Fastify            High I/O throughput for file operations
  **Frontend**              React 18 + Vite                 Fast builds; component-driven dashboard UI
  **UI components**         shadcn/ui + Tailwind            Accessible, unstyled base; full customisation
  **File manager**          Custom React + REST             No iframe dependencies; full control over UX
  **Webmail**               Roundcube (iframe embed)        Proven, full-featured; not worth rebuilding
  **phpMyAdmin**            phpMyAdmin + SSO token          DB management; SSO avoids separate login
  **Containerisation**      Docker + Docker Compose         Dev environment; optional production deployment
  **OS**                    Ubuntu 22.04 LTS                Best package support for all daemons above
:::
:::

------------------------------------------------------------------------

::: {#s20 .section .section}
::: sec-hdr
[§ 20]{.sec-num}

## Implementation Roadmap

:::

::: phase
::: ph
::: ph-label
Phase 1
:::

::: ph-title
Server Foundation
:::

::: ph-days
Days 1--14
:::
:::

::: ph
::: ph-label
Phase 2
:::

::: ph-title
Core Modules
:::

::: ph-days
Days 15--35
:::
:::

::: ph
::: ph-label
Phase 3
:::

::: ph-title
Client UI
:::

::: ph-days
Days 36--50
:::
:::

::: ph
::: ph-label
Phase 4
:::

::: ph-title
WHM + WHMCS
:::

::: ph-days
Days 51--65
:::
:::

::: ph
::: ph-label
Phase 5
:::

::: ph-title
Hardening
:::

::: ph-days
Days 66--80
:::
:::
:::

### Phase 1 --- Server Foundation (Days 1--14)

::: steps
::: step
::: sn
1
:::

::: sc

##### Server setup script

Automated bash script to install Nginx, PHP-FPM (8.1/8.2/8.3), PowerDNS,
Postfix, Dovecot, ProFTPd, MySQL 8, Redis on a fresh Ubuntu 22.04
server. Idempotent --- safe to re-run.
:::
:::

::: step
::: sn
2
:::

::: sc

##### Database schema + migrations

All MySQL tables from §15. Use `db-migrate` or Prisma with the MySQL
provider. Seed default server record, default plans
(Starter/Business/Pro), admin user.
:::
:::

::: step
::: sn
3
:::

::: sc

##### API skeleton

Fastify app with JWT auth, RBAC middleware, Zod validation, error
handler, health endpoint. Project structure: domain → application →
infrastructure → presentation.
:::
:::

::: step
::: sn
4
:::

::: sc

##### AccountService + provisioning job

Create Linux user, set quota, write Nginx vhost, create DNS zone, create
MySQL user, create ProFTPd virtual user. BullMQ worker with idempotency
checks.
:::
:::

::: step
::: sn
5
:::

::: sc

##### Privileged worker

Unix socket server running as root. Strict command allowlist.
HMAC-signed commands from API. All root operations go through here ---
never the API process itself.
:::
:::
:::

### Phase 2 --- Core Modules (Days 15--35)

::: steps
::: step
::: sn
6
:::

::: sc

##### DNS module

Full CRUD for DNS records via PowerDNS API. Zone creation on account
provision. Ownership validation on record operations.
:::
:::

::: step
::: sn
7
:::

::: sc

##### Email module

Create/delete mailboxes (Postfix + Dovecot virtual users). Forwarders.
Autoresponders. Spam filter toggle. DKIM key generation per domain.
:::
:::

::: step
::: sn
8
:::

::: sc

##### Database module

Create/drop MySQL databases and users. Assign privileges. phpMyAdmin SSO
integration.
:::
:::

::: step
::: sn
9
:::

::: sc

##### File manager API

List, upload, download, edit, delete, rename, chmod, compress, extract.
Path traversal protection. Zip slip protection on extract.
:::
:::

::: step
::: sn
10
:::

::: sc

##### SSL module

Let\'s Encrypt issuance via Certbot. Custom cert upload. Daily renewal
cron. Nginx vhost SSL config update.
:::
:::

::: step
::: sn
11
:::

::: sc

##### FTP module

Create/delete/modify ProFTPd virtual users. Directory scoping. Quota
setting.
:::
:::

::: step
::: sn
12
:::

::: sc

##### Domain / subdomain module

Addon domains, parked domains, subdomains, redirects. Each
creates/removes Nginx vhost config.
:::
:::

::: step
::: sn
13
:::

::: sc

##### Cron jobs

Read/write per-account crontab using `crontab -u {username}`. Validate
cron expression. Limit count per plan.
:::
:::
:::

### Phase 3 --- Client UI (Days 36--50)

::: steps
::: step
::: sn
14
:::

::: sc

##### cPanel dashboard (React)

Module icon grid. Usage summary (disk, bandwidth, email count). Quick
stats. Responsive layout.
:::
:::

::: step
::: sn
15
:::

::: sc

##### File manager UI

Breadcrumb path, directory tree, file list, drag-and-drop upload, inline
editor (CodeMirror), context menu (copy/paste/delete/chmod).
:::
:::

::: step
::: sn
16
:::

::: sc

##### Email management UI

Mailbox list + create form. Forwarder management. Password change. Quota
usage bar per mailbox.
:::
:::

::: step
::: sn
17
:::

::: sc

##### DNS zone editor UI

Records table with inline edit. Record type selector with type-specific
field validation. TTL picker.
:::
:::

::: step
::: sn
18
:::

::: sc

##### Remaining module UIs

MySQL (DB list + user list + assign matrix). FTP (account list +
create). SSL (cert status + issue/upload forms). Subdomains/addon
domains. Cron jobs.
:::
:::
:::

### Phase 4 --- WHM + WHMCS Integration (Days 51--65)

::: steps
::: step
::: sn
19
:::

::: sc

##### WHM admin UI

Account list with filters. Create account form.
Suspend/unsuspend/terminate actions. Plan management. Server stats
dashboard.
:::
:::

::: step
::: sn
20
:::

::: sc

##### WHMCS-compatible API endpoints

Implement the WHM API1/API2 subset that WHMCS calls for provisioning,
suspension, termination, and usage queries. WHMCS can then use your
panel out of the box.
:::
:::

::: step
::: sn
21
:::

::: sc

##### Reseller system

Resource quota inheritance (root → reseller → account). Reseller-scoped
WHM UI. Reseller API keys.
:::
:::
:::

### Phase 5 --- Hardening (Days 66--80)

::: steps
::: step
::: sn
22
:::

::: sc

##### Security audit

Pen test all file manager paths. Verify privilege separation. Test SQL
injection on all DB-facing endpoints. Rate limiting verification.
:::
:::

::: step
::: sn
23
:::

::: sc

##### Monitoring + alerting

Server metrics (CPU, RAM, disk) stored in MySQL every 5 min. Alerts on
disk \>90%, MySQL down, Nginx down. Email alerts to admin.
:::
:::

::: step
::: sn
24
:::

::: sc

##### Backup system

Full account backup (homedir + DBs) to S3. Configurable retention
(7/14/30 days). Restore flow. Backup status UI.
:::
:::

::: step
::: sn
25
:::

::: sc

##### Bandwidth tracking

Daily Nginx log parser job. Per-account MB aggregation into
`bandwidth_logs`. Overage alerts. Auto-suspend option on overage.
:::
:::
:::
:::

------------------------------------------------------------------------

::: {#s21 .section .section}
::: sec-hdr
[§ 21]{.sec-num}

## WHMCS Integration

:::

Your cPanel clone must integrate with WHMCS (your billing platform) so
that when a client purchases a hosting plan, WHMCS automatically calls
your panel\'s API to provision the account --- no manual admin action
required.

### Integration Architecture

::: dia
::: mermaid
sequenceDiagram participant Client as Client participant WHMCS as WHMCS
participant Panel as Your cPanel Clone participant Server as Linux
Server Client-\>\>WHMCS: Pays for hosting plan WHMCS-\>\>WHMCS: Invoice
marked paid WHMCS-\>\>Panel: POST /whm/createacct (username, domain,
plan, password) Panel-\>\>Panel: Validate API key Panel-\>\>Server:
Queue provisioning job Server\--\>\>Panel: Account created (async
callback) Panel\--\>\>WHMCS: 200 OK {result: success} WHMCS-\>\>Client:
Welcome email with cPanel login URL Note over WHMCS,Panel: On
termination WHMCS-\>\>Panel: POST /whm/terminateacct Panel-\>\>Server:
Delete Linux user, remove vhosts, drop DBs Panel\--\>\>WHMCS: 200 OK
:::
:::

### WHMCS Module Configuration

In WHMCS, you configure your panel as a \"cPanel\" server under Setup →
Products/Services → Servers. WHMCS needs:

::: tw
  WHMCS Setting             Your Value
  ------------------------- ----------------------------------
  Server Type               cPanel (built-in WHMCS module)
  Hostname                  Your panel\'s domain or IP
  Port                      2087 (WHM port)
  Access Hash / API Token   API key generated in your WHM UI
  Use SSL                   Yes
:::

### WHM API Endpoint Implementation

``` ts
// routers/whm.router.ts
// These endpoints mimic cPanel's WHM API1 so WHMCS works without modification

router.post('/json-api/createacct', whmAuth, async (req, res) => {
  const { username, domain, password, plan, contactemail } = req.body;

  try {
    const job = await accountService.createAccount({
      username, primaryDomain: domain, password,
      email: contactemail, planName: plan,
    });

    return res.json({
      result: [{
        status: 1,
        statusmsg: 'Account Creation OK',
        options: { ip: serverIp, nameserver: 'ns1.yourserver.com', uid: job.systemUid }
      }]
    });
  } catch (err) {
    return res.json({ result: [{ status: 0, statusmsg: err.message }] });
  }
});

router.post('/json-api/suspendacct', whmAuth, async (req, res) => {
  const { user, reason } = req.body;
  await accountService.suspendByUsername(user, reason);
  res.json({ result: [{ status: 1, statusmsg: 'Account Suspended' }] });
});

router.post('/json-api/terminateacct', whmAuth, async (req, res) => {
  const { user } = req.body;
  await accountService.terminateByUsername(user);
  res.json({ result: [{ status: 1, statusmsg: 'Account Termination Complete' }] });
});

router.get('/json-api/accountsummary', whmAuth, async (req, res) => {
  const { user } = req.query;
  const account = await accountService.findByUsername(user as string);
  const usage   = await quotaService.getSummary(account.id);
  res.json({ acct: [{ user, domain: account.primaryDomain, ...usage }] });
});
```

::: {.call .tip}
[Integration Shortcut]{.call-lbl}

Since your WHMCS billing platform (from the Quotations module work)
already runs on Node.js + MySQL, you can add a native integration
instead of using the WHM API compatibility layer. Have WHMCS call your
panel\'s REST API directly with your own auth scheme --- no legacy XML
parsing needed. This is cleaner and more maintainable.
:::

### Project Structure Summary

``` text
cpanel-clone/
├── packages/
│   ├── api/                  # Fastify API server
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── accounts/
│   │   │   │   ├── dns/
│   │   │   │   ├── email/
│   │   │   │   ├── databases/
│   │   │   │   ├── files/
│   │   │   │   ├── ftp/
│   │   │   │   ├── ssl/
│   │   │   │   └── backups/
│   │   │   ├── infrastructure/
│   │   │   │   ├── nginx/       # NginxService
│   │   │   │   ├── powerdns/    # DnsService
│   │   │   │   ├── postfix/     # EmailService (SMTP)
│   │   │   │   ├── dovecot/     # EmailService (IMAP)
│   │   │   │   └── proftpd/     # FtpService
│   │   │   ├── jobs/            # BullMQ workers
│   │   │   ├── privileged/      # Root-privileged socket worker
│   │   │   └── routers/         # REST routes + WHM compat
│   │   └── package.json
│   ├── cpanel-ui/            # React cPanel dashboard (port 2083)
│   ├── whm-ui/               # React WHM dashboard (port 2087)
│   └── webmail-ui/           # Roundcube embed wrapper (port 2096)
├── scripts/
│   ├── server-setup.sh       # Fresh server provisioning
│   └── create-account.sh     # Manual account creation helper
├── nginx/
│   └── panel.conf            # Panel's own Nginx config
├── docker-compose.dev.yml    # Dev environment
└── package.json              # Monorepo root (pnpm workspaces)
```

::: {style="height:2rem"}
:::
:::
:::
:::
