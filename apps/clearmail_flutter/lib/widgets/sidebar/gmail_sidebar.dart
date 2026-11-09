import 'package:flutter/material.dart';
import '../../state/mail_state.dart';
import '../../theme/gmail_theme.dart';

class GmailSidebar extends StatelessWidget {
  final MailState state;
  final bool isCollapsed;
  final VoidCallback onComposePressed;

  const GmailSidebar({
    super.key,
    required this.state,
    required this.isCollapsed,
    required this.onComposePressed,
  });

  @override
  Widget build(BuildContext context) {
    if (isCollapsed) {
      return Container(
        width: 72,
        color: GmailColors.scaffoldBackground,
        child: Column(
          children: [
            const SizedBox(height: 12),
            IconButton(
              icon: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: GmailColors.composePillBg,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.edit_outlined, color: GmailColors.composePillText),
              ),
              onPressed: onComposePressed,
              tooltip: 'Compose',
            ),
            const SizedBox(height: 16),
            _buildCollapsedIcon(Icons.inbox, 'inbox'),
            _buildCollapsedIcon(Icons.star_border, 'starred'),
            _buildCollapsedIcon(Icons.send_outlined, 'sent'),
            _buildCollapsedIcon(Icons.drafts_outlined, 'drafts'),
            _buildCollapsedIcon(Icons.delete_outline, 'trash'),
          ],
        ),
      );
    }

    return Container(
      width: 256,
      color: GmailColors.scaffoldBackground,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Compose Pill Button (Gmail Style)
          Padding(
            padding: const EdgeInsets.only(left: 16, top: 12, bottom: 16),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onComposePressed,
                borderRadius: BorderRadius.circular(16),
                hoverColor: GmailColors.composePillBg.withOpacity(0.8),
                child: Container(
                  height: 56,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
                    color: GmailColors.composePillBg,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.06),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.edit_outlined, color: GmailColors.composePillText, size: 22),
                      SizedBox(width: 14),
                      Text(
                        'Compose',
                        style: TextStyle(
                          color: GmailColors.composePillText,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Folders List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                _buildNavItem(
                  icon: Icons.inbox,
                  label: 'Inbox',
                  folderKey: 'inbox',
                  badgeCount: state.stats?.unreadCount ?? 0,
                ),
                _buildNavItem(
                  icon: Icons.star_border,
                  label: 'Starred',
                  folderKey: 'starred',
                  badgeCount: state.stats?.foldersCount['starred'] ?? 0,
                ),
                _buildNavItem(
                  icon: Icons.access_time,
                  label: 'Snoozed',
                  folderKey: 'snoozed',
                ),
                _buildNavItem(
                  icon: Icons.send_outlined,
                  label: 'Sent',
                  folderKey: 'sent',
                  badgeCount: state.stats?.foldersCount['sent'] ?? 0,
                ),
                _buildNavItem(
                  icon: Icons.insert_drive_file_outlined,
                  label: 'Drafts',
                  folderKey: 'drafts',
                  badgeCount: state.stats?.foldersCount['drafts'] ?? 0,
                ),
                _buildNavItem(
                  icon: Icons.delete_outline,
                  label: 'Trash',
                  folderKey: 'trash',
                ),
                _buildNavItem(
                  icon: Icons.report_gmailerrorred_outlined,
                  label: 'Spam',
                  folderKey: 'spam',
                ),

                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                  child: Divider(color: Color(0xFFE0E2EC), height: 1),
                ),

                // Labels Section
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    'Labels',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: GmailColors.textSnippet,
                    ),
                  ),
                ),
                _buildLabelItem('Work', Colors.blue),
                _buildLabelItem('Personal', Colors.green),
                _buildLabelItem('Finance', Colors.orange),
                _buildLabelItem('System', Colors.purple),
              ],
            ),
          ),

          // Storage Meter (Google Workspace parity)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFE0E2EC), width: 1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.cloud_queue, size: 16, color: GmailColors.textSnippet),
                    const SizedBox(width: 8),
                    Text(
                      '${state.stats?.formattedUsedStorage ?? '0 MB'} of ${state.stats?.formattedTotalQuota ?? '15 GB'} used',
                      style: const TextStyle(fontSize: 12, color: GmailColors.textSnippet),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: state.stats?.quotaPercentage ?? 0.05,
                    backgroundColor: Colors.grey.shade300,
                    valueColor: const AlwaysStoppedAnimation<Color>(GmailColors.googleBlue),
                    minHeight: 4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCollapsedIcon(IconData icon, String folderKey) {
    final isActive = state.currentFolder == folderKey;
    return IconButton(
      icon: Icon(
        icon,
        color: isActive ? GmailColors.googleBlue : GmailColors.textSnippet,
      ),
      onPressed: () => state.setFolder(folderKey),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required String folderKey,
    int badgeCount = 0,
  }) {
    final isActive = state.currentFolder == folderKey && state.currentLabel == null;

    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: isActive ? GmailColors.sidebarActivePill : Colors.transparent,
        borderRadius: const BorderRadius.horizontal(right: Radius.circular(24)),
      ),
      child: ListTile(
        dense: true,
        leading: Icon(
          icon,
          size: 20,
          color: isActive ? GmailColors.sidebarActiveText : GmailColors.sidebarInactiveText,
        ),
        title: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isActive || badgeCount > 0 ? FontWeight.w600 : FontWeight.w400,
            color: isActive ? GmailColors.sidebarActiveText : GmailColors.sidebarInactiveText,
          ),
        ),
        trailing: badgeCount > 0
            ? Text(
                '$badgeCount',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isActive ? GmailColors.sidebarActiveText : GmailColors.sidebarInactiveText,
                ),
              )
            : null,
        onTap: () => state.setFolder(folderKey),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
        ),
      ),
    );
  }

  Widget _buildLabelItem(String label, Color color) {
    final isActive = state.currentLabel == label;

    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: isActive ? GmailColors.sidebarActivePill : Colors.transparent,
        borderRadius: const BorderRadius.horizontal(right: Radius.circular(24)),
      ),
      child: ListTile(
        dense: true,
        leading: Icon(Icons.label, size: 18, color: color),
        title: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
            color: isActive ? GmailColors.sidebarActiveText : GmailColors.sidebarInactiveText,
          ),
        ),
        onTap: () => state.setLabel(label),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
        ),
      ),
    );
  }
}

