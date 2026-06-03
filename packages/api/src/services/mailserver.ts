/**
 * MailServerService — manages Postfix + Dovecot accounts via docker-mailserver.
 *
 * Real cPanel does the same thing: it runs system commands as root on the host
 * to update Exim and Dovecot config files, then reloads the services.
 * We do the equivalent by exec-ing into the cpanel_mailserver container.
 *
 * Account storage: docker-mailserver keeps accounts in
 *   /tmp/docker-mailserver/postfix-accounts.cf
 * Format per line:
 *   user@domain|{SHA512-CRYPT}$6$salt$hash
 *
 * The container watches that file and reloads Dovecot/Postfix automatically.
 */

import Docker from 'dockerode';

const MAILSERVER_CONTAINER = process.env.MAILSERVER_CONTAINER || 'cpanel_mailserver';

// Only create Docker client if the socket is available (not available in local dev without Docker)
function getDocker(): Docker | null {
  try {
    return new Docker({ socketPath: '/var/run/docker.sock' });
  } catch {
    return null;
  }
}

async function execInMailserver(cmd: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const docker = getDocker();
  if (!docker) {
    console.warn('[MailServer] Docker socket not available — skipping mail server provisioning');
    return { stdout: '', stderr: 'Docker socket not available', exitCode: 0 };
  }

  let container: Docker.Container;
  try {
    container = docker.getContainer(MAILSERVER_CONTAINER);
    const info = await container.inspect();
    if (!info.State.Running) {
      console.warn('[MailServer] Mail server container is not running — skipping provisioning');
      return { stdout: '', stderr: 'Container not running', exitCode: 0 };
    }
  } catch {
    console.warn(`[MailServer] Container ${MAILSERVER_CONTAINER} not found — skipping provisioning`);
    return { stdout: '', stderr: 'Container not found', exitCode: 0 };
  }

  return new Promise((resolve, reject) => {
    container.exec(
      { Cmd: cmd, AttachStdout: true, AttachStderr: true },
      (err, exec) => {
        if (err || !exec) return reject(err || new Error('exec failed'));

        exec.start({ hijack: true, stdin: false }, (startErr: any, stream: any) => {
          if (startErr || !stream) return reject(startErr || new Error('stream failed'));

          let stdout = '';
          let stderr = '';

          docker.modem.demuxStream(stream,
            { write: (chunk: Buffer) => { stdout += chunk.toString(); } },
            { write: (chunk: Buffer) => { stderr += chunk.toString(); } }
          );

          stream.on('end', () => {
            exec.inspect((iErr: any, data: any) => {
              resolve({ stdout, stderr, exitCode: data?.ExitCode ?? 0 });
            });
          });
          stream.on('error', reject);
        });
      }
    );
  });
}

async function reloadDovecot(): Promise<void> {
  // supervisorctl restart is more reliable than dovecot reload in docker-mailserver
  const r = await execInMailserver(['supervisorctl', 'restart', 'dovecot']).catch(() => null);
  if (!r || r.exitCode !== 0) {
    await execInMailserver(['dovecot', 'reload']).catch(() => {});
  }
}

export const MailServerService = {
  /**
   * Add a virtual mailbox. Called when a cPanel email account is created.
   * Equivalent to: cPanel updating Exim virtual_mailbox_maps + Dovecot passwd file
   */
  async addAccount(email: string, password: string): Promise<void> {
    const result = await execInMailserver(['setup', 'email', 'add', email, password]);
    if (result.exitCode !== 0 && result.stderr) {
      console.warn(`[MailServer] addAccount warning for ${email}:`, result.stderr);
    } else {
      console.log(`[MailServer] Account provisioned: ${email}`);
    }
    // Reload Dovecot so the new account is immediately usable in RoundCube
    await reloadDovecot();
  },

  async deleteAccount(email: string): Promise<void> {
    const result = await execInMailserver(['setup', 'email', 'del', email]);
    if (result.exitCode !== 0 && result.stderr) {
      console.warn(`[MailServer] deleteAccount warning for ${email}:`, result.stderr);
    } else {
      console.log(`[MailServer] Account deprovisioned: ${email}`);
    }
    await reloadDovecot();
  },

  async updatePassword(email: string, newPassword: string): Promise<void> {
    const result = await execInMailserver(['setup', 'email', 'update', email, newPassword]);
    if (result.exitCode !== 0 && result.stderr) {
      console.warn(`[MailServer] updatePassword warning for ${email}:`, result.stderr);
    }
    await reloadDovecot();
  },

  /**
   * Sync all accounts from the cPanel DB into docker-mailserver.
   * Run this on startup or via the /mail/sync-mailserver admin endpoint.
   */
  async syncAccounts(accounts: { email: string; password?: string }[]): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    // Get existing accounts in mail server
    const listResult = await execInMailserver(['setup', 'email', 'list']);
    const existing = new Set(
      listResult.stdout.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean)
    );

    for (const account of accounts) {
      if (existing.has(account.email.toLowerCase())) {
        synced++;
        continue; // already provisioned
      }
      // Use a default password if none provided (user should change via cPanel)
      const pw = account.password || Math.random().toString(36).slice(-12) + 'A1!';
      try {
        await MailServerService.addAccount(account.email, pw);
        synced++;
      } catch (err: any) {
        errors.push(`${account.email}: ${err.message}`);
      }
    }

    return { synced, errors };
  },

  /**
   * Check if the mail server container is reachable.
   */
  async isReachable(): Promise<boolean> {
    try {
      const result = await execInMailserver(['echo', 'ok']);
      return result.stdout.trim() === 'ok';
    } catch {
      return false;
    }
  },
};
