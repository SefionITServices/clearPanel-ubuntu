import * as React from 'react';
import {
  Card,
  Button,
  Box,
  Typography,
  Stack,
  InputAdornment,
  TextField,
  Chip,
  Link,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  Grid,
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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
import { DashboardLayout } from '../layouts/dashboard/layout';

export default function DomainsListView() {
  const navigate = useNavigate();
  const [domains, setDomains] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [target, setTarget] = React.useState<any | null>(null);
  const [snack, setSnack] = React.useState<{open: boolean; message: string; severity: 'success'|'error'}>({ open: false, message: '', severity: 'success' });
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuDomain, setMenuDomain] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);

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
    } catch (error) {
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

  const filtered = domains.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const domainStats = [
    { label: 'Total Domains', value: domains.length, color: '#4285F4', icon: <LanguageIcon /> },
    { label: 'Primary', value: domains.filter(d => d.isPrimary).length, color: '#34A853', icon: <CheckCircleIcon /> },
    { label: 'Addon Domains', value: domains.filter(d => !d.isPrimary).length, color: '#FBBC04', icon: <SubdirectoryArrowRightIcon /> },
  ];

  return (
    <DashboardLayout>
      <Box>
        {/* Page Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
              Domains
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your hosted domains, subdomains, and DNS settings
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadDomains}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/domains/new')}>
              Add Domain
            </Button>
          </Stack>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {domainStats.map((stat) => (
            <Grid size={{ xs: 12, sm: 4 }} key={stat.label}>
              <Card>
                <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
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
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Search Bar */}
        <Paper sx={{ mb: 3, overflow: 'hidden' }}>
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

          {/* Domain Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Domain Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Document Root</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nameservers</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading domains...</Typography>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <LanguageIcon sx={{ fontSize: 48, color: '#bdbdbd', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        {search ? 'No domains match your search' : 'No domains configured yet'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filtered.map((domain) => (
                  <TableRow key={domain.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <PublicIcon sx={{ color: '#4285F4', fontSize: 22 }} />
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Link
                              href={`http://${domain.name}`}
                              target="_blank"
                              underline="hover"
                              sx={{ fontWeight: 600, fontSize: '0.9rem' }}
                            >
                              {domain.name}
                            </Link>
                            <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          </Box>
                          {domain.isPrimary && (
                            <Chip
                              label="Primary"
                              size="small"
                              sx={{
                                mt: 0.5,
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: '#E8F0FE',
                                color: '#4285F4',
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={domain.isPrimary ? 'primary' : 'addon'}
                        size="small"
                        sx={{
                          bgcolor: domain.isPrimary ? '#E8F0FE' : '#E6F4EA',
                          color: domain.isPrimary ? '#4285F4' : '#34A853',
                          textTransform: 'capitalize',
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'text.secondary' }}>
                        {domain.folderPath}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                        {(Array.isArray(domain.nameservers) ? domain.nameservers.filter(Boolean) : []).length > 0
                          ? domain.nameservers.filter(Boolean).map((ns: string) => (
                              <Chip key={ns} label={ns} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
                            ))
                          : <Typography variant="body2" color="text.secondary">VPS Default</Typography>
                        }
                      </Stack>
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
        </Paper>

        {/* Context Menu */}
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={() => { handleMenuClose(); if (menuDomain) navigate('/dns'); }}>
            <DnsIcon sx={{ mr: 1.5, fontSize: 20 }} />
            Manage DNS
          </MenuItem>
          <MenuItem onClick={() => { handleMenuClose(); navigate('/ssl'); }}>
            <LockIcon sx={{ mr: 1.5, fontSize: 20 }} />
            SSL/TLS
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => menuDomain && askDelete(menuDomain)} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1.5, fontSize: 20 }} />
            Delete Domain
          </MenuItem>
        </Menu>

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
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={doDelete} disabled={!!deletingId}>
              {deletingId ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              Delete
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({...s, open: false}))}>
          <Alert severity={snack.severity} onClose={() => setSnack(s => ({...s, open: false}))}>{snack.message}</Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
