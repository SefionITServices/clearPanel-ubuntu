import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/email_models.dart';
import '../../state/mail_state.dart';
import '../../theme/gmail_theme.dart';

class ThreadItemRow extends StatefulWidget {
  final EmailThread thread;
  final MailState state;
  final bool isSelected;
  final VoidCallback onTap;

  const ThreadItemRow({
    super.key,
    required this.thread,
    required this.state,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<ThreadItemRow> createState() => _ThreadItemRowState();
}

class _ThreadItemRowState extends State<ThreadItemRow> {
  bool _isHovered = false;

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(dt.year, dt.month, dt.day);

    if (date == today) {
      return DateFormat('h:mm a').format(dt);
    } else if (date == today.subtract(const Duration(days: 1))) {
      return 'Yesterday';
    } else if (dt.year == now.year) {
      return DateFormat('MMM d').format(dt);
    } else {
      return DateFormat('MM/dd/yy').format(dt);
    }
  }

  String _getParticipantsText() {
    if (widget.thread.participants.isEmpty) return 'Me';
    return widget.thread.participants.map((p) => p.name.isNotEmpty ? p.name : p.email).join(', ');
  }

  Widget _buildMobileRow(BuildContext context) {
    final thread = widget.thread;
    final isUnread = thread.isUnread;
    final sender = thread.participants.isNotEmpty ? thread.participants.first : null;
    final senderName = sender != null && sender.name.isNotEmpty ? sender.name : (sender?.email.split('@')[0] ?? 'Sender');
    final senderEmail = sender?.email ?? '';
    final senderAvatarUrl = sender?.avatarUrl ?? (senderEmail.isNotEmpty ? '/api/mail/avatars/${Uri.encodeComponent(senderEmail)}' : null);

    return InkWell(
      onTap: widget.onTap,
      onLongPress: () => widget.state.toggleSelectThread(thread.id),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: widget.isSelected
              ? GmailColors.threadSelectedBg
              : (isUnread ? GmailColors.threadUnreadBg : Colors.transparent),
          border: const Border(
            bottom: BorderSide(color: GmailColors.threadBorder, width: 0.5),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left Avatar or Selection Indicator
            GestureDetector(
              onTap: () => widget.state.toggleSelectThread(thread.id),
              child: widget.isSelected
                  ? const CircleAvatar(
                      radius: 20,
                      backgroundColor: GmailColors.googleBlue,
                      child: Icon(Icons.check, color: Colors.white, size: 20),
                    )
                  : CircleAvatar(
                      radius: 20,
                      backgroundColor: Colors.blueGrey.shade100,
                      foregroundImage: senderAvatarUrl != null ? NetworkImage(senderAvatarUrl) : null,
                      onForegroundImageError: (_, __) {},
                      child: Text(
                        senderName.isNotEmpty ? senderName[0].toUpperCase() : '?',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey, fontSize: 16),
                      ),
                    ),
            ),

            const SizedBox(width: 14),

            // Middle Content: Sender, Subject, Snippet
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Line: Sender Name + Message Count + Date
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _getParticipantsText(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: isUnread ? FontWeight.w700 : FontWeight.w500,
                            color: isUnread ? GmailColors.textDark : GmailColors.textMuted,
                          ),
                        ),
                      ),
                      if (thread.messageCount > 1) ...[
                        const SizedBox(width: 4),
                        Text(
                          '${thread.messageCount}',
                          style: const TextStyle(fontSize: 12, color: GmailColors.textSnippet),
                        ),
                      ],
                      const SizedBox(width: 8),
                      Text(
                        _formatDate(thread.lastMessageDate),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isUnread ? FontWeight.w700 : FontWeight.w400,
                          color: isUnread ? GmailColors.googleBlue : GmailColors.textSnippet,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 3),

                  // Middle Line: Subject
                  Text(
                    thread.subject.isEmpty ? '(No Subject)' : thread.subject,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isUnread ? FontWeight.w700 : FontWeight.w400,
                      color: isUnread ? GmailColors.textDark : Colors.black87,
                    ),
                  ),

                  const SizedBox(height: 3),

