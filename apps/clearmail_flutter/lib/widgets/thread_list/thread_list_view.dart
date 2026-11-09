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

    return Container(
      decoration: BoxDecoration(
        color: GmailColors.surfaceWhite,
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
            child: state.isLoading && state.threads.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : state.threads.isEmpty
                    ? _buildEmptyState()
                    : RefreshIndicator(
                        onRefresh: () => state.loadThreads(),
                        child: ListView.builder(
                          itemCount: state.threads.length,
                          itemBuilder: (ctx, index) {
                            final thread = state.threads[index];
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
      return SizedBox(
        height: 44,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              _buildCategoryTab(
                id: 'primary',
                title: 'Primary',
                icon: Icons.inbox,
                activeColor: GmailColors.googleRed,
              ),
              _buildCategoryTab(
                id: 'promotions',
                title: 'Promotions',
                icon: Icons.local_offer_outlined,
                activeColor: GmailColors.googleGreen,
              ),
              _buildCategoryTab(
                id: 'social',
                title: 'Social',
                icon: Icons.people_outline,
                activeColor: GmailColors.googleBlue,
              ),
              _buildCategoryTab(
                id: 'updates',
                title: 'Updates',
                icon: Icons.info_outline,
                activeColor: GmailColors.googleYellow,
              ),
            ],
          ),
        ),
      );
    }
    return SizedBox(
      height: 48,
      child: Row(
        children: [
          _buildCategoryTab(
            id: 'primary',
            title: 'Primary',
            icon: Icons.inbox,
            activeColor: GmailColors.googleRed,
          ),
          _buildCategoryTab(
            id: 'promotions',
            title: 'Promotions',
            icon: Icons.local_offer_outlined,
            activeColor: GmailColors.googleGreen,
          ),
          _buildCategoryTab(
            id: 'social',
            title: 'Social',
            icon: Icons.people_outline,
            activeColor: GmailColors.googleBlue,
          ),
          _buildCategoryTab(
            id: 'updates',
            title: 'Updates',
            icon: Icons.info_outline,
            activeColor: GmailColors.googleYellow,
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTab({
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

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inbox, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text(
            'Your inbox is empty',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: GmailColors.textSnippet),
          ),
          const SizedBox(height: 8),
          const Text(
            'Enjoy your day! Tap "Simulate Inbound" to test incoming business emails.',
            style: TextStyle(fontSize: 13, color: GmailColors.textMuted),
          ),
        ],
      ),
    );
  }
}

