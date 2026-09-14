import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';

interface SharePayload {
  username: string;
  path: string;
  nonce: string;
  exp: number;
  disposition?: 'inline' | 'attachment';
}

@Injectable()
export class FileShareService {
  private readonly logger = new Logger(FileShareService.name);
  private readonly secret: string;
  private readonly usedNonces: Set<string> = new Set();
  private readonly nonceQueue: string[] = [];
  private readonly MAX_USED_NONCES = 500;

  constructor(private readonly config: ConfigService) {
    const configured = this.config.get<string>('FILE_SHARE_SECRET') || this.config.get<string>('SESSION_SECRET');
    if (configured && configured !== 'change-this-to-a-random-secure-string') {
      this.secret = configured;
    } else {
      this.secret = randomBytes(32).toString('hex');
      this.logger.warn('FILE_SHARE_SECRET is not configured — generated an ephemeral secret. Tokens will not survive restarts.');
    }
  }

  generateToken(username: string, pathParam: string, ttlSeconds = 3600, disposition: 'inline' | 'attachment' = 'attachment'): string {
    const payload: SharePayload = {
      username,
      path: pathParam,
      nonce: randomBytes(16).toString('hex'),
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
      disposition,
    };
    const token = this.signPayload(payload);
    this.logger.log(`Issued file share token for ${username}:${pathParam} ttl=${ttlSeconds}`);
    return token;
  }

  verifyToken(token: string): SharePayload {
    const dotIdx = token.indexOf('.');
    if (dotIdx < 0) throw new BadRequestException('Invalid token format');

    const payloadB64 = token.substring(0, dotIdx);
    const sig = token.substring(dotIdx + 1);
    const expected = createHmac('sha256', this.secret).update(payloadB64).digest('hex');
    if (sig !== expected) throw new BadRequestException('Invalid token signature');

    let payload: SharePayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed token payload');
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) throw new BadRequestException('Token expired');
    if (this.usedNonces.has(payload.nonce)) throw new BadRequestException('Token nonce already used');
    this.consumeNonce(payload.nonce);
    return payload;
  }

  private signPayload(payload: SharePayload): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(payloadB64).digest('hex');
    return `${payloadB64}.${sig}`;
  }

  private consumeNonce(nonce: string): void {
    this.usedNonces.add(nonce);
    this.nonceQueue.push(nonce);
    while (this.nonceQueue.length > this.MAX_USED_NONCES) {
      const old = this.nonceQueue.shift();
      if (old) this.usedNonces.delete(old);
    }
  }
}
