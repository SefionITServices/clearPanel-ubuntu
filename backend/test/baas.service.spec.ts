import { BaasService } from '../src/baas/baas.service';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('BaasService', () => {
  let service: BaasService;
  let tempDir: string;
  let mockInstancesFile: string;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'baas-test-'));
    mockInstancesFile = path.join(tempDir, 'baas-instances.json');

    service = new BaasService();
    // Point internal instancesFile and baseDataDir to our temp test directory
    (service as any).instancesFile = mockInstancesFile;
    (service as any).baseDataDir = path.join(tempDir, 'baas');
  });

  afterEach(async () => {
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('generates tailored multi-platform SDK snippets with custom domain or port', () => {
    const dummyInstance = {
      id: 'baas-test-1234',
      name: 'ecommerce-backend',
      port: 8095,
      domain: 'api.myshop.com',
      status: 'running' as const,
      dataPath: '/tmp/test/pb_data',
      apiUrl: 'https://api.myshop.com',
      adminUrl: 'https://api.myshop.com/_/',
      createdAt: new Date().toISOString(),
    };

    const snippets = service.getSdkSnippets(dummyInstance.id, dummyInstance);
    expect(snippets.length).toBe(4);

    const js = snippets.find((s) => s.language === 'javascript');
    expect(js).toBeDefined();
    expect(js?.code).toContain('https://api.myshop.com');
    expect(js?.code).toContain('import PocketBase from \'pocketbase\'');

    const flutter = snippets.find((s) => s.language === 'flutter');
    expect(flutter).toBeDefined();
    expect(flutter?.code).toContain('https://api.myshop.com');
    expect(flutter?.code).toContain('package:pocketbase/pocketbase.dart');

    const python = snippets.find((s) => s.language === 'python');
    expect(python).toBeDefined();
    expect(python?.code).toContain('from pocketbase import PocketBase');

    const curl = snippets.find((s) => s.language === 'curl');
    expect(curl).toBeDefined();
    expect(curl?.code).toContain('curl -f "https://api.myshop.com/api/health"');
  });

  it('rejects instance creation when required fields are missing', async () => {
    await expect(
      service.createInstance({ name: '', adminEmail: 'admin@test.com' }),
    ).rejects.toThrow('Instance name is required.');

    await expect(
      service.createInstance({ name: 'Valid Name', adminEmail: 'invalid-email' }),
    ).rejects.toThrow('Valid admin email is required');
  });

  it('creates, lists, and deletes a BaaS instance', async () => {
    const created = await service.createInstance({
      name: 'My Mobile App',
      adminEmail: 'superadmin@example.com',
      adminPassword: 'Password123!',
      port: 8092,
    });

    expect(created.name).toBe('My Mobile App');
    expect(created.port).toBe(8092);
    expect(created.adminEmail).toBe('superadmin@example.com');
    expect(created.id).toContain('baas-my-mobile-app');

    const list = await service.listInstances();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(created.id);

    // Delete
    const delResult = await service.deleteInstance(created.id);
    expect(delResult.success).toBe(true);

    const postDeleteList = await service.listInstances();
    expect(postDeleteList.length).toBe(0);
  });
});
