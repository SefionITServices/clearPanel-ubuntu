import 'dart:html' as html;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../state/mail_state.dart';
import '../../theme/gmail_theme.dart';

class ComposeDialog extends StatefulWidget {
  final MailState state;
  final String? initialTo;
  final String? initialSubject;
  final String? initialBody;
  final String? replyToThreadId;
  final Function({
    required List<Map<String, String>> to,
    List<Map<String, String>>? cc,
    List<Map<String, String>>? bcc,
    required String subject,
    required String bodyText,
    List<Map<String, dynamic>>? attachments,
    String? replyToThreadId,
  }) onSend;
  final VoidCallback onClose;

  const ComposeDialog({
    super.key,
    required this.state,
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
  late TextEditingController _ccController;
  late TextEditingController _bccController;
  late TextEditingController _subjectController;
  late TextEditingController _bodyController;

  bool _isMinimized = false;
  bool _isMaximized = false;
  bool _showCc = false;
  bool _showBcc = false;
  bool _isUploadingAttachment = false;

  final List<Map<String, dynamic>> _attachments = [];
  List<Map<String, String>> _contactSuggestions = [];
  bool _showSuggestions = false;

  @override
  void initState() {
    super.initState();
    _toController = TextEditingController(text: widget.initialTo ?? '');
    _ccController = TextEditingController();
    _bccController = TextEditingController();
    _subjectController = TextEditingController(text: widget.initialSubject ?? '');
    _bodyController = TextEditingController(text: widget.initialBody ?? '');

    _toController.addListener(_onRecipientChanged);
  }

  @override
  void dispose() {
    _toController.removeListener(_onRecipientChanged);
    _toController.dispose();
    _ccController.dispose();
    _bccController.dispose();
    _subjectController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  void _onRecipientChanged() async {
    final text = _toController.text.trim();
    if (text.length >= 2 && !text.contains(',')) {
      final suggestions = await widget.state.suggestContacts(text);
      if (mounted) {
        setState(() {
          _contactSuggestions = suggestions;
          _showSuggestions = suggestions.isNotEmpty;
        });
      }
    } else {
      if (_showSuggestions && mounted) {
        setState(() {
          _showSuggestions = false;
        });
      }
    }
  }

  void _selectContact(Map<String, String> contact) {
    setState(() {
      _toController.text = contact['email'] ?? '';
      _showSuggestions = false;
    });
  }

  void _pickFiles() {
    if (!kIsWeb) return;
    try {
      final uploadInput = html.FileUploadInputElement();
      uploadInput.multiple = true;
      uploadInput.click();

      uploadInput.onChange.listen((e) {
        final files = uploadInput.files;
        if (files == null || files.isEmpty) return;

        for (final file in files) {
          final reader = html.FileReader();
          reader.readAsArrayBuffer(file);
          reader.onLoadEnd.listen((e) async {
            final bytes = reader.result as List<int>;
            setState(() => _isUploadingAttachment = true);
            try {
              final uploaded = await widget.state.uploadAttachment(
                filename: file.name,
                bytes: bytes,
              );
              if (mounted) {
                setState(() {
                  _attachments.add(uploaded);
                });
              }
            } catch (err) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to upload ${file.name}: $err')),
                );
              }
            } finally {
              if (mounted) {
                setState(() => _isUploadingAttachment = false);
              }
            }
          });
        }
      });
    } catch (_) {}
  }

  void _removeAttachment(int index) {
    setState(() {
      _attachments.removeAt(index);
    });
  }

  List<Map<String, String>> _parseAddresses(String input) {
    return input
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .map((e) => {'name': e.split('@')[0], 'email': e})
        .toList();
  }

