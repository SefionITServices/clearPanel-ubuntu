import React, { useEffect, useState } from 'react';
import {
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
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Typography,
  Tooltip,
  Paper,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import TerminalIcon from '@mui/icons-material/Terminal';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { dockerApi } from '../api/docker';
import { nodeAppsApi, AppDef } from '../api/node-apps';
import { systemApi } from '../api/system';

function StateChip({ state }: { state: string }) {
  const color = state === 'running' ? 'success' : state === 'paused' ? 'warning' : state === 'exited' ? 'error' : 'default';
  return <Chip label={state} color={color as any} size="small" />;
}

function parseHostPortFromPortsString(ports: string): number | null {
  if (!ports) return null;
  try {
    const parts = ports.split(',').map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      const m = p.match(/(\d+)(?=->\d+\/\w+)/);
      if (m && m[1]) {
        const num = Number(m[1]);
        if (Number.isInteger(num)) return num;
      }
    }
  } catch {}
  return null;
}

function detectPortFromCommand(cmd: string): number | null {
  if (!cmd) return null;
  // look for common patterns: --port 3000, --port=3000, PORT=3000, :3000->, listen on 3000
  const re1 = /--port[= ]?(\d{2,5})/i;
  const re2 = /PORT=(\d{2,5})/i;
  const re3 = /:(\d{2,5})->/;
  const re4 = /listen(?:ing)?(?: on)?(?:\s+)?(\d{2,5})/i;
  const m = cmd.match(re1) || cmd.match(re2) || cmd.match(re3) || cmd.match(re4);
  if (m && m[1]) return Number(m[1]);
  return null;
}

