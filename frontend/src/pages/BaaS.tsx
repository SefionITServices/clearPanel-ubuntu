import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import StorageIcon from '@mui/icons-material/Storage';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import { baasApi, BaasInstance, BaasOverviewStats, BaasSdkSnippet } from '../api/baas';

export default function BaaSPage() {
  const [instances, setInstances] = useState<BaasInstance[]>([]);
  const [stats, setStats] = useState<BaasOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [opBusy, setOpBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);

  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [port, setPort] = useState('8090');
  const [domain, setDomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Snippets Modal State
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [snippets, setSnippets] = useState<BaasSdkSnippet[]>([]);
  const [activeSnippetTab, setActiveSnippetTab] = useState(0);
  const [activeSnippetInstance, setActiveSnippetInstance] = useState<BaasInstance | null>(null);
  const [copied, setCopied] = useState(false);

  // Logs Modal State
  const [logsOpen, setLogsOpen] = useState(false);
  const [activeLogInstance, setActiveLogInstance] = useState<BaasInstance | null>(null);
  const [logsContent, setLogsContent] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const showToast = (msg: string, sev: 'success' | 'error' | 'info' = 'success') => setToast({ msg, sev });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, instancesRes] = await Promise.all([
        baasApi.getStats(),
        baasApi.listInstances(),
      ]);
      setStats(statsRes);
      setInstances(instancesRes.instances);
    } catch (e: any) {
      showToast(e.message || 'Failed to load BaaS data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Instance name is required', 'error');
      return;
    }
    if (!adminEmail.trim() || !adminEmail.includes('@')) {
      showToast('A valid admin email is required', 'error');
      return;
    }

    setOpBusy(true);
    try {
      const res = await baasApi.createInstance({
        name: name.trim(),
        port: port ? parseInt(port, 10) : undefined,
        domain: domain.trim() || undefined,
        adminEmail: adminEmail.trim(),
        adminPassword: adminPassword.trim() || undefined,
      });

      showToast(`BaaS instance "${res.instance.name}" created successfully!`);
      setCreateOpen(false);
      setName('');
      setDomain('');
      setAdminEmail('');
      setAdminPassword('');
      await loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to create instance', 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleStart = async (inst: BaasInstance) => {
    setOpBusy(true);
    try {
      await baasApi.startInstance(inst.id);
      showToast(`Started "${inst.name}"`);
      await loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleStop = async (inst: BaasInstance) => {
    setOpBusy(true);
    try {
      await baasApi.stopInstance(inst.id);
      showToast(`Stopped "${inst.name}"`);
      await loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleRestart = async (inst: BaasInstance) => {
    setOpBusy(true);
    try {
      await baasApi.restartInstance(inst.id);
      showToast(`Restarted "${inst.name}"`);
      await loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleDelete = async (inst: BaasInstance) => {
    if (!confirm(`Delete BaaS instance "${inst.name}"?\n\nThis will permanently delete the SQLite database and all uploaded files.`)) {
      return;
    }

    setOpBusy(true);
    try {
      await baasApi.deleteInstance(inst.id);
      showToast(`Deleted "${inst.name}"`);
      await loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleOpenSnippets = async (inst: BaasInstance) => {
    setActiveSnippetInstance(inst);
    setSnippetOpen(true);
    try {
      const res = await baasApi.getSnippets(inst.id);
      setSnippets(res.snippets);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleOpenLogs = async (inst: BaasInstance) => {
    setActiveLogInstance(inst);
    setLogsOpen(true);
    setLoadingLogs(true);
    try {
      const res = await baasApi.getLogs(inst.id, 60);
      setLogsContent(res.logs);
    } catch (e: any) {
      setLogsContent(`Failed to load logs: ${e.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 1140, mx: 'auto' }}>
        {/* Top Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <CloudQueueIcon sx={{ mr: 1.5, color: '#f58220', fontSize: 32 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight={700}>Cloud BaaS (Firebase & Supabase Alternative)</Typography>
            <Typography variant="body2" color="text.secondary">
              1-Click User Auth, Real-time Database, and File Storage with JS, Flutter, and Python SDKs.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadData} disabled={loading || opBusy}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: '#f58220', '&:hover': { bgcolor: '#e06f15' } }}
            >
              New BaaS Instance
            </Button>
          </Stack>
        </Box>

        {/* Stats & Capability Overview Banner */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(245,130,32,0.08) 0%, rgba(255,193,7,0.03) 100%)',
            borderColor: 'rgba(245,130,32,0.25)',
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <SpeedIcon sx={{ color: '#f58220', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>ENGINE STATUS</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    PocketBase {stats?.pocketbaseVersion || 'Core'}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <StorageIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>ACTIVE INSTANCES</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {stats?.runningInstances || 0} Running / {stats?.totalInstances || 0} Total
                  </Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <SecurityIcon sx={{ color: 'success.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>FEATURES INCLUDED</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    Auth, Realtime DB, File Uploads, Admin UI
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Instances List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>
        ) : instances.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
            <CloudQueueIcon sx={{ fontSize: 60, opacity: 0.2, color: '#f58220', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>No BaaS instances created yet</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
              Launch an instant Firebase-like backend for your Flutter, Next.js, or React apps with zero configuration.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: '#f58220', '&:hover': { bgcolor: '#e06f15' } }}
            >
              Create Your First BaaS Instance
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2.5}>
            {instances.map((inst) => (
              <Grid size={{ xs: 12, md: 6 }} key={inst.id}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{inst.name}</Typography>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                          ID: {inst.id}
                        </Typography>
                      </Box>
                      <Chip
                        label={inst.status.toUpperCase()}
                        color={inst.status === 'running' ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: 11 }}
                      />
                    </Box>

                    <Stack spacing={1} sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">PORT</Typography>
                        <Chip label={`:${inst.port}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                      </Box>

                      {inst.domain && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">DOMAIN</Typography>
                          <Typography variant="body2" fontWeight={600} color="primary.main">{inst.domain}</Typography>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">ADMIN SUPERUSER</Typography>
                        <Typography variant="caption" fontFamily="monospace">{inst.adminEmail || 'Admin'}</Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">API ENDPOINT</Typography>
                        <Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                          {inst.apiUrl}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>

                  <Divider />

                  <CardActions sx={{ p: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      endIcon={<OpenInNewIcon />}
                      component="a"
                      href={inst.adminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ bgcolor: '#f58220', '&:hover': { bgcolor: '#e06f15' }, fontWeight: 600 }}
                    >
                      Open Admin Portal (/_/)
                    </Button>

                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Client SDK Snippets (JS, Flutter, Python)">
                        <IconButton size="small" onClick={() => handleOpenSnippets(inst)}>
                          <CodeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Logs">
                        <IconButton size="small" onClick={() => handleOpenLogs(inst)}>
                          <DescriptionIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {inst.status === 'running' ? (
                        <Tooltip title="Stop Instance">
                          <IconButton size="small" color="warning" onClick={() => handleStop(inst)} disabled={opBusy}>
                            <StopIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Start Instance">
                          <IconButton size="small" color="success" onClick={() => handleStart(inst)} disabled={opBusy}>
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Restart">
                        <IconButton size="small" onClick={() => handleRestart(inst)} disabled={opBusy}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(inst)} disabled={opBusy}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Create Instance Dialog */}
        <Dialog open={createOpen} onClose={() => !opBusy && setCreateOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle fontWeight={700}>Create New BaaS Instance (Firebase Alternative)</DialogTitle>
          <DialogContent dividers>
            <Alert severity="info" sx={{ mb: 2.5 }}>
              Each instance runs an isolated database, authentication service, file storage, and visual admin portal in ~15MB RAM.
            </Alert>
            <Stack spacing={2.5}>
              <TextField
                label="Instance / Project Name"
                placeholder="e.g. mobile-chat-app or store-backend"
                fullWidth
                size="small"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Port"
                    fullWidth
                    size="small"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    helperText="Local port for the service"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Custom Domain (Optional)"
                    placeholder="e.g. api.mysite.com"
                    fullWidth
                    size="small"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    helperText="Nginx reverse proxy with SSL"
                  />
                </Grid>
              </Grid>
              <TextField
                label="Initial Admin Email"
                placeholder="admin@yourdomain.com"
                type="email"
                fullWidth
                size="small"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                helperText="Used to log in to the /_/ Admin Dashboard"
              />
              <TextField
                label="Initial Admin Password (Optional)"
                placeholder="Leave blank to auto-generate"
                type="password"
                fullWidth
                size="small"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                helperText="Minimum 8 characters"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setCreateOpen(false)} disabled={opBusy}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={opBusy || !name.trim() || !adminEmail.trim()}
              sx={{ bgcolor: '#f58220', '&:hover': { bgcolor: '#e06f15' } }}
            >
              {opBusy ? <CircularProgress size={20} color="inherit" /> : 'Create & Launch'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* SDK Snippets Dialog */}
        <Dialog open={snippetOpen} onClose={() => setSnippetOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={700}>
              Client SDK Code Snippets — {activeSnippetInstance?.name}
            </Typography>
            <Button
              size="small"
              startIcon={copied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
              onClick={() => snippets[activeSnippetTab] && copyToClipboard(snippets[activeSnippetTab].code)}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            <Tabs
              value={activeSnippetTab}
              onChange={(_, v) => setActiveSnippetTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 2, bgcolor: 'action.hover' }}
            >
              {snippets.map((s, idx) => (
                <Tab key={s.language} label={s.label} id={`tab-${idx}`} />
              ))}
            </Tabs>
            <Box
              sx={{
                p: 2.5,
                bgcolor: '#0d1117',
                color: '#e6edf3',
                fontFamily: 'monospace',
                fontSize: 12.5,
                whiteSpace: 'pre-wrap',
                maxHeight: 450,
                overflow: 'auto',
              }}
            >
              {snippets[activeSnippetTab]?.code}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setSnippetOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Live Logs Dialog */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle fontWeight={700}>Live System Logs — {activeLogInstance?.name}</DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            {loadingLogs ? (
              <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
            ) : (
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: '#0d1117',
                  color: '#7ee787',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 450,
                  overflow: 'auto',
                }}
              >
                {logsContent}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => activeLogInstance && handleOpenLogs(activeLogInstance)}>Refresh Logs</Button>
            <Button onClick={() => setLogsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Toast Snackbar */}
        <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          {toast ? <Alert severity={toast.sev} variant="filled">{toast.msg}</Alert> : <span />}
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
