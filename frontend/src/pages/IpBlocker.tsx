import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
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
import BlockIcon from '@mui/icons-material/Block';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { ipBlockerApi } from '../api/ipblocker';
import { domainsApi } from '../api/domains';

interface BlockedIp {
  id: string;
  domain: string;
  ip: string;
  note: string;
  createdAt: string;
}

interface DomainInfo {
  id: string;
  name: string;
}

export default function IpBlockerPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<BlockedIp[]>([]);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [filterDomain, setFilterDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [ip, setIp] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eData, dData] = await Promise.all([
        ipBlockerApi.list(filterDomain || undefined),
        domainsApi.list(),
      ]);
      setEntries(eData.entries ?? []);
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
      await ipBlockerApi.create({ domain, ip, note: note || undefined });
      setSuccess(`${ip} blocked for ${domain}`);
      setAddOpen(false);
      setIp(''); setNote(''); setDomain('');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ipBlockerApi.remove(id);
      setSuccess('IP block removed');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const domainList: string[] = Array.isArray(domains)
    ? domains.map((d: any) => d.name ?? d)
    : [];

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={3}>
          <BlockIcon color="error" sx={{ fontSize: 32 }} />
          <Box flex={1}>
            <Typography variant="h5" fontWeight={700}>IP Blocker</Typography>
            <Typography variant="body2" color="text.secondary">
              Block specific IP addresses or CIDR ranges per domain via Nginx
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
          <Button variant="contained" color="error" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Block IP
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Card>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
            ) : entries.length === 0 ? (
              <Box p={4} textAlign="center">
                <Typography color="text.secondary">No IPs blocked yet.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Domain</TableCell>
                      <TableCell>IP / CIDR</TableCell>
                      <TableCell>Note</TableCell>
                      <TableCell>Added</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id} hover>
                        <TableCell>{e.domain}</TableCell>
                        <TableCell><code>{e.ip}</code></TableCell>
                        <TableCell>{e.note || '-'}</TableCell>
                        <TableCell>{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Unblock">
                            <IconButton size="small" color="error" onClick={() => handleDelete(e.id)}>
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
        <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Block an IP Address</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <FormControl fullWidth size="small">
                <InputLabel>Domain</InputLabel>
                <Select value={domain} label="Domain" onChange={(e) => setDomain(e.target.value)}>
                  {domainList.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="IP address or CIDR"
                placeholder="192.168.1.1 or 10.0.0.0/8"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                size="small"
              />
              <TextField
                label="Note (optional)"
                placeholder="Reason for blocking"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                size="small"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={!domain || !ip || saving}
              onClick={handleAdd}
            >
              {saving ? 'Blocking…' : 'Block IP'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess(null)} message={success} />
      </Box>
    </DashboardLayout>
  );
}
