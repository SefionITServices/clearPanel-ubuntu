class EmailAddress {
  final String name;
  final String email;
  final String? avatarUrl;

  EmailAddress({
    required this.name,
    required this.email,
    this.avatarUrl,
  });

  factory EmailAddress.fromJson(Map<String, dynamic> json) {
    final email = json['email'] ?? '';
    return EmailAddress(
      name: json['name'] ?? '',
      email: email,
      avatarUrl: json['avatarUrl'] ?? (email.isNotEmpty ? '/api/mail/avatars/${Uri.encodeComponent(email)}' : null),
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'email': email,
    'avatarUrl': avatarUrl,
  };
}

class EmailAttachment {
  final String id;
  final String filename;
  final String mimeType;
  final int size;
  final String? url;

  EmailAttachment({
    required this.id,
    required this.filename,
    required this.mimeType,
    required this.size,
    this.url,
  });

  factory EmailAttachment.fromJson(Map<String, dynamic> json) {
    return EmailAttachment(
      id: json['id'] ?? '',
      filename: json['filename'] ?? 'Attachment',
      mimeType: json['mimeType'] ?? 'application/octet-stream',
      size: json['size'] ?? 0,
      url: json['url'],
    );
  }

  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class EmailSecurityStatus {
  final String spf;
  final String dkim;
  final String dmarc;
  final String? tlsVersion;
  final String? signedBy;

  EmailSecurityStatus({
    required this.spf,
    required this.dkim,
    required this.dmarc,
    this.tlsVersion,
    this.signedBy,
  });

  factory EmailSecurityStatus.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return EmailSecurityStatus(spf: 'pass', dkim: 'pass', dmarc: 'pass', tlsVersion: 'TLSv1.3');
    }
    return EmailSecurityStatus(
      spf: json['spf'] ?? 'pass',
      dkim: json['dkim'] ?? 'pass',
      dmarc: json['dmarc'] ?? 'pass',
      tlsVersion: json['tlsVersion'] ?? 'TLSv1.3',
      signedBy: json['signedBy'],
    );
  }
}

class EmailMessage {
  final String id;
  final String threadId;
  final String mailboxEmail;
  final String folder;
  final List<String> labels;
  final EmailAddress from;
  final List<EmailAddress> to;
  final List<EmailAddress>? cc;
  final String subject;
  final String snippet;
  final String? bodyHtml;
  final String? bodyText;
  final bool isRead;
  final bool isStarred;
  final bool hasAttachments;
  final List<EmailAttachment> attachments;
  final EmailSecurityStatus security;
  final DateTime date;
  final int size;

  EmailMessage({
    required this.id,
    required this.threadId,
    required this.mailboxEmail,
    required this.folder,
    required this.labels,
    required this.from,
    required this.to,
    this.cc,
    required this.subject,
    required this.snippet,
    this.bodyHtml,
    this.bodyText,
    required this.isRead,
    required this.isStarred,
    required this.hasAttachments,
    required this.attachments,
    required this.security,
    required this.date,
    required this.size,
  });

