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
import LayersIcon from '@mui/icons-material/Layers';
import StorageIcon from '@mui/icons-material/Storage';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BuildIcon from '@mui/icons-material/Build';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { dockerApi } from '../api/docker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Container { id: string; name: string; image: string; status: string; state: string; ports: string; created: string; }
interface Image     { id: string; repository: string; tag: string; size: string; created: string; }
interface Stack     { name: string; projectPath: string; status: string; services: number; createdAt: string; }
interface Network   { id: string; name: string; driver: string; scope: string; }
interface Volume    { name: string; driver: string; mountpoint: string; }

// ─── Status chip ──────────────────────────────────────────────────────────────

function StateChip({ state }: { state: string }) {
  const color =
    state === 'running'    ? 'success' :
    state === 'paused'     ? 'warning' :
    state === 'restarting' ? 'info'    :
    state === 'exited'     ? 'error'   : 'default';
  return <Chip label={state} color={color as any} size="small" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DockerManager() {
  const [tab, setTab] = useState(0);

  // Status
  const [dockerStatus, setDockerStatus] = useState<{ installed: boolean; running: boolean; version?: string; compose?: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Containers
  const [containers, setContainers] = useState<Container[]>([]);
  const [containersLoading, setContainersLoading] = useState(false);
  const [logsDialog, setLogsDialog] = useState<{ open: boolean; name: string; content: string }>({ open: false, name: '', content: '' });
  const [runDialog, setRunDialog] = useState(false);
  const [runForm, setRunForm] = useState({ name: '', image: '', ports: '', env: '', restartPolicy: 'unless-stopped' });
  const [runLoading, setRunLoading] = useState(false);

  // Images
  const [images, setImages] = useState<Image[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [pullDialog, setPullDialog] = useState(false);
  const [pullImage, setPullImage] = useState('');
  const [pullLoading, setPullLoading] = useState(false);

  // Stacks
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [stacksLoading, setStacksLoading] = useState(false);
  const [createStackDialog, setCreateStackDialog] = useState(false);
  const [stackForm, setStackForm] = useState({ name: '', projectPath: '', composeContent: DEFAULT_COMPOSE });
  const [stackLogsDialog, setStackLogsDialog] = useState<{ open: boolean; name: string; content: string }>({ open: false, name: '', content: '' });

  // Networks & Volumes
  const [networks, setNetworks] = useState<Network[]>([]);
  const [volumes, setVolumes]   = useState<Volume[]>([]);
  const [infraLoading, setInfraLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const notify = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setToast({ open: true, message, severity });

  // ── Load status ─────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s = await dockerApi.status();
      setDockerStatus(s);
    } catch { setDockerStatus({ installed: false, running: false }); }
    setStatusLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ── Tab loaders ────────────────────────────────────────────────────────────

  const loadContainers = useCallback(async () => {
    setContainersLoading(true);
    try { setContainers((await dockerApi.listContainers()).containers ?? []); }
    catch (e: any) { notify(e.message, 'error'); }
    setContainersLoading(false);
  }, []);

  const loadImages = useCallback(async () => {
    setImagesLoading(true);
    try { setImages((await dockerApi.listImages()).images ?? []); }
    catch (e: any) { notify(e.message, 'error'); }
    setImagesLoading(false);
  }, []);

  const loadStacks = useCallback(async () => {
    setStacksLoading(true);
    try { setStacks((await dockerApi.listStacks()).stacks ?? []); }
    catch (e: any) { notify(e.message, 'error'); }
    setStacksLoading(false);
  }, []);

  const loadInfra = useCallback(async () => {
    setInfraLoading(true);
    try {
      const [n, v] = await Promise.all([dockerApi.listNetworks(), dockerApi.listVolumes()]);
      setNetworks(n.networks ?? []);
      setVolumes(v.volumes ?? []);
    } catch (e: any) { notify(e.message, 'error'); }
    setInfraLoading(false);
  }, []);

  useEffect(() => {
    if (!dockerStatus?.running) return;
    if (tab === 0) loadContainers();
    if (tab === 1) loadImages();
    if (tab === 2) loadStacks();
    if (tab === 3) loadInfra();
  }, [tab, dockerStatus?.running, loadContainers, loadImages, loadStacks, loadInfra]);

  // ── Container actions ──────────────────────────────────────────────────────

  const containerAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(`${action}-${id}`);
    try {
      await dockerApi.containerAction(id, action);
      notify(`Container ${action}ed`);
      loadContainers();
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  const removeContainer = async (id: string, name: string) => {
    if (!confirm(`Remove container "${name}"?`)) return;
    setActionLoading(`rm-${id}`);
    try {
      await dockerApi.removeContainer(id, true);
      notify('Container removed');
      loadContainers();
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  const viewLogs = async (id: string, name: string) => {
    try {
      const r = await dockerApi.containerLogs(id);
      setLogsDialog({ open: true, name, content: r.logs ?? '' });
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const handleRunContainer = async () => {
    setRunLoading(true);
    try {
      await dockerApi.runContainer({
        name: runForm.name,
        image: runForm.image,
        ports: runForm.ports ? runForm.ports.split(',').map(p => p.trim()) : [],
        env: runForm.env ? runForm.env.split(',').map(e => e.trim()) : [],
        restartPolicy: runForm.restartPolicy,
      });
      notify('Container started');
      setRunDialog(false);
      setRunForm({ name: '', image: '', ports: '', env: '', restartPolicy: 'unless-stopped' });
      loadContainers();
    } catch (e: any) { notify(e.message, 'error'); }
    setRunLoading(false);
  };

  // ── Image actions ──────────────────────────────────────────────────────────

  const handlePull = async () => {
    setPullLoading(true);
    try {
      await dockerApi.pullImage(pullImage);
      notify(`Pulled ${pullImage}`);
      setPullDialog(false);
      setPullImage('');
      loadImages();
    } catch (e: any) { notify(e.message, 'error'); }
    setPullLoading(false);
  };

  const removeImage = async (id: string, name: string) => {
    if (!confirm(`Remove image "${name}"?`)) return;
    try {
      await dockerApi.removeImage(id, true);
      notify('Image removed');
      loadImages();
    } catch (e: any) { notify(e.message, 'error'); }
  };

  // ── Compose actions ────────────────────────────────────────────────────────

  const handleCreateStack = async () => {
    try {
      await dockerApi.createStack(stackForm);
      notify('Stack created');
      setCreateStackDialog(false);
      setStackForm({ name: '', projectPath: '', composeContent: DEFAULT_COMPOSE });
      loadStacks();
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const stackAction = async (stack: Stack, action: 'up' | 'down') => {
    setActionLoading(`${action}-${stack.name}`);
    try {
      if (action === 'up') await dockerApi.composeUp(stack.projectPath);
      else await dockerApi.composeDown(stack.projectPath);
      notify(`Stack ${action === 'up' ? 'started' : 'stopped'}`);
      loadStacks();
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  const viewStackLogs = async (stack: Stack) => {
    try {
      const r = await dockerApi.composeLogs(stack.projectPath);
      setStackLogsDialog({ open: true, name: stack.name, content: r.logs ?? '' });
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const deleteStack = async (stack: Stack) => {
    if (!confirm(`Delete stack "${stack.name}"? (files remain on disk)`)) return;
    try {
      await dockerApi.composeDown(stack.projectPath).catch(() => {});
      await dockerApi.deleteStack(stack.name);
      notify('Stack deleted');
      loadStacks();
    } catch (e: any) { notify(e.message, 'error'); }
  };

  // ── Install docker ─────────────────────────────────────────────────────────

  const handleInstall = async () => {
    if (!confirm('Install Docker via get.docker.com? This will run as sudo.')) return;
    try {
      setActionLoading('install');
      await dockerApi.install();
      notify('Docker installed — refreshing status…');
      setTimeout(loadStatus, 3000);
    } catch (e: any) { notify(e.message, 'error'); }
    setActionLoading(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (statusLoading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  const notInstalled = !dockerStatus?.installed;
  const notRunning   = dockerStatus?.installed && !dockerStatus?.running;

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        {/* Header ──────────────────────────────────────────────────────────── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Docker Manager</Typography>
            <Typography variant="body2" color="text.secondary">
              Containers · Images · Compose Stacks · Networks &amp; Volumes
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadStatus}><RefreshIcon /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Status bar ──────────────────────────────────────────────────────── */}
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
              <Chip
                label={dockerStatus?.installed ? 'Installed' : 'Not Installed'}
                color={dockerStatus?.installed ? 'success' : 'error'}
                size="small"
              />
              <Chip
                label={dockerStatus?.running ? 'Daemon Running' : 'Daemon Stopped'}
                color={dockerStatus?.running ? 'success' : 'warning'}
                size="small"
              />
              {dockerStatus?.compose && <Chip label="Compose" color="info" size="small" />}
              {dockerStatus?.version && (
                <Typography variant="caption" color="text.secondary">{dockerStatus.version}</Typography>
              )}
              {notInstalled && (
                <Button size="small" variant="contained" onClick={handleInstall} disabled={actionLoading === 'install'}>
                  {actionLoading === 'install' ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                  Install Docker
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        {notRunning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Docker daemon is installed but not running. Start it with: <code>sudo systemctl start docker</code>
          </Alert>
        )}

        {/* Tabs ────────────────────────────────────────────────────────────── */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Containers" />
            <Tab label="Images" />
            <Tab label="Compose Stacks" />
            <Tab label="Networks &amp; Volumes" />
          </Tabs>
        </Box>

        {/* ── Tab 0: Containers ─────────────────────────────────────────────── */}
        {tab === 0 && (
          <>
            <Stack direction="row" justifyContent="flex-end" mb={1.5} gap={1}>
              <Button size="small" startIcon={<RefreshIcon />} onClick={loadContainers}>Refresh</Button>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setRunDialog(true)}>
                Run Container
              </Button>
            </Stack>
            {containersLoading ? <CircularProgress /> : (
              <TableContainer component={Card}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Ports</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {containers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center">No containers</TableCell></TableRow>
                    ) : containers.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{c.name}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{c.image}</TableCell>
                        <TableCell><StateChip state={c.state} /></TableCell>
                        <TableCell sx={{ fontSize: 12, maxWidth: 180 }}>{c.ports || '—'}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.status}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                            {c.state !== 'running' && (
                              <Tooltip title="Start">
                                <span><IconButton size="small" color="success" onClick={() => containerAction(c.id, 'start')}
                                  disabled={actionLoading === `start-${c.id}`}>
                                  <PlayArrowIcon fontSize="small" />
                                </IconButton></span>
                              </Tooltip>
                            )}
                            {c.state === 'running' && (
                              <Tooltip title="Stop">
                                <span><IconButton size="small" color="warning" onClick={() => containerAction(c.id, 'stop')}
                                  disabled={actionLoading === `stop-${c.id}`}>
                                  <StopIcon fontSize="small" />
                                </IconButton></span>
                              </Tooltip>
                            )}
                            <Tooltip title="Restart">
                              <span><IconButton size="small" onClick={() => containerAction(c.id, 'restart')}
                                disabled={actionLoading === `restart-${c.id}`}>
                                <RestartAltIcon fontSize="small" />
                              </IconButton></span>
                            </Tooltip>
                            <Tooltip title="Logs">
                              <IconButton size="small" onClick={() => viewLogs(c.id, c.name)}>
                                <TerminalIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove">
                              <span><IconButton size="small" color="error" onClick={() => removeContainer(c.id, c.name)}
                                disabled={actionLoading === `rm-${c.id}`}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton></span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {/* ── Tab 1: Images ─────────────────────────────────────────────────── */}
        {tab === 1 && (
          <>
            <Stack direction="row" justifyContent="flex-end" mb={1.5} gap={1}>
              <Button size="small" startIcon={<RefreshIcon />} onClick={loadImages}>Refresh</Button>
              <Button size="small" variant="contained" startIcon={<CloudDownloadIcon />} onClick={() => setPullDialog(true)}>
                Pull Image
              </Button>
            </Stack>
            {imagesLoading ? <CircularProgress /> : (
              <TableContainer component={Card}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Repository</TableCell>
                      <TableCell>Tag</TableCell>
                      <TableCell>ID</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {images.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center">No images</TableCell></TableRow>
                    ) : images.map((img) => (
                      <TableRow key={img.id} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{img.repository}</TableCell>
                        <TableCell><Chip label={img.tag} size="small" variant="outlined" /></TableCell>
                        <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{img.id.slice(0, 12)}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{img.size}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{img.created}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Remove">
                            <IconButton size="small" color="error" onClick={() => removeImage(img.id, `${img.repository}:${img.tag}`)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {/* ── Tab 2: Compose Stacks ─────────────────────────────────────────── */}
        {tab === 2 && (
          <>
            <Stack direction="row" justifyContent="space-between" mb={1.5} alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                Manage docker-compose projects. Point to an existing directory or create a new one.
              </Typography>
              <Stack direction="row" gap={1}>
                <Button size="small" startIcon={<RefreshIcon />} onClick={loadStacks}>Refresh</Button>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateStackDialog(true)}>
                  New Stack
                </Button>
              </Stack>
            </Stack>
            {stacksLoading ? <CircularProgress /> : (
              <Stack gap={1.5}>
                {stacks.length === 0 && (
                  <Card><CardContent><Typography color="text.secondary" align="center">No compose stacks yet</Typography></CardContent></Card>
                )}
                {stacks.map((s) => (
                  <Card key={s.name}>
                    <CardContent>
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
                        <Box>
                          <Typography fontWeight={600}>{s.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{s.projectPath}</Typography>
                          <Stack direction="row" gap={1} mt={0.5}>
                            <StateChip state={s.status} />
                            <Chip label={`${s.services} services`} size="small" variant="outlined" />
                          </Stack>
                        </Box>
                        <Stack direction="row" gap={0.5} flexWrap="wrap">
                          {s.status !== 'running' ? (
                            <Button size="small" variant="contained" color="success" startIcon={<PlayArrowIcon />}
                              onClick={() => stackAction(s, 'up')} disabled={actionLoading === `up-${s.name}`}>
                              Up
                            </Button>
                          ) : (
                            <Button size="small" variant="outlined" color="warning" startIcon={<StopIcon />}
                              onClick={() => stackAction(s, 'down')} disabled={actionLoading === `down-${s.name}`}>
                              Down
                            </Button>
                          )}
                          <Button size="small" startIcon={<TerminalIcon />} onClick={() => viewStackLogs(s)}>Logs</Button>
                          <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => deleteStack(s)}>Delete</Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        )}

        {/* ── Tab 3: Networks & Volumes ─────────────────────────────────────── */}
        {tab === 3 && (
          <>
            <Stack direction="row" justifyContent="flex-end" mb={1.5} gap={1}>
              <Button size="small" startIcon={<RefreshIcon />} onClick={loadInfra}>Refresh</Button>
              <Button size="small" color="warning" startIcon={<BuildIcon />} onClick={async () => {
                if (!confirm('Run docker system prune -f? This removes all stopped containers, dangling images, unused networks.')) return;
                try { await dockerApi.pruneSystem(); notify('System pruned'); loadInfra(); }
                catch (e: any) { notify(e.message, 'error'); }
              }}>Prune System</Button>
            </Stack>
            {infraLoading ? <CircularProgress /> : (
              <Stack gap={3}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>Networks ({networks.length})</Typography>
                  <TableContainer component={Card}>
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell>Name</TableCell><TableCell>Driver</TableCell><TableCell>Scope</TableCell><TableCell>ID</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {networks.map((n) => (
                          <TableRow key={n.id} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{n.name}</TableCell>
                            <TableCell><Chip label={n.driver} size="small" variant="outlined" /></TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{n.scope}</TableCell>
                            <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{n.id?.slice(0, 12)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>Volumes ({volumes.length})</Typography>
                  <TableContainer component={Card}>
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell>Name</TableCell><TableCell>Driver</TableCell><TableCell>Mountpoint</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {volumes.map((v) => (
                          <TableRow key={v.name} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{v.name}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{v.driver}</TableCell>
                            <TableCell sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>{v.mountpoint}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Stack>
            )}
          </>
        )}

        {/* ── Dialogs ────────────────────────────────────────────────────────── */}

        {/* Run Container */}
        <Dialog open={runDialog} onClose={() => setRunDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Run New Container</DialogTitle>
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField label="Container Name" value={runForm.name} onChange={(e) => setRunForm(f => ({ ...f, name: e.target.value }))} fullWidth size="small" />
              <TextField label="Image" placeholder="nginx:latest" value={runForm.image} onChange={(e) => setRunForm(f => ({ ...f, image: e.target.value }))} fullWidth size="small" />
              <TextField label="Ports (comma-separated)" placeholder="8080:80, 443:443" value={runForm.ports} onChange={(e) => setRunForm(f => ({ ...f, ports: e.target.value }))} fullWidth size="small" />
              <TextField label="Env Vars (comma-separated)" placeholder="KEY=value, KEY2=val2" value={runForm.env} onChange={(e) => setRunForm(f => ({ ...f, env: e.target.value }))} fullWidth size="small" />
              <TextField label="Restart Policy" select SelectProps={{ native: true }} value={runForm.restartPolicy} onChange={(e) => setRunForm(f => ({ ...f, restartPolicy: e.target.value }))} size="small">
                {['no', 'always', 'unless-stopped', 'on-failure'].map(o => <option key={o} value={o}>{o}</option>)}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRunDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleRunContainer} disabled={runLoading || !runForm.image || !runForm.name}>
              {runLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null} Run
            </Button>
          </DialogActions>
        </Dialog>

        {/* Pull Image */}
        <Dialog open={pullDialog} onClose={() => setPullDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Pull Image</DialogTitle>
          <DialogContent>
            <TextField label="Image" placeholder="nginx:latest" value={pullImage} onChange={(e) => setPullImage(e.target.value)}
              fullWidth size="small" sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPullDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handlePull} disabled={pullLoading || !pullImage}>
              {pullLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : <CloudDownloadIcon sx={{ fontSize: 16, mr: 0.5 }} />} Pull
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Stack */}
        <Dialog open={createStackDialog} onClose={() => setCreateStackDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create Compose Stack</DialogTitle>
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField label="Stack Name" value={stackForm.name} onChange={(e) => setStackForm(f => ({ ...f, name: e.target.value }))} fullWidth size="small" />
              <TextField label="Project Path (on server)" placeholder="/opt/docker/myapp" value={stackForm.projectPath}
                onChange={(e) => setStackForm(f => ({ ...f, projectPath: e.target.value }))} fullWidth size="small" />
              <Typography variant="caption" color="text.secondary">docker-compose.yml content:</Typography>
              <TextField multiline rows={12} value={stackForm.composeContent}
                onChange={(e) => setStackForm(f => ({ ...f, composeContent: e.target.value }))}
                fullWidth size="small" inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateStackDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateStack} disabled={!stackForm.name || !stackForm.projectPath}>
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Container Logs */}
        <Dialog open={logsDialog.open} onClose={() => setLogsDialog(d => ({ ...d, open: false }))} maxWidth="lg" fullWidth>
          <DialogTitle>Logs — {logsDialog.name}</DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box component="pre" sx={{ m: 0, p: 2, bgcolor: '#0d1117', color: '#e6edf3', fontSize: 12, overflowX: 'auto', maxHeight: '60vh', overflow: 'auto', fontFamily: 'monospace' }}>
              {logsDialog.content || '(no output)'}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLogsDialog(d => ({ ...d, open: false }))}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Stack Logs */}
        <Dialog open={stackLogsDialog.open} onClose={() => setStackLogsDialog(d => ({ ...d, open: false }))} maxWidth="lg" fullWidth>
          <DialogTitle>Stack Logs — {stackLogsDialog.name}</DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box component="pre" sx={{ m: 0, p: 2, bgcolor: '#0d1117', color: '#e6edf3', fontSize: 12, overflowX: 'auto', maxHeight: '60vh', overflow: 'auto', fontFamily: 'monospace' }}>
              {stackLogsDialog.content || '(no output)'}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStackLogsDialog(d => ({ ...d, open: false }))}>Close</Button>
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

const DEFAULT_COMPOSE = `version: '3.8'
services:
  app:
    image: nginx:latest
    ports:
      - "8080:80"
    restart: unless-stopped
`;