                  // Bottom Line: Snippet + Attachments + Star
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          thread.snippet,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: GmailColors.textSnippet,
                          ),
                        ),
                      ),
                      if (thread.hasAttachments) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.attachment, size: 16, color: GmailColors.textSnippet),
                      ],
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => widget.state.toggleStar(thread),
                        child: Icon(
                          thread.isStarred ? Icons.star : Icons.star_border,
                          size: 20,
                          color: thread.isStarred ? GmailColors.starActive : GmailColors.starInactive,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    if (isMobile) {
      return _buildMobileRow(context);
    }

    final thread = widget.thread;
    final isUnread = thread.isUnread;

    Color bgColor = isUnread ? GmailColors.threadUnreadBg : GmailColors.threadReadBg;
    if (widget.isSelected) {
      bgColor = GmailColors.threadSelectedBg;
    } else if (_isHovered) {
      bgColor = GmailColors.threadHoverBg;
    }

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: bgColor,
          border: const Border(
            bottom: BorderSide(color: GmailColors.threadBorder, width: 1),
          ),
        ),
        child: InkWell(
          onTap: widget.onTap,
          hoverColor: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                // Checkbox
                SizedBox(
                  width: 28,
                  child: Checkbox(
                    value: widget.isSelected,
                    onChanged: (val) {
                      widget.state.toggleSelectThread(thread.id);
                    },
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                  ),
                ),

                // Star Toggle
                IconButton(
                  icon: Icon(
                    thread.isStarred ? Icons.star : Icons.star_border,
                    size: 20,
                    color: thread.isStarred ? GmailColors.starActive : GmailColors.starInactive,
                  ),
                  onPressed: () => widget.state.toggleStar(thread),
                  splashRadius: 16,
                  visualDensity: VisualDensity.compact,
                ),

                const SizedBox(width: 8),

                // Sender / Participants (Width constrained)
                SizedBox(
                  width: 180,
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _getParticipantsText(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isUnread ? FontWeight.w700 : FontWeight.w400,
                            color: GmailColors.textDark,
                          ),
                        ),
                      ),
                      if (thread.messageCount > 1) ...[
                        const SizedBox(width: 4),
                        Text(
                          '${thread.messageCount}',
                          style: const TextStyle(fontSize: 12, color: GmailColors.textSnippet),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(width: 16),

                // Subject + Snippet
                Expanded(
                  child: Row(
                    children: [
                      // Label chips
                      for (final label in thread.labels)
                        Container(
                          margin: const EdgeInsets.only(right: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            label,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                          ),
                        ),

                      // Subject
                      Text(
                        thread.subject,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isUnread ? FontWeight.w700 : FontWeight.w400,
                          color: GmailColors.textDark,
                        ),
                      ),

                      const SizedBox(width: 8),

                      // Snippet
                      Expanded(
                        child: Text(
                          '— ${thread.snippet}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: GmailColors.textSnippet,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Attachments Icon
                if (thread.hasAttachments)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6),
                    child: Icon(Icons.attach_file, size: 18, color: GmailColors.textSnippet),
                  ),

                // Date or Hover Action Toolbar
                SizedBox(
                  width: 120,
                  child: _isHovered
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.archive_outlined, size: 18),
                              tooltip: 'Archive',
                              onPressed: () {
                                widget.state.toggleSelectThread(thread.id);
                                widget.state.batchArchive();
                              },
                              splashRadius: 16,
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 18),
                              tooltip: 'Delete',
                              onPressed: () {
                                widget.state.toggleSelectThread(thread.id);
                                widget.state.batchDelete();
                              },
                              splashRadius: 16,
                            ),
                            IconButton(
                              icon: Icon(
                                isUnread ? Icons.mark_email_read_outlined : Icons.mark_email_unread_outlined,
                                size: 18,
                              ),
                              tooltip: isUnread ? 'Mark as read' : 'Mark as unread',
                              onPressed: () {
                                widget.state.toggleSelectThread(thread.id);
                                widget.state.batchMarkAsRead(isUnread);
                              },
                              splashRadius: 16,
                            ),
                          ],
                        )
                      : Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            _formatDate(thread.lastMessageDate),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isUnread ? FontWeight.w700 : FontWeight.w400,
                              color: isUnread ? GmailColors.textDark : GmailColors.textSnippet,
                            ),
                          ),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

