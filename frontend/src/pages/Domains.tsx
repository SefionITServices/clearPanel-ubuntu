
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
  const [form, setForm] = useState({ name: '', folderPath: '', nameservers: '', phpVersion: '' });
  const [manageOpen, setManageOpen] = useState(false);
  const [manageDomain, setManageDomain] = useState<DomainRow | null>(null);
  const [managePhpVersion, setManagePhpVersion] = useState('');

  // Simulate forceHttps and redirects for demo
  useEffect(() => {
    fetch('/api/domains').then(r => r.json()).then((data) => {
      setDomains(
        data
          .map((d: any) => ({
            ...d,
            isMain: !!d.isPrimary,
            redirectsTo: 'Not Redirected',
            forceHttps: false,
          }))
          .sort((a: any, b: any) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0))
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
      const nameserverList = form.nameservers
        .split(/\r?\n|,/)
        .map(ns => ns.trim())
        .filter(ns => ns.length > 0);

      const payload: Record<string, any> = {
        name: form.name,
      };

      if (form.folderPath.trim()) {
        payload.folderPath = form.folderPath.trim();
      }

      if (form.phpVersion.trim()) {
        payload.phpVersion = form.phpVersion.trim();
      }

      if (nameserverList.length > 0) {
        payload.nameservers = nameserverList;
      }

      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        alert('Failed to create domain');
        return;
      }
      
      setAddOpen(false);
    	setForm({ name: '', folderPath: '', nameservers: '', phpVersion: '' });
      // Refresh
      const data = await fetch('/api/domains').then(r => r.json());
      setDomains(
        data
          .map((d: any) => ({
            ...d,
            isMain: !!d.isPrimary,
            redirectsTo: 'Not Redirected',
            forceHttps: false,
          }))
          .sort((a: any, b: any) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0))
      );
      alert('Domain created successfully');
    } catch (error) {
      console.error('Create error:', error);
      alert('Error creating domain');
    }
  };

  const reloadDomains = async () => {
    const data = await fetch('/api/domains').then(r => r.json());
    setDomains(
      data
        .map((d: any) => ({
          ...d,
          isMain: !!d.isPrimary,
          redirectsTo: 'Not Redirected',
          forceHttps: false,
        }))
        .sort((a: any, b: any) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0)),
    );
  };

  const handleManage = (row: DomainRow) => {
    setManageDomain(row);
    setManagePhpVersion(row.phpVersion || '');
    setManageOpen(true);
  };
  const handleCreateEmail = (row: DomainRow) => alert('Create Email: ' + row.name);
  const handleToggleHttps = (row: DomainRow, value: boolean) => alert('Force HTTPS: ' + value);

  const handleDelete = async (row: DomainRow) => {
    if (!confirm(`Are you sure you want to delete domain "${row.name}"?`)) return;
    
    try {
      const response = await fetch(`/api/domains/${row.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await reloadDomains();
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
        {/* Create Domain Dialog */}
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
              <TextField
                select
                label="PHP Version (optional)"
                value={form.phpVersion}
                onChange={e => setForm(f => ({ ...f, phpVersion: e.target.value }))}
                fullWidth
                SelectProps={{ native: true }}
                helperText="If empty, clearPanel will auto-detect an installed PHP-FPM version."
              >
                <option value="">Auto-detect PHP-FPM</option>
                <option value="8.4">PHP 8.4</option>
                <option value="8.3">PHP 8.3</option>
                <option value="8.2">PHP 8.2</option>
                <option value="8.1">PHP 8.1</option>
                <option value="8.0">PHP 8.0</option>
                <option value="7.4">PHP 7.4</option>
              </TextField>
              <TextField
                label="Nameservers (optional)"
                value={form.nameservers}
                onChange={e => setForm(f => ({ ...f, nameservers: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
                placeholder={"ns1.example.com\nns2.example.com"}
                helperText="Enter one per line or separate with commas. Leave blank to use default ns1/ns2 for this domain."
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} variant="contained" disabled={!form.name}>Add</Button>
          </DialogActions>
        </Dialog>

        {/* Manage Domain (PHP Version) Dialog */}
        <Dialog open={manageOpen} onClose={() => setManageOpen(false)}>
          <DialogTitle>Manage Domain</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {manageDomain?.name}
              </Typography>
              <TextField
                select
                label="PHP Version"
                value={managePhpVersion}
                onChange={e => setManagePhpVersion(e.target.value)}
                fullWidth
                SelectProps={{ native: true }}
                helperText="If empty, clearPanel will auto-detect an installed PHP-FPM version."
              >
                <option value="">Auto-detect PHP-FPM</option>
                <option value="8.4">PHP 8.4</option>
                <option value="8.3">PHP 8.3</option>
                <option value="8.2">PHP 8.2</option>
                <option value="8.1">PHP 8.1</option>
                <option value="8.0">PHP 8.0</option>
                <option value="7.4">PHP 7.4</option>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setManageOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!manageDomain}
              onClick={async () => {
                if (!manageDomain) return;
                try {
                  const body: any = { phpVersion: managePhpVersion || undefined };
                  const res = await fetch(`/api/domains/${manageDomain.id}/settings`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  if (!res.ok) {
                    alert('Failed to update domain');
                    return;
                  }
                  await reloadDomains();
                  setManageOpen(false);
                  alert('Domain PHP version updated');
                } catch (e) {
                  console.error('Update error:', e);
                  alert('Error updating domain');
                }
              }}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
