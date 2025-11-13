import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, TextField, MenuItem, Button, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { DashboardLayout } from '../layouts/dashboard/layout';

interface DnsRecord { id: string; type: string; name: string; value: string; ttl: number; priority?: number; }
interface Zone { domain: string; records: DnsRecord[]; }

export default function DnsEditorPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [zone, setZone] = useState<Zone | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({ type: 'A', name: '', value: '', ttl: 3600, priority: '' });
  const [dirty, setDirty] = useState<Record<string, Partial<DnsRecord>>>({});

  const loadZones = async () => {
    try {
      const [zonesRes, domainsRes] = await Promise.all([
        fetch('/api/dns/zones'),
        fetch('/api/domains')
      ]);
      if (!zonesRes.ok) {
        console.error('Failed to load DNS zones:', zonesRes.status);
        return;
      }
      const [zonesData, domainsData] = await Promise.all([zonesRes.json(), domainsRes.ok ? domainsRes.json() : Promise.resolve([])]);
      const domainNames: string[] = (domainsData || []).map((d: any) => d.name);
      // Filter zones to only those with existing domains to avoid stale entries
      const filtered = (zonesData || []).filter((z: any) => domainNames.includes(z.domain));
      setZones(filtered);
      if (!selectedDomain) {
        // Prefer sefion.cloud if present, else first
        const preferred = filtered.find((z: any) => z.domain === 'sefion.cloud') || filtered[0];
        if (preferred) setSelectedDomain(preferred.domain);
      }
    } catch (err) {
      console.error('Error loading DNS zones:', err);
    }
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
    if (patch.ttl && (patch.ttl < 60 || patch.ttl > 86400)) {
      alert('TTL must be between 60 and 86400');
      return;
    }
    if (patch.type === 'MX' && patch.priority == null) {
      alert('MX record requires priority');
      return;
    }
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
    setForm({ type: 'A', name: '', value: '', ttl: 3600, priority: '' });
    fetch(`/api/dns/zones/${selectedDomain}`).then(r => r.json()).then(setZone);
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>DNS</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          DNS converts domain names into computer-readable IP addresses. Use this feature to manage DNS zones.
        </Typography>
        {selectedDomain === 'sefion.cloud' && (
          <Typography variant="body2" color="primary" sx={{ mb: 1 }}>
            Viewing primary domain: sefion.cloud (read-only recommendation: avoid changing this if already configured externally)
          </Typography>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField select label="Domain" value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} sx={{ minWidth: 240 }}>
            {zones.map(z => <MenuItem key={z.domain} value={z.domain}>{z.domain}</MenuItem>)}
          </TextField>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenAdd(true)} disabled={!selectedDomain}>Add Record</Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => fetch(`/api/dns/zones/${selectedDomain}`).then(r => r.json()).then(setZone)} disabled={!selectedDomain}>Refresh</Button>
        </Stack>
        <Card variant="outlined">
          <CardContent>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>TTL</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {zone?.records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={r.type}
                        onChange={e => markDirty(r.id, { type: e.target.value.toUpperCase() as DnsRecord['type'] })}
                        sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={r.name}
                        onChange={e => markDirty(r.id, { name: e.target.value })}
                        sx={{ minWidth: 100 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={r.value}
                        onChange={e => markDirty(r.id, { value: e.target.value })}
                        sx={{ minWidth: 160 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        type="number"
                        value={r.ttl}
                        onChange={e => markDirty(r.id, { ttl: Number(e.target.value) })}
                        sx={{ width: 90 }}
                      />
                    </TableCell>
                    <TableCell>
                      {r.type === 'MX' ? (
                        <TextField
                          variant="standard"
                          type="number"
                          value={r.priority ?? ''}
                          onChange={e => markDirty(r.id, { priority: Number(e.target.value) })}
                          sx={{ width: 80 }}
                        />
                      ) : (
                        r.priority ?? '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={dirty[r.id] ? 'Save changes' : 'No changes'}>
                        <span>
                          <IconButton size="small" onClick={() => handleSave(r.id)} disabled={!dirty[r.id]}>
                            <SaveIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(r.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {zone && zone.records.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center">No records</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add DNS Record</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {['A','CNAME','MX','TXT'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="@ or www" />
            <TextField label="Value" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="IP or target" />
            <TextField label="TTL" type="number" value={form.ttl} onChange={e => setForm(f => ({ ...f, ttl: Number(e.target.value) }))} />
            {form.type === 'MX' && (
              <TextField label="Priority" type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.type || !form.name || !form.value} onClick={handleAdd}>Add</Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
