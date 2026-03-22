import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TextField,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Public as PublicIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  FolderOpen as FolderOpenIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  VpnKey as VpnKeyIcon,
  PlayArrow as PlayArrowIcon,
  Build as BuildIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { webserverApi } from '../api/webserver';
import { domainsApi } from '../api/domains';
import { projectDetectorApi, ProjectDetection, ProjectType } from '../api/project-detector';

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

// ── Project type badge helpers ─────────────────────────────────────────────

function projectTypeColor(type: ProjectType): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' {
  switch (type) {
    case 'docker-compose':
    case 'docker':       return 'info';
    case 'nextjs':       return 'secondary';
    case 'nodejs':       return 'success';
    case 'python':       return 'warning';
    case 'laravel':
    case 'php':          return 'primary';
    case 'static':       return 'default';
    default:             return 'default';
  }
}

function projectTypeIcon(type: ProjectType) {
  switch (type) {
    case 'docker-compose':
    case 'docker':  return '🐳';
    case 'nextjs':  return '▲';
    case 'nodejs':  return '⬡';
    case 'python':  return '🐍';
    case 'laravel': return '🔴';
    case 'php':     return '🐘';
    case 'static':  return '📄';
    default:        return '?';
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WebserverPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<NginxStatus | null>(null);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [proxyPorts, setProxyPorts] = useState<Record<string, string>>({});

  // Project detection state
  const [detections, setDetections] = useState<Record<string, ProjectDetection>>({});
  const [detecting, setDetecting] = useState<Record<string, boolean>>({});

  // Setup drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDomain, setDrawerDomain] = useState<DomainInfo | null>(null);
  const [drawerDetection, setDrawerDetection] = useState<ProjectDetection | null>(null);
  const [drawerPort, setDrawerPort] = useState('');
  const [drawerApplying, setDrawerApplying] = useState(false);

  // Run command state
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

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
        domainsApi.list().catch(() => []),
      ]);
      setStatus(s);
      const domainList: DomainInfo[] = Array.isArray(d) ? d : [];
      setDomains(domainList);
      // Auto-scan all domains after loading
      domainList.forEach((domain) => {
        setDetecting((prev) => ({ ...prev, [domain.id]: true }));
        projectDetectorApi.scanDomain(domain.name)
          .then((result) => setDetections((prev) => ({ ...prev, [domain.id]: result })))
          .catch(() => { /* silent fail per domain */ })
          .finally(() => setDetecting((prev) => ({ ...prev, [domain.id]: false })));
      });
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
      const rawPort = (proxyPorts[domain.id] || '').trim();
      let proxyPort: number | undefined;

      if (rawPort) {
        const parsed = Number(rawPort);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
          toast('Port must be an integer between 1 and 65535', 'error');
          return;
        }
        proxyPort = parsed;
      }

      const result = await webserverApi.createVhost(domain.name, docRoot, domain.phpVersion, proxyPort);
      if (result.success) {
        toast(proxyPort
          ? `Proxy set: ${domain.name} -> localhost:${proxyPort}`
          : `Vhost created for ${domain.name}`);
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

  // ── Project detection ───────────────────────────────────

  const detectProject = useCallback(async (domain: DomainInfo) => {
    setDetecting((prev) => ({ ...prev, [domain.id]: true }));
    try {
      const result = await projectDetectorApi.scanDomain(domain.name);
      setDetections((prev) => ({ ...prev, [domain.id]: result }));
      return result;
    } catch {
      return null;
    } finally {
      setDetecting((prev) => ({ ...prev, [domain.id]: false }));
    }
  }, []);

  // ── Setup drawer ────────────────────────────────────────

  const openSetup = async (domain: DomainInfo) => {
    setDrawerDomain(domain);
    setDrawerOpen(true);
    setRunOutput(null);
    setRunError(null);
    let detection: ProjectDetection | null = detections[domain.id] ?? null;
    if (!detection) {
      detection = (await detectProject(domain)) ?? null;
    }
    setDrawerDetection(detection);
    // Pre-fill port from detection or existing proxy port entry
    const existingPort = proxyPorts[domain.id] || '';
    setDrawerPort(existingPort || String(detection?.portHint ?? ''));
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerDomain(null);
    setDrawerDetection(null);
    setDrawerPort('');
    setRunOutput(null);
    setRunError(null);
  };

  // ── Run command ─────────────────────────────────────────

  const handleRunCommand = async (cmd: string) => {
    if (!drawerDetection?.folderPath && !drawerDomain) return;
    const folder = drawerDetection?.folderPath || drawerDomain?.folderPath || '';
    setRunLoading(true);
    setRunOutput(null);
    setRunError(null);
    try {
      const result = await projectDetectorApi.runCommand(folder, cmd);
      if (result.success) {
        setRunOutput(result.output || '(no output)');
      } else {
        setRunError(result.error || 'Command failed');
        setRunOutput(result.output || null);
      }
    } catch (e: any) {
      setRunError(e.message);
    } finally {
      setRunLoading(false);
    }
  };

  const handleDrawerApply = async () => {
    if (!drawerDomain) return;
    setDrawerApplying(true);
    const rawPort = drawerPort.trim();
    let proxyPort: number | undefined;
    if (rawPort) {
      const parsed = Number(rawPort);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        toast('Port must be an integer between 1 and 65535', 'error');
        setDrawerApplying(false);
        return;
      }
      proxyPort = parsed;
    }
    // Sync back into global proxyPorts state so the table also reflects this
    setProxyPorts((prev) => ({ ...prev, [drawerDomain.id]: rawPort }));
    try {
      const docRoot = drawerDomain.folderPath || `/home/${drawerDomain.name}/public_html`;
      const result = await webserverApi.createVhost(drawerDomain.name, docRoot, drawerDomain.phpVersion, proxyPort);
      if (result.success) {
        toast(proxyPort
          ? `Proxy configured: ${drawerDomain.name} → localhost:${proxyPort}`
          : `Static vhost applied for ${drawerDomain.name}`);
        closeDrawer();
      } else {
        toast(result.message || 'Failed to apply configuration', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to apply configuration', 'error');
    } finally {
      setDrawerApplying(false);
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

  // ── Setup Drawer ────────────────────────────────────────

  const renderSetupDrawer = () => (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={closeDrawer}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 0 } }}
    >
      <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={700}>Website Setup</Typography>
          <Typography variant="body2" color="text.secondary">{drawerDomain?.name}</Typography>
        </Stack>
        <IconButton onClick={closeDrawer}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
        {/* Detection result */}
        {detecting[drawerDomain?.id ?? ''] && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Scanning project…</Typography>
          </Stack>
        )}

        {drawerDetection && !detecting[drawerDomain?.id ?? ''] && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 22 }}>{projectTypeIcon(drawerDetection.type)}</Typography>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>{drawerDetection.label}</Typography>
                  <Chip
                    label={drawerDetection.confidence}
                    size="small"
                    color={drawerDetection.confidence === 'high' ? 'success' : drawerDetection.confidence === 'medium' ? 'warning' : 'default'}
                    variant="outlined"
                  />
                  {drawerDetection.hasDockerfile && (
                    <Chip label="Dockerfile" size="small" color="info" variant="outlined" />
                  )}
                </Stack>
                {drawerDetection.packageName && (
                  <Typography variant="caption" color="text.secondary">{drawerDetection.packageName}</Typography>
                )}
              </Box>
            </Stack>

            {drawerDetection.dockerServices && drawerDetection.dockerServices.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>COMPOSE SERVICES</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {drawerDetection.dockerServices.map((s) => (
                    <Chip key={s} label={s} size="small" />
                  ))}
                </Stack>
              </Box>
            )}

            {(drawerDetection.startCommand || drawerDetection.buildCommand) && (
              <Box sx={{ mb: 1 }}>
                {drawerDetection.buildCommand && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', color: 'text.secondary' }}>
                    build: <strong>{drawerDetection.buildCommand}</strong>
                  </Typography>
                )}
                {drawerDetection.startCommand && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', color: 'text.secondary' }}>
                    start: <strong>{drawerDetection.startCommand}</strong>
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        )}

        {/* Document root */}
        {drawerDomain && (
          <Stack spacing={0.5} sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>DOCUMENT ROOT</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <FolderOpenIcon fontSize="small" color="action" />
              <Typography variant="body2" fontFamily="monospace">
                {drawerDomain.folderPath || `/home/${drawerDomain.name}/public_html`}
              </Typography>
            </Stack>
          </Stack>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Port config */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>App Port</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            If your app runs on a local port (Node.js, Docker, Python…), nginx will proxy traffic to it.
            Leave blank for static PHP sites.
          </Typography>
          <TextField
            label="Localhost port"
            placeholder={drawerDetection?.portHint ? String(drawerDetection.portHint) : '3000'}
            value={drawerPort}
            onChange={(e) => setDrawerPort(e.target.value)}
            type="number"
            size="small"
            inputProps={{ min: 1, max: 65535 }}
            helperText={drawerDetection?.portHint ? `Detected: ${drawerDetection.portHint}` : undefined}
            fullWidth
          />
        </Box>

        {/* Env files */}
        {drawerDetection && drawerDetection.envFiles.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              <VpnKeyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              Env Files Detected
            </Typography>
            {drawerDetection.envFiles.map((f) => (
              <Chip
                key={f}
                label={f.split('/').pop()}
                size="small"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5, fontFamily: 'monospace' }}
              />
            ))}
            {drawerDetection.envVars.length > 0 && (
              <Box sx={{ mt: 1.5, maxHeight: 220, overflowY: 'auto', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <List dense disablePadding>
                  {drawerDetection.envVars.map((v) => (
                    <ListItem key={v.key} divider sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="caption" fontFamily="monospace" fontWeight={600}>{v.key}</Typography>
                        }
                        secondary={
                          <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                            {v.isExample ? `(example) ${v.value}` : v.value || '—'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            <Alert severity="info" sx={{ mt: 1.5 }} icon={<InfoIcon fontSize="small" />}>
              Edit your env files in File Manager to configure app settings.
            </Alert>
          </Box>
        )}

        {/* Run Commands */}
        {drawerDetection && (drawerDetection.buildCommand || drawerDetection.startCommand) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              <BuildIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              Run Commands
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {drawerDetection.buildCommand && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={runLoading ? <CircularProgress size={14} /> : <BuildIcon fontSize="small" />}
                  disabled={runLoading}
                  onClick={() => handleRunCommand(drawerDetection!.buildCommand!)}
                >
                  {drawerDetection.buildCommand}
                </Button>
              )}
              {drawerDetection.startCommand && (
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={runLoading ? <CircularProgress size={14} /> : <PlayArrowIcon fontSize="small" />}
                  disabled={runLoading}
                  onClick={() => handleRunCommand(drawerDetection!.startCommand!)}
                >
                  {drawerDetection.startCommand}
                </Button>
              )}
            </Stack>
            {runError && (
              <Alert severity="error" sx={{ mt: 1.5 }}>{runError}</Alert>
            )}
            {runOutput !== null && (
              <Box
                component="pre"
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  maxHeight: 220,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {runOutput}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Drawer footer */}
      <Box sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleDrawerApply}
              disabled={drawerApplying}
              startIcon={drawerApplying ? <CircularProgress size={16} color="inherit" /> : <SettingsIcon />}
            >
              {drawerApplying ? 'Applying…' : 'Apply Configuration'}
            </Button>
            <Button variant="outlined" onClick={closeDrawer}>Cancel</Button>
          </Stack>
          {drawerDetection?.folderPath && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<OpenInNewIcon />}
              onClick={() => navigate(`/files?path=${encodeURIComponent(drawerDetection!.folderPath!)}`)}
              fullWidth
            >
              Open in File Manager
            </Button>
          )}
        </Stack>
      </Box>
    </Drawer>
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
                  <TableCell><strong>Project Type</strong></TableCell>
                  <TableCell><strong>Document Root</strong></TableCell>
                  <TableCell><strong>PHP</strong></TableCell>
                  <TableCell><strong>App Port</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {domains.map((d) => {
                  const det = detections[d.id];
                  const isDetecting = !!detecting[d.id];
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{d.name}</Typography>
                      </TableCell>

                      {/* Project Type badge */}
                      <TableCell>
                        {isDetecting ? (
                          <CircularProgress size={16} />
                        ) : det ? (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography sx={{ fontSize: 16 }}>{projectTypeIcon(det.type)}</Typography>
                            <Chip
                              label={det.label}
                              size="small"
                              color={projectTypeColor(det.type)}
                              variant="filled"
                            />
                            {det.hasDockerfile && (
                              <Chip label="🐳" size="small" title="Dockerfile present" sx={{ minWidth: 0 }} />
                            )}
                          </Stack>
                        ) : (
                          <Tooltip title="Scan project type">
                            <Button size="small" variant="text" onClick={() => detectProject(d)} sx={{ fontSize: '0.7rem' }}>
                              <CodeIcon sx={{ fontSize: 14, mr: 0.5 }} /> Detect
                            </Button>
                          </Tooltip>
                        )}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {d.folderPath || `/home/${d.name}/public_html`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={d.phpVersion || 'Default'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          placeholder={det?.portHint ? String(det.portHint) : '—'}
                          value={proxyPorts[d.id] || ''}
                          onChange={(e) => setProxyPorts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                          sx={{ width: 110 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Quick Setup">
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<SettingsIcon fontSize="small" />}
                              onClick={() => openSetup(d)}
                            >
                              Setup
                            </Button>
                          </Tooltip>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleCreateVhost(d)}
                            disabled={busy === d.id}
                          >
                            {busy === d.id ? <CircularProgress size={16} /> : 'Apply'}
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
                  );
                })}
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
          Manage Nginx virtual hosts. Auto-detects project type (Docker, Node.js, Next.js, PHP…).
        </Typography>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {!loading && status && !status.installed && renderInstallView()}
        {!loading && status?.installed && renderMain()}
        {renderSetupDrawer()}

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
