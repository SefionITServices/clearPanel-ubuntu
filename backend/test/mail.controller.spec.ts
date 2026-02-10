import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { AutomationLog, DkimResult } from '../src/mail/mail-automation.service';
import type { MailHealthSnapshot } from '../src/mail/mail-status.service';
import type { DnsServerStatus } from '../src/dns-server/dns-server.service';
import { DnsServerService } from '../src/dns-server/dns-server.service';

const makeLog = (task: string, message?: string): AutomationLog => ({
  task,
  success: true,
  message: message ?? task,
});

class FakeMailAutomationService {
  ensureStack = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Install mail stack', 'Stack verified')]);

  provisionDomain = jest.fn(async (domain: string): Promise<AutomationLog[]> => [
    makeLog('Provision mail domain', `Provisioned ${domain}`),
  ]);

  removeDomain = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Remove mail domain', 'Removed domain')]);

  provisionMailbox = jest.fn(
    async (domain: string, mailbox: string, passwordHash: string, quotaMb?: number): Promise<AutomationLog[]> => [
      makeLog('Provision mailbox', `Provisioned ${mailbox} (${domain})`),
    ],
  );

  removeMailbox = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Remove mailbox', 'Removed mailbox')]);

  provisionAlias = jest.fn(
    async (domain: string, source: string, destination: string): Promise<AutomationLog[]> => [
      makeLog('Provision alias', `${source} -> ${destination}`),
    ],
  );

  removeAlias = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Remove alias', 'Removed alias')]);

  getDkimRecord = jest.fn(async (domain: string, selector: string): Promise<DkimResult> => ({
    selector,
    publicRecord: `v=DKIM1; p=FAKE-key-${domain}`,
  }));

  rotateDkim = jest.fn(
    async (domain: string, selector: string): Promise<{ logs: AutomationLog[]; result?: DkimResult }> => ({
      logs: [makeLog('Rotate DKIM', `Rotated ${selector} for ${domain}`)],
      result: { selector, publicRecord: `v=DKIM1; p=FAKE-rotated-${domain}` },
    }),
  );

  hashPassword = jest.fn(async (password: string): Promise<string> => `HASHED:${password}`);

  configureDomainPolicy = jest.fn(async (domain: string): Promise<AutomationLog[]> => [
    makeLog('Configure domain policy', `Policy applied for ${domain}`),
  ]);

  // --- Methods added in improvements round 1 ---

  setupMailTls = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Setup mail TLS', 'TLS configured')]);
  setupPostscreen = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Setup postscreen', 'Postscreen enabled')]);
  setupDmarc = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Setup DMARC', 'DMARC configured')]);

  flushQueue = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Flush queue', 'Queue flushed')]);
  deleteQueueMessage = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Delete queue msg', 'Deleted')]);
  deleteAllQueueMessages = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Delete all queue', 'All deleted')]);
  retryQueueMessage = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Retry queue msg', 'Retried')]);
  getMailLogs = jest.fn(async (): Promise<{ lines: string[]; total: number }> => ({ lines: ['test log line'], total: 1 }));
  checkDnsPropagation = jest.fn(async () => []);
  backupMailbox = jest.fn(async () => ({ logs: [makeLog('Backup', 'Backed up')], path: '/backups/test.tar.gz', sizeBytes: 1024 }));
  restoreMailbox = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Restore', 'Restored')]);
  listBackups = jest.fn(async () => []);
  setupRateLimit = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Setup rate limit', 'Rate limit set')]);
  getRateLimits = jest.fn(async () => []);

  // --- Methods added in improvements round 2 ---

  listSieveFilters = jest.fn(async () => [{ name: 'default', active: true }]);
  getSieveFilter = jest.fn(async () => 'require "fileinto"; fileinto "INBOX";');
  putSieveFilter = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Upload Sieve filter', 'Filter saved')]);
  deleteSieveFilter = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Delete Sieve filter', 'Filter deleted')]);

  setupCatchAll = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Setup catch-all', 'Catch-all configured')]);

