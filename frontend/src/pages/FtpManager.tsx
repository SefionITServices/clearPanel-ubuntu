import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { ftpApi } from '../api/ftp';
import { domainsApi } from '../api/domains';

interface DomainInfo {
  id: string;
  name: string;
  folderPath: string;
  isPrimary?: boolean;
}

interface FtpAccount {
  id: string;
  domain: string;
  label: string;
  login: string;
  rootPath: string;
  createdAt: string;
  exists: boolean;
}

interface FtpStatus {
  vsftpd: { installed: boolean; running: boolean };
  proftpd: { installed: boolean; running: boolean };
  active: string | null;
}

function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => chars[v % chars.length]).join('');
}

export default function FtpManagerPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<FtpAccount[]>([]);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [status, setStatus] = useState<FtpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedLogin, setSelectedLogin] = useState<string>('');

  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetVisible, setResetVisible] = useState(false);

  const activeDomain = useMemo(() => domains.find((d) => d.name === domain), [domains, domain]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, accountsData, domainsData] = await Promise.all([
        ftpApi.status(),
        ftpApi.list(),
        domainsApi.list(),
      ]);
      setStatus(statusData);
      setAccounts(accountsData.accounts || []);
      setDomains(domainsData || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load FTP data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);
    try {
      const data = await ftpApi.create({ domain, username, password });
      if (!data.success) throw new Error(data.error || 'Failed to create account');
      setSuccess(`FTP account created: ${data.account.login}`);
      setCreateOpen(false);
      setDomain('');
      setUsername('');
      setPassword('');
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to create account');
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setSuccess(null);
    try {
      const data = await ftpApi.resetPassword(selectedLogin, resetPassword);
      if (!data.success) throw new Error(data.error || 'Failed to reset password');
      setSuccess('FTP password updated');
      setResetOpen(false);
      setResetPassword('');
    } catch (e: any) {
      setError(e.message || 'Failed to reset password');
    }
  };

  const handleDelete = async (id: string, login: string) => {
    if (!confirm(`Delete FTP account ${login}? This will remove the system user.`)) return;
    setError(null);
    setSuccess(null);
    try {
      const data = await ftpApi.remove(id);
      if (!data.success) throw new Error(data.error || 'Failed to delete account');
      setSuccess(`FTP account deleted: ${login}`);
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to delete account');
    }
  };

  const serviceAlert = (() => {
    if (!status) return null;
    if (!status.vsftpd.installed && !status.proftpd.installed) {
      return 'FTP service is not installed. Install vsftpd or proftpd to allow logins.';
    }
    if (!status.vsftpd.running && !status.proftpd.running) {
      return 'FTP service is installed but not running. Start vsftpd or proftpd.';
    }
    return null;
  })();

  return (
    <DashboardLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CloudUploadIcon sx={{ color: '#7B8A99', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>FTP Manager</Typography>
              <Typography variant="body1" color="text.secondary">
                Create and manage FTP logins per domain
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadAll} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ textTransform: 'none' }}>
              New FTP Account
            </Button>
          </Stack>
        </Box>

        {serviceAlert && (
          <Alert severity="warning" sx={{ mb: 2 }}>{serviceAlert}</Alert>
        )}

        {status && (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip
              label={`vsftpd: ${status.vsftpd.installed ? (status.vsftpd.running ? 'running' : 'stopped') : 'not installed'}`}
              color={status.vsftpd.running ? 'success' : status.vsftpd.installed ? 'warning' : 'default'}
              variant="outlined"
            />
            <Chip
              label={`proftpd: ${status.proftpd.installed ? (status.proftpd.running ? 'running' : 'stopped') : 'not installed'}`}
              color={status.proftpd.running ? 'success' : status.proftpd.installed ? 'warning' : 'default'}
              variant="outlined"
            />
            {status.active && (
              <Chip label={`active: ${status.active}`} color="primary" variant="outlined" />
            )}
          </Stack>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Card elevation={0} sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>FTP Accounts</Typography>
              {accounts.length === 0 ? (
                <Alert severity="info">No FTP accounts yet. Create your first account to enable FTP access.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Login</TableCell>
                        <TableCell>Domain</TableCell>
                        <TableCell>Root Path</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {accounts.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{acc.login}</Typography>
                              <Typography variant="caption" color="text.secondary">Label: {acc.label}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{acc.domain}</TableCell>
                          <TableCell>{acc.rootPath}</TableCell>
                          <TableCell>{new Date(acc.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={acc.exists ? 'active' : 'missing user'}
                              color={acc.exists ? 'success' : 'warning'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Reset password">
                              <IconButton onClick={() => { setSelectedLogin(acc.login); setResetOpen(true); }}>
                                <KeyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete account">
                              <IconButton onClick={() => handleDelete(acc.id, acc.login)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create FTP Account</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="ftp-domain-label">Domain</InputLabel>
              <Select
                labelId="ftp-domain-label"
                value={domain}
                label="Domain"
                onChange={(e) => setDomain(e.target.value)}
              >
                {domains.map((d) => (
                  <MenuItem key={d.id} value={d.name}>{d.name}{d.isPrimary ? ' (primary)' : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="FTP Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              helperText="Login will be prefixed with your panel username"
              fullWidth
            />
            <TextField
              label="Password"
              type={passwordVisible ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={passwordVisible ? 'Hide password' : 'Show password'}>
                      <IconButton onClick={() => setPasswordVisible((v) => !v)}>
                        {passwordVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </Tooltip>
                    <Button
                      onClick={() => setPassword(generatePassword())}
                      size="small"
                      sx={{ textTransform: 'none' }}
                    >
                      Generate
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Root Path"
              value={activeDomain?.folderPath || ''}
              fullWidth
              disabled
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!domain || !username || password.length < 8}
            sx={{ textTransform: 'none' }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reset FTP Password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="FTP Login" value={selectedLogin} fullWidth disabled />
            <TextField
              label="New Password"
              type={resetVisible ? 'text' : 'password'}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={resetVisible ? 'Hide password' : 'Show password'}>
                      <IconButton onClick={() => setResetVisible((v) => !v)}>
                        {resetVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </Tooltip>
                    <Button
                      onClick={() => setResetPassword(generatePassword())}
                      size="small"
                      sx={{ textTransform: 'none' }}
                    >
                      Generate
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleResetPassword}
            disabled={resetPassword.length < 8}
            sx={{ textTransform: 'none' }}
          >
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error || !!success}
        autoHideDuration={5000}
        onClose={() => { setError(null); setSuccess(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={error ? 'error' : 'success'}
          variant="filled"
          onClose={() => { setError(null); setSuccess(null); }}
        >
          {error || success}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
