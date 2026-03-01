import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DnsServerStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  zonesPath?: string;
  namedConfPath?: string;
}

export interface NameserverInfo {
  nameservers: string[];
  ip: string;
  instructions: string;
}

@Injectable()
export class DnsServerService {
  private readonly logger = new Logger(DnsServerService.name);
  private readonly zonesPath = '/etc/bind/zones';
  private readonly namedConfPath = '/etc/bind/named.conf.local';
  private readonly namedOptionsPath = '/etc/bind/named.conf.options';

  constructor(private configService: ConfigService) {}

  async getStatus(): Promise<DnsServerStatus> {
    const status: DnsServerStatus = {
      installed: false,
      running: false,
      zonesPath: this.zonesPath,
      namedConfPath: this.namedConfPath,
    };

    try {
      // Check if BIND9 is installed
      const { stdout } = await execAsync('named -v 2>&1 || true', { timeout: 10_000 });
      if (stdout.includes('BIND')) {
        status.installed = true;
        status.version = stdout.trim().split('\n')[0];
      }
    } catch (error) {
      this.logger.debug('BIND9 not installed');
    }

    if (status.installed) {
      try {
        // Check if named service is running
        const { stdout } = await execAsync('systemctl is-active named || systemctl is-active bind9 || true', { timeout: 30_000 });
        status.running = stdout.trim() === 'active';
      } catch (error) {
        this.logger.debug('Named service check failed');
      }
    }

    return status;
  }

  async install(): Promise<{ success: boolean; message: string; output?: string }> {
    const status = await this.getStatus();
    if (status.installed) {
      return { success: true, message: 'BIND9 is already installed' };
    }

    try {
      this.logger.log('Installing BIND9...');
      
      // Detect package manager and install
      let installCmd = '';
      try {
        await execAsync('which apt-get', { timeout: 10_000 });
        installCmd = 'apt-get update && apt-get install -y bind9 bind9utils bind9-doc';
      } catch {
        try {
          await execAsync('which dnf', { timeout: 10_000 });
          installCmd = 'dnf install -y bind bind-utils';
        } catch {
          return { success: false, message: 'Unsupported package manager. Please install BIND9 manually.' };
        }
      }

      const { stdout, stderr } = await execAsync(`sudo ${installCmd}`, { timeout: 120_000 });
      
      // Create zones directory
      await execAsync(`sudo mkdir -p ${this.zonesPath}`, { timeout: 10_000 });
      await execAsync(`sudo chown -R bind:bind ${this.zonesPath} || sudo chown -R named:named ${this.zonesPath} || true`, { timeout: 10_000 });

      // Enable and start the service
      const serviceName = await this.getServiceName();
      await execAsync(`sudo systemctl enable ${serviceName}`, { timeout: 30_000 });
      await execAsync(`sudo systemctl start ${serviceName}`, { timeout: 30_000 });

      this.logger.log('BIND9 installed and started successfully');
      return { 
        success: true, 
        message: 'BIND9 installed successfully',
        output: stdout + stderr
      };
    } catch (error: any) {
      this.logger.error('BIND9 installation failed', error);
      return { 
        success: false, 
        message: `Installation failed: ${error?.message || 'Unknown error'}`,
        output: error?.stderr || error?.stdout || ''
      };
    }
  }

