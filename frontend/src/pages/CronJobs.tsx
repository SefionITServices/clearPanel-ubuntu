import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Stack,
  CircularProgress, Tabs, Tab, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Divider, MenuItem, Select, FormControl,
  InputLabel, Switch, FormControlLabel,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import CodeIcon from '@mui/icons-material/Code';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { cronApi } from '../api/cron';

// ─── Types ────────────────────────────────────────────────────────────

interface CronJob {
  id: number;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  command: string;
  schedule: string;
  description: string;
  enabled: boolean;
}

// ─── Common Presets ───────────────────────────────────────────────────

const PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Weekly on Sunday', value: '0 0 * * 0' },
  { label: 'Monthly on the 1st', value: '0 0 1 * *' },
  { label: 'On reboot', value: '@reboot' },
  { label: 'Custom', value: '' },
];

// ─── Main Component ───────────────────────────────────────────────────

export default function CronJobsPage() {
  const [tab, setTab] = useState(0);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editJob, setEditJob] = useState<CronJob | null>(null);
  const [rawContent, setRawContent] = useState('');
  const [rawLoading, setRawLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const toast = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cronApi.list();
      if (data.success) setJobs(data.jobs || []);
      else toast(data.error || 'Failed to load cron jobs', 'error');
    } catch (e: any) {
      toast(e.message, 'error');
      setJobs([]);
    } finally { setLoading(false); }
  }, []);

  const loadRaw = useCallback(async () => {
    setRawLoading(true);
    try {
      const data = await cronApi.getRaw();
      if (data.success) setRawContent(data.content || '');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally { setRawLoading(false); }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (tab === 1) loadRaw();
  }, [tab, loadRaw]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this cron job?')) return;
    try {
      const data = await cronApi.delete(id);
      data.success ? toast('Cron job deleted') : toast(data.message || 'Failed', 'error');
    } catch (e: any) {
      toast(e.message, 'error');
    }
    loadJobs();
  };

  const handleToggle = async (id: number, currentEnabled: boolean) => {
    try {
      const data = await cronApi.toggle(id, !currentEnabled);
      data.success
        ? toast(currentEnabled ? 'Cron job disabled' : 'Cron job enabled')
        : toast(data.message || 'Failed', 'error');
    } catch (e: any) {
      toast(e.message, 'error');
    }
    loadJobs();
  };

  const handleSaveRaw = async () => {
    try {
      const data = await cronApi.saveRaw(rawContent);
      data.success ? toast('Crontab saved') : toast(data.message || 'Failed', 'error');
      loadJobs();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const openAdd = () => { setEditJob(null); setDialogOpen(true); };
  const openEdit = (job: CronJob) => { setEditJob(job); setDialogOpen(true); };

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ScheduleIcon sx={{ color: '#FBBC04', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>Cron Jobs</Typography>
              <Typography variant="body1" color="text.secondary">
                Schedule recurring tasks and commands
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadJobs} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} sx={{ textTransform: 'none' }}>
              Add Cron Job
            </Button>
          </Stack>
        </Box>

        {/* Tabs */}
        <Card elevation={0} sx={{ mb: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              px: 2,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, minHeight: 48 },
            }}
          >
            <Tab icon={<ScheduleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Cron Jobs" />
            <Tab icon={<CodeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Raw Crontab" />
          </Tabs>
        </Card>

        {/* Tab Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {tab === 0 && (
              <CronJobsList
                jobs={jobs}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onAdd={openAdd}
              />
            )}
            {tab === 1 && (
              <RawCrontabTab
                content={rawContent}
                onChange={setRawContent}
                onSave={handleSaveRaw}
                loading={rawLoading}
              />
            )}
          </>
        )}

        {/* Add/Edit Dialog */}
        <CronJobDialog
          open={dialogOpen}
          job={editJob}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            loadJobs();
            toast(editJob ? 'Cron job updated' : 'Cron job added');
          }}
          toast={toast}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  CRON JOBS LIST  
// ═══════════════════════════════════════════════════════════════════════

function CronJobsList({
  jobs, onEdit, onDelete, onToggle, onAdd,
}: {
  jobs: CronJob[];
  onEdit: (job: CronJob) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, enabled: boolean) => void;
  onAdd: () => void;
}) {
  if (jobs.length === 0) {
    return (
      <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <ScheduleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No cron jobs configured
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first scheduled task to automate commands
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ textTransform: 'none' }}>
            Add Cron Job
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {jobs.map(job => (
        <Card
          key={job.id}
          elevation={0}
          sx={{
            border: t => `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            opacity: job.enabled ? 1 : 0.6,
            transition: 'all 0.2s',
            '&:hover': { borderColor: '#FBBC04' },
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    width: 48, height: 48, borderRadius: 2,
                    bgcolor: job.enabled ? '#FBBC0414' : '#9E9E9E14',
                    color: job.enabled ? '#FBBC04' : '#9E9E9E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={job.schedule}
                      sx={{
                        height: 22, fontSize: '0.7rem', fontWeight: 700,
                        fontFamily: 'monospace',
                        bgcolor: job.enabled ? '#FBBC0418' : '#9E9E9E18',
                        color: job.enabled ? '#F57F17' : '#9E9E9E',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {job.description}
                    </Typography>
                    {!job.enabled && (
                      <Chip size="small" label="Disabled" color="default"
                        sx={{ height: 18, fontSize: '0.6rem' }} />
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5, fontFamily: '"Fira Code", "Cascadia Code", monospace',
                      fontSize: '0.78rem', color: 'text.primary',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {job.command}
                  </Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, ml: 2 }}>
                <Tooltip title={job.enabled ? 'Disable' : 'Enable'}>
                  <IconButton size="small" onClick={() => onToggle(job.id, job.enabled)}
                    color={job.enabled ? 'success' : 'default'}>
                    {job.enabled ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => onEdit(job)} color="primary">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={() => onDelete(job.id)} color="error">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  RAW CRONTAB TAB
// ═══════════════════════════════════════════════════════════════════════

function RawCrontabTab({
  content, onChange, onSave, loading,
}: {
  content: string;
  onChange: (v: string) => void;
  onSave: () => void;
  loading: boolean;
}) {
  return (
    <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Raw Crontab</Typography>
            <Typography variant="body2" color="text.secondary">
              Edit the crontab file directly — for advanced users
            </Typography>
          </Box>
          <Button variant="contained" onClick={onSave} disabled={loading} sx={{ textTransform: 'none' }}>
            Save Crontab
          </Button>
        </Box>
        <Box sx={{ p: 1.5, mb: 2, borderRadius: 1.5, bgcolor: '#FEF7E0', border: '1px solid #FDE293' }}>
          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: '#F9AB00' }}>
            <InfoOutlinedIcon sx={{ fontSize: 14 }} /> Warning
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Invalid syntax will cause all cron jobs to fail. Format: minute hour day month weekday command
          </Typography>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <TextField
            fullWidth
            multiline
            minRows={12}
            maxRows={30}
            value={content}
            onChange={e => onChange(e.target.value)}
            placeholder="# m h dom mon dow command"
            sx={{
              '& textarea': {
                fontFamily: '"Fira Code", "Cascadia Code", monospace',
                fontSize: '0.8rem',
                lineHeight: 1.6,
              },
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ADD / EDIT DIALOG
// ═══════════════════════════════════════════════════════════════════════

function CronJobDialog({
  open, job, onClose, onSaved, toast,
}: {
  open: boolean;
  job: CronJob | null;
  onClose: () => void;
  onSaved: () => void;
  toast: (msg: string, sev?: 'success' | 'error' | 'info') => void;
}) {
  const isEdit = !!job;
  const [preset, setPreset] = useState('');
  const [minute, setMinute] = useState('*');
  const [hour, setHour] = useState('*');
  const [dayOfMonth, setDayOfMonth] = useState('*');
  const [month, setMonth] = useState('*');
  const [dayOfWeek, setDayOfWeek] = useState('*');
  const [command, setCommand] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (job) {
        setMinute(job.minute || '*');
        setHour(job.hour || '*');
        setDayOfMonth(job.dayOfMonth || '*');
        setMonth(job.month || '*');
        setDayOfWeek(job.dayOfWeek || '*');
        setCommand(job.command || '');

        // Check if it matches a preset
        const sched = job.schedule;
        const matchedPreset = PRESETS.find(p => p.value === sched);
        setPreset(matchedPreset ? sched : '');
      } else {
        setPreset('');
        setMinute('*');
        setHour('*');
        setDayOfMonth('*');
        setMonth('*');
        setDayOfWeek('*');
        setCommand('');
      }
    }
  }, [open, job]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (!value) return;
    if (value.startsWith('@')) {
      setMinute(''); setHour(''); setDayOfMonth(''); setMonth(''); setDayOfWeek('');
    } else {
      const parts = value.split(' ');
      if (parts.length === 5) {
        setMinute(parts[0]);
        setHour(parts[1]);
        setDayOfMonth(parts[2]);
        setMonth(parts[3]);
        setDayOfWeek(parts[4]);
      }
    }
  };

  const getSchedule = (): string => {
    if (preset && preset.startsWith('@')) return preset;
    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  };

  const handleSave = async () => {
    const schedule = getSchedule();
    if (!command.trim()) {
      toast('Command is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = isEdit
        ? await cronApi.update(job!.id, schedule, command.trim())
        : await cronApi.add(schedule, command.trim());
      if (data.success) {
        onSaved();
      } else {
        toast(data.message || 'Failed', 'error');
      }
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setSaving(false);
  };

  const isSpecialPreset = preset && preset.startsWith('@');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScheduleIcon color="warning" />
        {isEdit ? 'Edit Cron Job' : 'Add Cron Job'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {/* Preset */}
          <FormControl fullWidth size="small">
            <InputLabel>Schedule Preset</InputLabel>
            <Select
              value={preset}
              label="Schedule Preset"
              onChange={e => handlePresetChange(e.target.value as string)}
            >
              {PRESETS.map(p => (
                <MenuItem key={p.label} value={p.value}>
                  {p.label} {p.value && <Typography component="span" variant="caption" sx={{ ml: 1, fontFamily: 'monospace', color: 'text.secondary' }}>({p.value})</Typography>}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Custom fields (hidden if special preset) */}
          {!isSpecialPreset && (
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Schedule (cron expression)
                </Typography>
              </Grid>
              <Grid size={{ xs: 2.4 }}>
                <TextField fullWidth size="small" label="Min" value={minute}
                  onChange={e => { setMinute(e.target.value); setPreset(''); }}
                  helperText="0-59" sx={{ '& input': { fontFamily: 'monospace', textAlign: 'center' } }} />
              </Grid>
              <Grid size={{ xs: 2.4 }}>
                <TextField fullWidth size="small" label="Hour" value={hour}
                  onChange={e => { setHour(e.target.value); setPreset(''); }}
                  helperText="0-23" sx={{ '& input': { fontFamily: 'monospace', textAlign: 'center' } }} />
              </Grid>
              <Grid size={{ xs: 2.4 }}>
                <TextField fullWidth size="small" label="Day" value={dayOfMonth}
                  onChange={e => { setDayOfMonth(e.target.value); setPreset(''); }}
                  helperText="1-31" sx={{ '& input': { fontFamily: 'monospace', textAlign: 'center' } }} />
              </Grid>
              <Grid size={{ xs: 2.4 }}>
                <TextField fullWidth size="small" label="Month" value={month}
                  onChange={e => { setMonth(e.target.value); setPreset(''); }}
                  helperText="1-12" sx={{ '& input': { fontFamily: 'monospace', textAlign: 'center' } }} />
              </Grid>
              <Grid size={{ xs: 2.4 }}>
                <TextField fullWidth size="small" label="Wday" value={dayOfWeek}
                  onChange={e => { setDayOfWeek(e.target.value); setPreset(''); }}
                  helperText="0-6" sx={{ '& input': { fontFamily: 'monospace', textAlign: 'center' } }} />
              </Grid>
            </Grid>
          )}

          {/* Preview */}
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#E8F0FE', border: '1px solid #C2D7FE' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#1A73E8' }}>
              Schedule Preview
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
              {getSchedule()}
            </Typography>
          </Box>

          {/* Command */}
          <TextField
            fullWidth
            label="Command"
            placeholder="/usr/bin/php /home/user/script.php"
            value={command}
            onChange={e => setCommand(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            sx={{
              '& textarea': {
                fontFamily: '"Fira Code", "Cascadia Code", monospace',
                fontSize: '0.85rem',
              },
            }}
          />

          {/* Help */}
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#F8F9FA', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Cron Expression Reference
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: 1.8 }}>
              *&nbsp;&nbsp;&nbsp;&nbsp;= any value<br />
              */5&nbsp;&nbsp;= every 5 units<br />
              1,15 = at 1 and 15<br />
              1-5&nbsp;&nbsp;= range 1 through 5
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !command.trim()}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          sx={{ textTransform: 'none' }}
        >
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Cron Job'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
