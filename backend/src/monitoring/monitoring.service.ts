import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';

const exec = promisify(execCb);

// ─── Types ────────────────────────────────────────────────────────────

export interface CpuInfo {
  model: string;
  cores: number;
  usagePercent: number;
  loadAverage: number[];    // 1, 5, 15 min
}

export interface MemoryInfo {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  availableMB: number;
  usagePercent: number;
  swapTotalMB: number;
  swapUsedMB: number;
  swapPercent: number;
}

export interface DiskInfo {
  filesystem: string;
  mountpoint: string;
  totalGB: number;
  usedGB: number;
  availableGB: number;
  usagePercent: number;
}

export interface NetworkInterface {
  name: string;
  ipv4?: string;
  ipv6?: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface ServiceStatus {
  name: string;
  active: boolean;
  enabled: boolean;
  description: string;
}

export interface SystemOverview {
  hostname: string;
  os: string;
  kernel: string;
  uptime: string;
  uptimeSeconds: number;
  cpu: CpuInfo;
  memory: MemoryInfo;
  disks: DiskInfo[];
  network: NetworkInterface[];
  services: ServiceStatus[];
}

// ─── Service ──────────────────────────────────────────────────────────

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  // ═══════════════════════════════════════════════════════════════════
  //  FULL SYSTEM OVERVIEW
  // ═══════════════════════════════════════════════════════════════════

