import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import type { RequestHandler } from 'express';

/**
 * Custom Socket.IO adapter that shares the Express session middleware with
 * WebSocket connections. This allows the TerminalGateway to read
 * `socket.request.session` and authenticate the user before spawning a PTY.
 */
export class SessionIoAdapter extends IoAdapter {
  private sessionMiddleware: RequestHandler;

  constructor(app: INestApplication, sessionMiddleware: RequestHandler) {
    super(app);
    this.sessionMiddleware = sessionMiddleware;
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);

    // Inject the Express session middleware into every Socket.IO handshake so
    // that socket.request.session is populated (and authenticated) at connect time.
    server.use((socket: any, next: (err?: any) => void) => {
      this.sessionMiddleware(socket.request, socket.request.res ?? {}, next);
    });

    return server;
  }
}
