import 'package:flutter/material.dart';
import '../../models/email_models.dart';
import '../../state/mail_state.dart';
import '../../theme/gmail_theme.dart';
import 'thread_item_row.dart';

class ThreadListView extends StatelessWidget {
  final MailState state;
  final Function(EmailThread) onOpenThread;

  const ThreadListView({
    super.key,
    required this.state,
    required this.onOpenThread,
  });

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final filteredThreads = (state.currentFolder == 'inbox')
        ? state.threads.where((t) {
            if (state.currentCategory == 'primary') {
              return !t.labels.contains('promotions') &&
                  !t.labels.contains('social') &&
                  !t.labels.contains('updates');
            }
            return t.labels.contains(state.currentCategory);
          }).toList()
        : state.threads;

    return Container(
      decoration: BoxDecoration(
        color: state.isDarkMode ? GmailColors.darkSurface : GmailColors.surfaceWhite,
        borderRadius: isMobile ? BorderRadius.zero : BorderRadius.circular(16),
      ),
      margin: isMobile ? EdgeInsets.zero : const EdgeInsets.only(right: 16, bottom: 16),
      child: Column(
        children: [
          // Top Action Toolbar
          _buildTopToolbar(context, isMobile: isMobile),

          // Gmail Category Tabs (Only on Inbox folder)
          if (state.currentFolder == 'inbox') _buildCategoryTabs(isMobile: isMobile),

          const Divider(height: 1, color: GmailColors.threadBorder),

          // Thread List Content
          Expanded(
            child: state.isLoading && filteredThreads.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : filteredThreads.isEmpty
                    ? _buildEmptyState(isMobile: isMobile)
                    : RefreshIndicator(
                        onRefresh: () => state.loadThreads(),
                        child: ListView.builder(
                          itemCount: filteredThreads.length,
                          itemBuilder: (ctx, index) {
                            final thread = filteredThreads[index];
                            final isSelected = state.selectedThreadIds.contains(thread.id);
                            return ThreadItemRow(
                              thread: thread,
                              state: state,
                              isSelected: isSelected,
                              onTap: () => onOpenThread(thread),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopToolbar(BuildContext context, {bool isMobile = false}) {
    final hasSelection = state.selectedThreadIds.isNotEmpty;
    final allSelected =
        state.threads.isNotEmpty && state.selectedThreadIds.length == state.threads.length;

    if (isMobile && !hasSelection) {
      return Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Text(
              state.currentFolder.toUpperCase(),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8, color: GmailColors.textSnippet),
            ),
            const Spacer(),
            Text(
              '${state.threads.length} conversations',
              style: const TextStyle(fontSize: 12, color: GmailColors.textSnippet),
            ),
          ],
        ),
      );
    }

    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          if (hasSelection)
            IconButton(
              icon: const Icon(Icons.close, size: 20),
              tooltip: 'Clear selection',
              onPressed: () => state.clearSelection(),
            )
          else
            Checkbox(
              value: allSelected ? true : (hasSelection ? null : false),
              tristate: true,
              onChanged: (val) {
                state.selectAllThreads(val ?? false);
              },
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
            ),

          const SizedBox(width: 8),

          if (hasSelection) ...[
            Text(
              '${state.selectedThreadIds.length}',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: GmailColors.textDark),
            ),
            const Spacer(),
            IconButton(
              icon: const Icon(Icons.archive_outlined, size: 20),
              tooltip: 'Archive',
              onPressed: state.batchArchive,
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 20),
              tooltip: 'Delete',
              onPressed: state.batchDelete,
            ),
            IconButton(
              icon: const Icon(Icons.mark_email_read_outlined, size: 20),
              tooltip: 'Mark as read',
              onPressed: () => state.batchMarkAsRead(true),
            ),
            IconButton(
              icon: const Icon(Icons.mark_email_unread_outlined, size: 20),
              tooltip: 'Mark as unread',
              onPressed: () => state.batchMarkAsRead(false),
            ),
          ] else ...[
            // Default Toolbar
            IconButton(
              icon: const Icon(Icons.refresh, size: 20),
              tooltip: 'Refresh',
              onPressed: state.loadThreads,
            ),
            IconButton(
              icon: const Icon(Icons.more_vert, size: 20),
              tooltip: 'More',
              onPressed: () {},
            ),
            const Spacer(),
            if (!isMobile)
              Text(
                '1–${state.threads.length} of ${state.threads.length}',
                style: const TextStyle(fontSize: 12, color: GmailColors.textSnippet),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildCategoryTabs({bool isMobile = false}) {
    if (isMobile) {
      return Container(
        height: 48,
        decoration: BoxDecoration(
          color: state.isDarkMode ? GmailColors.darkSurface : GmailColors.surfaceWhite,
          border: const Border(bottom: BorderSide(color: GmailColors.threadBorder, width: 0.8)),
        ),
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          physics: const BouncingScrollPhysics(),
          children: [
            _buildMobileCategoryChip(
              id: 'primary',
              title: 'Primary',
              icon: Icons.inbox,
              activeColor: GmailColors.googleRed,
            ),
            _buildMobileCategoryChip(
              id: 'promotions',
              title: 'Promotions',
              icon: Icons.local_offer_outlined,
              activeColor: GmailColors.googleGreen,
            ),
            _buildMobileCategoryChip(
              id: 'social',
              title: 'Social',
              icon: Icons.people_outline,
              activeColor: GmailColors.googleBlue,
            ),
            _buildMobileCategoryChip(
              id: 'updates',
              title: 'Updates',
              icon: Icons.info_outline,
              activeColor: GmailColors.googleYellow,
            ),
          ],
        ),
      );
    }
    return SizedBox(
      height: 48,
      child: Row(
        children: [
          _buildDesktopCategoryTab(
            id: 'primary',
            title: 'Primary',
            icon: Icons.inbox,
            activeColor: GmailColors.googleRed,
          ),
          _buildDesktopCategoryTab(
            id: 'promotions',
            title: 'Promotions',
            icon: Icons.local_offer_outlined,
            activeColor: GmailColors.googleGreen,
          ),
          _buildDesktopCategoryTab(
            id: 'social',
            title: 'Social',
            icon: Icons.people_outline,
            activeColor: GmailColors.googleBlue,
          ),
          _buildDesktopCategoryTab(
            id: 'updates',
            title: 'Updates',
            icon: Icons.info_outline,
            activeColor: GmailColors.googleYellow,
          ),
        ],
      ),
    );
  }

  Widget _buildMobileCategoryChip({
    required String id,
    required String title,
    required IconData icon,
    required Color activeColor,
  }) {
    final isActive = state.currentCategory == id;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => state.setCategory(id),
          borderRadius: BorderRadius.circular(20),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: isActive
                  ? activeColor.withOpacity(0.14)
                  : (state.isDarkMode ? GmailColors.darkSearchBarBg : const Color(0xFFF1F3F4)),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isActive ? activeColor : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: isActive ? activeColor : (state.isDarkMode ? GmailColors.darkSnippet : GmailColors.textSnippet),
                ),
                const SizedBox(width: 6),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                    color: isActive ? activeColor : (state.isDarkMode ? GmailColors.darkText : GmailColors.textDark),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDesktopCategoryTab({
    required String id,
    required String title,
    required IconData icon,
    required Color activeColor,
  }) {
    final isActive = state.currentCategory == id;

    return Expanded(
      child: InkWell(
        onTap: () => state.setCategory(id),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isActive ? activeColor : Colors.transparent,
                width: 3,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 18,
                color: isActive ? activeColor : GmailColors.textSnippet,
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive ? activeColor : GmailColors.textSnippet,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState({bool isMobile = false}) {
    final folderName = state.currentFolder.isNotEmpty
        ? state.currentFolder[0].toUpperCase() + state.currentFolder.substring(1)
        : 'Inbox';
    final isCategoryEmpty = state.currentFolder == 'inbox' && state.currentCategory != 'primary';
    final title = isCategoryEmpty
        ? 'No emails in ${state.currentCategory[0].toUpperCase()}${state.currentCategory.substring(1)}'
        : 'Your $folderName is empty';

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              state.currentFolder == 'sent' ? Icons.send_outlined : Icons.inbox_outlined,
              size: isMobile ? 48 : 64,
              color: Colors.grey.shade300,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: GmailColors.textSnippet),
            ),
            const SizedBox(height: 8),
            Text(
              state.currentFolder == 'sent'
                  ? 'Emails you send from ClearMail will appear here.'
                  : 'Enjoy your clean inbox! Tap "Simulate Inbound" to test incoming business emails.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: GmailColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

