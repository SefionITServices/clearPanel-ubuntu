import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class FallbackMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Let API routes pass through (use originalUrl to account for global prefix)
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    // Only handle typical browser navigation requests (GET/HTML)
    if (req.method !== 'GET') {
      return next();
    }

    // Check if file exists in public directory
    const publicPath = join(__dirname, '..', 'public', req.path);
    if (existsSync(publicPath) && !req.path.endsWith('/')) {
      return next();
    }

    // For all other routes, serve index.html (SPA fallback)
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }
}
