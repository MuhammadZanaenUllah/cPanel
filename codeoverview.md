# cPanel Clone - Project Overview & Code Architecture

This document provides a comprehensive overview of the cPanel Jupiter-themed clone, detailing the active feature list, client-side structure, backend routes, database schemas, and developer testing patterns.

---

## 🎯 Project Overview

The **cPanel Clone** is a state-of-the-art web hosting administration panel replicating the industry-standard **cPanel "Jupiter" theme**. Unlike standard visual templates, this project is a **fully functional, interactive production system** that interfaces directly with local operating system configurations, mail daemons, let's encrypt client scripts, and MySQL database servers via a secure Fastify API gateway.

### Key Highlights
- **Corporate Visual Fidelity**: Clean layout structures featuring `#ffffff` widgets, collapsible control lists, dynamic search filtering, an indigo (`#1a2b4c`) navigation sidebar, and custom line-art vector SVGs (replacing childhood emojis) to preserve a premium corporate interface.
- **Seamless Local Portability**: Engineered to auto-detect the operating system context. Uses fully operational safe path bounding (`resolveSafe()`) on Linux paths (`/home/{user}`) with automated fallbacks to localized staging directories (`mock_home/`) on macOS development environments.
- **Security-First Architecture**: Features strict path-traversal protections on the file system, bounded shell terminals restricting commands to a secure whitelist, and robust token-based JWT authentication syncing client sessions with backend host instances.

---

## 🛠️ Architecture Stack

The project is structured as a monorepo containing three core packages:
1. **`packages/frontend`**: A fast Vite + React client application replicating the premium, modern, and corporate **cPanel "Jupiter" theme** (indigo `#1a2b4c` sidebar, white content containers, orange line-art accent icons).
2. **`packages/api`**: A Fastify server running on port `3000` connected to a MySQL/MariaDB database, providing authentic cPanel features, secure local file-system bindings, and command orchestration.
3. **`packages/shared`**: Shared utilities, validators, and paths supporting standard schemas.

---

## 🚀 Active Feature List & Implementation Details

All dashboard visual panels have been fully connected to live SQL backend records and local UNIX/macos system executors:

### 1. File Manager
- **Interface**: A comprehensive directory explorer representing `/home/{user}/public_html`.
- **Functionality**:
  - Live folder hierarchy navigation (Up One Level, deep traversal).
  - Create new files (`POST /cpanel/files/create`) and directories.
  - Delete files/folders (`POST /cpanel/files/delete`) recursively with safe path resolution checks to block directory traversal attacks.
  - Live in-browser File Editor supporting text edits and real-time saves (`POST /cpanel/files/write`).

### 2. Live SSH Terminal
- **Interface**: A monospaced terminal shell emulator matching the official SSH Web Access layout.
- **Functionality**: Fully interactive terminal execution supporting standard commands (`ls`, `pwd`, `whoami`, `uptime`, `df`, `cat`, etc.) dynamically mapped to child process executions in the server host via a safe whitelist framework (`POST /cpanel/terminal/execute`).

### 3. Email accounts & Forwarders
- **Interface**: Unified mail creation block and forwarder list.
- **Functionality**:
  - **Email Accounts**: Live account provisioning (`POST /cpanel/mail`) linking dynamically to the selected domain and setting custom disk quotas.
  - **Forwarders**: Add and remove dynamic mail redirection routes (`POST /cpanel/mail/forwarders` and `DELETE /cpanel/mail/forwarders/:id`).

### 4. Email Routing & Autoresponders (NEW)
- **Interface**: Highly custom corporate forms.
- **Functionality**:
  - **Email Routing**: Set active exchangers (Local, Backup, or Remote Mail Exchanger) dynamically for any registered domain (`POST /cpanel/mail/routing`).
  - **Autoresponders**: Provision automatic out-of-office message templates (subject, from-name, interval hours, automated body templates) linked to live SQL tables.

### 5. Domains & Redirects Manager
- **Interface**: Dedicated virtual host registers.
- **Functionality**:
  - **Domains**: Add dynamic Addon Domains and map them to custom doc roots, automatically generating virtual Nginx host templates (`POST /cpanel/domains`).
  - **Redirects**: Configure Permanent (301) or Temporary (302) HTTP redirection targets on any active domain, complete with safe delete hooks.

### 6. SSL/TLS Let's Encrypt Provisioner
- **Interface**: Domain SSL certificates registry.
- **Functionality**: List active Let's Encrypt certificate states, trigger secure Let's Encrypt challenges on Nginx server configurations, and issue certificates in real-time (`POST /cpanel/ssl/issue`).

### 7. MySQL Databases & FTP Accounts
- **Interface**: Dynamic user provisioning panels.
- **Functionality**: Provision and list database instances (names prefix-bounded to current user) and FTP server credentials securely connected to Fastify controllers.

### 8. System Metrics & Graphic Explorers (NEW)
- **Interface**: Premium graphic charts and monospaced log tables.
- **Functionality**:
  - **Disk Usage**: Real-time folder size calculators displaying visual percentage progress bars (`public_html`, mail, backups, database instances).
  - **Visitors Access Logs**: Table view parsing virtual host log data (client IP, hit time, request paths, HTTP response sizes, status codes, referrers, and user agents).
  - **Bandwidth utilization**: Responsive monthly SVG area charts illustrating bandwidth utilization trends for HTTP, FTP, and Mail protocols.

### 9. Image scaling Tools (NEW)
- **Interface**: Graphic utilities modal.
- **Functionality**: Scans the workspace recursively for image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`). Allows input of custom pixel bounds to rescale the images and generate resized duplications inside the target folder path.

---

## 🗄️ Database Tables (`knex_migrations`)

All core tables are fully bootstrapped inside the MySQL repository:
- `accounts`: Web Hosting accounts (seeds with local developer `testuser` account).
- `domains`: Domain records tracking types (`primary`, `addon`, `redirect`) and Nginx routes.
- `dns_records`: DNS records (A, AAAA, MX, CNAME, TXT) mapped to local servers.
- `email_accounts` & `email_forwarders`: Dovecot/Postfix transport paths.
- `email_routing` (dynamic): Tracks MX exchanger routing policy ('local', 'backup', 'remote').
- `email_autoresponders` (dynamic): Out-of-office automated templates.
- `mysql_databases` & `mysql_users`: Database access parameters.
- `ftp_accounts`: FTP virtual users.
- `ssl_certificates`: Let's Encrypt AutoSSL storage details.

---

## 📁 Source Code Directory Map

```bash
cPanel_clone/
├── packages/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx       # Core React Application (Modals, Icons, Dashboards, SVG Charts)
│   │   │   ├── App.css       # Premium corporate Jupiter theme stylesheet
│   │   │   └── main.tsx
│   │   └── package.json
│   ├── api/
│   │   ├── app.ts            # Fastify App builder, dynamic schema bootsrapper
│   │   ├── knexfile.ts       # Database access setup
│   │   ├── server.ts         # Fastify bootloader
│   │   ├── src/
│   │   │   ├── db/           # knex migrations & seeds
│   │   │   ├── services/     # Nginx, PowerDNS, and Mail shell wrappers
│   │   │   └── routes/       # API Routes (domains, mail, metrics, files, ssl)
│   │   └── package.json
│   └── shared/               # Shared path resolvers and type guards
├── package.json
├── pnpm-workspace.yaml
└── codeoverview.md           # This architecture summary document
```

---

## 🚀 Running the Project locally

1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Start Dev servers**:
   ```bash
   pnpm dev
   ```
   *The client app will launch at `http://localhost:5173`, and the live SQL API will run at `http://localhost:3000`.*
