import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { redirectsApi } from '../api/redirects';
import { domainsApi } from '../api/domains';

interface Redirect {
  id: string;
  domain: string;
  from: string;
  to: string;
  type: '301' | '302';
  wildcard: boolean;
  createdAt: string;
}

interface DomainInfo {
  id: string;
  name: string;
}

export default function RedirectsPage() {
  const [loading, setLoading] = useState(true);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [filterDomain, setFilterDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [from, setFrom] = useState('/');
  const [to, setTo] = useState('');
  const [type, setType] = useState<'301' | '302'>('301');
  const [wildcard, setWildcard] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rData, dData] = await Promise.all([
        redirectsApi.list(filterDomain || undefined),
        domainsApi.list(),
      ]);
      setRedirects(rData.redirects ?? []);
      setDomains(dData.domains ?? dData ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterDomain]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await redirectsApi.create({ domain, from, to, type, wildcard });
      setSuccess('Redirect created');
      setAddOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await redirectsApi.remove(id);
      setSuccess('Redirect removed');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const resetForm = () => {
    setDomain('');
    setFrom('/');
    setTo('');
    setType('301');
    setWildcard(false);
  };

  const domainList: string[] = Array.isArray(domains)
    ? domains.map((d: any) => d.name ?? d)
    : [];

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" mb={3}>
          <AltRouteIcon color="primary" sx={{ fontSize: 32 }} />
          <Box flex={1}>
            <Typography variant="h5" fontWeight={700}>Redirect Manager</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage 301/302 URL redirects via Nginx
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filter by domain</InputLabel>
            <Select
              value={filterDomain}
              label="Filter by domain"
              onChange={(e) => setFilterDomain(e.target.value)}
            >
              <MenuItem value="">All domains</MenuItem>
              {domainList.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Add Redirect
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Card>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
            ) : redirects.length === 0 ? (
              <Box p={4} textAlign="center">
                <Typography color="text.secondary">No redirects configured yet.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Domain</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Wildcard</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {redirects.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>{r.domain}</TableCell>
                        <TableCell><code>{r.from}</code></TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.to}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={r.type}
                            size="small"
                            color={r.type === '301' ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{r.wildcard ? 'Yes' : 'No'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Add Dialog */}
        <Dialog open={addOpen} onClose={() => { setAddOpen(false); resetForm(); }} maxWidth="sm" fullWidth>
          <DialogTitle>Add Redirect</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <FormControl fullWidth size="small">
                <InputLabel>Domain</InputLabel>
                <Select value={domain} label="Domain" onChange={(e) => setDomain(e.target.value)}>
                  {domainList.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="From path"
                placeholder="/old-page"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                size="small"
                helperText="Source URL path (must start with /)"
              />
              <TextField
                label="Redirect to"
                placeholder="https://example.com/new-page"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                size="small"
                helperText="Destination URL"
              />
              <FormControl fullWidth size="small">
                <InputLabel>Redirect type</InputLabel>
                <Select value={type} label="Redirect type" onChange={(e) => setType(e.target.value as any)}>
                  <MenuItem value="301">301 — Permanent</MenuItem>
                  <MenuItem value="302">302 — Temporary</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Switch checked={wildcard} onChange={(e) => setWildcard(e.target.checked)} />}
                label="Wildcard — append $request_uri to destination"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!domain || !from || !to || saving}
              onClick={handleAdd}
            >
              {saving ? 'Saving…' : 'Add Redirect'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!success}
          autoHideDuration={3000}
          onClose={() => setSuccess(null)}
          message={success}
        />
      </Box>
    </DashboardLayout>
  );
}