  async getOverview(): Promise<{ success: boolean; data: SystemOverview; error?: string }> {
    try {
      const [cpu, memory, disks, network, services, sysInfo] = await Promise.all([
        this.getCpu(),
        this.getMemory(),
        this.getDisks(),
        this.getNetwork(),
        this.getServices(),
        this.getSystemInfo(),
      ]);

      return {
        success: true,
        data: {
          ...sysInfo,
          cpu,
          memory,
          disks,
          network,
          services,
        },
      };
    } catch (e: any) {
      this.logger.error(`Monitoring overview failed: ${e.message}`);
      return {
        success: false,
        data: {} as SystemOverview,
        error: e.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CPU
  // ═══════════════════════════════════════════════════════════════════

  async getCpu(): Promise<CpuInfo> {
    const cpus = os.cpus();
    const model = cpus[0]?.model || 'Unknown';
    const cores = cpus.length;
    const loadAverage = os.loadavg();

    // Calculate CPU usage from /proc/stat
    let usagePercent = 0;
    try {
      const stat1 = await fs.readFile('/proc/stat', 'utf-8');
      await new Promise(r => setTimeout(r, 500));
      const stat2 = await fs.readFile('/proc/stat', 'utf-8');

      const parse = (stat: string) => {
        const line = stat.split('\n')[0]; // cpu line
        const parts = line.split(/\s+/).slice(1).map(Number);
        const idle = parts[3] + (parts[4] || 0); // idle + iowait
        const total = parts.reduce((a, b) => a + b, 0);
        return { idle, total };
      };

      const s1 = parse(stat1);
      const s2 = parse(stat2);
      const idleDelta = s2.idle - s1.idle;
      const totalDelta = s2.total - s1.total;
      usagePercent = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
    } catch {
      // Fallback to load average
      usagePercent = Math.min(100, Math.round((loadAverage[0] / cores) * 100));
    }

    return { model, cores, usagePercent, loadAverage };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MEMORY
  // ═══════════════════════════════════════════════════════════════════

  async getMemory(): Promise<MemoryInfo> {
    try {
      const meminfo = await fs.readFile('/proc/meminfo', 'utf-8');
      const get = (key: string): number => {
        const m = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
        return m ? parseInt(m[1], 10) / 1024 : 0; // kB to MB
      };

      const totalMB = get('MemTotal');
      const freeMB = get('MemFree');
      const availableMB = get('MemAvailable');
      const buffers = get('Buffers');
      const cached = get('Cached');
      const usedMB = totalMB - freeMB - buffers - cached;
      const usagePercent = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0;

      const swapTotalMB = get('SwapTotal');
      const swapFreeMB = get('SwapFree');
      const swapUsedMB = swapTotalMB - swapFreeMB;
      const swapPercent = swapTotalMB > 0 ? Math.round((swapUsedMB / swapTotalMB) * 100) : 0;

      return {
        totalMB: Math.round(totalMB),
        usedMB: Math.round(usedMB),
        freeMB: Math.round(freeMB),
        availableMB: Math.round(availableMB),
        usagePercent,
        swapTotalMB: Math.round(swapTotalMB),
        swapUsedMB: Math.round(swapUsedMB),
        swapPercent,
      };
    } catch {
      // Fallback to os module
      const totalMB = Math.round(os.totalmem() / (1024 * 1024));
      const freeMB = Math.round(os.freemem() / (1024 * 1024));
      const usedMB = totalMB - freeMB;
      return {
        totalMB, usedMB, freeMB,
        availableMB: freeMB,
        usagePercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
        swapTotalMB: 0, swapUsedMB: 0, swapPercent: 0,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DISKS
  // ═══════════════════════════════════════════════════════════════════

  async getDisks(): Promise<DiskInfo[]> {
    try {
      const { stdout } = await exec('df -BG --output=source,target,size,used,avail,pcent -x tmpfs -x devtmpfs -x squashfs 2>/dev/null', { timeout: 10_000 });
      const lines = stdout.trim().split('\n').slice(1); // skip header
      const disks: DiskInfo[] = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) continue;
        const [filesystem, mountpoint, totalStr, usedStr, availStr, percentStr] = parts;
        disks.push({
          filesystem,
          mountpoint,
          totalGB: parseInt(totalStr, 10) || 0,
          usedGB: parseInt(usedStr, 10) || 0,
          availableGB: parseInt(availStr, 10) || 0,
          usagePercent: parseInt(percentStr, 10) || 0,
        });
      }

      return disks;
    } catch (e: any) {
      this.logger.warn(`Disk info failed: ${e.message}`);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  NETWORK
  // ═══════════════════════════════════════════════════════════════════

  async getNetwork(): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];
    try {
      const { stdout } = await exec("ip -j addr show 2>/dev/null || echo '[]'", { timeout: 10_000 });
      let addrs: any[];
      try { addrs = JSON.parse(stdout); } catch { addrs = []; }

      // Get traffic stats from /proc/net/dev
      let devStats: Record<string, { rx: number; tx: number; rxp: number; txp: number }> = {};
      try {
        const dev = await fs.readFile('/proc/net/dev', 'utf-8');
        for (const line of dev.split('\n').slice(2)) {
          const match = line.match(/^\s*(\S+):\s+(\d+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(\d+)\s+(\d+)/);
          if (match) {
            devStats[match[1]] = {
              rx: parseInt(match[2], 10),
              rxp: parseInt(match[3], 10),
              tx: parseInt(match[4], 10),
              txp: parseInt(match[5], 10),
            };
          }
        }
      } catch {}

      for (const iface of addrs) {
        if (iface.ifname === 'lo') continue;
        const entry: NetworkInterface = {
          name: iface.ifname,
          rxBytes: devStats[iface.ifname]?.rx || 0,
          txBytes: devStats[iface.ifname]?.tx || 0,
          rxPackets: devStats[iface.ifname]?.rxp || 0,
          txPackets: devStats[iface.ifname]?.txp || 0,
        };

        for (const addr of iface.addr_info || []) {
          if (addr.family === 'inet') entry.ipv4 = addr.local;
          if (addr.family === 'inet6' && !addr.local?.startsWith('fe80')) entry.ipv6 = addr.local;
        }
        interfaces.push(entry);
      }
    } catch (e: any) {
      this.logger.warn(`Network info failed: ${e.message}`);
    }
    return interfaces;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SERVICES  
  // ═══════════════════════════════════════════════════════════════════

  async getServices(): Promise<ServiceStatus[]> {
    const serviceNames = [
      'nginx', 'apache2', 'mysql', 'mariadb', 'postgresql',
      'postfix', 'dovecot', 'opendkim', 'named', 'bind9',
      'fail2ban', 'ufw', 'redis-server', 'memcached',
      'php8.3-fpm', 'php8.2-fpm', 'php8.1-fpm', 'php8.0-fpm',
    ];

    const services: ServiceStatus[] = [];

    try {
      // Batch all checks in one command
      const checks = serviceNames.map(s => `systemctl is-active ${s} 2>/dev/null`).join('; echo "---"; ');
      const { stdout } = await exec(checks, { timeout: 15_000 });
      const results = stdout.trim().split('---').map(s => s.trim());

      for (let i = 0; i < serviceNames.length; i++) {
        const active = results[i]?.includes('active') && !results[i]?.includes('inactive');
        if (active || results[i]?.includes('inactive')) {
          services.push({
            name: serviceNames[i],
            active: !!active,
            enabled: true, // simplified
            description: serviceNames[i],
          });
        }
      }
    } catch {
      // Fallback: check each individually
      for (const name of serviceNames) {
        try {
          const { stdout } = await exec(`systemctl is-active ${name} 2>/dev/null`, { timeout: 5000 });
          if (stdout.trim() === 'active' || stdout.trim() === 'inactive') {
            services.push({
              name,
              active: stdout.trim() === 'active',
              enabled: true,
              description: name,
            });
          }
        } catch {}
      }
    }

    return services;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SYSTEM INFO
  // ═══════════════════════════════════════════════════════════════════

  async getSystemInfo(): Promise<{ hostname: string; os: string; kernel: string; uptime: string; uptimeSeconds: number }> {
    const hostname = os.hostname();
    const kernel = os.release();
    const uptimeSeconds = os.uptime();

    let osName = `${os.type()} ${os.release()}`;
    try {
      const osRelease = await fs.readFile('/etc/os-release', 'utf-8');
      const nameMatch = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/);
      if (nameMatch) osName = nameMatch[1];
    } catch {}

    // Format uptime
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    const uptime = parts.join(' ');

    return { hostname, os: osName, kernel, uptime, uptimeSeconds };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TOP PROCESSES
  // ═══════════════════════════════════════════════════════════════════

  async getTopProcesses(limit: number = 15): Promise<{
    success: boolean;
    processes: { pid: number; user: string; cpu: number; mem: number; vsz: number; rss: number; stat: string; time: string; command: string }[];
  }> {
    try {
      const { stdout } = await exec(
        `ps aux --sort=-%cpu | head -n ${limit + 1}`,
        { timeout: 10_000 },
      );
      const lines = stdout.trim().split('\n').slice(1); // skip header
      const processes = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0],
          pid: parseInt(parts[1], 10),
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          vsz: parseInt(parts[4], 10) || 0,
          rss: parseInt(parts[5], 10) || 0,
          stat: parts[7] || '',
          time: parts[9] || '',
          command: parts.slice(10).join(' '),
        };
      });

      return { success: true, processes };
    } catch (e: any) {
      return { success: true, processes: [] };
    }
  }
}
