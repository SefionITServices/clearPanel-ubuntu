import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // When behind Cloudflare/NGINX/etc., trust the proxy to get correct protocol/IP
  app.set('trust proxy', 1);

  app.use(session({
    secret: config.get<string>('SESSION_SECRET') || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000,
      // Allow overriding cookie security for HTTP tunnels/port-forwarding
      // Set SESSION_SECURE=true only when serving via HTTPS end-to-end
      secure: (config.get<string>('SESSION_SECURE') || '').toLowerCase() === 'true'
        || config.get<string>('NODE_ENV') === 'production' && (config.get<string>('FORCE_SECURE') || '').toLowerCase() === 'true',
      httpOnly: true,
      sameSite: 'lax',
    }
  }));

  // Compress all responses (gzip/brotli) — major speed improvement
  app.use(compression());

  app.setGlobalPrefix('api');

  // Serve static frontend files in production with cache headers
  if (config.get<string>('NODE_ENV') === 'production') {
    app.useStaticAssets(join(__dirname, '..', 'public'), {
      maxAge: '7d',           // cache static assets for 7 days
      immutable: true,        // hashed filenames never change
      etag: true,
      lastModified: true,
    });
    app.setBaseViewsDir(join(__dirname, '..', 'public'));
  }

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Nest backend running on http://localhost:${port}`);
  console.log(`Environment: ${config.get<string>('NODE_ENV') || 'development'}`);
}

bootstrap();
