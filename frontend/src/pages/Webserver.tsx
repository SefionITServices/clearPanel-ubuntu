import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Public as PublicIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { webserverApi } from '../api/webserver';
import { domainsApi } from '../api/domains';

interface NginxStatus {
  installed: boolean;
  running: boolean;
  version?: string;
}

interface DomainInfo {
  id: string;
  name: string;
  folderPath?: string;
  phpVersion?: string;
  webserver?: string;
}

export default function WebserverPage() {
  const [status, setStatus] = useState<NginxStatus | null>(null);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const toast = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        webserverApi.status(),
        domainsApi.list().catch(() => ({ domains: [] })),
      ]);
      setStatus(s);
      setDomains(d.domains || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load status', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await webserverApi.install();
      if (result.success) {
        toast('Nginx installed successfully');
        await refresh();
      } else {
        toast(result.message || 'Installation failed', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Installation failed', 'error');
    } finally {
      setInstalling(false);
    }
  };

  const handleCreateVhost = async (domain: DomainInfo) => {
    setBusy(domain.id);
    try {
      const docRoot = domain.folderPath || `/home/${domain.name}/public_html`;
      const result = await webserverApi.createVhost(domain.name, docRoot, domain.phpVersion);
      if (result.success) {
        toast(`Vhost created for ${domain.name}`);
      } else {
        toast(result.message || 'Failed to create vhost', 'error');
      }
    } catch (err: any) {
      toast(err.message || `Failed to create vhost for ${domain.name}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveVhost = async (domainName: string) => {
    setBusy(domainName);
    try {
      const result = await webserverApi.removeVhost(domainName);
      if (result.success) {
        toast(`Vhost removed for ${domainName}`);
      } else {
        toast(result.message || 'Failed to remove vhost', 'error');
      }
    } catch (err: any) {
      toast(err.message || `Failed to remove vhost for ${domainName}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  // ── Not Installed State ─────────────────────────────────

  const renderInstallView = () => (
    <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 600, mx: 'auto', mt: 6 }}>
      <PublicIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h5" gutterBottom fontWeight={600}>
        Nginx Not Installed
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Nginx is the web server that serves your websites. Install it to manage virtual hosts, SSL, and more.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={handleInstall}
        disabled={installing}
        startIcon={installing ? <CircularProgress size={20} /> : <DownloadIcon />}
      >
        {installing ? 'Installing…' : 'Install Nginx'}
      </Button>
    </Paper>
  );

  // ── Main View ───────────────────────────────────────────

  const renderMain = () => (
    <Stack spacing={3}>
      {/* Status Card */}
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6" fontWeight={600}>Nginx Status</Typography>
            <Chip
              icon={status?.running ? <CheckCircleIcon /> : <ErrorIcon />}
              label={status?.running ? 'Running' : 'Stopped'}
              color={status?.running ? 'success' : 'error'}
              size="small"
            />
          </Stack>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
        {status?.version && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Version: {status.version}
          </Typography>
        )}
      </Paper>

      {/* Domains & Vhosts */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Virtual Hosts
        </Typography>
        {domains.length === 0 ? (
          <Alert severity="info">
            No domains configured. Add a domain first from the Domains page.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Domain</strong></TableCell>
                  <TableCell><strong>Document Root</strong></TableCell>
                  <TableCell><strong>PHP</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {domains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{d.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {d.folderPath || `/home/${d.name}/public_html`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={d.phpVersion || 'Default'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleCreateVhost(d)}
                          disabled={busy === d.id}
                        >
                          {busy === d.id ? <CircularProgress size={16} /> : 'Create Vhost'}
                        </Button>
                        <Tooltip title="Remove vhost">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveVhost(d.name)}
                            disabled={busy === d.name}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );

  // ── Layout ──────────────────────────────────────────────

  return (
    <DashboardLayout>
      <Box>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
          Web Server
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Manage Nginx web server and virtual host configurations
        </Typography>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {!loading && status && !status.installed && renderInstallView()}
        {!loading && status?.installed && renderMain()}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          <Alert
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
