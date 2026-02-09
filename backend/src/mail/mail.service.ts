import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { MailAlias, MailDomain, Mailbox } from './mail.model';
import { MailAutomationService, AutomationLog, DkimResult } from './mail-automation.service';
import { MailHistoryService, MailAutomationScope, MailAutomationHistoryRecord } from './mail-history.service';
import { ServerSettingsService } from '../server/server-settings.service';
import { getDataFilePath } from '../common/paths';

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
        value: `v=DMARC1; p=quarantine; rua=mailto:abuse@${domain.domain}; ruf=mailto:abuse@${domain.domain}; fo=1`,
        ttl: 3600,
        description: 'DMARC policy with aggregate/forensic reports',
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
}
