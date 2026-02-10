import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  alpha,
  CircularProgress,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Tooltip,
  Grid,
  LinearProgress,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import SearchIcon from '@mui/icons-material/Search';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import JavascriptIcon from '@mui/icons-material/Javascript';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SpeedIcon from '@mui/icons-material/Speed';
import ShieldIcon from '@mui/icons-material/Shield';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import CodeIcon from '@mui/icons-material/Code';
import TableChartIcon from '@mui/icons-material/TableChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CategoryIcon from '@mui/icons-material/Category';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import BuildIcon from '@mui/icons-material/Build';

// ─── types ────────────────────────────────────────────────────────────

interface AppStatus {
  id: string;
  installed: boolean;
  running: boolean;
  version: string;
  port?: number;
  url?: string;
}

interface AppInfo {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: string;
  color: string;
  category: string;
  tags: string[];
  version?: string;
  website?: string;
  status: AppStatus;
}

// ─── icon map ─────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  TableChart: <TableChartIcon sx={{ fontSize: 32 }} />,
  Memory: <MemoryIcon sx={{ fontSize: 32 }} />,
  Javascript: <JavascriptIcon sx={{ fontSize: 32 }} />,
  LibraryBooks: <LibraryBooksIcon sx={{ fontSize: 32 }} />,
  Speed: <SpeedIcon sx={{ fontSize: 32 }} />,
  Shield: <ShieldIcon sx={{ fontSize: 32 }} />,
  VerifiedUser: <VerifiedUserIcon sx={{ fontSize: 32 }} />,
  Code: <CodeIcon sx={{ fontSize: 32 }} />,
  Storage: <StorageIcon sx={{ fontSize: 32 }} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Apps',
  database: 'Database',
  development: 'Development',
  cache: 'Cache',
  utility: 'Utility',
  monitoring: 'Monitoring',
  webserver: 'Web Server',
};

// ─── main component ───────────────────────────────────────────────────

