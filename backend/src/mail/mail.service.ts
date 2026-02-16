import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { MailAlias, MailDomain, Mailbox } from './mail.model';
import { MailAutomationService, AutomationLog, DkimResult } from './mail-automation.service';
import { MailHistoryService, MailAutomationScope, MailAutomationHistoryRecord } from './mail-history.service';
import { MailStatusService, MailMetrics } from './mail-status.service';
import { ServerSettingsService } from '../server/server-settings.service';
import { DnsService } from '../dns/dns.service';
import { DnsServerService } from '../dns-server/dns-server.service';
import { getDataFilePath, getMailStateDir } from '../common/paths';

const DEFAULT_SPAM_THRESHOLD = 6.0;
const DEFAULT_GREYLISTING_DELAY_SECONDS = 300;

export interface MailDomainResult {
  domain: MailDomain;
  automationLogs: AutomationLog[];
}

interface DnsRecordSuggestion {
  type: 'MX' | 'A' | 'TXT';
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  description: string;
}

export interface DomainSettingsUpdate {
  spamThreshold?: number | null;
  greylistingEnabled?: boolean | null;
  greylistingDelaySeconds?: number | null;
  virusScanEnabled?: boolean | null;
}

type SanitizedDomainSettings = {
  spamThreshold?: number;
  greylistingEnabled?: boolean;
  greylistingDelaySeconds?: number;
  virusScanEnabled?: boolean;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly automation: MailAutomationService,
    private readonly serverSettings: ServerSettingsService,
    private readonly history: MailHistoryService,
    private readonly statusService: MailStatusService,
    private readonly dnsService: DnsService,
    private readonly dnsServerService: DnsServerService,
  ) {}

  async listDomains(): Promise<MailDomain[]> {
    const domains = await this.readDomains();
    return domains;
  }

  async getDomain(id: string): Promise<MailDomain | undefined> {
    const domains = await this.readDomains();
    return domains.find((entry) => entry.id === id);
  }

  async createDomain(domain: string, options?: DomainSettingsUpdate): Promise<MailDomainResult> {
    const normalized = this.normalizeDomain(domain);
    const logs: AutomationLog[] = [];

    const domains = await this.readDomains();
    if (domains.some((entry) => entry.domain === normalized)) {
      throw new Error(`Mail domain ${normalized} already exists`);
    }

    const timestamp = new Date().toISOString();

    const payload: MailDomain = {
      id: randomUUID(),
      domain: normalized,
      enabled: true,
      spamThreshold: DEFAULT_SPAM_THRESHOLD,
      greylistingEnabled: true,
      greylistingDelaySeconds: DEFAULT_GREYLISTING_DELAY_SECONDS,
      virusScanEnabled: true,
      dkimSelector: 'default',
      createdAt: timestamp,
      updatedAt: timestamp,
      mailboxes: [],
      aliases: [],
    };

    if (options) {
      const sanitizedOptions = this.sanitizeDomainSettings(options);
      if (sanitizedOptions?.spamThreshold !== undefined) {
        payload.spamThreshold = sanitizedOptions.spamThreshold;
      }
      if (sanitizedOptions?.greylistingEnabled !== undefined) {
        payload.greylistingEnabled = sanitizedOptions.greylistingEnabled;
      }
      if (sanitizedOptions?.greylistingDelaySeconds !== undefined) {
        payload.greylistingDelaySeconds = sanitizedOptions.greylistingDelaySeconds;
      }
      if (sanitizedOptions?.virusScanEnabled !== undefined) {
        payload.virusScanEnabled = sanitizedOptions.virusScanEnabled;
      }
    }

    this.applyDomainDefaults(payload);

    domains.push(payload);
    await this.writeDomains(domains);

    logs.push({
      task: 'Persist mail domain',
      success: true,
      message: `Domain ${normalized} stored in mail-domains.json`,
    });

    const automationLogs = [
      ...(await this.automation.ensureStack()),
      ...(await this.automation.provisionDomain(payload.domain)),
    ];

    const policyLogs = await this.automation.configureDomainPolicy(payload.domain, {
      spamThreshold: payload.spamThreshold,
      greylistingEnabled: payload.greylistingEnabled,
      greylistingDelaySeconds: payload.greylistingDelaySeconds,
      virusScanEnabled: payload.virusScanEnabled,
    });

    const selector = payload.dkimSelector ?? 'default';
    const dkim = await this.automation.getDkimRecord(payload.domain, selector);
    if (dkim) {
      payload.dkimSelector = dkim.selector;
      payload.dkimPublicKey = dkim.publicRecord;
      payload.dkimUpdatedAt = new Date().toISOString();
      logs.push({
        task: 'DKIM key generation',
        success: true,
        message: `Generated DKIM selector ${dkim.selector}`,
      });
      await this.writeDomains(domains);
    }

    const combinedLogs = [...logs, ...automationLogs, ...policyLogs];
    await this.storeAutomationLogs(payload, 'domain', payload.domain, combinedLogs);

    return { domain: payload, automationLogs: combinedLogs };
  }

  async updateDomainSettings(domainId: string, updates: DomainSettingsUpdate): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    const sanitized = this.sanitizeDomainSettings(updates);
    if (!sanitized) {
      throw new BadRequestException('Provide at least one setting to update');
    }

    let mutated = false;

    if (sanitized.spamThreshold !== undefined && sanitized.spamThreshold !== target.spamThreshold) {
      target.spamThreshold = sanitized.spamThreshold;
      mutated = true;
    }

    if (sanitized.greylistingEnabled !== undefined && sanitized.greylistingEnabled !== target.greylistingEnabled) {
      target.greylistingEnabled = sanitized.greylistingEnabled;
      mutated = true;
    }

    if (
      sanitized.greylistingDelaySeconds !== undefined &&
      sanitized.greylistingDelaySeconds !== target.greylistingDelaySeconds
    ) {
      target.greylistingDelaySeconds = sanitized.greylistingDelaySeconds;
      mutated = true;
    }

    if (sanitized.virusScanEnabled !== undefined && sanitized.virusScanEnabled !== target.virusScanEnabled) {
      target.virusScanEnabled = sanitized.virusScanEnabled;
      mutated = true;
    }

    if (!mutated) {
      throw new BadRequestException('No domain setting changes supplied');
    }

    target.updatedAt = new Date().toISOString();
    await this.writeDomains(domains);
    this.applyDomainDefaults(target);

    const persistLogs: AutomationLog[] = [
      {
        task: 'Persist mail domain',
        success: true,
        message: `Domain settings for ${target.domain} updated in mail-domains.json`,
      },
    ];

    const automationLogs = await this.automation.configureDomainPolicy(target.domain, {
      spamThreshold: target.spamThreshold,
      greylistingEnabled: target.greylistingEnabled,
      greylistingDelaySeconds: target.greylistingDelaySeconds,
      virusScanEnabled: target.virusScanEnabled,
    });

    const combinedLogs = [...persistLogs, ...automationLogs];
    await this.storeAutomationLogs(target, 'domain', target.domain, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async deleteDomain(id: string): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const index = domains.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new Error('Mail domain not found');
    }

    const target = domains[index];
    domains.splice(index, 1);
    await this.writeDomains(domains);

    const logs: AutomationLog[] = [
      {
        task: 'Persist mail domain',
        success: true,
        message: `Domain ${target.domain} removed from mail-domains.json`,
      },
    ];

    const automationLogs = await this.automation.removeDomain(target.domain);
    const combinedLogs = [...logs, ...automationLogs];
    await this.storeAutomationLogs(target, 'domain', target.domain, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async addMailbox(
    domainId: string,
    payload: { email: string; password?: string; passwordHash?: string; quotaMb?: number },
  ): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    let normalizedEmail = payload.email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      normalizedEmail = `${normalizedEmail}@${target.domain}`;
    }

    const parts = normalizedEmail.split('@');
    if (parts.length !== 2) {
      throw new Error('Mailbox email is invalid');
    }

    const domainPart = parts[1];
    if (domainPart !== target.domain) {
      throw new Error(`Mailbox must belong to ${target.domain}`);
    }

    if (target.mailboxes.some((mailbox) => mailbox.email === normalizedEmail)) {
      throw new Error(`Mailbox ${normalizedEmail} already exists`);
    }

    let passwordHash = payload.passwordHash?.trim();

    if (!passwordHash) {
      const password = payload.password;
      if (!password) {
        throw new Error('password or passwordHash is required');
      }
      const strongPassword = this.assertPasswordStrength(password);
      passwordHash = await this.automation.hashPassword(strongPassword);
    }

    if (!passwordHash) {
      throw new Error('Failed to determine password hash');
    }

    const quotaMb =
      typeof payload.quotaMb === 'number' && !Number.isNaN(payload.quotaMb)
        ? Math.max(0, Math.floor(payload.quotaMb))
        : undefined;

    const timestamp = new Date().toISOString();
    const mailbox: Mailbox = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      quotaMb,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    target.mailboxes.push(mailbox);
    await this.writeDomains(domains);

    const logs: AutomationLog[] = [
      {
        task: 'Persist mailbox',
        success: true,
        message: `Mailbox ${mailbox.email} stored in mail-domains.json`,
      },
    ];

    const automationLogs = await this.automation.provisionMailbox(
      target.domain,
      mailbox.email,
      mailbox.passwordHash,
      mailbox.quotaMb,
    );
    const combinedLogs = [...logs, ...automationLogs];
    await this.storeAutomationLogs(target, 'mailbox', mailbox.email, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async updateMailbox(
    domainId: string,
    mailboxId: string,
    payload: { password?: string; passwordHash?: string; quotaMb?: number | null },
  ): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    const mailbox = target.mailboxes.find((entry) => entry.id === mailboxId);
    if (!mailbox) {
      throw new Error('Mailbox not found');
    }

    let passwordHash = payload.passwordHash?.trim();
    let updated = false;

    if (!passwordHash && payload.password) {
      const strongPassword = this.assertPasswordStrength(payload.password);
      passwordHash = await this.automation.hashPassword(strongPassword);
    }

    if (passwordHash) {
      mailbox.passwordHash = passwordHash;
      updated = true;
    }

    if (payload.quotaMb !== undefined) {
      if (payload.quotaMb === null) {
        mailbox.quotaMb = undefined;
      } else if (typeof payload.quotaMb === 'number' && !Number.isNaN(payload.quotaMb)) {
        mailbox.quotaMb = Math.max(0, Math.floor(payload.quotaMb));
      } else {
        throw new Error('quotaMb must be a number or null');
      }
      updated = true;
    }

    if (!updated) {
      throw new Error('No mailbox updates supplied');
    }

    mailbox.updatedAt = new Date().toISOString();
    await this.writeDomains(domains);
    this.applyDomainDefaults(target);

    const logs: AutomationLog[] = [
      {
        task: 'Persist mailbox',
        success: true,
        message: `Mailbox ${mailbox.email} updated in mail-domains.json`,
      },
    ];

    const automationLogs = await this.automation.provisionMailbox(
      target.domain,
      mailbox.email,
      mailbox.passwordHash,
      mailbox.quotaMb,
    );
    const combinedLogs = [...logs, ...automationLogs];
    await this.storeAutomationLogs(target, 'mailbox', mailbox.email, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async removeMailbox(domainId: string, mailboxId: string): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    const index = target.mailboxes.findIndex((item) => item.id === mailboxId);
    if (index === -1) {
      throw new Error('Mailbox not found');
    }

    const [removed] = target.mailboxes.splice(index, 1);
    await this.writeDomains(domains);

    const logs: AutomationLog[] = [
      {
        task: 'Persist mailbox',
        success: true,
        message: `Mailbox ${removed.email} removed from mail-domains.json`,
      },
    ];

    const automationLogs = await this.automation.removeMailbox(target.domain, removed.email);
    const combinedLogs = [...logs, ...automationLogs];
    await this.storeAutomationLogs(target, 'mailbox', removed.email, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async addAlias(domainId: string, source: string, destination: string): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    const normalizedSource = this.normalizeAliasSource(source, target.domain);
    const normalizedDestination = destination.trim().toLowerCase();

    if (!normalizedDestination.includes('@')) {
      throw new Error('Alias destination must be a valid email address');
    }

    if (normalizedDestination === normalizedSource) {
      throw new Error('Alias destination cannot equal source');
    }

    if (target.aliases.some((alias) => alias.source === normalizedSource)) {
      throw new Error(`Alias ${normalizedSource} already exists`);
    }

    const alias: MailAlias = {
      id: randomUUID(),
      source: normalizedSource,
      destination: normalizedDestination,
      createdAt: new Date().toISOString(),
    };

    target.aliases.push(alias);
    await this.writeDomains(domains);

    const logs: AutomationLog[] = [
      {
        task: 'Persist alias',
        success: true,
        message: `Alias ${alias.source} → ${alias.destination} stored in mail-domains.json`,
      },
    ];

    const automationLogs = await this.automation.provisionAlias(target.domain, alias.source, alias.destination);
    const combinedLogs = [...logs, ...automationLogs];
    await this.storeAutomationLogs(target, 'alias', alias.source, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async removeAlias(domainId: string, aliasId: string): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    const index = target.aliases.findIndex((item) => item.id === aliasId);
    if (index === -1) {
      throw new Error('Alias not found');
    }

    const [removed] = target.aliases.splice(index, 1);
    await this.writeDomains(domains);

    const logs: AutomationLog[] = [
      {
        task: 'Persist alias',
        success: true,
        message: `Alias ${removed.source} removed from mail-domains.json`,
      },
    ];

    const automationLogs = await this.automation.removeAlias(target.domain, removed.source);
    const combinedLogs = [...logs, ...automationLogs];
    await this.storeAutomationLogs(target, 'alias', removed.source, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async updateAlias(
    domainId: string,
    aliasId: string,
    payload: { destination: string },
  ): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    const alias = target.aliases.find((entry) => entry.id === aliasId);
    if (!alias) {
      throw new Error('Alias not found');
    }

    const normalizedDestination = payload.destination.trim().toLowerCase();
    if (!normalizedDestination.includes('@')) {
      throw new Error('Alias destination must be a valid email address');
    }

    if (normalizedDestination === alias.source) {
      throw new Error('Alias destination cannot equal source');
    }

    alias.destination = normalizedDestination;
    alias.updatedAt = new Date().toISOString();
    await this.writeDomains(domains);

    const logs: AutomationLog[] = [
      {
        task: 'Persist alias',
        success: true,
        message: `Alias ${alias.source} updated to ${alias.destination}`,
      },
    ];

    const automationLogs = await this.automation.provisionAlias(target.domain, alias.source, alias.destination);
    const combinedLogs = [...logs, ...automationLogs];
    await this.storeAutomationLogs(target, 'alias', alias.source, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async getDnsSuggestions(domainId: string): Promise<{ domain: string; serverIp: string; records: DnsRecordSuggestion[] }> {
    const domain = await this.getDomain(domainId);
    if (!domain) {
      throw new Error('Mail domain not found');
    }

    const serverIp = await this.serverSettings.getServerIp();
    const mailHost = `mail.${domain.domain}`;
    const dkimSelector = domain.dkimSelector ?? 'default';

    const records: DnsRecordSuggestion[] = [
      {
        type: 'MX',
        name: '@',
        value: mailHost,
        ttl: 3600,
        priority: 10,
        description: 'Primary mail exchanger',
      },
      {
        type: 'A',
        name: 'mail',
        value: serverIp,
        ttl: 3600,
        description: 'Mail host A record',
      },
      {
        type: 'TXT',
        name: '@',
        value: `v=spf1 mx a ip4:${serverIp} ~all`,
        ttl: 3600,
        description: 'SPF policy allowing this server to send mail',
      },
      {
        type: 'TXT',
        name: `_dmarc`,
        value: `v=DMARC1; p=none; rua=mailto:abuse@${domain.domain}; ruf=mailto:abuse@${domain.domain}; fo=1`,
        ttl: 3600,
        description: 'DMARC monitor mode for initial deliverability validation',
      },
    ];

    if (domain.dkimPublicKey) {
      records.push({
        type: 'TXT',
        name: `${dkimSelector}._domainkey`,
        value: domain.dkimPublicKey,
        ttl: 3600,
        description: 'DKIM public key',
      });
    }

    return {
      domain: domain.domain,
      serverIp,
      records,
    };
  }

  async rotateDkim(domainId: string, selector?: string): Promise<MailDomainResult> {
    const domains = await this.readDomains();
    const target = domains.find((entry) => entry.id === domainId);
    if (!target) {
      throw new Error('Mail domain not found');
    }

    const desiredSelector = selector?.trim() || target.dkimSelector || 'default';

    const persistLogs: AutomationLog[] = [];

    const automationResult = await this.automation.rotateDkim(target.domain, desiredSelector);

    if (automationResult.result) {
      target.dkimSelector = automationResult.result.selector;
      target.dkimPublicKey = automationResult.result.publicRecord;
      target.dkimUpdatedAt = new Date().toISOString();
      await this.writeDomains(domains);
      persistLogs.push({
        task: 'Persist mail domain',
        success: true,
        message: `Stored DKIM selector ${target.dkimSelector}`,
      });
    }

    const combinedLogs = [...persistLogs, ...automationResult.logs];
    await this.storeAutomationLogs(target, 'dkim', target.domain, combinedLogs);

    return { domain: target, automationLogs: combinedLogs };
  }

  async getDomainLogs(
    domainId: string,
    limit?: number,
  ): Promise<{ domain: string; records: MailAutomationHistoryRecord[] }> {
    const domain = await this.getDomain(domainId);
    if (!domain) {
      throw new Error('Mail domain not found');
    }

    let safeLimit: number | undefined;
    if (typeof limit === 'number') {
      if (Number.isNaN(limit) || limit <= 0) {
        throw new BadRequestException('limit must be a positive integer');
      }
      safeLimit = Math.min(limit, 100);
    }

    const records = await this.history.list({ domainId, limit: safeLimit });
    return { domain: domain.domain, records };
  }

  private async readDomains(): Promise<MailDomain[]> {
    try {
      const payload = await fs.readFile(getDataFilePath('mail-domains.json'), 'utf-8');
      const data = JSON.parse(payload) as MailDomain[];
      data.forEach((domain) => this.applyDomainDefaults(domain));
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.writeDomains([]);
        return [];
      }
      this.logger.error('Failed to read mail domains', error as Error);
      throw error;
    }
  }

  private async writeDomains(domains: MailDomain[]): Promise<void> {
    domains.forEach((domain) => this.applyDomainDefaults(domain));
    const mailFile = getDataFilePath('mail-domains.json');
    await fs.mkdir(path.dirname(mailFile), { recursive: true });
    await fs.writeFile(mailFile, JSON.stringify(domains, null, 2), 'utf-8');
  }

  private sanitizeDomainSettings(payload: DomainSettingsUpdate): SanitizedDomainSettings | null {
    const result: SanitizedDomainSettings = {};
    let mutated = false;

    if (Object.prototype.hasOwnProperty.call(payload, 'spamThreshold')) {
      const value = payload.spamThreshold;
      result.spamThreshold =
        value === null || value === undefined
          ? DEFAULT_SPAM_THRESHOLD
          : this.sanitizeSpamThreshold(value);
      mutated = true;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'greylistingEnabled')) {
      const value = payload.greylistingEnabled;
      result.greylistingEnabled =
        value === null || value === undefined ? true : this.sanitizeBoolean(value, 'greylistingEnabled');
      mutated = true;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'greylistingDelaySeconds')) {
      const value = payload.greylistingDelaySeconds;
      result.greylistingDelaySeconds =
        value === null || value === undefined
          ? DEFAULT_GREYLISTING_DELAY_SECONDS
          : this.sanitizeGreylistingDelay(value);
      mutated = true;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'virusScanEnabled')) {
      const value = payload.virusScanEnabled;
      result.virusScanEnabled =
        value === null || value === undefined ? true : this.sanitizeBoolean(value, 'virusScanEnabled');
      mutated = true;
    }

    return mutated ? result : null;
  }

  private sanitizeSpamThreshold(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(numeric)) {
      throw new BadRequestException('spamThreshold must be a number between 0 and 20');
    }
    if (numeric < 0 || numeric > 20) {
      throw new BadRequestException('spamThreshold must be between 0 and 20');
    }
    return Number.parseFloat(numeric.toFixed(1));
  }

  private sanitizeGreylistingDelay(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(numeric)) {
      throw new BadRequestException('greylistingDelaySeconds must be an integer between 0 and 3600');
    }
    const integer = Math.round(numeric);
    if (integer < 0 || integer > 3600) {
      throw new BadRequestException('greylistingDelaySeconds must be between 0 and 3600 seconds');
    }
    return integer;
  }

  private sanitizeBoolean(value: unknown, field: string): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on', 'enable'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'off', 'disable'].includes(normalized)) {
        return false;
      }
    }
    throw new BadRequestException(`${field} must be a boolean value`);
  }

  private applyDomainDefaults(domain: MailDomain): void {
    if (typeof domain.spamThreshold !== 'number' || Number.isNaN(domain.spamThreshold)) {
      domain.spamThreshold = DEFAULT_SPAM_THRESHOLD;
    }
    if (typeof domain.greylistingEnabled !== 'boolean') {
      domain.greylistingEnabled = true;
    }
    if (
      typeof domain.greylistingDelaySeconds !== 'number' ||
      Number.isNaN(domain.greylistingDelaySeconds) ||
      domain.greylistingDelaySeconds < 0
    ) {
      domain.greylistingDelaySeconds = DEFAULT_GREYLISTING_DELAY_SECONDS;
    } else {
      domain.greylistingDelaySeconds = Math.round(domain.greylistingDelaySeconds);
    }
    if (typeof domain.virusScanEnabled !== 'boolean') {
      domain.virusScanEnabled = true;
    }
    if (!domain.updatedAt) {
      domain.updatedAt = domain.createdAt;
    }
  }

  private async storeAutomationLogs(
    domain: MailDomain,
    scope: MailAutomationScope,
    target: string,
    logs: AutomationLog[],
  ): Promise<void> {
    if (!logs.length) {
      return;
    }

    const base = Date.now();
    const records: Omit<MailAutomationHistoryRecord, 'id'>[] = logs.map((log, index) => ({
      domainId: domain.id,
      domain: domain.domain,
      scope,
      target,
      task: log.task,
      success: log.success,
      message: log.message,
      detail: log.detail,
      executedAt: new Date(base - index).toISOString(),
    }));

    await this.history.append(records);
  }

  private assertPasswordStrength(password: string): string {
    const trimmed = password.trim();
    const hasMinLength = trimmed.length >= 10;
    const hasUpper = /[A-Z]/.test(trimmed);
    const hasLower = /[a-z]/.test(trimmed);
    const hasDigit = /\d/.test(trimmed);
    const hasSymbol = /[^A-Za-z0-9]/.test(trimmed);

    if (!hasMinLength || !hasUpper || !hasLower || !hasDigit || !hasSymbol) {
      throw new BadRequestException(
        'Password must be at least 10 characters and include upper, lower, number, and symbol characters.',
      );
    }

    return trimmed;
  }

  private normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/\.$/, '');
  }

  private normalizeAliasSource(source: string, domain: string): string {
    const trimmed = source.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      return `${trimmed}@${domain}`;
    }
    const [local, aliasDomain] = trimmed.split('@');
    if (aliasDomain !== domain) {
      throw new Error(`Alias source must belong to ${domain}`);
    }
    if (!local) {
      throw new Error('Alias local part is required');
    }
    return trimmed;
  }

  // ---- TLS & Security Hardening (Phase 4) ----

  async setupMailTls(
    hostname: string,
    email: string,
    reuseExisting?: boolean,
  ): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.setupMailTls(hostname, email, reuseExisting);
    await this.history.log({
      scope: 'tls' as MailAutomationScope,
      action: 'setup-tls',
      target: hostname,
      logs,
    });
    return { automationLogs: logs };
  }

  async setupPostscreen(dryRun?: boolean): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.setupPostscreen(dryRun);
    await this.history.log({
      scope: 'security' as MailAutomationScope,
      action: 'setup-postscreen',
      target: 'postfix',
      logs,
    });
    return { automationLogs: logs };
  }

  async setupDmarc(
    domain: string,
    reportEmail?: string,
  ): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.setupDmarc(domain, reportEmail);
    await this.history.log({
      scope: 'security' as MailAutomationScope,
      action: 'setup-dmarc',
      target: domain,
      logs,
    });
    return { automationLogs: logs };
  }

  async getSecurityStatus(): Promise<{
    tls: { configured: boolean; hostname?: string; certDir?: string; configuredAt?: string };
    postscreen: { enabled: boolean; configuredAt?: string };
    dmarc: { domains: string[]; configuredAt?: string };
  }> {
    const stateRoot = getMailStateDir();

    const result = {
      tls: { configured: false } as { configured: boolean; hostname?: string; certDir?: string; configuredAt?: string },
      postscreen: { enabled: false } as { enabled: boolean; configuredAt?: string },
      dmarc: { domains: [] as string[], configuredAt: undefined as string | undefined },
    };

    try {
      const tlsRaw = await fs.readFile(path.join(stateRoot, 'tls.json'), 'utf-8');
      const tls = JSON.parse(tlsRaw);
      result.tls = { configured: true, hostname: tls.hostname, certDir: tls.certDir, configuredAt: tls.configuredAt };
    } catch { /* not configured */ }

    try {
      const psRaw = await fs.readFile(path.join(stateRoot, 'postscreen.json'), 'utf-8');
      const ps = JSON.parse(psRaw);
      result.postscreen = { enabled: ps.enabled === true, configuredAt: ps.configuredAt };
    } catch { /* not configured */ }

    try {
      const dmarcDir = path.join(stateRoot, 'dmarc');
      const files = await fs.readdir(dmarcDir);
      const domains: string[] = [];
      let latestDate: string | undefined;
      for (const f of files) {
        if (f.endsWith('.json')) {
          try {
            const raw = await fs.readFile(path.join(dmarcDir, f), 'utf-8');
            const d = JSON.parse(raw);
            domains.push(d.domain);
            if (!latestDate || d.configuredAt > latestDate) latestDate = d.configuredAt;
          } catch { /* skip */ }
        }
      }
      result.dmarc = { domains, configuredAt: latestDate };
    } catch { /* not configured */ }

    return result;
  }

  private resolveMailMode(): string {
    const configuredMode = process.env.MAIL_MODE?.trim().toLowerCase();
    if (configuredMode === 'production' || configuredMode === 'dev') {
      return configuredMode;
    }
    return process.env.NODE_ENV === 'production' ? 'production' : 'dev';
  }

  // ---- DNS Auto-Publish (Phase 5) ----

  async publishDns(domainId: string): Promise<{
    published: { type: string; name: string; value: string; status: 'created' | 'exists' | 'error'; error?: string }[];
    zoneReload?: { success: boolean; message: string };
  }> {
    const suggestions = await this.getDnsSuggestions(domainId);
    const domainName = suggestions.domain;

    // Ensure a DNS zone exists for this domain
    const zone = await this.dnsService.getZone(domainName);
    if (!zone) {
      await this.dnsService.ensureDefaultZone(domainName, {
        serverIp: suggestions.serverIp,
      });
    }

    const published: { type: string; name: string; value: string; status: 'created' | 'exists' | 'error'; error?: string }[] = [];

    // Fetch the zone again to check for existing records
    const currentZone = await this.dnsService.getZone(domainName);
    const existingRecords = currentZone?.records ?? [];

    for (const rec of suggestions.records) {
      // Check if a record already exists (same type + name)
      const existing = existingRecords.find(
        (r) => r.type === rec.type && r.name === rec.name,
      );

      if (existing) {
        // If the value matches, skip; otherwise update in-place
        if (existing.value === rec.value) {
          published.push({ type: rec.type, name: rec.name, value: rec.value, status: 'exists' });
          continue;
        }
        // Update the existing record
        try {
          await this.dnsService.updateRecord(domainName, existing.id, {
            value: rec.value,
            ttl: rec.ttl,
            priority: rec.priority,
          });
          published.push({ type: rec.type, name: rec.name, value: rec.value, status: 'created' });
        } catch (error) {
          published.push({
            type: rec.type, name: rec.name, value: rec.value,
            status: 'error',
            error: error instanceof Error ? error.message : 'Update failed',
          });
        }
        continue;
      }

      // Create new record
      try {
        await this.dnsService.addRecord(domainName, {
          type: rec.type as 'A' | 'CNAME' | 'MX' | 'TXT' | 'NS',
          name: rec.name,
          value: rec.value,
          ttl: rec.ttl,
          priority: rec.priority,
        });
        published.push({ type: rec.type, name: rec.name, value: rec.value, status: 'created' });
      } catch (error) {
        published.push({
          type: rec.type, name: rec.name, value: rec.value,
          status: 'error',
          error: error instanceof Error ? error.message : 'Creation failed',
        });
      }
    }

    // Sync BIND zone file if the DNS server is running
    let zoneReload: { success: boolean; message: string } | undefined;
    try {
      const serverStatus = await this.dnsServerService.getStatus();
      if (serverStatus.installed && serverStatus.running) {
        // Regenerate the zone file from the updated JSON records
        const updatedZone = await this.dnsService.getZone(domainName);
        if (updatedZone) {
          zoneReload = await this.dnsServerService.createZone(
            domainName,
            suggestions.serverIp,
          );
        }
      }
    } catch (error) {
      zoneReload = {
        success: false,
        message: error instanceof Error ? error.message : 'Zone reload failed',
      };
    }

    // Log the publish action
    await this.history.log({
      scope: 'domain' as MailAutomationScope,
      action: 'publish-dns',
      target: domainName,
      logs: [{
        task: 'Publish DNS records',
        success: published.every((r) => r.status !== 'error'),
        message: `Published ${published.filter((r) => r.status === 'created').length} records, ${published.filter((r) => r.status === 'exists').length} unchanged`,
      }],
    });

    return { published, zoneReload };
  }

  // ---- Mail Metrics (Phase 5) ----

  async getMailMetrics(): Promise<MailMetrics> {
    return this.statusService.getMetrics();
  }

  // ---- Queue Management ----

  async flushQueue(): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.flushQueue();
    await this.history.log({
      scope: 'stack' as MailAutomationScope,
      action: 'flush-queue',
      target: 'postfix',
      logs,
    });
    return { automationLogs: logs };
  }

  async deleteQueueMessage(queueId: string): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.deleteQueueMessage(queueId);
    await this.history.log({
      scope: 'stack' as MailAutomationScope,
      action: 'delete-queue-message',
      target: queueId,
      logs,
    });
    return { automationLogs: logs };
  }

  async deleteAllQueueMessages(): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.deleteAllQueueMessages();
    await this.history.log({
      scope: 'stack' as MailAutomationScope,
      action: 'purge-queue',
      target: 'all',
      logs,
    });
    return { automationLogs: logs };
  }

  async retryQueueMessage(queueId: string): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.retryQueueMessage(queueId);
    return { automationLogs: logs };
  }

  // ---- Mail Logs ----

  async getMailLogs(lines?: number, search?: string): Promise<{ lines: string[]; total: number }> {
    return this.automation.getMailLogs(lines, search);
  }

  // ---- DNS Propagation Check ----

  async checkDnsPropagation(domainId: string): Promise<{
    domain: string;
    results: { record: { type: string; name: string; expected: string }; actual: string[]; match: boolean }[];
    allPropagated: boolean;
  }> {
    const suggestions = await this.getDnsSuggestions(domainId);
    const records = suggestions.records.map(r => ({
      type: r.type,
      name: r.name,
      value: r.value,
    }));

    const results = await this.automation.checkDnsPropagation(suggestions.domain, records);
    const allPropagated = results.every(r => r.match);

    return {
      domain: suggestions.domain,
      results,
      allPropagated,
    };
  }

  // ---- Mailbox Backup / Restore ----

  async backupMailbox(domainId: string, mailboxId: string): Promise<{ path: string; sizeBytes: number; automationLogs: AutomationLog[] }> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const mailbox = domain.mailboxes.find(m => m.id === mailboxId);
    if (!mailbox) throw new BadRequestException('Mailbox not found');

    const result = await this.automation.backupMailbox(domain.domain, mailbox.email);
    await this.history.log({
      scope: 'mailbox' as MailAutomationScope,
      action: 'backup',
      target: mailbox.email,
      logs: result.logs,
    });

    return { path: result.path, sizeBytes: result.sizeBytes, automationLogs: result.logs };
  }

  async restoreMailbox(domainId: string, mailboxId: string, backupFile: string): Promise<{ automationLogs: AutomationLog[] }> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const mailbox = domain.mailboxes.find(m => m.id === mailboxId);
    if (!mailbox) throw new BadRequestException('Mailbox not found');

    const logs = await this.automation.restoreMailbox(domain.domain, mailbox.email, backupFile);
    await this.history.log({
      scope: 'mailbox' as MailAutomationScope,
      action: 'restore',
      target: mailbox.email,
      logs,
    });

    return { automationLogs: logs };
  }

  async listBackups(domain?: string): Promise<{ file: string; domain: string; email: string; timestamp: string; sizeBytes: number }[]> {
    return this.automation.listBackups(domain);
  }

  // ---- Per-User Rate Limiting ----

  async setupRateLimit(
    domainId: string,
    email: string,
    limitPerHour: number,
  ): Promise<{ automationLogs: AutomationLog[] }> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const logs = await this.automation.setupRateLimit(domain.domain, email, limitPerHour);
    await this.history.log({
      scope: 'security' as MailAutomationScope,
      action: 'setup-rate-limit',
      target: email === '*' ? `@${domain.domain}` : email,
      logs,
    });

    return { automationLogs: logs };
  }

  async getRateLimits(domainId: string): Promise<{ email: string; limit: number; updatedAt?: string }[]> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    return this.automation.getRateLimits(domain.domain);
  }

  // ---- Sieve Filters (ManageSieve) ----

  async listSieveFilters(domainId: string, mailboxId: string): Promise<{ name: string; active: boolean }[]> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const mailbox = domain.mailboxes.find(m => m.id === mailboxId);
    if (!mailbox) throw new BadRequestException('Mailbox not found');

    return this.automation.listSieveFilters(domain.domain, mailbox.email);
  }

  async getSieveFilter(domainId: string, mailboxId: string, filterName: string): Promise<{ name: string; script: string }> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const mailbox = domain.mailboxes.find(m => m.id === mailboxId);
    if (!mailbox) throw new BadRequestException('Mailbox not found');

    const script = await this.automation.getSieveFilter(domain.domain, mailbox.email, filterName);
    return { name: filterName, script };
  }

  async putSieveFilter(domainId: string, mailboxId: string, filterName: string, scriptContent: string): Promise<{ automationLogs: AutomationLog[] }> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const mailbox = domain.mailboxes.find(m => m.id === mailboxId);
    if (!mailbox) throw new BadRequestException('Mailbox not found');

    const logs = await this.automation.putSieveFilter(domain.domain, mailbox.email, filterName, scriptContent);
    await this.history.log({
      scope: 'mailbox' as MailAutomationScope,
      action: 'sieve-put',
      target: `${mailbox.email}/${filterName}`,
      logs,
    });

    return { automationLogs: logs };
  }

  async deleteSieveFilter(domainId: string, mailboxId: string, filterName: string): Promise<{ automationLogs: AutomationLog[] }> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const mailbox = domain.mailboxes.find(m => m.id === mailboxId);
    if (!mailbox) throw new BadRequestException('Mailbox not found');

    const logs = await this.automation.deleteSieveFilter(domain.domain, mailbox.email, filterName);
    await this.history.log({
      scope: 'mailbox' as MailAutomationScope,
      action: 'sieve-delete',
      target: `${mailbox.email}/${filterName}`,
      logs,
    });

    return { automationLogs: logs };
  }

  // ---- Catch-All Mailbox ----

  async setupCatchAll(domainId: string, action: 'enable' | 'disable', targetEmail?: string): Promise<{ domain: MailDomain; automationLogs: AutomationLog[] }> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    if (action === 'enable' && !targetEmail) {
      throw new BadRequestException('targetEmail is required to enable catch-all');
    }

    const logs = await this.automation.setupCatchAll(domain.domain, action, targetEmail);
    domain.catchAllAddress = action === 'enable' ? targetEmail : undefined;
    domain.updatedAt = new Date().toISOString();
    await this.writeDomains(domains);

    await this.history.log({
      scope: 'domain' as MailAutomationScope,
      action: `catch-all-${action}`,
      target: domain.domain,
      logs,
    });

    return { domain, automationLogs: logs };
  }

  // ---- Quota Warnings ----

  async setupQuotaWarning(threshold: number, adminEmail?: string): Promise<{ automationLogs: AutomationLog[] }> {
    if (threshold < 1 || threshold > 100) {
      throw new BadRequestException('threshold must be between 1 and 100');
    }

    const logs = await this.automation.setupQuotaWarning(threshold, adminEmail);
    await this.history.log({
      scope: 'security' as MailAutomationScope,
      action: 'setup-quota-warning',
      target: `${threshold}%`,
      logs,
    });

    return { automationLogs: logs };
  }

  async getQuotaWarningConfig(): Promise<{ threshold: number; adminEmail?: string; updatedAt?: string } | null> {
    return this.automation.getQuotaWarningConfig();
  }

  // ---- SMTP Relay ----

  async setupSmtpRelay(host: string, port: number, username?: string, password?: string): Promise<{ automationLogs: AutomationLog[] }> {
    if (!host) throw new BadRequestException('host is required');
    if (!port || port < 1 || port > 65535) throw new BadRequestException('port must be 1-65535');

    const logs = await this.automation.setupSmtpRelay(host, port, username, password);
    await this.history.log({
      scope: 'security' as MailAutomationScope,
      action: 'setup-smtp-relay',
      target: `[${host}]:${port}`,
      logs,
    });

    return { automationLogs: logs };
  }

  async getSmtpRelay(): Promise<{ configured: boolean; host?: string; port?: number; authenticated?: boolean }> {
    return this.automation.getSmtpRelay();
  }

  async removeSmtpRelay(): Promise<{ automationLogs: AutomationLog[] }> {
    const logs = await this.automation.removeSmtpRelay();
    await this.history.log({
      scope: 'security' as MailAutomationScope,
      action: 'remove-smtp-relay',
      target: 'relayhost',
      logs,
    });

    return { automationLogs: logs };
  }

  // ---- DMARC Report Parsing ----

  async getDmarcReports(domainId: string): Promise<unknown[]> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    return this.automation.getDmarcReports(domain.domain);
  }

  async getDmarcSummary(domainId: string): Promise<unknown> {
    const domains = await this.readDomains();
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    return this.automation.getDmarcSummary(domain.domain);
  }
}
