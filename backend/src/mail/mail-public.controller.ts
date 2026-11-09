import { Controller, Get, Param, Res, NotFoundException, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';

@Controller()
export class MailPublicController {
  private readonly logger = new Logger(MailPublicController.name);
  private readonly avatarsDir = '/var/lib/clearpanel/mail/avatars';
  private readonly bimiDir = '/var/lib/clearpanel/mail/bimi';

  // ---------------------------------------------------------------------------
  // Public Mailbox Avatar
  // ---------------------------------------------------------------------------

  @Get(['api/mail/avatars/:email', 'mail/avatars/:email'])
  async getAvatar(@Param('email') rawEmail: string, @Res() res: Response) {
    const email = decodeURIComponent(rawEmail).trim().toLowerCase();
    const extensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];

    for (const ext of extensions) {
      const filePath = path.join(this.avatarsDir, `${email}${ext}`);
      try {
        const data = await fs.readFile(filePath);
        let mime = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.svg') mime = 'image/svg+xml';
        else if (ext === '.webp') mime = 'image/webp';
        else if (ext === '.gif') mime = 'image/gif';

        res.setHeader('Content-Type', mime);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
        return res.end(data);
      } catch {}
    }

    // Fallback: Generate an elegant SVG initial avatar
    const initial = email.length > 0 ? email[0].toUpperCase() : 'U';
    const colors = [
      ['#4285F4', '#1967D2'],
      ['#EA4335', '#C5221F'],
      ['#FBBC04', '#E37400'],
      ['#34A853', '#188038'],
      ['#8430CE', '#681DA8'],
      ['#129EAF', '#007B83'],
    ];
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    const pair = colors[Math.abs(hash) % colors.length];

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pair[0]}"/>
      <stop offset="100%" stop-color="${pair[1]}"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="64" fill="url(#grad)"/>
  <text x="50%" y="54%" font-family="system-ui, -apple-system, Roboto, sans-serif" font-size="56" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(svg);
  }

  // ---------------------------------------------------------------------------
  // Public BIMI Logo (SVG Tiny / Web SVG)
  // ---------------------------------------------------------------------------

  @Get(['api/mail/bimi/:domain', 'mail/bimi/:domain'])
  async getBimiLogo(@Param('domain') rawDomain: string, @Res() res: Response) {
    let domain = decodeURIComponent(rawDomain).trim().toLowerCase();
    if (domain.endsWith('.svg')) domain = domain.slice(0, -4);

    const filePath = path.join(this.bimiDir, `${domain}.svg`);
    try {
      const data = await fs.readFile(filePath);
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.end(data);
    } catch {}

    // Fallback: Generate a crisp square BIMI logo
    const letter = domain.length > 0 ? domain[0].toUpperCase() : 'M';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="32" fill="#1A73E8"/>
  <text x="50%" y="54%" font-family="system-ui, -apple-system, Roboto, sans-serif" font-size="128" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${letter}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(svg);
  }
}