  async createZone(domain: string, serverIp?: string, nameservers?: string[]): Promise<{ success: boolean; message: string }> {
    const status = await this.getStatus();
    if (!status.installed) {
      return { success: false, message: 'BIND9 is not installed. Please install it first.' };
    }

    const ip = serverIp || this.configService.get<string>('SERVER_IP') || '0.0.0.0';
    // Use provided nameservers from the caller (DomainsService resolves from server-settings).
    // The ns1/ns2.{domain} fallback should rarely be used if VPS nameservers are configured.
    const nsList = Array.from(
      new Set(
        (nameservers && nameservers.length ? nameservers : [`ns1.${domain}`, `ns2.${domain}`])
          .map(ns => ns.trim())
          .filter(ns => ns.length > 0)
          .map(ns => (ns.endsWith('.') ? ns.slice(0, -1) : ns))
      ),
    );
    const serial = this.generateSerial();
    const zoneFile = path.join(this.zonesPath, `db.${domain}`);

    const nsRecords = nsList
      .map(ns => `@       IN  NS      ${(ns.endsWith('.') ? ns : `${ns}.`)}`)
      .join('\n');

    const suffix = `.${domain}`;
    const nsARecords = nsList
      .map(ns => (ns.endsWith('.') ? ns.slice(0, -1) : ns))
      .filter(ns => ns.toLowerCase().endsWith(suffix.toLowerCase()))
      .map(ns => {
        const label = ns.slice(0, -suffix.length) || '@';
        return label === '@' ? null : `${label.padEnd(8)} IN  A       ${ip}`;
      })
      .filter((line): line is string => Boolean(line))
      .join('\n');

    try {
      // Ensure the zones directory exists before writing the zone file.
      try {
        await fs.mkdir(this.zonesPath, { recursive: true });
      } catch (error: any) {
        // Directory might already exist, that's okay
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }

      // Create zone file content
      // Use the first configured nameserver for SOA, not a hardcoded ns1.{domain}
      const soaNs = nsList[0] ? `${nsList[0]}.` : `ns1.${domain}.`;
      const zoneContent = `; Zone file for ${domain}
$TTL 86400
@   IN  SOA ${soaNs} admin.${domain}. (
        ${serial}   ; Serial
        3600        ; Refresh
        1800        ; Retry
        604800      ; Expire
        86400 )     ; Minimum TTL

; Name servers
${nsRecords}

; A records for nameservers
${nsARecords || '; (external nameserver hostnames – no local A records created)'}

; Main domain A record
@       IN  A       ${ip}
www     IN  CNAME   ${domain}.
`;

      // Write zone file using Node.js fs (preferred). Requires clearpanel user to have bind group write access.
      try {
        await fs.writeFile(zoneFile, zoneContent, { encoding: 'utf8', mode: 0o644 });
      } catch (error: any) {
        if (error?.code === 'EACCES') {
          throw new Error(
            `Permission denied writing ${zoneFile}. ` +
              `Fix: ensure /etc/bind/zones is group-owned by 'bind' and mode 2775, ` +
              `and the clearpanel service user is in the 'bind' group (systemd SupplementaryGroups=bind).`,
          );
        }
        throw error;
      }
      
      // Try to set ownership (may fail if not root, but that's okay if permissions are set correctly)
      try {
        await execAsync(`chown bind:bind ${zoneFile} 2>/dev/null || chown named:named ${zoneFile} 2>/dev/null || true`, { timeout: 10_000 });
      } catch {
        // Ignore chown errors - file permissions should be sufficient
      }

      // Add zone to named.conf.local
      await this.addZoneToConfig(domain, zoneFile);

      // Reload BIND
      await this.reload();

      this.logger.log(`DNS zone created for ${domain}`);
      return { success: true, message: `DNS zone created for ${domain}` };
    } catch (error: any) {
      this.logger.error(`Failed to create zone for ${domain}`, error);
      return { success: false, message: `Failed to create zone: ${error?.message || 'Unknown error'}` };
    }
  }

