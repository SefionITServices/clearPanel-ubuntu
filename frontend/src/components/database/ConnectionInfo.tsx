import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ContentCopy,
  Check,
  Dns,
  Key,
  Person,
  Storage,
  Terminal,
  Lan,
} from '@mui/icons-material';
import { DbUser } from './utils';

interface ConnectionInfoProps {
  engine: string;
  connectionInfo: {
    host: string;
    port: number;
    publicIp?: string;
    socket?: string;
  } | null;
  remoteEnabled: boolean;
  users: DbUser[];
}

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80, fontWeight: 500 }}>
        {label}:
      </Typography>
      <Box
        sx={{
          flex: 1,
          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          borderRadius: 1,
          px: 1.5,
          py: 0.5,
          fontFamily: mono ? 'monospace' : 'inherit',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid',
          borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontFamily: mono ? 'monospace' : 'inherit', fontSize: '0.85rem', wordBreak: 'break-all' }}
        >
          {value}
        </Typography>
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton size="small" onClick={handleCopy} sx={{ ml: 1 }}>
            {copied ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}

function ConnectionStringTab({ label, connectionString }: { label: string; connectionString: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(connectionString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : '#1e1e2e',
        borderRadius: 1.5,
        p: 2,
        position: 'relative',
        mt: 1,
      }}
    >
      <Tooltip title={copied ? 'Copied!' : 'Copy connection string'}>
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{ position: 'absolute', top: 8, right: 8, color: '#aaa' }}
        >
          {copied ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Typography
        component="pre"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          color: '#a9dc76',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          m: 0,
          pr: 4,
        }}
      >
        {connectionString}
      </Typography>
    </Box>
  );
}

export function ConnectionInfo({ engine, connectionInfo, remoteEnabled, users }: ConnectionInfoProps) {
  const [connTab, setConnTab] = useState(0);

  if (!connectionInfo) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        Connection information is not available. Make sure the database engine is running.
      </Alert>
    );
  }

  const isMySQL = engine !== 'postgresql';
  const engineLabel = isMySQL ? 'MySQL / MariaDB' : 'PostgreSQL';
  const defaultPort = isMySQL ? 3306 : 5432;
  const port = connectionInfo.port || defaultPort;
  const host = remoteEnabled && connectionInfo.publicIp ? connectionInfo.publicIp : connectionInfo.host;
  const remoteHost = connectionInfo.publicIp || connectionInfo.host;

  // Build connection strings for each user
  const getConnectionStrings = (username: string) => {
    if (isMySQL) {
      return {
        cli: `mysql -h ${remoteHost} -P ${port} -u ${username} -p`,
        workbench: `Host: ${remoteHost}\nPort: ${port}\nUsername: ${username}`,
        jdbc: `jdbc:mysql://${remoteHost}:${port}/<database>?user=${username}&password=<password>`,
        dotnet: `Server=${remoteHost};Port=${port};Database=<database>;User Id=${username};Password=<password>;`,
        php: `$pdo = new PDO('mysql:host=${remoteHost};port=${port};dbname=<database>', '${username}', '<password>');`,
      };
    } else {
      return {
        cli: `psql -h ${remoteHost} -p ${port} -U ${username} -d <database>`,
        workbench: `Host: ${remoteHost}\nPort: ${port}\nUsername: ${username}`,
        jdbc: `jdbc:postgresql://${remoteHost}:${port}/<database>?user=${username}&password=<password>`,
        dotnet: `Host=${remoteHost};Port=${port};Database=<database>;Username=${username};Password=<password>;`,
        php: `$pdo = new PDO('pgsql:host=${remoteHost};port=${port};dbname=<database>', '${username}', '<password>');`,
      };
    }
  };

  const connTabLabels = ['CLI', isMySQL ? 'Workbench' : 'pgAdmin', 'JDBC', '.NET', 'PHP'];

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Lan sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Remote Connection Details</Typography>
        <Chip
          label={remoteEnabled ? 'Remote Enabled' : 'Local Only'}
          size="small"
          color={remoteEnabled ? 'success' : 'default'}
          sx={{ fontWeight: 600 }}
        />
      </Stack>

      {!remoteEnabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Remote access is currently <strong>disabled</strong>. Toggle the "Remote" switch above to allow external connections.
          Users will only be able to connect locally (from the server itself) until remote access is enabled.
        </Alert>
      )}

      {/* Server Connection Details */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Dns fontSize="small" color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Server Details — {engineLabel}
          </Typography>
        </Stack>

        <CopyField label="Host" value={remoteEnabled ? remoteHost : host} />
        <CopyField label="Port" value={String(port)} />
        {isMySQL && connectionInfo.socket && (
          <CopyField label="Socket" value={connectionInfo.socket} />
        )}
      </Paper>

      {/* User Credentials Table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Person fontSize="small" color="primary" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              User Credentials
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Use these credentials in your database client. Passwords are set when creating or changing a user's password above.
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa' }}>
                <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Host Allowed</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Databases</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Connection String</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No database users created yet. Create a user in the "Users" tab first.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const connStrings = getConnectionStrings(u.user);
                  const canConnectRemotely = u.host === '%' || u.host === '0.0.0.0' || u.host === '*' || u.host === 'local';
                  return (
                    <TableRow key={`${u.user}@${u.host}`} hover>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {u.user}
                          </Typography>
                          <CopyButton value={u.user} />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.host}
                          size="small"
                          variant="outlined"
                          color={canConnectRemotely ? 'success' : 'default'}
                          sx={{ fontSize: '0.75rem' }}
                        />
                        {!canConnectRemotely && u.host === 'localhost' && remoteEnabled && (
                          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                            ⚠ Host is "localhost" — can't connect remotely
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                          {u.databases.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">None</Typography>
                          ) : (
                            u.databases.map(db => (
                              <Chip key={db} label={db} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                            ))
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <CopyButton value={isMySQL ? connStrings.cli : connStrings.cli} label="Copy CLI command" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Quick Connect Snippets */}
      {users.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Terminal fontSize="small" color="primary" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Quick Connect — {users[0]?.user}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Replace <code>&lt;password&gt;</code> with the user's password and <code>&lt;database&gt;</code> with the target database name.
          </Typography>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={connTab} onChange={(_, v) => setConnTab(v)} variant="scrollable" scrollButtons="auto">
              {connTabLabels.map((label, i) => (
                <Tab key={label} label={label} sx={{ textTransform: 'none', fontSize: '0.8rem', minWidth: 60 }} />
              ))}
            </Tabs>
          </Box>

          {(() => {
            const connStrings = getConnectionStrings(users[0]?.user || 'username');
            const keys = ['cli', 'workbench', 'jdbc', 'dotnet', 'php'] as const;
            return <ConnectionStringTab label={connTabLabels[connTab]} connectionString={connStrings[keys[connTab]]} />;
          })()}
        </Paper>
      )}
    </Box>
  );
}

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Tooltip title={copied ? 'Copied!' : label}>
      <IconButton size="small" onClick={handleCopy}>
        {copied ? <Check sx={{ fontSize: 14 }} color="success" /> : <ContentCopy sx={{ fontSize: 14 }} />}
      </IconButton>
    </Tooltip>
  );
}
