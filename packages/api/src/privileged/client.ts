import net from 'net';
import { signCommand } from '@cpanel/shared';
import 'dotenv/config';

const getSocketPath = () => process.env.PRIVILEGED_SOCKET || '/var/run/cpanel-privileged.sock';
const SECRET = process.env.PRIVILEGED_WORKER_SECRET || 'dev-secret';

export function sendPrivilegedCommand(command: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const socketPath = getSocketPath();

    // In dev/Docker the worker socket won't exist — skip gracefully
    const fs = require('fs');
    if (!fs.existsSync(socketPath)) {
      console.warn(`[privileged] socket not found (${socketPath}), skipping "${command}" in dev mode`);
      return resolve({ dev_mode: true });
    }

    const socket = net.createConnection(socketPath);
    const timestamp = Date.now();
    const signature = signCommand(command, args, timestamp, SECRET);

    const payload = JSON.stringify({ command, args, signature, timestamp }) + '\n';
    socket.write(payload);

    let data = '';
    socket.on('data', chunk => { data += chunk.toString(); });
    socket.on('end', () => {
      try {
        const res = JSON.parse(data);
        if (res.error) reject(new Error(res.error));
        else resolve(res.data);
      } catch (err) {
        reject(new Error('Invalid response from privileged worker'));
      }
    });
    socket.on('error', err => reject(err));
  });
}
