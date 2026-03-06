import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  TextField,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Chip,
  Tooltip,
  FormControl,
  FormLabel,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import LanguageIcon from '@mui/icons-material/Language';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { useAuth } from '../auth/AuthContext';
import { subdomainsApi, SubdomainRecord } from '../api/subdomains';
import { domainsApi } from '../api/domains';

const PHP_VERSIONS = ['Default', '7.4', '8.0', '8.1', '8.2', '8.3', '8.4'];

export default function SubdomainsPage() {
  const navigate = useNavigate();
  const { username } = useAuth();

  // Data
  const [subdomains, setSubdomains] = useState<SubdomainRecord[]>([]);
  const [parentDomains, setParentDomains] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [selectedParent, setSelectedParent] = useState('');
  const [pathMode, setPathMode] = useState<'public_html' | 'root' | 'websites' | 'custom'>('public_html');
  const [customPath, setCustomPath] = useState('');
  const [phpVersion, setPhpVersion] = useState('Default');
  const [creating, setCreating] = useState(false);
  const [createLogs, setCreateLogs] = useState<{ task: string; success: boolean; message: string }[]>([]);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<SubdomainRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [subs, domains] = await Promise.all([
        subdomainsApi.list(),
        domainsApi.list(),
      ]);
      setSubdomains(subs);

      // Parent domains are domains that are NOT subdomains of another domain
      const subNames = new Set(subs.map((s: SubdomainRecord) => s.name));
      const parents = (domains as { id: string; name: string }[]).filter(
        (d) => !subNames.has(d.name),
      );
      setParentDomains(parents);
      if (parents.length > 0 && !selectedParent) {
        setSelectedParent(parents[0].name);
      }
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: 'Failed to load subdomains', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = subdomains.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.parentDomain.toLowerCase().includes(search.toLowerCase()),
  );

  /* ---- Create ---- */
  const openCreate = () => {
    setPrefix('');
    setCustomPath('');
    setPathMode('public_html');
    setPhpVersion('Default');
    setCreateLogs([]);
    if (parentDomains.length > 0) setSelectedParent(parentDomains[0].name);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!prefix.trim()) return;
    if (!selectedParent) return;
    setCreating(true);
    setCreateLogs([]);
    try {
      const payload: Parameters<typeof subdomainsApi.create>[0] = {
        prefix: prefix.trim(),
        parentDomain: selectedParent,
        phpVersion: phpVersion === 'Default' ? undefined : phpVersion,
      };
      if (pathMode === 'custom') {
        payload.folderPath = customPath.trim() || undefined;
      } else {
        payload.pathMode = pathMode;
      }
      const res = await subdomainsApi.create(payload);
      setCreateLogs(res.automationLogs || []);
      setSnack({
        open: true,
        message: `Subdomain ${prefix.trim()}.${selectedParent} created successfully`,
        severity: 'success',
      });
      await load();
    } catch (e: any) {
      setSnack({ open: true, message: e.message || 'Failed to create subdomain', severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateLogs([]);
  };

  /* ---- Delete ---- */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await subdomainsApi.delete(deleteTarget.id);
      setSubdomains((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setSnack({ open: true, message: `Subdomain "${deleteTarget.name}" deleted`, severity: 'success' });
    } catch (e: any) {
      setSnack({ open: true, message: e.message || 'Failed to delete subdomain', severity: 'error' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  /* ---- Stats ---- */
  const uniqueParents = new Set(subdomains.map((s) => s.parentDomain)).size;

  const stats = [
    {
      label: 'Total Subdomains',
      value: subdomains.length,
      color: '#4285F4',
      icon: <SubdirectoryArrowRightIcon />,
    },
    {
      label: 'Parent Domains',
      value: uniqueParents,
      color: '#34A853',
      icon: <LanguageIcon />,
    },
    {
      label: 'Available Parent Domains',
      value: parentDomains.length,
      color: '#FBBC04',
      icon: <LanguageIcon />,
    },
  ];

  /* ---- Utils ---- */
  const fullPreview = prefix.trim() && selectedParent
    ? `${prefix.trim().toLowerCase()}.${selectedParent}`
    : '';

  const pathPreview = (() => {
    if (!fullPreview) return '';
    if (pathMode === 'public_html') return `~/public_html/${fullPreview}`;
    if (pathMode === 'root') return `~/${fullPreview}`;
    if (pathMode === 'websites') return `/home/${username || 'clearpanel'}/websites/${fullPreview}`;
    if (pathMode === 'custom') return customPath.trim() || '(enter path below)';
    return '';
  })();

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
  };

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SubdirectoryArrowRightIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Subdomain Manager
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Create and manage subdomains for your hosted domains
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/domains')}
              sx={{ textTransform: 'none' }}
            >
              View Domains
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{ textTransform: 'none' }}
              disabled={parentDomains.length === 0}
            >
              Add Subdomain
            </Button>
          </Stack>
        </Box>

        {/* Warning when no parent domains */}
        {!loading && parentDomains.length === 0 && (
          <Alert severity="info" sx={{ mb: 3 }} action={
            <Button size="small" onClick={() => navigate('/domains/new')}>Add Domain</Button>
          }>
            No domains available to create subdomains for. Add a domain first.
          </Alert>
        )}

        {/* Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {stats.map((stat) => (
            <Grid size={{ xs: 12, sm: 4 }} key={stat.label}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ bgcolor: `${stat.color}15`, color: stat.color, p: 1.5, borderRadius: 2, display: 'flex' }}>
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>{stat.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Table */}
        <Paper>
          {/* Toolbar */}
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <TextField
              placeholder="Search subdomains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ width: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {filtered.length} subdomain{filtered.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Subdomain</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Parent Domain</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Document Root</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>PHP Version</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Loading subdomains…
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <SubdirectoryArrowRightIcon sx={{ fontSize: 48, color: '#bdbdbd', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        {search ? 'No subdomains match your search' : 'No subdomains configured yet'}
                      </Typography>
                      {!search && parentDomains.length > 0 && (
                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={openCreate}
                          sx={{ mt: 2, textTransform: 'none' }}
                        >
                          Create your first subdomain
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((sub) => (
                    <TableRow key={sub.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SubdirectoryArrowRightIcon sx={{ fontSize: 16, color: '#4285F4' }} />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {sub.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sub.parentDomain}
                          size="small"
                          icon={<LanguageIcon />}
                          sx={{ bgcolor: '#4285F415', color: '#4285F4', fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={sub.folderPath}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 260 }}>
                            <FolderIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {sub.folderPath}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {sub.phpVersion ?? 'Default'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(sub.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Delete subdomain">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(sub)}
                          >
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
        </Paper>
      </Box>

      {/* ---- Create Dialog ---- */}
      <Dialog open={createOpen} onClose={creating ? undefined : closeCreate} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SubdirectoryArrowRightIcon sx={{ color: '#4285F4' }} />
            New Subdomain
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {/* Subdomain prefix + parent */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Subdomain Name
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  label="Prefix"
                  placeholder="e.g. blog, dev, api"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
                  size="small"
                  sx={{ flex: 1 }}
                  disabled={creating}
                />
                <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>.</Typography>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Parent Domain</InputLabel>
                  <Select
                    value={selectedParent}
                    label="Parent Domain"
                    onChange={(e) => setSelectedParent(e.target.value)}
                    disabled={creating}
                  >
                    {parentDomains.map((d) => (
                      <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              {fullPreview && (
                <Box sx={{ mt: 1, p: 1, bgcolor: '#4285F408', borderRadius: 1, border: '1px solid #4285F420' }}>
                  <Typography variant="body2" sx={{ color: '#4285F4', fontWeight: 500 }}>
                    Full subdomain: <strong>{fullPreview}</strong>
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Document Root / Path Mode */}
            <Box>
              <FormControl component="fieldset" fullWidth disabled={creating}>
                <FormLabel component="legend" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>
                  Document Root
                </FormLabel>
                <RadioGroup
                  value={pathMode}
                  onChange={(e) => setPathMode(e.target.value as any)}
                >
                  <FormControlLabel
                    value="public_html"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>~/public_html/{fullPreview || '<subdomain>'}</Typography>
                        <Typography variant="caption" color="text.secondary">Inside public_html (recommended)</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="root"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>~/{fullPreview || '<subdomain>'}</Typography>
                        <Typography variant="caption" color="text.secondary">Directly in home directory</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="websites"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>/home/{username || 'clearpanel'}/websites/{fullPreview || '<subdomain>'}</Typography>
                        <Typography variant="caption" color="text.secondary">Websites folder</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="custom"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>Custom path</Typography>
                        <Typography variant="caption" color="text.secondary">Specify your own document root</Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
              {pathMode === 'custom' && (
                <TextField
                  label="Custom document root"
                  placeholder="/var/www/html/example"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={creating}
                  sx={{ mt: 1 }}
                />
              )}
              {pathPreview && pathMode !== 'custom' && (
                <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Path: <code>{pathPreview}</code>
                  </Typography>
                </Box>
              )}
            </Box>

            {/* PHP Version */}
            <FormControl size="small" fullWidth>
              <InputLabel>PHP Version</InputLabel>
              <Select
                value={phpVersion}
                label="PHP Version"
                onChange={(e) => setPhpVersion(e.target.value)}
                disabled={creating}
              >
                {PHP_VERSIONS.map((v) => (
                  <MenuItem key={v} value={v}>{v === 'Default' ? 'Default (system PHP)' : `PHP ${v}`}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Automation logs after creation */}
            {createLogs.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Setup Log
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 200, overflowY: 'auto' }}>
                  <Stack spacing={0.5}>
                    {createLogs.map((log, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: log.success ? '#34A853' : '#EA4335',
                            minWidth: 12,
                          }}
                        >
                          {log.success ? '✔' : '✘'}
                        </Typography>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{log.task}: </Typography>
                          <Typography variant="caption" color="text.secondary">{log.message}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeCreate} disabled={creating} sx={{ textTransform: 'none' }}>
            {createLogs.length > 0 ? 'Close' : 'Cancel'}
          </Button>
          {createLogs.length === 0 && (
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={creating || !prefix.trim() || !selectedParent}
              startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              sx={{ textTransform: 'none' }}
            >
              {creating ? 'Creating…' : 'Create Subdomain'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ---- Delete Confirmation ---- */}
      <Dialog open={!!deleteTarget} onClose={deleting ? undefined : () => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Subdomain</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete{' '}
            <strong>{deleteTarget?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will remove the Nginx virtual host, DNS records, and mail domain configuration.
            The document root folder will not be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
