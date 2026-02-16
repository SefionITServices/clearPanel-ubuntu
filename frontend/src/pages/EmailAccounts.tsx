import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Menu,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  TextField,
  InputAdornment,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Storage as StorageIcon,
  VpnKey as PasswordIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import {
  mailAPI,
  MailDomain,
  MailboxSummary,
  MailMetricsResponse,
  MailboxDiskUsageEntry,
} from '../api/mail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlatMailbox {
  domainId: string;
  domain: string;
  mailboxId: string;
  email: string;
  quotaMb: number;
  usedBytes: number;
  active: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function usagePercent(usedBytes: number, quotaMb: number): number {
  if (!quotaMb) return 0;
  return Math.min(100, Math.round((usedBytes / (quotaMb * 1048576)) * 100));
}

function usageColor(pct: number): string {
  if (pct >= 90) return '#f44336';
  if (pct >= 75) return '#ff9800';
  return '#4caf50';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  value,
  label,
  bgColor,
  fgColor,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  bgColor: string;
  fgColor: string;
}) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ bgcolor: bgColor, color: fgColor, p: 1.5, borderRadius: 2, display: 'flex' }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EmailAccountsPage() {
  // -- state: data ---------------------------------------------------------
  const [domains, setDomains] = useState<MailDomain[]>([]);
  const [metrics, setMetrics] = useState<MailMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // -- state: filters ------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');

  // -- state: context menu -------------------------------------------------
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<FlatMailbox | null>(null);

  // -- state: dialogs ------------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // -- state: form fields --------------------------------------------------
  const [newLocalPart, setNewLocalPart] = useState('');
  const [newDomainId, setNewDomainId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newQuota, setNewQuota] = useState('1024');
  const [changePassword, setChangePassword] = useState('');
  const [editQuota, setEditQuota] = useState('');

  // -- state: feedback -----------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // -- data loading --------------------------------------------------------
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [domainList, metricsData] = await Promise.all([
        mailAPI.listDomains(),
        mailAPI.getMailMetrics().catch(() => null),
      ]);
      setDomains(domainList);
      setMetrics(metricsData);
    } catch {
      setSnack({ open: true, message: 'Failed to load email accounts', severity: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -- derived data --------------------------------------------------------
  const diskMap = React.useMemo(() => {
    const m = new Map<string, number>();
    if (metrics?.diskUsage) {
      for (const du of metrics.diskUsage) {
        for (const mb of du.mailboxes) {
          m.set(mb.email, mb.bytes);
        }
      }
    }
    return m;
  }, [metrics]);

  const allMailboxes: FlatMailbox[] = React.useMemo(() => {
    const rows: FlatMailbox[] = [];
    for (const d of domains) {
      for (const mb of d.mailboxes) {
        rows.push({
          domainId: d.id,
          domain: d.domain,
          mailboxId: mb.id,
          email: mb.email,
          quotaMb: mb.quotaMb ?? 0,
          usedBytes: diskMap.get(mb.email) ?? 0,
          active: mb.active,
          createdAt: mb.createdAt,
        });
      }
    }
    return rows;
  }, [domains, diskMap]);

  const domainNames = React.useMemo(
    () => [...new Set(domains.map((d) => d.domain))].sort(),
    [domains],
  );

  const filtered = React.useMemo(() => {
    return allMailboxes.filter((mb) => {
      if (domainFilter !== 'all' && mb.domain !== domainFilter) return false;
      if (searchQuery && !mb.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allMailboxes, domainFilter, searchQuery]);

  const totalAccounts = allMailboxes.length;
  const totalUsedBytes = allMailboxes.reduce((s, m) => s + m.usedBytes, 0);
  const totalQuotaMb = allMailboxes.reduce((s, m) => s + m.quotaMb, 0);

  // -- hostname for config section -----------------------------------------
  const primaryDomain = domains.length > 0 ? domains[0].domain : 'yourdomain.com';

  // -- handlers: context menu ----------------------------------------------
  const openMenu = (e: React.MouseEvent<HTMLElement>, mb: FlatMailbox) => {
    setMenuAnchor(e.currentTarget);
    setSelectedMailbox(mb);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
  };

  // -- handlers: create ----------------------------------------------------
  const handleCreate = async () => {
    if (!newLocalPart || !newDomainId || !newPassword) return;
    setSaving(true);
    try {
      await mailAPI.addMailbox(newDomainId, {
        email: `${newLocalPart}@${domains.find((d) => d.id === newDomainId)?.domain ?? ''}`,
        password: newPassword,
        quotaMb: Number(newQuota) || undefined,
      });
      setSnack({ open: true, message: 'Email account created', severity: 'success' });
      setCreateOpen(false);
      setNewLocalPart('');
      setNewPassword('');
      setNewQuota('1024');
      loadData(true);
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to create account', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // -- handlers: change password -------------------------------------------
  const handleChangePassword = async () => {
    if (!selectedMailbox || !changePassword) return;
    setSaving(true);
    try {
      await mailAPI.updateMailbox(selectedMailbox.domainId, selectedMailbox.mailboxId, {
        password: changePassword,
      });
      setSnack({ open: true, message: 'Password changed', severity: 'success' });
      setPasswordOpen(false);
      setChangePassword('');
      closeMenu();
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to change password', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // -- handlers: manage quota ----------------------------------------------
  const handleUpdateQuota = async () => {
    if (!selectedMailbox) return;
    setSaving(true);
    try {
      await mailAPI.updateMailbox(selectedMailbox.domainId, selectedMailbox.mailboxId, {
        quotaMb: editQuota ? Number(editQuota) : null,
      });
      setSnack({ open: true, message: 'Quota updated', severity: 'success' });
      setQuotaOpen(false);
      setEditQuota('');
      closeMenu();
      loadData(true);
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to update quota', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // -- handlers: webmail SSO -----------------------------------------------
  const handleWebmail = async () => {
    if (!selectedMailbox) return;
    closeMenu();
    try {
      const { url } = await mailAPI.getSsoUrl(selectedMailbox.domainId, selectedMailbox.mailboxId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // fallback to generic roundcube
      window.open('/roundcube/', '_blank', 'noopener,noreferrer');
    }
  };

  // -- handlers: delete ----------------------------------------------------
  const handleDelete = async () => {
    if (!selectedMailbox) return;
    setSaving(true);
    try {
      await mailAPI.removeMailbox(selectedMailbox.domainId, selectedMailbox.mailboxId);
      setSnack({ open: true, message: 'Email account deleted', severity: 'success' });
      setDeleteOpen(false);
      closeMenu();
      loadData(true);
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to delete account', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // -- render --------------------------------------------------------------
  return (
    <DashboardLayout>
      <Box>
        {/* Page Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <EmailIcon sx={{ color: '#4285F4', fontSize: 28 }} />
          <Typography variant="h4" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Email Accounts
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none' }}
            onClick={() => {
              if (domains.length > 0 && !newDomainId) setNewDomainId(domains[0].id);
              setCreateOpen(true);
            }}
            disabled={domains.length === 0}
          >
            Create Account
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={() => loadData(true)} disabled={refreshing}>
              {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Stats Cards */}
        {loading ? (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {[0, 1, 2].map((i) => (
              <Grid size={{ xs: 12, md: 4 }} key={i}>
                <Skeleton variant="rounded" height={96} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatCard
                icon={<EmailIcon />}
                value={totalAccounts}
                label="Total Accounts"
                bgColor="#4285F415"
                fgColor="#4285F4"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatCard
                icon={<StorageIcon />}
                value={formatBytes(totalUsedBytes)}
                label="Space Used"
                bgColor="#34A85315"
                fgColor="#34A853"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatCard
                icon={<CheckCircleIcon />}
                value={totalQuotaMb ? formatSize(totalQuotaMb) : 'Unlimited'}
                label="Total Quota"
                bgColor="#FBBC0415"
                fgColor="#FBBC04"
              />
            </Grid>
          </Grid>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Email accounts allow you to send and receive emails using your domain name. You can access your emails via webmail, IMAP, or POP3.
          </Typography>
        </Alert>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                placeholder="Search email accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Domain</InputLabel>
                <Select
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  label="Filter by Domain"
                >
                  <MenuItem value="all">All Domains</MenuItem>
                  {domainNames.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Accounts Table */}
        <Paper>
          <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="body2" color="text.secondary">
              {filtered.length} email account(s) found
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Email Address</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Domain</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Disk Usage</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Quota</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">
                          {allMailboxes.length === 0
                            ? 'No email accounts yet. Create one to get started.'
                            : 'No accounts match your filters.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((mb) => {
                      const pct = usagePercent(mb.usedBytes, mb.quotaMb);
                      const color = usageColor(pct);
                      return (
                        <TableRow key={mb.mailboxId} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <EmailIcon sx={{ color: '#4285F4', fontSize: 20 }} />
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500, fontFamily: 'monospace' }}
                              >
                                {mb.email}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {mb.domain}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Typography
                                  variant="body2"
                                  sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                >
                                  {formatBytes(mb.usedBytes)}
                                </Typography>
                                {mb.quotaMb > 0 && (
                                  <Chip
                                    label={`${pct}%`}
                                    size="small"
                                    sx={{
                                      bgcolor: `${color}15`,
                                      color,
                                      fontWeight: 600,
                                      height: 20,
                                      fontSize: '0.7rem',
                                    }}
                                  />
                                )}
                              </Box>
                              {mb.quotaMb > 0 && (
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: 4,
                                    bgcolor: '#e0e0e0',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      bgcolor: color,
                                      transition: 'width 0.3s',
                                    }}
                                  />
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                            >
                              {mb.quotaMb ? formatSize(mb.quotaMb) : 'Unlimited'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={mb.active ? 'active' : 'suspended'}
                              size="small"
                              color={mb.active ? 'success' : 'error'}
                              sx={{ textTransform: 'capitalize' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {mb.createdAt ? new Date(mb.createdAt).toLocaleDateString() : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={(e) => openMenu(e, mb)}>
                              <MoreVertIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Email Configuration Info */}
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Email Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Incoming Mail Server (IMAP)
                </Typography>
                <Box
                  sx={{
                    bgcolor: '#f5f5f5',
                    p: 2,
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Server: mail.{primaryDomain}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Port: 993 (SSL/TLS)
                  </Typography>
                  <Typography variant="body2">Port: 143 (STARTTLS)</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Outgoing Mail Server (SMTP)
                </Typography>
                <Box
                  sx={{
                    bgcolor: '#f5f5f5',
                    p: 2,
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Server: mail.{primaryDomain}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Port: 465 (SSL/TLS)
                  </Typography>
                  <Typography variant="body2">Port: 587 (STARTTLS)</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2">
              Use your full email address as the username and enable SSL/TLS encryption for secure
              connections.
            </Typography>
          </Alert>
        </Paper>
      </Box>

      {/* ===== Context Menu ===== */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setChangePassword('');
            setPasswordOpen(true);
          }}
        >
          <PasswordIcon sx={{ mr: 1, fontSize: 20 }} />
          Change Password
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditQuota(selectedMailbox?.quotaMb ? String(selectedMailbox.quotaMb) : '');
            setQuotaOpen(true);
          }}
        >
          <SettingsIcon sx={{ mr: 1, fontSize: 20 }} />
          Manage Quota
        </MenuItem>
        <MenuItem onClick={handleWebmail}>
          <OpenInNewIcon sx={{ mr: 1, fontSize: 20 }} />
          Access Webmail
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => setDeleteOpen(true)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete Account
        </MenuItem>
      </Menu>

      {/* ===== Create Account Dialog ===== */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Email Account</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Username"
                placeholder="user"
                value={newLocalPart}
                onChange={(e) => setNewLocalPart(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Domain</InputLabel>
                <Select
                  value={newDomainId}
                  onChange={(e) => setNewDomainId(e.target.value)}
                  label="Domain"
                >
                  {domains.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      @{d.domain}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Quota (MB)"
                type="number"
                value={newQuota}
                onChange={(e) => setNewQuota(e.target.value)}
                size="small"
                helperText="0 = unlimited"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !newLocalPart || !newDomainId || !newPassword}
          >
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Change Password Dialog ===== */}
      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedMailbox?.email}
          </Typography>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={changePassword}
            onChange={(e) => setChangePassword(e.target.value)}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={saving || !changePassword}
          >
            {saving ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Manage Quota Dialog ===== */}
      <Dialog open={quotaOpen} onClose={() => setQuotaOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Manage Quota</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedMailbox?.email}
          </Typography>
          <TextField
            fullWidth
            label="Quota (MB)"
            type="number"
            value={editQuota}
            onChange={(e) => setEditQuota(e.target.value)}
            size="small"
            helperText="Leave empty or 0 for unlimited"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuotaOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateQuota} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Email Account</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 1 }}>
            This will permanently remove{' '}
            <strong>{selectedMailbox?.email}</strong> and all its data. This action cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Snackbar ===== */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
