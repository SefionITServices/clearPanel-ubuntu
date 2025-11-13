import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

type SessionState = {
  cwd: string;
};

@Injectable()
export class TerminalService {
  private sessions = new Map<string, SessionState>();

  private ensureSession(sessionId: string): SessionState {
    let st = this.sessions.get(sessionId);
    if (!st) {
      st = { cwd: process.env.HOME || os.homedir() };
      this.sessions.set(sessionId, st);
    }
    return st;
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
