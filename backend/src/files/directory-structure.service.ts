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
    <title>Welcome to ${domainName}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 600px;
            margin: 100px auto;
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 20px;
        }
        p {
            color: #7f8c8d;
            line-height: 1.6;
        }
        .domain {
            color: #667eea;
            font-weight: bold;
        }
        .emoji {
            font-size: 3em;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">🚀</div>
        <h1>Website Coming Soon!</h1>
        <p>The domain <span class="domain">${domainName}</span> is successfully configured.</p>
        <p>Upload your website files using the File Manager in clearPanel to get started.</p>
    </div>
</body>
</html>`;
    }
}
