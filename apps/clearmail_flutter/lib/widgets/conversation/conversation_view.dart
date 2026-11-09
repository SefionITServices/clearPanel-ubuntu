import 'dart:html' as html;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/email_models.dart';
import '../../state/mail_state.dart';
import '../../theme/gmail_theme.dart';

class ConversationView extends StatefulWidget {
  final EmailThread thread;
  final MailState state;
  final VoidCallback onBack;
  final Function(String replyToThreadId, String subject, {List<Map<String, String>>? to, List<Map<String, String>>? cc}) onReply;

  const ConversationView({
    super.key,
    required this.thread,
    required this.state,
    required this.onBack,
    required this.onReply,
  });

  @override
  State<ConversationView> createState() => _ConversationViewState();
}

class _ConversationViewState extends State<ConversationView> {
  final Set<String> _collapsedMessageIds = {};
  final Set<String> _showRawHtmlMessageIds = {};
  double _contentScale = 1.0;

  String _formatFullDate(DateTime dt) {
    return DateFormat('EEE, MMM d, y, h:mm a').format(dt);
  }

  void _downloadAttachment(EmailAttachment att, String messageId) {
    if (!kIsWeb) return;
    try {
      final url = widget.state.apiService.getAttachmentDownloadUrl(
        mailbox: widget.state.currentMailbox,
        messageId: messageId,
        attachmentId: att.id,
      );
      final anchor = html.AnchorElement(href: url)
        ..target = '_blank'
        ..download = att.filename;
      anchor.click();
    } catch (_) {}
  }