  async deleteZone(domain: string): Promise<{ success: boolean; message: string }> {
    const status = await this.getStatus();
    if (!status.installed) {
      return { success: false, message: 'BIND9 is not installed' };
    }

    try {
      const zoneFile = path.join(this.zonesPath, `db.${domain}`);

      // Remove zone from named.conf.local
      await this.removeZoneFromConfig(domain);

      // Delete zone file using Node.js fs
      try {
        await fs.unlink(zoneFile);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          // File doesn't exist is okay, other errors should be reported
          throw error;
        }
      }

      // Reload BIND
      await this.reload();

      this.logger.log(`DNS zone deleted for ${domain}`);
      return { success: true, message: `DNS zone deleted for ${domain}` };
    } catch (error: any) {
      this.logger.error(`Failed to delete zone for ${domain}`, error);
      return { success: false, message: `Failed to delete zone: ${error?.message || 'Unknown error'}` };
    }
  }

  async reload(): Promise<void> {
    const serviceName = await this.getServiceName();
    try {
      // Try without sudo first (if user has permissions)
      try {
        await execAsync(`systemctl reload ${serviceName}`, { timeout: 30_000 });
        this.logger.log('BIND9 reloaded successfully');
        return;
      } catch {
        // If that fails, try with sudo (may fail due to NoNewPrivileges)
        try {
          await execAsync(`sudo systemctl reload ${serviceName}`, { timeout: 30_000 });
          this.logger.log('BIND9 reloaded successfully');
          return;
        } catch (sudoError) {
          this.logger.warn('BIND9 reload failed, trying restart', sudoError);
          // Try restart without sudo
          try {
            await execAsync(`systemctl restart ${serviceName}`, { timeout: 30_000 });
            return;
          } catch {
            // Last resort: try restart with sudo
            await execAsync(`sudo systemctl restart ${serviceName}`, { timeout: 30_000 });
          }
        }
      }
    } catch (error) {
      this.logger.error('BIND9 reload/restart failed completely', error);
      // Don't throw - zone files are created, just need manual reload
      this.logger.warn('Zone files created but BIND9 needs manual reload. Run: sudo systemctl reload bind9');
    }
  }

  async getNameserverInstructions(domain: string, nameservers?: string[]): Promise<NameserverInfo> {
    const ip = this.configService.get<string>('SERVER_IP') || '0.0.0.0';
    const nsList = (nameservers && nameservers.length ? nameservers : [`ns1.${domain}`, `ns2.${domain}`])
      .map(ns => (ns.endsWith('.') ? ns.slice(0, -1) : ns));

    const bullet = nsList
      .map((ns, idx) => `   - Nameserver ${idx + 1}: ${ns}`)
      .join('\n');

    const glue = nsList
      .map(ns => `   - ${ns} → ${ip}`)
      .join('\n');

    return {
      nameservers: nsList,
      ip,
      instructions: `
To use this VPS as your DNS server:

1. At your domain registrar, set custom nameservers:
${bullet}

2. Create glue records (required):
${glue}

3. DNS propagation may take 24-48 hours.

4. Verify with: dig @${ip} ${domain}
`.trim()
    };
  }

  private async addZoneToConfig(domain: string, zoneFile: string): Promise<void> {
    const zoneBlock = `\nzone "${domain}" {\n    type master;\n    file "${zoneFile}";\n    allow-transfer { any; };\n};\n`;

    // Read existing content (or start empty)
    let content = '';
    try {
      content = await fs.readFile(this.namedConfPath, 'utf8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.warn(`Error reading config file: ${error.message}`);
      }
    }

    // Check if zone already exists
    if (content.includes(`zone "${domain}"`)) {
      this.logger.log(`Zone ${domain} already in config, skipping`);
      return;
    }

    // Sanitize any stray closing braces before appending
    content = this.sanitizeNamedConf(content);

    // Append zone block
    const newContent = content.trimEnd() + '\n' + zoneBlock;
    await fs.writeFile(this.namedConfPath, newContent, 'utf8');
  }

  /**
   * Remove orphaned `};` lines that are not part of a valid zone block.
   * These can appear if zone removal regex partially matches.
   */
  private sanitizeNamedConf(content: string): string {
    // Split into lines and remove lines that are only `};` but not inside a zone block
    const lines = content.split('\n');
    const result: string[] = [];
    let insideZone = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^zone\s+"/.test(trimmed)) {
        insideZone = true;
        result.push(line);
      } else if (insideZone && trimmed === '};') {
        // This closes a zone block
        result.push(line);
        insideZone = false;
      } else if (!insideZone && trimmed === '};') {
        // Orphaned }; — skip it
        this.logger.warn('Removed orphaned "};\ from named.conf.local');
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  private async removeZoneFromConfig(domain: string): Promise<void> {
    // Remove zone block from named.conf.local using Node.js
    try {
      let content = await fs.readFile(this.namedConfPath, 'utf8');
      // Use a regex that handles nested braces (e.g. allow-transfer { any; })
      const escapedDomain = domain.replace(/\./g, '\\.');
      const zoneRegex = new RegExp(
        `\\n?zone\\s+"${escapedDomain}"\\s*\\{[\\s\\S]*?\\};\\s*`,
        'g',
      );
      content = content.replace(zoneRegex, '\n');
      // Sanitize any leftover orphaned };
      content = this.sanitizeNamedConf(content);
      await fs.writeFile(this.namedConfPath, content, 'utf8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to remove zone from config: ${error.message}`);
        throw error;
      }
      // File doesn't exist, nothing to remove
    }
  }

  private async getServiceName(): Promise<string> {
    // BIND service is called 'named' on RHEL/CentOS, 'bind9' on Debian/Ubuntu
    try {
      await execAsync('systemctl list-units --type=service | grep bind9', { timeout: 10_000 });
      return 'bind9';
    } catch {
      return 'named';
    }
  }

  private generateSerial(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    // Use HHMMSS to derive a 2-digit sequence so serials always increment
    const hh = now.getHours();
    const mm = now.getMinutes();
    const ss = now.getSeconds();
    const seq = String(Math.floor((hh * 3600 + mm * 60 + ss) / 864)).padStart(2, '0'); // 0-99 mapped from seconds-of-day
    return `${year}${month}${day}${seq}`;
  }

  /**
   * Sync a BIND9 zone file from the canonical DNS records stored in dns.json.
   * Called whenever records are added, updated, or deleted via the DNS module.
   */
  async syncZoneFromRecords(
    domain: string,
    records: Array<{ type: string; name: string; value: string; ttl: number; priority?: number }>,
  ): Promise<{ success: boolean; message: string }> {
    const status = await this.getStatus();
    if (!status.installed) {
      return { success: false, message: 'BIND9 is not installed — zone file not synced' };
    }

    const zoneFile = path.join(this.zonesPath, `db.${domain}`);

    // Check if zone file exists — only sync if BIND9 is managing this domain
    try {
      await fs.access(zoneFile);
    } catch {
      return { success: false, message: `No BIND9 zone file for ${domain} — skipping sync` };
    }

    const serial = this.generateSerial();

    // Extract NS records and determine SOA primary
    const nsRecords = records.filter(r => r.type === 'NS' && r.name === '@');
    const soaNs = nsRecords.length > 0
      ? (nsRecords[0].value.endsWith('.') ? nsRecords[0].value : `${nsRecords[0].value}.`)
      : `ns1.${domain}.`;

    // Build zone content from records
    let zoneContent = `; Zone file for ${domain} — auto-synced from clearPanel
; Last synced: ${new Date().toISOString()}
$TTL 86400
@   IN  SOA ${soaNs} admin.${domain}. (
        ${serial}   ; Serial
        3600        ; Refresh
        1800        ; Retry
        604800      ; Expire
        86400 )     ; Minimum TTL

`;

    for (const rec of records) {
      const name = rec.name === '@' ? '@' : rec.name;
      const padName = name.padEnd(8);
      const ttl = rec.ttl || 3600;

      switch (rec.type) {
        case 'A':
        case 'AAAA':
          zoneContent += `${padName} ${ttl}  IN  ${rec.type.padEnd(6)}  ${rec.value}\n`;
          break;
        case 'CNAME': {
          const val = rec.value.endsWith('.') ? rec.value : `${rec.value}.`;
          zoneContent += `${padName} ${ttl}  IN  CNAME   ${val}\n`;
          break;
        }
        case 'MX': {
          const priority = rec.priority ?? 10;
          const val = rec.value.endsWith('.') ? rec.value : `${rec.value}.`;
          zoneContent += `${padName} ${ttl}  IN  MX      ${priority} ${val}\n`;
          break;
        }
        case 'TXT':
          zoneContent += `${padName} ${ttl}  IN  TXT     "${rec.value.replace(/"/g, '\\"')}"\n`;
          break;
        case 'NS': {
          const val = rec.value.endsWith('.') ? rec.value : `${rec.value}.`;
          zoneContent += `${padName} ${ttl}  IN  NS      ${val}\n`;
          break;
        }
        case 'SRV': {
          const val = rec.value.endsWith('.') ? rec.value : `${rec.value}.`;
          zoneContent += `${padName} ${ttl}  IN  SRV     ${rec.priority ?? 0} ${val}\n`;
          break;
        }
        case 'CAA':
          zoneContent += `${padName} ${ttl}  IN  CAA     ${rec.value}\n`;
          break;
        default:
          zoneContent += `; Unsupported record type: ${rec.type} ${rec.name} ${rec.value}\n`;
      }
    }

    try {
      await fs.writeFile(zoneFile, zoneContent, { encoding: 'utf8', mode: 0o644 });

      // Try to set ownership
      try {
        await execAsync(`chown bind:bind ${zoneFile} 2>/dev/null || chown named:named ${zoneFile} 2>/dev/null || true`, { timeout: 10_000 });
      } catch { /* ignore */ }

      await this.reload();
      this.logger.log(`BIND9 zone synced for ${domain} (${records.length} records)`);
      return { success: true, message: `Zone file synced for ${domain}` };
    } catch (error: any) {
      this.logger.error(`Failed to sync BIND9 zone for ${domain}`, error);
      return { success: false, message: `Failed to sync zone: ${error?.message || 'Unknown error'}` };
    }
  }
}
