import { Injectable } from '@nestjs/common';
import { DnsService } from '../dns/dns.service';
import { WebServerService } from '../webserver/webserver.service';
import { DnsServerService } from '../dns-server/dns-server.service';
import { Domain } from './domain.model';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as os from 'os';

const DOMAINS_FILE = path.join(process.cwd(), 'domains.json');
const DOMAINS_ROOT = process.env.DOMAINS_ROOT || path.join(os.homedir(), 'clearpanel-domains');

@Injectable()
export class DomainsService {
  constructor(
    private readonly dnsService: DnsService,
    private readonly webServerService: WebServerService,
    private readonly dnsServerService: DnsServerService
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

  async addDomain(name: string, folderPath?: string): Promise<Domain> {
    const domains = await this.readDomains();
    
    // Use provided path or default to DOMAINS_ROOT/domainname
    const defaultPath = path.join(DOMAINS_ROOT, name);
    const finalPath = folderPath || defaultPath;
    
    const domain: Domain = {
      id: randomUUID(),
      name,
      folderPath: finalPath,
      createdAt: new Date(),
    };
    
    // Create folder if not exists
    try {
      await fs.mkdir(domain.folderPath, { recursive: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create directory ${domain.folderPath}:`, error);
      throw new Error(`Cannot create domain directory: ${errMsg}`);
    }
    
    // Ensure default DNS zone exists (A and CNAME records)
    try {
      await this.dnsService.ensureDefaultZone(name);
    } catch (e) {
      console.error('DNS zone creation failed:', e);
      // Continue even if DNS fails
    }

    // Create BIND9 DNS zone (authoritative DNS server)
    try {
      const dnsServerStatus = await this.dnsServerService.getStatus();
      if (dnsServerStatus.installed && dnsServerStatus.running) {
        const zoneResult = await this.dnsServerService.createZone(name);
        console.log(`DNS server zone: ${zoneResult.message}`);
      }
    } catch (e) {
      console.error('DNS server zone creation failed:', e);
      // Continue even if DNS server fails
    }

    // Auto-create nginx virtual host
    try {
      const vhostResult = await this.webServerService.createVirtualHost(name, domain.folderPath);
      console.log(`Virtual host setup: ${vhostResult.message}`);
    } catch (e) {
      console.error('Virtual host creation failed:', e);
      // Continue even if vhost fails
    }
    
    domains.push(domain);
    await this.writeDomains(domains);
    return domain;
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

  async deleteDomain(id: string): Promise<Domain | null> {
    const domains = await this.readDomains();
    const domainIndex = domains.findIndex((d) => d.id === id);
    if (domainIndex === -1) return null;
    
    const domain = domains[domainIndex];
    
    // Remove DNS zone
    try {
      await this.dnsService.deleteZone(domain.name);
    } catch (e) {
      console.error('Failed to delete DNS zone:', e);
      // Continue even if DNS deletion fails
    }

    // Remove DNS server zone
    try {
      const dnsServerStatus = await this.dnsServerService.getStatus();
      if (dnsServerStatus.installed) {
        const zoneResult = await this.dnsServerService.deleteZone(domain.name);
        console.log(`DNS server zone removal: ${zoneResult.message}`);
      }
    } catch (e) {
      console.error('Failed to delete DNS server zone:', e);
      // Continue even if DNS server deletion fails
    }

    // Remove nginx virtual host
    try {
      const vhostResult = await this.webServerService.removeVirtualHost(domain.name);
      console.log(`Virtual host removal: ${vhostResult.message}`);
    } catch (e) {
      console.error('Failed to remove virtual host:', e);
      // Continue even if vhost removal fails
    }
    
    // Remove from list
    domains.splice(domainIndex, 1);
    await this.writeDomains(domains);
    
    return domain;
  }
}
