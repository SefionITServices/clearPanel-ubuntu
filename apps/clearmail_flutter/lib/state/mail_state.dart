import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:html' as html;
import '../models/email_models.dart';
import '../services/mail_api_service.dart';
import '../services/mail_socket_service.dart';

class MailState extends ChangeNotifier {
  final MailApiService apiService;
  final MailSocketService socketService;

  String _currentMailbox = '';
  String? _sessionToken;
  bool _isAuthInitialized = false;
  String _currentFolder = 'inbox';
  String? _currentLabel;
  String _currentCategory = 'primary'; // primary, social, promotions, updates

  bool _isLoading = false;
  String? _errorMessage;
  bool _isRealtimeConnected = false;
  bool _isDarkMode = false;
  bool _isSplitView = false;

  List<EmailThread> _threads = [];
  EmailThread? _selectedThread;
  final Set<String> _selectedThreadIds = {};

  String _searchQuery = '';
  MailboxStats? _stats;
  String _displayName = '';
  String? _avatarUrl;

  // Undo Send Manager
  String? _activePendingSendId;
  int _undoCountdown = 0;
  Timer? _undoTimer;
  Map<String, dynamic>? _lastSentDraft;

  MailState({
    required this.apiService,
    required this.socketService,
  });

  // Getters
  String get currentMailbox => _currentMailbox;
  String? get sessionToken => _sessionToken;
  bool get isAuthInitialized => _isAuthInitialized;
  bool get isAuthenticated => _currentMailbox.isNotEmpty;
  String get currentFolder => _currentFolder;
  String? get currentLabel => _currentLabel;
  String get currentCategory => _currentCategory;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isRealtimeConnected => _isRealtimeConnected;
  bool get isDarkMode => _isDarkMode;
  bool get isSplitView => _isSplitView;
  List<EmailThread> get threads => _threads;
  EmailThread? get selectedThread => _selectedThread;
  Set<String> get selectedThreadIds => _selectedThreadIds;
  String get searchQuery => _searchQuery;
  MailboxStats? get stats => _stats;
  String? get activePendingSendId => _activePendingSendId;
  int get undoCountdown => _undoCountdown;
  String get displayName => _displayName;
  String? get avatarUrl => _avatarUrl;