  setupQuotaWarning = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Setup quota warning', 'Warning configured')]);
  getQuotaWarningConfig = jest.fn(async () => ({ threshold: 80, adminEmail: 'admin@example.test', updatedAt: '2025-01-01T00:00:00Z' }));

  setupSmtpRelay = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Setup SMTP relay', 'Relay configured')]);
  getSmtpRelay = jest.fn(async () => ({ configured: false }));
  removeSmtpRelay = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Remove SMTP relay', 'Relay removed')]);

  getDmarcReports = jest.fn(async () => []);
  getDmarcSummary = jest.fn(async () => ({
    reportCount: 0, totalMessages: 0, passCount: 0, failCount: 0, passRate: 0, organizations: [], topSenders: [],
  }));
  ingestDmarcReport = jest.fn(async (): Promise<AutomationLog[]> => [makeLog('Ingest DMARC report', 'Report ingested')]);
}

const stubStatusSnapshot: MailHealthSnapshot = {
  timestamp: '2025-01-01T00:00:00.000Z',
  services: [
    { name: 'postfix', status: 'active', active: true },
    { name: 'dovecot', status: 'active', active: true },
    { name: 'rspamd', status: 'active', active: true },
    { name: 'clamav-daemon', status: 'inactive', active: false, detail: 'Disabled for test' },
  ],
  queue: { total: 0, message: 'Mail queue is empty' },
};

class FakeMailStatusService {
  getStatus = jest.fn(async (): Promise<MailHealthSnapshot> => ({
    timestamp: stubStatusSnapshot.timestamp,
    services: stubStatusSnapshot.services.map((service) => ({ ...service })),
    queue: { ...stubStatusSnapshot.queue },
  }));
}

class FakeServerSettingsService {
  private readonly ip = '203.0.113.5';

  getServerIp = jest.fn(async (): Promise<string> => this.ip);

  getSettings = jest.fn(async () => ({
    primaryDomain: 'example.test',
    serverIp: this.ip,
    nameservers: ['ns1.example.test', 'ns2.example.test'],
    updatedAt: '2025-01-01T00:00:00.000Z',
  }));

  updateSettings = jest.fn(async () => this.getSettings());
}

class FakeDnsServerService {
  getStatus = jest.fn(async (): Promise<DnsServerStatus> => ({
    installed: false,
    running: false,
    zonesPath: '/etc/bind/zones',
    namedConfPath: '/etc/bind/named.conf.local',
  }));

  install = jest.fn(async () => ({ success: true, message: 'noop' }));
  createZone = jest.fn(async () => ({ success: true, message: 'noop' }));
  deleteZone = jest.fn(async () => ({ success: true, message: 'noop' }));
  reload = jest.fn(async () => undefined);
  getNameserverInstructions = jest.fn(async () => ({ nameservers: [], ip: '0.0.0.0', instructions: '' }));
}

