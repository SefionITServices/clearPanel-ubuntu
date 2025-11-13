import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
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

  app.setGlobalPrefix('api');

  // Serve static frontend files in production
  if (config.get<string>('NODE_ENV') === 'production') {
    app.useStaticAssets(join(__dirname, '..', 'public'));
    app.setBaseViewsDir(join(__dirname, '..', 'public'));
  }

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Nest backend running on http://localhost:${port}`);
  console.log(`Environment: ${config.get<string>('NODE_ENV') || 'development'}`);
}

bootstrap();