  Future<void> loadProfile() async {
    if (_currentMailbox.isEmpty) return;
    try {
      final p = await apiService.getProfile(mailbox: _currentMailbox);
      _displayName = p['name'] ?? '';
      _avatarUrl = p['avatarUrl'];
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> updateProfile({String? name, List<int>? avatarBytes, String? filename}) async {
    try {
      final res = await apiService.updateProfile(
        mailbox: _currentMailbox,
        name: name,
        avatarBytes: avatarBytes,
        filename: filename,
      );
      if (res['name'] != null) _displayName = res['name'];
      if (res['avatarUrl'] != null) _avatarUrl = res['avatarUrl'];
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to update profile: $e';
      notifyListeners();
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle & Persistence
  // ---------------------------------------------------------------------------

  Future<void> initAuthAndLoad({String? ssoToken}) async {
    _initSocket();

    // 1. If opened with SSO token (?sso_token=...), authenticate via SSO
    if (ssoToken != null && ssoToken.isNotEmpty) {
      final success = await handleSso(ssoToken);
      if (success) {
        _isAuthInitialized = true;
        notifyListeners();
        return;
      }
    }

    // 2. Load preferences (theme, layout)
    try {
      final prefs = await SharedPreferences.getInstance();
      _isDarkMode = prefs.getBool('clearmail_dark_mode') ?? false;
      _isSplitView = prefs.getBool('clearmail_split_view') ?? false;
    } catch (_) {}

    // 3. Regular link access:
    // If the user refreshed the active tab, restore session from sessionStorage.
    // When opened from a new tab, window, or regular link, sessionStorage is empty,
    // so the user is prompted to enter their email ID and password.
    if (kIsWeb) {
      try {
        final sessionEmail = html.window.sessionStorage['clearmail_session_email'];
        final sessionToken = html.window.sessionStorage['clearmail_session_token'];
        if (sessionEmail != null && sessionEmail.isNotEmpty) {
          _currentMailbox = sessionEmail;
          _sessionToken = sessionToken;
          socketService.connect(_currentMailbox);
          await loadThreads();
          await loadStats();
          await loadProfile();
        }
      } catch (_) {}
    }

    _isAuthInitialized = true;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Authentication (Login / Logout / SSO)
  // ---------------------------------------------------------------------------

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await apiService.login(email: email, password: password);
      _sessionToken = res['token'];
      _currentMailbox = res['email'];

      if (kIsWeb) {
        try {
          html.window.sessionStorage['clearmail_session_email'] = _currentMailbox;
          if (_sessionToken != null) {
            html.window.sessionStorage['clearmail_session_token'] = _sessionToken!;
          }
          final path = html.window.location.pathname ?? '/';
          html.window.history.replaceState(null, 'ClearMail', path);
        } catch (_) {}
      }

      // Reset old threads/selection to guarantee domain/mailbox isolation
      _threads.clear();
      _selectedThread = null;
      _selectedThreadIds.clear();

      socketService.connect(_currentMailbox);
      await loadThreads();
      await loadStats();
      await loadProfile();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> handleSso(String ssoToken) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await apiService.ssoLogin(ssoToken: ssoToken);
      _sessionToken = res['token'];
      _currentMailbox = res['email'];

      if (kIsWeb) {
        try {
          html.window.sessionStorage['clearmail_session_email'] = _currentMailbox;
          if (_sessionToken != null) {
            html.window.sessionStorage['clearmail_session_token'] = _sessionToken!;
          }
          final path = html.window.location.pathname ?? '/';
          html.window.history.replaceState(null, 'ClearMail', path);
        } catch (_) {}
      }

      // Reset old threads/selection to guarantee domain/mailbox isolation
      _threads.clear();
      _selectedThread = null;
      _selectedThreadIds.clear();

      socketService.connect(_currentMailbox);
      await loadThreads();
      await loadStats();
      await loadProfile();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _sessionToken = null;
    _currentMailbox = '';
    _threads.clear();
    _selectedThread = null;
    _selectedThreadIds.clear();
    socketService.disconnect();

    if (kIsWeb) {
      try {
        html.window.sessionStorage.remove('clearmail_session_email');
        html.window.sessionStorage.remove('clearmail_session_token');
        final path = html.window.location.pathname ?? '/';
        html.window.history.replaceState(null, 'ClearMail', path);
      } catch (_) {}
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('clearmail_user_email');
      await prefs.remove('clearmail_session_token');
    } catch (_) {}

    notifyListeners();
  }

  void _initSocket() {
    socketService.onConnectionChange = (connected) {
      _isRealtimeConnected = connected;
      notifyListeners();
    };

    socketService.onNewIncoming = (msg, threadId) {
      // Find if thread exists
      final index = _threads.indexWhere((t) => t.id == threadId);
      if (index != -1) {
        final existing = _threads[index];
        existing.snippet = msg.snippet;
        existing.lastMessageDate = msg.date;
        existing.messageCount += 1;
        existing.unreadCount += 1;
        existing.folder = 'inbox';
        // Move to top
        _threads.removeAt(index);
        _threads.insert(0, existing);
      } else {
        // Create new thread at top
        final newThread = EmailThread(
          id: threadId,
          subject: msg.subject,
          snippet: msg.snippet,
          lastMessageDate: msg.date,
          messageCount: 1,
          unreadCount: 1,
          participants: [msg.from],
          folder: 'inbox',
          labels: msg.labels,
          hasAttachments: msg.hasAttachments,
          isStarred: false,
        );
        _threads.insert(0, newThread);
      }
      loadStats();
      notifyListeners();
    };

    if (_currentMailbox.isNotEmpty) {
      socketService.connect(_currentMailbox);
    }
  }

  void switchMailbox(String newMailbox) {
    if (_currentMailbox == newMailbox) return;
    _currentMailbox = newMailbox;
    _selectedThread = null;
    _selectedThreadIds.clear();
    socketService.connect(_currentMailbox);
    loadThreads();
    loadStats();
    notifyListeners();
  }

  void setFolder(String folder) {
    _currentFolder = folder;
    _currentLabel = null;
    _selectedThread = null;
    _selectedThreadIds.clear();
    loadThreads();
    notifyListeners();
  }

  void setLabel(String label) {
    _currentLabel = label;
    _currentFolder = '';
    _selectedThread = null;
    _selectedThreadIds.clear();
    loadThreads();
    notifyListeners();
  }

  void setCategory(String category) {
    _currentCategory = category;
    notifyListeners();
  }

  Future<void> loadThreads() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      if (_searchQuery.isNotEmpty) {
        _threads = await apiService.search(mailbox: _currentMailbox, query: _searchQuery);
      } else {
        _threads = await apiService.fetchThreads(
          mailbox: _currentMailbox,
          folder: _currentFolder.isEmpty ? 'inbox' : _currentFolder,
          label: _currentLabel,
        );
      }
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadStats() async {
    try {
      _stats = await apiService.fetchStats(mailbox: _currentMailbox);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> openThread(EmailThread thread) async {
    _selectedThread = thread;
    notifyListeners();

    // Mark as read optimistically
    if (thread.isUnread) {
      thread.unreadCount = 0;
      apiService.batchUpdateThreads(
        mailbox: _currentMailbox,
        threadIds: [thread.id],
        markAsRead: true,
      );
      loadStats();
    }

    try {
      final fullThread = await apiService.fetchThreadDetails(
        mailbox: _currentMailbox,
        threadId: thread.id,
      );
      if (_selectedThread?.id == thread.id) {
        _selectedThread = fullThread;
        notifyListeners();
      }
    } catch (_) {}
  }

  void closeThread() {
    _selectedThread = null;
    notifyListeners();
  }

  void toggleDarkMode() async {
    _isDarkMode = !_isDarkMode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('clearmail_dark_mode', _isDarkMode);
    } catch (_) {}
  }

  void toggleSplitView() async {
    _isSplitView = !_isSplitView;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('clearmail_split_view', _isSplitView);
    } catch (_) {}
  }

  Future<List<Map<String, String>>> suggestContacts(String query) async {
    return apiService.suggestContacts(mailbox: _currentMailbox, query: query);
  }

  Future<Map<String, dynamic>> uploadAttachment({
    required String filename,
    required List<int> bytes,
  }) async {
    return apiService.uploadAttachment(filename: filename, bytes: bytes);
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------
  void toggleSelectThread(String threadId) {
    if (_selectedThreadIds.contains(threadId)) {
      _selectedThreadIds.remove(threadId);
    } else {
      _selectedThreadIds.add(threadId);
    }
    notifyListeners();
  }

  void selectAllThreads(bool select) {
    if (select) {
      _selectedThreadIds.addAll(_threads.map((t) => t.id));
    } else {
      _selectedThreadIds.clear();
    }
    notifyListeners();
  }

  void clearSelection() {
    _selectedThreadIds.clear();
    notifyListeners();
  }

  void toggleTheme() => toggleDarkMode();

  // ---------------------------------------------------------------------------
  // Optimistic Thread Actions
  // ---------------------------------------------------------------------------
  void toggleStar(EmailThread thread) {
    thread.isStarred = !thread.isStarred;
    notifyListeners();

    apiService.batchUpdateThreads(
      mailbox: _currentMailbox,
      threadIds: [thread.id],
      isStarred: thread.isStarred,
    );
  }

  void batchArchive() {
    final ids = _selectedThreadIds.toList();
    _threads.removeWhere((t) => ids.contains(t.id));
    _selectedThreadIds.clear();
    notifyListeners();

    apiService.batchUpdateThreads(
      mailbox: _currentMailbox,
      threadIds: ids,
      folder: 'archive',
    );
    loadStats();
  }

  void batchDelete() {
    final ids = _selectedThreadIds.toList();
    _threads.removeWhere((t) => ids.contains(t.id));
    _selectedThreadIds.clear();
    notifyListeners();

    apiService.batchUpdateThreads(
      mailbox: _currentMailbox,
      threadIds: ids,
      folder: 'trash',
    );
    loadStats();
  }

  void batchMarkAsRead(bool read) {
    final ids = _selectedThreadIds.toList();
    for (final t in _threads.where((t) => ids.contains(t.id))) {
      t.unreadCount = read ? 0 : 1;
    }
    _selectedThreadIds.clear();
    notifyListeners();

    apiService.batchUpdateThreads(
      mailbox: _currentMailbox,
      threadIds: ids,
      markAsRead: read,
    );
    loadStats();
  }

  // ---------------------------------------------------------------------------
  // Optimistic Send & Undo Send
  // ---------------------------------------------------------------------------
  Future<void> sendEmail({
    required List<Map<String, String>> to,
    List<Map<String, String>>? cc,
    List<Map<String, String>>? bcc,
    required String subject,
    String? bodyHtml,
    String? bodyText,
    List<Map<String, dynamic>>? attachments,
    String? replyToThreadId,
    int undoGraceSeconds = 10,
  }) async {
    _lastSentDraft = {
      'to': to,
      'cc': cc,
      'bcc': bcc,
      'subject': subject,
      'bodyHtml': bodyHtml,
      'bodyText': bodyText,
      'attachments': attachments,
      'replyToThreadId': replyToThreadId,
    };

    try {
      final res = await apiService.sendEmail(
        mailbox: _currentMailbox,
        to: to,
        cc: cc,
        bcc: bcc,
        subject: subject,
        bodyHtml: bodyHtml,
        bodyText: bodyText,
        attachments: attachments,
        replyToThreadId: replyToThreadId,
        undoGraceSeconds: undoGraceSeconds,
      );

      _activePendingSendId = res['pendingId'];
      _undoCountdown = undoGraceSeconds;
      notifyListeners();

      _undoTimer?.cancel();
      _undoTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (_undoCountdown > 1) {
          _undoCountdown--;
          notifyListeners();
        } else {
          _undoCountdown = 0;
          _activePendingSendId = null;
          timer.cancel();
          notifyListeners();
        }
      });

      // Reload sent or current folder
      loadThreads();
      loadStats();
    } catch (e) {
      _errorMessage = 'Failed to send: $e';
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> undoSend() async {
    if (_activePendingSendId == null) return null;

    final id = _activePendingSendId!;
    _undoTimer?.cancel();
    _activePendingSendId = null;
    _undoCountdown = 0;
    notifyListeners();

    await apiService.cancelSend(mailbox: _currentMailbox, pendingId: id);
    loadThreads();
    return _lastSentDraft;
  }

  // ---------------------------------------------------------------------------
  // Search & Test Simulator
  // ---------------------------------------------------------------------------
  void setSearchQuery(String q) {
    _searchQuery = q;
    loadThreads();
  }

  void clearSearch() {
    _searchQuery = '';
    loadThreads();
  }

  Future<void> simulateIncomingTestEmail() async {
    await apiService.simulateInboundEmail(mailbox: _currentMailbox);
  }

  @override
  void dispose() {
    _undoTimer?.cancel();
    socketService.disconnect();
    super.dispose();
  }
}

