# cPanel Clone Implementation Plan

## Goal Description

Build a production-grade cPanel clone (Linux web hosting control panel) using Node.js, TypeScript, MySQL, Fastify, and React. The system provisions and manages real Linux daemons (Nginx, PowerDNS, Postfix, Dovecot, ProFTPd) via an unprivileged API and a secure `privileged-worker` running as root.

> [!IMPORTANT]
> The entire stack is based on **MySQL 8** (no other DBs), **TypeScript**, and **never runs the API server as root**.

## Proposed Changes

We will strictly follow the 5-phase build order dictated by the requirements.

### Phase 1: Foundation

Setup the monorepo and initial core architecture.

- [NEW] `pnpm-workspace.yaml`, `package.json`, `tsconfig.json` (root)
- [NEW] `.env.example` with all configuration requirements
- [NEW] `docker-compose.dev.yml` for MySQL and Redis
- [NEW] `scripts/server-setup.sh` (Ubuntu 22.04 bootstrap)
- [NEW] `packages/shared/` containing shared TypeScript types and utils
- [NEW] `packages/api/src/db/connection.ts` and `migrations/*.sql`
- [NEW] `packages/api/src/privileged/worker.ts` with HMAC signature verification
- [NEW] `packages/api/app.ts` (Fastify skeleton) and `middleware/` (auth, RBAC)
- [NEW] `packages/api/src/domain/accounts/AccountService.ts` (provisioning logic)
- [NEW] `packages/api/src/jobs/provision.job.ts` (BullMQ)

### Phase 2: Core Services

Implement the daemon integration layers.

- [NEW] `packages/api/src/infrastructure/powerdns/DnsService.ts`
- [NEW] `packages/api/src/infrastructure/nginx/NginxService.ts`
- [NEW] `packages/api/src/infrastructure/postfix/EmailService.ts`
- [NEW] `packages/api/src/infrastructure/dovecot/EmailService.ts` (combined or split depending on layout)
- [NEW] `packages/api/src/domain/databases/DatabaseService.ts`
- [NEW] `packages/api/src/domain/files/FileService.ts`
- [NEW] `packages/api/src/infrastructure/certbot/SslService.ts`
- [NEW] `packages/api/src/infrastructure/proftpd/FtpService.ts`
- [NEW] `packages/api/src/domain/domains/DomainService.ts`
- [NEW] `packages/api/src/domain/cron/CronService.ts`
- [NEW] `packages/api/src/domain/backups/BackupService.ts`
- [NEW] `packages/api/src/domain/quotas/QuotaService.ts`

### Phase 3: API Routes

Wire services to Fastify routers with Zod validation.

- [NEW] `packages/api/src/routers/accounts.router.ts`
- [NEW] `packages/api/src/routers/dns.router.ts`
- [NEW] `packages/api/src/routers/email.router.ts`
- [NEW] `packages/api/src/routers/databases.router.ts`
- [NEW] `packages/api/src/routers/files.router.ts`
- [NEW] `packages/api/src/routers/ftp.router.ts`
- [NEW] `packages/api/src/routers/ssl.router.ts`
- [NEW] `packages/api/src/routers/domains.router.ts`
- [NEW] `packages/api/src/routers/cron.router.ts`
- [NEW] `packages/api/src/routers/backups.router.ts`
- [NEW] `packages/api/src/routers/whm.router.ts`

### Phase 4: Frontend

React 18 + Vite 5 dashboards.

- [NEW] `packages/cpanel-ui/` (Client dashboard on port 2083)
- [NEW] `packages/whm-ui/` (Admin/Reseller dashboard on port 2087)

### Phase 5: Jobs & Automation

- [NEW] `packages/api/src/jobs/ssl-renew.job.ts`
- [NEW] `packages/api/src/jobs/quota-check.job.ts`
- [NEW] `packages/api/src/jobs/bandwidth-parse.job.ts`

## Verification Plan

### Automated Tests

- Write unit tests for `resolveSafe()` path resolution to prevent traversal.
- Write tests for `QuotaService`, `DnsService.assertOwnership()`, and `signCommand()`.
- Run migrations against local MySQL via Docker.

### Manual Verification

- Deploy `docker-compose.dev.yml` to ensure MySQL and Redis start correctly.
- Test the `privileged-worker` locally by mocking signed commands.
- Verify user provisioning flow end-to-end via the API (using Insomnia/Postman).
