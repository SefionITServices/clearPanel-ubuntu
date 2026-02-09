import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, TextField, MenuItem, Button, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
  Paper, Chip, Alert, Tabs, Tab, TableContainer, Grid, FormControl, InputLabel, Select,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import DnsIcon from '@mui/icons-material/Dns';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import { DashboardLayout } from '../layouts/dashboard/layout';

interface DnsRecord { id: string; type: string; name: string; value: string; ttl: number; priority?: number; }
interface Zone { domain: string; records: DnsRecord[]; }

const RECORD_TYPE_COLORS: Record<string, string> = {
  A: '#4285F4', AAAA: '#0F9D58', CNAME: '#F4B400', MX: '#DB4437',
  TXT: '#AB47BC', NS: '#00ACC1', SRV: '#FF7043', CAA: '#8E24AA',
};

const RECORD_TYPES = [
  { value: 'A', label: 'A - IPv4 Address' },
  { value: 'AAAA', label: 'AAAA - IPv6 Address' },
  { value: 'CNAME', label: 'CNAME - Canonical Name' },
  { value: 'MX', label: 'MX - Mail Exchange' },
  { value: 'TXT', label: 'TXT - Text Record' },
  { value: 'NS', label: 'NS - Name Server' },
  { value: 'SRV', label: 'SRV - Service' },
];

