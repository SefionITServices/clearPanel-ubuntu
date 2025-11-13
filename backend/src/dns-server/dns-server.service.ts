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
  ns1: string;
  ns2: string;
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
      const { stdout } = await execAsync('named -v 2>&1 || true');
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
        const { stdout } = await execAsync('systemctl is-active named || systemctl is-active bind9 || true');
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
        await execAsync('which apt-get');
        installCmd = 'apt-get update && apt-get install -y bind9 bind9utils bind9-doc';
      } catch {
        try {
          await execAsync('which dnf');
          installCmd = 'dnf install -y bind bind-utils';
        } catch {
          return { success: false, message: 'Unsupported package manager. Please install BIND9 manually.' };
        }
      }

      const { stdout, stderr } = await execAsync(`sudo ${installCmd}`);
      
      // Create zones directory
      await execAsync(`sudo mkdir -p ${this.zonesPath}`);
      await execAsync(`sudo chown -R bind:bind ${this.zonesPath} || sudo chown -R named:named ${this.zonesPath} || true`);

      // Enable and start the service
      const serviceName = await this.getServiceName();
      await execAsync(`sudo systemctl enable ${serviceName}`);
      await execAsync(`sudo systemctl start ${serviceName}`);

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

  async createZone(domain: string, serverIp?: string): Promise<{ success: boolean; message: string }> {
    const status = await this.getStatus();
    if (!status.installed) {
      return { success: false, message: 'BIND9 is not installed. Please install it first.' };
    }

    const ip = serverIp || this.configService.get<string>('SERVER_IP') || '0.0.0.0';
    const serial = this.generateSerial();
    const zoneFile = path.join(this.zonesPath, `db.${domain}`);

    try {
      // Create zone file content
      const zoneContent = `
; Zone file for ${domain}
$TTL 86400
@   IN  SOA ns1.${domain}. admin.${domain}. (
        ${serial}   ; Serial
        3600        ; Refresh
        1800        ; Retry
        604800      ; Expire
        86400 )     ; Minimum TTL

; Name servers
@       IN  NS      ns1.${domain}.
@       IN  NS      ns2.${domain}.

; A records for nameservers
ns1     IN  A       ${ip}
ns2     IN  A       ${ip}

; Main domain A record
@       IN  A       ${ip}
www     IN  A       ${ip}
`;

      // Write zone file
      await execAsync(`sudo bash -c 'echo "${zoneContent.replace(/'/g, "'\\''")} " > ${zoneFile}'`);
      await execAsync(`sudo chown bind:bind ${zoneFile} || sudo chown named:named ${zoneFile} || true`);
      await execAsync(`sudo chmod 644 ${zoneFile}`);

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

      // Delete zone file
      await execAsync(`sudo rm -f ${zoneFile}`);

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
      await execAsync(`sudo systemctl reload ${serviceName}`);
      this.logger.log('BIND9 reloaded successfully');
    } catch (error) {
      this.logger.warn('BIND9 reload failed, trying restart', error);
      await execAsync(`sudo systemctl restart ${serviceName}`);
    }
  }

  async getNameserverInstructions(domain: string): Promise<NameserverInfo> {
    const ip = this.configService.get<string>('SERVER_IP') || '0.0.0.0';
    
    return {
      ns1: `ns1.${domain}`,
      ns2: `ns2.${domain}`,
      ip,
      instructions: `
To use this VPS as your DNS server:

1. At your domain registrar, set custom nameservers:
   - Nameserver 1: ns1.${domain}
   - Nameserver 2: ns2.${domain}

2. Create glue records (required):
   - ns1.${domain} → ${ip}
   - ns2.${domain} → ${ip}

3. DNS propagation may take 24-48 hours.

4. Verify with: dig @${ip} ${domain}
`.trim()
    };
  }

  private async addZoneToConfig(domain: string, zoneFile: string): Promise<void> {
    const zoneBlock = `
zone "${domain}" {
    type master;
    file "${zoneFile}";
    allow-transfer { any; };
};
`;

    // Check if zone already exists
    try {
      const { stdout } = await execAsync(`sudo grep -q 'zone "${domain}"' ${this.namedConfPath} && echo exists || echo new`);
      if (stdout.trim() === 'exists') {
        this.logger.log(`Zone ${domain} already in config, skipping`);
        return;
      }
    } catch (error) {
      // File might not exist or grep failed, continue
    }

    await execAsync(`sudo bash -c 'echo "${zoneBlock.replace(/'/g, "'\\''")} " >> ${this.namedConfPath}'`);
  }

  private async removeZoneFromConfig(domain: string): Promise<void> {
    // Remove zone block from named.conf.local
    const sedCmd = `sudo sed -i '/^zone "${domain}"/,/^};/d' ${this.namedConfPath}`;
    await execAsync(sedCmd);
  }

  private async getServiceName(): Promise<string> {
    // BIND service is called 'named' on RHEL/CentOS, 'bind9' on Debian/Ubuntu
    try {
      await execAsync('systemctl list-units --type=service | grep bind9');
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
    const seq = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    return `${year}${month}${day}${seq}`;
  }
}