  void _showSecurityDetails(EmailSecurityStatus sec, String from) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.security, color: GmailColors.googleGreen),
            SizedBox(width: 10),
            Text('Deliverability & Security', style: TextStyle(fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSecRow('Sender', from),
            const Divider(),
            _buildSecRow('SPF Record', sec.spf.toUpperCase(), isPass: sec.spf == 'pass'),
            _buildSecRow('DKIM Signature', sec.dkim.toUpperCase(), isPass: sec.dkim == 'pass'),
            _buildSecRow('DMARC Policy', sec.dmarc.toUpperCase(), isPass: sec.dmarc == 'pass'),
            _buildSecRow('TLS Encryption', sec.tlsVersion ?? 'TLSv1.3', isPass: true),
            if (sec.signedBy != null) _buildSecRow('Signed by', sec.signedBy!),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildSecRow(String label, String value, {bool? isPass}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
          Row(
            children: [
              if (isPass != null)
                Icon(
                  isPass ? Icons.check_circle : Icons.warning_amber,
                  size: 14,
                  color: isPass ? GmailColors.googleGreen : Colors.orange,
                ),
              if (isPass != null) const SizedBox(width: 4),
              Text(
                value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: isPass == true ? GmailColors.googleGreen : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final thread = widget.thread;
    final messages = thread.messages ?? [];

    return Container(
      decoration: BoxDecoration(
        color: GmailColors.surfaceWhite,
        borderRadius: isMobile ? BorderRadius.zero : BorderRadius.circular(16),
      ),
      margin: isMobile ? EdgeInsets.zero : const EdgeInsets.only(right: 16, bottom: 16),
      child: Column(
        children: [
          // Top Action Toolbar
          _buildActionToolbar(isMobile),

          const Divider(height: 1, color: GmailColors.threadBorder),

          // Conversation Scroll Area
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                await widget.state.openThread(thread);
              },
              color: GmailColors.googleBlue,
              backgroundColor: Colors.white,
              displacement: 40,
              edgeOffset: 0,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: isMobile ? const EdgeInsets.all(16) : const EdgeInsets.all(24),
                children: [
                // Subject Header
                if (isMobile) ...[
                  Text(
                    thread.subject,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w500,
                      color: GmailColors.textDark,
                    ),
                  ),
                  if (thread.labels.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        for (final label in thread.labels)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade200,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              label,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                            ),
                          ),
                      ],
                    ),
                  ],
                ] else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          thread.subject,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w400,
                            color: GmailColors.textDark,
                          ),
                        ),
                      ),
                      for (final label in thread.labels)
                        Container(
                          margin: const EdgeInsets.only(left: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            label,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ),
                    ],
                  ),

                SizedBox(height: isMobile ? 16 : 24),

                // Messages in Thread
                if (messages.isEmpty)
                  _buildMessageCard(
                    EmailMessage(
                      id: thread.id,
                      threadId: thread.id,
                      mailboxEmail: widget.state.currentMailbox,
                      folder: thread.folder,
                      labels: thread.labels,
                      from: thread.participants.isNotEmpty
                          ? thread.participants.first
                          : EmailAddress(name: 'Sender', email: 'sender@domain.com'),
                      to: [EmailAddress(name: 'Me', email: widget.state.currentMailbox)],
                      subject: thread.subject,
                      snippet: thread.snippet,
                      bodyText: thread.snippet,
                      isRead: true,
                      isStarred: thread.isStarred,
                      hasAttachments: thread.hasAttachments,
                      attachments: [],
                      security: EmailSecurityStatus(
                        spf: 'pass',
                        dkim: 'pass',
                        dmarc: 'pass',
                        tlsVersion: 'TLSv1.3',
                      ),
                      date: thread.lastMessageDate,
                      size: 2048,
                    ),
                    isLast: true,
                    isMobile: isMobile,
                  )
                else
                  for (int i = 0; i < messages.length; i++)
                    _buildMessageCard(
                      messages[i],
                      isLast: i == messages.length - 1,
                      isMobile: isMobile,
                    ),

                SizedBox(height: isMobile ? 16 : 24),

                // Bottom Reply / Forward Bar (Horizontally scrollable on mobile)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          final from = messages.isNotEmpty ? messages.last.from : null;
                          widget.onReply(
                            thread.id,
                            'Re: ${thread.subject}',
                            to: from != null ? [{'name': from.name, 'email': from.email}] : null,
                          );
                        },
                        icon: const Icon(Icons.reply, size: 18),
                        label: const Text('Reply'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: GmailColors.textDark,
                          side: BorderSide(color: Colors.grey.shade400),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                        ),
                      ),
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        onPressed: () {
                          final allParticipants = thread.participants
                              .where((p) => p.email.toLowerCase() != widget.state.currentMailbox.toLowerCase())
                              .map((p) => {'name': p.name, 'email': p.email})
                              .toList();
                          widget.onReply(
                            thread.id,
                            'Re: ${thread.subject}',
                            to: allParticipants.isNotEmpty ? [allParticipants.first] : null,
                            cc: allParticipants.length > 1 ? allParticipants.sublist(1) : null,
                          );
                        },
                        icon: const Icon(Icons.reply_all, size: 18),
                        label: const Text('Reply all'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: GmailColors.textDark,
                          side: BorderSide(color: Colors.grey.shade400),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                        ),
                      ),
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        onPressed: () {
                          widget.onReply(
                            thread.id,
                            'Fwd: ${thread.subject}',
                          );
                        },
                        icon: const Icon(Icons.forward, size: 18),
                        label: const Text('Forward'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: GmailColors.textDark,
                          side: BorderSide(color: Colors.grey.shade400),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

  Widget _buildActionToolbar(bool isMobile) {
    return Container(
      height: 48,
      padding: EdgeInsets.symmetric(horizontal: isMobile ? 8 : 16),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, size: 20),
              tooltip: 'Back to list',
              onPressed: widget.onBack,
            ),
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.archive_outlined, size: 20),
              tooltip: 'Archive',
              onPressed: () {
                widget.state.toggleSelectThread(widget.thread.id);
                widget.state.batchArchive();
                widget.onBack();
              },
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 20),
              tooltip: 'Delete',
              onPressed: () {
                widget.state.toggleSelectThread(widget.thread.id);
                widget.state.batchDelete();
                widget.onBack();
              },
            ),
            IconButton(
              icon: const Icon(Icons.mark_email_unread_outlined, size: 20),
              tooltip: 'Mark as unread',
              onPressed: () {
                widget.state.toggleSelectThread(widget.thread.id);
                widget.state.batchMarkAsRead(false);
                widget.onBack();
              },
            ),
            IconButton(
              icon: Icon(
                widget.thread.isStarred ? Icons.star : Icons.star_border,
                size: 20,
                color: widget.thread.isStarred ? GmailColors.starActive : null,
              ),
              tooltip: 'Star',
              onPressed: () => widget.state.toggleStar(widget.thread),
            ),
            IconButton(
              icon: Icon(
                _contentScale > 1.0 ? Icons.zoom_out : Icons.zoom_in,
                size: 20,
                color: _contentScale > 1.0 ? GmailColors.googleBlue : null,
              ),
              tooltip: 'Zoom text (${(_contentScale * 100).toInt()}%)',
              onPressed: () {
                setState(() {
                  if (_contentScale == 1.0) {
                    _contentScale = 1.25;
                  } else if (_contentScale == 1.25) {
                    _contentScale = 1.5;
                  } else if (_contentScale == 1.5) {
                    _contentScale = 1.8;
                  } else {
                    _contentScale = 1.0;
                  }
                });
              },
            ),
            if (_contentScale > 1.0)
              Container(
                margin: const EdgeInsets.only(left: 4),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: GmailColors.googleBlue.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${(_contentScale * 100).toInt()}%',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: GmailColors.googleBlue),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageCard(EmailMessage msg, {required bool isLast, bool isMobile = false}) {
    final isCollapsed = _collapsedMessageIds.contains(msg.id);
    final isRawHtml = _showRawHtmlMessageIds.contains(msg.id);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: GmailColors.surfaceWhite,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Message Header
          InkWell(
            onTap: () {
              setState(() {
                if (isCollapsed) {
                  _collapsedMessageIds.remove(msg.id);
                } else {
                  _collapsedMessageIds.add(msg.id);
                }
              });
            },
            child: Padding(
              padding: EdgeInsets.all(isMobile ? 12 : 16),
              child: isMobile
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: Colors.blueGrey.shade100,
                          foregroundImage: NetworkImage(
                            (msg.from.avatarUrl != null && msg.from.avatarUrl!.isNotEmpty)
                                ? msg.from.avatarUrl!
                                : '/api/mail/avatars/${Uri.encodeComponent(msg.from.email)}',
                          ),
                          onForegroundImageError: (_, __) {},
                          child: Text(
                            msg.from.name.isNotEmpty
                                ? msg.from.name[0].toUpperCase()
                                : (msg.from.email.isNotEmpty ? msg.from.email[0].toUpperCase() : '?'),
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey, fontSize: 13),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      msg.from.name.isNotEmpty ? msg.from.name : msg.from.email,
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text(
                                    DateFormat('MMM d, h:mm a').format(msg.date),
                                    style: const TextStyle(fontSize: 11, color: GmailColors.textSnippet),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      'to ${msg.to.map((t) => t.email == widget.state.currentMailbox ? 'me' : t.email).join(', ')}',
                                      style: const TextStyle(fontSize: 12, color: GmailColors.textMuted),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  _buildSecurityBadge(msg.security ?? EmailSecurityStatus(spf: 'pass', dkim: 'pass', dmarc: 'pass'), msg.from.email, compact: true),
                                  if (msg.bodyHtml != null) ...[
                                    const SizedBox(width: 4),
                                    IconButton(
                                      icon: Icon(isRawHtml ? Icons.text_fields : Icons.code, size: 16),
                                      tooltip: isRawHtml ? 'Formatted view' : 'Raw HTML',
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                      onPressed: () {
                                        setState(() {
                                          if (isRawHtml) {
                                            _showRawHtmlMessageIds.remove(msg.id);
                                          } else {
                                            _showRawHtmlMessageIds.add(msg.id);
                                          }
                                        });
                                      },
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: Colors.blueGrey.shade100,
                          foregroundImage: NetworkImage(
                            (msg.from.avatarUrl != null && msg.from.avatarUrl!.isNotEmpty)
                                ? msg.from.avatarUrl!
                                : '/api/mail/avatars/${Uri.encodeComponent(msg.from.email)}',
                          ),
                          onForegroundImageError: (_, __) {},
                          child: Text(
                            msg.from.name.isNotEmpty
                                ? msg.from.name[0].toUpperCase()
                                : (msg.from.email.isNotEmpty ? msg.from.email[0].toUpperCase() : '?'),
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    msg.from.name.isNotEmpty ? msg.from.name : msg.from.email,
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    '<${msg.from.email}>',
                                    style: const TextStyle(fontSize: 12, color: GmailColors.textSnippet),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'to ${msg.to.map((t) => t.email).join(', ')}',
                                style: const TextStyle(fontSize: 12, color: GmailColors.textMuted),
                              ),
                            ],
                          ),
                        ),

                        // Deliverability Security Shield
                        _buildSecurityBadge(msg.security ?? EmailSecurityStatus(spf: 'pass', dkim: 'pass', dmarc: 'pass'), msg.from.email),

                        const SizedBox(width: 12),

                        // Format switcher toggle (HTML / Clean Text)
                        if (msg.bodyHtml != null)
                          IconButton(
                            icon: Icon(isRawHtml ? Icons.text_fields : Icons.code, size: 18),
                            tooltip: isRawHtml ? 'Show formatted view' : 'Show raw HTML',
                            onPressed: () {
                              setState(() {
                                if (isRawHtml) {
                                  _showRawHtmlMessageIds.remove(msg.id);
                                } else {
                                  _showRawHtmlMessageIds.add(msg.id);
                                }
                              });
                            },
                          ),

                        const SizedBox(width: 8),

                        Text(
                          _formatFullDate(msg.date),
                          style: const TextStyle(fontSize: 12, color: GmailColors.textSnippet),
                        ),
                      ],
                    ),
            ),
          ),

          if (!isCollapsed) ...[
            const Divider(height: 1, color: GmailColors.threadBorder),

            // Message Body
            Padding(
              padding: EdgeInsets.all(isMobile ? 14 : 20),
              child: isRawHtml
                  ? SelectableText(
                      msg.bodyHtml ?? '',
                      style: TextStyle(fontFamily: 'monospace', fontSize: 12 * _contentScale, height: 1.4),
                    )
                  : _buildFormattedContent(msg),
            ),

            // Attachments
            if (msg.attachments != null && msg.attachments!.isNotEmpty) ...[
              Padding(
                padding: EdgeInsets.symmetric(horizontal: isMobile ? 14 : 20, vertical: 8),
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: msg.attachments!.map((att) => _buildAttachmentChip(att, msg.id)).toList(),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildFormattedContent(EmailMessage msg) {
    final text = msg.bodyHtml != null ? _cleanHtmlPreserveLayout(msg.bodyHtml!) : (msg.bodyText ?? msg.snippet);

    return SelectableText(
      text,
      style: TextStyle(fontSize: 14 * _contentScale, height: 1.6, color: GmailColors.textDark),
    );
  }

  Widget _buildSecurityBadge(EmailSecurityStatus sec, String from, {bool compact = false}) {
    return InkWell(
      onTap: () => _showSecurityDetails(sec, from),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: compact ? 6 : 8, vertical: compact ? 2 : 4),
        decoration: BoxDecoration(
          color: GmailColors.googleGreen.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: GmailColors.googleGreen.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.verified_user_outlined, size: 14, color: GmailColors.googleGreen),
            if (!compact) ...[
              const SizedBox(width: 4),
              const Text(
                'Verified',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: GmailColors.googleGreen,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAttachmentChip(EmailAttachment att, String messageId) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.attachment, color: GmailColors.googleBlue, size: 20),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                att.filename,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
              Text(
                att.formattedSize,
                style: const TextStyle(fontSize: 11, color: GmailColors.textMuted),
              ),
            ],
          ),
          const SizedBox(width: 12),
          IconButton(
            icon: const Icon(Icons.download, size: 18, color: GmailColors.googleBlue),
            tooltip: 'Download ${att.filename}',
            onPressed: () => _downloadAttachment(att, messageId),
            splashRadius: 16,
          ),
        ],
      ),
    );
  }

  String _cleanHtmlPreserveLayout(String html) {
    return html
        .replaceAll(RegExp(r'<style[^>]*>[\s\S]*?<\/style>', caseSensitive: false), '')
        .replaceAll(RegExp(r'<script[^>]*>[\s\S]*?<\/script>', caseSensitive: false), '')
        .replaceAll(RegExp(r'<\/(p|div|tr|h[1-6])>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<br\s*\/?>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
        .replaceAll(RegExp(r'<\/li>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .trim();
  }
}
