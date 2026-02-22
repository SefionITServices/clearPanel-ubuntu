import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class DirectoryStructureService {
    private readonly logger = new Logger(DirectoryStructureService.name);

    /**
     * Initialize cPanel-like directory structure
     */
    async initializeStructure(rootPath: string): Promise<void> {
        const structure = {
            'public_html': 'Main website files',
            'mail': 'Email storage',
            'logs': 'Server logs',
            'tmp': 'Temporary files',
            'etc': 'Configuration files',
            'ssl/certs': 'SSL certificates',
            'ssl/keys': 'SSL private keys',
            'ssl/csrs': 'Certificate signing requests',
            'cgi-bin': 'CGI scripts',
        };

        for (const [dir, description] of Object.entries(structure)) {
            const fullPath = path.join(rootPath, dir);
            try {
                await fs.mkdir(fullPath, { recursive: true });

                // Create README in each folder explaining its purpose
                const readmePath = path.join(fullPath, 'README.txt');
                const readmeExists = await fs.access(readmePath).then(() => true).catch(() => false);

                if (!readmeExists) {
                    await fs.writeFile(readmePath, `${description}\n\nThis directory is managed by clearPanel.`);
                }

                this.logger.log(`Initialized: ${dir}`);
            } catch (error) {
                this.logger.warn(`Failed to create ${dir}:`, error);
            }
        }
    }

    /**
     * Create domain-specific directory structure
     */
    async createDomainStructure(domainPath: string, domainName: string): Promise<void> {
        const subdirs = ['logs', 'tmp', 'cgi-bin'];

        for (const subdir of subdirs) {
            await fs.mkdir(path.join(domainPath, subdir), { recursive: true });
        }

        // Create default index.html
        const indexPath = path.join(domainPath, 'index.html');
        const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);

        if (!indexExists) {
            const content = this.getDefaultIndexHtml(domainName);
            await fs.writeFile(indexPath, content);
            this.logger.log(`Created default index.html for ${domainName}`);
        }
    }

    /**
     * Generate default index.html for new domains
     */
    private getDefaultIndexHtml(domainName: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${domainName} - Coming Soon</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .card {
            background: white;
            padding: 48px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 480px;
            width: 90%;
        }
        h1 { color: #1a1a2e; font-size: 2em; margin-bottom: 12px; }
        .domain { color: #667eea; font-weight: 700; }
        p { color: #666; line-height: 1.7; font-size: 1.05em; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Coming Soon</h1>
        <p>The website <span class="domain">${domainName}</span> is under construction.</p>
    </div>
</body>
</html>`;
    }
}
