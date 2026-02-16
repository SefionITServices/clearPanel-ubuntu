import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Tooltip,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FilterAlt as FilterIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  Visibility as ViewIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import {
  mailAPI,
  MailDomain,
  MailboxSummary,
  SieveFilterEntry,
  SieveFilterDetail,
} from '../api/mail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlatFilter {
  domainId: string;
  domain: string;
  mailboxId: string;
  email: string;
  filterName: string;
  active: boolean;
}

// Common Sieve filter templates
const SIEVE_TEMPLATES: { label: string; description: string; script: string }[] = [
  {
    label: 'Move to folder',
    description: 'Move emails from a sender to a specific folder',
    script: `require ["fileinto"];
# Move emails from a specific sender into a folder
if address :is "from" "sender@example.com" {
  fileinto "INBOX.Important";
  stop;
}`,
  },
  {
    label: 'Auto-reply (Vacation)',
    description: 'Send automatic out-of-office replies',
    script: `require ["vacation"];
vacation :days 7 :subject "Out of Office"
  "Thank you for your email. I am currently away and will respond when I return.";`,
  },
  {
    label: 'Discard spam',
    description: 'Discard emails with high spam score',
    script: `require ["fileinto", "comparator-i;ascii-numeric"];
# Move emails flagged as spam to Junk folder
if header :contains "X-Spam-Flag" "YES" {
  fileinto "Junk";
  stop;
}`,
  },
  {
    label: 'Forward & keep',
    description: 'Forward a copy to another address while keeping the original',
    script: `require ["copy"];
# Forward a copy to another address
redirect :copy "other@example.com";`,
  },
  {
    label: 'Subject keyword filter',
    description: 'Move emails containing specific keywords in subject',
    script: `require ["fileinto"];
# Move emails containing "[Newsletter]" in subject
if header :contains "subject" "[Newsletter]" {
  fileinto "INBOX.Newsletters";
  stop;
}`,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmailFiltersPage() {
  // ─── state ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<MailDomain[]>([]);
  const [filters, setFilters] = useState<FlatFilter[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [mailboxFilter, setMailboxFilter] = useState('all');
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // ─── create / edit dialog ──────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorDomainId, setEditorDomainId] = useState('');
  const [editorMailboxId, setEditorMailboxId] = useState('');
  const [editorFilterName, setEditorFilterName] = useState('');
  const [editorScript, setEditorScript] = useState('');
  const [editorOriginalName, setEditorOriginalName] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── view dialog ───────────────────────────────────────────────
  const [viewOpen, setViewOpen] = useState(false);
  const [viewScript, setViewScript] = useState('');
  const [viewName, setViewName] = useState('');
  const [viewLoading, setViewLoading] = useState(false);

  // ─── delete dialog ─────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFilter, setDeleteFilter] = useState<FlatFilter | null>(null);

  // ─── data loading ──────────────────────────────────────────────
  const loadDomains = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await mailAPI.listDomains();
      const doms: MailDomain[] = Array.isArray(res) ? res : (res as any).domains ?? [];
      setDomains(doms);
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to load domains', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFilters = useCallback(async () => {
    if (domains.length === 0) return;
    setFiltersLoading(true);
    const flat: FlatFilter[] = [];

    // Load filters for each mailbox across all domains
    const promises: Promise<void>[] = [];
    for (const d of domains) {
      for (const mb of d.mailboxes || []) {
        promises.push(
          mailAPI.listSieveFilters(d.id, mb.id).then((entries) => {
            for (const f of entries) {
              flat.push({
                domainId: d.id,
                domain: d.domain,
                mailboxId: mb.id,
                email: mb.email,
                filterName: f.name,
                active: f.active,
              });
            }
          }).catch(() => {
            // ignore — mailbox may not support sieve
          }),
        );
      }
    }
    await Promise.all(promises);
    setFilters(flat);
    setFiltersLoading(false);
  }, [domains]);

  useEffect(() => { loadDomains(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (domains.length > 0) loadFilters(); }, [domains]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── all mailboxes for select ──────────────────────────────────
  const allMailboxes: { domainId: string; mailboxId: string; email: string; domain: string }[] = [];
  for (const d of domains) {
    for (const mb of d.mailboxes || []) {
      allMailboxes.push({ domainId: d.id, mailboxId: mb.id, email: mb.email, domain: d.domain });
    }
  }

  // ─── filtered list ─────────────────────────────────────────────
  const filtered = filters.filter((f) => {
    if (domainFilter !== 'all' && f.domainId !== domainFilter) return false;
    if (mailboxFilter !== 'all' && f.mailboxId !== mailboxFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.email.toLowerCase().includes(q) || f.filterName.toLowerCase().includes(q);
    }
    return true;
  });

  // ─── handlers ──────────────────────────────────────────────────
  const handleView = async (f: FlatFilter) => {
    setViewName(f.filterName);
    setViewOpen(true);
    setViewLoading(true);
    try {
      const detail = await mailAPI.getSieveFilter(f.domainId, f.mailboxId, f.filterName);
      setViewScript(detail.script);
    } catch (err: any) {
      setViewScript(`Error loading filter: ${err.message}`);
    }
    setViewLoading(false);
  };

  const openCreate = () => {
    setEditorMode('create');
    setEditorDomainId(allMailboxes[0]?.domainId || '');
    setEditorMailboxId(allMailboxes[0]?.mailboxId || '');
    setEditorFilterName('');
    setEditorScript(SIEVE_TEMPLATES[0].script);
    setEditorOriginalName('');
    setEditorOpen(true);
  };

  const openEdit = async (f: FlatFilter) => {
    setEditorMode('edit');
    setEditorDomainId(f.domainId);
    setEditorMailboxId(f.mailboxId);
    setEditorFilterName(f.filterName);
    setEditorOriginalName(f.filterName);
    setEditorScript('');
    setEditorOpen(true);
    try {
      const detail = await mailAPI.getSieveFilter(f.domainId, f.mailboxId, f.filterName);
      setEditorScript(detail.script);
    } catch (err: any) {
      setEditorScript(`# Error loading: ${err.message}`);
    }
  };

  const handleSave = async () => {
    if (!editorDomainId || !editorMailboxId || !editorFilterName.trim() || !editorScript.trim()) return;
    setSaving(true);
    try {
      // If editing and name changed, delete old first
      if (editorMode === 'edit' && editorOriginalName && editorOriginalName !== editorFilterName.trim()) {
        await mailAPI.deleteSieveFilter(editorDomainId, editorMailboxId, editorOriginalName);
      }
      await mailAPI.putSieveFilter(editorDomainId, editorMailboxId, editorFilterName.trim(), editorScript);
      setSnack({ open: true, message: `Filter ${editorMode === 'create' ? 'created' : 'updated'}`, severity: 'success' });
      setEditorOpen(false);
      loadFilters();
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to save filter', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteFilter) return;
    setSaving(true);
    try {
      await mailAPI.deleteSieveFilter(deleteFilter.domainId, deleteFilter.mailboxId, deleteFilter.filterName);
      setSnack({ open: true, message: 'Filter deleted', severity: 'success' });
      setDeleteOpen(false);
      loadFilters();
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to delete filter', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (script: string) => {
    setEditorScript(script);
  };

  // ─── no domains fallback ───────────────────────────────────────
  if (!loading && domains.length === 0) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 8 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            No mail domains configured yet. Create a mail domain and mailbox first before setting up email filters.
          </Alert>
          <Button variant="contained" href="/mail-domains" sx={{ textTransform: 'none' }}>
            Go to Mail Domains
          </Button>
        </Box>
      </DashboardLayout>
    );
  }

  if (!loading && allMailboxes.length === 0) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 8 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            No mailboxes found. Create an email account first before setting up filters.
          </Alert>
          <Button variant="contained" href="/email-accounts" sx={{ textTransform: 'none' }}>
            Go to Email Accounts
          </Button>
        </Box>
      </DashboardLayout>
    );
  }

  // ─── render ────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <FilterIcon sx={{ fontSize: 32, color: '#FF6B35' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Email Filters</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage Sieve email filters for your mailboxes — auto-sort, forward, vacation replies, and more
            </Typography>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#FF6B35' }}>
                  {loading || filtersLoading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : filters.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">Total Filters</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#34A853' }}>
                  {loading || filtersLoading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : filters.filter(f => f.active).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">Active Filters</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#4285F4' }}>
                  {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : allMailboxes.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">Mailboxes</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Toolbar */}
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search filters…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 200, flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Domain</InputLabel>
            <Select
              value={domainFilter}
              label="Domain"
              onChange={(e) => { setDomainFilter(e.target.value); setMailboxFilter('all'); }}
            >
              <MenuItem value="all">All Domains</MenuItem>
              {domains.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.domain}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Mailbox</InputLabel>
            <Select
              value={mailboxFilter}
              label="Mailbox"
              onChange={(e) => setMailboxFilter(e.target.value)}
            >
              <MenuItem value="all">All Mailboxes</MenuItem>
              {allMailboxes
                .filter((mb) => domainFilter === 'all' || mb.domainId === domainFilter)
                .map((mb) => (
                  <MenuItem key={mb.mailboxId} value={mb.mailboxId}>{mb.email}</MenuItem>
                ))}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Refresh">
            <IconButton onClick={() => { loadDomains(true); }} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={allMailboxes.length === 0}
            sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#FF6B35', '&:hover': { bgcolor: '#e55a28' } }}
          >
            Add Filter
          </Button>
        </Paper>

        {/* Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 700 }}>Filter Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Mailbox</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading || filtersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <FilterIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                    <Typography variant="body1" color="text.secondary">
                      {search || domainFilter !== 'all' || mailboxFilter !== 'all'
                        ? 'No filters match your search'
                        : 'No email filters configured yet'}
                    </Typography>
                    {!search && domainFilter === 'all' && mailboxFilter === 'all' && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Click "Add Filter" to create your first Sieve filter
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((f, idx) => (
                  <TableRow key={`${f.domainId}-${f.mailboxId}-${f.filterName}-${idx}`} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <CodeIcon sx={{ fontSize: 16, color: '#666' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {f.filterName}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {f.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={f.domain} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={f.active ? 'Active' : 'Inactive'}
                        size="small"
                        color={f.active ? 'success' : 'default'}
                        variant={f.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View script">
                        <IconButton size="small" onClick={() => handleView(f)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(f)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => { setDeleteFilter(f); setDeleteOpen(true); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ─── View Script Dialog ─── */}
        <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon color="primary" />
            Filter: {viewName}
          </DialogTitle>
          <DialogContent dividers>
            {viewLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: '#1e1e1e',
                  color: '#d4d4d4',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {viewScript}
              </Paper>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => { navigator.clipboard.writeText(viewScript); setSnack({ open: true, message: 'Script copied', severity: 'success' }); }}
              startIcon={<CopyIcon />}
              sx={{ textTransform: 'none' }}
            >
              Copy
            </Button>
            <Button onClick={() => setViewOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* ─── Create / Edit Filter Dialog ─── */}
        <Dialog open={editorOpen} onClose={() => !saving && setEditorOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {editorMode === 'create' ? 'Create Email Filter' : 'Edit Email Filter'}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              {editorMode === 'create' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Mailbox</InputLabel>
                  <Select
                    value={editorMailboxId ? `${editorDomainId}::${editorMailboxId}` : ''}
                    label="Mailbox"
                    onChange={(e) => {
                      const [dId, mId] = (e.target.value as string).split('::');
                      setEditorDomainId(dId);
                      setEditorMailboxId(mId);
                    }}
                  >
                    {allMailboxes.map((mb) => (
                      <MenuItem key={mb.mailboxId} value={`${mb.domainId}::${mb.mailboxId}`}>
                        {mb.email}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {editorMode === 'edit' && (
                <TextField
                  label="Mailbox"
                  value={allMailboxes.find(mb => mb.mailboxId === editorMailboxId)?.email || editorMailboxId}
                  size="small"
                  fullWidth
                  disabled
                />
              )}
              <TextField
                label="Filter name"
                placeholder="e.g. sort-newsletters"
                size="small"
                fullWidth
                value={editorFilterName}
                onChange={(e) => setEditorFilterName(e.target.value)}
                helperText="A descriptive name for this filter (no spaces, use hyphens)"
              />

              {/* Template quick picks (only for create) */}
              {editorMode === 'create' && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Quick Templates</Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                    {SIEVE_TEMPLATES.map((t) => (
                      <Chip
                        key={t.label}
                        label={t.label}
                        size="small"
                        variant="outlined"
                        clickable
                        onClick={() => applyTemplate(t.script)}
                        sx={{ fontSize: '0.75rem' }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              <TextField
                label="Sieve Script"
                multiline
                minRows={10}
                maxRows={20}
                fullWidth
                value={editorScript}
                onChange={(e) => setEditorScript(e.target.value)}
                slotProps={{
                  input: {
                    sx: {
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                    },
                  },
                }}
                helperText="Write your Sieve filter script. Use templates above for common patterns."
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !editorFilterName.trim() || !editorScript.trim() || !editorMailboxId}
              startIcon={saving ? <CircularProgress size={16} /> : editorMode === 'create' ? <AddIcon /> : <EditIcon />}
              sx={{ textTransform: 'none', bgcolor: '#FF6B35', '&:hover': { bgcolor: '#e55a28' } }}
            >
              {saving ? 'Saving…' : editorMode === 'create' ? 'Create Filter' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ─── Delete Confirmation ─── */}
        <Dialog open={deleteOpen} onClose={() => !saving && setDeleteOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Delete Filter</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the filter <strong>{deleteFilter?.filterName}</strong> from{' '}
              <strong>{deleteFilter?.email}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : <DeleteIcon />}
              sx={{ textTransform: 'none' }}
            >
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
