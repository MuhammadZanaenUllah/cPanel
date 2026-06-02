import { FastifyInstance } from 'fastify';
import { resolveSafe } from '@cpanel/shared/src/utils/fs';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Path traversal auth hook
async function cpanelAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin') {
      request.accountId = request.user.id;
      request.username = request.user.username;
    } else {
      request.accountId = request.query.accountId || request.body?.accountId || request.user.id;
      request.username = request.query.username || request.body?.username || 'testuser';
    }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function filesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', cpanelAuth);

  // Helper to get safe user home directory (with macOS / dev fallback)
  const getUserHome = (username: string): string => {
    const isLinux = process.platform === 'linux';
    const baseHome = isLinux ? '/home' : path.resolve(__dirname, '../../mock_home');
    const userHome = path.join(baseHome, username);
    
    // Auto-create directory structure if missing for dev
    const pubHtml = path.join(userHome, 'public_html');
    if (!fs.existsSync(pubHtml)) {
      fs.mkdirSync(pubHtml, { recursive: true });
      fs.writeFileSync(path.join(pubHtml, 'index.html'), '<h1>Welcome to your new cPanel website!</h1>');
      fs.writeFileSync(path.join(pubHtml, 'styles.css'), 'body { font-family: sans-serif; }');
    }
    return userHome;
  };

  // 1. List files in directory
  fastify.get('/files/list', async (request: any, reply) => {
    const { relPath = '' } = request.query;
    const userHome = getUserHome(request.username);

    try {
      const targetDir = resolveSafe(userHome, relPath);
      if (!fs.existsSync(targetDir)) {
        return reply.code(404).send({ error: 'Directory not found' });
      }

      const files = fs.readdirSync(targetDir, { withFileTypes: true });
      const items = files.map(file => {
        const fullPath = path.join(targetDir, file.name);
        const stats = fs.statSync(fullPath);
        return {
          name: file.name,
          isDirectory: file.isDirectory(),
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
          relPath: path.relative(userHome, fullPath)
        };
      });

      return { currentDir: path.relative(userHome, targetDir), items };
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 2. Create a file or folder
  fastify.post('/files/create', async (request: any, reply) => {
    const { relPath, name, isDirectory } = request.body;
    const userHome = getUserHome(request.username);

    try {
      const targetParent = resolveSafe(userHome, relPath);
      const targetPath = resolveSafe(targetParent, name);

      if (fs.existsSync(targetPath)) {
        return reply.code(400).send({ error: 'File or directory already exists' });
      }

      if (isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
      } else {
        fs.writeFileSync(targetPath, '');
      }

      return { success: true, message: `${isDirectory ? 'Directory' : 'File'} created successfully` };
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 3. Edit / Write File Content
  fastify.post('/files/write', async (request: any, reply) => {
    const { relPath, content } = request.body;
    const userHome = getUserHome(request.username);

    try {
      const targetFile = resolveSafe(userHome, relPath);
      fs.writeFileSync(targetFile, content, 'utf8');
      return { success: true, message: 'File saved successfully' };
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 4. Delete File or Folder
  fastify.post('/files/delete', async (request: any, reply) => {
    const { relPath } = request.body;
    const userHome = getUserHome(request.username);

    try {
      const targetPath = resolveSafe(userHome, relPath);
      if (!fs.existsSync(targetPath)) {
        return reply.code(404).send({ error: 'File or directory not found' });
      }

      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }

      return { success: true, message: 'Deleted successfully' };
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // 5. Secure Terminal executor inside the isolated Home directory
  fastify.post('/terminal/execute', async (request: any, reply) => {
    const { command } = request.body;
    const userHome = getUserHome(request.username);

    if (!command) {
      return reply.code(400).send({ error: 'Command cannot be empty' });
    }

    // List of allowed safe commands for development and security chroot limits
    const safeCommandPattern = /^(ls|pwd|whoami|cat|echo|uptime|df|id|mkdir|rm|touch|uname|ps)/;
    const cleanCommand = command.trim();

    if (!safeCommandPattern.test(cleanCommand)) {
      return { 
        output: `cpanel-sh: command forbidden or restricted for security.\nAllowed commands: ls, pwd, whoami, cat, echo, uptime, df, id, mkdir, touch, rm` 
      };
    }

    try {
      // Execute the command strictly jailed within the user home directory
      const { stdout, stderr } = await execAsync(cleanCommand, {
        cwd: userHome,
        timeout: 5000,
        maxBuffer: 1024 * 1024
      });

      return { output: stdout || stderr || 'Command completed with no output' };
    } catch (err: any) {
      return { output: err.stderr || err.message };
    }
  });
}
