# cPanel Clone — Production Deployment Plan

## Overview

This document covers everything needed to take the cPanel Clone from a local
development environment to a live, multi-tenant hosting platform. Follow the
phases in order — skipping steps will leave security gaps or runtime failures.

---

## Phase 1 — Server Provisioning (Day 1–2)

### 1.1 Choose Your Server

- **Minimum specs:** 4 vCPU, 8 GB RAM, 100 GB SSD, Ubuntu 22.04 LTS
- **Recommended:** 8 vCPU, 16 GB RAM, 500 GB NVMe SSD
- Providers: Hetzner, DigitalOcean, Vultr, AWS EC2
- You need **one dedicated IP address** (shared hosting panel requirement)
- Ensure ports 80, 443, 2083, 2087, 21, 25, 465, 587, 993, 995 are reachable

### 1.2 Run the Server Setup Script

```bash
# As root on the fresh Ubuntu 22.04 server
bash /path/to/scripts/server-setup.sh
```

This script installs: Nginx, PHP-FPM (8.1/8.2/8.3), PowerDNS, Postfix,
Dovecot, ProFTPd, MySQL 8, Redis 7.

### 1.3 Create the Application System User

```bash
useradd -r -s /bin/false cpanel-api
mkdir -p /opt/cpanel-clone
chown cpanel-api:cpanel-api /opt/cpanel-clone
```

---

## Phase 2 — Database Setup (Day 2)

### 2.1 Create MySQL Databases and Users

```sql
-- Application database
CREATE DATABASE cpanel_clone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cpanel_app'@'127.0.0.1' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER
  ON cpanel_clone.* TO 'cpanel_app'@'127.0.0.1';

-- Admin connection (creates/drops hosting account databases)
CREATE USER 'cpanel_admin'@'127.0.0.1' IDENTIFIED BY 'STRONG_ADMIN_PASSWORD';
GRANT ALL PRIVILEGES ON *.* TO 'cpanel_admin'@'127.0.0.1' WITH GRANT OPTION;

FLUSH PRIVILEGES;
```

### 2.2 Run Migrations and Seeds

```bash
cd /opt/cpanel-clone/packages/api
NODE_ENV=production npx knex migrate:latest
NODE_ENV=production npx knex seed:run
```

The seed creates: default server record, three starter plans (Starter/Business/Pro),
and the root admin account.

### 2.3 PowerDNS MySQL Backend

```bash
# Create PowerDNS schema (already in scripts/init.sql)
mysql -u root < scripts/init.sql

# Create PowerDNS DB user
CREATE USER 'pdns'@'127.0.0.1' IDENTIFIED BY 'PDNS_PASSWORD';
GRANT SELECT ON powerdns.* TO 'pdns'@'127.0.0.1';
FLUSH PRIVILEGES;
```

---

## Phase 3 — Environment Configuration (Day 2–3)

Copy `packages/api/.env` to the server and fill in every value:

```env
NODE_ENV=production
PORT=3000

# Generate with: openssl rand -hex 64
JWT_SECRET=<64-char-random-hex-string>

# MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=cpanel_clone
DB_USER=cpanel_app
DB_PASSWORD=<strong-password>

DB_ADMIN_HOST=127.0.0.1
DB_ADMIN_PORT=3306
DB_ADMIN_USER=cpanel_admin
DB_ADMIN_PASSWORD=<strong-admin-password>

# Redis (set a password in /etc/redis/redis.conf requirepass)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>

# Privileged worker (generate with: openssl rand -hex 32)
PRIVILEGED_SOCKET=/var/run/cpanel-privileged.sock
PRIVILEGED_WORKER_SECRET=<32-char-random-hex>

# Server identity
SERVER_IP=<your-server-public-ip>
SERVER_HOSTNAME=panel.yourdomain.com
NAMESERVER_1=ns1.yourdomain.com
NAMESERVER_2=ns2.yourdomain.com

# PowerDNS
PDNS_DB_NAME=powerdns
PDNS_DB_USER=pdns
PDNS_DB_PASSWORD=<pdns-password>

# SSL auto-renewal
CERTBOT_EMAIL=admin@yourdomain.com

# Backups (use S3 or local)
BACKUP_STORAGE=s3
BACKUP_LOCAL_PATH=/var/backups/cpanel
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY=<aws-access-key>
S3_SECRET_KEY=<aws-secret-key>

# WHM API key (generate with: openssl rand -hex 32)
WHM_API_KEY=<32-char-random-hex>
```

