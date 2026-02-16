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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ForwardToInbox as ForwardToInboxIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import {
  mailAPI,
  MailDomain,
  MailAliasSummary,
} from '../api/mail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlatAlias {
  domainId: string;
  domain: string;
  aliasId: string;
  source: string;
  destination: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForwardersPage() {
  // ─── state ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<MailDomain[]>([]);
  const [aliases, setAliases] = useState<FlatAlias[]>([]);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createDomain, setCreateDomain] = useState('');
  const [createSource, setCreateSource] = useState('');
  const [createDest, setCreateDest] = useState('');
  const [saving, setSaving] = useState(false);

  // edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editAlias, setEditAlias] = useState<FlatAlias | null>(null);
  const [editDest, setEditDest] = useState('');

  // delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAlias, setDeleteAlias] = useState<FlatAlias | null>(null);

  // ─── data loading ──────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await mailAPI.listDomains();
      const doms: MailDomain[] = Array.isArray(res) ? res : (res as any).domains ?? [];
      setDomains(doms);

      const flat: FlatAlias[] = [];
      for (const d of doms) {
        for (const a of d.aliases || []) {
          flat.push({
            domainId: d.id,
            domain: d.domain,
            aliasId: a.id,
            source: a.source,
            destination: a.destination,
            createdAt: a.createdAt,
          });
        }
      }
      setAliases(flat);

      // set default domain for create dialog if needed
      if (!createDomain && doms.length > 0) {
        setCreateDomain(doms[0].id);
      }
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to load forwarders', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [createDomain]);

  useEffect(() => { loadData(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Filtered list ─────────────────────────────────────────────
  const filtered = aliases.filter((a) => {
    if (domainFilter !== 'all' && a.domainId !== domainFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.source.toLowerCase().includes(q) || a.destination.toLowerCase().includes(q);
    }
    return true;
  });

  // ─── handlers ──────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createDomain || !createSource.trim() || !createDest.trim()) return;
    setSaving(true);
    try {
      await mailAPI.addAlias(createDomain, {
        source: createSource.trim(),
        destination: createDest.trim(),
      });
      setSnack({ open: true, message: 'Forwarder created', severity: 'success' });
      setCreateOpen(false);
      setCreateSource('');
      setCreateDest('');
      loadData(true);
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to create forwarder', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editAlias || !editDest.trim()) return;
    setSaving(true);
    try {
      await mailAPI.updateAlias(editAlias.domainId, editAlias.aliasId, {
        destination: editDest.trim(),
      });
      setSnack({ open: true, message: 'Forwarder updated', severity: 'success' });
      setEditOpen(false);
      loadData(true);
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to update forwarder', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAlias) return;
    setSaving(true);
    try {
      await mailAPI.removeAlias(deleteAlias.domainId, deleteAlias.aliasId);
      setSnack({ open: true, message: 'Forwarder deleted', severity: 'success' });
      setDeleteOpen(false);
      loadData(true);
    } catch (err: any) {
      setSnack({ open: true, message: err.message || 'Failed to delete forwarder', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (a: FlatAlias) => {
    setEditAlias(a);
    setEditDest(a.destination);
    setEditOpen(true);
  };

  const openDelete = (a: FlatAlias) => {
    setDeleteAlias(a);
    setDeleteOpen(true);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
    });
  };

  // ─── no domains fallback ───────────────────────────────────────
  if (!loading && domains.length === 0) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 8 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            No mail domains configured yet. Create a mail domain first before setting up forwarders.
          </Alert>
          <Button variant="contained" href="/mail-domains" sx={{ textTransform: 'none' }}>
            Go to Mail Domains
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
          <ForwardToInboxIcon sx={{ fontSize: 32, color: '#4285F4' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Email Forwarders</Typography>
            <Typography variant="body2" color="text.secondary">
              Forward emails from one address to another across all your domains
            </Typography>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#4285F4' }}>
                  {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : aliases.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">Total Forwarders</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#34A853' }}>
                  {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : domains.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">Mail Domains</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#F4B400' }}>
                  {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : filtered.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">Showing</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Toolbar */}
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search forwarders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 220, flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Domain</InputLabel>
            <Select
              value={domainFilter}
              label="Domain"
              onChange={(e) => setDomainFilter(e.target.value)}
            >
              <MenuItem value="all">All Domains</MenuItem>
              {domains.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.domain}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Refresh">
            <IconButton onClick={() => loadData(true)} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add Forwarder
          </Button>
        </Paper>

        {/* Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Forwards To</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
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
                    <ForwardToInboxIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                    <Typography variant="body1" color="text.secondary">
                      {search || domainFilter !== 'all' ? 'No forwarders match your filters' : 'No forwarders configured yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={`${a.domainId}-${a.aliasId}`} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <EmailIcon sx={{ fontSize: 16, color: '#666' }} />
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {a.source}
                        </Typography>
                        <Tooltip title="Copy">
                          <IconButton size="small" onClick={() => copyText(a.source)} sx={{ opacity: 0.5 }}>
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {a.destination}
                        </Typography>
                        <Tooltip title="Copy">
                          <IconButton size="small" onClick={() => copyText(a.destination)} sx={{ opacity: 0.5 }}>
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={a.domain} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{formatDate(a.createdAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit destination">
                        <IconButton size="small" onClick={() => openEdit(a)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => openDelete(a)}>
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

        {/* ─── Create Dialog ─── */}
        <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Add Forwarder</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Domain</InputLabel>
                <Select
                  value={createDomain}
                  label="Domain"
                  onChange={(e) => setCreateDomain(e.target.value)}
                >
                  {domains.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.domain}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Source address"
                placeholder="e.g. info@domain.com or info"
                size="small"
                fullWidth
                value={createSource}
                onChange={(e) => setCreateSource(e.target.value)}
                helperText="The address that will be forwarded. You can enter just the local part (e.g. info) and the domain will be appended automatically."
              />
              <TextField
                label="Forward to"
                placeholder="e.g. user@gmail.com"
                size="small"
                fullWidth
                value={createDest}
                onChange={(e) => setCreateDest(e.target.value)}
                helperText="The destination email address that will receive the forwarded emails."
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={saving || !createSource.trim() || !createDest.trim() || !createDomain}
              startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
              sx={{ textTransform: 'none' }}
            >
              {saving ? 'Creating…' : 'Create Forwarder'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ─── Edit Dialog ─── */}
        <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Edit Forwarder</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Source"
                value={editAlias?.source || ''}
                size="small"
                fullWidth
                disabled
              />
              <TextField
                label="Forward to"
                value={editDest}
                onChange={(e) => setEditDest(e.target.value)}
                size="small"
                fullWidth
                autoFocus
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleEdit}
              disabled={saving || !editDest.trim()}
              startIcon={saving ? <CircularProgress size={16} /> : <EditIcon />}
              sx={{ textTransform: 'none' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ─── Delete Confirmation ─── */}
        <Dialog open={deleteOpen} onClose={() => !saving && setDeleteOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Delete Forwarder</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the forwarder{' '}
              <strong>{deleteAlias?.source}</strong> → <strong>{deleteAlias?.destination}</strong>?
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
