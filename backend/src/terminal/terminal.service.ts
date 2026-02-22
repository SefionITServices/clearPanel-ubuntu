import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

type SessionState = {
  cwd: string;
};

/**
 * Commands / patterns that should never be executed through the web terminal.
 * These protect against accidental or malicious destruction of the host system.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  // Destructive system commands
  /\brm\s+(-[a-zA-Z]*)?(\s+)?\//,      // rm with absolute path (rm -rf /)
  /\bmkfs\b/,                            // format filesystem
  /\bdd\b.*\bof\s*=\s*\/dev\//,         // dd writing to devices
  /:(){ :\|:& };:/,                      // fork bomb
  /\bshutdown\b/,                        // shutdown system
  /\breboot\b/,                          // reboot system
  /\binit\s+[06]\b/,                     // init 0 or init 6
  /\bsystemctl\s+(halt|poweroff|reboot)/, // systemctl halt/poweroff/reboot
  // User/auth tampering
  /\buserdel\b/,                         // delete users
  /\bpasswd\s+root\b/,                   // change root password
  /\bchpasswd\b/,                        // batch password changes
  /\bvisudo\b/,                          // edit sudoers
  /\/etc\/sudoers/,                      // direct sudoers file access
  /\/etc\/shadow/,                       // shadow password file
  // Network/firewall disruption
  /\biptables\s+-F\b/,                  // flush all firewall rules
  /\bufw\s+disable\b/,                  // disable firewall
  // Crypto-mining / reverse shell indicators
  /\bnc\s+-[a-zA-Z]*l/,                 // netcat listen mode
  /\/dev\/tcp\//,                        // bash reverse shell
  /\bxmrig\b|\bcpuminer\b/,             // crypto miners
];

@Injectable()
export class TerminalService {
  private readonly logger = new Logger(TerminalService.name);
  private sessions = new Map<string, SessionState>();

  private ensureSession(sessionId: string): SessionState {
    let st = this.sessions.get(sessionId);
    if (!st) {
      st = { cwd: process.env.HOME || os.homedir() };
      this.sessions.set(sessionId, st);
    }
    return st;
  }

  /**
   * Check a command against the blocklist.
   * Returns the matched pattern description if blocked, or null if allowed.
   */
  private checkBlocked(command: string): string | null {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return pattern.source;
      }
    }
    return null;
  }

  async execCommand(raw: string, sessionId: string) {
    const state = this.ensureSession(sessionId);
    const command = raw.trim();
    if (!command) return { stdout: '', stderr: '' , cwd: state.cwd};

    // Handle built-ins (only cd and clear for now)
    if (command === 'clear') {
      return { stdout: '', stderr: '', cwd: state.cwd };
    }
    if (command.startsWith('cd')) {
      const target = command.substring(2).trim() || os.homedir();
      const newPath = target.startsWith('/') ? target : path.resolve(state.cwd, target);
      if (!fs.existsSync(newPath)) {
        return { stdout: '', stderr: `cd: no such file or directory: ${target}`, cwd: state.cwd };
      }
      const stat = fs.statSync(newPath);
      if (!stat.isDirectory()) {
        return { stdout: '', stderr: `cd: not a directory: ${target}`, cwd: state.cwd };
      }
      state.cwd = newPath;
      return { stdout: '', stderr: '', cwd: state.cwd };
    }

    // Security: check command against blocklist
    const blocked = this.checkBlocked(command);
    if (blocked) {
      this.logger.warn(`Blocked terminal command: "${command}" (matched: ${blocked})`);
      return { stdout: '', stderr: 'Error: This command is not allowed through the web terminal for security reasons.', cwd: state.cwd };
    }

    return new Promise<{ stdout: string; stderr: string; cwd: string }>((resolve) => {
      exec(command, { timeout: 10000, maxBuffer: 1024 * 1024, cwd: state.cwd, env: process.env }, (error, stdout, stderr) => {
        if (error) {
          resolve({ stdout, stderr: stderr || error.message, cwd: state.cwd });
        } else {
          resolve({ stdout, stderr, cwd: state.cwd });
        }
      });
    });
  }

  getSessionInfo(sessionId: string) {
    const st = this.ensureSession(sessionId);
    return {
      cwd: st.cwd,
      user: process.env.USER || os.userInfo().username,
      host: os.hostname(),
    };
  }
}
