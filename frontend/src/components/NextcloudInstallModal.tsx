import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
} from '@mui/material';
import { appStoreApi } from '../api/app-store';
import { domainsApi } from '../api/domains';

export default function NextcloudInstallModal({ open, onClose, onInstalled }: { open: boolean; onClose: () => void; onInstalled?: (res:any)=>void }) {
  const [domains, setDomains] = useState<string[]>([]);
  const [domain, setDomain] = useState('');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [ssl, setSsl] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await domainsApi.list();
        if (list && Array.isArray(list)) setDomains(list.map((d:any)=>d.name));
      } catch {}
    })();
  }, [open]);

  const handleInstall = async () => {
    setCreating(true);
    try {
      const res = await appStoreApi.installApp('nextcloud', { domain, adminUser, adminPass, ssl: ssl ? 'true' : 'false' });
      if (onInstalled) onInstalled(res);
      onClose();
    } catch (e:any) {
      // ignore for now
    } finally { setCreating(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Install Nextcloud</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField select label="Domain" value={domain} onChange={(e)=>setDomain(e.target.value)} helperText="Select an existing domain or enter a new one">
            {domains.map((d)=> <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </TextField>
          <TextField label="Admin username" value={adminUser} onChange={(e)=>setAdminUser(e.target.value)} />
          <TextField label="Admin password" type="password" value={adminPass} onChange={(e)=>setAdminPass(e.target.value)} />
          <FormControlLabel control={<Checkbox checked={ssl} onChange={(e)=>setSsl(e.target.checked)} />} label="Enable SSL (Let's Encrypt)" />
          <Typography variant="caption" color="text.secondary">Note: Installer will create database, vhost, and set up PHP-FPM. The backend requires passwordless sudo to perform system changes.</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleInstall} disabled={creating || !domain}>Install</Button>
      </DialogActions>
    </Dialog>
  );
}
