
import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { DomainsTable, DomainRow } from '../components/domains/DomainsTable';
import { DashboardLayout } from '../layouts/dashboard/layout';

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', folderPath: '' });

  // Simulate forceHttps and redirects for demo
  useEffect(() => {
    fetch('/api/domains').then(r => r.json()).then((data) => {
      setDomains(
        data
          .map((d: any) => ({
            ...d,
            isMain: d.name === 'sefion.cloud',
            redirectsTo: 'Not Redirected',
            forceHttps: false,
          }))
          .sort((a: any, b: any) => (a.name === 'sefion.cloud' ? -1 : b.name === 'sefion.cloud' ? 1 : 0))
      );
    });
  }, []);

  const filtered = domains.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id));
  };
  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? filtered.map((d) => d.id) : []);
  };

  const handleAdd = async () => {
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      if (!response.ok) {
        alert('Failed to create domain');
        return;
      }
      
      setAddOpen(false);
      setForm({ name: '', folderPath: '' });
      // Refresh
      const data = await fetch('/api/domains').then(r => r.json());
      setDomains(
        data
          .map((d: any) => ({
            ...d,
            isMain: d.name === 'sefion.cloud',
            redirectsTo: 'Not Redirected',
            forceHttps: false,
          }))
          .sort((a: any, b: any) => (a.name === 'sefion.cloud' ? -1 : b.name === 'sefion.cloud' ? 1 : 0))
      );
      alert('Domain created successfully');
    } catch (error) {
      console.error('Create error:', error);
      alert('Error creating domain');
    }
  };

  // Dummy handlers for demo
  const handleManage = (row: DomainRow) => alert('Manage: ' + row.name);
  const handleCreateEmail = (row: DomainRow) => alert('Create Email: ' + row.name);
  const handleToggleHttps = (row: DomainRow, value: boolean) => alert('Force HTTPS: ' + value);

  const handleDelete = async (row: DomainRow) => {
    if (!confirm(`Are you sure you want to delete domain "${row.name}"?`)) return;
    
    try {
      const response = await fetch(`/api/domains/${row.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refresh the domains list
        const data = await fetch('/api/domains').then(r => r.json());
        setDomains(
          data
            .map((d: any) => ({
              ...d,
              isMain: d.name === 'sefion.cloud',
              redirectsTo: 'Not Redirected',
              forceHttps: false,
            }))
            .sort((a: any, b: any) => (a.name === 'sefion.cloud' ? -1 : b.name === 'sefion.cloud' ? 1 : 0))
        );
        alert(`Domain "${row.name}" deleted successfully`);
      } else {
        alert('Failed to delete domain');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting domain');
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 2 }}>
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
            startIcon={<AddIcon />}
            sx={{ minWidth: 180 }}
            onClick={() => setAddOpen(true)}
          >
            Create A New Domain
          </Button>
        </Stack>
        <Paper sx={{ mb: 2, p: 1, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'background.default' }}>
          <Button size="small" variant="outlined" sx={{ minWidth: 36 }} disabled />
          <TextField
            select
            size="small"
            value=""
            SelectProps={{ native: true }}
            sx={{ minWidth: 200 }}
            disabled
            label="Enable Force HTTPS Redirect"
          >
            <option value="">Enable Force HTTPS Redirect</option>
          </TextField>
          <Button size="small" variant="outlined" sx={{ minWidth: 36 }} disabled>
            <Box component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>?</Box>
          </Button>
        </Paper>
        <DomainsTable
          rows={filtered}
          selected={selected}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onManage={handleManage}
          onCreateEmail={handleCreateEmail}
          onToggleHttps={handleToggleHttps}
          onDelete={handleDelete}
        />
        <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
          <DialogTitle>Create A New Domain</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Domain Name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                fullWidth
                autoFocus
              />
              <TextField
                label="Folder Path (optional)"
                value={form.folderPath}
                onChange={e => setForm(f => ({ ...f, folderPath: e.target.value }))}
                fullWidth
                placeholder="/home/example.com"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} variant="contained" disabled={!form.name}>Add</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
