/**
 * Real PTY terminal over WebSocket — the same approach cPanel uses.
 *
 * Flow:
 *   Browser xterm.js  ←WebSocket→  This route  ←PTY→  bash
 *
 * Auth: JWT token passed as ?token= query param (WebSocket headers
 * can't be set by browsers, so query param is the standard approach).
 *
 * Protocol (JSON messages from browser → server):
 *   { type: 'input',  data: string }        — keystrokes
 *   { type: 'resize', cols: number, rows: number }  — terminal resize
 *
 * Protocol (binary/string from server → browser):
 *   Raw PTY output bytes (xterm.js handles ANSI codes natively)
 */

import { FastifyInstance } from 'fastify';
import * as pty from 'node-pty';
import { db } from '../db/connection';

export async function terminalWsRoutes(fastify: FastifyInstance) {
  fastify.get('/terminal/ws', { websocket: true }, async (connection: any, request: any) => {
    const socket = connection.socket;
    // ── Auth via query param token ─────────────────────────────────────────
    const token = (request.query as any).token as string | undefined;
    if (!token) {
      socket.send('\r\n\x1b[31mUnauthorized — no token provided.\x1b[0m\r\n');
      socket.close();
      return;
    }

    let accountId: string;
    let username: string;

    try {
      const decoded = fastify.jwt.verify(token) as { id: string; username: string; role: string };
      accountId = decoded.id;
      username  = decoded.username;
    } catch {
      socket.send('\r\n\x1b[31mUnauthorized — invalid or expired token.\x1b[0m\r\n');
      socket.close();
      return;
    }

    // ── Look up home dir ───────────────────────────────────────────────────
    const account = await db('accounts').where({ id: accountId }).first().catch(() => null);
    let homeDir = account?.home_dir || process.env.HOME || '/tmp';
    
    // Ensure homeDir exists inside the container environment
    const fs = require('fs');
    if (!fs.existsSync(homeDir)) {
      try {
        fs.mkdirSync(homeDir, { recursive: true });
      } catch {
        homeDir = '/tmp';
      }
    }

    // ── Spawn PTY (bash) ───────────────────────────────────────────────────
    const ptyProc = pty.spawn('/bin/sh', [], {
      name: 'xterm-256color',
      cols: 220,
      rows: 50,
      cwd: homeDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: homeDir,
        USER: username,
        SHELL: '/bin/sh',
        // Colour prompt: "user@cpanel:~/path$ "
        PS1: `\\[\\033[1;32m\\]${username}@cpanel\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ `,
      },
    });

    // ── PTY → WebSocket ────────────────────────────────────────────────────
    ptyProc.onData((data: string) => {
      try { socket.send(data); } catch { /* socket closed */ }
    });

    ptyProc.onExit(({ exitCode }) => {
      try {
        socket.send(`\r\n\x1b[33mSession ended (exit ${exitCode ?? 0}).\x1b[0m\r\n`);
        socket.close();
      } catch { /* already closed */ }
    });

    // ── WebSocket → PTY ────────────────────────────────────────────────────
    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input') {
          ptyProc.write(msg.data);
        } else if (msg.type === 'resize' && msg.cols && msg.rows) {
          ptyProc.resize(Math.max(10, msg.cols), Math.max(5, msg.rows));
        }
      } catch {
        // Non-JSON: treat as raw input (fallback)
        ptyProc.write(raw.toString());
      }
    });

    // ── Cleanup ────────────────────────────────────────────────────────────
    socket.on('close', () => {
      try { ptyProc.kill(); } catch { /* already dead */ }
    });

    // Send welcome banner
    socket.send(`\x1b[1;32mWelcome to cPanel Terminal\x1b[0m — ${username}@cpanel\r\n`);
    socket.send(`\x1b[2mType \x1b[0m\x1b[1mhelp\x1b[0m\x1b[2m for available commands. Type \x1b[0m\x1b[1mexit\x1b[0m\x1b[2m to close.\x1b[0m\r\n\r\n`);
  });
}