  factory EmailMessage.fromJson(Map<String, dynamic> json) {
    return EmailMessage(
      id: json['id'] ?? '',
      threadId: json['threadId'] ?? '',
      mailboxEmail: json['mailboxEmail'] ?? '',
      folder: json['folder'] ?? 'inbox',
      labels: (json['labels'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      from: EmailAddress.fromJson(json['from'] ?? {}),
      to: (json['to'] as List<dynamic>?)?.map((e) => EmailAddress.fromJson(e)).toList() ?? [],
      cc: (json['cc'] as List<dynamic>?)?.map((e) => EmailAddress.fromJson(e)).toList(),
      subject: json['subject'] ?? '',
      snippet: json['snippet'] ?? '',
      bodyHtml: json['bodyHtml'],
      bodyText: json['bodyText'],
      isRead: json['isRead'] ?? false,
      isStarred: json['isStarred'] ?? false,
      hasAttachments: json['hasAttachments'] ?? false,
      attachments: (json['attachments'] as List<dynamic>?)
              ?.map((e) => EmailAttachment.fromJson(e))
              .toList() ??
          [],
      security: EmailSecurityStatus.fromJson(json['security']),
      date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
      size: json['size'] ?? 0,
    );
  }
}

class EmailThread {
  final String id;
  final String subject;
  String snippet;
  DateTime lastMessageDate;
  int messageCount;
  int unreadCount;
  final List<EmailAddress> participants;
  String folder;
  List<String> labels;
  final bool hasAttachments;
  bool isStarred;
  List<EmailMessage>? messages;

  EmailThread({
    required this.id,
    required this.subject,
    required this.snippet,
    required this.lastMessageDate,
    required this.messageCount,
    required this.unreadCount,
    required this.participants,
    required this.folder,
    required this.labels,
    required this.hasAttachments,
    required this.isStarred,
    this.messages,
  });

  bool get isUnread => unreadCount > 0;

  factory EmailThread.fromJson(Map<String, dynamic> json) {
    return EmailThread(
      id: json['id'] ?? '',
      subject: json['subject'] ?? '(No Subject)',
      snippet: json['snippet'] ?? '',
      lastMessageDate: DateTime.tryParse(json['lastMessageDate'] ?? '') ?? DateTime.now(),
      messageCount: json['messageCount'] ?? 1,
      unreadCount: json['unreadCount'] ?? 0,
      participants: (json['participants'] as List<dynamic>?)
              ?.map((e) => EmailAddress.fromJson(e))
              .toList() ??
          [],
      folder: json['folder'] ?? 'inbox',
      labels: (json['labels'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      hasAttachments: json['hasAttachments'] ?? false,
      isStarred: json['isStarred'] ?? false,
      messages: (json['messages'] as List<dynamic>?)
          ?.map((e) => EmailMessage.fromJson(e))
          .toList(),
    );
  }

  EmailThread copyWith({
    String? snippet,
    DateTime? lastMessageDate,
    int? messageCount,
    int? unreadCount,
    String? folder,
    List<String>? labels,
    bool? isStarred,
    List<EmailMessage>? messages,
  }) {
    return EmailThread(
      id: id,
      subject: subject,
      snippet: snippet ?? this.snippet,
      lastMessageDate: lastMessageDate ?? this.lastMessageDate,
      messageCount: messageCount ?? this.messageCount,
      unreadCount: unreadCount ?? this.unreadCount,
      participants: participants,
      folder: folder ?? this.folder,
      labels: labels ?? this.labels,
      hasAttachments: hasAttachments,
      isStarred: isStarred ?? this.isStarred,
      messages: messages ?? this.messages,
    );
  }
}

class MailboxStats {
  final String mailboxEmail;
  final int unreadCount;
  final int totalThreads;
  final int usedBytes;
  final int quotaBytes;
  final Map<String, int> foldersCount;

  MailboxStats({
    required this.mailboxEmail,
    required this.unreadCount,
    required this.totalThreads,
    required this.usedBytes,
    required this.quotaBytes,
    required this.foldersCount,
  });

  factory MailboxStats.fromJson(Map<String, dynamic> json) {
    final fc = <String, int>{};
    if (json['foldersCount'] is Map) {
      json['foldersCount'].forEach((k, v) {
        fc[k.toString()] = (v as num).toInt();
      });
    }
    return MailboxStats(
      mailboxEmail: json['mailboxEmail'] ?? '',
      unreadCount: json['unreadCount'] ?? 0,
      totalThreads: json['totalThreads'] ?? 0,
      usedBytes: json['usedBytes'] ?? 0,
      quotaBytes: json['quotaBytes'] ?? (15 * 1024 * 1024 * 1024),
      foldersCount: fc,
    );
  }

  double get quotaPercentage {
    if (quotaBytes <= 0) return 0.0;
    return (usedBytes / quotaBytes).clamp(0.0, 1.0);
  }

  String get formattedUsedStorage {
    if (usedBytes < 1024 * 1024) {
      return '${(usedBytes / 1024).toStringAsFixed(1)} KB';
    }
    if (usedBytes < 1024 * 1024 * 1024) {
      return '${(usedBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(usedBytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  String get formattedTotalQuota {
    return '${(quotaBytes / (1024 * 1024 * 1024)).toStringAsFixed(0)} GB';
  }
}

