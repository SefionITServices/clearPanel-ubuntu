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
});
