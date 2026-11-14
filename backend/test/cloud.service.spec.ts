import { CloudService } from '../src/cloud/cloud.service';
import { BaasService } from '../src/baas/baas.service';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('CloudService', () => {
  let service: CloudService;
  let tempDir: string;
  let mockBaasService: Partial<BaasService>;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cloud-test-'));

    mockBaasService = {
      listInstances: jest.fn().mockResolvedValue([
        { id: 'b1', name: 'App 1', status: 'running', port: 8090, dataPath: '', adminUrl: '', apiUrl: '', createdAt: '' },
      ]),
    };

    service = new CloudService(mockBaasService as BaasService);
    // Point internal storage files to temp directory
    (service as any).s3File = path.join(tempDir, 'cloud-s3.json');
    (service as any).sesFile = path.join(tempDir, 'cloud-ses.json');
    (service as any).emailLogsFile = path.join(tempDir, 'cloud-email-logs.json');
    (service as any).vaultFile = path.join(tempDir, 'cloud-vault.json');
    (service as any).getS3StorageDir = () => path.join(tempDir, 's3');
  });

  afterEach(async () => {
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('calculates cloud overview stats and cost savings', async () => {
    const stats = await service.getOverviewStats();
    expect(stats.baasInstancesCount).toBe(1);
    expect(stats.baasRunningCount).toBe(1);
    expect(stats.estimatedMonthlySavingsUsd).toBeGreaterThan(100);
  });

  it('creates, lists, and deletes S3 buckets', async () => {
    const created = await service.createBucket({ name: 'my-app-uploads', visibility: 'public-read' });
    expect(created.name).toBe('my-app-uploads');
    expect(created.visibility).toBe('public-read');

    const buckets = await service.listBuckets();
    expect(buckets.length).toBe(1);
    expect(buckets[0].name).toBe('my-app-uploads');

    const delRes = await service.deleteBucket('my-app-uploads');
    expect(delRes.success).toBe(true);

    const postDelBuckets = await service.listBuckets();
    expect(postDelBuckets.length).toBe(0);
  });

  it('creates S3 access keys with key IDs and secrets', async () => {
    const key = await service.createS3Key('Prod Next.js App');
    expect(key.name).toBe('Prod Next.js App');
    expect(key.accessKeyId.startsWith('CP')).toBe(true);
    expect(key.secretAccessKey.length).toBeGreaterThan(20);

    const keys = await service.listS3Keys();
    expect(keys.length).toBe(1);
  });

  it('creates, lists, and revokes SES API keys', async () => {
    const key = await service.createSesKey('Auth Mailer Key', 'example.com');
    expect(key.key.startsWith('cp_live_')).toBe(true);
    expect(key.status).toBe('active');

    const list = await service.listSesKeys();
    expect(list.length).toBe(1);

    await service.revokeSesKey(key.id);
    const postRevoke = await service.listSesKeys();
    expect(postRevoke[0].status).toBe('revoked');
  });

  it('stores secrets with AES-256 encryption and exports clean .env format', async () => {
    await service.saveSecret({
      project: 'mobile-app',
      environment: 'production',
      key: 'DATABASE_URL',
      value: 'postgres://admin:secret123@127.0.0.1:5432/db',
    });

    await service.saveSecret({
      project: 'mobile-app',
      environment: 'production',
      key: 'STRIPE_SECRET_KEY',
      value: 'sk_live_998877665544',
    });

    const decrypted = await service.listSecrets('mobile-app', 'production');
    expect(decrypted.length).toBe(2);
    expect(decrypted.find((s) => s.key === 'DATABASE_URL')?.value).toBe('postgres://admin:secret123@127.0.0.1:5432/db');

    const envContent = await service.exportEnv('mobile-app', 'production');
    expect(envContent).toContain('DATABASE_URL=postgres://admin:secret123@127.0.0.1:5432/db');
    expect(envContent).toContain('STRIPE_SECRET_KEY=sk_live_998877665544');
  });
});
