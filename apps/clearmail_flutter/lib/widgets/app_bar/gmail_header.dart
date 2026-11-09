import 'package:flutter/material.dart';
import '../../state/mail_state.dart';
import '../../theme/gmail_theme.dart';

class GmailHeader extends StatefulWidget {
  final MailState state;
  final VoidCallback onToggleSidebar;

  const GmailHeader({
    super.key,
    required this.state,
    required this.onToggleSidebar,
  });

  @override
  State<GmailHeader> createState() => _GmailHeaderState();
}

class _GmailHeaderState extends State<GmailHeader> {
  late TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: widget.state.searchQuery);
  }

  @override
  void didUpdateWidget(covariant GmailHeader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.state.searchQuery != _searchController.text) {
      _searchController.text = widget.state.searchQuery;
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      color: GmailColors.scaffoldBackground,
      child: Row(
        children: [
          // Hamburger Menu
          IconButton(
            icon: const Icon(Icons.menu, color: GmailColors.textSnippet),
            onPressed: widget.onToggleSidebar,
            tooltip: 'Main menu',
          ),
          const SizedBox(width: 8),

          // Logo & Title
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: GmailColors.googleRed.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.mail,
                  color: GmailColors.googleRed,
                  size: 24,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'ClearMail',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w500,
                  color: GmailColors.textDark,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(width: 8),
              // Live status indicator
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: widget.state.isRealtimeConnected
                      ? GmailColors.googleGreen.withOpacity(0.12)
                      : Colors.orange.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: widget.state.isRealtimeConnected
                            ? GmailColors.googleGreen
                            : Colors.orange,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      widget.state.isRealtimeConnected ? 'Live Sync' : 'Connecting',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: widget.state.isRealtimeConnected
                            ? GmailColors.googleGreen
                            : Colors.orange,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 32),

          // Omnibox Search Bar (Gmail Style)
          Expanded(
            child: Container(
              height: 48,
              constraints: const BoxConstraints(maxWidth: 720),
              decoration: BoxDecoration(
                color: GmailColors.searchBarBg,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 16),
                  const Icon(Icons.search, color: GmailColors.textSnippet, size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      decoration: const InputDecoration(
                        hintText: 'Search mail (e.g. from:, has:attachment, subject)',
                        hintStyle: TextStyle(
                          color: GmailColors.textMuted,
                          fontSize: 14,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                      style: const TextStyle(fontSize: 14, color: GmailColors.textDark),
                      onSubmitted: (val) {
                        widget.state.setSearchQuery(val);
                      },
                    ),
                  ),
                  if (_searchController.text.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.close, size: 18, color: GmailColors.textSnippet),
                      onPressed: () {
                        _searchController.clear();
                        widget.state.clearSearch();
                      },
                    ),
                  // Filter slider icon
                  IconButton(
                    icon: const Icon(Icons.tune, size: 20, color: GmailColors.textSnippet),
                    tooltip: 'Show search options',
                    onPressed: () {
                      _showSearchFilterMenu(context);
                    },
                  ),
                  const SizedBox(width: 4),
                ],
              ),
            ),
          ),
          const SizedBox(width: 16),

          // Simulate Inbound Test Email Button (Quick testing tool)
          Tooltip(
            message: 'Simulate instant incoming email push',
            child: OutlinedButton.icon(
              onPressed: () async {
                await widget.state.simulateIncomingTestEmail();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Simulated incoming business email pushed via WebSocket!'),
                      duration: Duration(seconds: 2),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              icon: const Icon(Icons.bolt, size: 16, color: GmailColors.googleBlue),
              label: const Text('Simulate Inbound', style: TextStyle(fontSize: 12)),
              style: OutlinedButton.styleFrom(
                foregroundColor: GmailColors.googleBlue,
                side: const BorderSide(color: GmailColors.googleBlue),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Settings
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: GmailColors.textSnippet),
            onPressed: () {},
            tooltip: 'Settings',
          ),
          const SizedBox(width: 8),

          // User Profile Avatar Chip
          PopupMenuButton<String>(
            tooltip: 'ClearPanel Account',
            onSelected: (val) {
              if (val == '__logout__') {
                widget.state.logout();
              } else {
                widget.state.switchMailbox(val);
              }
            },
            itemBuilder: (ctx) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Signed in as', style: TextStyle(fontSize: 11, color: GmailColors.textMuted)),
                    Text(
                      widget.state.currentMailbox,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: GmailColors.textDark, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'admin@clearpanel.local',
                child: Text('Switch: admin@clearpanel.local'),
              ),
              const PopupMenuItem(
                value: 'sarah@clearpanel.local',
                child: Text('Switch: sarah@clearpanel.local'),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'alex@clearpanel.local',
                child: Text('Switch: alex@clearpanel.local'),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: '__logout__',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 18, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Sign out', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ],
            child: CircleAvatar(
              radius: 17,
              backgroundColor: GmailColors.googleBlue,
              child: Text(
                widget.state.currentMailbox.isNotEmpty
                    ? widget.state.currentMailbox[0].toUpperCase()
                    : 'U',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showSearchFilterMenu(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Search Filters'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.attach_file),
              title: const Text('Has attachment'),
              onTap: () {
                Navigator.pop(ctx);
                widget.state.setSearchQuery('has:attachment');
              },
            ),
            ListTile(
              leading: const Icon(Icons.mark_email_unread_outlined),
              title: const Text('Unread emails'),
              onTap: () {
                Navigator.pop(ctx);
                widget.state.setSearchQuery('is:unread');
              },
            ),
            ListTile(
              leading: const Icon(Icons.star_border),
              title: const Text('Starred emails'),
              onTap: () {
                Navigator.pop(ctx);
                widget.state.setSearchQuery('is:starred');
              },
            ),
          ],
        ),
      ),
    );
  }
}

