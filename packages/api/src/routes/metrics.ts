import { FastifyInstance } from 'fastify';
import { db, dbAdmin } from '../db/connection';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

async function cpanelAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin') {
      request.accountId = request.user.id;
    } else {
      request.accountId = request.query.accountId || request.body?.accountId || request.user.id;
    }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stats.size;
      }
    }
  } catch (e) {}
  return size;
}

function scanImagesRecursive(dir: string, baseDir: string): any[] {
  let results: any[] = [];
  try {
    if (!fs.existsSync(dir)) return [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(scanImagesRecursive(fullPath, baseDir));
      } else {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) {
          results.push({
            name: file,
            relPath: path.relative(baseDir, fullPath),
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString()
          });
        }
      }
    }
  } catch (e) {}
  return results;
}

// Months nginx uses in its log timestamp (e.g. "10/Oct/2000:13:55:36 -0700")
const NGINX_MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

function parseNginxDate(s: string): string {
  // "10/Oct/2000:13:55:36 -0700"
  try {
    const match = s.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})/);
    if (!match) return new Date().toISOString();
    const [, day, mon, year, time] = match;
    return `${year}-${NGINX_MONTHS[mon] || '01'}-${day}T${time}.000Z`;
  } catch {
    return new Date().toISOString();
  }
}

function nginxDateToMonthKey(datePart: string): string | null {
  // "10/Oct/2000" or from the timestamp "10/Oct/2000:13:55:36 -0700"
  const match = datePart.match(/(\d{2})\/(\w{3})\/(\d{4})/);
  if (!match) return null;
  const [, , mon, year] = match;
  return `${year}-${NGINX_MONTHS[mon] || '01'}`;
}

function getLogPath(account: any): string {
  const isLinux = process.platform === 'linux';
  if (isLinux) {
    const domainLog = `/var/log/nginx/${account.primary_domain}.access.log`;
    if (fs.existsSync(domainLog)) return domainLog;
    if (fs.existsSync('/var/log/nginx/access.log')) return '/var/log/nginx/access.log';
    return '';
  }
  // macOS dev: mock_home/{username}/logs/access.log
  const mockHome = path.resolve(__dirname, '../../mock_home');
  const logDir = path.join(mockHome, account.username, 'logs');
  const logFile = path.join(logDir, 'access.log');
  if (!fs.existsSync(logFile)) {
    fs.mkdirSync(logDir, { recursive: true });
    // Seed with realistic sample entries so dev environment shows real-looking data
    const domain = account.primary_domain || 'localhost';
    const now = Date.now();
    const sampleLines = [
      `66.249.66.15 - - [${fmtNginxDate(new Date(now - 60000))}] "GET /index.html HTTP/1.1" 200 4502 "-" "Googlebot/2.1 (+http://www.google.com/bot.html)"`,
      `157.55.39.18 - - [${fmtNginxDate(new Date(now - 180000))}] "POST /wp-login.php HTTP/1.1" 404 1245 "-" "Bingbot/2.0"`,
      `198.51.100.42 - - [${fmtNginxDate(new Date(now - 360000))}] "GET /assets/app.js HTTP/1.1" 200 250910 "https://${domain}/" "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0"`,
      `203.0.113.88 - - [${fmtNginxDate(new Date(now - 720000))}] "GET /api/users HTTP/1.1" 401 45 "https://${domain}/dashboard" "Mozilla/5.0 (Macintosh) Safari/605.1"`,
      `198.51.100.42 - - [${fmtNginxDate(new Date(now - 1200000))}] "GET /favicon.ico HTTP/1.1" 304 0 "https://${domain}/" "Mozilla/5.0 Chrome/120.0"`,
      `45.33.32.156 - - [${fmtNginxDate(new Date(now - 3600000))}] "GET /about HTTP/1.1" 200 8120 "-" "curl/7.88.1"`,
      `93.184.216.34 - - [${fmtNginxDate(new Date(now - 7200000))}] "GET /contact HTTP/1.1" 200 6340 "https://google.com/" "Mozilla/5.0 Firefox/121.0"`,
      `172.217.14.206 - - [${fmtNginxDate(new Date(now - 86400000))}] "GET / HTTP/1.1" 200 12048 "-" "Mozilla/5.0 Chrome/119.0"`,
      `140.82.112.3 - - [${fmtNginxDate(new Date(now - 172800000))}] "GET /images/logo.png HTTP/1.1" 200 34521 "https://${domain}/" "Mozilla/5.0 Safari/537.36"`,
      `104.21.0.1 - - [${fmtNginxDate(new Date(now - 259200000))}] "GET /sitemap.xml HTTP/1.1" 200 2048 "-" "Googlebot/2.1"`,
    ];
    fs.writeFileSync(logFile, sampleLines.join('\n') + '\n');
  }
  return logFile;
}

function fmtNginxDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mon = months[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${dd}/${mon}/${yyyy}:${hh}:${mm}:${ss} +0000`;
}

const COMBINED_LOG_RE = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^ "]+)[^"]*" (\d+) (\d+|-) "([^"]*)" "([^"]*)"/;

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // 1. Disk Usage stats
  fastify.get('/metrics/disk-usage', async (request: any) => {
    const account = await db('accounts').where({ id: request.accountId }).first();
    if (!account) return { error: 'Account not found' };

    const homeDir = account.home_dir;

    const publicHtmlSize = getDirSize(path.join(homeDir, 'public_html'));
    const mailSize = getDirSize(path.join(homeDir, 'mail'));
    const backupsSize = getDirSize(path.join(homeDir, 'backups'));
    const tmpSize = getDirSize(path.join(homeDir, 'tmp'));

    // Real MySQL database sizes from information_schema
    let dbRealSize = 0;
    try {
      const dbRows = await db('mysql_databases').where({ account_id: request.accountId });
      if (dbRows.length > 0) {
        const dbNames = dbRows.map((r: any) => r.db_name);
        const placeholders = dbNames.map(() => '?').join(',');
        const result = await dbAdmin.raw(
          `SELECT IFNULL(SUM(data_length + index_length), 0) AS total_size
           FROM information_schema.TABLES
           WHERE table_schema IN (${placeholders})`,
          dbNames
        );
        dbRealSize = Number(result[0]?.[0]?.total_size || 0);
      }
    } catch (e) {
      // information_schema query failed — leave at 0
    }

    const totalUsed = publicHtmlSize + mailSize + dbRealSize + backupsSize + tmpSize;

    return {
      totalBytes: totalUsed,
      breakdown: [
        { name: 'public_html', bytes: publicHtmlSize },
        { name: 'Email accounts', bytes: mailSize },
        { name: 'MySQL Databases', bytes: dbRealSize },
        { name: 'Backups', bytes: backupsSize },
        { name: 'System Temp & Logs', bytes: tmpSize }
      ]
    };
  });

  // 2. Visitors live logs — parsed from Nginx combined access log
  fastify.get('/metrics/visitors', async (request: any) => {
    const account = await db('accounts').where({ id: request.accountId }).first();
    if (!account) return [];

    const logPath = getLogPath(account);
    if (!logPath) return [];

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean).reverse();

    const entries: any[] = [];
    for (const line of lines) {
      const m = COMBINED_LOG_RE.exec(line);
      if (!m) continue;
      entries.push({
        ip: m[1],
        time: parseNginxDate(m[2]),
        method: m[3],
        path: m[4],
        status: parseInt(m[5]),
        size: m[6] === '-' ? 0 : parseInt(m[6]),
        referer: m[7] === '-' ? '' : m[7],
        ua: m[8]
      });
      if (entries.length >= 100) break;
    }

    return entries;
  });

  // 3. Bandwidth — aggregated from Nginx access log bytes per month
  fastify.get('/metrics/bandwidth', async (request: any) => {
    const account = await db('accounts').where({ id: request.accountId }).first();
    if (!account) return [];

    const logPath = getLogPath(account);
    const monthlyHttp: Record<string, number> = {};

    if (logPath && fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const byteRe = /^\S+ \S+ \S+ \[([^\]]+)\] "[^"]*" \d+ (\d+|-)/;
      for (const line of lines) {
        const m = byteRe.exec(line);
        if (!m) continue;
        const bytes = m[2] === '-' ? 0 : parseInt(m[2]);
        const key = nginxDateToMonthKey(m[1]);
        if (key) monthlyHttp[key] = (monthlyHttp[key] || 0) + bytes;
      }
    }

    // Return last 12 calendar months
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const httpMB = Math.round((monthlyHttp[key] || 0) / (1024 * 1024));
      return { month: `${months[d.getMonth()]} ${d.getFullYear()}`, http: httpMB, ftp: 0, mail: 0 };
    });
  });

  // 4. Image tools: list images in workspace
  fastify.get('/images/list', async (request: any) => {
    const account = await db('accounts').where({ id: request.accountId }).first();
    if (!account) return { error: 'Account not found' };

    const publicHtml = path.join(account.home_dir, 'public_html');
    const images = scanImagesRecursive(publicHtml, publicHtml);
    return { images };
  });

  // 5. Image tools: resize image using sharp
  fastify.post('/images/resize', async (request: any, reply) => {
    const { relPath, width, height } = request.body;
    const account = await db('accounts').where({ id: request.accountId }).first();
    if (!account) return reply.code(404).send({ error: 'Account not found' });

    const sourceFile = path.join(account.home_dir, 'public_html', relPath);
    if (!fs.existsSync(sourceFile) || sourceFile.includes('..')) {
      return reply.code(400).send({ error: 'Invalid file path' });
    }

    try {
      const ext = path.extname(sourceFile).toLowerCase();
      const base = path.basename(sourceFile, ext);
      const dir = path.dirname(sourceFile);
      const targetFile = path.join(dir, `${base}_scaled_${width}x${height}${ext}`);

      if (ext === '.svg') {
        // SVG is vector — copy as-is since sharp cannot resize SVGs to SVG
        fs.copyFileSync(sourceFile, targetFile);
      } else {
        await sharp(sourceFile)
          .resize(Number(width), Number(height), { fit: 'inside', withoutEnlargement: true })
          .toFile(targetFile);
      }

      return {
        success: true,
        message: `Image resized to ${width}×${height}. Created: ${path.basename(targetFile)}`,
        newFile: path.relative(path.join(account.home_dir, 'public_html'), targetFile)
      };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