  void _applyFormat(String prefix, String suffix) {
    final text = _bodyController.text;
    final selection = _bodyController.selection;
    if (selection.start < 0 || selection.end < 0) {
      _bodyController.text = '$text$prefix$suffix';
      return;
    }
    final selectedText = selection.textInside(text);
    final newText = selection.textBefore(text) + prefix + selectedText + suffix + selection.textAfter(text);
    _bodyController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: selection.start + prefix.length + selectedText.length),
    );
  }

  void _handleSend() {
    final toText = _toController.text.trim();
    if (toText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please specify at least one recipient')),
      );
      return;
    }

    final recipients = _parseAddresses(toText);
    final ccRecipients = _showCc && _ccController.text.trim().isNotEmpty
        ? _parseAddresses(_ccController.text.trim())
        : null;
    final bccRecipients = _showBcc && _bccController.text.trim().isNotEmpty
        ? _parseAddresses(_bccController.text.trim())
        : null;

    widget.onSend(
      to: recipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      subject: _subjectController.text.trim().isEmpty ? '(No Subject)' : _subjectController.text.trim(),
      bodyText: _bodyController.text,
      attachments: _attachments.isNotEmpty ? _attachments : null,
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
    final double dialogHeight = _isMaximized ? MediaQuery.of(context).size.height * 0.8 : 540;

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

          // To Input with Cc / Bcc toggle actions
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
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
                if (!_showCc)
                  TextButton(
                    onPressed: () => setState(() => _showCc = true),
                    child: const Text('Cc', style: TextStyle(color: GmailColors.textSnippet, fontSize: 13)),
                  ),
                if (!_showBcc)
                  TextButton(
                    onPressed: () => setState(() => _showBcc = true),
                    child: const Text('Bcc', style: TextStyle(color: GmailColors.textSnippet, fontSize: 13)),
                  ),
              ],
            ),
          ),

          // Contact Autocomplete Suggestions
          if (_showSuggestions && _contactSuggestions.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              constraints: const BoxConstraints(maxHeight: 140),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8),
                ],
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _contactSuggestions.length,
                itemBuilder: (ctx, idx) {
                  final c = _contactSuggestions[idx];
                  return ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 12,
                      backgroundColor: GmailColors.googleBlue.withOpacity(0.1),
                      child: Text(
                        c['name']?.isNotEmpty == true ? c['name']![0].toUpperCase() : '@',
                        style: const TextStyle(fontSize: 11, color: GmailColors.googleBlue),
                      ),
                    ),
                    title: Text(c['name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: Text(c['email'] ?? '', style: const TextStyle(fontSize: 11, color: GmailColors.textSnippet)),
                    onTap: () => _selectContact(c),
                  );
                },
              ),
            ),

          // Optional Cc Input
          if (_showCc)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _ccController,
                decoration: InputDecoration(
                  prefixText: 'Cc  ',
                  prefixStyle: const TextStyle(color: GmailColors.textSnippet, fontSize: 14),
                  hintText: 'Carbon copy recipients',
                  hintStyle: const TextStyle(color: GmailColors.textMuted, fontSize: 13),
                  border: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFE0E2EC))),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: () => setState(() {
                      _showCc = false;
                      _ccController.clear();
                    }),
                  ),
                ),
                style: const TextStyle(fontSize: 14),
              ),
            ),

          // Optional Bcc Input
          if (_showBcc)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _bccController,
                decoration: InputDecoration(
                  prefixText: 'Bcc ',
                  prefixStyle: const TextStyle(color: GmailColors.textSnippet, fontSize: 14),
                  hintText: 'Blind carbon copy recipients',
                  hintStyle: const TextStyle(color: GmailColors.textMuted, fontSize: 13),
                  border: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFE0E2EC))),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: () => setState(() {
                      _showBcc = false;
                      _bccController.clear();
                    }),
                  ),
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

          // Attachments Chips List
          if (_attachments.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              alignment: Alignment.centerLeft,
              child: Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _attachments.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final att = entry.value;
                  return Chip(
                    avatar: const Icon(Icons.attachment, size: 16, color: GmailColors.googleBlue),
                    label: Text(
                      '${att['filename']} (${((att['size'] ?? 0) / 1024).toStringAsFixed(1)} KB)',
                      style: const TextStyle(fontSize: 11),
                    ),
                    deleteIcon: const Icon(Icons.close, size: 14),
                    onDeleted: () => _removeAttachment(idx),
                    backgroundColor: const Color(0xFFEAF1FB),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.all(4),
                  );
                }).toList(),
              ),
            ),

          if (_isUploadingAttachment)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: LinearProgressIndicator(minHeight: 2),
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
                // Send Pill Button
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
                  icon: const Icon(Icons.format_bold, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Bold',
                  onPressed: () => _applyFormat('**', '**'),
                ),
                IconButton(
                  icon: const Icon(Icons.format_italic, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Italic',
                  onPressed: () => _applyFormat('*', '*'),
                ),
                IconButton(
                  icon: const Icon(Icons.format_list_bulleted, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Bullet list',
                  onPressed: () => _applyFormat('\n• ', ''),
                ),
                IconButton(
                  icon: const Icon(Icons.attach_file, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Attach files',
                  onPressed: _pickFiles,
                ),
                IconButton(
                  icon: const Icon(Icons.insert_link, size: 20, color: GmailColors.textSnippet),
                  tooltip: 'Insert link',
                  onPressed: () => _applyFormat('[Link title](https://', ')'),
                ),

                const Spacer(),

                // Discard Draft
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
