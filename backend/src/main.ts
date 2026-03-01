import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import session from 'express-session';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { runPendingMigrations } from './migrations/migration-runner';
import { SessionIoAdapter } from './terminal/io-adapter';

async function bootstrap() {
  // Run data migrations before creating the Nest app (schema must be current)
  await runPendingMigrations();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Enable global DTO validation with class-validator
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // Strip properties not in DTO
    forbidNonWhitelisted: false, // Don't error on extra props (backward compat)
    transform: true,           // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // When behind Cloudflare/NGINX/etc., trust the proxy to get correct protocol/IP
  app.set('trust proxy', 1);

  // Auto-generate a session secret if none is configured (persists for this process lifetime)
  let sessionSecret = config.get<string>('SESSION_SECRET');
  if (!sessionSecret || sessionSecret === 'change-this-to-a-random-secure-string') {
    sessionSecret = randomBytes(32).toString('hex');
    Logger.warn(
      'SESSION_SECRET is not configured — generated an ephemeral secret. '
      + 'Sessions will not survive server restarts. Set SESSION_SECRET in .env for persistence.',
      'Bootstrap',
    );
  }

  const sessionMiddleware = session({
    secret: sessionSecret,
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
    },
  });

  app.use(sessionMiddleware);

  // Share the session middleware with Socket.IO so TerminalGateway can
  // read socket.request.session and authenticate PTY connections.
  app.useWebSocketAdapter(new SessionIoAdapter(app, sessionMiddleware));

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
