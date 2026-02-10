import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Stack, alpha,
  CircularProgress, Tabs, Tab, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Switch, Divider, LinearProgress, InputAdornment,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StarIcon from '@mui/icons-material/Star';
import ExtensionIcon from '@mui/icons-material/Extension';
import TuneIcon from '@mui/icons-material/Tune';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CodeIcon from '@mui/icons-material/Code';

// ─── Types ────────────────────────────────────────────────────────────

interface PhpVersion {
  version: string;
  installed: boolean;
  active: boolean;
  fpmRunning: boolean;
  fpmEnabled: boolean;
  fpmSocketPath: string;
}

interface PhpExtension {
  name: string;
  enabled: boolean;
}

interface PhpIniConfig {
  version: string;
  directives: Record<string, string>;
  iniPath: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

// ─── API ──────────────────────────────────────────────────────────────

const phpAPI = {
  versions: () => fetch('/api/php/versions').then(r => r.json()),
  install: (v: string) => fetch(`/api/php/versions/${v}/install`, { method: 'POST' }).then(r => r.json()),
  uninstall: (v: string) => fetch(`/api/php/versions/${v}`, { method: 'DELETE' }).then(r => r.json()),
  setDefault: (v: string) => fetch(`/api/php/versions/${v}/default`, { method: 'POST' }).then(r => r.json()),
  fpmAction: (v: string, action: string) => fetch(`/api/php/versions/${v}/fpm/${action}`, { method: 'POST' }).then(r => r.json()),
  getConfig: (v: string) => fetch(`/api/php/config/${v}`).then(r => r.json()),
  setConfig: (v: string, directives: Record<string, string>) =>
    fetch(`/api/php/config/${v}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directives }),
    }).then(r => r.json()),
  extensions: (v: string) => fetch(`/api/php/extensions/${v}`).then(r => r.json()),
  installExt: (v: string, ext: string) => fetch(`/api/php/extensions/${v}/${ext}`, { method: 'POST' }).then(r => r.json()),
  removeExt: (v: string, ext: string) => fetch(`/api/php/extensions/${v}/${ext}`, { method: 'DELETE' }).then(r => r.json()),
  logs: (v: string, lines = 100) => fetch(`/api/php/logs/${v}?lines=${lines}`).then(r => r.json()),
};

// ─── Color helpers ────────────────────────────────────────────────────

const KNOWN_VERSIONS = ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4'];

const VERSION_COLORS: Record<string, string> = {
  '7.4': '#8892BF', '8.0': '#777BB3', '8.1': '#4F5B93',
  '8.2': '#7B68EE', '8.3': '#4285F4', '8.4': '#1A73E8',
};

const LOG_LEVEL_COLORS: Record<string, string> = {
  ERROR: '#EA4335', CRITICAL: '#EA4335', ALERT: '#EA4335',
  WARNING: '#FBBC04', NOTICE: '#4285F4', INFO: '#34A853',
};

// ─── Main Component ───────────────────────────────────────────────────

export default function PhpManagerPage() {
  const [tab, setTab] = useState(0);
  const [versions, setVersions] = useState<PhpVersion[]>([]);
  const [defaultVersion, setDefaultVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // version being operated on
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const toast = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });

  // Fallback: if API fails, still show all known versions as available to install
  const fallbackVersions: PhpVersion[] = KNOWN_VERSIONS.map(v => ({
    version: v, installed: false, active: false,
    fpmRunning: false, fpmEnabled: false, fpmSocketPath: `/var/run/php/php${v}-fpm.sock`,
  }));

  const loadVersions = useCallback(async () => {
    try {
      const data = await phpAPI.versions();
      if (data.success && data.versions?.length) {
        setVersions(data.versions);
        setDefaultVersion(data.defaultVersion || '');
      } else {
        // API returned but no versions — show fallback
        setVersions(fallbackVersions);
      }
    } catch {
      // API unreachable — still show all versions so user can install
      setVersions(fallbackVersions);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const installedVersions = versions.filter(v => v.installed);
  const selectedVersion = installedVersions.length > 0
    ? installedVersions.find(v => v.active)?.version || installedVersions[0].version
    : '';

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleInstall = async (ver: string) => {
    setBusy(ver);
    const data = await phpAPI.install(ver);
    data.success ? toast(`PHP ${ver} installed`) : toast(data.message || 'Install failed', 'error');
    await loadVersions();
    setBusy(null);
  };

  const handleUninstall = async (ver: string) => {
    setBusy(ver);
    const data = await phpAPI.uninstall(ver);
    data.success ? toast(`PHP ${ver} uninstalled`) : toast(data.message || 'Uninstall failed', 'error');
    await loadVersions();
    setBusy(null);
  };

  const handleSetDefault = async (ver: string) => {
    setBusy(ver);
    const data = await phpAPI.setDefault(ver);
    data.success ? toast(`Default set to PHP ${ver}`) : toast(data.message || 'Failed', 'error');
    await loadVersions();
    setBusy(null);
  };

  const handleFpmAction = async (ver: string, action: string) => {
    setBusy(ver);
    const data = await phpAPI.fpmAction(ver, action);
    data.success ? toast(`PHP ${ver} FPM ${action} done`) : toast(data.message || 'Failed', 'error');
    await loadVersions();
    setBusy(null);
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CodeIcon sx={{ color: '#777BB3', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>PHP Manager</Typography>
              <Typography variant="body1" color="text.secondary">
                {defaultVersion ? `Default: PHP ${defaultVersion}` : 'No PHP installed'} • {installedVersions.length} version{installedVersions.length !== 1 ? 's' : ''} installed
              </Typography>
            </Box>
          </Box>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadVersions} sx={{ textTransform: 'none' }}>
            Refresh
          </Button>
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
            <Tab icon={<DownloadIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Versions" />
            <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Configuration" disabled={!selectedVersion} />
            <Tab icon={<ExtensionIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Extensions" disabled={!selectedVersion} />
            <Tab icon={<DescriptionIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Error Logs" disabled={!selectedVersion} />
          </Tabs>
        </Card>

        {/* Tab Content */}
        {tab === 0 && (
          <VersionsTab
            versions={versions}
            defaultVersion={defaultVersion}
            busy={busy}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
            onSetDefault={handleSetDefault}
            onFpmAction={handleFpmAction}
          />
        )}
        {tab === 1 && selectedVersion && (
          <ConfigTab version={selectedVersion} installedVersions={installedVersions} toast={toast} />
        )}
        {tab === 2 && selectedVersion && (
          <ExtensionsTab version={selectedVersion} installedVersions={installedVersions} toast={toast} />
        )}
        {tab === 3 && selectedVersion && (
          <LogsTab version={selectedVersion} installedVersions={installedVersions} />
        )}
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
//  VERSIONS TAB
// ═══════════════════════════════════════════════════════════════════════

function VersionsTab({
  versions, defaultVersion, busy,
  onInstall, onUninstall, onSetDefault, onFpmAction,
}: {
  versions: PhpVersion[];
  defaultVersion: string;
  busy: string | null;
  onInstall: (v: string) => void;
  onUninstall: (v: string) => void;
  onSetDefault: (v: string) => void;
  onFpmAction: (v: string, a: string) => void;
}) {
  return (
    <Grid container spacing={2}>
      {versions.map(v => {
        const color = VERSION_COLORS[v.version] || '#4285F4';
        const isBusy = busy === v.version;

        return (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={v.version}>
            <Card
              elevation={0}
              sx={{
                border: t => `1px solid ${v.installed ? color : t.palette.divider}`,
                borderRadius: 2,
                position: 'relative',
                overflow: 'visible',
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
              }}
            >
              {isBusy && (
                <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '8px 8px 0 0' }} />
              )}
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 44, height: 44, borderRadius: 2,
                        bgcolor: `${color}14`, color, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                      }}
                    >
                      {v.version}
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        PHP {v.version}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                        {v.installed ? (
                          <Chip size="small" label="Installed" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#E6F4EA', color: '#34A853' }} />
                        ) : (
                          <Chip size="small" label="Available" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#F1F3F4', color: '#5F6368' }} />
                        )}
                        {v.active && (
                          <Chip size="small" label="Default" icon={<StarIcon sx={{ fontSize: '12px !important' }} />} sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#FEF7E0', color: '#F9AB00' }} />
                        )}
                      </Stack>
                    </Box>
                  </Box>
                </Box>

                {/* FPM Status */}
                {v.installed && (
                  <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        PHP-FPM
                      </Typography>
                      <Chip
                        size="small"
                        label={v.fpmRunning ? 'Running' : 'Stopped'}
                        sx={{
                          height: 18, fontSize: '0.62rem', fontWeight: 600,
                          bgcolor: v.fpmRunning ? '#E6F4EA' : '#FEE8E6',
                          color: v.fpmRunning ? '#34A853' : '#EA4335',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                      Socket: {v.fpmSocketPath}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                      {!v.fpmRunning ? (
                        <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} disabled={isBusy}
                          onClick={() => onFpmAction(v.version, 'start')}
                          sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25 }}>
                          Start
                        </Button>
                      ) : (
                        <>
                          <Button size="small" variant="outlined" startIcon={<RestartAltIcon />} disabled={isBusy}
                            onClick={() => onFpmAction(v.version, 'restart')}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25 }}>
                            Restart
                          </Button>
                          <Button size="small" variant="outlined" color="warning" startIcon={<StopIcon />} disabled={isBusy}
                            onClick={() => onFpmAction(v.version, 'stop')}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25 }}>
                            Stop
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Box>
                )}

                {/* Actions */}
                <Stack direction="row" spacing={1}>
                  {!v.installed ? (
                    <Button fullWidth variant="contained" size="small" disabled={isBusy}
                      startIcon={isBusy ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
                      onClick={() => onInstall(v.version)}
                      sx={{ textTransform: 'none', fontWeight: 600, bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}>
                      {isBusy ? 'Installing...' : 'Install'}
                    </Button>
                  ) : (
                    <>
                      {!v.active && (
                        <Button variant="outlined" size="small" disabled={isBusy}
                          startIcon={<StarIcon />} onClick={() => onSetDefault(v.version)}
                          sx={{ textTransform: 'none', fontWeight: 500, flexGrow: 1 }}>
                          Set Default
                        </Button>
                      )}
                      <Button variant="outlined" size="small" color="error" disabled={isBusy || v.active}
                        startIcon={isBusy ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
                        onClick={() => onUninstall(v.version)}
                        sx={{ textTransform: 'none', fontWeight: 500 }}>
                        Uninstall
                      </Button>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION TAB
// ═══════════════════════════════════════════════════════════════════════

function ConfigTab({
  version: initialVersion, installedVersions, toast,
}: {
  version: string;
  installedVersions: PhpVersion[];
  toast: (msg: string, sev?: 'success' | 'error' | 'info') => void;
}) {
  const [version, setVersion] = useState(initialVersion);
  const [config, setConfig] = useState<PhpIniConfig | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await phpAPI.getConfig(version);
      if (data.success) {
        setConfig(data.config);
        setEditValues({ ...data.config.directives });
      }
    } catch {} finally { setLoading(false); }
  }, [version]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    // Find changed values
    const changes: Record<string, string> = {};
    for (const [k, v] of Object.entries(editValues)) {
      if (config && v !== config.directives[k]) changes[k] = v;
    }
    if (Object.keys(changes).length === 0) { toast('No changes to save', 'info'); return; }
    setSaving(true);
    const data = await phpAPI.setConfig(version, changes);
    data.success ? toast('Configuration saved' + (data.restarted ? ' (FPM restarted)' : '')) : toast(data.message || 'Save failed', 'error');
    setSaving(false);
    loadConfig();
  };

  const directiveLabels: Record<string, { label: string; hint: string }> = {
    upload_max_filesize: { label: 'Upload Max File Size', hint: 'e.g. 64M' },
    post_max_size: { label: 'Post Max Size', hint: 'e.g. 64M' },
    memory_limit: { label: 'Memory Limit', hint: 'e.g. 256M' },
    max_execution_time: { label: 'Max Execution Time', hint: 'seconds' },
    max_input_time: { label: 'Max Input Time', hint: 'seconds' },
    max_input_vars: { label: 'Max Input Vars', hint: 'e.g. 3000' },
    display_errors: { label: 'Display Errors', hint: 'On / Off' },
    error_reporting: { label: 'Error Reporting', hint: 'e.g. E_ALL' },
    'date.timezone': { label: 'Timezone', hint: 'e.g. UTC' },
    file_uploads: { label: 'File Uploads', hint: 'On / Off' },
    allow_url_fopen: { label: 'Allow URL fopen', hint: 'On / Off' },
    'session.gc_maxlifetime': { label: 'Session GC Max Lifetime', hint: 'seconds' },
    'opcache.enable': { label: 'OPcache Enable', hint: '1 / 0' },
    'opcache.memory_consumption': { label: 'OPcache Memory', hint: 'MB' },
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
      <CardContent>
        {/* Version Selector + Save */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>php.ini Configuration</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
              {installedVersions.map(v => (
                <Chip
                  key={v.version}
                  label={v.version}
                  size="small"
                  onClick={() => setVersion(v.version)}
                  sx={{
                    fontWeight: 600,
                    bgcolor: version === v.version ? (VERSION_COLORS[v.version] || '#4285F4') : 'grey.100',
                    color: version === v.version ? '#fff' : 'text.primary',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.85 },
                  }}
                />
              ))}
            </Box>
          </Stack>
          <Button variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            disabled={saving} onClick={handleSave}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>

        {config && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            Editing: {config.iniPath}
          </Typography>
        )}

        {/* Directives Grid */}
        <Grid container spacing={2}>
          {Object.entries(editValues).map(([key, value]) => {
            const info = directiveLabels[key] || { label: key, hint: '' };
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                <TextField
                  fullWidth
                  size="small"
                  label={info.label}
                  placeholder={info.hint}
                  value={value}
                  onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                  helperText={key}
                  sx={{
                    '& .MuiInputLabel-root': { fontSize: '0.8rem' },
                    '& .MuiFormHelperText-root': { fontSize: '0.65rem', fontFamily: 'monospace' },
                  }}
                />
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  EXTENSIONS TAB
// ═══════════════════════════════════════════════════════════════════════

function ExtensionsTab({
  version: initialVersion, installedVersions, toast,
}: {
  version: string;
  installedVersions: PhpVersion[];
  toast: (msg: string, sev?: 'success' | 'error' | 'info') => void;
}) {
  const [version, setVersion] = useState(initialVersion);
  const [extensions, setExtensions] = useState<PhpExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await phpAPI.extensions(version);
      if (data.success) setExtensions(data.extensions);
    } catch {} finally { setLoading(false); }
  }, [version]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (ext: PhpExtension) => {
    setBusy(ext.name);
    if (ext.enabled) {
      const data = await phpAPI.removeExt(version, ext.name);
      data.success ? toast(`${ext.name} removed`) : toast(data.message || 'Failed', 'error');
    } else {
      const data = await phpAPI.installExt(version, ext.name);
      data.success ? toast(`${ext.name} installed`) : toast(data.message || 'Failed', 'error');
    }
    await load();
    setBusy(null);
  };

  const filtered = extensions.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()),
  );
  const enabledCount = extensions.filter(e => e.enabled).length;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Extensions</Typography>
            <Chip label={`${enabledCount} enabled`} size="small" sx={{ fontWeight: 600, bgcolor: '#E6F4EA', color: '#34A853' }} />
            <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
              {installedVersions.map(v => (
                <Chip
                  key={v.version}
                  label={v.version}
                  size="small"
                  onClick={() => setVersion(v.version)}
                  sx={{
                    fontWeight: 600,
                    bgcolor: version === v.version ? (VERSION_COLORS[v.version] || '#4285F4') : 'grey.100',
                    color: version === v.version ? '#fff' : 'text.primary',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
          </Stack>
          <TextField
            size="small"
            placeholder="Search extensions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
            }}
            sx={{ width: 240 }}
          />
        </Box>

        {/* Extensions Grid */}
        <Grid container spacing={1}>
          {filtered.map(ext => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={ext.name}>
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider',
                  bgcolor: ext.enabled ? alpha('#34A853', 0.04) : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ExtensionIcon sx={{ fontSize: 18, color: ext.enabled ? '#34A853' : 'text.disabled' }} />
                  <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {ext.name}
                  </Typography>
                </Box>
                {busy === ext.name ? (
                  <CircularProgress size={20} />
                ) : (
                  <Switch
                    size="small"
                    checked={ext.enabled}
                    onChange={() => handleToggle(ext)}
                    color="success"
                  />
                )}
              </Box>
            </Grid>
          ))}
        </Grid>

        {filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">No extensions found</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ERROR LOGS TAB
// ═══════════════════════════════════════════════════════════════════════

function LogsTab({
  version: initialVersion, installedVersions,
}: {
  version: string;
  installedVersions: PhpVersion[];
}) {
  const [version, setVersion] = useState(initialVersion);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewRaw, setViewRaw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await phpAPI.logs(version);
      if (data.success) { setEntries(data.entries); setRaw(data.raw); }
    } catch {} finally { setLoading(false); }
  }, [version]);

  useEffect(() => { load(); }, [load]);

  const levelIcon = (level: string) => {
    if (['ERROR', 'CRITICAL', 'ALERT'].includes(level)) return <ErrorOutlineIcon sx={{ fontSize: 16, color: '#EA4335' }} />;
    if (level === 'WARNING') return <WarningAmberIcon sx={{ fontSize: 16, color: '#FBBC04' }} />;
    return <InfoOutlinedIcon sx={{ fontSize: 16, color: '#4285F4' }} />;
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>PHP-FPM Error Logs</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
              {installedVersions.map(v => (
                <Chip
                  key={v.version}
                  label={v.version}
                  size="small"
                  onClick={() => setVersion(v.version)}
                  sx={{
                    fontWeight: 600,
                    bgcolor: version === v.version ? (VERSION_COLORS[v.version] || '#4285F4') : 'grey.100',
                    color: version === v.version ? '#fff' : 'text.primary',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => setViewRaw(!viewRaw)}
              sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
              {viewRaw ? 'Parsed View' : 'Raw View'}
            </Button>
            <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load}
              sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
              Refresh
            </Button>
          </Stack>
        </Box>

        {viewRaw ? (
          <Box
            sx={{
              fontFamily: '"Fira Code", "Cascadia Code", monospace',
              fontSize: '0.75rem',
              bgcolor: '#1E1E1E',
              color: '#D4D4D4',
              p: 2,
              borderRadius: 1.5,
              maxHeight: 500,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {raw || 'No log data available'}
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 40 }}></TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 180 }}>Timestamp</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 80 }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No log entries found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry, i) => (
                    <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell>{levelIcon(entry.level)}</TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {entry.timestamp}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={entry.level}
                          sx={{
                            height: 20, fontSize: '0.65rem', fontWeight: 600,
                            bgcolor: `${LOG_LEVEL_COLORS[entry.level] || '#4285F4'}18`,
                            color: LOG_LEVEL_COLORS[entry.level] || '#4285F4',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                          {entry.message}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