**Security rules:**
- Never commit `.env` to git
- File permissions: `chmod 600 .env && chown cpanel-api .env`

---

## Phase 4 — Build and Deploy (Day 3)

### 4.1 Build All Packages

```bash
cd /opt/cpanel-clone
pnpm install --frozen-lockfile
pnpm build
```

This compiles:
- `packages/shared` → `dist/`
- `packages/api` → `dist/server.js`
- `packages/frontend` → `dist/` (static files)
- `packages/whm-ui` → `dist/` (static files)

### 4.2 Serve Frontend Static Files via Nginx

The React frontends are static files — Nginx serves them directly. Vite dev
server is **not** used in production.

```nginx
# /etc/nginx/sites-available/cpanel-panel.conf

# cPanel UI (port 2083)
server {
    listen 2083 ssl http2;
    server_name panel.yourdomain.com;
    root /opt/cpanel-clone/packages/frontend/dist;
    index index.html;

    ssl_certificate     /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem;

    location / { try_files $uri $uri/ /index.html; }

    # Proxy API calls from the frontend
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# WHM UI (port 2087)
server {
    listen 2087 ssl http2;
    server_name panel.yourdomain.com;
    root /opt/cpanel-clone/packages/whm-ui/dist;
    index index.html;

    ssl_certificate     /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem;

    location / { try_files $uri $uri/ /index.html; }

    location /whm/ {
        proxy_pass http://127.0.0.1:3000/whm/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4.3 API Process Manager (PM2)

```bash
npm install -g pm2

# Start API
pm2 start /opt/cpanel-clone/packages/api/dist/server.js \
  --name cpanel-api \
  --user cpanel-api \
  --env production

# Start privileged worker (must run as root for OS operations)
pm2 start /opt/cpanel-clone/packages/api/dist/src/privileged/worker.js \
  --name cpanel-privileged \
  --user root

