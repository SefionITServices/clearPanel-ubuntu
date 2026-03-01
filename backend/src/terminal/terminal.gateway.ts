import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as pty from 'node-pty';
import os from 'os';

/**
 * WebSocket gateway that provides a real PTY-backed terminal session.
 *
 * Transport:   Socket.IO  (namespace /terminal)
 * Auth:        Checked against express-session (injected via SessionIoAdapter)
 *
 * Client → Server events:
 *   terminal:input   – string  – user keystroke(s) / paste
 *   terminal:resize  – { cols, rows } – terminal dimensions changed
 *
 * Server → Client events:
 *   terminal:output  – string  – raw PTY output (including ANSI sequences)
 *   terminal:exit    – { exitCode } – shell process exited
 *   terminal:error   – string  – fatal error before pty was created
 */
@WebSocketGateway({
  namespace: '/terminal',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TerminalGateway.name);

  @WebSocketServer()
  server!: Server;

  /** One PTY per connected socket */
  private ptys = new Map<string, pty.IPty>();

  // ── Connection lifecycle ──────────────────────────────────────────────────

  handleConnection(client: Socket): void {
    // Verify that the connecting socket belongs to an authenticated session.
    const session = (client.request as any).session as Record<string, any> | undefined;
    if (!session?.username) {
      this.logger.warn(`Unauthenticated WS connection rejected: ${client.id}`);
      client.emit('terminal:error', 'Unauthorized — please log in.');
      client.disconnect(true);
      return;
    }

    const shell = process.env.SHELL || '/bin/bash';
    // Resolve the logged-in user's home directory
    const username = session.username;
    let home = username === 'root' ? '/root' : `/home/${username}`;

    // Fallback: if the home directory doesn't exist, use root directory to prevent PTY crash
    const fs = require('fs');
    if (!fs.existsSync(home)) {
      home = '/';
    }

    try {
      const term = pty.spawn(shell, [], {
        name:  'xterm-256color',
        cols:  80,
        rows:  24,
        cwd:   home,
        env:   { ...process.env, HOME: home } as { [key: string]: string },
      });

      this.ptys.set(client.id, term);
      this.logger.log(`PTY pid=${term.pid} spawned for socket=${client.id} user=${session.username}`);

      term.onData((data: string) => {
        client.emit('terminal:output', data);
      });

      term.onExit(({ exitCode }) => {
        this.logger.log(`PTY pid=${term.pid} exited code=${exitCode}`);
        client.emit('terminal:exit', { exitCode });
        this.ptys.delete(client.id);
      });
    } catch (err: any) {
      this.logger.error(`Failed to spawn PTY: ${err.message}`);
      client.emit('terminal:error', 'Could not start terminal session on server.');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const term = this.ptys.get(client.id);
    if (term) {
      this.logger.log(`Killing PTY pid=${term.pid} for disconnected socket=${client.id}`);
      try { term.kill(); } catch { /* ignore race */ }
      this.ptys.delete(client.id);
    }
  }

  // ── Client events ─────────────────────────────────────────────────────────

  /** Forward raw keystrokes / paste data into the PTY */
  @SubscribeMessage('terminal:input')
  handleInput(
    @MessageBody() data: string,
    @ConnectedSocket() client: Socket,
  ): void {
    const term = this.ptys.get(client.id);
    if (term) term.write(data);
  }

  /** Resize the PTY when the browser terminal dimensions change */
  @SubscribeMessage('terminal:resize')
  handleResize(
    @MessageBody() data: { cols: number; rows: number },
    @ConnectedSocket() client: Socket,
  ): void {
    const term = this.ptys.get(client.id);
    if (term && data?.cols && data?.rows) {
      term.resize(Math.max(1, data.cols), Math.max(1, data.rows));
    }
  }
}
