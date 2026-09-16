import React, { useState, useEffect, useRef } from 'react';
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
  CircularProgress,
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
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);

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
    setShowLogs(true);
    setLogs([]);
    setError(null);
    try {
      // Call install endpoint and wait for result
      const res = await appStoreApi.installApp('nextcloud', { domain, adminUser, adminPass, ssl: ssl ? 'true' : 'false' });
      // Normalize logs
      const outLogs: string[] = [];
      if (Array.isArray(res.logs)) outLogs.push(...res.logs.map((l:any)=>String(l)));
      else if (typeof res.message === 'string') outLogs.push(res.message);
      else outLogs.push(JSON.stringify(res));
      setLogs(outLogs);
      if (onInstalled) onInstalled(res);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      setLogs((l) => [...l, `Error: ${msg}`]);
      if (onInstalled) onInstalled({ success: false, message: msg });
    } finally {
      setCreating(false);
      // scroll to bottom after logs set
      setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }), 150);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Install Nextcloud</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField select label="Domain" value={domain} onChange={(e)=>setDomain(e.target.value)} helperText="Select an existing domain or enter a new one">
              {domains.map((d)=> <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </TextField>
            <TextField label="Admin username" value={adminUser} onChange={(e)=>setAdminUser(e.target.value)} />
            <TextField label="Admin password" type="password" value={adminPass} onChange={(e)=>setAdminPass(e.target.value)} />
            <FormControlLabel control={<Checkbox checked={ssl} onChange={(e)=>setSsl(e.target.checked)} />} label="Enable SSL (Let's Encrypt)" />
            <Typography variant="caption" color="text.secondary">Note: Installer will create database, vhost, and set up PHP-FPM. The backend requires passwordless sudo to perform system changes.</Typography>
          </Box>

          <Box sx={{ width: 420, minHeight: 200, borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Installation progress</Typography>
            {creating ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography>Installing... this may take several minutes</Typography>
              </Box>
            ) : (
              <Typography color={error ? 'error' : 'text.secondary'}>{error ? 'Completed with errors' : (logs.length ? 'Completed' : 'Ready')}</Typography>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">Command output</Typography>
              <Box component="pre" ref={logRef} sx={{ bgcolor: 'background.paper', p: 1, mt: 1, height: 300, overflow: 'auto', fontSize: '0.75rem', borderRadius: 1 }}>
                {showLogs ? (logs.length ? logs.map((l, i) => <div key={i}>{l}</div>) : <div style={{ color: '#888' }}>{creating ? 'Waiting for output...' : 'No logs yet'}</div>) : <div style={{ color: '#888' }}>Logs hidden</div>}
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={creating}>Close</Button>
        <Button onClick={() => { setShowLogs(s => !s); }}>
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </Button>
        <Button variant="contained" onClick={handleInstall} disabled={creating || !domain}>Install</Button>
        <Button onClick={() => navigator.clipboard?.writeText(logs.join('\n'))} disabled={!logs.length}>Copy Logs</Button>
      </DialogActions>
    </Dialog>
  );
}
