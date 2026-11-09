import 'package:flutter/material.dart';
import 'services/mail_api_service.dart';
import 'services/mail_socket_service.dart';
import 'state/mail_state.dart';
import 'theme/gmail_theme.dart';
import 'widgets/app_bar/gmail_header.dart';
import 'widgets/sidebar/gmail_sidebar.dart';
import 'widgets/thread_list/thread_list_view.dart';
import 'widgets/conversation/conversation_view.dart';
import 'widgets/compose/compose_dialog.dart';
import 'widgets/auth/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ClearMailApp());
}

class ClearMailApp extends StatelessWidget {
  const ClearMailApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ClearMail - Business Email',
      debugShowCheckedModeBanner: false,
      theme: GmailTheme.lightTheme,
      home: const ClearMailHome(),
    );
  }
}

class ClearMailHome extends StatefulWidget {
  const ClearMailHome({super.key});

  @override
  State<ClearMailHome> createState() => _ClearMailHomeState();
}

class _ClearMailHomeState extends State<ClearMailHome> {
  late MailApiService _apiService;
  late MailSocketService _socketService;
  late MailState _mailState;

  bool _isSidebarCollapsed = false;
  bool _isComposeOpen = false;

  // Compose initial data (e.g. for reply)
  String? _composeTo;
  String? _composeSubject;
  String? _composeBody;
  String? _composeReplyThreadId;

  @override
  void initState() {
    super.initState();
    _apiService = MailApiService();
    _socketService = MailSocketService();
    _mailState = MailState(
      apiService: _apiService,
      socketService: _socketService,
    );

    // Check SSO token in URL parameters (?sso_token=xyz)
    final ssoToken = Uri.base.queryParameters['sso_token'];
    _mailState.initAuthAndLoad(ssoToken: ssoToken);
  }

  @override
  void dispose() {
    _mailState.dispose();
    super.dispose();
  }

  void _openCompose({
    String? to,
    String? subject,
    String? body,
    String? replyThreadId,
  }) {
    setState(() {
      _composeTo = to;
      _composeSubject = subject;
      _composeBody = body;
      _composeReplyThreadId = replyThreadId;
      _isComposeOpen = true;
    });
  }

  void _closeCompose() {
    setState(() {
      _isComposeOpen = false;
      _composeTo = null;
      _composeSubject = null;
      _composeBody = null;
      _composeReplyThreadId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _mailState,
      builder: (context, _) {
        if (!_mailState.isAuthInitialized) {
          return const Scaffold(
            backgroundColor: GmailColors.scaffoldBackground,
            body: Center(
              child: CircularProgressIndicator(color: GmailColors.googleBlue),
            ),
          );
        }

        if (!_mailState.isAuthenticated) {
          return LoginScreen(state: _mailState);
        }

        return Scaffold(
          body: Stack(
            children: [
              // Main Layout Column
              Column(
                children: [
                  // Gmail Header
                  GmailHeader(
                    state: _mailState,
                    onToggleSidebar: () {
                      setState(() {
                        _isSidebarCollapsed = !_isSidebarCollapsed;
                      });
                    },
                  ),

                  // Main Content Area (Sidebar + Threads/Conversation)
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Sidebar
                        GmailSidebar(
                          state: _mailState,
                          isCollapsed: _isSidebarCollapsed,
                          onComposePressed: () => _openCompose(),
                        ),

                        // Center View: Either Thread List or Conversation View
                        Expanded(
                          child: _mailState.selectedThread != null
                              ? ConversationView(
                                  thread: _mailState.selectedThread!,
                                  state: _mailState,
                                  onBack: _mailState.closeThread,
                                  onReply: (threadId, subject) {
                                    _openCompose(
                                      subject: subject,
                                      replyThreadId: threadId,
                                    );
                                  },
                                )
                              : ThreadListView(
                                  state: _mailState,
                                  onOpenThread: _mailState.openThread,
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Floating Docked Compose Dialog (Bottom-Right)
              if (_isComposeOpen)
                Positioned(
                  right: 24,
                  bottom: 0,
                  child: ComposeDialog(
                    initialTo: _composeTo,
                    initialSubject: _composeSubject,
                    initialBody: _composeBody,
                    replyToThreadId: _composeReplyThreadId,
                    onClose: _closeCompose,
                    onSend: ({
                      required to,
                      cc,
                      required subject,
                      required bodyText,
                      replyToThreadId,
                    }) {
                      _closeCompose();
                      _mailState.sendEmail(
                        to: to,
                        cc: cc,
                        subject: subject,
                        bodyText: bodyText,
                        replyToThreadId: replyToThreadId,
                        undoGraceSeconds: 10,
                      );
                    },
                  ),
                ),

              // Floating "Undo Send" Snackbar (Bottom-Left)
              if (_mailState.activePendingSendId != null)
                Positioned(
                  left: 24,
                  bottom: 24,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF202124),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.check_circle, color: GmailColors.googleGreen, size: 18),
                        const SizedBox(width: 10),
                        const Text(
                          'Message sent.',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(width: 16),
                        InkWell(
                          onTap: () async {
                            final draft = await _mailState.undoSend();
                            if (draft != null) {
                              _openCompose(
                                subject: draft['subject'],
                                body: draft['bodyText'],
                                replyThreadId: draft['replyToThreadId'],
                              );
                            }
                          },
                          child: Text(
                            'Undo (${_mailState.undoCountdown}s)',
                            style: const TextStyle(
                              color: Color(0xFF8AB4F8),
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        InkWell(
                          onTap: () {},
                          child: const Text(
                            'View message',
                            style: TextStyle(
                              color: Color(0xFF8AB4F8),
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