export default function AppStorePage() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [detailApp, setDetailApp] = useState<AppInfo | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);
  const [diagnoseAppId, setDiagnoseAppId] = useState('');
  const [diagnoseAppName, setDiagnoseAppName] = useState('');
  const [diagnoseChecks, setDiagnoseChecks] = useState<Array<{ name: string; status: string; detail: string }>>([]);
  const [diagnosing, setDiagnosing] = useState(false);
  const [fixing, setFixing] = useState(false);

  const fetchApps = async () => {
    try {
      const res = await fetch('/api/app-store/apps');
      const data = await res.json();
      if (data.success) setApps(data.apps);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleInstall = async (id: string) => {
    setInstalling(id);
    try {
      const res = await fetch(`/api/app-store/install/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnackbar({ open: true, message: `${apps.find((a) => a.id === id)?.name} installed successfully!`, severity: 'success' });
        await fetchApps();
      } else {
        setSnackbar({ open: true, message: data.message || 'Installation failed', severity: 'error' });
      }
    } catch (e: any) {
      setSnackbar({ open: true, message: 'Installation failed', severity: 'error' });
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (id: string) => {
    setUninstalling(id);
    try {
      const res = await fetch(`/api/app-store/uninstall/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSnackbar({ open: true, message: `${apps.find((a) => a.id === id)?.name} uninstalled`, severity: 'success' });
        await fetchApps();
      } else {
        setSnackbar({ open: true, message: data.message || 'Uninstall failed', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Uninstall failed', severity: 'error' });
    } finally {
      setUninstalling(null);
    }
  };

  const handleDiagnose = async (appId: string) => {
    const app = apps.find(a => a.id === appId);
    setDiagnoseAppId(appId);
    setDiagnoseAppName(app?.name || appId);
    setDiagnosing(true);
    setDiagnoseOpen(true);
    setDiagnoseChecks([]);
    try {
      const res = await fetch(`/api/app-store/diagnose/${appId}`);
      const data = await res.json();
      if (data.success) setDiagnoseChecks(data.checks);
    } catch {
      setDiagnoseChecks([{ name: 'API Error', status: 'error', detail: 'Could not reach the diagnose endpoint' }]);
    } finally {
      setDiagnosing(false);
    }
  };

  const handleFix = async () => {
    setFixing(true);
    try {
      const res = await fetch('/api/app-store/reconfigure/phpmyadmin', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnackbar({ open: true, message: data.message || 'phpMyAdmin reconfigured', severity: 'success' });
        await handleDiagnose('phpmyadmin');
        await fetchApps();
      } else {
        setSnackbar({ open: true, message: data.message || 'Fix failed', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Fix failed', severity: 'error' });
    } finally {
      setFixing(false);
    }
  };

  // ─── filter logic ───────────────────────────────────────────────────

  const categories = ['all', ...Array.from(new Set(apps.map((a) => a.category)))];

  const filteredApps = apps.filter((app) => {
    const matchCategory = category === 'all' || app.category === category;
    const matchSearch =
      !search ||
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.description.toLowerCase().includes(search.toLowerCase()) ||
      app.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const installedApps = apps.filter((a) => a.status.installed);
  const availableApps = filteredApps.filter((a) => !a.status.installed);
  const installedFiltered = filteredApps.filter((a) => a.status.installed);

  // ─── stats ──────────────────────────────────────────────────────────

  const statsCards = [
    {
      label: 'Total Apps',
      value: apps.length,
      color: '#4285F4',
      bgColor: '#E8F0FE',
      icon: <CategoryIcon />,
    },
    {
      label: 'Installed',
      value: installedApps.length,
      color: '#34A853',
      bgColor: '#E6F4EA',
      icon: <CheckCircleIcon />,
    },
    {
      label: 'Available',
      value: apps.length - installedApps.length,
      color: '#FBBC04',
      bgColor: '#FEF7E0',
      icon: <DownloadIcon />,
    },
  ];

  // ─── render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            App Store
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Install and manage tools for your server
          </Typography>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statsCards.map((stat) => (
            <Grid size={{ xs: 12, sm: 4 }} key={stat.label}>
              <Card
                elevation={0}
                sx={{
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: stat.bgColor,
                      color: stat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Search + Category Filter */}
        <Card
          elevation={0}
          sx={{
            mb: 3,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ pb: '16px !important' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <TextField
                size="small"
                placeholder="Search apps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 280 }}
              />
              <Tabs
                value={category}
                onChange={(_, v) => setCategory(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: 36,
                  '& .MuiTab-root': {
                    minHeight: 36,
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    px: 2,
                  },
                }}
              >
                {categories.map((cat) => (
                  <Tab key={cat} value={cat} label={CATEGORY_LABELS[cat] || cat} />
                ))}
              </Tabs>
            </Stack>
          </CardContent>
        </Card>

        {/* Installed Apps Section */}
        {installedFiltered.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#34A853', fontSize: 22 }} />
              Installed ({installedFiltered.length})
            </Typography>
            <Grid container spacing={2}>
              {installedFiltered.map((app) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={app.id}>
                  <AppCard
                    app={app}
                    installing={installing === app.id}
                    uninstalling={uninstalling === app.id}
                    onInstall={handleInstall}
                    onUninstall={handleUninstall}
                    onDetail={setDetailApp}
                    onDiagnose={app.status.installed ? () => handleDiagnose(app.id) : undefined}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Available Apps Section */}
        {availableApps.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <DownloadIcon sx={{ color: '#4285F4', fontSize: 22 }} />
              Available ({availableApps.length})
            </Typography>
            <Grid container spacing={2}>
              {availableApps.map((app) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={app.id}>
                  <AppCard
                    app={app}
                    installing={installing === app.id}
                    uninstalling={uninstalling === app.id}
                    onInstall={handleInstall}
                    onUninstall={handleUninstall}
                    onDetail={setDetailApp}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {filteredApps.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CategoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No apps found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or category filter
            </Typography>
          </Box>
        )}
      </Box>

      {/* Diagnose Dialog */}
      <DiagnoseDialog
        open={diagnoseOpen}
        onClose={() => setDiagnoseOpen(false)}
        checks={diagnoseChecks}
        loading={diagnosing}
        fixing={fixing}
        onFix={handleFix}
        appName={diagnoseAppName}
        appId={diagnoseAppId}
      />

      {/* Detail Dialog */}
      <AppDetailDialog
        app={detailApp}
        onClose={() => setDetailApp(null)}
        installing={installing === detailApp?.id}
        uninstalling={uninstalling === detailApp?.id}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}

// ─── App Card ─────────────────────────────────────────────────────────

function AppCard({
  app,
  installing,
  uninstalling,
  onInstall,
  onUninstall,
  onDetail,
  onDiagnose,
}: {
  app: AppInfo;
  installing: boolean;
  uninstalling: boolean;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onDetail: (app: AppInfo) => void;
  onDiagnose?: () => void;
}) {
  const { status } = app;
  const icon = ICON_MAP[app.icon] || <StorageIcon sx={{ fontSize: 32 }} />;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        overflow: 'visible',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px 0 rgba(60,64,67,0.15)',
          borderColor: app.color,
        },
      }}
    >
      {/* Installing progress bar */}
      {installing && (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            borderRadius: '8px 8px 0 0',
            '& .MuiLinearProgress-bar': { bgcolor: app.color },
            bgcolor: `${app.color}20`,
          }}
        />
      )}

      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          {/* Icon */}
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              bgcolor: `${app.color}14`,
              color: app.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
                {app.name}
              </Typography>
              {status.installed && (
                <Chip
                  size="small"
                  label={status.running ? 'Running' : 'Installed'}
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    bgcolor: status.running ? '#E6F4EA' : '#FEF7E0',
                    color: status.running ? '#34A853' : '#F9AB00',
                  }}
                />
              )}
            </Box>
            {status.version && (
              <Typography variant="caption" color="text.secondary">
                v{status.version}
              </Typography>
            )}
          </Box>
          <Tooltip title="Details">
            <IconButton size="small" onClick={() => onDetail(app)} sx={{ mt: -0.5 }}>
              <InfoOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5, minHeight: 40 }}>
          {app.description}
        </Typography>

        {/* Tags */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          {app.tags.slice(0, 3).map((tag) => (
            <Chip
              key={tag}
              size="small"
              label={tag}
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.68rem',
                borderColor: 'divider',
              }}
            />
          ))}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!status.installed ? (
            <Button
              variant="contained"
              size="small"
              fullWidth
              disabled={installing}
              onClick={() => onInstall(app.id)}
              startIcon={installing ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: app.color,
                '&:hover': { bgcolor: app.color, filter: 'brightness(0.9)' },
              }}
            >
              {installing ? 'Installing...' : 'Install'}
            </Button>
          ) : (
            <>
              {status.url && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<OpenInNewIcon />}
                  onClick={() => window.open(status.url, '_blank')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    bgcolor: app.color,
                    flexGrow: 1,
                    '&:hover': { bgcolor: app.color, filter: 'brightness(0.9)' },
                  }}
                >
                  Open
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                color="error"
                disabled={uninstalling}
                onClick={() => onUninstall(app.id)}
                startIcon={uninstalling ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
                sx={{ textTransform: 'none', fontWeight: 500, flexGrow: status.url ? 0 : 1 }}
              >
                {uninstalling ? 'Removing...' : 'Uninstall'}
              </Button>
              {onDiagnose && (
                <Tooltip title="Diagnose">
                  <IconButton size="small" onClick={onDiagnose} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <MonitorHeartIcon sx={{ fontSize: 18, color: '#FBBC04' }} />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────

function AppDetailDialog({
  app,
  onClose,
  installing,
  uninstalling,
  onInstall,
  onUninstall,
}: {
  app: AppInfo | null;
  onClose: () => void;
  installing: boolean;
  uninstalling: boolean;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
}) {
  if (!app) return null;

  const icon = ICON_MAP[app.icon] || <StorageIcon sx={{ fontSize: 40 }} />;

  return (
    <Dialog open={!!app} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: `${app.color}14`,
              color: app.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {app.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {app.category.charAt(0).toUpperCase() + app.category.slice(1)}
              {app.status.version && ` • v${app.status.version}`}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Status */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip
              size="small"
              label={app.status.installed ? 'Installed' : 'Not Installed'}
              sx={{
                fontWeight: 600,
                bgcolor: app.status.installed ? '#E6F4EA' : '#FEE8E6',
                color: app.status.installed ? '#34A853' : '#EA4335',
              }}
            />
            {app.status.installed && (
              <Chip
                size="small"
                label={app.status.running ? 'Running' : 'Stopped'}
                sx={{
                  fontWeight: 600,
                  bgcolor: app.status.running ? '#E6F4EA' : '#FEF7E0',
                  color: app.status.running ? '#34A853' : '#F9AB00',
                }}
              />
            )}
            {app.status.port && app.status.installed && (
              <Chip size="small" variant="outlined" label={`Port ${app.status.port}`} />
            )}
          </Stack>
        </Box>

        {/* Description */}
        <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
          {app.longDescription}
        </Typography>

        {/* Tags */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          {app.tags.map((tag) => (
            <Chip key={tag} size="small" label={tag} variant="outlined" sx={{ fontSize: '0.75rem' }} />
          ))}
        </Box>

        {/* Link */}
        {app.website && (
          <Button
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(app.website, '_blank')}
            sx={{ textTransform: 'none' }}
          >
            Visit website
          </Button>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
        {!app.status.installed ? (
          <Button
            variant="contained"
            disabled={installing}
            onClick={() => onInstall(app.id)}
            startIcon={installing ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: app.color,
              '&:hover': { bgcolor: app.color, filter: 'brightness(0.9)' },
            }}
          >
            {installing ? 'Installing...' : 'Install'}
          </Button>
        ) : (
          <Stack direction="row" spacing={1}>
            {app.status.url && (
              <Button
                variant="contained"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open(app.status.url, '_blank')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  bgcolor: app.color,
                  '&:hover': { bgcolor: app.color, filter: 'brightness(0.9)' },
                }}
              >
                Open
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              disabled={uninstalling}
              onClick={() => onUninstall(app.id)}
              startIcon={uninstalling ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
              sx={{ textTransform: 'none' }}
            >
              {uninstalling ? 'Removing...' : 'Uninstall'}
            </Button>
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Diagnose Dialog ──────────────────────────────────────────────────

function DiagnoseDialog({
  open,
  onClose,
  checks,
  loading,
  fixing,
  onFix,
  appName,
  appId,
}: {
  open: boolean;
  onClose: () => void;
  checks: Array<{ name: string; status: string; detail: string }>;
  loading: boolean;
  fixing: boolean;
  onFix: () => void;
  appName: string;
  appId: string;
}) {
  const statusIcon = (s: string) => {
    if (s === 'ok')
      return (
        <CheckCircleIcon sx={{ fontSize: 20, color: '#34A853' }} />
      );
    if (s === 'warn')
      return (
        <InfoOutlinedIcon sx={{ fontSize: 20, color: '#FBBC04' }} />
      );
    return (
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          bgcolor: '#FDDEDE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#EA4335',
        }}
      >
        ✗
      </Box>
    );
  };

  const hasErrors = checks.some((c) => c.status === 'error');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <MonitorHeartIcon sx={{ color: '#FBBC04' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {appName} Diagnostics
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Checking all required services
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              Running diagnostics...
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {checks.map((check, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor:
                    check.status === 'ok'
                      ? alpha('#34A853', 0.04)
                      : check.status === 'warn'
                        ? alpha('#FBBC04', 0.06)
                        : alpha('#EA4335', 0.04),
                  border: '1px solid',
                  borderColor:
                    check.status === 'ok'
                      ? alpha('#34A853', 0.2)
                      : check.status === 'warn'
                        ? alpha('#FBBC04', 0.3)
                        : alpha('#EA4335', 0.2),
                }}
              >
                <Box sx={{ mt: 0.25 }}>{statusIcon(check.status)}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {check.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                    {check.detail}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
        {hasErrors && appId === 'phpmyadmin' && (
          <Button
            variant="contained"
            disabled={fixing}
            onClick={onFix}
            startIcon={fixing ? <CircularProgress size={14} color="inherit" /> : <BuildIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#FBBC04',
              color: '#000',
              '&:hover': { bgcolor: '#F9AB00' },
            }}
          >
            {fixing ? 'Fixing...' : 'Auto-Fix (Reconfigure)'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
