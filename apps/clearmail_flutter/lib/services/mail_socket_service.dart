import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/email_models.dart';

class MailSocketService {
  final String serverUrl;
  IO.Socket? _socket;
  String? _currentMailbox;

  // Callbacks
  Function(EmailMessage message, String threadId)? onNewIncoming;
  Function(Map<String, dynamic> data)? onOptimisticSent;
  Function(Map<String, dynamic> data)? onThreadsUpdated;
  Function(Map<String, dynamic> data)? onStoreRefreshed;
  Function(bool connected)? onConnectionChange;

  MailSocketService({String? serverUrl})
      : serverUrl = serverUrl ?? (kIsWeb ? Uri.base.origin : 'http://localhost:7510');

  bool get isConnected => _socket?.connected ?? false;

  void connect(String mailboxEmail) {
    _currentMailbox = mailboxEmail.trim().toLowerCase();

    _socket?.disconnect();
    _socket?.dispose();

    try {
      _socket = IO.io(
        '$serverUrl/mail-sync',
        IO.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .enableReconnection()
            .build(),
      );

      _socket!.onConnect((_) {
        debugPrint('Socket.IO connected to ClearPanel Mail Sync');
        onConnectionChange?.call(true);
        // Subscribe to mailbox room
        _socket!.emit('subscribe', {'mailboxEmail': _currentMailbox});
      });

      _socket!.onDisconnect((_) {
        debugPrint('Socket.IO disconnected');
        onConnectionChange?.call(false);
      });

      _socket!.on('mail:new_incoming', (data) {
        debugPrint('Real-time event: mail:new_incoming');
        if (data is Map<String, dynamic>) {
          final threadId = data['threadId']?.toString() ?? '';
          if (data['message'] is Map<String, dynamic>) {
            final msg = EmailMessage.fromJson(data['message']);
            onNewIncoming?.call(msg, threadId);
          }
        }
      });

      _socket!.on('mail:optimistic_sent', (data) {
        debugPrint('Real-time event: mail:optimistic_sent');
        if (data is Map<String, dynamic>) {
          onOptimisticSent?.call(data);
        }
      });

      _socket!.on('mail:threads_updated', (data) {
        debugPrint('Real-time event: mail:threads_updated');
        if (data is Map<String, dynamic>) {
          onThreadsUpdated?.call(data);
        }
      });

      _socket!.on('mail:store_refreshed', (data) {
        debugPrint('Real-time event: mail:store_refreshed');
        if (data is Map<String, dynamic>) {
          onStoreRefreshed?.call(data);
        }
      });
    } catch (e) {
      debugPrint('Failed to initialize socket: $e');
    }
  }

  void disconnect() {
    if (_socket != null && _currentMailbox != null) {
      _socket!.emit('unsubscribe', {'mailboxEmail': _currentMailbox});
    }
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }
}