const TTL_PRESETS = [
  { value: 300, label: '5 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 14400, label: '4 hours' },
  { value: 43200, label: '12 hours' },
  { value: 86400, label: '24 hours' },
];

function formatTTL(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
}

export default function DnsEditorPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [zone, setZone] = useState<Zone | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({ type: 'A', name: '', value: '', ttl: 14400, priority: '' });
  const [dirty, setDirty] = useState<Record<string, Partial<DnsRecord>>>({});
  const [domainsList, setDomainsList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  const loadZones = async () => {
    try {
      const [zonesRes, domainsRes] = await Promise.all([
        fetch('/api/dns/zones'),
        fetch('/api/domains')
      ]);
      if (!zonesRes.ok) return;
      const [zonesData, domainsData] = await Promise.all([zonesRes.json(), domainsRes.ok ? domainsRes.json() : Promise.resolve([])]);
      setDomainsList(domainsData || []);
      const domainNames: string[] = (domainsData || []).map((d: any) => d.name);
      const filtered = (zonesData || []).filter((z: any) => domainNames.includes(z.domain));
      setZones(filtered);
      if (!selectedDomain) {
        const preferred = filtered.find((z: any) => {
          const match = (domainsData || []).find((d: any) => d.name === z.domain);
          return match?.isPrimary;
        }) || filtered[0];
        if (preferred) setSelectedDomain(preferred.domain);
      }
    } catch (err) { console.error(err); }
  };
  useEffect(() => { loadZones(); }, []);

  useEffect(() => {
    if (selectedDomain) {
      fetch(`/api/dns/zones/${selectedDomain}`).then(r => r.json()).then(setZone);
    }
  }, [selectedDomain]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/dns/zones/${selectedDomain}/records/${id}`, { method: 'DELETE' });
    fetch(`/api/dns/zones/${selectedDomain}`).then(r => r.json()).then(setZone);
  };

  const markDirty = (id: string, patch: Partial<DnsRecord>) => {
    setDirty(d => ({ ...d, [id]: { ...d[id], ...patch } }));
    setZone(z => z ? { ...z, records: z.records.map(r => r.id === id ? { ...r, ...patch } : r) } : z);
  };

  const handleSave = async (id: string) => {
    if (!dirty[id]) return;
    const patch = dirty[id];
    if (patch.ttl && (patch.ttl < 60 || patch.ttl > 86400)) { alert('TTL must be between 60 and 86400'); return; }
    await fetch(`/api/dns/zones/${selectedDomain}/records/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    setDirty(d => { const copy = { ...d }; delete copy[id]; return copy; });
    fetch(`/api/dns/zones/${selectedDomain}`).then(r => r.json()).then(setZone);
  };

  const handleAdd = async () => {
    const payload: any = { type: form.type, name: form.name, value: form.value, ttl: form.ttl };
    if (form.type === 'MX' && form.priority) payload.priority = Number(form.priority);
    await fetch(`/api/dns/zones/${selectedDomain}/records`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    setOpenAdd(false);
    setForm({ type: 'A', name: '', value: '', ttl: 14400, priority: '' });
    fetch(`/api/dns/zones/${selectedDomain}`).then(r => r.json()).then(setZone);
  };

  const TAB_TYPES = ['All', 'A', 'MX', 'CNAME', 'TXT', 'NS'];
  const filteredRecords = zone?.records.filter(r => {
    if (activeTab === 0) return true;
    return r.type === TAB_TYPES[activeTab];
  }) || [];

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <DnsIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                DNS Zone Editor
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage DNS records for your domains
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenAdd(true)}
              disabled={!selectedDomain}
            >
              Add Record
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => selectedDomain && fetch(`/api/dns/zones/${selectedDomain}`).then(r => r.json()).then(setZone)}
              disabled={!selectedDomain}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        {/* Info Alert */}
        <Alert severity="info" icon={<WarningIcon />} sx={{ mb: 3 }}>
          DNS changes may take up to 24-48 hours to propagate worldwide. Be careful when editing DNS records as incorrect values can make your website or email inaccessible.
        </Alert>

        {/* Domain Selector */}
        <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            select
            label="Domain"
            value={selectedDomain}
            onChange={e => { setSelectedDomain(e.target.value); setActiveTab(0); }}
            sx={{ minWidth: 280 }}
            size="small"
          >
            {zones.map(z => <MenuItem key={z.domain} value={z.domain}>{z.domain}</MenuItem>)}
          </TextField>
          {selectedDomain && domainsList.find(d => d.name === selectedDomain && d.isPrimary) && (
            <Chip label="Primary Domain" size="small" sx={{ bgcolor: '#E8F0FE', color: '#4285F4', fontWeight: 600 }} />
          )}
        </Paper>

        {/* Records Table */}
        <Paper sx={{ overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            {TAB_TYPES.map((t, i) => (
              <Tab key={t} label={i === 0 ? 'All Records' : `${t} Records`} sx={{ textTransform: 'none', fontWeight: 500 }} />
            ))}
          </Tabs>

          <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="body2" color="text.secondary">
              {filteredRecords.length} DNS record{filteredRecords.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>TTL</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Chip
                        label={r.type}
                        size="small"
                        sx={{
                          bgcolor: `${RECORD_TYPE_COLORS[r.type] || '#757575'}15`,
                          color: RECORD_TYPE_COLORS[r.type] || '#757575',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          minWidth: 56,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={r.name}
                        onChange={e => markDirty(r.id, { name: e.target.value })}
                        sx={{ minWidth: 120, '& input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={r.value}
                        onChange={e => markDirty(r.id, { value: e.target.value })}
                        sx={{ minWidth: 200, '& input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={formatTTL(r.ttl)}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: 'monospace', cursor: 'pointer' }}
                        onClick={() => {
                          const newTTL = prompt('Enter TTL (60-86400):', String(r.ttl));
                          if (newTTL && !isNaN(Number(newTTL))) markDirty(r.id, { ttl: Number(newTTL) });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {r.type === 'MX' ? (
                        <TextField
                          variant="standard"
                          type="number"
                          value={r.priority ?? ''}
                          onChange={e => markDirty(r.id, { priority: Number(e.target.value) })}
                          sx={{ width: 60, '& input': { fontFamily: 'monospace' } }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={dirty[r.id] ? 'Save changes' : 'No changes'}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleSave(r.id)}
                            disabled={!dirty[r.id]}
                            sx={{ color: dirty[r.id] ? 'primary.main' : undefined }}
                          >
                            <SaveIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(r.id)} sx={{ color: 'error.main' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <DnsIcon sx={{ fontSize: 48, color: '#bdbdbd', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        {zone ? 'No records found' : 'Select a domain to view DNS records'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Quick Tips */}
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Quick Tips</Typography>
          <Grid container spacing={2}>
            {[
              { label: 'A Record', desc: 'Maps domain to IPv4 address', color: '#4285F4' },
              { label: 'CNAME', desc: 'Alias for another domain', color: '#F4B400' },
              { label: 'MX Record', desc: 'Mail server for your domain', color: '#DB4437' },
              { label: 'TXT Record', desc: 'SPF, DKIM, verification', color: '#AB47BC' },
            ].map(tip => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={tip.label}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={tip.label} size="small" sx={{ bgcolor: `${tip.color}15`, color: tip.color, fontWeight: 600 }} />
                  <Typography variant="caption" color="text.secondary">{tip.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Box>

      {/* Add Record Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DnsIcon sx={{ color: '#4285F4' }} />
          Add DNS Record
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3, mt: 1 }}>
            DNS changes may take 24-48 hours to propagate.
          </Alert>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel>Record Type</InputLabel>
              <Select
                value={form.type}
                onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                label="Record Type"
              >
                {RECORD_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={selectedDomain}
              helperText="Enter the subdomain or @ for root domain"
              fullWidth
            />
            <TextField
              label="Value"
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              placeholder={form.type === 'A' ? '192.168.1.1' : form.type === 'CNAME' ? 'example.com' : 'Value'}
              helperText={`Enter the ${form.type} record value`}
              fullWidth
              multiline={form.type === 'TXT'}
              rows={form.type === 'TXT' ? 3 : 1}
            />
            <FormControl fullWidth>
              <InputLabel>TTL (Time To Live)</InputLabel>
              <Select
                value={form.ttl}
                onChange={(e) => setForm(f => ({ ...f, ttl: Number(e.target.value) }))}
                label="TTL (Time To Live)"
              >
                {TTL_PRESETS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </Select>
            </FormControl>
            {(form.type === 'MX' || form.type === 'SRV') && (
              <TextField
                label="Priority"
                type="number"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                helperText="Lower values have higher priority"
                fullWidth
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.type || !form.name || !form.value} onClick={handleAdd}>
            Add Record
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
