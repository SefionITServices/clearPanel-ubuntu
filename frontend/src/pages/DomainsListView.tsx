import * as React from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  InputAdornment,
  TextField,
  Chip,
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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Menu,
  MenuItem,
  Divider,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import LanguageIcon from '@mui/icons-material/Language';
import DnsIcon from '@mui/icons-material/Dns';
import LockIcon from '@mui/icons-material/Lock';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PublicIcon from '@mui/icons-material/Public';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import EditIcon from '@mui/icons-material/Edit';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import EmailIcon from '@mui/icons-material/Email';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { DashboardLayout } from '../layouts/dashboard/layout';

export default function DomainsListView() {
  const navigate = useNavigate();
  const [domains, setDomains] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [target, setTarget] = React.useState<any | null>(null);
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuDomain, setMenuDomain] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState(0);

  // Edit dialog state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editDomain, setEditDomain] = React.useState<any | null>(null);
  const [editFolderPath, setEditFolderPath] = React.useState('');
  const [editNameservers, setEditNameservers] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/domains').then(r => r.json());
      const mapped = data.map((d: any) => ({
        ...d,
        id: d.id,
        isMain: !!d.isPrimary,
      })).sort((a: any, b: any) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0));
      setDomains(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadDomains(); }, []);

  const askDelete = (row: any) => {
    setTarget(row);
    setConfirmOpen(true);
    handleMenuClose();
  };

  const doDelete = async () => {
    if (!target) return;
    setDeletingId(target.id);
    try {
      const response = await fetch(`/api/domains/${target.id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadDomains();
        setSnack({ open: true, message: `Domain "${target.name}" deleted`, severity: 'success' });
      } else {
        setSnack({ open: true, message: 'Failed to delete domain', severity: 'error' });
      }
    } catch {
      setSnack({ open: true, message: 'Error deleting domain', severity: 'error' });
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
      setTarget(null);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, domain: any) => {
    setAnchorEl(event.currentTarget);
    setMenuDomain(domain);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuDomain(null);
  };

  const openEditDialog = (domain: any) => {
    setEditDomain(domain);
    setEditFolderPath(domain.folderPath || '');
    setEditNameservers(
      Array.isArray(domain.nameservers) ? domain.nameservers.filter(Boolean).join('\n') : ''
    );
    setEditOpen(true);
    handleMenuClose();
  };

  const handleEditSave = async () => {
    if (!editDomain) return;
    setEditSaving(true);
    try {
      const ns = editNameservers
        .split(/\r?\n|,/)
        .map(s => s.trim())
        .filter(Boolean);
      const response = await fetch(`/api/domains/${editDomain.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: editFolderPath,
          nameservers: ns,
        }),
      });
      if (response.ok) {
        setSnack({ open: true, message: `Domain "${editDomain.name}" updated`, severity: 'success' });
        setEditOpen(false);
        setEditDomain(null);
        await loadDomains();
      } else {
        const txt = await response.text();
        setSnack({ open: true, message: `Failed to update: ${txt}`, severity: 'error' });
      }
    } catch (e: any) {
      setSnack({ open: true, message: e.message || 'Error updating domain', severity: 'error' });
    } finally {
      setEditSaving(false);
    }
  };

  const filtered = domains.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const getTypeColor = (domain: any) => {
    if (domain.isPrimary) return '#4285F4';
    if (domains.some((d: any) => d.isPrimary && domain.name.endsWith(`.${d.name}`))) return '#FBBC04';
    return '#34A853';
  };

  const getTypeLabel = (domain: any) => {
    if (domain.isPrimary) return 'primary';
    if (domains.some((d: any) => d.isPrimary && domain.name.endsWith(`.${d.name}`))) return 'subdomain';
    return 'addon';
  };

  const subdomainCount = domains.filter(d =>
    !d.isPrimary && domains.some((p: any) => p.isPrimary && d.name.endsWith(`.${p.name}`))
  ).length;
  const addonCount = domains.filter(d => !d.isPrimary).length - subdomainCount;

  const domainStats = [
    { label: 'Total Domains', value: domains.length, color: '#4285F4', icon: <LanguageIcon /> },
    { label: 'Addon Domains', value: addonCount, color: '#34A853', icon: <AddIcon /> },
    { label: 'Subdomains', value: subdomainCount, color: '#FBBC04', icon: <SubdirectoryArrowRightIcon /> },
    { label: 'Primary', value: domains.filter(d => d.isPrimary).length, color: '#EA4335', icon: <CheckCircleIcon /> },
  ];

  return (
    <DashboardLayout>
      <Box>
        {/* Page Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LanguageIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Domains
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage your hosted domains, subdomains, and DNS settings
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadDomains} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/domains/new')} sx={{ textTransform: 'none' }}>
              Add Domain
            </Button>
          </Stack>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {domainStats.map((stat) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.label}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      bgcolor: `${stat.color}15`,
                      color: stat.color,
                      p: 1.5,
                      borderRadius: 2,
                      display: 'flex',
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Quick Actions */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth variant="outlined" startIcon={<AddIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
                onClick={() => navigate('/domains/new')}
              >
                Add Addon Domain
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth variant="outlined" startIcon={<SubdirectoryArrowRightIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
                onClick={() => navigate('/domains/new?type=subdomain')}
              >
                Create Subdomain
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth variant="outlined" startIcon={<DnsIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
                onClick={() => navigate('/dns')}
              >
                Manage DNS
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth variant="outlined" startIcon={<LockIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
                onClick={() => navigate('/ssl')}
              >
                SSL/TLS
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs + Table */}
        <Paper>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="All Domains" sx={{ textTransform: 'none' }} />
            <Tab label="Redirects" sx={{ textTransform: 'none' }} />
            <Tab label="DNS Zones" sx={{ textTransform: 'none' }} />
            <Tab label="Email Routing" sx={{ textTransform: 'none' }} />
          </Tabs>

          {/* All Domains Tab */}
          {activeTab === 0 && (
            <>
              {/* Search bar */}
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <TextField
                  placeholder="Search domains..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  size="small"
                  sx={{ width: 320 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {filtered.length} domain{filtered.length !== 1 ? 's' : ''} found
                </Typography>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Domain Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Document Root</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>SSL</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                          <CircularProgress size={32} />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading domains...</Typography>
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                          <LanguageIcon sx={{ fontSize: 48, color: '#bdbdbd', mb: 1 }} />
                          <Typography variant="body1" color="text.secondary">
                            {search ? 'No domains match your search' : 'No domains configured yet'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : filtered.map((domain) => (
                      <TableRow key={domain.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PublicIcon sx={{ color: '#4285F4', fontSize: 20 }} />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {domain.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getTypeLabel(domain)}
                            size="small"
                            sx={{
                              bgcolor: `${getTypeColor(domain)}15`,
                              color: getTypeColor(domain),
                              textTransform: 'capitalize',
                              fontWeight: 500,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="active"
                            size="small"
                            color="success"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {domain.folderPath}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label="Enabled" size="small" color="success" variant="outlined" icon={<VpnKeyIcon />} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {domain.createdAt ? new Date(domain.createdAt).toLocaleDateString() : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={(e) => handleMenuClick(e, domain)}>
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* Redirects Tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <ImportExportIcon sx={{ fontSize: 64, color: '#bdbdbd', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No redirects configured
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create redirects to forward traffic from one domain to another
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} sx={{ textTransform: 'none' }}>
                  Add Redirect
                </Button>
              </Box>
            </Box>
          )}

          {/* DNS Zones Tab */}
          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              <List>
                {domains.map((domain, index) => (
                  <Box key={domain.id}>
                    <ListItem>
                      <DnsIcon sx={{ mr: 2, color: '#4285F4' }} />
                      <ListItemText
                        primary={domain.name}
                        secondary="Click to manage DNS records"
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="outlined" size="small" sx={{ textTransform: 'none' }}
                          onClick={() => navigate('/dns')}
                        >
                          Manage Zone
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < domains.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </Box>
          )}

          {/* Email Routing Tab */}
          {activeTab === 3 && (
            <Box sx={{ p: 3 }}>
              <List>
                {domains.map((domain, index) => (
                  <Box key={domain.id}>
                    <ListItem>
                      <EmailIcon sx={{ mr: 2, color: '#4285F4' }} />
                      <ListItemText
                        primary={domain.name}
                        secondary="Configure email routing settings"
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="outlined" size="small" sx={{ textTransform: 'none' }}
                          onClick={() => navigate('/mail-domains')}
                        >
                          Configure
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < domains.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </Box>
          )}
        </Paper>

        {/* Context Menu */}
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={() => menuDomain && openEditDialog(menuDomain)}>
            <EditIcon sx={{ mr: 1.5, fontSize: 20 }} />
            Edit Settings
          </MenuItem>
          <MenuItem onClick={() => { handleMenuClose(); navigate('/dns'); }}>
            <DnsIcon sx={{ mr: 1.5, fontSize: 20 }} />
            Manage DNS
          </MenuItem>
          <MenuItem onClick={() => { handleMenuClose(); navigate('/ssl'); }}>
            <LockIcon sx={{ mr: 1.5, fontSize: 20 }} />
            SSL/TLS
          </MenuItem>
          <MenuItem onClick={() => handleMenuClose()}>
            <ImportExportIcon sx={{ mr: 1.5, fontSize: 20 }} />
            Add Redirect
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => menuDomain && askDelete(menuDomain)} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1.5, fontSize: 20 }} />
            Remove Domain
          </MenuItem>
        </Menu>

        {/* Edit Domain Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>
            Edit Domain: {editDomain?.name}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Domain Name"
                value={editDomain?.name || ''}
                disabled
                fullWidth
                helperText="Domain name cannot be changed after creation"
              />
              <TextField
                label="Document Root"
                value={editFolderPath}
                onChange={(e) => setEditFolderPath(e.target.value)}
                fullWidth
                placeholder="/home/user/public_html/example.com"
                helperText="Full path to the document root directory"
              />
              <TextField
                label="Nameservers"
                value={editNameservers}
                onChange={(e) => setEditNameservers(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                placeholder={'ns1.example.com\nns2.example.com'}
                helperText="One nameserver per line. Leave blank to use VPS defaults."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={handleEditSave} disabled={editSaving} sx={{ textTransform: 'none' }}>
              {editSaving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>Delete Domain</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This action cannot be undone.
            </Alert>
            <Typography variant="body2">
              Are you sure you want to delete <strong>{target?.name}</strong>? This will remove its DNS zone from clearPanel but keep the folder on disk.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button color="error" variant="contained" onClick={doDelete} disabled={!!deletingId} sx={{ textTransform: 'none' }}>
              {deletingId ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.message}</Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
