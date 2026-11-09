import 'dart:html' as html;
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../state/mail_state.dart';
import '../../theme/gmail_theme.dart';

class ProfileDialog extends StatefulWidget {
  final MailState state;

  const ProfileDialog({super.key, required this.state});

  static Future<void> show(BuildContext context, MailState state) {
    return showDialog(
      context: context,
      builder: (ctx) => ProfileDialog(state: state),
    );
  }

  @override
  State<ProfileDialog> createState() => _ProfileDialogState();
}

class _ProfileDialogState extends State<ProfileDialog> {
  late TextEditingController _nameController;
  Uint8List? _previewBytes;
  String? _pickedFilename;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.state.displayName);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _pickAvatar() {
    if (!kIsWeb) return;
    try {
      final uploadInput = html.FileUploadInputElement();
      uploadInput.accept = 'image/*';
      uploadInput.click();

      uploadInput.onChange.listen((e) {
        final files = uploadInput.files;
        if (files == null || files.isEmpty) return;

        final file = files.first;
        final reader = html.FileReader();
        reader.readAsArrayBuffer(file);
        reader.onLoadEnd.listen((e) {
          final result = reader.result;
          if (result is Uint8List) {
            setState(() {
              _previewBytes = result;
              _pickedFilename = file.name;
            });
          } else if (result is List<int>) {
            setState(() {
              _previewBytes = Uint8List.fromList(result);
              _pickedFilename = file.name;
            });
          }
        });
      });
    } catch (e) {
      debugPrint('Error picking avatar: $e');
    }
  }

  Future<void> _handleSave() async {
    setState(() => _isSaving = true);
    try {
      await widget.state.updateProfile(
        name: _nameController.text.trim(),
        avatarBytes: _previewBytes,
        filename: _pickedFilename,
      );
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully'),
            backgroundColor: GmailColors.googleGreen,
          ),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update profile: $err'),
            backgroundColor: GmailColors.googleRed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mailbox = widget.state.currentMailbox;
    final initialLetter = widget.state.displayName.isNotEmpty
        ? widget.state.displayName[0].toUpperCase()
        : (mailbox.isNotEmpty ? mailbox[0].toUpperCase() : 'U');

    ImageProvider? avatarProvider;
    if (_previewBytes != null) {
      avatarProvider = MemoryImage(_previewBytes!);
    } else if (widget.state.avatarUrl != null && widget.state.avatarUrl!.isNotEmpty) {
      avatarProvider = NetworkImage(widget.state.avatarUrl!);
    } else if (mailbox.isNotEmpty) {
      avatarProvider = NetworkImage('/api/mail/avatars/${Uri.encodeComponent(mailbox)}');
    }

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Edit Email Profile',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: GmailColors.textDark,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Avatar preview & edit button
              Stack(
                alignment: Alignment.bottomRight,
                children: [
                  CircleAvatar(
                    radius: 46,
                    backgroundColor: GmailColors.googleBlue,
                    foregroundImage: avatarProvider,
                    onForegroundImageError: (_, __) {},
                    child: Text(
                      initialLetter,
                      style: const TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: _pickAvatar,
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: GmailColors.googleBlue,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: const Icon(Icons.camera_alt, size: 16, color: Colors.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _pickAvatar,
                icon: const Icon(Icons.photo_library_outlined, size: 16),
                label: Text(_previewBytes != null ? 'Change selected photo' : 'Upload photo'),
              ),
              const SizedBox(height: 16),

              // Account Email Info
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: GmailColors.searchBarBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Email Address',
                      style: TextStyle(fontSize: 11, color: GmailColors.textSnippet, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      mailbox,
                      style: const TextStyle(fontSize: 13, color: GmailColors.textDark, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Display Name Field
              TextField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: 'Display Name',
                  hintText: 'e.g. Hamza Sefion or Support Team',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  helperText: 'Shown to recipients when you send emails and in headers',
                  helperMaxLines: 2,
                ),
              ),
              const SizedBox(height: 24),

              // Action buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _isSaving ? null : _handleSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GmailColors.googleBlue,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: _isSaving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Save Profile'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
