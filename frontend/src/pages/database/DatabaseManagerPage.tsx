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
  Tabs,
  Tab,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Switch,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Storage,
  Add,
  Refresh,
  Public,
  PublicOff,
  HealthAndSafety,
  Info,
} from '@mui/icons-material';

import { DashboardLayout } from '../../layouts/dashboard/layout';
import { databaseApi as dbAPI } from '../../api/databases';
import { EngineInfo, DbInfo, DbUser, TableInfo, generatePassword } from '../../components/database/utils';
import { EngineCard } from '../../components/database/EngineCard';
import { DatabaseList } from '../../components/database/DatabaseList';
import { UserManager } from '../../components/database/UserManager';
import { PrivilegeManager } from '../../components/database/PrivilegeManager';
import { SqlConsole } from '../../components/database/SqlConsole';
import { MaintenancePanel } from '../../components/database/MaintenancePanel';
import { ConnectionInfo } from '../../components/database/ConnectionInfo';

export default function DatabaseManagerPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Engines
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [activeEngine, setActiveEngine] = useState<string>('mysql');
  const [busyStates, setBusyStates] = useState<any>({});

  // Data
  const [databases, setDatabases] = useState<DbInfo[]>([]);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [remoteAccess, setRemoteAccess] = useState<any>({});
  const [connectionInfo, setConnectionInfo] = useState<any>(null);

  // Dialogs
  const [createDbOpen, setCreateDbOpen] = useState(false);
  const [createDbName, setCreateDbName] = useState('');
  
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserHost, setNewUserHost] = useState('localhost');

  const [changePassOpen, setChangePassOpen] = useState(false);
  const [changePassData, setChangePassData] = useState<any>(null);
  const [changePassValue, setChangePassValue] = useState('');

  const [privOpen, setPrivOpen] = useState(false);
  const [privUser, setPrivUser] = useState<any>(null);
  const [privDetails, setPrivDetails] = useState<any[]>([]);
  const [privLoading, setPrivLoading] = useState(false);

  const [importOpen, setImportOpen] = useState({ open: false, db: '' });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [diagnoseOpen, setDiagnoseOpen] = useState({ open: false, data: null as any });

  const engineParam = activeEngine === 'postgresql' ? 'postgresql' : undefined;

  const loadStatus = useCallback(async () => {
    try {
      const data = await dbAPI.engines();
      const engList = data.engines || [];
      setEngines(engList);
      
      // Auto-select active engine if none selected or current is invalid
      const mysqlRunning = engList.find((e: any) => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed && e.running);
      const pgRunning = engList.find((e: any) => e.engine === 'postgresql' && e.installed && e.running);
      
      if (activeEngine === 'mysql' && !mysqlRunning && pgRunning) setActiveEngine('postgresql');
      else if (activeEngine === 'postgresql' && !pgRunning && mysqlRunning) setActiveEngine('mysql');
    } catch (e: any) { setError(e.message); }
  }, [activeEngine]);

  const loadData = useCallback(async () => {
    const mysqlRunning = engines.some(e => (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed && e.running);
    const pgRunning = engines.some(e => e.engine === 'postgresql' && e.installed && e.running);
    const activeUp = activeEngine === 'postgresql' ? pgRunning : mysqlRunning;

    if (!activeUp) {
      setDatabases([]);
      setUsers([]);
      return;
    }

    try {
      const [dbData, userData, raData, connData] = await Promise.all([
        dbAPI.listDatabases(engineParam),
        dbAPI.listUsers(engineParam),
        dbAPI.remoteAccess(),
        dbAPI.connectionInfo(),
      ]);
      setDatabases(dbData.databases || []);
      setUsers(userData.users || []);
      setRemoteAccess(raData);
      setConnectionInfo(connData);
    } catch (e: any) { setError(e.message); }
  }, [engines, activeEngine, engineParam]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadStatus();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!loading) loadData();
  }, [engines, activeEngine, loadData, loading]);

  const handleUpdateBusy = (key: string, value: string | null) => {
    setBusyStates((prev: any) => ({ ...prev, [key]: value }));
  };

  // ---- Engine Actions ----
  const handleEngineAction = async (engine: string, action: string) => {
    handleUpdateBusy(action, engine);
    try {
      let msg = '';
      if (action === 'restarting') msg = (await dbAPI.restartEngine(engine)).message;
      else if (action === 'starting') msg = (await dbAPI.startEngine(engine)).message;
      else if (action === 'stopping') {
        if (!window.confirm(`Stop ${engine}? All connections will close.`)) return;
        msg = (await dbAPI.stopEngine(engine)).message;
      } else if (action === 'installing') msg = (await dbAPI.installEngine(engine)).message;
      else if (action === 'uninstalling') {
        if (!window.confirm(`Uninstall ${engine}? Data remains but service is removed.`)) return;
        msg = (await dbAPI.uninstallEngine(engine)).message;
      }
      setSuccess(msg);
      await loadStatus();
    } catch (e: any) { setError(e.message); }
    finally { handleUpdateBusy(action, null); }
  };

  const handleDiagnose = async (engine: string) => {
    try {
      const data = await dbAPI.diagnoseEngine(engine);
      setDiagnoseOpen({ open: true, data });
    } catch (e: any) { setError(e.message); }
  };

  // ---- DB Actions ----
  const handleCreateDb = async () => {
    try {
      await dbAPI.createDatabase(createDbName, engineParam);
      setSuccess(`Database ${createDbName} created`);
      setCreateDbOpen(false);
      setCreateDbName('');
      loadData();
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteDb = async (name: string) => {
    if (!window.confirm(`Delete database ${name}? DATA LOSS IS PERMANENT.`)) return;
    try {
      await dbAPI.deleteDatabase(name, engineParam);
      setSuccess(`Database ${name} deleted`);
      loadData();
    } catch (e: any) { setError(e.message); }
  };

  const handleExport = async (name: string) => {
    try {
      const resp = await dbAPI.exportDb(name, engineParam);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.sql`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      await dbAPI.importDb(importOpen.db, importFile, undefined, engineParam);
      setSuccess(`Imported into ${importOpen.db}`);
      setImportOpen({ open: false, db: '' });
      setImportFile(null);
      loadData();
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  // ---- User Actions ----
  const handleCreateUser = async () => {
    try {
      await dbAPI.createUser(newUserName, newUserPassword, newUserHost, engineParam);
      setSuccess(`User ${newUserName} created`);
      setCreateUserOpen(false);
      setNewUserName('');
      setNewUserPassword('');
      loadData();
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteUser = async (user: string, host: string) => {
    if (!window.confirm(`Delete user ${user}@${host}?`)) return;
    try {
      await dbAPI.deleteUser(user, host, engineParam);
      setSuccess(`User deleted`);
      loadData();
    } catch (e: any) { setError(e.message); }
  };

  const handleViewPrivs = async (user: string, host: string) => {
    setPrivUser({ user, host });
    setPrivOpen(true);
    setPrivLoading(true);
    try {
      const data = await dbAPI.getPrivileges(user, host, engineParam);
      setPrivDetails(data.privileges || []);
    } catch (e: any) { setError(e.message); }
    finally { setPrivLoading(false); }
  };

  const handleGrant = async (database: string, privs: string[]) => {
    try {
      await dbAPI.grant(privUser.user, database, privs, privUser.host, engineParam);
      setSuccess(`Privileges granted on ${database}`);
      handleViewPrivs(privUser.user, privUser.host);
      loadData(); // Update user list tags
    } catch (e: any) { setError(e.message); }
  };

  const handleRevoke = async (database: string) => {
    try {
      await dbAPI.revoke(privUser.user, database, privUser.host, engineParam);
      setSuccess(`Privileges revoked on ${database}`);
      handleViewPrivs(privUser.user, privUser.host);
      loadData();
    } catch (e: any) { setError(e.message); }
  };

  const handleToggleRemote = async (checked: boolean) => {
    const engine = activeEngine === 'postgresql' ? 'postgresql' : 'mysql';
    try {
      await dbAPI.setRemoteAccess(engine, checked);
      setSuccess(`Remote access ${checked ? 'enabled' : 'disabled'} for ${engine}`);
      loadData();
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <DashboardLayout><Box sx={{ p: 8, textAlign: 'center' }}><CircularProgress /></Box></DashboardLayout>;

  const activeEngineObj = engines.find(e => activeEngine === 'postgresql' ? e.engine === 'postgresql' : (e.engine === 'mariadb' || e.engine === 'mysql') && e.installed);
  const isRunning = activeEngineObj?.running;

  return (
    <DashboardLayout>
      <Box>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
          <Storage sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Database Manager</Typography>
            <Typography variant="body1" color="text.secondary">Cross-engine relational database administration</Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 4 }}>
          {engines.map(eng => (
            <EngineCard
              key={eng.engine}
              engine={eng}
              activeEngine={activeEngine}
              onManage={(e) => setActiveEngine(e)}
              onRestart={(e) => handleEngineAction(e, 'restarting')}
              onStart={(e) => handleEngineAction(e, 'starting')}
              onStop={(e) => handleEngineAction(e, 'stopping')}
              onInstall={(e) => handleEngineAction(e, 'installing')}
              onUninstall={(e) => handleEngineAction(e, 'uninstalling')}
              onDiagnose={handleDiagnose}
              busyStates={busyStates}
            />
          ))}
        </Stack>

        {isRunning ? (
          <Paper sx={{ borderRadius: 2, overflow: 'hidden' }} variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label="Databases" sx={{ textTransform: 'none' }} />
                <Tab label="Users" sx={{ textTransform: 'none' }} />
                <Tab label="SQL Console" sx={{ textTransform: 'none' }} />
                <Tab label="Maintenance" sx={{ textTransform: 'none' }} />
                <Tab label="Connection Info" sx={{ textTransform: 'none' }} />
              </Tabs>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {activeEngineObj && (
                  <Tooltip title={activeEngine === 'postgresql' ? remoteAccess.postgresql?.enabled ? 'Remote access ON' : 'Remote access OFF' : remoteAccess.mysql?.enabled ? 'Remote access ON' : 'Remote access OFF'}>
                     <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="caption">Remote</Typography>
                        <Switch
                          size="small"
                          checked={activeEngine === 'postgresql' ? remoteAccess.postgresql?.enabled : remoteAccess.mysql?.enabled}
                          onChange={(_, c) => handleToggleRemote(c)}
                        />
                     </Stack>
                  </Tooltip>
                )}
                <Button size="small" startIcon={<Refresh />} onClick={loadData}>Reload</Button>
              </Box>
            </Box>
            <Box sx={{ p: 3 }}>
              {tab === 0 && (
                <DatabaseList
                  databases={databases}
                  engine={activeEngine}
                  onRefresh={loadData}
                  onCreateOpen={() => setCreateDbOpen(true)}
                  onDelete={handleDeleteDb}
                  onExport={handleExport}
                  onImportOpen={(db) => setImportOpen({ open: true, db })}
                  onExpandTables={(db) => dbAPI.listTables(db, engineParam).then(r => r.tables)}
                />
              )}
              {tab === 1 && (
                <UserManager
                  users={users}
                  onRefresh={loadData}
                  onCreateOpen={() => setCreateUserOpen(true)}
                  onDelete={handleDeleteUser}
                  onChangePasswordOpen={(u, h) => { setChangePassData({ u, h }); setChangePassOpen(true); }}
                  onViewPrivileges={handleViewPrivs}
                  onUpdateHost={async (user, oldHost, newHost) => {
                    try {
                      await dbAPI.updateUserHost(user, oldHost, newHost, engineParam);
                      setSuccess(`User host updated to ${newHost}`);
                      loadData();
                    } catch (e: any) { setError(e.message); }
                  }}
                />
              )}
              {tab === 2 && (
                <SqlConsole
                  databases={databases.map(d => d.name)}
                  engine={activeEngine}
                  onRunQuery={(db, sql) => dbAPI.query(db, sql, engineParam)}
                />
              )}
              {tab === 3 && (
                <MaintenancePanel
                  databases={databases.map(d => d.name)}
                  activeEngine={activeEngine}
                  onListTables={(db) => dbAPI.listTables(db, engineParam).then(r => r.tables.map((t: any) => t.name))}
                  onCheck={(db, t) => dbAPI.checkTable(db, t)}
                  onRepair={(db, t) => dbAPI.repairTable(db, t)}
                  onOptimize={(db, t) => dbAPI.optimizeTable(db, t)}
                />
              )}
              {tab === 4 && (
                <ConnectionInfo
                  engine={activeEngine}
                  connectionInfo={
                    activeEngine === 'postgresql'
                      ? connectionInfo?.postgresql
                      : connectionInfo?.mysql
                  }
                  remoteEnabled={
                    activeEngine === 'postgresql'
                      ? remoteAccess?.postgresql?.enabled
                      : remoteAccess?.mysql?.enabled
                  }
                  users={users}
                />
              )}
            </Box>
          </Paper>
        ) : (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 2 }} variant="outlined">
            <Info color="action" sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary">Select a running engine to manage databases.</Typography>
          </Paper>
        )}
      </Box>

      {/* Dialogs */}
      <Dialog open={createDbOpen} onClose={() => setCreateDbOpen(false)}>
        <DialogTitle>Create New Database</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth autoFocus label="Database Name"
            value={createDbName} onChange={(e) => setCreateDbName(e.target.value)}
            sx={{ mt: 1, minWidth: 300 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            The database will be created on the active {activeEngine} engine.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDbOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateDb} disabled={!createDbName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createUserOpen} onClose={() => setCreateUserOpen(false)}>
        <DialogTitle>Create Database User</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 350 }}>
            <TextField fullWidth label="Username" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
            <TextField
              fullWidth label="Password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)}
              InputProps={{
                endAdornment: <InputAdornment position="end"><Button size="small" onClick={() => setNewUserPassword(generatePassword())}>Gen</Button></InputAdornment>
              }}
            />
            <TextField fullWidth label="Host" value={newUserHost} onChange={(e) => setNewUserHost(e.target.value)} helperText="localhost or % for any host" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateUserOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateUser} disabled={!newUserName.trim() || !newUserPassword.trim()}>Create User</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={changePassOpen} onClose={() => setChangePassOpen(false)}>
        <DialogTitle>Change Password for {changePassData?.u}@{changePassData?.h}</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth autoFocus label="New Password" value={changePassValue} onChange={(e) => setChangePassValue(e.target.value)}
            InputProps={{
              endAdornment: <InputAdornment position="end"><Button size="small" onClick={() => setChangePassValue(generatePassword())}>Gen</Button></InputAdornment>
            }}
            sx={{ mt: 1, minWidth: 350 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePassOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            try {
              await dbAPI.changePassword(changePassData.u, changePassValue, changePassData.h, engineParam);
              setSuccess('Password updated');
              setChangePassOpen(false);
            } catch (e: any) { setError(e.message); }
          }} disabled={!changePassValue.trim()}>Update Password</Button>
        </DialogActions>
      </Dialog>

      <PrivilegeManager
        open={privOpen}
        onClose={() => setPrivOpen(false)}
        user={privUser?.user}
        host={privUser?.host}
        engine={activeEngine}
        databases={databases.map(d => d.name)}
        privileges={privDetails}
        onGrant={handleGrant}
        onRevoke={handleRevoke}
        loading={privLoading}
      />

      <Dialog open={importOpen.open} onClose={() => setImportOpen({ open: false, db: '' })}>
        <DialogTitle>Import SQL into {importOpen.db}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>Select a .sql file to upload and execute.</Typography>
          <Button variant="outlined" component="label" fullWidth>
            {importFile ? importFile.name : 'Choose SQL File'}
            <input type="file" hidden accept=".sql" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen({ open: false, db: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleImport} disabled={importing || !importFile}>
             {importing ? 'Importing...' : 'Start Import'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={diagnoseOpen.open} onClose={() => setDiagnoseOpen({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle>Engine Diagnosis</DialogTitle>
        <DialogContent dividers>
          <Box component="pre" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, fontSize: '0.8rem', overflow: 'auto' }}>
            {JSON.stringify(diagnoseOpen.data, null, 2)}
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setDiagnoseOpen({ open: false, data: null })}>Close</Button></DialogActions>
      </Dialog>

    </DashboardLayout>
  );
}
