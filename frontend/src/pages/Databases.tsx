import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Chip,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  Collapse,
} from '@mui/material';
import {
  Add,
  Delete,
  Storage,
  Person,
  Key,
  Link as LinkIcon,
  LinkOff,
  Refresh,
  Download,
  Visibility,
  VisibilityOff,
  ContentCopy,
  ExpandMore,
  ExpandLess,
  TableChart,
  OpenInNew,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';

// ---- API helpers ----

const API = '/api/database';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

const dbAPI = {
  status: () => fetchJSON(`${API}/status`),
  engines: () => fetchJSON(`${API}/engines`),
  install: () => fetchJSON(`${API}/install`, { method: 'POST' }),
  installEngine: (engine: string) => fetchJSON(`${API}/install/${engine}`, { method: 'POST' }),
  listDatabases: (engine?: string) => fetchJSON(`${API}/list${engine ? `?engine=${engine}` : ''}`),
  createDatabase: (name: string, engine?: string) => fetchJSON(`${API}/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, engine }),
  }),
  deleteDatabase: (name: string, engine?: string) => fetchJSON(`${API}/delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, engine }),
  }),
  listTables: (database: string, engine?: string) => fetchJSON(`${API}/tables?database=${encodeURIComponent(database)}${engine ? `&engine=${engine}` : ''}`),
  listUsers: (engine?: string) => fetchJSON(`${API}/users${engine ? `?engine=${engine}` : ''}`),
  createUser: (name: string, password: string, host?: string, engine?: string) => fetchJSON(`${API}/users/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, host, engine }),
  }),
  deleteUser: (name: string, host?: string, engine?: string) => fetchJSON(`${API}/users/delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, host, engine }),
  }),
  changePassword: (name: string, password: string, host?: string, engine?: string) => fetchJSON(`${API}/users/password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, host, engine }),
  }),
  grant: (user: string, database: string, privileges?: string[], host?: string, engine?: string) => fetchJSON(`${API}/privileges/grant`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, database, privileges, host, engine }),
  }),
  revoke: (user: string, database: string, host?: string, engine?: string) => fetchJSON(`${API}/privileges/revoke`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, database, host, engine }),
  }),
};

// ---- Helpers ----

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// ---- Types ----

interface DbInfo { name: string; size: number; tables: number }
interface DbUser { user: string; host: string; databases: string[] }
interface TableInfo { name: string; rows: number; size: number; engine: string }
interface EngineInfo { engine: string; label: string; installed: boolean; running: boolean; version: string }

// ============================================================
// COMPONENT
// ============================================================

export default function DatabasesPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status
  const [dbStatus, setDbStatus] = useState<{ installed: boolean; running: boolean; version: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [installingEngine, setInstallingEngine] = useState<string | null>(null);

  // Active engine (mysql or postgresql)
  const [activeEngine, setActiveEngine] = useState<string>('mysql');

  // Databases
  const [databases, setDatabases] = useState<DbInfo[]>([]);
  const [createDbOpen, setCreateDbOpen] = useState(false);
  const [createDbName, setCreateDbName] = useState('');

  // Tables expansion
  const [expandedDb, setExpandedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<DbUser[]>([]);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserHost, setNewUserHost] = useState('localhost');
  const [showPassword, setShowPassword] = useState(false);

  // Change password
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [changePassUser, setChangePassUser] = useState('');
  const [changePassHost, setChangePassHost] = useState('localhost');
  const [changePassValue, setChangePassValue] = useState('');

  // Grant privileges
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUser, setGrantUser] = useState('');
  const [grantHost, setGrantHost] = useState('localhost');
  const [grantDb, setGrantDb] = useState('');
  const [grantPrivs, setGrantPrivs] = useState<string[]>(['ALL PRIVILEGES']);

  const PRIVS_OPTIONS = activeEngine === 'postgresql'
    ? ['ALL', 'CREATE', 'CONNECT', 'TEMPORARY']
    : ['ALL PRIVILEGES', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX'];

  // ---- Load data ----

  const loadStatus = useCallback(async () => {
    try {
      const [statusData, enginesData] = await Promise.all([
        dbAPI.status(),
        dbAPI.engines(),
      ]);
      setDbStatus({ installed: statusData.installed, running: statusData.running, version: statusData.version });
      const engList: EngineInfo[] = enginesData.engines || [];
      setEngines(engList);
      // Auto-select active engine: prefer MariaDB/MySQL if installed, else PostgreSQL
      const mysqlEng = engList.find(e => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed && e.running);
      const pgEng = engList.find(e => e.engine === 'postgresql' && e.installed && e.running);
      if (mysqlEng && !pgEng) setActiveEngine('mysql');
      else if (pgEng && !mysqlEng) setActiveEngine('postgresql');
      // If both, keep current selection
    } catch (e: any) { setError(e.message); }
  }, []);

  const engineParam = activeEngine === 'postgresql' ? 'postgresql' : undefined;

  const loadDatabases = useCallback(async () => {
    try {
      const data = await dbAPI.listDatabases(engineParam);
      setDatabases(data.databases || []);
    } catch (e: any) { setError(e.message); }
  }, [engineParam]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await dbAPI.listUsers(engineParam);
      setUsers(data.users || []);
    } catch (e: any) { setError(e.message); }
  }, [engineParam]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadStatus();
    if (dbStatus?.installed && dbStatus?.running) {
      await Promise.all([loadDatabases(), loadUsers()]);
    }
    setLoading(false);
  }, [dbStatus?.installed, dbStatus?.running, loadDatabases, loadUsers]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadStatus();
      setLoading(false);
    })();
  }, []);

  // Reload data when engine changes or when DB becomes available
  useEffect(() => {
    if (dbStatus?.installed && dbStatus?.running) {
      loadDatabases();
      loadUsers();
    }
  }, [dbStatus?.installed, dbStatus?.running, activeEngine]);

  // ---- Actions ----

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await dbAPI.install();
      setSuccess('MariaDB installed successfully');
      await loadStatus();
    } catch (e: any) { setError(e.message); }
    setInstalling(false);
  };

  const handleInstallEngine = async (engine: string) => {
    setInstallingEngine(engine);
    setError(null);
    try {
      const data = await dbAPI.installEngine(engine);
      setSuccess(data.message || `${engine} installed successfully`);
      await loadStatus();
    } catch (e: any) { setError(e.message); }
    setInstallingEngine(null);
  };

  const handleCreateDb = async () => {
    if (!createDbName) return;
    try {
      const data = await dbAPI.createDatabase(createDbName, engineParam);
      setCreateDbOpen(false);
      setCreateDbName('');
      setSuccess(data.message);
      loadDatabases();
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteDb = async (name: string) => {
    if (!window.confirm(`Delete database "${name}"? This will permanently destroy all data!`)) return;
    try {
      await dbAPI.deleteDatabase(name, engineParam);
      setSuccess(`Database "${name}" deleted`);
      loadDatabases();
    } catch (e: any) { setError(e.message); }
  };

  const handleExpandTables = async (dbName: string) => {
    if (expandedDb === dbName) {
      setExpandedDb(null);
      return;
    }
    setExpandedDb(dbName);
    setTablesLoading(true);
    try {
      const data = await dbAPI.listTables(dbName, engineParam);
      setTables(data.tables || []);
    } catch (e: any) { setError(e.message); setTables([]); }
    setTablesLoading(false);
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserPassword) return;
    try {
      const data = await dbAPI.createUser(newUserName, newUserPassword, newUserHost, engineParam);
      setCreateUserOpen(false);
      setNewUserName('');
      setNewUserPassword('');
      setNewUserHost('localhost');
      setSuccess(data.message);
      loadUsers();
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteUser = async (name: string, host: string) => {
    if (!window.confirm(`Delete user "${name}"@"${host}"?`)) return;
    try {
      await dbAPI.deleteUser(name, host, engineParam);
      setSuccess(`User "${name}" deleted`);
      loadUsers();
    } catch (e: any) { setError(e.message); }
  };

  const handleChangePassword = async () => {
    if (!changePassValue) return;
    try {
      await dbAPI.changePassword(changePassUser, changePassValue, changePassHost, engineParam);
      setChangePassOpen(false);
      setChangePassValue('');
      setSuccess('Password changed');
    } catch (e: any) { setError(e.message); }
  };

  const handleGrant = async () => {
    if (!grantUser || !grantDb) return;
    try {
      await dbAPI.grant(grantUser, grantDb, grantPrivs, grantHost, engineParam);
      setGrantOpen(false);
      setSuccess(`Privileges granted on ${grantDb} to ${grantUser}`);
      loadUsers();
    } catch (e: any) { setError(e.message); }
  };

  const handleRevoke = async (user: string, database: string, host: string) => {
    if (!window.confirm(`Revoke all privileges on "${database}" from "${user}"?`)) return;
    try {
      await dbAPI.revoke(user, database, host, engineParam);
      setSuccess(`Revoked privileges on ${database} from ${user}`);
      loadUsers();
    } catch (e: any) { setError(e.message); }
  };

  // ---- Not installed state ----

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  // Check if ANY engine is installed and running (not just MySQL)
  const anyMysqlRunning = engines.some(e => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed && e.running);
  const pgRunning = engines.some(e => e.engine === 'postgresql' && e.installed && e.running);
  const anyEngineRunning = anyMysqlRunning || pgRunning;

  if (!anyEngineRunning) {
    const engineCards = [
      {
        engine: 'mariadb',
        label: 'MariaDB',
        description: 'Community-developed fork of MySQL. Drop-in replacement with enhanced performance and features.',
        color: '#003545',
        features: ['MySQL compatible', 'Better performance', 'Open source', 'Active community'],
      },
      {
        engine: 'mysql',
        label: 'MySQL',
        description: 'The world\'s most popular open-source relational database. Widely supported and documented.',
        color: '#00758F',
        features: ['Industry standard', 'Wide support', 'Mature ecosystem', 'Oracle backed'],
      },
      {
        engine: 'postgresql',
        label: 'PostgreSQL',
        description: 'Advanced open-source relational database with powerful features and extensibility.',
        color: '#336791',
        features: ['ACID compliant', 'JSON support', 'Extensions', 'Advanced queries'],
      },
    ];

    return (
      <DashboardLayout>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Storage sx={{ color: '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>Database Management</Typography>
              <Typography variant="body1" color="text.secondary">Install and manage open-source database engines</Typography>
            </Box>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {engineCards.map((card) => {
              const eng = engines.find(e => e.engine === card.engine);
              const isInstalled = eng?.installed || false;
              const isRunning = eng?.running || false;
              const isInstalling = installingEngine === card.engine;

              return (
                <Paper key={card.engine} sx={{ flex: 1, overflow: 'hidden', border: isInstalled ? '2px solid #34A853' : '1px solid #e0e0e0', transition: 'all 0.2s' }}>
                  <Box sx={{ p: 3, bgcolor: card.color, color: '#fff' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{card.label}</Typography>
                    {isInstalled && (
                      <Chip
                        label={isRunning ? 'Running' : 'Installed'}
                        size="small"
                        sx={{
                          mt: 1,
                          bgcolor: isRunning ? '#34A853' : '#F4B400',
                          color: '#fff',
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 48 }}>
                      {card.description}
                    </Typography>

                    <Stack spacing={0.5} sx={{ mb: 3 }}>
                      {card.features.map((f) => (
                        <Typography key={f} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box component="span" sx={{ color: '#34A853', fontWeight: 700 }}>✓</Box> {f}
                        </Typography>
                      ))}
                    </Stack>

                    {isInstalled ? (
                      <Stack spacing={1}>
                        <Chip
                          label={eng?.version ? eng.version.split('\n')[0].substring(0, 60) : 'Installed'}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                        />
                        {(card.engine === 'mariadb' || card.engine === 'mysql') && isRunning && (
                          <Typography variant="caption" color="success.main">
                            Active — manage databases below
                          </Typography>
                        )}
                        {card.engine === 'postgresql' && isRunning && (
                          <Typography variant="caption" color="success.main">
                            Active — manage databases below
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => handleInstallEngine(card.engine)}
                        disabled={!!installingEngine}
                        startIcon={isInstalling ? <CircularProgress size={18} color="inherit" /> : <Download />}
                        sx={{
                          textTransform: 'none',
                          bgcolor: card.color,
                          '&:hover': { bgcolor: card.color, opacity: 0.9 },
                        }}
                      >
                        {isInstalling ? `Installing ${card.label}...` : `Install ${card.label}`}
                      </Button>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Stack>

          {/* If any engine is installed and running, show link to management */}
          {anyEngineRunning && (
            <Paper sx={{ mt: 3, p: 3, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ mb: 1 }}>
                A database engine is installed and running. Scroll down or refresh to access database management.
              </Typography>
              <Button variant="contained" onClick={loadAll} sx={{ textTransform: 'none' }}>
                Go to Database Management
              </Button>
            </Paper>
          )}
        </Box>
      </DashboardLayout>
    );
  }

  // ---- Main render ----

  const activeEngineLabel = activeEngine === 'postgresql' ? 'PostgreSQL'
    : engines.find(e => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed)?.label || 'MySQL';
  const activeEngineVersion = activeEngine === 'postgresql'
    ? (engines.find(e => e.engine === 'postgresql')?.version || '')
    : (dbStatus?.version || '');

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Storage sx={{ color: activeEngine === 'postgresql' ? '#336791' : '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>Database Management</Typography>
              <Typography variant="body1" color="text.secondary">
                {activeEngineLabel} {activeEngineVersion ? `— ${activeEngineVersion.split('\n')[0].substring(0, 80)}` : ''}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            {activeEngine === 'postgresql' ? (
              <Button
                variant="contained"
                startIcon={<OpenInNew />}
                onClick={() => window.open('/pgadmin', '_blank')}
                sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#336791', '&:hover': { bgcolor: '#2a567a' } }}
              >
                pgAdmin
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<OpenInNew />}
                onClick={() => window.open('/phpmyadmin', '_blank')}
                sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#F89C0E', '&:hover': { bgcolor: '#e08c00' } }}
              >
                phpMyAdmin
              </Button>
            )}
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => { loadDatabases(); loadUsers(); }}>
              Refresh
            </Button>
          </Stack>
        </Box>

        {/* Engine Selector - show when both MySQL and PG are running */}
        {anyMysqlRunning && pgRunning && (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip
              label={engines.find(e => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed)?.label || 'MySQL'}
              onClick={() => setActiveEngine('mysql')}
              color={activeEngine !== 'postgresql' ? 'primary' : 'default'}
              variant={activeEngine !== 'postgresql' ? 'filled' : 'outlined'}
              icon={<Storage />}
              sx={{ fontWeight: 600, px: 1 }}
            />
            <Chip
              label="PostgreSQL"
              onClick={() => setActiveEngine('postgresql')}
              color={activeEngine === 'postgresql' ? 'primary' : 'default'}
              variant={activeEngine === 'postgresql' ? 'filled' : 'outlined'}
              icon={<Storage />}
              sx={{
                fontWeight: 600,
                px: 1,
                ...(activeEngine === 'postgresql' && { bgcolor: '#336791', '&:hover': { bgcolor: '#2a567a' } }),
              }}
            />
          </Stack>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Stat Cards */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Databases', value: databases.length, icon: <Storage />, color: '#4285F4', bg: '#E8F0FE' },
            { label: 'Users', value: users.length, icon: <Person />, color: '#34A853', bg: '#E6F4EA' },
            { label: 'Total Size', value: formatSize(databases.reduce((s, d) => s + d.size, 0)), icon: <Download />, color: '#F4B400', bg: '#FEF7E0' },
          ].map(s => (
            <Paper key={s.label} sx={{ flex: 1, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(s.icon, { sx: { color: s.color, fontSize: 24 } })}
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </Box>
            </Paper>
          ))}
        </Stack>

        <Paper sx={{ overflow: 'hidden' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
            <Tab label={`Databases (${databases.length})`} icon={<Storage />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label={`Users (${users.length})`} icon={<Person />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 500 }} />
          </Tabs>

        {/* ==================== DATABASES TAB ==================== */}
        {tab === 0 && (
          <>
            <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {databases.length} database{databases.length !== 1 ? 's' : ''}
              </Typography>
              <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setCreateDbOpen(true)}>
                Create Database
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Database Name</TableCell>
                    <TableCell sx={{ width: 100 }}>Tables</TableCell>
                    <TableCell sx={{ width: 100 }}>Size</TableCell>
                    <TableCell sx={{ width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {databases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">No databases yet. Create one to get started.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    databases.map((db) => (
                      <React.Fragment key={db.name}>
                        <TableRow hover>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleExpandTables(db.name)}>
                              {expandedDb === db.name ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Storage fontSize="small" color="primary" />
                              <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                {db.name}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip label={db.tables} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {formatSize(db.size)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Delete database">
                              <IconButton size="small" color="error" onClick={() => handleDeleteDb(db.name)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ py: 0, borderBottom: expandedDb === db.name ? undefined : 'none' }} colSpan={5}>
                            <Collapse in={expandedDb === db.name} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 1, pl: 4 }}>
                                {tablesLoading ? (
                                  <CircularProgress size={20} sx={{ my: 1 }} />
                                ) : tables.length === 0 ? (
                                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                    No tables in this database
                                  </Typography>
                                ) : (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Table</TableCell>
                                        <TableCell>Engine</TableCell>
                                        <TableCell>Rows</TableCell>
                                        <TableCell>Size</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {tables.map((t) => (
                                        <TableRow key={t.name}>
                                          <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                              <TableChart fontSize="small" color="action" />
                                              <Typography variant="body2" fontFamily="monospace">{t.name}</Typography>
                                            </Stack>
                                          </TableCell>
                                          <TableCell><Typography variant="body2">{t.engine}</Typography></TableCell>
                                          <TableCell><Typography variant="body2">{t.rows.toLocaleString()}</Typography></TableCell>
                                          <TableCell><Typography variant="body2">{formatSize(t.size)}</Typography></TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {databases.length > 0 && (
              <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8f9fa', borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="body2" color="text.secondary">
                  Total: {databases.length} database(s), {formatSize(databases.reduce((s, d) => s + d.size, 0))}
                </Typography>
              </Box>
            )}
          </>
        )}

        {/* ==================== USERS TAB ==================== */}
        {tab === 1 && (
          <>
            <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {users.length} user{users.length !== 1 ? 's' : ''}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" startIcon={<LinkIcon />} onClick={() => setGrantOpen(true)} disabled={users.length === 0 || databases.length === 0}>
                  Assign to Database
                </Button>
                <Button variant="contained" size="small" startIcon={<Add />} onClick={() => {
                  setNewUserPassword(generatePassword());
                  setCreateUserOpen(true);
                }}>
                  Create User
                </Button>
              </Stack>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Host</TableCell>
                    <TableCell>Databases</TableCell>
                    <TableCell sx={{ width: 180 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">No database users yet. Create one to get started.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={`${u.user}@${u.host}`} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Person fontSize="small" color="primary" />
                            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                              {u.user}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{u.host}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {u.databases.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">None</Typography>
                            ) : (
                              u.databases.map((db) => (
                                <Chip
                                  key={db}
                                  label={db}
                                  size="small"
                                  variant="outlined"
                                  onDelete={() => handleRevoke(u.user, db, u.host)}
                                  deleteIcon={<Tooltip title="Revoke access"><LinkOff fontSize="small" /></Tooltip>}
                                />
                              ))
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0}>
                            <Tooltip title="Change password">
                              <IconButton size="small" onClick={() => {
                                setChangePassUser(u.user);
                                setChangePassHost(u.host);
                                setChangePassValue(generatePassword());
                                setChangePassOpen(true);
                              }}>
                                <Key fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Assign to database">
                              <IconButton size="small" onClick={() => {
                                setGrantUser(u.user);
                                setGrantHost(u.host);
                                setGrantDb('');
                                setGrantPrivs(['ALL PRIVILEGES']);
                                setGrantOpen(true);
                              }}>
                                <LinkIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete user">
                              <IconButton size="small" color="error" onClick={() => handleDeleteUser(u.user, u.host)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
        </Paper>

        {/* ==================== DIALOGS ==================== */}

        {/* Create Database */}
        <Dialog open={createDbOpen} onClose={() => setCreateDbOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Storage sx={{ color: '#4285F4' }} />
            Create Database
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Database names are automatically prefixed with your username.
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              label="Database name"
              fullWidth
              placeholder="e.g. wordpress"
              value={createDbName}
              onChange={(e) => setCreateDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDb(); }}
              helperText="Only letters, numbers, and underscores"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDbOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDb} variant="contained" disabled={!createDbName}>Create</Button>
          </DialogActions>
        </Dialog>

        {/* Create User */}
        <Dialog open={createUserOpen} onClose={() => setCreateUserOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person sx={{ color: '#34A853' }} />
            Create Database User
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Usernames are automatically prefixed with your username.
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              label="Username"
              fullWidth
              placeholder="e.g. wpuser"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              helperText="Only letters, numbers, and underscores"
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Password"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                    <Tooltip title="Generate password">
                      <IconButton size="small" onClick={() => setNewUserPassword(generatePassword())}>
                        <Refresh fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy password">
                      <IconButton size="small" onClick={() => { navigator.clipboard.writeText(newUserPassword); setSuccess('Password copied'); }}>
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Host"
              fullWidth
              value={newUserHost}
              onChange={(e) => setNewUserHost(e.target.value)}
              helperText="Use 'localhost' for local connections, '%' for remote"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateUserOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} variant="contained" disabled={!newUserName || !newUserPassword}>
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Change Password */}
        <Dialog open={changePassOpen} onClose={() => setChangePassOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Key sx={{ color: '#F4B400' }} />
            Change Password for "{changePassUser}"
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="New Password"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              value={changePassValue}
              onChange={(e) => setChangePassValue(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                    <Tooltip title="Generate password">
                      <IconButton size="small" onClick={() => setChangePassValue(generatePassword())}>
                        <Refresh fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy password">
                      <IconButton size="small" onClick={() => { navigator.clipboard.writeText(changePassValue); setSuccess('Password copied'); }}>
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChangePassOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} variant="contained" disabled={!changePassValue}>
              Change Password
            </Button>
          </DialogActions>
        </Dialog>

        {/* Grant Privileges */}
        <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkIcon sx={{ color: '#4285F4' }} />
            Assign User to Database
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>User</InputLabel>
                <Select value={grantUser} label="User" onChange={(e) => {
                  setGrantUser(e.target.value);
                  const u = users.find(u => u.user === e.target.value);
                  if (u) setGrantHost(u.host);
                }}>
                  {users.map((u) => (
                    <MenuItem key={`${u.user}@${u.host}`} value={u.user}>
                      {u.user}@{u.host}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Database</InputLabel>
                <Select value={grantDb} label="Database" onChange={(e) => setGrantDb(e.target.value)}>
                  {databases.map((db) => (
                    <MenuItem key={db.name} value={db.name}>{db.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <Typography variant="subtitle2" gutterBottom>Privileges</Typography>
                <FormGroup row>
                  {PRIVS_OPTIONS.map((priv) => (
                    <FormControlLabel
                      key={priv}
                      control={
                        <Checkbox
                          size="small"
                          checked={grantPrivs.includes(priv)}
                          onChange={(_, checked) => {
                            if (priv === 'ALL PRIVILEGES') {
                              setGrantPrivs(checked ? ['ALL PRIVILEGES'] : []);
                            } else {
                              let next = grantPrivs.filter(p => p !== 'ALL PRIVILEGES');
                              if (checked) next.push(priv);
                              else next = next.filter(p => p !== priv);
                              setGrantPrivs(next);
                            }
                          }}
                          disabled={priv !== 'ALL PRIVILEGES' && grantPrivs.includes('ALL PRIVILEGES')}
                        />
                      }
                      label={<Typography variant="body2">{priv}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button onClick={handleGrant} variant="contained" disabled={!grantUser || !grantDb || grantPrivs.length === 0}>
              Grant
            </Button>
          </DialogActions>
        </Dialog>

        {/* ==================== SNACKBAR ==================== */}
        <Snackbar
          open={!!success}
          autoHideDuration={3000}
          onClose={() => setSuccess(null)}
          message={success}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </DashboardLayout>
  );
}
