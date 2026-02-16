import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Switch,
  LinearProgress,
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
  Upload,
  Visibility,
  VisibilityOff,
  ContentCopy,
  ExpandMore,
  ExpandLess,
  TableChart,
  OpenInNew,
  PlayArrow,
  Code,
  DeleteForever,
  Public,
  PublicOff,
  Search as SearchIcon,
  Info as InfoIcon,
  Build as BuildIcon,
  HealthAndSafety,
  Speed,
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
  exportDb: (database: string, engine?: string) =>
    fetch(`${API}/export/${encodeURIComponent(database)}${engine ? `?engine=${engine}` : ''}`, { credentials: 'include' }),
  importDb: (database: string, file?: File, sql?: string, engine?: string) => {
    const fd = new FormData();
    fd.append('database', database);
    if (engine) fd.append('engine', engine);
    if (file) fd.append('file', file);
    else if (sql) fd.append('sql', sql);
    return fetchJSON(`${API}/import`, { method: 'POST', body: fd });
  },
  query: (database: string, sql: string, engine?: string) => fetchJSON(`${API}/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, sql, engine }),
  }),
  metrics: () => fetchJSON(`${API}/metrics`),
  uninstallEngine: (engine: string) => fetchJSON(`${API}/uninstall/${engine}`, { method: 'POST' }),
  remoteAccess: () => fetchJSON(`${API}/remote-access`),
  setRemoteAccess: (engine: string, enabled: boolean) => fetchJSON(`${API}/remote-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine, enabled }),
  }),
  getPrivileges: (user: string, host?: string, engine?: string) =>
    fetchJSON(`${API}/privileges?user=${encodeURIComponent(user)}${host ? `&host=${encodeURIComponent(host)}` : ''}${engine ? `&engine=${engine}` : ''}`),
  connectionInfo: () => fetchJSON(`${API}/connection-info`),
  repairTable: (database: string, table: string) => fetchJSON(`${API}/tables/repair`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, table }),
  }),
  optimizeTable: (database: string, table: string) => fetchJSON(`${API}/tables/optimize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, table }),
  }),
  checkTable: (database: string, table: string) => fetchJSON(`${API}/tables/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, table }),
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
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => chars[v % chars.length]).join('');
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

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importDb, setImportDb] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSqlText, setImportSqlText] = useState('');
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SQL Query Runner
  const [queryDb, setQueryDb] = useState('');
  const [querySql, setQuerySql] = useState('');
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: string[][]; rowCount: number; duration: number } | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Uninstall
  const [uninstallingEngine, setUninstallingEngine] = useState<string | null>(null);

  // Remote access
  const [remoteAccess, setRemoteAccess] = useState<{
    mysql: { enabled: boolean; bindAddress: string } | null;
    postgresql: { enabled: boolean; listenAddresses: string } | null;
  }>({ mysql: null, postgresql: null });
  const [togglingRemote, setTogglingRemote] = useState(false);

  // Search / Filter
  const [dbSearch, setDbSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Privilege details
  const [privDetailsOpen, setPrivDetailsOpen] = useState(false);
  const [privDetailsUser, setPrivDetailsUser] = useState('');
  const [privDetailsHost, setPrivDetailsHost] = useState('');
  const [privDetails, setPrivDetails] = useState<{ database: string; privileges: string[] }[]>([]);
  const [privDetailsLoading, setPrivDetailsLoading] = useState(false);

  // Connection info
  const [connInfo, setConnInfo] = useState<{
    mysql: { host: string; port: number; socket: string } | null;
    postgresql: { host: string; port: number } | null;
  } | null>(null);
  const [connInfoOpen, setConnInfoOpen] = useState(false);

  // Metrics
  const [metricsData, setMetricsData] = useState<{ totalDatabases: number; totalUsers: number; totalSize: number; engines: any[] } | null>(null);

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
  const loadRemoteAccess = useCallback(async () => {
    try {
      const data = await dbAPI.remoteAccess();
      setRemoteAccess({ mysql: data.mysql, postgresql: data.postgresql });
    } catch {}
  }, []);

  useEffect(() => {
    const mysqlUp = engines.some(e => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed && e.running);
    const pgUp = engines.some(e => e.engine === 'postgresql' && e.installed && e.running);
    const activeUp = activeEngine === 'postgresql' ? pgUp : mysqlUp;
    if (activeUp) {
      loadDatabases();
      loadUsers();
      loadRemoteAccess();
      // Load connection info & metrics
      dbAPI.connectionInfo().then(setConnInfo).catch(() => {});
      dbAPI.metrics().then((d: any) => setMetricsData(d)).catch(() => {});
    } else {
      setDatabases([]);
      setUsers([]);
    }
  }, [engines, activeEngine, loadDatabases, loadUsers, loadRemoteAccess]);

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

  // ---- Export ----
  const handleExport = async (dbName: string) => {
    try {
      const resp = await dbAPI.exportDb(dbName, engineParam);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || 'Export failed');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dbName}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(`Exported "${dbName}" successfully`);
    } catch (e: any) { setError(e.message); }
  };

  // ---- Import ----
  const handleImport = async () => {
    if (!importDb) return;
    if (importMode === 'file' && !importFile) return;
    if (importMode === 'paste' && !importSqlText.trim()) return;
    setImporting(true);
    try {
      const data = importMode === 'paste'
        ? await dbAPI.importDb(importDb, undefined, importSqlText, engineParam)
        : await dbAPI.importDb(importDb, importFile || undefined, undefined, engineParam);
      setImportOpen(false);
      setImportFile(null);
      setImportSqlText('');
      setImportDb('');
      setImportMode('file');
      setSuccess(data.message || 'Import successful');
      loadDatabases();
    } catch (e: any) { setError(e.message); }
    setImporting(false);
  };

  // ---- Query Runner ----
  const handleRunQuery = async () => {
    if (!queryDb || !querySql.trim()) return;
    setQueryRunning(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const data = await dbAPI.query(queryDb, querySql, engineParam);
      setQueryResult({ columns: data.columns, rows: data.rows, rowCount: data.rowCount, duration: data.duration });
    } catch (e: any) {
      setQueryError(e.message);
    }
    setQueryRunning(false);
  };

  // ---- Uninstall Engine ----
  const handleUninstallEngine = async (engine: string) => {
    const label = engine === 'postgresql' ? 'PostgreSQL' : engine === 'mariadb' ? 'MariaDB' : 'MySQL';
    if (!window.confirm(`Uninstall ${label}? This will remove the database engine packages. Your data directories will remain on disk but will not be accessible until the engine is reinstalled.`)) return;
    setUninstallingEngine(engine);
    try {
      const data = await dbAPI.uninstallEngine(engine);
      setSuccess(data.message || `${label} uninstalled`);
      await loadStatus();
    } catch (e: any) { setError(e.message); }
    setUninstallingEngine(null);
  };

  // ---- View Privileges ----
  const handleViewPrivileges = async (user: string, host: string) => {
    setPrivDetailsUser(user);
    setPrivDetailsHost(host);
    setPrivDetailsOpen(true);
    setPrivDetailsLoading(true);
    try {
      const data = await dbAPI.getPrivileges(user, host, engineParam);
      setPrivDetails(data.privileges || []);
    } catch (e: any) {
      setError(e.message);
      setPrivDetails([]);
    }
    setPrivDetailsLoading(false);
  };

  // ---- Table Maintenance (MySQL only) ----
  const handleRepairTable = async (database: string, table: string) => {
    try {
      const data = await dbAPI.repairTable(database, table);
      setSuccess(data.message || `Repair completed for ${table}`);
    } catch (e: any) { setError(e.message); }
  };

  const handleOptimizeTable = async (database: string, table: string) => {
    try {
      const data = await dbAPI.optimizeTable(database, table);
      setSuccess(data.message || `Optimize completed for ${table}`);
    } catch (e: any) { setError(e.message); }
  };

  const handleCheckTable = async (database: string, table: string) => {
    try {
      const data = await dbAPI.checkTable(database, table);
      setSuccess(data.message || `Check completed for ${table}`);
    } catch (e: any) { setError(e.message); }
  };

  // ---- Remote Access ----
  const handleToggleRemoteAccess = async (engine: 'mysql' | 'postgresql', enabled: boolean) => {
    setTogglingRemote(true);
    try {
      const data = await dbAPI.setRemoteAccess(engine, enabled);
      setSuccess(data.message);
      await loadRemoteAccess();
    } catch (e: any) { setError(e.message); }
    setTogglingRemote(false);
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
  const isActiveEngineRunning = activeEngine === 'postgresql' ? pgRunning : anyMysqlRunning;

  const engineCards: { engine: string; label: string; description: string; color: string }[] = [
    { engine: 'mariadb', label: 'MariaDB', description: 'Community-developed fork of MySQL with enhanced performance.', color: '#003545' },
    { engine: 'mysql', label: 'MySQL', description: "World's most popular open-source relational database.", color: '#00758F' },
    { engine: 'postgresql', label: 'PostgreSQL', description: 'Advanced open-source database with powerful features.', color: '#336791' },
  ];

  // ---- Main render ----

  const activeEngineLabel = activeEngine === 'postgresql' ? 'PostgreSQL'
    : engines.find(e => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed)?.label || 'MySQL';

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Storage sx={{ color: '#4285F4', fontSize: 28 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Database Management</Typography>
            <Typography variant="body1" color="text.secondary">Install and manage database engines</Typography>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Engine Cards - always visible */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
          {engineCards.map((card) => {
            const eng = engines.find(e => e.engine === card.engine);
            const isInstalled = eng?.installed || false;
            const isRunning = eng?.running || false;
            const isInstalling = installingEngine === card.engine;
            const isManaging = isRunning && (
              (card.engine === 'postgresql' && activeEngine === 'postgresql') ||
              ((card.engine === 'mariadb' || card.engine === 'mysql') && activeEngine !== 'postgresql')
            );

            return (
              <Paper
                key={card.engine}
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  border: isManaging ? `2px solid ${card.color}` : isInstalled ? '2px solid #34A853' : '1px solid #e0e0e0',
                  transition: 'all 0.2s',
                  ...(isManaging && { boxShadow: `0 0 0 1px ${card.color}20, 0 4px 12px ${card.color}15` }),
                }}
              >
                <Box sx={{ p: 2, bgcolor: card.color, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{card.label}</Typography>
                  {isInstalled && (
                    <Chip
                      label={isRunning ? 'Running' : 'Stopped'}
                      size="small"
                      sx={{ bgcolor: isRunning ? '#34A853' : '#F4B400', color: '#fff', fontWeight: 600 }}
                    />
                  )}
                </Box>
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>
                    {card.description}
                  </Typography>
                  {eng?.version && (
                    <Chip
                      label={eng.version.split('\n')[0].substring(0, 50)}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: '0.7rem', mb: 1.5 }}
                    />
                  )}

                  {isInstalled && isRunning ? (
                    <Stack spacing={1}>
                    <Button
                      variant={isManaging ? 'contained' : 'outlined'}
                      fullWidth
                      size="small"
                      startIcon={<Storage />}
                      onClick={() => setActiveEngine(card.engine === 'postgresql' ? 'postgresql' : 'mysql')}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        ...(isManaging && { bgcolor: card.color, '&:hover': { bgcolor: card.color, opacity: 0.9 } }),
                      }}
                    >
                      {isManaging ? 'Managing' : 'Manage'}
                    </Button>
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      color="error"
                      startIcon={uninstallingEngine === card.engine ? <CircularProgress size={16} color="inherit" /> : <DeleteForever />}
                      onClick={() => handleUninstallEngine(card.engine)}
                      disabled={!!uninstallingEngine}
                      sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                    >
                      {uninstallingEngine === card.engine ? 'Uninstalling...' : 'Uninstall'}
                    </Button>
                    </Stack>
                  ) : isInstalled && !isRunning ? (
                    <Chip label="Stopped" color="warning" size="small" variant="outlined" />
                  ) : (
                    <Button
                      variant="contained"
                      fullWidth
                      size="small"
                      onClick={() => handleInstallEngine(card.engine)}
                      disabled={!!installingEngine}
                      startIcon={isInstalling ? <CircularProgress size={16} color="inherit" /> : <Download />}
                      sx={{ textTransform: 'none', bgcolor: card.color, '&:hover': { bgcolor: card.color, opacity: 0.9 } }}
                    >
                      {isInstalling ? `Installing ${card.label}...` : `Install ${card.label}`}
                    </Button>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Stack>

        {/* Management Section */}
        {isActiveEngineRunning ? (
        <>
        <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Storage sx={{ color: activeEngine === 'postgresql' ? '#336791' : '#00758F' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{activeEngineLabel} Management</Typography>
              <Typography variant="body2" color="text.secondary">
                {engines.find(e => activeEngine === 'postgresql' ? e.engine === 'postgresql' : (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed)?.version?.split('\n')[0].substring(0, 80) || ''}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Remote Access Toggle */}
            {(() => {
              const ra = activeEngine === 'postgresql' ? remoteAccess.postgresql : remoteAccess.mysql;
              if (!ra) return null;
              return (
                <Tooltip title={ra.enabled ? 'Remote access enabled — click to disable' : 'Remote access disabled — click to enable'}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 1 }}>
                    {ra.enabled ? <Public sx={{ fontSize: 18, color: '#34A853' }} /> : <PublicOff sx={{ fontSize: 18, color: '#999' }} />}
                    <Typography variant="caption" sx={{ mr: 0.5 }}>Remote</Typography>
                    <Switch
                      size="small"
                      checked={ra.enabled}
                      disabled={togglingRemote}
                      onChange={(_, checked) => handleToggleRemoteAccess(activeEngine === 'postgresql' ? 'postgresql' : 'mysql', checked)}
                    />
                  </Stack>
                </Tooltip>
              );
            })()}
            {activeEngine === 'postgresql' ? (
              <Button
                variant="contained"
                size="small"
                startIcon={<OpenInNew />}
                onClick={() => window.open('/pgadmin', '_blank')}
                sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#336791', '&:hover': { bgcolor: '#2a567a' } }}
              >
                pgAdmin
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                startIcon={<OpenInNew />}
                onClick={() => window.open('/phpmyadmin', '_blank')}
                sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#F89C0E', '&:hover': { bgcolor: '#e08c00' } }}
              >
                phpMyAdmin
              </Button>
            )}
            <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={() => { loadDatabases(); loadUsers(); }}>
              Refresh
            </Button>
            <Tooltip title="Connection Info">
              <Button variant="outlined" size="small" startIcon={<InfoIcon />} onClick={() => setConnInfoOpen(true)}>
                Connect
              </Button>
            </Tooltip>
          </Stack>
        </Paper>

        {/* Stat Cards */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Databases', value: metricsData?.totalDatabases ?? databases.length, icon: <Storage />, color: '#4285F4', bg: '#E8F0FE' },
            { label: 'Users', value: metricsData?.totalUsers ?? users.length, icon: <Person />, color: '#34A853', bg: '#E6F4EA' },
            { label: 'Total Size', value: formatSize(metricsData?.totalSize ?? databases.reduce((s, d) => s + d.size, 0)), icon: <Download />, color: '#F4B400', bg: '#FEF7E0' },
            { label: 'Engines', value: engines.filter(e => e.installed && e.running).length, icon: <Speed />, color: '#EA4335', bg: '#FCE8E6' },
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
            <Tab label="SQL Query" icon={<Code />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 500 }} />
          </Tabs>

        {/* ==================== DATABASES TAB ==================== */}
        {tab === 0 && (
          <>
            <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {databases.length} database{databases.length !== 1 ? 's' : ''}
                </Typography>
                {databases.length > 3 && (
                  <TextField
                    size="small"
                    placeholder="Filter databases…"
                    value={dbSearch}
                    onChange={(e) => setDbSearch(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#999' }} /></InputAdornment> }}
                    sx={{ width: 200, '& .MuiInputBase-root': { height: 32, fontSize: '0.8rem' } }}
                  />
                )}
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" startIcon={<Upload />} onClick={() => { setImportDb(databases.length > 0 ? databases[0].name : ''); setImportOpen(true); }}>
                  Import SQL
                </Button>
                <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setCreateDbOpen(true)}>
                  Create Database
                </Button>
              </Stack>
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
                    databases.filter(db => !dbSearch || db.name.toLowerCase().includes(dbSearch.toLowerCase())).map((db) => (
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
                            <Stack direction="row" spacing={0}>
                              <Tooltip title="Export / Download SQL">
                                <IconButton size="small" color="primary" onClick={() => handleExport(db.name)}>
                                  <Download fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Import SQL into this database">
                                <IconButton size="small" onClick={() => { setImportDb(db.name); setImportOpen(true); }}>
                                  <Upload fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete database">
                                <IconButton size="small" color="error" onClick={() => handleDeleteDb(db.name)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
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
                                        {activeEngine !== 'postgresql' && <TableCell sx={{ width: 120 }}>Maintenance</TableCell>}
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
                                          {activeEngine !== 'postgresql' && expandedDb && (
                                            <TableCell>
                                              <Stack direction="row" spacing={0}>
                                                <Tooltip title="Check table">
                                                  <IconButton size="small" onClick={() => handleCheckTable(expandedDb, t.name)}>
                                                    <HealthAndSafety sx={{ fontSize: 16 }} />
                                                  </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Repair table">
                                                  <IconButton size="small" onClick={() => handleRepairTable(expandedDb, t.name)}>
                                                    <BuildIcon sx={{ fontSize: 16 }} />
                                                  </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Optimize table">
                                                  <IconButton size="small" onClick={() => handleOptimizeTable(expandedDb, t.name)}>
                                                    <Speed sx={{ fontSize: 16 }} />
                                                  </IconButton>
                                                </Tooltip>
                                              </Stack>
                                            </TableCell>
                                          )}
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
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {users.length} user{users.length !== 1 ? 's' : ''}
                </Typography>
                {users.length > 3 && (
                  <TextField
                    size="small"
                    placeholder="Filter users…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#999' }} /></InputAdornment> }}
                    sx={{ width: 200, '& .MuiInputBase-root': { height: 32, fontSize: '0.8rem' } }}
                  />
                )}
              </Stack>
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
                    users.filter(u => !userSearch || u.user.toLowerCase().includes(userSearch.toLowerCase()) || u.host.toLowerCase().includes(userSearch.toLowerCase())).map((u) => (
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
                            <Tooltip title="View privileges">
                              <IconButton size="small" color="info" onClick={() => handleViewPrivileges(u.user, u.host)}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
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

        {/* ==================== SQL QUERY TAB ==================== */}
        {tab === 2 && (
          <Box sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="flex-end">
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Database</InputLabel>
                  <Select value={queryDb} label="Database" onChange={(e) => setQueryDb(e.target.value)}>
                    {databases.map((db) => (
                      <MenuItem key={db.name} value={db.name}>{db.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={queryRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
                  onClick={handleRunQuery}
                  disabled={queryRunning || !queryDb || !querySql.trim()}
                  sx={{ textTransform: 'none', fontWeight: 600, height: 40 }}
                >
                  {queryRunning ? 'Running...' : 'Run Query'}
                </Button>
              </Stack>

              <TextField
                multiline
                minRows={4}
                maxRows={12}
                fullWidth
                placeholder={`Enter SQL query here...\ne.g. SELECT * FROM users;`}
                value={querySql}
                onChange={(e) => setQuerySql(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleRunQuery();
                  }
                }}
                sx={{
                  '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.875rem' },
                }}
                helperText="Press Ctrl+Enter to run. Results limited to 1000 rows. DROP DATABASE/SCHEMA statements are blocked."
              />

              {queryRunning && <LinearProgress />}

              {queryError && (
                <Alert severity="error" onClose={() => setQueryError(null)}>{queryError}</Alert>
              )}

              {queryResult && (
                <Box>
                  <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                    <Chip label={`${queryResult.rowCount} row${queryResult.rowCount !== 1 ? 's' : ''}`} size="small" color="primary" variant="outlined" />
                    <Chip label={`${queryResult.duration}ms`} size="small" variant="outlined" />
                  </Stack>
                  {queryResult.rows.length > 0 ? (
                    <TableContainer sx={{ maxHeight: 400, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            {queryResult.columns.map((col, i) => (
                              <TableCell key={i} sx={{ fontWeight: 700, bgcolor: '#f5f5f5', whiteSpace: 'nowrap' }}>
                                {col}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {queryResult.rows.map((row, ri) => (
                            <TableRow key={ri} hover>
                              {row.map((cell, ci) => (
                                <TableCell key={ci} sx={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {cell === 'NULL' ? <Typography variant="caption" color="text.disabled">NULL</Typography> : cell}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="info">Query executed successfully with no result rows.</Alert>
                  )}
                </Box>
              )}
            </Stack>
          </Box>
        )}

        </Paper>
        </>
        ) : (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8f9fa' }}>
          <Box sx={{ mb: 2 }}>
            <Storage sx={{ fontSize: 48, color: '#bdbdbd' }} />
          </Box>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No database engine running
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Install a database engine above to start managing databases
          </Typography>
        </Paper>
        )}

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

        {/* Import SQL Dialog */}
        <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Upload sx={{ color: '#4285F4' }} />
            Import SQL
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Target Database</InputLabel>
                <Select value={importDb} label="Target Database" onChange={(e) => setImportDb(e.target.value)}>
                  {databases.map((db) => (
                    <MenuItem key={db.name} value={db.name}>{db.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Tabs value={importMode === 'file' ? 0 : 1} onChange={(_, v) => setImportMode(v === 0 ? 'file' : 'paste')} sx={{ minHeight: 36 }}>
                <Tab label="Upload File" sx={{ textTransform: 'none', minHeight: 36, py: 0 }} />
                <Tab label="Paste SQL" sx={{ textTransform: 'none', minHeight: 36, py: 0 }} />
              </Tabs>

              {importMode === 'file' ? (
                <Box>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setImportFile(f);
                    }}
                  />
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Upload />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ textTransform: 'none', py: 2, borderStyle: 'dashed' }}
                  >
                    {importFile ? importFile.name : 'Choose .sql file to import'}
                  </Button>
                  {importFile && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      File size: {(importFile.size / 1024).toFixed(1)} KB
                    </Typography>
                  )}
                </Box>
              ) : (
                <TextField
                  multiline
                  minRows={6}
                  maxRows={12}
                  fullWidth
                  placeholder={"Paste SQL statements here...\ne.g. CREATE TABLE ...; INSERT INTO ...;"}
                  value={importSqlText}
                  onChange={(e) => setImportSqlText(e.target.value)}
                  sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setImportOpen(false); setImportFile(null); setImportSqlText(''); setImportMode('file'); }}>Cancel</Button>
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={!importDb || (importMode === 'file' ? !importFile : !importSqlText.trim()) || importing}
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <Upload />}
            >
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ==================== CONNECTION INFO DIALOG ==================== */}
        <Dialog open={connInfoOpen} onClose={() => setConnInfoOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon sx={{ color: '#4285F4' }} />
            Connection Information
          </DialogTitle>
          <DialogContent>
            {connInfo ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                {connInfo.mysql && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>MySQL / MariaDB</Typography>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Host</Typography><Typography variant="body2" fontFamily="monospace">{connInfo.mysql.host}</Typography></Stack>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Port</Typography><Typography variant="body2" fontFamily="monospace">{connInfo.mysql.port}</Typography></Stack>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Socket</Typography><Typography variant="body2" fontFamily="monospace">{connInfo.mysql.socket}</Typography></Stack>
                    </Stack>
                  </Paper>
                )}
                {connInfo.postgresql && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>PostgreSQL</Typography>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Host</Typography><Typography variant="body2" fontFamily="monospace">{connInfo.postgresql.host}</Typography></Stack>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Port</Typography><Typography variant="body2" fontFamily="monospace">{connInfo.postgresql.port}</Typography></Stack>
                    </Stack>
                  </Paper>
                )}
                <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                  Use these settings in your application config or external client (e.g. MySQL Workbench, DBeaver, pgAdmin).
                </Alert>
              </Stack>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConnInfoOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* ==================== PRIVILEGE DETAILS DIALOG ==================== */}
        <Dialog open={privDetailsOpen} onClose={() => setPrivDetailsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility sx={{ color: '#34A853' }} />
            Privileges for "{privDetailsUser}"@"{privDetailsHost}"
          </DialogTitle>
          <DialogContent>
            {privDetailsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : privDetails.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>No privileges found for this user.</Typography>
            ) : (
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Database</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Privileges</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {privDetails.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">{p.database}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {p.privileges.map((priv) => (
                              <Chip key={priv} label={priv} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                            ))}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPrivDetailsOpen(false)}>Close</Button>
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
