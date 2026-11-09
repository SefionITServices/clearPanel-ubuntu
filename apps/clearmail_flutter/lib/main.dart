import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

class ClearMailApp extends StatefulWidget {
  const ClearMailApp({super.key});

  @override
  State<ClearMailApp> createState() => _ClearMailAppState();
}

class _ClearMailAppState extends State<ClearMailApp> {
  late MailApiService _apiService;
  late MailSocketService _socketService;
  late MailState _mailState;

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

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _mailState,
      builder: (context, _) {
        return MaterialApp(
          title: 'ClearMail - Business Email',
          debugShowCheckedModeBanner: false,
          theme: GmailTheme.lightTheme,
          darkTheme: GmailTheme.darkTheme,
          themeMode: _mailState.isDarkMode ? ThemeMode.dark : ThemeMode.light,
          home: ClearMailHome(mailState: _mailState),
        );
      },
    );
  }
}

class ClearMailHome extends StatefulWidget {
  final MailState mailState;

  const ClearMailHome({super.key, required this.mailState});

  @override
  State<ClearMailHome> createState() => _ClearMailHomeState();
}

class _ClearMailHomeState extends State<ClearMailHome> {
  MailState get _mailState => widget.mailState;

  bool _isSidebarCollapsed = false;
  bool _isComposeOpen = false;

  // Compose initial data
  String? _composeTo;
  String? _composeSubject;
  String? _composeBody;
  String? _composeReplyThreadId;

  final FocusNode _keyboardFocusNode = FocusNode();

  @override
  void dispose() {
    _keyboardFocusNode.dispose();
    super.dispose();
  }

  void _openCompose({
    String? to,
    List<Map<String, String>>? toList,
    List<Map<String, String>>? ccList,
    String? subject,
    String? body,
    String? replyThreadId,
  }) {
    setState(() {
      _composeTo = to ?? (toList != null ? toList.map((e) => e['email']).join(', ') : null);
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

  void _handleKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return;

    // Check if user is typing in an active input field
    final focus = FocusManager.instance.primaryFocus;
    if (focus?.context?.widget is EditableText) {
      return;
    }

    if (event.logicalKey == LogicalKeyboardKey.keyC) {
      _openCompose();
    } else if (event.logicalKey == LogicalKeyboardKey.keyE) {
      if (_mailState.selectedThreadIds.isNotEmpty) {
        _mailState.batchArchive();
      }
    } else if (event.logicalKey == LogicalKeyboardKey.keyS) {
      if (_mailState.selectedThread != null) {
        _mailState.toggleStar(_mailState.selectedThread!);
      }
    } else if (event.logicalKey == LogicalKeyboardKey.escape) {
      if (_isComposeOpen) {
        _closeCompose();
      } else if (_mailState.selectedThread != null) {
        _mailState.closeThread();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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

    return KeyboardListener(
      focusNode: _keyboardFocusNode,
      autofocus: true,
      onKeyEvent: _handleKeyEvent,
      child: Scaffold(
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

                // Main Content Area
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

                      // Center Views (Single Pane vs. Split-View)
                      Expanded(
                        child: _mailState.isSplitView
                            ? _buildSplitView()
                            : _buildSinglePaneView(),
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
                  state: _mailState,
                  initialTo: _composeTo,
                  initialSubject: _composeSubject,
                  initialBody: _composeBody,
                  replyToThreadId: _composeReplyThreadId,
                  onClose: _closeCompose,
                  onSend: ({
                    required to,
                    cc,
                    bcc,
                    required subject,
                    required bodyText,
                    attachments,
                    replyToThreadId,
                  }) {
                    _closeCompose();
                    _mailState.sendEmail(
                      to: to,
                      cc: cc,
                      bcc: bcc,
                      subject: subject,
                      bodyText: bodyText,
                      attachments: attachments,
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
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSinglePaneView() {
    return _mailState.selectedThread != null
        ? ConversationView(
            thread: _mailState.selectedThread!,
            state: _mailState,
            onBack: _mailState.closeThread,
            onReply: (threadId, subject, {to, cc}) {
              _openCompose(
                subject: subject,
                replyThreadId: threadId,
                toList: to,
                ccList: cc,
              );
            },
          )
        : ThreadListView(
            state: _mailState,
            onOpenThread: _mailState.openThread,
          );
  }

  Widget _buildSplitView() {
    return Row(
      children: [
        SizedBox(
          width: 440,
          child: ThreadListView(
            state: _mailState,
            onOpenThread: _mailState.openThread,
          ),
        ),
        const VerticalDivider(width: 1, color: GmailColors.threadBorder),
        Expanded(
          child: _mailState.selectedThread != null
              ? ConversationView(
                  thread: _mailState.selectedThread!,
                  state: _mailState,
                  onBack: _mailState.closeThread,
                  onReply: (threadId, subject, {to, cc}) {
                    _openCompose(
                      subject: subject,
                      replyThreadId: threadId,
                      toList: to,
                      ccList: cc,
                    );
                  },
                )
              : Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.mail_outline, size: 64, color: Colors.grey.shade400),
                      const SizedBox(height: 16),
                      Text(
                        'Select an email to read',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}
