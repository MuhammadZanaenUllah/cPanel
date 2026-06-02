import net from 'net';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);
import { verifySignature } from '@cpanel/shared';

const getSocketPath = () => process.env.PRIVILEGED_SOCKET || '/var/run/cpanel-privileged.sock';
const SECRET = process.env.PRIVILEGED_WORKER_SECRET || 'dev-secret'; // SHOULD BE OVERRIDDEN IN PROD

function verifyPayloadSignature(payload: any): boolean {
  if (!payload.signature || !payload.timestamp) return false;
  
  // Prevent replay attacks (5 minute window)
  if (Math.abs(Date.now() - payload.timestamp) > 5 * 60 * 1000) return false;

  return verifySignature(payload.command, payload.args, payload.timestamp, payload.signature, SECRET);
}

async function handleCommand(command: string, args: Record<string, any>): Promise<any> {
  if (process.platform !== 'linux') {
    console.log(`[Mock OS Call] Executed: ${command} ${JSON.stringify(args)}`);
    return { success: true };
  }

  switch (command) {
    case 'create_system_user':
      // useradd -m -d {homedir} -s /bin/false {username}
      await execFileAsync('useradd', ['-m', '-d', args.homedir, '-s', '/bin/false', args.username]);
      // set password (echo "username:password" | chpasswd)
      const chpass = execFile('chpasswd');
      chpass.stdin?.write(`${args.username}:${args.password}\n`);
      chpass.stdin?.end();
      return { success: true };

    case 'delete_system_user':
      await execFileAsync('userdel', ['-r', args.username]);
      return { success: true };

    case 'suspend_system_user':
      await execFileAsync('usermod', ['-L', args.username]);
      return { success: true };

    case 'unsuspend_system_user':
      await execFileAsync('usermod', ['-U', args.username]);
      return { success: true };

    case 'write_nginx_config':
      // Write vhost config file to /etc/nginx/sites-available/{domain}.conf
      const availablePath = `/etc/nginx/sites-available/${args.domain}.conf`;
      fs.writeFileSync(availablePath, args.content, 'utf8');
      return { success: true };

    case 'enable_nginx_config':
      // Create symlink in sites-enabled
      const src = `/etc/nginx/sites-available/${args.domain}.conf`;
      const dest = `/etc/nginx/sites-enabled/${args.domain}.conf`;
      if (!fs.existsSync(dest)) {
        fs.symlinkSync(src, dest);
      }
      return { success: true };

    case 'disable_nginx_config':
      const linkPath = `/etc/nginx/sites-enabled/${args.domain}.conf`;
      if (fs.existsSync(linkPath)) {
        fs.unlinkSync(linkPath);
      }
      return { success: true };

    case 'delete_nginx_config':
      const avPath = `/etc/nginx/sites-available/${args.domain}.conf`;
      const enPath = `/etc/nginx/sites-enabled/${args.domain}.conf`;
      if (fs.existsSync(enPath)) fs.unlinkSync(enPath);
      if (fs.existsSync(avPath)) fs.unlinkSync(avPath);
      return { success: true };

    case 'test_nginx_config':
      await execFileAsync('nginx', ['-t']);
      return { success: true };

    case 'reload_nginx':
      await execFileAsync('systemctl', ['reload', 'nginx']);
      return { success: true };

    case 'create_maildir':
      const maildirPath = `/home/${args.username}/mail/${args.domain}/${args.localPart}`;
      if (!fs.existsSync(maildirPath)) {
        fs.mkdirSync(maildirPath, { recursive: true });
        // Set ownership to the hosting user
        fs.chownSync(maildirPath, args.uid, args.gid);
      }
      return { success: true };

    case 'delete_maildir':
      const pathToDelete = `/home/${args.username}/mail/${args.domain}/${args.localPart}`;
      if (fs.existsSync(pathToDelete)) {
        fs.rmSync(pathToDelete, { recursive: true, force: true });
      }
      return { success: true };

    case 'create_ftp_dir':
      const resolvedBase = fs.realpathSync(`/home/${args.username}`);
      const path = require('path');
      const targetPath = path.resolve(resolvedBase, args.homedir);
      
      // Ensure target path is within the user's home directory
      if (!targetPath.startsWith(resolvedBase)) {
        throw new Error('Path traversal detected');
      }

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
        fs.chownSync(targetPath, args.uid, args.gid);
      }
      return { success: true };

    case 'generate_ssl_cert':
      // certbot certonly --webroot -w {documentRoot} -d {domain} --non-interactive --agree-tos --email {email}
      await execFileAsync('certbot', [
        'certonly',
        '--webroot',
        '-w', args.documentRoot,
        '-d', args.domain,
        '--non-interactive',
        '--agree-tos',
        '--email', args.email
      ]);
      return { success: true };

    case 'delete_ssl_cert':
      await execFileAsync('certbot', ['delete', '--cert-name', args.domain, '--non-interactive']);
      return { success: true };

    // Note: Database provisioning is handled by Fastify using the DB_ADMIN connection pool, 
    // NOT the privileged worker. The privileged worker is for host OS commands only.

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

const server = net.createServer((socket) => {
  let buffer = '';

  socket.on('data', async (data) => {
    buffer += data.toString();
    if (buffer.endsWith('\n')) {
      try {
        const payload = JSON.parse(buffer);
        buffer = ''; // reset buffer
        
        if (!verifyPayloadSignature(payload)) {
          socket.write(JSON.stringify({ error: 'Invalid signature' }) + '\n');
          socket.end();
          return;
        }

        const result = await handleCommand(payload.command, payload.args);
        socket.write(JSON.stringify({ success: true, data: result }) + '\n');
        
      } catch (err: any) {
        socket.write(JSON.stringify({ success: false, error: err.message }) + '\n');
      } finally {
        socket.end();
      }
    }
  });
});

export function startWorker() {
  const socketPath = getSocketPath();
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }

  server.listen(socketPath, () => {
    console.log(`Privileged worker listening on ${socketPath}`);
    // Set socket permissions so only the fastify user group can write to it.
    // In production, `chown root:fastify_group` and `chmod 660`.
    fs.chmodSync(socketPath, 0o666); // 666 for dev only
  });
}

// Start if executed directly
if (require.main === module) {
  startWorker();
}
