import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export type DetectedFramework =
  | 'docker-compose'
  | 'dockerfile'
  | 'nextjs'
  | 'react-vite'
  | 'nodejs-server'
  | 'php-laravel'
  | 'php-generic'
  | 'python-fastapi-flask'
  | 'static-html'
  | 'generic';

export interface FrameworkDetectionResult {
  framework: DetectedFramework;
  frameworkName: string;
  icon: string;
  suggestedBuildCommand: string;
  suggestedDeployScript: string;
  detectedFiles: string[];
  recommendedRuntime: 'docker' | 'node' | 'python' | 'php' | 'static';
}

export interface WorkflowOptions {
  projectName: string;
  repoUrl?: string;
  branch?: string;
  deployMethod: 'webhook' | 'ssh';
  serverHost?: string;
  serverUser?: string;
  deployPath?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  testCommand?: string;
  buildCommand?: string;
}

@Injectable()
export class CicdRecipeService {
  private readonly logger = new Logger(CicdRecipeService.name);

  /**
   * Scans a cloned repository directory and identifies the primary framework & build requirements.
   */
  async detectFramework(repoDir: string): Promise<FrameworkDetectionResult> {
    const detectedFiles: string[] = [];

    const fileExists = async (fileName: string): Promise<boolean> => {
      try {
        await fs.access(path.join(repoDir, fileName));
        detectedFiles.push(fileName);
        return true;
      } catch {
        return false;
      }
    };

    // 1. Docker Compose
    if (await fileExists('docker-compose.yml') || await fileExists('docker-compose.yaml') || await fileExists('compose.yaml') || await fileExists('compose.yml')) {
      return {
        framework: 'docker-compose',
        frameworkName: 'Docker Compose Stack',
        icon: 'docker',
        recommendedRuntime: 'docker',
        suggestedBuildCommand: 'docker compose build',
        suggestedDeployScript: [
          '#!/bin/bash',
          'set -e',
          'echo "🚀 Deploying Docker Compose Stack on ClearPanel..."',
          'docker compose up --build -d --remove-orphans',
          'docker image prune -f',
          'echo "✅ Container successfully updated!"',
        ].join('\n'),
        detectedFiles,
      };
    }

    // 2. Standalone Dockerfile
    if (await fileExists('Dockerfile')) {
      return {
        framework: 'dockerfile',
        frameworkName: 'Docker Container',
        icon: 'docker',
        recommendedRuntime: 'docker',
        suggestedBuildCommand: 'docker build -t app:latest .',
        suggestedDeployScript: [
          '#!/bin/bash',
          'set -e',
          'IMAGE_NAME="${CONTAINER_NAME:-app}"',
          'PORT="${PORT:-3000}"',
          'echo "🚀 Building and restarting Docker container..."',
          'docker build -t "$IMAGE_NAME:latest" .',
          'docker stop "$IMAGE_NAME" 2>/dev/null || true',
          'docker rm "$IMAGE_NAME" 2>/dev/null || true',
          'docker run -d --name "$IMAGE_NAME" -p "$PORT:$PORT" --restart unless-stopped "$IMAGE_NAME:latest"',
          'docker image prune -f',
          'echo "✅ App running on port $PORT!"',
        ].join('\n'),
        detectedFiles,
      };
    }

    // 3. Node.js Ecosystem (package.json inspection)
    if (await fileExists('package.json')) {
      try {
        const pkgContent = await fs.readFile(path.join(repoDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };

        // Next.js
        if (allDeps['next'] || await fileExists('next.config.js') || await fileExists('next.config.mjs') || await fileExists('next.config.ts')) {
          return {
            framework: 'nextjs',
            frameworkName: 'Next.js Application',
            icon: 'nextjs',
            recommendedRuntime: 'node',
            suggestedBuildCommand: 'npm ci && npm run build',
            suggestedDeployScript: [
              '#!/bin/bash',
              'set -e',
              'echo "🚀 Building Next.js application..."',
              'npm ci || npm install',
              'npm run build',
              '# Restart PM2 process (or start if first run)',
              'APP_NAME="${APP_NAME:-next-app}"',
              'PORT="${PORT:-3000}"',
              'pm2 restart "$APP_NAME" 2>/dev/null || PORT="$PORT" pm2 start npm --name "$APP_NAME" -- start',
              'pm2 save',
              'echo "✅ Next.js app updated & online!"',
            ].join('\n'),
            detectedFiles,
          };
        }

        // React / Vite SPA
        if (allDeps['vite'] || await fileExists('vite.config.js') || await fileExists('vite.config.ts')) {
          return {
            framework: 'react-vite',
            frameworkName: 'React / Vite SPA',
            icon: 'react',
            recommendedRuntime: 'static',
            suggestedBuildCommand: 'npm ci && npm run build',
            suggestedDeployScript: [
              '#!/bin/bash',
              'set -e',
              'echo "🚀 Building React / Vite frontend bundle..."',
              'npm ci || npm install',
              'npm run build',
              '# Copy compiled assets to web root if DEPLOYPATH is defined',
              'if [ -n "$DEPLOYPATH" ] && [ -d "dist" ]; then',
              '  echo "📂 Syncing dist/ into $DEPLOYPATH..."',
              '  mkdir -p "$DEPLOYPATH"',
              '  cp -r dist/* "$DEPLOYPATH/"',
              'fi',
              'echo "✅ Static bundle updated successfully!"',
            ].join('\n'),
            detectedFiles,
          };
        }

        // Generic Node.js Server / API (NestJS, Express, Fastify)
        return {
          framework: 'nodejs-server',
          frameworkName: 'Node.js / Express / NestJS Server',
          icon: 'nodejs',
          recommendedRuntime: 'node',
          suggestedBuildCommand: 'npm ci && npm run build',
          suggestedDeployScript: [
            '#!/bin/bash',
            'set -e',
            'echo "🚀 Installing dependencies & compiling Node app..."',
            'npm ci || npm install',
            'if grep -q "\\"build\\":" package.json; then',
            '  npm run build',
            'fi',
            'APP_NAME="${APP_NAME:-node-app}"',
            'START_SCRIPT="dist/main.js"',
            '[ ! -f "$START_SCRIPT" ] && START_SCRIPT="server.js"',
            '[ ! -f "$START_SCRIPT" ] && START_SCRIPT="index.js"',
            'pm2 restart "$APP_NAME" 2>/dev/null || pm2 start "$START_SCRIPT" --name "$APP_NAME"',
            'pm2 save',
            'echo "✅ Node server successfully updated!"',
          ].join('\n'),
          detectedFiles,
        };
      } catch (err: any) {
        this.logger.warn(`Could not parse package.json: ${err.message}`);
      }
    }

    // 4. PHP / Laravel
    if (await fileExists('composer.json')) {
      if (await fileExists('artisan')) {
        return {
          framework: 'php-laravel',
          frameworkName: 'Laravel Application',
          icon: 'laravel',
          recommendedRuntime: 'php',
          suggestedBuildCommand: 'composer install --no-dev --optimize-autoloader',
          suggestedDeployScript: [
            '#!/bin/bash',
            'set -e',
            'echo "🚀 Updating Laravel project..."',
            'composer install --no-dev --optimize-autoloader',
            'php artisan config:cache',
            'php artisan route:cache',
            'php artisan view:cache',
            'php artisan migrate --force || echo "Migration skipped or completed"',
            'echo "✅ Laravel deployment completed!"',
          ].join('\n'),
          detectedFiles,
        };
      }

      return {
        framework: 'php-generic',
        frameworkName: 'PHP / Composer Project',
        icon: 'php',
        recommendedRuntime: 'php',
        suggestedBuildCommand: 'composer install --no-dev',
        suggestedDeployScript: [
          '#!/bin/bash',
          'set -e',
          'echo "🚀 Updating PHP dependencies..."',
          'composer install --no-dev --optimize-autoloader',
          'echo "✅ PHP project deployed!"',
        ].join('\n'),
        detectedFiles,
      };
    }

    // 5. Python (FastAPI / Flask / Django)
    if (await fileExists('requirements.txt') || await fileExists('Pipfile') || await fileExists('pyproject.toml')) {
      return {
        framework: 'python-fastapi-flask',
        frameworkName: 'Python Application (FastAPI/Flask/Django)',
        icon: 'python',
        recommendedRuntime: 'python',
        suggestedBuildCommand: 'pip install -r requirements.txt',
        suggestedDeployScript: [
          '#!/bin/bash',
          'set -e',
          'echo "🚀 Setting up Python virtual environment..."',
          '[ ! -d "venv" ] && python3 -m venv venv',
          'source venv/bin/activate',
          'pip install --upgrade pip',
          'pip install -r requirements.txt',
          'APP_NAME="${APP_NAME:-python-app}"',
          '# Restart service if running with PM2 or Gunicorn/Uvicorn',
          'pm2 restart "$APP_NAME" 2>/dev/null || echo "Running without PM2 supervisor"',
          'echo "✅ Python app updated!"',
        ].join('\n'),
        detectedFiles,
      };
    }

    // 6. Static HTML
    if (await fileExists('index.html')) {
      return {
        framework: 'static-html',
        frameworkName: 'Static Website (HTML/CSS/JS)',
        icon: 'html5',
        recommendedRuntime: 'static',
        suggestedBuildCommand: '',
        suggestedDeployScript: [
          '#!/bin/bash',
          'set -e',
          'echo "🚀 Syncing static HTML files..."',
          'if [ -n "$DEPLOYPATH" ]; then',
          '  mkdir -p "$DEPLOYPATH"',
          '  cp -r * "$DEPLOYPATH/"',
          'fi',
          'echo "✅ Static site updated!"',
        ].join('\n'),
        detectedFiles,
      };
    }

    // Generic Fallback
    return {
      framework: 'generic',
      frameworkName: 'Generic Application',
      icon: 'code',
      recommendedRuntime: 'node',
      suggestedBuildCommand: '',
      suggestedDeployScript: [
        '#!/bin/bash',
        'set -e',
        'echo "🚀 Deploying project on ClearPanel..."',
        '# Add custom build & restart commands here',
        'echo "✅ Done!"',
      ].join('\n'),
      detectedFiles,
    };
  }

  /**
   * Generates a ready-to-use GitHub Actions CI/CD YAML configuration.
   */
  generateWorkflow(options: WorkflowOptions): string {
    const branch = options.branch || 'main';
    const projectName = options.projectName || 'My Project';

    if (options.deployMethod === 'webhook') {
      const webhookUrl = options.webhookUrl || 'https://<your-clearpanel-domain>/api/git-webhook/github/<webhook-id>';
      return [
        `name: ${projectName} Auto-Deploy`,
        '',
        'on:',
        '  push:',
        `    branches: [ ${branch} ]`,
        '  workflow_dispatch:',
        '',
        'jobs:',
        '  test-and-notify:',
        '    name: 🧪 Run Tests & Trigger Deploy',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - name: 📥 Checkout repository',
        '        uses: actions/checkout@v4',
        '',
        options.testCommand ? [
          '      - name: ⚙️ Setup Node.js',
          '        uses: actions/setup-node@v4',
          '        with:',
          '          node-version: 20.x',
          '          cache: "npm"',
          '',
          '      - name: 🧪 Run Tests',
          `        run: ${options.testCommand}`,
          '',
        ].join('\n') : '',
        '      - name: 🚀 Trigger ClearPanel Auto-Deploy Webhook',
        '        run: |',
        '          echo "Notifying ClearPanel to deploy commit ${{ github.sha }}..."',
        `          curl -X POST -H "Content-Type: application/json" \\`,
        `            -H "X-Hub-Signature-256: sha256=\${{ secrets.CLEARPANEL_WEBHOOK_SECRET }}" \\`,
        `            -d '{"ref":"refs/heads/${branch}","after":"\${{ github.sha }}"}' \\`,
        `            "${webhookUrl}"`,
        '          echo "✅ ClearPanel deploy triggered successfully!"',
      ].filter(Boolean).join('\n');
    }

    // SSH Deployment Mode
    const host = options.serverHost ? `\${{ secrets.CLEARPANEL_HOST || '${options.serverHost}' }}` : '${{ secrets.CLEARPANEL_HOST }}';
    const user = options.serverUser ? `\${{ secrets.CLEARPANEL_USER || '${options.serverUser}' }}` : '${{ secrets.CLEARPANEL_USER }}';
    const targetDir = options.deployPath || '/opt/clearpanel/apps/my-app';

    return [
      `name: ${projectName} CI/CD Pipeline`,
      '',
      'on:',
      '  push:',
      `    branches: [ ${branch} ]`,
      '  pull_request:',
      `    branches: [ ${branch} ]`,
      '  workflow_dispatch:',
      '',
      'concurrency:',
      '  group: ${{ github.workflow }}-${{ github.ref }}',
      '  cancel-in-progress: true',
      '',
      'jobs:',
      '  test-and-build:',
      '    name: "🧪 Run Tests & Build Check"',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: 📥 Checkout repository',
      '        uses: actions/checkout@v4',
      '',
      '      - name: ⚙️ Setup Node.js 20.x',
      '        uses: actions/setup-node@v4',
      '        with:',
      '          node-version: 20.x',
      '          cache: "npm"',
      '',
      options.testCommand ? [
        '      - name: 🧪 Run Automated Tests',
        `        run: ${options.testCommand}`,
        '',
      ].join('\n') : '',
      options.buildCommand ? [
        '      - name: 🏗️ Verify Build',
        `        run: ${options.buildCommand}`,
        '',
      ].join('\n') : '',
      '  deploy:',
      '    name: "🚀 Deploy to ClearPanel"',
      '    needs: test-and-build',
      `    if: github.ref == 'refs/heads/${branch}' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')`,
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: 🚀 SSH & Trigger ClearPanel Deployment',
      '        uses: appleboy/ssh-action@v1.0.3',
      '        with:',
      `          host: ${host}`,
      `          username: ${user}`,
      '          key: ${{ secrets.CLEARPANEL_SSH_KEY }}',
      '          port: ${{ secrets.CLEARPANEL_SSH_PORT || 22 }}',
      '          script_stop: true',
      '          script: |',
      `            cd "${targetDir}"`,
      `            git fetch origin ${branch}`,
      `            git reset --hard origin/${branch}`,
      '            if [ -f ".clearpanel-deploy.sh" ]; then',
      '              chmod +x .clearpanel-deploy.sh',
      '              ./.clearpanel-deploy.sh',
      '            fi',
      '            echo "🎉 Successfully deployed to ClearPanel!"',
    ].filter(Boolean).join('\n');
  }
}
