import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TerminalIcon from '@mui/icons-material/Terminal';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { nodeAppsApi, type AppDef } from '../api/node-apps';

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status?: string }) {
  const s = status ?? 'unknown';
  const color =
    s === 'online'  ? 'success' :
    s === 'errored' ? 'error'   :
    s === 'stopped' ? 'default' : 'warning';
  return <Chip label={s} color={color as any} size="small" />;
}

function RuntimeChip({ runtime }: { runtime: string }) {
  const color = runtime === 'node' ? 'success' : runtime === 'python' ? 'info' : 'default';
  return <Chip label={runtime} color={color as any} size="small" variant="outlined" />;
}

// ─── Empty env row ────────────────────────────────────────────────────────────

const emptyEnv = () => ({ key: '', value: '' });

// ─── Main component ───────────────────────────────────────────────────────────

export default function NodeAppsManager() {
  const [apps, setApps] = useState<AppDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [runtimes, setRuntimes] = useState<{ node?: string; python3?: string; pm2?: string }>({});
  const [pm2Installed, setPm2Installed] = useState(false);
  const [pm2Loading, setPm2Loading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialogs
  const [createDialog, setCreateDialog] = useState(false);
  const [cloneDialog, setCloneDialog]   = useState(false);
  const [envDialog, setEnvDialog]       = useState<{ open: boolean; app: AppDef | null }>({ open: false, app: null });
  const [logsDialog, setLogsDialog]     = useState<{ open: boolean; app: AppDef | null; content: string }>({ open: false, app: null, content: '' });
  const [editDialog, setEditDialog]     = useState<{ open: boolean; app: AppDef | null }>({ open: false, app: null });

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '', runtime: 'node', directory: '', startCommand: '', port: '', description: '',
  });
  const [cloneForm, setCloneForm] = useState({
    name: '', runtime: 'node', repoUrl: '', branch: 'main', directory: '', startCommand: '', port: '',
  });
  const [editForm, setEditForm] = useState({ startCommand: '', port: '', description: '', domain: '' });
  const [envRows, setEnvRows]   = useState<{ key: string; value: string }[]>([emptyEnv()]);
  const [envSaving, setEnvSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });
  const notify = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setToast({ open: true, message, severity });

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, runtimesRes, pm2Res] = await Promise.all([
        nodeAppsApi.list(),
        nodeAppsApi.runtimes(),
        nodeAppsApi.pm2Status(),
      ]);
      setApps(appsRes.apps ?? []);
      setRuntimes(runtimesRes.runtimes ?? {});
      setPm2Installed(pm2Res.installed ?? false);
    } catch (e: any) { notify(e.message, 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── PM2 install ────────────────────────────────────────────────────────────

  const installPm2 = async () => {
    setPm2Loading(true);
    try {
      await nodeAppsApi.installPm2();
      notify('PM2 installed');
      load();
    } catch (e: any) { notify(e.message, 'error'); }
    setPm2Loading(false);
  };

  // ── App lifecycle ──────────────────────────────────────────────────────────

  const appAction = async (app: AppDef, action: 'start' | 'stop' | 'restart' | 'pull') => {
    setActionLoading(`${action}-${app.id}`);
    try {
      if (action === 'start')   await nodeAppsApi.start(app.id);
      if (action === 'stop')    await nodeAppsApi.stop(app.id);
      if (action === 'restart') await nodeAppsApi.restart(app.id);
      if (action === 'pull') {
        await nodeAppsApi.pull(app.id);
        notify('Pulled & restarted');
      } else {
        notify(`App ${action}ed`);
      }
      load();
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  const removeApp = async (app: AppDef) => {
    if (!confirm(`Delete app "${app.name}"? (files remain on disk, PM2 process removed)`)) return;
    try {
      await nodeAppsApi.remove(app.id);
      notify('App deleted');
      load();
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const viewLogs = async (app: AppDef) => {
    setLogsDialog({ open: true, app, content: 'Loading…' });
    try {
      const r = await nodeAppsApi.logs(app.id);
      setLogsDialog({ open: true, app, content: r.logs ?? '(no output)' });
    } catch (e: any) { setLogsDialog({ open: true, app, content: e.message }); }
  };

  // ── Create app ─────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setActionLoading('create');
    try {
      await nodeAppsApi.create({
        name: createForm.name,
        runtime: createForm.runtime as any,
        directory: createForm.directory,
        startCommand: createForm.startCommand,
        port: createForm.port ? parseInt(createForm.port) : undefined,
        description: createForm.description,
        env: [],
      });
      notify('App created');
      setCreateDialog(false);
      setCreateForm({ name: '', runtime: 'node', directory: '', startCommand: '', port: '', description: '' });
      load();
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  // ── Clone & create ─────────────────────────────────────────────────────────

  const handleClone = async () => {
    setActionLoading('clone');
    try {
      await nodeAppsApi.clone({
        name: cloneForm.name,
        runtime: cloneForm.runtime,
        repoUrl: cloneForm.repoUrl,
        branch: cloneForm.branch || 'main',
        directory: cloneForm.directory,
        startCommand: cloneForm.startCommand,
        port: cloneForm.port ? parseInt(cloneForm.port) : undefined,
      });
      notify('Cloned & created');
      setCloneDialog(false);
      setCloneForm({ name: '', runtime: 'node', repoUrl: '', branch: 'main', directory: '', startCommand: '', port: '' });
      load();
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  // ── Edit app ───────────────────────────────────────────────────────────────

  const openEditDialog = (app: AppDef) => {
    setEditForm({
      startCommand: app.startCommand,
      port: app.port?.toString() ?? '',
      description: app.description ?? '',
      domain: app.domain ?? '',
    });
    setEditDialog({ open: true, app });
  };

  const handleEdit = async () => {
    if (!editDialog.app) return;
    setActionLoading('edit');
    try {
      await nodeAppsApi.update(editDialog.app.id, {
        startCommand: editForm.startCommand,
        port: editForm.port ? parseInt(editForm.port) : undefined,
        description: editForm.description,
        domain: editForm.domain,
      });
      notify('App updated');
      setEditDialog({ open: false, app: null });
      load();
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  // ── Env vars ───────────────────────────────────────────────────────────────

  const openEnvDialog = (app: AppDef) => {
    const rows = app.env?.length ? app.env : [emptyEnv()];
    setEnvRows(rows);
    setEnvDialog({ open: true, app });
  };

  const handleSaveEnv = async () => {
    if (!envDialog.app) return;
    setEnvSaving(true);
    try {
      const cleaned = envRows.filter(r => r.key.trim());
      await nodeAppsApi.setEnv(envDialog.app.id, cleaned);
      notify('Env vars saved');
      setEnvDialog({ open: false, app: null });
      load();
    } catch (e: any) { notify(e.message, 'error'); }
    setEnvSaving(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Header ──────────────────────────────────────────────────────────── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>App Manager</Typography>
            <Typography variant="body2" color="text.secondary">
              Node.js &amp; Python apps managed with PM2
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
          </Stack>
        </Stack>

        {/* Runtime status bar ──────────────────────────────────────────────── */}
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack direction="row" flexWrap="wrap" gap={2} alignItems="center">
              {runtimes.node && <Chip label={`Node ${runtimes.node}`} color="success" size="small" />}
              {runtimes.python3 && <Chip label={`Python ${runtimes.python3}`} color="info" size="small" />}
              {runtimes.pm2
                ? <Chip label={`PM2 ${runtimes.pm2}`} color="default" size="small" />
                : <Stack direction="row" alignItems="center" gap={1}>
                    <Chip label="PM2 not installed" color="warning" size="small" />
                    <Button size="small" onClick={installPm2} disabled={pm2Loading}>
                      {pm2Loading ? <CircularProgress size={12} sx={{ mr: 0.5 }} /> : null} Install PM2
                    </Button>
                  </Stack>
              }
            </Stack>
          </CardContent>
        </Card>

        {/* Action bar ──────────────────────────────────────────────────────── */}
        <Stack direction="row" justifyContent="flex-end" mb={2} gap={1}>
          <Button size="small" startIcon={<CallSplitIcon />} onClick={() => setCloneDialog(true)}>
            Clone from Git
          </Button>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)}>
            New App
          </Button>
        </Stack>

        {/* App list ────────────────────────────────────────────────────────── */}
        {loading ? <CircularProgress /> : (
          <>
            {apps.length === 0 && (
              <Card><CardContent>
                <Typography color="text.secondary" align="center">
                  No apps yet. Click <strong>New App</strong> or <strong>Clone from Git</strong> to get started.
                </Typography>
              </CardContent></Card>
            )}
            <Stack gap={1.5}>
              {apps.map((app) => (
                <Card key={app.id}>
                  <CardContent>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
                      {/* Info */}
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                          <Typography fontWeight={600}>{app.name}</Typography>
                          <RuntimeChip runtime={app.runtime} />
                          <StatusChip status={app.status} />
                          {app.port && <Chip label={`:${app.port}`} size="small" variant="outlined" />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                          {app.directory}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                          $ {app.startCommand}
                        </Typography>
                        {(app.uptime || app.cpu || app.memory) && (
                          <Stack direction="row" gap={1.5} mt={0.5}>
                            {app.uptime   && <Typography variant="caption" color="text.secondary">⏱ {app.uptime}</Typography>}
                            {app.cpu      && <Typography variant="caption" color="text.secondary">CPU {app.cpu}</Typography>}
                            {app.memory   && <Typography variant="caption" color="text.secondary">Mem {app.memory}</Typography>}
                            {app.restarts !== undefined && app.restarts > 0 && (
                              <Typography variant="caption" color="warning.main">↻ {app.restarts} restarts</Typography>
                            )}
                          </Stack>
                        )}
                        {app.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {app.description}
                          </Typography>
                        )}
                      </Box>

                      {/* Actions */}
                      <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
                        {app.status !== 'online' ? (
                          <Tooltip title="Start">
                            <span><IconButton size="small" color="success" onClick={() => appAction(app, 'start')}
                              disabled={actionLoading === `start-${app.id}`}>
                              <PlayArrowIcon fontSize="small" />
                            </IconButton></span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Stop">
                            <span><IconButton size="small" color="warning" onClick={() => appAction(app, 'stop')}
                              disabled={actionLoading === `stop-${app.id}`}>
                              <StopIcon fontSize="small" />
                            </IconButton></span>
                          </Tooltip>
                        )}
                        <Tooltip title="Restart">
                          <span><IconButton size="small" onClick={() => appAction(app, 'restart')}
                            disabled={actionLoading === `restart-${app.id}`}>
                            <RestartAltIcon fontSize="small" />
                          </IconButton></span>
                        </Tooltip>
                        <Tooltip title="Git Pull &amp; Restart">
                          <span><IconButton size="small" color="info" onClick={() => appAction(app, 'pull')}
                            disabled={actionLoading === `pull-${app.id}`}>
                            <CloudDownloadIcon fontSize="small" />
                          </IconButton></span>
                        </Tooltip>
                        <Tooltip title="Logs">
                          <IconButton size="small" onClick={() => viewLogs(app)}>
                            <TerminalIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Env Vars">
                          <IconButton size="small" onClick={() => openEnvDialog(app)}>
                            <KeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEditDialog(app)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => removeApp(app)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </>
        )}

        {/* ── Dialogs ────────────────────────────────────────────────────────── */}

        {/* Create App */}
        <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>New App</DialogTitle>
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField label="App Name" placeholder="my-app" value={createForm.name}
                onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} fullWidth size="small" />
              <TextField label="Runtime" select SelectProps={{ native: true }} value={createForm.runtime}
                onChange={(e) => setCreateForm(f => ({ ...f, runtime: e.target.value }))} size="small">
                {['node', 'python', 'static'].map(r => <option key={r} value={r}>{r}</option>)}
              </TextField>
              <TextField label="Directory (on server)" placeholder="/var/www/my-app"
                value={createForm.directory} onChange={(e) => setCreateForm(f => ({ ...f, directory: e.target.value }))} fullWidth size="small" />
              <TextField label="Start Command" placeholder="node index.js  or  python3 app.py"
                value={createForm.startCommand} onChange={(e) => setCreateForm(f => ({ ...f, startCommand: e.target.value }))} fullWidth size="small" />
              <TextField label="Port (optional)" type="number" value={createForm.port}
                onChange={(e) => setCreateForm(f => ({ ...f, port: e.target.value }))} fullWidth size="small" />
              <TextField label="Description (optional)" value={createForm.description}
                onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} fullWidth size="small" />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate}
              disabled={!createForm.name || !createForm.directory || !createForm.startCommand || actionLoading === 'create'}>
              {actionLoading === 'create' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null} Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Clone from Git */}
        <Dialog open={cloneDialog} onClose={() => setCloneDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Clone from Git</DialogTitle>
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField label="App Name" value={cloneForm.name}
                onChange={(e) => setCloneForm(f => ({ ...f, name: e.target.value }))} fullWidth size="small" />
              <TextField label="Runtime" select SelectProps={{ native: true }} value={cloneForm.runtime}
                onChange={(e) => setCloneForm(f => ({ ...f, runtime: e.target.value }))} size="small">
                {['node', 'python', 'static'].map(r => <option key={r} value={r}>{r}</option>)}
              </TextField>
              <TextField label="Git Repo URL" placeholder="https://github.com/user/repo.git"
                value={cloneForm.repoUrl} onChange={(e) => setCloneForm(f => ({ ...f, repoUrl: e.target.value }))} fullWidth size="small" />
              <TextField label="Branch" value={cloneForm.branch}
                onChange={(e) => setCloneForm(f => ({ ...f, branch: e.target.value }))} fullWidth size="small" />
              <TextField label="Destination Directory" placeholder="/var/www/my-app"
                value={cloneForm.directory} onChange={(e) => setCloneForm(f => ({ ...f, directory: e.target.value }))} fullWidth size="small" />
              <TextField label="Start Command" placeholder="node server.js  or  python3 app.py"
                value={cloneForm.startCommand} onChange={(e) => setCloneForm(f => ({ ...f, startCommand: e.target.value }))} fullWidth size="small" />
              <TextField label="Port (optional)" type="number" value={cloneForm.port}
                onChange={(e) => setCloneForm(f => ({ ...f, port: e.target.value }))} fullWidth size="small" />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloneDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleClone}
              disabled={!cloneForm.name || !cloneForm.repoUrl || !cloneForm.directory || !cloneForm.startCommand || actionLoading === 'clone'}>
              {actionLoading === 'clone' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null} Clone &amp; Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit App */}
        <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, app: null })} maxWidth="sm" fullWidth>
          <DialogTitle>Edit App — {editDialog.app?.name}</DialogTitle>
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField label="Start Command" value={editForm.startCommand}
                onChange={(e) => setEditForm(f => ({ ...f, startCommand: e.target.value }))} fullWidth size="small" />
              <TextField label="Port" type="number" value={editForm.port}
                onChange={(e) => setEditForm(f => ({ ...f, port: e.target.value }))} fullWidth size="small" />
              <TextField label="Domain (optional, for reverse proxy)" value={editForm.domain}
                onChange={(e) => setEditForm(f => ({ ...f, domain: e.target.value }))} fullWidth size="small"
                placeholder="myapp.example.com" />
              <TextField label="Description" value={editForm.description}
                onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} fullWidth size="small" />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog({ open: false, app: null })}>Cancel</Button>
            <Button variant="contained" onClick={handleEdit} disabled={actionLoading === 'edit'}>
              {actionLoading === 'edit' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null} Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Env Vars */}
        <Dialog open={envDialog.open} onClose={() => setEnvDialog({ open: false, app: null })} maxWidth="sm" fullWidth>
          <DialogTitle>Env Vars — {envDialog.app?.name}</DialogTitle>
          <DialogContent>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Changes take effect on next start/restart.
            </Typography>
            <Stack gap={1} mt={1}>
              {envRows.map((row, i) => (
                <Stack key={i} direction="row" gap={1} alignItems="center">
                  <TextField size="small" label="KEY" value={row.key}
                    onChange={(e) => setEnvRows(r => r.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                    sx={{ flex: 1 }} />
                  <TextField size="small" label="VALUE" value={row.value}
                    onChange={(e) => setEnvRows(r => r.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    sx={{ flex: 2 }} />
                  <IconButton size="small" color="error" onClick={() => setEnvRows(r => r.filter((_, j) => j !== i))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => setEnvRows(r => [...r, emptyEnv()])}>
                Add Variable
              </Button>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEnvDialog({ open: false, app: null })}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEnv} disabled={envSaving}>
              {envSaving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null} Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Logs */}
        <Dialog open={logsDialog.open} onClose={() => setLogsDialog(d => ({ ...d, open: false }))} maxWidth="lg" fullWidth>
          <DialogTitle>Logs — {logsDialog.app?.name}</DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box component="pre" sx={{ m: 0, p: 2, bgcolor: '#0d1117', color: '#e6edf3', fontSize: 12, maxHeight: '60vh', overflow: 'auto', fontFamily: 'monospace' }}>
              {logsDialog.content}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={async () => {
              if (logsDialog.app) {
                const r = await nodeAppsApi.logs(logsDialog.app.id);
                setLogsDialog(d => ({ ...d, content: r.logs ?? '(no output)' }));
              }
            }}>Refresh</Button>
            <Button onClick={() => setLogsDialog(d => ({ ...d, open: false }))}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Toast */}
        <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast(t => ({ ...t, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert severity={toast.severity} onClose={() => setToast(t => ({ ...t, open: false }))}>{toast.message}</Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