# Save process list and enable auto-start on reboot
pm2 save
pm2 startup
```

**PM2 ecosystem file** (`/opt/cpanel-clone/ecosystem.config.js`):

```js
module.exports = {
  apps: [
    {
      name: 'cpanel-api',
      script: 'packages/api/dist/server.js',
      instances: 2,           // 2 workers for load balancing
      exec_mode: 'cluster',
      user: 'cpanel-api',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'cpanel-privileged',
      script: 'packages/api/dist/src/privileged/worker.js',
      instances: 1,
      user: 'root',           // MUST run as root
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

```bash
pm2 start ecosystem.config.js --env production
```

---

## Phase 5 — SSL for the Panel Itself (Day 3)

```bash
# Issue SSL for the panel domain
certbot certonly --nginx -d panel.yourdomain.com \
  --email admin@yourdomain.com --agree-tos --non-interactive

# Enable auto-renewal (already installed by certbot as a systemd timer)
systemctl status certbot.timer
```

---

## Phase 6 — DNS for the Panel (Day 3–4)

At your domain registrar, set these records for `yourdomain.com`:

| Record | Name | Value |
|--------|------|-------|
| A | `panel` | `<server-ip>` |
| A | `ns1` | `<server-ip>` |
| A | `ns2` | `<server-ip>` |
| NS | `yourdomain.com` | `ns1.yourdomain.com` |
| NS | `yourdomain.com` | `ns2.yourdomain.com` |

Then register `ns1.yourdomain.com` and `ns2.yourdomain.com` as glue records
with your registrar (required for a nameserver to resolve its own domain).

---

## Phase 7 — Security Hardening (Day 4–5)

### 7.1 Firewall (UFW)

```bash
ufw default deny incoming
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (certbot challenges)
ufw allow 443/tcp     # HTTPS
ufw allow 2083/tcp    # cPanel UI
ufw allow 2087/tcp    # WHM UI
ufw allow 2096/tcp    # Webmail (future)
ufw allow 21/tcp      # FTP
ufw allow 25/tcp      # SMTP
ufw allow 465/tcp     # SMTPS
ufw allow 587/tcp     # Submission
ufw allow 993/tcp     # IMAPS
ufw allow 995/tcp     # POP3S
ufw allow 53/tcp      # DNS
ufw allow 53/udp      # DNS
ufw enable
```

### 7.2 SSH Hardening

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no     # use SSH keys only
MaxAuthTries 3
```

### 7.3 Fail2Ban

```bash
apt install fail2ban
# Protects SSH, Postfix, Dovecot, and your API login endpoint
```

### 7.4 MySQL Hardening

```bash
mysql_secure_installation
# Remove anonymous users, test DB, disable remote root login
```

### 7.5 Rate Limiting in Nginx

```nginx
# Add to nginx.conf http block
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

# Apply to API location
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://127.0.0.1:3000/;
}
```

---

## Phase 8 — Monitoring (Day 5–6)

### 8.1 PM2 Monitoring

```bash
pm2 monit          # real-time CPU/RAM per process
pm2 logs           # tail all logs
pm2 status         # process health table
```

### 8.2 Log Rotation

```bash
# /etc/logrotate.d/cpanel-clone
/var/log/nginx/*.log /home/*/logs/*.log {
    daily
    rotate 14
    compress
    missingok
    sharedscripts
    postrotate
        nginx -s reopen
    endscript
}
```

### 8.3 Uptime Monitoring (External)

Use a free service like **UptimeRobot** or **Better Uptime** to ping:
- `https://panel.yourdomain.com/health` every 5 minutes
- Alert you by email/SMS if down

### 8.4 Disk Usage Alert

```bash
# Add to root's crontab
*/30 * * * * df -h / | awk 'NR==2{if($5+0>85) system("mail -s \"Disk Alert\" admin@yourdomain.com < /dev/null")}'
```

---

## Phase 9 — WHMCS Integration (Day 6–7)

In WHMCS admin → Setup → Servers → Add New Server:

| Field | Value |
|-------|-------|
| Server Type | cPanel (built-in WHMCS module) |
| Hostname | `panel.yourdomain.com` |
| Port | `2087` |
| Access Hash | value of `WHM_API_KEY` from `.env` |
| Use SSL | Yes |

WHMCS will then call your `/whm/json-api/createacct` endpoint automatically
when a client pays for a hosting plan.

---

## Phase 10 — Backup Strategy (Day 7)

### Account Backups
- The Backup Manager in cPanel UI creates full account backups (home dir + DBs)
- Configure S3 credentials in `.env` for off-server storage
- Set a daily cron in the provisioning system to back up all active accounts

### Panel Database Backup

```bash
# /etc/cron.daily/cpanel-db-backup
#!/bin/bash
mysqldump cpanel_clone | gzip > /var/backups/cpanel_clone_$(date +%Y%m%d).sql.gz
find /var/backups -name "cpanel_clone_*.sql.gz" -mtime +30 -delete
```

### Retention Policy
- Keep 7 daily backups on-server
- Push to S3 for 30-day retention
- Test restores monthly

---

## Go-Live Checklist

- [ ] Server setup script ran without errors
- [ ] MySQL databases, users, and grants created
- [ ] Migrations and seeds ran successfully
- [ ] All `.env` values filled in — no placeholder defaults remain
- [ ] `JWT_SECRET` is a random 64-char hex string (not the dev value)
- [ ] `WHM_API_KEY` is a random 32-char hex string
- [ ] `pnpm build` completed with no errors
- [ ] PM2 shows `cpanel-api` and `cpanel-privileged` as `online`
- [ ] Nginx config test passes: `nginx -t`
- [ ] SSL certificate issued for `panel.yourdomain.com`
- [ ] Firewall enabled with only necessary ports open
- [ ] SSH password auth disabled, key-only access confirmed
- [ ] `/dev-token` endpoint **disabled** in production (`NODE_ENV=production` guard)
- [ ] WHM API key works: `curl -H "x-whm-api-token: YOUR_KEY" https://panel.yourdomain.com:2087/whm/plans`
- [ ] Test account creation end-to-end from WHM UI
- [ ] External uptime monitor configured
- [ ] Daily database backup cron verified

---

## Important: Disable the Dev Token in Production

The `/dev-token` endpoint bypasses authentication and must be blocked in production.
Add this guard to `app.ts`:

```typescript
if (process.env.NODE_ENV !== 'production') {
  app.get('/dev-token', async () => { ... });
}
```

---

## Cost Estimate (Monthly)

| Item | Cost |
|------|------|
| VPS (Hetzner CX31, 8 vCPU / 16 GB) | ~$18/mo |
| S3 backup storage (100 GB) | ~$2/mo |
| Domain + glue records | ~$1/mo |
| SSL (Let's Encrypt) | Free |
| UptimeRobot monitoring | Free |
| **Total** | **~$21/mo** |
