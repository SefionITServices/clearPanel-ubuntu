import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

// ─── Types ────────────────────────────────────────────────────────────

export interface ProcessInfo {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  vsz: number;   // KB
  rss: number;   // KB
  tty: string;
  stat: string;
  started: string;
  time: string;
  command: string;
}

export interface ServiceInfo {
  name: string;
  active: boolean;
  enabled: boolean;
  description: string;
}

// ─── Service ──────────────────────────────────────────────────────────

@Injectable()
export class ProcessService {
  private readonly logger = new Logger(ProcessService.name);

  // ═══════════════════════════════════════════════════════════════════
  //  LIST PROCESSES
  // ═══════════════════════════════════════════════════════════════════

  async listProcesses(sortBy: 'cpu' | 'mem' | 'pid' = 'cpu', limit = 100): Promise<{
    success: boolean;
    processes: ProcessInfo[];
    total: number;
    error?: string;
  }> {
    try {
      const sortFlag = sortBy === 'mem' ? '-%mem' : sortBy === 'pid' ? 'pid' : '-%cpu';
      const { stdout } = await exec(
        `ps aux --sort=${sortFlag} | head -n ${limit + 1}`,
        { timeout: 10_000 },
      );

      const lines = stdout.trim().split('\n');
      const processes: ProcessInfo[] = [];

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length < 11) continue;

        processes.push({
          user: parts[0],
          pid: parseInt(parts[1]),
          cpu: parseFloat(parts[2]),
          mem: parseFloat(parts[3]),
          vsz: parseInt(parts[4]),
          rss: parseInt(parts[5]),
          tty: parts[6],
          stat: parts[7],
          started: parts[8],
          time: parts[9],
          command: parts.slice(10).join(' '),
        });
      }

      // Get total count
      let total = processes.length;
      try {
        const { stdout: countOut } = await exec('ps aux | wc -l');
        total = Math.max(0, parseInt(countOut.trim()) - 1);
      } catch {}

      return { success: true, processes, total };
    } catch (e: any) {
      this.logger.error(`Failed to list processes: ${e.message}`);
      return { success: false, processes: [], total: 0, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KILL PROCESS
  // ═══════════════════════════════════════════════════════════════════

  async killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' | 'SIGHUP' = 'SIGTERM'): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      if (pid <= 1) {
        return { success: false, message: 'Cannot kill PID 0 or 1' };
      }

      await exec(`kill -${signal} ${pid}`, { timeout: 5_000 });
      return { success: true, message: `Signal ${signal} sent to PID ${pid}` };
    } catch (e: any) {
      if (e.message?.includes('No such process')) {
        return { success: false, message: `Process ${pid} does not exist` };
      }
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SERVICES (systemctl)
  // ═══════════════════════════════════════════════════════════════════

  async listServices(): Promise<{ success: boolean; services: ServiceInfo[]; error?: string }> {
    try {
      const { stdout } = await exec(
        `systemctl list-units --type=service --no-pager --no-legend --all`,
        { timeout: 15_000 },
      );

      const services: ServiceInfo[] = [];
      for (const line of stdout.trim().split('\n')) {
        // columns: UNIT  LOAD  ACTIVE  SUB  DESCRIPTION
        const match = line.trim().match(
          /^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/,
        );
        if (!match) continue;

        const name = match[1].replace('.service', '');
        const active = match[3] === 'active';
        const description = match[5].trim();

        // Check enabled status
        let enabled = false;
        try {
          const { stdout: enabledOut } = await exec(`systemctl is-enabled ${name} 2>/dev/null`);
          enabled = enabledOut.trim() === 'enabled';
        } catch {}

        services.push({ name, active, enabled, description });
      }

      return { success: true, services };
    } catch (e: any) {
      return { success: false, services: [], error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SERVICE CONTROL
  // ═══════════════════════════════════════════════════════════════════

  async controlService(
    name: string,
    action: 'start' | 'stop' | 'restart' | 'enable' | 'disable',
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Sanitize name
      if (!/^[a-zA-Z0-9._@-]+$/.test(name)) {
        return { success: false, message: 'Invalid service name' };
      }

      await exec(`systemctl ${action} ${name}`, { timeout: 30_000 });
      return { success: true, message: `Service ${name} ${action}${action.endsWith('e') ? 'd' : 'ed'} successfully` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROCESS DETAILS
  // ═══════════════════════════════════════════════════════════════════

  async getProcessDetails(pid: number): Promise<{
    success: boolean;
    process?: ProcessInfo & { children?: ProcessInfo[] };
    error?: string;
  }> {
    try {
      const { stdout } = await exec(`ps -p ${pid} -o user,pid,%cpu,%mem,vsz,rss,tty,stat,lstart,time,command --no-headers`, { timeout: 5_000 });
      const parts = stdout.trim().split(/\s+/);
      if (parts.length < 11) {
        return { success: false, error: 'Process not found' };
      }

      const proc: ProcessInfo = {
        user: parts[0],
        pid: parseInt(parts[1]),
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        vsz: parseInt(parts[4]),
        rss: parseInt(parts[5]),
        tty: parts[6],
        stat: parts[7],
        started: parts.slice(8, 13).join(' '),
        time: parts[13],
        command: parts.slice(14).join(' '),
      };

      // Get child processes
      let children: ProcessInfo[] = [];
      try {
        const { stdout: childOut } = await exec(
          `ps --ppid ${pid} -o user,pid,%cpu,%mem,vsz,rss,tty,stat,start_time,time,command --no-headers`,
          { timeout: 5_000 },
        );
        for (const line of childOut.trim().split('\n')) {
          const p = line.trim().split(/\s+/);
          if (p.length < 11) continue;
          children.push({
            user: p[0], pid: parseInt(p[1]), cpu: parseFloat(p[2]),
            mem: parseFloat(p[3]), vsz: parseInt(p[4]), rss: parseInt(p[5]),
            tty: p[6], stat: p[7], started: p[8], time: p[9],
            command: p.slice(10).join(' '),
          });
        }
      } catch {}

      return { success: true, process: { ...proc, children } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
