import { MailGatewayService } from '../src/mail/sync/mail-gateway.service';
import { MailGateway } from '../src/mail/sync/mail-gateway.gateway';
import { MailStorageService } from '../src/mail/sync/mail-storage.service';
import { MailSsoService } from '../src/mail/mail-sso.service';
import { MailService } from '../src/mail/mail.service';

describe('MailGatewayService', () => {
  let service: MailGatewayService;
  let mockGateway: Partial<MailGateway>;
  let mockStorage: Partial<MailStorageService>;
  let mockSso: Partial<MailSsoService>;
  let mockMailService: Partial<MailService>;

  beforeEach(async () => {
    mockGateway = {
      emitToMailbox: jest.fn(),
    };
    const sampleMessage = {
      id: 'sample-msg-1',
      threadId: 'sample-thread-1',
      folder: 'inbox' as const,
      subject: 'Welcome to ClearMail',
      snippet: 'Welcome to your new inbox...',
      from: { name: 'Support', email: 'support@clearpanel.io' },
      to: [{ name: 'Test User', email: 'testuser@example.com' }],
      date: new Date().toISOString(),
      isRead: false,
      isStarred: false,
      hasAttachments: false,
      attachments: [],
    };

    mockStorage = {
      readFolderMessages: jest.fn().mockImplementation(async (_email, folder) => {
        if (folder === 'inbox') return [sampleMessage as any];
        return [];
      }),
      sendRealSmtp: jest.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
      verifyCredentials: jest.fn().mockResolvedValue({ valid: true, email: 'testuser@example.com' }),
    };
    mockSso = {
      verifyToken: jest.fn().mockReturnValue({ email: 'testuser@example.com' }),
    };
    mockMailService = {
      readDomains: jest.fn().mockResolvedValue([]),
    };

    service = new MailGatewayService(
      mockGateway as MailGateway,
      mockStorage as MailStorageService,
      mockSso as MailSsoService,
      mockMailService as MailService,
    );
    await service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should seed and list threads for a mailbox', async () => {
    const mailbox = 'testuser@example.com';
    const result = await service.getThreads(mailbox);

    expect(result.threads.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.threads[0].subject).toBeDefined();
  });

  it('should normalize subjects correctly', () => {
    expect(service.normalizeSubject('Re: Hello World')).toBe('Hello World');
    expect(service.normalizeSubject('Fwd: Re: [EXTERNAL] Project Kickoff')).toBe('Project Kickoff');
  });

  it('should queue an optimistic email with undo grace period', async () => {
    const mailbox = 'testuser@example.com';
    const res = await service.queueSend(mailbox, {
      to: [{ name: 'Client', email: 'client@partner.com' }],
      subject: 'Contract Proposal',
      bodyText: 'Please review the proposal.',
      undoGraceSeconds: 15,
    });

    expect(res.pendingId).toBeDefined();
    expect(res.threadId).toBeDefined();
    expect(res.undoGraceSeconds).toBe(15);
    expect(mockGateway.emitToMailbox).toHaveBeenCalledWith(
      mailbox,
      'mail:optimistic_sent',
      expect.anything(),
    );
  });

  it('should allow undoing / cancelling a send within grace period', async () => {
    const mailbox = 'testuser@example.com';
    const res = await service.queueSend(mailbox, {
      to: [{ name: 'Client', email: 'client@partner.com' }],
      subject: 'Typo Email',
      bodyText: 'Oops typo',
      undoGraceSeconds: 30,
    });

    const cancelled = await service.cancelSend(mailbox, res.pendingId);
    expect(cancelled).toBe(true);
    expect(mockGateway.emitToMailbox).toHaveBeenCalledWith(
      mailbox,
      'mail:send_cancelled',
      expect.anything(),
    );
  });

  it('should handle real-time inbound delivery and thread matching', async () => {
    const mailbox = 'testuser@example.com';
    const inbound = await service.handleInboundDelivery(mailbox, {
      from: { name: 'Support', email: 'support@cloud.com' },
      to: [{ name: 'Test', email: mailbox }],
      subject: 'Security Alert: New Sign-in',
      bodyText: 'A new sign-in was detected from Chrome on Windows.',
    });

    expect(inbound.threadId).toBeDefined();
    expect(inbound.messageId).toBeDefined();
    expect(mockGateway.emitToMailbox).toHaveBeenCalledWith(
      mailbox,
      'mail:new_incoming',
      expect.anything(),
    );
  });
});

