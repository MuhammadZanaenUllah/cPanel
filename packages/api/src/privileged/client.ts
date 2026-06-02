import net from 'net';
import { signCommand } from '@cpanel/shared';
import 'dotenv/config';

const getSocketPath = () => process.env.PRIVILEGED_SOCKET || '/var/run/cpanel-privileged.sock';
const SECRET = process.env.PRIVILEGED_WORKER_SECRET || 'dev-secret';

export function sendPrivilegedCommand(command: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(getSocketPath());
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