describe('MailController integration', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;
  let tempDir: string;
  let originalCwd: string;
  let mailDataPath: string;
  let historyPath: string;
  let fakeAutomation: FakeMailAutomationService;
  let fakeStatus: FakeMailStatusService;
  let domainId: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mail-api-'));
    process.chdir(tempDir);
    mailDataPath = path.join(tempDir, 'mail-domains.json');
    historyPath = path.join(tempDir, 'mail-automation-history.json');

    const [mailModule, automationModule, statusModule, serverSettingsModule] = await Promise.all([
      import('../src/mail/mail.module'),
      import('../src/mail/mail-automation.service'),
      import('../src/mail/mail-status.service'),
      import('../src/server/server-settings.service'),
    ]);

    const { MailModule } = mailModule;
    const { MailAutomationService } = automationModule;
    const { MailStatusService } = statusModule;
    const { ServerSettingsService } = serverSettingsModule;

    fakeAutomation = new FakeMailAutomationService();
    fakeStatus = new FakeMailStatusService();
    const fakeServerSettings = new FakeServerSettingsService();

    const fakeConfigService = { get: jest.fn(() => undefined) };
    const fakeDnsServerService = new FakeDnsServerService();

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ ttl: 60, limit: 100 }), MailModule],
    })
      .overrideProvider(MailAutomationService)
      .useValue(fakeAutomation)
      .overrideProvider(MailStatusService)
      .useValue(fakeStatus)
      .overrideProvider(ServerSettingsService)
      .useValue(fakeServerSettings)
      .overrideProvider(ConfigService)
      .useValue(fakeConfigService as unknown as ConfigService)
      .overrideProvider(DnsServerService)
      .useValue(fakeDnsServerService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    process.chdir(originalCwd);
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a domain and persists it to disk', async () => {
    const response = await request(httpServer)
      .post('/mail/domains')
      .send({ domain: 'Example.Test', spamThreshold: 5.5 })
      .expect(201);

    const { domain, automationLogs } = response.body;

    expect(domain.domain).toBe('example.test');
    expect(domain.spamThreshold).toBe(5.5);
    expect(domain.mailboxes).toEqual([]);
    expect(domain.aliases).toEqual([]);
    expect(domain.dkimPublicKey).toBe('v=DKIM1; p=FAKE-key-example.test');
    expect(Array.isArray(automationLogs)).toBe(true);
    expect(fakeAutomation.ensureStack).toHaveBeenCalledTimes(1);
    expect(fakeAutomation.provisionDomain).toHaveBeenCalledWith('example.test');
    expect(fakeAutomation.configureDomainPolicy).toHaveBeenCalledWith('example.test', {
      spamThreshold: 5.5,
      greylistingEnabled: true,
      greylistingDelaySeconds: 300,
      virusScanEnabled: true,
    });

    const persisted = JSON.parse(await fsp.readFile(mailDataPath, 'utf-8'));
    expect(Array.isArray(persisted)).toBe(true);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].domain).toBe('example.test');

    domainId = domain.id;
  });

  it('updates domain policy settings and persists the change', async () => {
    const response = await request(httpServer)
      .patch(`/mail/domains/${domainId}/settings`)
      .send({ spamThreshold: 4.2, greylistingEnabled: false, greylistingDelaySeconds: 180, virusScanEnabled: false })
      .expect(200);

    const updated = response.body.domain;
    expect(updated.spamThreshold).toBe(4.2);
    expect(updated.greylistingEnabled).toBe(false);
    expect(updated.greylistingDelaySeconds).toBe(180);
    expect(updated.virusScanEnabled).toBe(false);

    const persisted = JSON.parse(await fsp.readFile(mailDataPath, 'utf-8'));
    expect(persisted[0].spamThreshold).toBe(4.2);
    expect(persisted[0].greylistingEnabled).toBe(false);
    expect(persisted[0].greylistingDelaySeconds).toBe(180);
    expect(persisted[0].virusScanEnabled).toBe(false);

    expect(fakeAutomation.configureDomainPolicy).toHaveBeenCalledWith('example.test', {
      spamThreshold: 4.2,
      greylistingEnabled: false,
      greylistingDelaySeconds: 180,
      virusScanEnabled: false,
    });
  });

  it('exposes automation history for the domain', async () => {
    const response = await request(httpServer)
      .get(`/mail/domains/${domainId}/logs?limit=5`)
      .expect(200);

    expect(response.body.domain).toBe('example.test');
    expect(Array.isArray(response.body.records)).toBe(true);
    expect(response.body.records.length).toBeGreaterThan(0);
    expect(response.body.records[0].domainId).toBe(domainId);

    const historyOnDisk = JSON.parse(await fsp.readFile(historyPath, 'utf-8'));
    expect(Array.isArray(historyOnDisk)).toBe(true);
    expect(historyOnDisk.length).toBeGreaterThan(0);
    expect(historyOnDisk[0].domainId).toBe(domainId);
  });

  it('adds a mailbox and stores hashed credentials', async () => {
    const response = await request(httpServer)
      .post(`/mail/domains/${domainId}/mailboxes`)
      .send({ email: 'admin', password: 'Secret!234', quotaMb: 512 })
      .expect(201);

    const updatedDomain = response.body.domain;
    expect(updatedDomain.mailboxes).toHaveLength(1);

    const mailbox = updatedDomain.mailboxes[0];
    expect(mailbox.email).toBe('admin@example.test');
    expect(mailbox.passwordHash).toBe('HASHED:Secret!234');
    expect(mailbox.quotaMb).toBe(512);

    expect(fakeAutomation.provisionMailbox).toHaveBeenCalledWith(
      'example.test',
      'admin@example.test',
      'HASHED:Secret!234',
      512,
    );

    const persisted = JSON.parse(await fsp.readFile(mailDataPath, 'utf-8'));
    expect(persisted[0].mailboxes).toHaveLength(1);
    expect(persisted[0].mailboxes[0].passwordHash).toBe('HASHED:Secret!234');
  });

  it('rejects weak mailbox passwords', async () => {
    const beforeHistory = JSON.parse(await fsp.readFile(historyPath, 'utf-8'));
    const response = await request(httpServer)
      .post(`/mail/domains/${domainId}/mailboxes`)
      .send({ email: 'weak', password: 'short' })
      .expect(400);

    expect(response.body.message).toContain('Password must be at least 10 characters');

    const persisted = JSON.parse(await fsp.readFile(mailDataPath, 'utf-8'));
    expect(persisted[0].mailboxes).toHaveLength(1);

    const afterHistory = JSON.parse(await fsp.readFile(historyPath, 'utf-8'));
    expect(afterHistory.length).toBe(beforeHistory.length);
  });

  it('exposes mail health snapshot via /mail/status', async () => {
    const response = await request(httpServer).get('/mail/status').expect(200);

    expect(response.body.timestamp).toBe(stubStatusSnapshot.timestamp);
    expect(response.body.queue).toEqual(stubStatusSnapshot.queue);
    expect(response.body.services).toEqual(stubStatusSnapshot.services);
    expect(fakeStatus.getStatus).toHaveBeenCalledTimes(1);
  });

  // ---- Sieve Filters Tests ----

  it('lists sieve filters for a mailbox', async () => {
    // Find mailbox id from the domain
    const domainResp = await request(httpServer).get('/mail/domains').expect(200);
    const mailboxId = domainResp.body[0].mailboxes[0].id;

    const response = await request(httpServer)
      .get(`/mail/domains/${domainId}/mailboxes/${mailboxId}/sieve`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(fakeAutomation.listSieveFilters).toHaveBeenCalled();
  });

  it('creates/updates a sieve filter', async () => {
    const domainResp = await request(httpServer).get('/mail/domains').expect(200);
    const mailboxId = domainResp.body[0].mailboxes[0].id;

    const response = await request(httpServer)
      .post(`/mail/domains/${domainId}/mailboxes/${mailboxId}/sieve/my-filter`)
      .send({ script: 'require "fileinto"; fileinto "Test";' })
      .expect(201);

    expect(response.body.automationLogs).toBeDefined();
    expect(fakeAutomation.putSieveFilter).toHaveBeenCalled();
  });

  it('rejects sieve filter upload without script', async () => {
    const domainResp = await request(httpServer).get('/mail/domains').expect(200);
    const mailboxId = domainResp.body[0].mailboxes[0].id;

    await request(httpServer)
      .post(`/mail/domains/${domainId}/mailboxes/${mailboxId}/sieve/my-filter`)
      .send({})
      .expect(400);
  });

  // ---- Catch-All Tests ----

  it('enables catch-all for a domain', async () => {
    const response = await request(httpServer)
      .post(`/mail/domains/${domainId}/catch-all`)
      .send({ action: 'enable', targetEmail: 'admin@example.test' })
      .expect(201);

    expect(response.body.domain.catchAllAddress).toBe('admin@example.test');
    expect(fakeAutomation.setupCatchAll).toHaveBeenCalledWith('example.test', 'enable', 'admin@example.test');
  });

  it('disables catch-all for a domain', async () => {
    const response = await request(httpServer)
      .post(`/mail/domains/${domainId}/catch-all`)
      .send({ action: 'disable' })
      .expect(201);

    expect(response.body.domain.catchAllAddress).toBeUndefined();
    expect(fakeAutomation.setupCatchAll).toHaveBeenCalledWith('example.test', 'disable');
  });

  it('rejects catch-all enable without targetEmail', async () => {
    await request(httpServer)
      .post(`/mail/domains/${domainId}/catch-all`)
      .send({ action: 'enable' })
      .expect(400);
  });

  // ---- Quota Warning Tests ----

  it('configures quota warnings', async () => {
    const response = await request(httpServer)
      .post('/mail/quota-warning')
      .send({ threshold: 80, adminEmail: 'admin@example.test' })
      .expect(201);

    expect(response.body.automationLogs).toBeDefined();
    expect(fakeAutomation.setupQuotaWarning).toHaveBeenCalledWith(80, 'admin@example.test');
  });

  it('rejects invalid quota threshold', async () => {
    await request(httpServer)
      .post('/mail/quota-warning')
      .send({ threshold: 150 })
      .expect(400);
  });

  it('retrieves quota warning config', async () => {
    const response = await request(httpServer)
      .get('/mail/quota-warning')
      .expect(200);

    expect(response.body).toBeDefined();
    expect(fakeAutomation.getQuotaWarningConfig).toHaveBeenCalled();
  });

  // ---- SMTP Relay Tests ----

  it('retrieves SMTP relay config', async () => {
    const response = await request(httpServer)
      .get('/mail/smtp-relay')
      .expect(200);

    expect(response.body.configured).toBe(false);
    expect(fakeAutomation.getSmtpRelay).toHaveBeenCalled();
  });

  it('configures SMTP relay', async () => {
    const response = await request(httpServer)
      .post('/mail/smtp-relay')
      .send({ host: 'smtp.relay.test', port: 587, username: 'user', password: 'pass' })
      .expect(201);

    expect(response.body.automationLogs).toBeDefined();
    expect(fakeAutomation.setupSmtpRelay).toHaveBeenCalledWith('smtp.relay.test', 587, 'user', 'pass');
  });

  it('rejects SMTP relay without host', async () => {
    await request(httpServer)
      .post('/mail/smtp-relay')
      .send({ port: 587 })
      .expect(400);
  });

  it('removes SMTP relay', async () => {
    const response = await request(httpServer)
      .delete('/mail/smtp-relay')
      .expect(200);

    expect(response.body.automationLogs).toBeDefined();
    expect(fakeAutomation.removeSmtpRelay).toHaveBeenCalled();
  });

  // ---- DMARC Reports Tests ----

  it('retrieves DMARC reports for a domain', async () => {
    const response = await request(httpServer)
      .get(`/mail/domains/${domainId}/dmarc-reports`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(fakeAutomation.getDmarcReports).toHaveBeenCalled();
  });

  it('retrieves DMARC summary for a domain', async () => {
    const response = await request(httpServer)
      .get(`/mail/domains/${domainId}/dmarc-reports/summary`)
      .expect(200);

    expect(response.body.reportCount).toBeDefined();
    expect(fakeAutomation.getDmarcSummary).toHaveBeenCalled();
  });

  // ---- Rate Limiting Tests ----

  it('configures rate limit for a domain', async () => {
    const response = await request(httpServer)
      .post(`/mail/domains/${domainId}/rate-limits`)
      .send({ email: '*', limitPerHour: 100 })
      .expect(201);

    expect(response.body.automationLogs).toBeDefined();
    expect(fakeAutomation.setupRateLimit).toHaveBeenCalled();
  });

  it('rejects rate limit without email', async () => {
    await request(httpServer)
      .post(`/mail/domains/${domainId}/rate-limits`)
      .send({ limitPerHour: 100 })
      .expect(400);
  });

  it('retrieves rate limits for a domain', async () => {
    const response = await request(httpServer)
      .get(`/mail/domains/${domainId}/rate-limits`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(fakeAutomation.getRateLimits).toHaveBeenCalled();
  });

  // ---- Queue Management Tests ----

  it('flushes the mail queue', async () => {
    const response = await request(httpServer)
      .post('/mail/queue/flush')
      .expect(201);

    expect(response.body.automationLogs).toBeDefined();
  });

  // ---- Mail Logs Tests ----

  it('retrieves mail logs', async () => {
    const response = await request(httpServer)
      .get('/mail/logs?lines=50')
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
