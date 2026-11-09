import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:html' as html;
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

  String? _extractSsoToken() {
    if (kIsWeb) {
      try {
        final search = html.window.location.search;
        if (search != null && search.isNotEmpty) {
          final queryStr = search.startsWith('?') ? search.substring(1) : search;
          final params = Uri.splitQueryString(queryStr);
          if (params['sso_token'] != null && params['sso_token']!.isNotEmpty) {
            return params['sso_token'];
          }
        }

        final hash = html.window.location.hash;
        if (hash != null && hash.contains('?')) {
          final qIndex = hash.indexOf('?');
          final params = Uri.splitQueryString(hash.substring(qIndex + 1));
          if (params['sso_token'] != null && params['sso_token']!.isNotEmpty) {
            return params['sso_token'];
          }
        }

        final href = html.window.location.href;
        if (href != null && href.contains('sso_token=')) {
          final uri = Uri.parse(href);
          if (uri.queryParameters['sso_token'] != null && uri.queryParameters['sso_token']!.isNotEmpty) {
            return uri.queryParameters['sso_token'];
          }
        }
      } catch (_) {}
    }

    final q = Uri.base.queryParameters['sso_token'];
    if (q != null && q.isNotEmpty) return q;

    if (Uri.base.hasFragment) {
      final frag = Uri.base.fragment;
      final qIndex = frag.indexOf('?');
      if (qIndex != -1) {
        final params = Uri.splitQueryString(frag.substring(qIndex + 1));
        if (params['sso_token'] != null && params['sso_token']!.isNotEmpty) {
          return params['sso_token'];
        }
      }
    }

    return null;
  }

  @override
  void initState() {
    super.initState();
    _apiService = MailApiService();
    _socketService = MailSocketService();
    _mailState = MailState(
      apiService: _apiService,
      socketService: _socketService,
    );

    // Check SSO token in URL parameters (?sso_token=xyz or from fragment)
    final ssoToken = _extractSsoToken();
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

  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

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

    final isMobile = MediaQuery.of(context).size.width < 768;

    return KeyboardListener(
      focusNode: _keyboardFocusNode,
      autofocus: true,
      onKeyEvent: _handleKeyEvent,
      child: Scaffold(
        key: _scaffoldKey,
        drawer: isMobile
            ? Drawer(
                child: GmailSidebar(
                  state: _mailState,
                  isCollapsed: false,
                  isDrawer: true,
                  onComposePressed: () {
                    Navigator.of(context).pop();
                    _openCompose();
                  },
                  onFolderSelected: () {
                    Navigator.of(context).pop();
                  },
                ),
              )
            : null,
        floatingActionButton: (isMobile && _mailState.selectedThread == null && !_isComposeOpen)
            ? FloatingActionButton.extended(
                onPressed: () => _openCompose(),
                backgroundColor: GmailColors.surfaceWhite,
                elevation: 4,
                icon: const Icon(Icons.edit_outlined, color: GmailColors.googleRed),
                label: const Text(
                  'Compose',
                  style: TextStyle(color: GmailColors.textDark, fontWeight: FontWeight.bold),
                ),
              )
            : null,
        body: Stack(
          children: [
            // Main Layout Column
            Column(
              children: [
                // Gmail Header
                GmailHeader(
                  state: _mailState,
                  onToggleSidebar: () {
                    if (isMobile) {
                      _scaffoldKey.currentState?.openDrawer();
                    } else {
                      setState(() {
                        _isSidebarCollapsed = !_isSidebarCollapsed;
                      });
                    }
                  },
                ),

                // Main Content Area
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Desktop Sidebar
                      if (!isMobile)
                        GmailSidebar(
                          state: _mailState,
                          isCollapsed: _isSidebarCollapsed,
                          onComposePressed: () => _openCompose(),
                        ),

                      // Center Views (Single Pane vs. Split-View)
                      Expanded(
                        child: (!isMobile && _mailState.isSplitView)
                            ? _buildSplitView()
                            : _buildSinglePaneView(),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Floating Docked Compose Dialog (Full screen on mobile, bottom-right on desktop)
            if (_isComposeOpen)
              isMobile
                  ? Positioned.fill(
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
                    )
                  : Positioned(
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

            // Floating "Undo Send" Snackbar
            if (_mailState.activePendingSendId != null)
              Positioned(
                left: isMobile ? 16 : 24,
                right: isMobile ? 16 : null,
                bottom: isMobile ? 16 : 24,
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
                    mainAxisSize: isMobile ? MainAxisSize.max : MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle, color: GmailColors.googleGreen, size: 18),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Message sent.',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                        ),
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
