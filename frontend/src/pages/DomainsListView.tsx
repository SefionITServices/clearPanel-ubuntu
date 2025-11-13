import * as React from 'react';
import {
  Card,
  Button,
  Box,
  Typography,
  Stack,
  InputAdornment,
  TextField,
  Switch,
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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import HomeIcon from '@mui/icons-material/Home';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BuildIcon from '@mui/icons-material/Build';
import EmailIcon from '@mui/icons-material/Email';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import { DashboardLayout } from '../layouts/dashboard/layout';

export default function DomainsListView() {
  const navigate = useNavigate();
  const [domains, setDomains] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [target, setTarget] = React.useState<any | null>(null);
  const [snack, setSnack] = React.useState<{open: boolean; message: string; severity: 'success'|'error'}>({ open: false, message: '', severity: 'success' });
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  // Simpler selection handling removed to avoid undefined size error in footer

  React.useEffect(() => {
    fetch('/api/domains').then(r => r.json()).then((data) => {
      // Mark sefion.cloud as primary and sort it first
      const mapped = data.map((d: any) => ({
        ...d,
        id: d.id,
        isMain: d.name === 'sefion.cloud',
        redirectsTo: 'Not Redirected',
        forceHttps: false,
      })).sort((a: any, b: any) => (a.name === 'sefion.cloud' ? -1 : b.name === 'sefion.cloud' ? 1 : 0));
      setDomains(mapped);
    });
  }, []);

  const refreshDomains = async () => {
    const data = await fetch('/api/domains').then(r => r.json());
    const mapped = data.map((d: any) => ({
      ...d,
      id: d.id,
      isMain: d.name === 'sefion.cloud',
      redirectsTo: 'Not Redirected',
      forceHttps: false,
    })).sort((a: any, b: any) => (a.name === 'sefion.cloud' ? -1 : b.name === 'sefion.cloud' ? 1 : 0));
    setDomains(mapped);
  };

  const askDelete = (row: any) => { setTarget(row); setConfirmOpen(true); };
  const doDelete = async () => {
    if (!target) return;
    setDeletingId(target.id);
    try {
      const response = await fetch(`/api/domains/${target.id}`, { method: 'DELETE' });
      if (response.ok) {
        await refreshDomains();
        setSnack({ open: true, message: `Domain "${target.name}" deleted`, severity: 'success' });
      } else {
        setSnack({ open: true, message: 'Failed to delete domain', severity: 'error' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setSnack({ open: true, message: 'Error deleting domain', severity: 'error' });
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
      setTarget(null);
    }
  };

  const filtered = domains.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Domain',
      flex: 1.2,
      minWidth: 220,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Link href={`http://${params.value}`} target="_blank" underline="hover" sx={{ fontWeight: 600 }}>
            {params.value}
          </Link>
          <OpenInNewIcon fontSize="small" color="action" />
          {params.row.isMain && (
            <Chip label="Main Domain" color="primary" size="small" sx={{ ml: 1, fontWeight: 500 }} />
          )}
        </Stack>
      ),
    },
    {
      field: 'folderPath',
      headerName: 'Document Root',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <HomeIcon fontSize="small" color="action" />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{params.value}</Typography>
        </Stack>
      ),
    },
    {
      field: 'redirectsTo',
      headerName: 'Redirects To',
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'forceHttps',
      headerName: 'Force HTTPS Redirect',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Switch checked={!!params.value} size="small" />
          <Typography variant="caption" color={params.value ? 'primary' : 'text.secondary'}>
            {params.value ? 'on' : 'off'}
          </Typography>
          <IconButton size="small">
            <InfoOutlinedIcon fontSize="small" color="action" />
          </IconButton>
        </Stack>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1.2,
      minWidth: 260,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<BuildIcon />}>
            Manage
          </Button>
          <Button variant="outlined" size="small" startIcon={<EmailIcon />}>
            Create Email
          </Button>
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => askDelete(params.row)}
              title="Delete Domain"
              disabled={deletingId === params.row.id}
            >
              {deletingId === params.row.id ? <CircularProgress size={18} /> : <DeleteIcon />}
            </IconButton>
          </span>
        </Stack>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1300, mx: 'auto', mt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
          Domains
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          List Domains
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use this interface to manage your domains. For more information, read the documentation.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <TextField
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            sx={{ minWidth: 180 }}
            onClick={() => navigate('/domains/new')}
          >
            Create A New Domain
          </Button>
        </Stack>
        <Card sx={{ minHeight: 400, p: 2 }}>
          <DataGrid
            rows={filtered}
            columns={columns}
            disableRowSelectionOnClick
            autoHeight
            pagination
            pageSizeOptions={[5, 10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          />
        </Card>
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Delete Domain</DialogTitle>
          <DialogContent>
            Are you sure you want to delete domain "{target?.name}"? This will remove its DNS zone from clearPanel but keep the folder on disk.
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={doDelete} disabled={!!deletingId}>Delete</Button>
          </DialogActions>
        </Dialog>
        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({...s, open: false}))}>
          <Alert severity={snack.severity} onClose={() => setSnack(s => ({...s, open: false}))}>{snack.message}</Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
