import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MailGatewayService } from './mail-gateway.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/mail-sync',
})
export class MailGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MailGateway.name);

  constructor(
    @Inject(forwardRef(() => MailGatewayService))
    private readonly mailGatewayService: MailGatewayService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { mailboxEmail: string; token?: string },
  ) {
    if (!payload?.mailboxEmail) {
      return { status: 'error', message: 'mailboxEmail is required' };
    }
    const room = `mailbox:${payload.mailboxEmail.trim().toLowerCase()}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    this.mailGatewayService.getStore(payload.mailboxEmail).catch(() => {});
    return { status: 'ok', room };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { mailboxEmail: string },
  ) {
    if (payload?.mailboxEmail) {
      const room = `mailbox:${payload.mailboxEmail.trim().toLowerCase()}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
    }
    return { status: 'ok' };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', timestamp: Date.now() };
  }

  /**
   * Broadcast an event to all connected clients listening to this mailbox
   */
  emitToMailbox(mailboxEmail: string, event: string, payload: any) {
    if (!this.server) {
      this.logger.warn(`Cannot emit '${event}', WebSocket server not initialized`);
      return;
    }
    const room = `mailbox:${mailboxEmail.trim().toLowerCase()}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Emitted '${event}' to room ${room}`);
  }
}
