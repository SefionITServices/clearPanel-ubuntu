import { Injectable } from '@nestjs/common';
import { DnsService } from '../dns/dns.service';
import { WebServerService } from '../webserver/webserver.service';
import { DnsServerService } from '../dns-server/dns-server.service';
import { Domain } from './domain.model';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as os from 'os';
import { ServerSettingsService } from '../server/server-settings.service';

const DOMAINS_FILE = path.join(process.cwd(), 'domains.json');
const DOMAINS_ROOT = process.env.DOMAINS_ROOT || path.join(os.homedir(), 'clearpanel-domains');

export interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

interface DomainCreationResult {
  domain: Domain;
  logs: AutomationLog[];
}

interface DomainDeletionResult {
  domain: Domain;
  logs: AutomationLog[];
}

@Injectable()
export class DomainsService {
  constructor(
    private readonly dnsService: DnsService,
    private readonly webServerService: WebServerService,
    private readonly dnsServerService: DnsServerService,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}
  private async readDomains(): Promise<Domain[]> {
    try {
      const data = await fs.readFile(DOMAINS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeDomains(domains: Domain[]): Promise<void> {
    await fs.writeFile(DOMAINS_FILE, JSON.stringify(domains, null, 2));
  }

  async addDomain(name: string, folderPath?: string, customNameservers?: string[]): Promise<DomainCreationResult> {
    const domains = await this.readDomains();
    const logs: AutomationLog[] = [];
    
    // Use provided path or default to DOMAINS_ROOT/domainname
    const defaultPath = path.join(DOMAINS_ROOT, name);
    const finalPath = folderPath || defaultPath;

    const nameservers = Array.from(
      new Set(
        (customNameservers || [])
          .map((ns) => ns.trim())
          .filter((ns) => ns.length > 0)
          .map((ns) => (ns.endsWith('.') ? ns.slice(0, -1) : ns))
      )
    );

    const serverIp = await this.serverSettingsService.getServerIp();
    
    const domain: Domain = {
      id: randomUUID(),
      name,
      folderPath: finalPath,
      createdAt: new Date(),
      nameservers: nameservers.length ? nameservers : undefined,
    };

    logs.push({
      task: 'Configure nameservers',
      success: true,
      message: nameservers.length
        ? `Using custom nameservers: ${nameservers.join(', ')}`
        : 'Using default nameservers ns1/ns2',
    });
    
    // Create folder if not exists
    try {
      await fs.mkdir(domain.folderPath, { recursive: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create directory ${domain.folderPath}:`, error);
      logs.push({
        task: 'Ensure document root',
        success: false,
        message: `Cannot create directory ${domain.folderPath}`,
        detail: errMsg,
      });
      throw new Error(`Cannot create domain directory: ${errMsg}`);
    }
    logs.push({
      task: 'Ensure document root',
      success: true,
      message: `Directory available at ${domain.folderPath}`,
    });
    
    // Ensure default DNS zone exists (A and CNAME records)
    try {
      const zone = await this.dnsService.ensureDefaultZone(name, {
        nameservers,
        serverIp,
      });
      logs.push({
        task: 'Ensure dns.json zone',
        success: true,
        message: `Zone contains ${zone.records.length} record(s)`,
      });
    } catch (e) {
      console.error('DNS zone creation failed:', e);
      logs.push({
        task: 'Ensure dns.json zone',
        success: false,
        message: 'Unable to seed default DNS records',
        detail: e instanceof Error ? e.message : String(e),
      });
      // Continue even if DNS fails
    }

    // Create BIND9 DNS zone (authoritative DNS server)
    try {
      const dnsServerStatus = await this.dnsServerService.getStatus();
      if (dnsServerStatus.installed && dnsServerStatus.running) {
  const zoneResult = await this.dnsServerService.createZone(name, serverIp, nameservers);
        console.log(`DNS server zone: ${zoneResult.message}`);
        logs.push({
          task: 'Create BIND9 zone',
          success: zoneResult.success,
          message: zoneResult.message,
        });
      } else {
        logs.push({
          task: 'Create BIND9 zone',
          success: false,
          message: 'BIND9 is not installed or not running',
          detail: dnsServerStatus.installed
            ? 'Service reported as stopped'
            : 'Service not installed',
        });
      }
    } catch (e) {
      console.error('DNS server zone creation failed:', e);
      logs.push({
        task: 'Create BIND9 zone',
        success: false,
        message: 'Failed while creating BIND9 zone',
        detail: e instanceof Error ? e.message : String(e),
      });
      // Continue even if DNS server fails
    }

    // Auto-create nginx virtual host
    try {
      const vhostResult = await this.webServerService.createVirtualHost(name, domain.folderPath);
      console.log(`Virtual host setup: ${vhostResult.message}`);
      logs.push({
        task: 'Create Nginx virtual host',
        success: vhostResult.success,
        message: vhostResult.message,
        detail: vhostResult.success ? undefined : vhostResult.message,
      });
    } catch (e) {
      console.error('Virtual host creation failed:', e);
      logs.push({
        task: 'Create Nginx virtual host',
        success: false,
        message: 'Failed while creating Nginx virtual host',
        detail: e instanceof Error ? e.message : String(e),
      });
      // Continue even if vhost fails
    }
    
    domains.push(domain);
    await this.writeDomains(domains);
    return { domain, logs };
  }

  async listDomains(): Promise<Domain[]> {
    return this.readDomains();
  }

  async updateDomainPath(id: string, newPath: string): Promise<Domain | null> {
    const domains = await this.readDomains();
    const domain = domains.find((d) => d.id === id);
    if (!domain) return null;
    domain.folderPath = newPath;
    await fs.mkdir(newPath, { recursive: true });
    await this.writeDomains(domains);
    return domain;
  }

  async deleteDomain(id: string): Promise<DomainDeletionResult | null> {
    const domains = await this.readDomains();
    const domainIndex = domains.findIndex((d) => d.id === id);
    if (domainIndex === -1) return null;
    
    const domain = domains[domainIndex];
    const logs: AutomationLog[] = [];
    
    // Remove DNS zone
    try {
      const deleted = await this.dnsService.deleteZone(domain.name);
      logs.push({
        task: 'Remove dns.json zone',
        success: deleted,
        message: deleted
          ? 'Deleted persistence entry from dns.json'
          : 'Zone not found in dns.json',
      });
    } catch (e) {
      console.error('Failed to delete DNS zone:', e);
      logs.push({
        task: 'Remove dns.json zone',
        success: false,
        message: 'Failed while removing dns.json entry',
        detail: e instanceof Error ? e.message : String(e),
      });
      // Continue even if DNS deletion fails
    }

    // Remove DNS server zone
    try {
      const dnsServerStatus = await this.dnsServerService.getStatus();
      if (dnsServerStatus.installed) {
        const zoneResult = await this.dnsServerService.deleteZone(domain.name);
        console.log(`DNS server zone removal: ${zoneResult.message}`);
        logs.push({
          task: 'Remove BIND9 zone',
          success: zoneResult.success,
          message: zoneResult.message,
        });
      } else {
        logs.push({
          task: 'Remove BIND9 zone',
          success: false,
          message: 'BIND9 is not installed',
        });
      }
    } catch (e) {
      console.error('Failed to delete DNS server zone:', e);
      logs.push({
        task: 'Remove BIND9 zone',
        success: false,
        message: 'Failed while removing BIND9 zone',
        detail: e instanceof Error ? e.message : String(e),
      });
      // Continue even if DNS server deletion fails
    }

    // Remove nginx virtual host
    try {
      const vhostResult = await this.webServerService.removeVirtualHost(domain.name);
      console.log(`Virtual host removal: ${vhostResult.message}`);
      logs.push({
        task: 'Remove Nginx virtual host',
        success: vhostResult.success,
        message: vhostResult.message,
        detail: vhostResult.success ? undefined : vhostResult.message,
      });
    } catch (e) {
      console.error('Failed to remove virtual host:', e);
      logs.push({
        task: 'Remove Nginx virtual host',
        success: false,
        message: 'Failed while removing Nginx virtual host',
        detail: e instanceof Error ? e.message : String(e),
      });
      // Continue even if vhost removal fails
    }
    
    // Remove from list
    domains.splice(domainIndex, 1);
    await this.writeDomains(domains);
    
    logs.push({
      task: 'Update domains.json',
      success: true,
      message: `Removed ${domain.name} from domains.json`,
    });

    return { domain, logs };
  }
}
