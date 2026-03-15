import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Paper,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Language as DomainIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { serverApi } from '../../api/server';

interface AutoLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

export function PanelDomainCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentDomain, setCurrentDomain] = useState('');
  const [sslEnabled, setSslEnabled] = useState(false);
  const [serverIp, setServerIp] = useState('');

  const [newDomain, setNewDomain] = useState('');
  const [enableSsl, setEnableSsl] = useState(false);
  const [email, setEmail] = useState('');
  const [logs, setLogs] = useState<AutoLog[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await serverApi.getPanelDomain();
      setCurrentDomain(data.panelDomain || '');
      setSslEnabled(data.sslEnabled || false);
      setServerIp(data.serverIp || '');
      if (!newDomain && data.panelDomain) setNewDomain(data.panelDomain);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApply = async () => {
    if (!newDomain.trim()) return;
    setSaving(true);
    setLogs([]);
    setError(null);
    try {
      const data = await serverApi.setPanelDomain(newDomain.trim(), enableSsl, email.trim() || undefined);
      setLogs(data.automationLogs || []);
      if (data.success) {
        setCurrentDomain(data.domain);
        setSslEnabled(data.sslEnabled);
      } else {
        setError('Domain assignment encountered errors. See the log below.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>;

  return (
    <Stack spacing={3}>
      {/* Current status */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DomainIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Current Panel Access</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">Domain</Typography>
              <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                {currentDomain || <em style={{ opacity: 0.5 }}>Not configured (using server IP)</em>}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">SSL</Typography>
              <Chip
                size="small"
                icon={sslEnabled ? <LockIcon /> : <LockOpenIcon />}
                label={sslEnabled ? 'Active' : 'Not enabled'}
                color={sslEnabled ? 'success' : 'default'}
              />
            </Box>
            {serverIp && (
              <Box>
                <Typography variant="body2" color="text.secondary">Server IP</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{serverIp}</Typography>
                  <Button size="small" onClick={() => navigator.clipboard.writeText(serverIp)} sx={{ minWidth: 0 }}>
                    <CopyIcon fontSize="small" />
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* DNS prerequisite info */}
      <Alert severity="info" icon={<InfoIcon />}>
        Before assigning a domain, create a <strong>DNS A record</strong> pointing your domain to this server's IP&nbsp;
        <strong>{serverIp || '(your server IP)'}</strong>. SSL will fail if the domain does not resolve to this server.
      </Alert>

      {/* Domain form */}
      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Assign Domain to Panel</Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Panel Domain"
            placeholder="panel.yourdomain.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value.trim().toLowerCase())}
            helperText="Enter the domain you want to use for accessing ClearPanel"
            size="small"
          />

          <Divider />

          <FormControlLabel
            control={<Switch checked={enableSsl} onChange={(_, c) => setEnableSsl(c)} />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Enable SSL (Certbot / Let's Encrypt)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Automatically obtain a free TLS certificate. The domain must already be pointing to this server.
                </Typography>
              </Box>
            }
          />

          {enableSsl && (
            <TextField
              size="small"
              label="Email for SSL certificate (optional)"
              placeholder="admin@yourdomain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              helperText="Used by Let's Encrypt for renewal notices. Defaults to admin@domain."
            />
          )}

          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          <Button
            variant="contained"
            onClick={handleApply}
            disabled={saving || !newDomain.trim()}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <DomainIcon />}
            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
          >
            {saving ? 'Applying...' : 'Apply Domain'}
          </Button>
        </Stack>
      </Paper>

      {/* Automation log */}
      {logs.length > 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Automation Log</Typography>
          </Box>
          <List dense disablePadding>
            {logs.map((log, i) => (
              <ListItem key={i} sx={{ borderBottom: i < logs.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {log.success
                    ? <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
                    : <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />}
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{log.task}</Typography>}
                  secondary={<>
                    <span>{log.message}</span>
                    {log.detail && <><br /><span style={{ opacity: 0.7, fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.detail}</span></>}
                  </>}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );
}
