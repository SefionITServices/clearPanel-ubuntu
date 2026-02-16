import { Injectable, NestMiddleware, OnModuleInit } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { readdirSync } from 'fs';

@Injectable()
export class FallbackMiddleware implements NestMiddleware, OnModuleInit {
  /** Pre-built set of known static file paths — avoids existsSync on every request */
  private staticFiles = new Set<string>();
  private readonly publicDir = join(__dirname, '..', 'public');

  onModuleInit() {
    // Scan public directory once at startup
    this.scanDir(this.publicDir, '');
  }

  private scanDir(dir: string, prefix: string) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : `/${entry.name}`;
        if (entry.isFile()) {
          this.staticFiles.add(rel);
        } else if (entry.isDirectory()) {
          this.scanDir(join(dir, entry.name), rel);
        }
      }
    } catch { /* public dir may not exist in dev */ }
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Let API routes pass through (use originalUrl to account for global prefix)
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    // Only handle typical browser navigation requests (GET/HTML)
    if (req.method !== 'GET') {
      return next();
    }

    // If the path matches a known static file, let Express static middleware handle it
    if (this.staticFiles.has(req.path)) {
      return next();
    }

    // For all other routes, serve index.html (SPA fallback)
    res.sendFile(join(this.publicDir, 'index.html'));
  }
}
