import { CicdRecipeService } from '../src/git/cicd-recipe.service';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('CicdRecipeService', () => {
  let service: CicdRecipeService;
  let tempDir: string;

  beforeEach(async () => {
    service = new CicdRecipeService();
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cicd-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('detects Docker Compose projects and provides compose deploy script', async () => {
    await fsp.writeFile(path.join(tempDir, 'docker-compose.yml'), 'services:\n  web:\n    image: nginx');
    const result = await service.detectFramework(tempDir);

    expect(result.framework).toBe('docker-compose');
    expect(result.recommendedRuntime).toBe('docker');
    expect(result.suggestedDeployScript).toContain('docker compose up --build');
  });

  it('detects Next.js projects from package.json', async () => {
    const pkg = { name: 'my-next-app', dependencies: { next: '^14.0.0', react: '^18.0.0' } };
    await fsp.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg));
    const result = await service.detectFramework(tempDir);

    expect(result.framework).toBe('nextjs');
    expect(result.recommendedRuntime).toBe('node');
    expect(result.suggestedDeployScript).toContain('pm2 restart');
  });

  it('detects React / Vite frontend SPA projects', async () => {
    const pkg = { name: 'vite-app', devDependencies: { vite: '^5.0.0' } };
    await fsp.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg));
    const result = await service.detectFramework(tempDir);

    expect(result.framework).toBe('react-vite');
    expect(result.recommendedRuntime).toBe('static');
    expect(result.suggestedDeployScript).toContain('npm run build');
  });

  it('detects Python projects from requirements.txt', async () => {
    await fsp.writeFile(path.join(tempDir, 'requirements.txt'), 'fastapi\nuvicorn\n');
    const result = await service.detectFramework(tempDir);

    expect(result.framework).toBe('python-fastapi-flask');
    expect(result.recommendedRuntime).toBe('python');
    expect(result.suggestedDeployScript).toContain('pip install -r requirements.txt');
  });

  it('generates a GitHub Actions webhook workflow', () => {
    const yaml = service.generateWorkflow({
      projectName: 'ShopApp',
      branch: 'main',
      deployMethod: 'webhook',
      webhookUrl: 'https://panel.example.com/api/git-webhook/github/12345',
    });

    expect(yaml).toContain('name: ShopApp Auto-Deploy');
    expect(yaml).toContain('https://panel.example.com/api/git-webhook/github/12345');
    expect(yaml).toContain('X-Hub-Signature-256');
  });

  it('generates a GitHub Actions SSH CI/CD workflow', () => {
    const yaml = service.generateWorkflow({
      projectName: 'ApiServer',
      branch: 'main',
      deployMethod: 'ssh',
      serverHost: '192.0.2.1',
      serverUser: 'root',
      deployPath: '/opt/clearpanel/apps/api',
      buildCommand: 'npm run build',
    });

    expect(yaml).toContain('name: ApiServer CI/CD Pipeline');
    expect(yaml).toContain('appleboy/ssh-action@v1.0.3');
    expect(yaml).toContain('/opt/clearpanel/apps/api');
    expect(yaml).toContain('.clearpanel-deploy.sh');
  });
});
