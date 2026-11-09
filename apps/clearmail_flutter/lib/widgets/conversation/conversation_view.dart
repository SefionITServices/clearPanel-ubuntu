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
    final thread = widget.thread;
    final messages = thread.messages ?? [];

    return Container(
      decoration: BoxDecoration(
        color: GmailColors.surfaceWhite,
        borderRadius: BorderRadius.circular(16),
      ),
      margin: const EdgeInsets.only(right: 16, bottom: 16),
      child: Column(
        children: [
          // Top Action Toolbar
          _buildActionToolbar(),

          const Divider(height: 1, color: GmailColors.threadBorder),

          // Conversation Scroll Area
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                // Subject Header
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

                const SizedBox(height: 24),

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
                  )
                else
                  for (int i = 0; i < messages.length; i++)
                    _buildMessageCard(
                      messages[i],
                      isLast: i == messages.length - 1,
                    ),

                const SizedBox(height: 24),

                // Bottom Reply / Forward Bar
                Row(
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
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      ),
                    ),
                    const SizedBox(width: 12),
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
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      ),
                    ),
                    const SizedBox(width: 12),
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
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionToolbar() {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, size: 20),
            tooltip: 'Back to list',
            onPressed: widget.onBack,
          ),
          const SizedBox(width: 8),
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
        ],
      ),
    );
  }

  Widget _buildMessageCard(EmailMessage msg, {required bool isLast}) {
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
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: Colors.blueGrey.shade100,
                    child: Text(
                      msg.from.name.isNotEmpty ? msg.from.name[0].toUpperCase() : '?',
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
              padding: const EdgeInsets.all(20),
              child: isRawHtml
                  ? SelectableText(
                      msg.bodyHtml ?? '',
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 12, height: 1.4),
                    )
                  : _buildFormattedContent(msg),
            ),

            // Attachments
            if (msg.attachments != null && msg.attachments!.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
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
      style: const TextStyle(fontSize: 14, height: 1.6, color: GmailColors.textDark),
    );
  }

  Widget _buildSecurityBadge(EmailSecurityStatus sec, String from) {
    return InkWell(
      onTap: () => _showSecurityDetails(sec, from),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: GmailColors.googleGreen.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: GmailColors.googleGreen.withOpacity(0.3)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.verified_user_outlined, size: 14, color: GmailColors.googleGreen),
            SizedBox(width: 4),
            Text(
              'Verified',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: GmailColors.googleGreen,
              ),
            ),
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
