import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCb);

// ─── Types ────────────────────────────────────────────────────────────

export interface SshKey {
  name: string;         // filename without extension, e.g. "id_ed25519"
  type: string;         // rsa, ed25519, ecdsa, etc.
  bits?: number;        // key bits (for RSA)
  fingerprint: string;  // SHA256 fingerprint
  publicKey: string;    // full public key content
  createdAt: string;    // file mtime
  comment: string;      // key comment (usually user@host)
}

export type KeyAlgorithm = 'ed25519' | 'rsa' | 'ecdsa';

@Injectable()
export class SshKeysService {
  private readonly logger = new Logger(SshKeysService.name);

  private get sshDir(): string {
    return path.join(os.homedir(), '.ssh');
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async ensureSshDir(): Promise<void> {
    try {
      await fs.mkdir(this.sshDir, { mode: 0o700, recursive: true });
    } catch {}
  }

  private async fileExists(p: string): Promise<boolean> {
    try { await fs.access(p); return true; } catch { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LIST SSH KEYS
  // ═══════════════════════════════════════════════════════════════════

  async listKeys(): Promise<SshKey[]> {
    await this.ensureSshDir();
    const keys: SshKey[] = [];

    try {
      const files = await fs.readdir(this.sshDir);
      const pubFiles = files.filter(f => f.endsWith('.pub'));

      for (const pubFile of pubFiles) {
        try {
          const pubPath = path.join(this.sshDir, pubFile);
          const privPath = pubPath.replace(/\.pub$/, '');
          const name = pubFile.replace(/\.pub$/, '');

          // Read public key
          const publicKey = (await fs.readFile(pubPath, 'utf-8')).trim();
          const parts = publicKey.split(/\s+/);
          const type = this.parseKeyType(parts[0] || '');
          const comment = parts.slice(2).join(' ') || '';

          // Get fingerprint
          let fingerprint = '';
          try {
            const { stdout } = await exec(`ssh-keygen -lf "${pubPath}" 2>/dev/null`);
            const fpMatch = stdout.match(/SHA256:[^\s]+/);
            fingerprint = fpMatch ? fpMatch[0] : '';
          } catch {}

          // Get file stat for creation time
          const stat = await fs.stat(pubPath);
          const createdAt = stat.mtime.toISOString();

          // Parse bits from fingerprint output
          let bits: number | undefined;
          try {
            const { stdout } = await exec(`ssh-keygen -lf "${pubPath}" 2>/dev/null`);
            const bitsMatch = stdout.match(/^(\d+)/);
            if (bitsMatch) bits = parseInt(bitsMatch[1], 10);
          } catch {}

          keys.push({
            name,
            type,
            bits,
            fingerprint,
            publicKey,
            createdAt,
            comment,
          });
        } catch (e) {
          this.logger.warn(`Skipping key ${pubFile}: ${e}`);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to list SSH keys: ${e}`);
    }

    return keys;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  GENERATE SSH KEY
  // ═══════════════════════════════════════════════════════════════════

  async generateKey(opts: {
    name?: string;
    algorithm?: KeyAlgorithm;
    bits?: number;
    comment?: string;
    passphrase?: string;
  }): Promise<{ success: boolean; message: string; publicKey?: string; fingerprint?: string }> {
    await this.ensureSshDir();

    const algorithm = opts.algorithm || 'ed25519';
    const comment = opts.comment || `${os.userInfo().username}@${os.hostname()}`;
    const passphrase = opts.passphrase || '';

    // Determine filename
    let name = opts.name;
    if (!name) {
      name = `id_${algorithm}`;
    }
    // Sanitize name
    name = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const keyPath = path.join(this.sshDir, name);

    // Check if key already exists
    if (await this.fileExists(keyPath)) {
      return { success: false, message: `Key "${name}" already exists. Choose a different name or delete the existing key.` };
    }

    try {
      // Build ssh-keygen command
      let cmd = `ssh-keygen -t ${algorithm} -C "${comment}" -f "${keyPath}" -N "${passphrase}"`;
      if (algorithm === 'rsa') {
        const bits = opts.bits || 4096;
        cmd = `ssh-keygen -t rsa -b ${bits} -C "${comment}" -f "${keyPath}" -N "${passphrase}"`;
      } else if (algorithm === 'ecdsa') {
        const bits = opts.bits || 521;
        cmd = `ssh-keygen -t ecdsa -b ${bits} -C "${comment}" -f "${keyPath}" -N "${passphrase}"`;
      }

      await exec(cmd, { timeout: 30_000 });

      // Read back the public key
      const publicKey = (await fs.readFile(`${keyPath}.pub`, 'utf-8')).trim();

      // Get fingerprint
      let fingerprint = '';
      try {
        const { stdout } = await exec(`ssh-keygen -lf "${keyPath}.pub" 2>/dev/null`);
        const fpMatch = stdout.match(/SHA256:[^\s]+/);
        fingerprint = fpMatch ? fpMatch[0] : '';
      } catch {}

      return {
        success: true,
        message: `SSH key "${name}" (${algorithm}) generated successfully`,
        publicKey,
        fingerprint,
      };
    } catch (e: any) {
      this.logger.error(`Failed to generate SSH key: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DELETE SSH KEY
  // ═══════════════════════════════════════════════════════════════════

  async deleteKey(name: string): Promise<{ success: boolean; message: string }> {
    // Sanitize
    name = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const privPath = path.join(this.sshDir, name);
    const pubPath = `${privPath}.pub`;

    try {
      if (await this.fileExists(privPath)) await fs.unlink(privPath);
      if (await this.fileExists(pubPath)) await fs.unlink(pubPath);
      return { success: true, message: `Key "${name}" deleted` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  GET PUBLIC KEY (for easy copy)
  // ═══════════════════════════════════════════════════════════════════

  async getPublicKey(name: string): Promise<{ success: boolean; publicKey?: string; message?: string }> {
    name = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const pubPath = path.join(this.sshDir, `${name}.pub`);

    try {
      const content = (await fs.readFile(pubPath, 'utf-8')).trim();
      return { success: true, publicKey: content };
    } catch (e: any) {
      return { success: false, message: `Key "${name}" not found` };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AUTHORIZED KEYS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  async getAuthorizedKeys(): Promise<{ success: boolean; keys: string[]; raw: string }> {
    const authPath = path.join(this.sshDir, 'authorized_keys');
    try {
      const content = (await fs.readFile(authPath, 'utf-8')).trim();
      const keys = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      return { success: true, keys, raw: content };
    } catch {
      return { success: true, keys: [], raw: '' };
    }
  }

  async addAuthorizedKey(publicKey: string): Promise<{ success: boolean; message: string }> {
    await this.ensureSshDir();
    const authPath = path.join(this.sshDir, 'authorized_keys');

    try {
      let content = '';
      try { content = await fs.readFile(authPath, 'utf-8'); } catch {}
      const lines = content.trim().split('\n').filter(l => l.trim());
      const keyBody = publicKey.trim();

      // Check for duplicates
      if (lines.some(l => l.trim() === keyBody)) {
        return { success: false, message: 'This key is already in authorized_keys' };
      }

      lines.push(keyBody);
      await fs.writeFile(authPath, lines.join('\n') + '\n', { mode: 0o600 });

      return { success: true, message: 'Public key added to authorized_keys' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  async removeAuthorizedKey(index: number): Promise<{ success: boolean; message: string }> {
    const authPath = path.join(this.sshDir, 'authorized_keys');

    try {
      const content = await fs.readFile(authPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));

      if (index < 0 || index >= lines.length) {
        return { success: false, message: 'Invalid key index' };
      }

      lines.splice(index, 1);
      await fs.writeFile(authPath, lines.join('\n') + '\n', { mode: 0o600 });

      return { success: true, message: 'Key removed from authorized_keys' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────

  private parseKeyType(prefix: string): string {
    if (prefix.includes('ed25519')) return 'ed25519';
    if (prefix.includes('ecdsa')) return 'ecdsa';
    if (prefix.includes('rsa')) return 'rsa';
    if (prefix.includes('dsa')) return 'dsa';
    return prefix.replace('ssh-', '');
  }
}
