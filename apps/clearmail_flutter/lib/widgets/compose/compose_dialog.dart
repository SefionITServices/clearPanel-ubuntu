import 'package:flutter/material.dart';
import '../../theme/gmail_theme.dart';

class ComposeDialog extends StatefulWidget {
  final String? initialTo;
  final String? initialSubject;
  final String? initialBody;
  final String? replyToThreadId;
  final Function({
    required List<Map<String, String>> to,
    List<Map<String, String>>? cc,
    required String subject,
    required String bodyText,
    String? replyToThreadId,
  }) onSend;
  final VoidCallback onClose;

  const ComposeDialog({
    super.key,
    this.initialTo,
    this.initialSubject,
    this.initialBody,
    this.replyToThreadId,
    required this.onSend,
    required this.onClose,
  });

  @override
  State<ComposeDialog> createState() => _ComposeDialogState();
}

class _ComposeDialogState extends State<ComposeDialog> {
  late TextEditingController _toController;
  late TextEditingController _subjectController;
  late TextEditingController _bodyController;
  bool _isMinimized = false;
  bool _isMaximized = false;

  @override
  void initState() {
    super.initState();
    _toController = TextEditingController(text: widget.initialTo ?? '');
    _subjectController = TextEditingController(text: widget.initialSubject ?? '');
    _bodyController = TextEditingController(text: widget.initialBody ?? '');
  }

  @override
  void dispose() {
    _toController.dispose();
    _subjectController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  void _handleSend() {
    final toText = _toController.text.trim();
    if (toText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please specify at least one recipient')),
      );
      return;
    }

    final recipients = toText
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .map((e) => {'name': e.split('@')[0], 'email': e})
        .toList();

    widget.onSend(
      to: recipients,
      subject: _subjectController.text.trim().isEmpty ? '(No Subject)' : _subjectController.text.trim(),
      bodyText: _bodyController.text,
      replyToThreadId: widget.replyToThreadId,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isMinimized) {
      return Container(
        width: 260,
        height: 40,
        decoration: BoxDecoration(
          color: GmailColors.textDark,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: Row(
          children: [
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'New Message',
                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.arrow_upward, color: Colors.white, size: 16),
              onPressed: () => setState(() => _isMinimized = false),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 16),
              onPressed: widget.onClose,
            ),
          ],
        ),
      );
    }

    final double dialogWidth = _isMaximized ? MediaQuery.of(context).size.width * 0.75 : 560;
    final double dialogHeight = _isMaximized ? MediaQuery.of(context).size.height * 0.8 : 520;

    return Container(
      width: dialogWidth,
      height: dialogHeight,
      decoration: BoxDecoration(
        color: GmailColors.surfaceWhite,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.25),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header Bar
          Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: const BoxDecoration(
              color: Color(0xFFF2F6FC),
              borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
            ),
            child: Row(
              children: [
                Text(
                  widget.initialSubject != null && widget.initialSubject!.isNotEmpty
                      ? widget.initialSubject!
                      : 'New Message',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: GmailColors.textDark,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.remove, size: 18),
                  tooltip: 'Minimize',
                  onPressed: () => setState(() => _isMinimized = true),
                ),
                IconButton(
                  icon: Icon(_isMaximized ? Icons.close_fullscreen : Icons.open_in_full, size: 16),
                  tooltip: _isMaximized ? 'Exit full screen' : 'Full screen',
                  onPressed: () => setState(() => _isMaximized = !_isMaximized),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  tooltip: 'Save & close',
                  onPressed: widget.onClose,
                ),
              ],
            ),
          ),

          // To Input
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _toController,
              decoration: const InputDecoration(
                prefixText: 'To  ',
                prefixStyle: TextStyle(color: GmailColors.textSnippet, fontSize: 14),
                hintText: 'Recipients (e.g. user@domain.com)',
                hintStyle: TextStyle(color: GmailColors.textMuted, fontSize: 13),
                border: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFE0E2EC))),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 10),
              ),
              style: const TextStyle(fontSize: 14),
            ),
          ),

          // Subject Input
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _subjectController,
              decoration: const InputDecoration(
                hintText: 'Subject',
                hintStyle: TextStyle(color: GmailColors.textMuted, fontSize: 13),
                border: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFE0E2EC))),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 10),
              ),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),

          // Body Editor
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _bodyController,
                maxLines: null,
                expands: true,
                textAlignVertical: TextAlignVertical.top,
                decoration: const InputDecoration(
                  hintText: 'Write your message...',
                  hintStyle: TextStyle(color: GmailColors.textMuted, fontSize: 14),
                  border: InputBorder.none,
                ),
                style: const TextStyle(fontSize: 14, height: 1.5),
              ),
            ),
          ),

          const Divider(height: 1, color: Color(0xFFE0E2EC)),

          // Bottom Action Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                // Send Pill Button (Gmail Style)
                ElevatedButton(
                  onPressed: _handleSend,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: GmailColors.googleBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    elevation: 0,
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Send', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      SizedBox(width: 4),
                      Icon(Icons.arrow_drop_down, size: 18),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Formatting Icons
                IconButton(
                  icon: const Icon(Icons.text_format, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Formatting options',
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.attach_file, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Attach files',
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.insert_link, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Insert link',
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.insert_emoticon, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Insert emoji',
                  onPressed: () {},
                ),

                const Spacer(),

                // Discard Trash Can
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Discard draft',
                  onPressed: widget.onClose,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

