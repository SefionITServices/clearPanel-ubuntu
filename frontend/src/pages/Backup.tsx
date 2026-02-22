import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Chip, Stack,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, TextField,
  Alert, CircularProgress, Grid, Switch, FormControlLabel,
  IconButton, Tooltip, Tabs, Tab,
} from '@mui/material';
import {
  Backup as BackupIcon, CloudDownload, DeleteOutline,
  RestorePage, Schedule, PlayArrow,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { backupApi } from '../api/backup';

/* ─── Types ─────────────────────────────────────────────── */

interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  type: string;
  description: string;
}

interface BackupSchedule {
  enabled: boolean;
  frequency: string;
  time: string;
  retention: number;
  types: string[];
}

/* ─── Helpers ────────────────────────────────────────────── */

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
}

const TYPE_COLORS: Record<string, 'error' | 'primary' | 'secondary' | 'success' | 'warning'> = {
  full: 'error',
  panel: 'primary',
  mail: 'secondary',
  databases: 'success',
  domains: 'warning',
};

/* ═══════════════════════════════════════════════════════════ */

export default function Backup() {
  const [tab, setTab] = useState(0);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState('full');

  // Schedule
  const [schedule, setSchedule] = useState<BackupSchedule>({
    enabled: false, frequency: 'daily', time: '03:00', retention: 7, types: ['full'],
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ action: string; filename: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await backupApi.list();
      setBackups(data.backups || []);
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    } finally { setLoading(false); }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const data = await backupApi.getSchedule();
      if (data.schedule) setSchedule(data.schedule);
    } catch {}
  }, []);

  useEffect(() => { load(); loadSchedule(); }, [load, loadSchedule]);

  /* ─── Actions ──────────────────────────────────────────── */

  const handleCreate = async () => {
    try {
      setCreating(true);
      setCreateOpen(false);
      setToast({ msg: `Creating ${createType} backup… This may take a while.`, sev: 'info' });
      const res = await backupApi.create(createType);
      setToast({ msg: res.message || 'Backup created', sev: res.success ? 'success' : 'error' });
      if (res.success) load();
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    } finally { setCreating(false); }
  };

  const handleDelete = async (filename: string) => {
    try {
      await backupApi.delete(filename);
      setToast({ msg: 'Backup deleted', sev: 'success' });
      load();
    } catch (e: any) { setToast({ msg: e.message, sev: 'error' }); }
    setConfirmAction(null);
  };

  const handleRestore = async (filename: string) => {
    try {
      setToast({ msg: 'Restoring backup… This may take a while.', sev: 'info' });
      const res = await backupApi.restore(filename);
      setToast({ msg: res.message, sev: res.success ? 'success' : 'error' });
    } catch (e: any) { setToast({ msg: e.message, sev: 'error' }); }
    setConfirmAction(null);
  };

  const handleSaveSchedule = async () => {
    try {
      setScheduleLoading(true);
      const res = await backupApi.saveSchedule(schedule);
      setToast({ msg: res.message || 'Schedule saved', sev: res.success ? 'success' : 'error' });
    } catch (e: any) { setToast({ msg: e.message, sev: 'error' }); }
    finally { setScheduleLoading(false); }
  };

  /* ─── Render ───────────────────────────────────────────── */
  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={700}>Backup & Restore</Typography>
          <Button
            variant="contained"
            startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <BackupIcon />}
            disabled={creating}
            onClick={() => setCreateOpen(true)}
          >
            Create Backup
          </Button>
        </Stack>

        {toast && (
          <Alert severity={toast.sev} onClose={() => setToast(null)} sx={{ mb: 2 }}>{toast.msg}</Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Backups" />
          <Tab label="Schedule" />
        </Tabs>

        {/* ═══ TAB 0 — Backup List ════════════════════════════ */}
        {tab === 0 && (
          <Card>
            <CardContent sx={{ p: 0 }}>
              {loading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
              ) : backups.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No backups found. Create your first backup above.</Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Filename</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {backups.map(b => (
                      <TableRow key={b.filename} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{b.filename}</TableCell>
                        <TableCell>
                          <Chip label={b.type} size="small" color={TYPE_COLORS[b.type] || 'default'} />
                        </TableCell>
                        <TableCell>{formatSize(b.size)}</TableCell>
                        <TableCell>{new Date(b.createdAt).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Download">
                            <IconButton size="small" href={backupApi.downloadUrl(b.filename)}>
                              <CloudDownload fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Restore">
                            <IconButton size="small" color="warning"
                              onClick={() => setConfirmAction({ action: 'restore', filename: b.filename })}>
                              <RestorePage fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error"
                              onClick={() => setConfirmAction({ action: 'delete', filename: b.filename })}>
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ TAB 1 — Schedule ═══════════════════════════════ */}
        {tab === 1 && (
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <FormControlLabel
                  control={
                    <Switch checked={schedule.enabled}
                      onChange={e => setSchedule(s => ({ ...s, enabled: e.target.checked }))} />
                  }
                  label="Enable Automatic Backups"
                />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Frequency</InputLabel>
                      <Select value={schedule.frequency} label="Frequency"
                        onChange={e => setSchedule(s => ({ ...s, frequency: e.target.value }))}>
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="weekly">Weekly (Sunday)</MenuItem>
                        <MenuItem value="monthly">Monthly (1st)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth size="small" type="time" label="Time"
                      value={schedule.time}
                      onChange={e => setSchedule(s => ({ ...s, time: e.target.value }))}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth size="small" type="number" label="Keep last N backups"
                      value={schedule.retention}
                      onChange={e => setSchedule(s => ({ ...s, retention: parseInt(e.target.value) || 1 }))}
                      slotProps={{ input: { inputProps: { min: 1, max: 365 } } }}
                    />
                  </Grid>
                </Grid>

                <FormControl fullWidth size="small">
                  <InputLabel>Backup Type</InputLabel>
                  <Select value={schedule.types[0] || 'full'} label="Backup Type"
                    onChange={e => setSchedule(s => ({ ...s, types: [e.target.value] }))}>
                    <MenuItem value="full">Full Server Backup</MenuItem>
                    <MenuItem value="panel">Panel Config Only</MenuItem>
                    <MenuItem value="mail">Mail Data</MenuItem>
                    <MenuItem value="databases">Databases</MenuItem>
                    <MenuItem value="domains">Domains & Webserver</MenuItem>
                  </Select>
                </FormControl>

                <Button variant="contained" startIcon={<Schedule />}
                  disabled={scheduleLoading} onClick={handleSaveSchedule}>
                  Save Schedule
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ═══ Create Dialog ══════════════════════════════════ */}
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Create Backup</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Backup Type</InputLabel>
              <Select value={createType} label="Backup Type"
                onChange={e => setCreateType(e.target.value)}>
                <MenuItem value="full">Full Server Backup</MenuItem>
                <MenuItem value="panel">Panel Configuration</MenuItem>
                <MenuItem value="mail">Mail Data</MenuItem>
                <MenuItem value="databases">Databases</MenuItem>
                <MenuItem value="domains">Domains & Webserver</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" mt={2}>
              {createType === 'full' && 'Backs up everything: configs, databases, mail, domains, and SSL certificates.'}
              {createType === 'panel' && 'Backs up ClearPanel configuration files only.'}
              {createType === 'mail' && 'Backs up Postfix, Dovecot, OpenDKIM, and mailbox data.'}
              {createType === 'databases' && 'Dumps all MySQL/MariaDB and PostgreSQL databases.'}
              {createType === 'domains' && 'Backs up Nginx vhosts, DNS zones, and SSL certificates.'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="contained" startIcon={<PlayArrow />} onClick={handleCreate}>Create</Button>
          </DialogActions>
        </Dialog>

        {/* ═══ Confirm Dialog ═════════════════════════════════ */}
        <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth>
          <DialogTitle>
            {confirmAction?.action === 'restore' ? 'Restore Backup?' : 'Delete Backup?'}
          </DialogTitle>
          <DialogContent>
            <Typography>
              {confirmAction?.action === 'restore'
                ? 'This will overwrite existing files. Services may need to be restarted. Are you sure?'
                : 'This backup will be permanently deleted. Are you sure?'}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1} fontFamily="monospace">
              {confirmAction?.filename}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button variant="contained" color={confirmAction?.action === 'restore' ? 'warning' : 'error'}
              onClick={() => {
                if (confirmAction?.action === 'restore') handleRestore(confirmAction.filename);
                else if (confirmAction?.action === 'delete') handleDelete(confirmAction.filename);
              }}>
              {confirmAction?.action === 'restore' ? 'Restore' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