export default function ServicesPage() {
  const [tab, setTab] = useState(0);

  const [containers, setContainers] = useState<any[]>([]);
  const [containersLoading, setContainersLoading] = useState(false);

  const [apps, setApps] = useState<AppDef[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const [processes, setProcesses] = useState<any[]>([]);
  const [processesLoading, setProcessesLoading] = useState(false);

  const [services, setServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  const [logsDialog, setLogsDialog] = useState<{ open: boolean; title: string; content: string }>({ open: false, title: '', content: '' });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    await Promise.all([loadContainers(), loadApps(), loadProcesses(), loadServices()]);
  }

  async function loadContainers() {
    setContainersLoading(true);
    try {
      const res = await dockerApi.listContainers();
      setContainers(((res as any)?.containers ?? (res as any) ?? []));
    } catch (e: any) {
      console.error(e);
    } finally { setContainersLoading(false); }
  }

  async function loadApps() {
    setAppsLoading(true);
    try {
      const res = await nodeAppsApi.list();
      setApps((res as any).apps ?? []);
    } catch (e: any) {
      console.error(e);
    } finally { setAppsLoading(false); }
  }

  async function loadProcesses() {
    setProcessesLoading(true);
    try {
      const res = await systemApi.listProcesses('cpu', 100);
      setProcesses((res as any).processes ?? []);
    } catch (e: any) {
      console.error(e);
    } finally { setProcessesLoading(false); }
  }

  async function loadServices() {
    setServicesLoading(true);
    try {
      // Prefer monitoring services list for common services
      const m = await systemApi.getMonitoringServices().catch(() => null);
      if (m && (m as any).success) {
        setServices((m as any).data ?? []);
      } else {
        const s = await systemApi.listServices();
        setServices((s as any).services ?? []);
      }
    } catch (e: any) {
      console.error(e);
    } finally { setServicesLoading(false); }
  }

  const viewDockerLogs = async (id: string, name: string) => {
    try {
      const r = await dockerApi.containerLogs(id);
      setLogsDialog({ open: true, title: `Container: ${name}`, content: r.logs ?? '' });
    } catch (e: any) { console.error(e); }
  };

  const viewAppLogs = async (id: string, name: string) => {
    try {
      const r = await nodeAppsApi.logs(id as string, 200);
      setLogsDialog({ open: true, title: `App: ${name}`, content: r.logs ?? '' });
    } catch (e: any) { console.error(e); }
  };

  const viewProcessDetails = async (pid: number) => {
    try {
      const r = await systemApi.getProcessDetails(pid);
      setLogsDialog({ open: true, title: `PID ${pid} details`, content: JSON.stringify(r.process ?? r, null, 2) });
    } catch (e: any) { console.error(e); }
  };

  const controlApp = async (id: string, action: 'start' | 'stop' | 'restart') => {
    try {
      if (action === 'start') await nodeAppsApi.start(id);
      if (action === 'stop') await nodeAppsApi.stop(id);
      if (action === 'restart') await nodeAppsApi.restart(id);
      await loadApps();
    } catch (e: any) { console.error(e); }
  };

  const controlService = async (name: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') => {
    try {
      await systemApi.controlService(name, action);
      await loadServices();
    } catch (e: any) { console.error(e); }
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Servers & Services</Typography>
            <Typography variant="body2" color="text.secondary">Overview of running servers: Docker, node apps and system processes</Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Tooltip title="Refresh all">
              <IconButton onClick={loadAll}><RefreshIcon /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Docker" />
          <Tab label="Node Apps" />
          <Tab label="Processes" />
          <Tab label="Services" />
        </Tabs>

        {tab === 0 && (
          <>
            {containersLoading ? <CircularProgress /> : (
              <TableContainer component={Card}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Ports</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {containers.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{c.name}</TableCell>
                        <TableCell>{c.image}</TableCell>
                        <TableCell><StateChip state={c.state} /></TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{c.ports || '—'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => viewDockerLogs(c.id, c.name)}>Logs</Button>
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

        {tab === 1 && (
          <>
            {appsLoading ? <CircularProgress /> : (
              <TableContainer component={Card}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Runtime</TableCell>
                      <TableCell>PID</TableCell>
                      <TableCell>Port</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apps.map((a) => (
                      <TableRow key={a.id} hover>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>{a.runtime}</TableCell>
                        <TableCell>{a.pid ?? '-'}</TableCell>
                        <TableCell>{a.port ?? '-'}</TableCell>
                        <TableCell>{a.status ?? '-'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => viewAppLogs(a.id, a.name)}>Logs</Button>
                            <Button size="small" onClick={() => controlApp(a.id, 'restart')}>Restart</Button>
                            {a.status === 'running' ? (
                              <Button size="small" onClick={() => controlApp(a.id, 'stop')}>Stop</Button>
                            ) : (
                              <Button size="small" onClick={() => controlApp(a.id, 'start')}>Start</Button>
                            )}
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

        {tab === 2 && (
          <>
            {processesLoading ? <CircularProgress /> : (
              <TableContainer component={Card}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>PID</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>CPU</TableCell>
                      <TableCell>MEM</TableCell>
                      <TableCell>Command</TableCell>
                      <TableCell>Detected Port</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processes.filter(p => /node|npm|yarn|vite|react-scripts|python|gunicorn|uvicorn|django|flask|http-server|serve/i.test(p.command)).map((p) => (
                      <TableRow key={p.pid} hover>
                        <TableCell>{p.pid}</TableCell>
                        <TableCell>{p.user}</TableCell>
                        <TableCell>{p.cpu}%</TableCell>
                        <TableCell>{p.mem}%</TableCell>
                        <TableCell sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.command}</TableCell>
                        <TableCell>{detectPortFromCommand(p.command) ?? '-'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => viewProcessDetails(p.pid)}>Details</Button>
                            <Button size="small" color="error" onClick={async () => { if (confirm(`Kill process ${p.pid}?`)) { await fetch(`/api/processes/${p.pid}`, { method: 'DELETE' }); await loadProcesses(); } }}>Kill</Button>
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

        {tab === 3 && (
          <>
            {servicesLoading ? <CircularProgress /> : (
              <TableContainer component={Card}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell>Enabled</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {services.map((s: any) => (
                      <TableRow key={s.name || s} hover>
                        <TableCell>{s.name ?? s}</TableCell>
                        <TableCell>{s.active ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{s.enabled ? 'Yes' : '-'}</TableCell>
                        <TableCell>{s.description || '-'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => controlService(s.name, 'restart')}>Restart</Button>
                            {s.active ? (
                              <Button size="small" onClick={() => controlService(s.name, 'stop')}>Stop</Button>
                            ) : (
                              <Button size="small" onClick={() => controlService(s.name, 'start')}>Start</Button>
                            )}
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

        <Dialog open={logsDialog.open} onClose={() => setLogsDialog({ open: false, title: '', content: '' })} maxWidth="lg" fullWidth>
          <DialogTitle>{logsDialog.title}</DialogTitle>
          <DialogContent>
            <Paper sx={{ p: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '60vh' }}>{logsDialog.content}</Paper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLogsDialog({ open: false, title: '', content: '' })}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
