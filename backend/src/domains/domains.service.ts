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
import { MailService, MailDomainResult } from '../mail/mail.service';
import { DirectoryStructureService } from '../files/directory-structure.service';
import { getDataFilePath } from '../common/paths';

export interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

interface DomainCreationResult {
  domain: Domain;
  logs: AutomationLog[];
  mailDomain?: MailDomainResult['domain'];
  mailAutomationLogs?: AutomationLog[];
}

interface DomainDeletionResult {
  domain: Domain;
  logs: AutomationLog[];
  mailAutomationLogs?: AutomationLog[];
}

@Injectable()
export class DomainsService {
  constructor(
    private readonly dnsService: DnsService,
    private readonly webServerService: WebServerService,
    private readonly dnsServerService: DnsServerService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly mailService: MailService,
    private readonly directoryStructureService: DirectoryStructureService,
  ) { }
  private async readDomains(): Promise<Domain[]> {
    try {
      const data = await fs.readFile(getDataFilePath('domains.json'), 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeDomains(domains: Domain[]): Promise<void> {
    await fs.mkdir(path.dirname(getDataFilePath('domains.json')), { recursive: true });
    await fs.writeFile(getDataFilePath('domains.json'), JSON.stringify(domains, null, 2));
  }

  async addDomain(username: string, name: string, folderPath?: string, customNameservers?: string[], pathMode?: string): Promise<DomainCreationResult> {
    const domains = await this.readDomains();
    const logs: AutomationLog[] = [];

    const normalizedName = name.trim().toLowerCase();
    const existing = domains.find((d) => d.name.trim().toLowerCase() === normalizedName);
    if (existing) {
      logs.push({
        task: 'Domain exists',
        success: true,
        message: `Domain ${name} already exists; attempting to ensure DNS/BIND/Nginx are configured`,
      });
      // Continue using existing metadata to (re)provision below.
      name = existing.name;
    }

    const serverSettings = await this.serverSettingsService.getSettings();
    const userRoot = this.resolveUserRootPath(username);
    const isPrimaryDomain = serverSettings.primaryDomain?.toLowerCase() === name.toLowerCase();

    let finalPath: string;
    let pathMessage: string;

    if (folderPath) {
      // User specified custom path
      finalPath = folderPath;
      pathMessage = `Using custom path: ${finalPath}`;
    } else if (isPrimaryDomain) {
      // Primary domain uses public_html directly inside user home
      finalPath = path.join(userRoot.path, 'public_html');
      pathMessage = `Primary domain - document root: ${finalPath}`;
    } else if (pathMode === 'public_html') {
      // Place domain folder inside public_html
      finalPath = path.join(userRoot.path, 'public_html', name);
      pathMessage = `Addon domain - creating folder: ~/public_html/${name}`;
    } else {
      // Default: addon domains go directly in user home ~/{domain.com}
      finalPath = path.join(userRoot.path, name);
      pathMessage = `Addon domain - creating folder: ~/${name}`;
    }

    logs.push({
      task: 'Determine folder path',
      success: true,
      message: pathMessage,
    });

    const nameserverSelection = this.resolveNameservers(customNameservers, serverSettings.nameservers, name);
    const nameservers = nameserverSelection.values;

    const serverIp = await this.serverSettingsService.getServerIp();

    const domain: Domain = existing
      ? {
        ...existing,
        folderPath: existing.folderPath || finalPath,
        nameservers: nameservers.length ? nameservers : existing.nameservers,
      }
      : {
        id: randomUUID(),
        name,
        folderPath: finalPath,
        createdAt: new Date(),
        nameservers,
      };

    const nameserverMessage = (() => {
      switch (nameserverSelection.source) {
        case 'custom':
          return `Using custom nameservers: ${nameservers.join(', ')}`;
        case 'global':
          return `Using global nameservers from server settings: ${nameservers.join(', ')}`;
        default:
          return `Using fallback nameservers: ${nameservers.join(', ')}`;
      }
    })();

    logs.push({
      task: 'Configure nameservers',
      success: true,
      message: nameserverMessage,
    });

    // Log internet accessibility summary
    logs.push({
      task: 'Internet accessibility',
      success: true,
      message: `Domain ${name} will be configured with A record → ${serverIp}, Nginx vhost, and DNS zone. ` +
        `Nameservers: ${nameservers.join(', ')}`,
      detail: nameserverSelection.source === 'fallback'
        ? 'Warning: Using domain-based fallback nameservers. Configure VPS nameservers in Settings for proper DNS resolution.'
        : undefined,
    });

    // Create folder with cPanel-like structure
    try {
      await fs.mkdir(domain.folderPath, { recursive: true });

      // Create domain-specific subdirectories and default files
      await this.directoryStructureService.createDomainStructure(domain.folderPath, domain.name);

      logs.push({
        task: 'Ensure document root',
        success: true,
        message: `Directory created at ${domain.folderPath} with default structure`,
      });
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

    // Ensure nginx virtual host (idempotent)
    try {
      const vhostResult = await this.webServerService.ensureVirtualHost(name, domain.folderPath);
      console.log(`Virtual host setup: ${vhostResult.message}`);
      logs.push({
        task: vhostResult.created ? 'Create Nginx virtual host' : 'Ensure Nginx virtual host',
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

    if (!existing) {
      domains.push(domain);
      await this.writeDomains(domains);
    } else {
      // Persist any updated folderPath/nameservers if needed.
      const idx = domains.findIndex((d) => d.id === existing.id);
      if (idx !== -1) {
        domains[idx] = domain;
        await this.writeDomains(domains);
      }
    }

    let mailResult: MailDomainResult | undefined;
    try {
      mailResult = await this.mailService.createDomain(name);
      const convertedLogs = mailResult.automationLogs.map((log) => ({
        task: log.task,
        success: log.success,
        message: log.message,
        detail: log.detail,
      }));
      logs.push(...convertedLogs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('already exists')) {
        const existingDomains = await this.mailService.listDomains();
        const existing = existingDomains.find((entry) => entry.domain === name);
        if (existing) {
          logs.push({
            task: 'Provision mail domain',
            success: true,
            message: `Mail domain ${name} already exists; reusing configuration`,
          });
          mailResult = {
            domain: existing,
            automationLogs: [],
          };
        } else {
          logs.push({
            task: 'Provision mail domain',
            success: false,
            message: 'Mail domain reported as existing but could not be loaded',
            detail: message,
          });
        }
      } else {
        logs.push({
          task: 'Provision mail domain',
          success: false,
          message: 'Failed to provision mail services',
          detail: message,
        });
      }
    }

    return {
      domain,
      logs,
      mailDomain: mailResult?.domain,
      mailAutomationLogs: mailResult?.automationLogs.map((log) => ({
        task: log.task,
        success: log.success,
        message: log.message,
        detail: log.detail,
      })),
    };
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

  async updateDomain(id: string, updates: { folderPath?: string; nameservers?: string[] }): Promise<Domain | null> {
    const domains = await this.readDomains();
    const domain = domains.find((d) => d.id === id);
    if (!domain) return null;
    if (updates.folderPath !== undefined) {
      domain.folderPath = updates.folderPath;
      await fs.mkdir(updates.folderPath, { recursive: true });
    }
    if (updates.nameservers !== undefined) {
      domain.nameservers = updates.nameservers.filter(Boolean);
    }
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

    let mailAutomationLogs: AutomationLog[] | undefined;
    try {
      const mailDomains = await this.mailService.listDomains();
      const targetMailDomain = mailDomains.find((item) => item.domain === domain.name);
      if (targetMailDomain) {
        const result = await this.mailService.deleteDomain(targetMailDomain.id);
        mailAutomationLogs = result.automationLogs.map((log) => ({
          task: log.task,
          success: log.success,
          message: log.message,
          detail: log.detail,
        }));
        logs.push(...mailAutomationLogs);
      } else {
        logs.push({
          task: 'Remove mail domain',
          success: true,
          message: `Mail domain ${domain.name} not registered; nothing to remove`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push({
        task: 'Remove mail domain',
        success: false,
        message: 'Failed to remove mail domain',
        detail: message,
      });
    }

    // Remove from list
    domains.splice(domainIndex, 1);
    await this.writeDomains(domains);

    logs.push({
      task: 'Update domains.json',
      success: true,
      message: `Removed ${domain.name} from domains.json`,
    });

    return { domain, logs, mailAutomationLogs };
  }

  private resolveUserRootPath(username: string): { path: string; base: string; source: 'env' | 'default' } {
    const safeUsername = (username ?? '').trim() || 'default';
    const envRoot = process.env.ROOT_PATH?.trim();
    if (envRoot && envRoot.length > 0) {
      const normalized = path.resolve(envRoot);
      return {
        path: path.join(normalized, safeUsername),
        base: normalized,
        source: 'env',
      };
    }
    const defaultBase = '/home/clearpanel';
    return {
      path: path.join(defaultBase, safeUsername),
      base: defaultBase,
      source: 'default',
    };
  }

  /** @deprecated Domains now go inside user home dir. Kept for reference. */
  private resolveDomainsRoot(): { path: string; source: 'env' | 'default' } {
    const envRoot = process.env.DOMAINS_ROOT?.trim();
    if (envRoot && envRoot.length > 0) {
      return {
        path: path.resolve(envRoot),
        source: 'env',
      };
    }
    return {
      path: path.join(os.homedir(), 'clearpanel-domains'),
      source: 'default',
    };
  }

  private resolveNameservers(
    customNameservers: string[] | undefined,
    globalNameservers: string[] | undefined,
    domain: string,
  ): { values: string[]; source: 'custom' | 'global' | 'fallback' } {
    const custom = this.normalizeNameservers(customNameservers ?? []);
    if (custom.length > 0) {
      return { values: custom, source: 'custom' };
    }

    const global = this.normalizeNameservers(globalNameservers ?? []);
    if (global.length > 0) {
      return { values: global, source: 'global' };
    }

    // Fallback: use ns1/ns2.{domain} only as a last resort.
    // This should rarely happen if VPS nameservers are configured in server-settings.
    console.warn(
      `[DomainsService] No global nameservers configured in server settings. ` +
      `Falling back to ns1.${domain} / ns2.${domain}. ` +
      `Configure your VPS nameservers via Settings → Nameservers for proper internet accessibility.`,
    );
    const fallback = this.normalizeNameservers([`ns1.${domain}`, `ns2.${domain}`]);
    return { values: fallback, source: 'fallback' };
  }

  private normalizeNameservers(values: string[]): string[] {
    const normalized = values
      .map((ns) => ns.trim().toLowerCase())
      .filter((ns) => ns.length > 0)
      .map((ns) => (ns.endsWith('.') ? ns.slice(0, -1) : ns));
    return Array.from(new Set(normalized));
  }
}
