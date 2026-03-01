import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
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
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { dirPrivacyApi } from '../api/dirprivacy';
import { domainsApi } from '../api/domains';

interface DirPrivacyEntry {
  id: string;
  domain: string;
  dirPath: string;
  label: string;
  users: string[];
  createdAt: string;
}

export default function DirPrivacyPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DirPrivacyEntry[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [filterDomain, setFilterDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create dialog
  const [addOpen, setAddOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [dirPath, setDirPath] = useState('/');
  const [label, setLabel] = useState('Protected Area');
  const [saving, setSaving] = useState(false);

  // User dialog
  const [userOpen, setUserOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DirPrivacyEntry | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eData, dData] = await Promise.all([
        dirPrivacyApi.list(filterDomain || undefined),
        domainsApi.list(),
      ]);
      setEntries(eData.entries ?? []);
      const dl = dData.domains ?? dData ?? [];
      setDomains(dl.map((d: any) => d.name ?? d));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterDomain]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await dirPrivacyApi.create({ domain, dirPath, label });
      setSuccess('Protected directory added');
      setAddOpen(false);
      setDomain(''); setDirPath('/'); setLabel('Protected Area');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dirPrivacyApi.remove(id);
      setSuccess('Protection removed');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAddUser = async () => {
    if (!selectedEntry) return;
    setSavingUser(true);
    try {
      await dirPrivacyApi.addUser(selectedEntry.id, username, password);
      setSuccess(`User ${username} added`);
      setUserOpen(false);
      setUsername(''); setPassword('');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleRemoveUser = async (entry: DirPrivacyEntry, user: string) => {
    try {
      await dirPrivacyApi.removeUser(entry.id, user);
      setSuccess(`User ${user} removed`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={3}>
          <LockIcon color="primary" sx={{ fontSize: 32 }} />
          <Box flex={1}>
            <Typography variant="h5" fontWeight={700}>Directory Privacy</Typography>
            <Typography variant="body2" color="text.secondary">
              Password-protect directories with HTTP Basic Auth
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filter by domain</InputLabel>
            <Select
              value={filterDomain}
              label="Filter by domain"
              onChange={(e) => setFilterDomain(e.target.value)}
            >
              <MenuItem value="">All domains</MenuItem>
              {domains.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Protect Directory
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Stack spacing={2}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent>
                <Box textAlign="center" py={3}>
                  <Typography color="text.secondary">No protected directories yet.</Typography>
                </Box>
              </CardContent>
            </Card>
          ) : entries.map((e) => (
            <Card key={e.id} variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <LockIcon fontSize="small" color="action" />
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {e.domain}<span style={{ fontWeight: 400, color: '#888' }}>{e.dirPath}</span>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {e.label} &bull; {e.users.length} user{e.users.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  <Tooltip title="Manage users">
                    <Button
                      size="small"
                      startIcon={<PersonAddIcon />}
                      onClick={() => { setSelectedEntry(e); setUserOpen(true); }}
                    >
                      Users
                    </Button>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    {expanded === e.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <Tooltip title="Remove protection">
                    <IconButton size="small" color="error" onClick={() => handleDelete(e.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Collapse in={expanded === e.id}>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Authorized users
                  </Typography>
                  {e.users.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" pl={1}>
                      No users yet — add one to enable access.
                    </Typography>
                  ) : (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {e.users.map((u) => (
                        <Chip
                          key={u}
                          label={u}
                          size="small"
                          onDelete={() => handleRemoveUser(e, u)}
                        />
                      ))}
                    </Stack>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {/* Create Dialog */}
        <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Protect a Directory</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <FormControl fullWidth size="small">
                <InputLabel>Domain</InputLabel>
                <Select value={domain} label="Domain" onChange={(e) => setDomain(e.target.value)}>
                  {domains.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Directory path"
                placeholder="/admin"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                size="small"
                helperText="Path relative to document root"
              />
              <TextField
                label="Auth prompt label"
                placeholder="Protected Area"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                size="small"
                helperText="Shown in the browser login dialog"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={!domain || !dirPath || saving} onClick={handleCreate}>
              {saving ? 'Saving…' : 'Protect'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add User Dialog */}
        <Dialog open={userOpen} onClose={() => setUserOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>
            Add User — <span style={{ fontWeight: 400 }}>{selectedEntry?.dirPath}</span>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                size="small"
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                size="small"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setUserOpen(false); setUsername(''); setPassword(''); }}>Cancel</Button>
            <Button variant="contained" disabled={!username || !password || savingUser} onClick={handleAddUser}>
              {savingUser ? 'Adding…' : 'Add User'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess(null)} message={success} />
      </Box>
    </DashboardLayout>
  );
}
