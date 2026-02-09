import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Tooltip,
  Switch,
  FormControlLabel,
  Collapse,
  LinearProgress,
} from '@mui/material';
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';

interface SslCertificate {
  domain: string;
  status: 'active' | 'expired' | 'none';
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  autoRenew: boolean;
}

interface SslStatus {
  installed: boolean;
  version?: string;
  certificateCount: number;
  renewalTimerActive: boolean;
}

interface DomainInfo {
  id: string;
  name: string;
  folderPath: string;
  isPrimary: boolean;
}

const api = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  return res.json();
};

export default function SslPage() {
  const [status, setStatus] = useState<SslStatus | null>(null);
  const [certificates, setCertificates] = useState<SslCertificate[]>([]);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [renewingAll, setRenewingAll] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [email, setEmail] = useState('');
  const [includeWww, setIncludeWww] = useState(true);
  const [installResult, setInstallResult] = useState<{ success: boolean; message: string; logs?: string[] } | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, certsRes, domainsRes] = await Promise.all([
        api('/api/ssl/status'),
        api('/api/ssl/certificates'),
        api('/api/domains'),
      ]);
      setStatus(statusRes);
      setCertificates(Array.isArray(certsRes) ? certsRes : []);
      setDomains(Array.isArray(domainsRes) ? domainsRes : []);
    } catch (err) {
      setError('Failed to load SSL data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInstallCertbot = async () => {
    setInstalling('certbot');
    try {
      const res = await api('/api/ssl/install-certbot', { method: 'POST' });
      if (res.success) {
        await refresh();
      } else {
        setError(res.message);
      }
    } catch {
      setError('Failed to install certbot');
    } finally {
      setInstalling(null);
    }
  };

  const handleOpenInstallDialog = (domain: string) => {
    setSelectedDomain(domain);
    setInstallResult(null);
    setLogsExpanded(false);
    setDialogOpen(true);
  };

  const handleInstallSsl = async () => {
    if (!selectedDomain || !email) return;
    setInstalling(selectedDomain);
    setInstallResult(null);
    try {
      const res = await api('/api/ssl/install', {
        method: 'POST',
        body: JSON.stringify({ domain: selectedDomain, email, includeWww }),
      });
      setInstallResult(res);
      if (res.success) {
        await refresh();
      }
    } catch {
      setInstallResult({ success: false, message: 'Request failed' });
    } finally {
      setInstalling(null);
    }
  };

  const handleRenew = async (domain?: string) => {
    if (domain) {
      setInstalling(domain);
    } else {
      setRenewingAll(true);
    }
    try {
      const res = await api('/api/ssl/renew', {
        method: 'POST',
        body: JSON.stringify({ domain }),
      });
      if (res.success) {
        await refresh();
      } else {
        setError(res.message);
      }
    } catch {
      setError('Renewal failed');
    } finally {
      setInstalling(null);
      setRenewingAll(false);
    }
  };

  const handleRemove = async (domain: string) => {
    if (!confirm(`Remove SSL certificate for ${domain}? The site will revert to HTTP.`)) return;
    setInstalling(domain);
    try {
      await api(`/api/ssl/certificates/${domain}`, { method: 'DELETE' });
      await refresh();
    } catch {
      setError(`Failed to remove certificate for ${domain}`);
    } finally {
      setInstalling(null);
    }
  };

  const getCertForDomain = (domain: string) =>
    certificates.find((c) => c.domain === domain);

  const getStatusChip = (cert?: SslCertificate) => {
    if (!cert || cert.status === 'none') {
      return <Chip icon={<LockOpenIcon />} label="No SSL" size="small" color="default" />;
    }
    if (cert.status === 'expired') {
      return <Chip icon={<ErrorIcon />} label="Expired" size="small" color="error" />;
    }
    if (cert.daysRemaining !== undefined && cert.daysRemaining <= 14) {
      return (
        <Chip
          icon={<WarningIcon />}
          label={`Expiring (${cert.daysRemaining}d)`}
          size="small"
          color="warning"
        />
      );
    }
    return (
      <Chip
        icon={<CheckCircleIcon />}
        label={`Active (${cert.daysRemaining}d)`}
        size="small"
        color="success"
      />
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <SecurityIcon fontSize="large" color="primary" />
            <Typography variant="h4">SSL Certificates</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </Button>
            {certificates.length > 0 && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={renewingAll ? <CircularProgress size={18} /> : <RefreshIcon />}
                onClick={() => handleRenew()}
                disabled={renewingAll}
              >
                Renew All
              </Button>
            )}
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Certbot Status Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6">Let's Encrypt (Certbot)</Typography>
                {status?.installed ? (
                  <Stack direction="row" spacing={2} mt={0.5}>
                    <Chip label="Installed" color="success" size="small" />
                    {status.version && (
                      <Typography variant="body2" color="text.secondary">
                        {status.version}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {status.certificateCount} certificate(s) managed
                    </Typography>
                    {status.renewalTimerActive && (
                      <Chip label="Auto-renewal active" color="info" size="small" variant="outlined" />
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    Certbot is not installed. Install it to manage free SSL certificates.
                  </Typography>
                )}
              </Box>
              {!status?.installed && (
                <Button
                  variant="contained"
                  onClick={handleInstallCertbot}
                  disabled={installing === 'certbot'}
                  startIcon={
                    installing === 'certbot' ? <CircularProgress size={18} /> : <AddIcon />
                  }
                >
                  Install Certbot
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Domains + SSL Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Domain</TableCell>
                <TableCell>SSL Status</TableCell>
                <TableCell>Issuer</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" py={3}>
                      No domains configured. Add a domain first.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((d) => {
                  const cert = getCertForDomain(d.name);
                  const hasSsl = cert && cert.status !== 'none';
                  const isWorking = installing === d.name;

                  return (
                    <TableRow key={d.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {hasSsl ? (
                            <LockIcon fontSize="small" color="success" />
                          ) : (
                            <LockOpenIcon fontSize="small" color="disabled" />
                          )}
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {d.name}
                            </Typography>
                            {d.isPrimary && (
                              <Chip label="Primary" size="small" variant="outlined" sx={{ mt: 0.3 }} />
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{getStatusChip(cert)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {cert?.issuer || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {cert?.validTo || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {hasSsl ? (
                            <>
                              <Tooltip title="Renew certificate">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleRenew(d.name)}
                                  disabled={isWorking}
                                >
                                  {isWorking ? <CircularProgress size={18} /> : <RefreshIcon />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remove certificate">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemove(d.name)}
                                  disabled={isWorking}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={
                                isWorking ? <CircularProgress size={16} /> : <LockIcon />
                              }
                              onClick={() => handleOpenInstallDialog(d.name)}
                              disabled={isWorking || !status?.installed}
                            >
                              Install SSL
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Install SSL Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Install SSL Certificate — {selectedDomain}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <Alert severity="info">
                A free SSL certificate will be obtained from Let's Encrypt and
                automatically configured with Nginx. The domain must have DNS
                pointing to this server.
              </Alert>

              <TextField
                label="Email Address"
                helperText="Used for Let's Encrypt expiry notifications"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                type="email"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={includeWww}
                    onChange={(e) => setIncludeWww(e.target.checked)}
                  />
                }
                label={`Also secure www.${selectedDomain}`}
              />

              {installing === selectedDomain && (
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Installing certificate... This may take up to 60 seconds.
                  </Typography>
                  <LinearProgress />
                </Box>
              )}

              {installResult && (
                <Box>
                  <Alert severity={installResult.success ? 'success' : 'error'}>
                    {installResult.message}
                  </Alert>

                  {installResult.logs && installResult.logs.length > 0 && (
                    <Box mt={1}>
                      <Button
                        size="small"
                        onClick={() => setLogsExpanded(!logsExpanded)}
                        endIcon={logsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      >
                        {logsExpanded ? 'Hide' : 'Show'} Logs
                      </Button>
                      <Collapse in={logsExpanded}>
                        <Paper
                          variant="outlined"
                          sx={{
                            mt: 1,
                            p: 1.5,
                            maxHeight: 200,
                            overflow: 'auto',
                            bgcolor: 'grey.50',
                          }}
                        >
                          <Typography
                            component="pre"
                            variant="caption"
                            sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
                          >
                            {installResult.logs.join('\n')}
                          </Typography>
                        </Paper>
                      </Collapse>
                    </Box>
                  )}
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Close</Button>
            <Button
              variant="contained"
              onClick={handleInstallSsl}
              disabled={!email || installing === selectedDomain}
              startIcon={
                installing === selectedDomain ? <CircularProgress size={18} /> : <LockIcon />
              }
            >
              Install Certificate
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
