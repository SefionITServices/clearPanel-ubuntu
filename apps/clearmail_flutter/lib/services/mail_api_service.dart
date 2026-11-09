import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/email_models.dart';

class MailApiService {
  final String baseUrl;

  MailApiService({String? baseUrl})
      : baseUrl = baseUrl ?? (kIsWeb ? Uri.base.origin : 'http://localhost:7510');

  Uri _uri(String path, [Map<String, dynamic>? queryParams]) {
    String cleanPath = path.startsWith('/') ? path : '/$path';
    if (!cleanPath.startsWith('/api/') && cleanPath != '/api') {
      cleanPath = '/api$cleanPath';
    }
    return Uri.parse('$baseUrl$cleanPath').replace(queryParameters: queryParams);
  }

  // ---------------------------------------------------------------------------
  // Authentication (Direct & SSO)
  // ---------------------------------------------------------------------------
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      _uri('/mail/sync/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'email': email, 'password': password}),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      try {
        final err = json.decode(response.body);
        throw Exception(err['message'] ?? 'Login failed');
      } catch (e) {
        throw Exception('Login failed: ${response.statusCode}');
      }
    }
  }

  Future<Map<String, dynamic>> ssoLogin({
    required String ssoToken,
  }) async {
    final response = await http.post(
      _uri('/mail/sync/auth/sso'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'ssoToken': ssoToken}),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      try {
        final err = json.decode(response.body);
        throw Exception(err['message'] ?? 'SSO verification failed');
      } catch (e) {
        throw Exception('SSO failed: ${response.statusCode}');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch Threads
  // ---------------------------------------------------------------------------
  Future<List<EmailThread>> fetchThreads({
    required String mailbox,
    String folder = 'inbox',
    String? label,
    int page = 1,
    int limit = 50,
  }) async {
    final queryParams = <String, String>{
      'mailbox': mailbox,
      'folder': folder,
      if (label != null) 'label': label,
      'page': page.toString(),
      'limit': limit.toString(),
    };

    final response = await http.get(_uri('/mail/sync/threads', queryParams));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List list = data['threads'] ?? [];
      return list.map((e) => EmailThread.fromJson(e)).toList();
    } else {
      throw Exception('Failed to load threads: ${response.body}');
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch Thread Details
  // ---------------------------------------------------------------------------
  Future<EmailThread> fetchThreadDetails({
    required String mailbox,
    required String threadId,
  }) async {
    final response = await http.get(_uri('/mail/sync/threads/$threadId', {'mailbox': mailbox}));
    if (response.statusCode == 200) {
      return EmailThread.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to load thread details');
    }
  }

  // ---------------------------------------------------------------------------
  // Send Email (Optimistic with Undo Grace Period)
  // ---------------------------------------------------------------------------
  Future<Map<String, dynamic>> sendEmail({
    required String mailbox,
    required List<Map<String, String>> to,
    List<Map<String, String>>? cc,
    List<Map<String, String>>? bcc,
    required String subject,
    String? bodyHtml,
    String? bodyText,
    String? replyToThreadId,
    int undoGraceSeconds = 10,
  }) async {
    final body = {
      'mailboxEmail': mailbox,
      'to': to,
      if (cc != null) 'cc': cc,
      if (bcc != null) 'bcc': bcc,
      'subject': subject,
      if (bodyHtml != null) 'bodyHtml': bodyHtml,
      if (bodyText != null) 'bodyText': bodyText,
      if (replyToThreadId != null) 'replyToThreadId': replyToThreadId,
      'undoGraceSeconds': undoGraceSeconds,
    };

    final response = await http.post(
      _uri('/mail/sync/send'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to send email: ${response.body}');
    }
  }

  // ---------------------------------------------------------------------------
  // Cancel Send (Undo Send within grace period)
  // ---------------------------------------------------------------------------
  Future<bool> cancelSend({
    required String mailbox,
    required String pendingId,
  }) async {
    final response = await http.post(
      _uri('/mail/sync/cancel-send/$pendingId'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'mailboxEmail': mailbox}),
    );
    return response.statusCode == 200;
  }

  // ---------------------------------------------------------------------------
  // Batch Update Threads
  // ---------------------------------------------------------------------------
  Future<void> batchUpdateThreads({
    required String mailbox,
    required List<String> threadIds,
    bool? markAsRead,
    String? folder,
    bool? isStarred,
    List<String>? addLabels,
    List<String>? removeLabels,
  }) async {
    final body = {
      'mailboxEmail': mailbox,
      'threadIds': threadIds,
      if (markAsRead != null) 'markAsRead': markAsRead,
      if (folder != null) 'folder': folder,
      if (isStarred != null) 'isStarred': isStarred,
      if (addLabels != null) 'addLabels': addLabels,
      if (removeLabels != null) 'removeLabels': removeLabels,
    };

    await http.patch(
      _uri('/mail/sync/threads/batch'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------
  Future<List<EmailThread>> search({
    required String mailbox,
    required String query,
  }) async {
    final response = await http.get(_uri('/mail/sync/search', {
      'mailbox': mailbox,
      'q': query,
    }));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List list = data['threads'] ?? [];
      return list.map((e) => EmailThread.fromJson(e)).toList();
    } else {
      throw Exception('Search failed');
    }
  }

  // ---------------------------------------------------------------------------
  // Mailbox Stats & Quota
  // ---------------------------------------------------------------------------
  Future<MailboxStats> fetchStats({required String mailbox}) async {
    final response = await http.get(_uri('/mail/sync/stats', {'mailbox': mailbox}));
    if (response.statusCode == 200) {
      return MailboxStats.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to load mailbox stats');
    }
  }

  // ---------------------------------------------------------------------------
  // Test: Simulate Inbound Email
  // ---------------------------------------------------------------------------
  Future<void> simulateInboundEmail({
    required String mailbox,
    String? fromName,
    String? fromEmail,
    String? subject,
    String? bodyText,
  }) async {
    await http.post(
      _uri('/mail/sync/test/simulate-inbound'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'mailboxEmail': mailbox,
        if (fromName != null) 'fromName': fromName,
        if (fromEmail != null) 'fromEmail': fromEmail,
        if (subject != null) 'subject': subject,
        if (bodyText != null) 'bodyText': bodyText,
      }),
    );
  }
}
