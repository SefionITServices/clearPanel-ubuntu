import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Alert, CircularProgress, Chip, Tabs, Tab,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  LinearProgress,
} from '@mui/material';
import {
  Refresh, Stop, PlayArrow, RestartAlt, Search,
  DeleteOutline,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { processApi } from '../api/process';

/* ─── Types ─────────────────────────────────────────────── */

interface ProcessInfo {
  pid: number; user: string; cpu: number; mem: number;
  vsz: number; rss: number; tty: string; stat: string;
  started: string; time: string; command: string;
}

interface ServiceInfo {
  name: string; active: boolean; enabled: boolean; description: string;
}

/* ─── Helpers ────────────────────────────────────────────── */

function formatKB(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(2)} GB`;
}

/* ═══════════════════════════════════════════════════════════ */

export default function Processes() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Services
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcSearch, setSvcSearch] = useState('');

  // Kill dialog
  const [killTarget, setKillTarget] = useState<ProcessInfo | null>(null);
  const [killSignal, setKillSignal] = useState('SIGTERM');

  const loadProcesses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await processApi.list(sortBy);
      setProcesses(data.processes || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    } finally { setLoading(false); }
  }, [sortBy]);

  const loadServices = useCallback(async () => {
    try {
      setSvcLoading(true);
      const data = await processApi.listServices();
      setServices(data.services || []);
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    } finally { setSvcLoading(false); }
  }, []);

  useEffect(() => { loadProcesses(); }, [loadProcesses]);
  useEffect(() => { if (tab === 1) loadServices(); }, [tab, loadServices]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(loadProcesses, 5000);
    return () => clearInterval(iv);
  }, [autoRefresh, loadProcesses]);

  /* ─── Actions ──────────────────────────────────────────── */

  const handleKill = async () => {
    if (!killTarget) return;
    try {
      const res = await processApi.kill(killTarget.pid, killSignal);
      setToast({ msg: res.message, sev: res.success ? 'success' : 'error' });
      if (res.success) loadProcesses();
    } catch (e: any) { setToast({ msg: e.message, sev: 'error' }); }
    setKillTarget(null);
  };

  const handleServiceAction = async (name: string, action: string) => {
    try {
      setToast({ msg: `${action}ing ${name}...`, sev: 'info' });
      const res = await processApi.controlService(name, action);
      setToast({ msg: res.message, sev: res.success ? 'success' : 'error' });
      if (res.success) loadServices();
    } catch (e: any) { setToast({ msg: e.message, sev: 'error' }); }
  };

  /* ─── Filter ───────────────────────────────────────────── */
  const filtered = processes.filter(p =>
    !search || p.command.toLowerCase().includes(search.toLowerCase()) ||
    p.user.toLowerCase().includes(search.toLowerCase()) ||
    p.pid.toString().includes(search)
  );

  const filteredSvc = services.filter(s =>
    !svcSearch || s.name.toLowerCase().includes(svcSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(svcSearch.toLowerCase())
  );

  /* ─── Render ───────────────────────────────────────────── */

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={700}>Process Manager</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant={autoRefresh ? 'contained' : 'outlined'}
              onClick={() => setAutoRefresh(v => !v)}>
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => { loadProcesses(); if (tab === 1) loadServices(); }}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        {toast && (
          <Alert severity={toast.sev} onClose={() => setToast(null)} sx={{ mb: 2 }}>{toast.msg}</Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Processes (${total})`} />
          <Tab label="Services" />
        </Tabs>

        {/* ═══ TAB 0 — Processes ══════════════════════════════ */}
        {tab === 0 && (
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Stack direction="row" spacing={2} sx={{ p: 2 }} alignItems="center">
                <TextField
                  size="small" placeholder="Search processes…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> } }}
                  sx={{ flexGrow: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Sort by</InputLabel>
                  <Select value={sortBy} label="Sort by"
                    onChange={e => setSortBy(e.target.value as any)}>
                    <MenuItem value="cpu">CPU %</MenuItem>
                    <MenuItem value="mem">Memory %</MenuItem>
                    <MenuItem value="pid">PID</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {loading && <LinearProgress />}

              <Table size="small" sx={{ '& td, & th': { fontSize: 13 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>PID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>CPU %</TableCell>
                    <TableCell>Mem %</TableCell>
                    <TableCell>RSS</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Command</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.slice(0, 200).map(p => (
                    <TableRow key={p.pid} hover>
                      <TableCell>{p.pid}</TableCell>
                      <TableCell>{p.user}</TableCell>
                      <TableCell>
                        <Typography color={p.cpu > 50 ? 'error.main' : p.cpu > 10 ? 'warning.main' : 'text.primary'}
                          fontWeight={p.cpu > 10 ? 700 : 400} fontSize={13}>
                          {p.cpu.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography color={p.mem > 50 ? 'error.main' : p.mem > 10 ? 'warning.main' : 'text.primary'}
                          fontWeight={p.mem > 10 ? 700 : 400} fontSize={13}>
                          {p.mem.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatKB(p.rss)}</TableCell>
                      <TableCell>
                        <Chip label={p.stat} size="small" variant="outlined"
                          color={p.stat.startsWith('R') ? 'success' : p.stat.startsWith('S') ? 'primary' : p.stat.startsWith('Z') ? 'error' : 'default'} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {p.command}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Kill process">
                          <IconButton size="small" color="error" onClick={() => { setKillTarget(p); setKillSignal('SIGTERM'); }}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ═══ TAB 1 — Services ═══════════════════════════════ */}
        {tab === 1 && (
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2 }}>
                <TextField
                  size="small" placeholder="Search services…" fullWidth
                  value={svcSearch} onChange={e => setSvcSearch(e.target.value)}
                  slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> } }}
                />
              </Box>

              {svcLoading && <LinearProgress />}

              <Table size="small" sx={{ '& td, & th': { fontSize: 13 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Enabled</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSvc.map(s => (
                    <TableRow key={s.name} hover>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{s.name}</TableCell>
                      <TableCell>
                        <Chip label={s.active ? 'Running' : 'Stopped'} size="small"
                          color={s.active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>
                        <Chip label={s.enabled ? 'Enabled' : 'Disabled'} size="small" variant="outlined"
                          color={s.enabled ? 'primary' : 'default'} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.description}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {!s.active && (
                            <Tooltip title="Start">
                              <IconButton size="small" color="success"
                                onClick={() => handleServiceAction(s.name, 'start')}>
                                <PlayArrow fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {s.active && (
                            <>
                              <Tooltip title="Stop">
                                <IconButton size="small" color="error"
                                  onClick={() => handleServiceAction(s.name, 'stop')}>
                                  <Stop fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Restart">
                                <IconButton size="small" color="warning"
                                  onClick={() => handleServiceAction(s.name, 'restart')}>
                                  <RestartAlt fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ═══ Kill Dialog ════════════════════════════════════ */}
        <Dialog open={!!killTarget} onClose={() => setKillTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Kill Process</DialogTitle>
          <DialogContent>
            <Typography mb={2}>
              Send signal to PID <strong>{killTarget?.pid}</strong>?
            </Typography>
            <Typography variant="body2" color="text.secondary" fontFamily="monospace" mb={2}>
              {killTarget?.command}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Signal</InputLabel>
              <Select value={killSignal} label="Signal"
                onChange={e => setKillSignal(e.target.value)}>
                <MenuItem value="SIGTERM">SIGTERM (graceful)</MenuItem>
                <MenuItem value="SIGKILL">SIGKILL (force)</MenuItem>
                <MenuItem value="SIGHUP">SIGHUP (reload)</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setKillTarget(null)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleKill}>Send Signal</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
