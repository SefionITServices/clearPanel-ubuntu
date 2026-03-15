import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Security,
  Delete,
  Add,
  Shield,
} from '@mui/icons-material';

interface PrivilegeManagerProps {
  open: boolean;
  onClose: () => void;
  user: string;
  host: string;
  engine: string;
  databases: string[];
  privileges: { database: string; privileges: string[] }[];
  onGrant: (database: string, privs: string[]) => Promise<void>;
  onRevoke: (database: string) => Promise<void>;
  loading?: boolean;
}

export function PrivilegeManager({
  open,
  onClose,
  user,
  host,
  engine,
  databases,
  privileges,
  onGrant,
  onRevoke,
  loading,
}: PrivilegeManagerProps) {
  const [selectedDb, setSelectedDb] = useState('');
  const [selectedPrivs, setSelectedPrivs] = useState<string[]>(['ALL PRIVILEGES']);
  const [busy, setBusy] = useState(false);

  const PRIVS_OPTIONS = engine === 'postgresql'
    ? ['ALL', 'CREATE', 'CONNECT', 'TEMPORARY']
    : ['ALL PRIVILEGES', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX'];

  const handleTogglePriv = (priv: string) => {
    if (priv === 'ALL' || priv === 'ALL PRIVILEGES') {
      setSelectedPrivs([priv]);
      return;
    }
    setSelectedPrivs((prev) => {
      const filtered = prev.filter(p => p !== 'ALL' && p !== 'ALL PRIVILEGES');
      if (filtered.includes(priv)) {
        return filtered.filter(p => p !== priv);
      }
      return [...filtered, priv];
    });
  };

  const handleGrant = async () => {
    if (!selectedDb || selectedPrivs.length === 0) return;
    setBusy(true);
    try {
      await onGrant(selectedDb, selectedPrivs);
      setSelectedDb('');
      setSelectedPrivs(['ALL PRIVILEGES']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Security color="primary" />
        Manage Privileges for {user}@{host}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={4}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>Grant New Privileges</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Database</InputLabel>
                <Select
                  value={selectedDb}
                  label="Database"
                  onChange={(e) => setSelectedDb(e.target.value)}
                >
                  <MenuItem value=""><em>Select Database</em></MenuItem>
                  {databases.map(db => (
                    <MenuItem key={db} value={db}>{db}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Box sx={{ flex: 1 }}>
                <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
                  {PRIVS_OPTIONS.map(priv => (
                    <FormControlLabel
                      key={priv}
                      control={
                        <Checkbox
                          size="small"
                          checked={selectedPrivs.includes(priv)}
                          onChange={() => handleTogglePriv(priv)}
                        />
                      }
                      label={<Typography variant="body2">{priv}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Box>

              <Button
                variant="contained"
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Add />}
                onClick={handleGrant}
                disabled={busy || !selectedDb || selectedPrivs.length === 0}
                size="small"
                sx={{ textTransform: 'none', mt: 0.5 }}
              >
                Grant
              </Button>
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>Current Privileges</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={30} />
              </Box>
            ) : privileges.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No explicit privileges granted to this user.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8f9f8' }}>
                      <TableCell>Database</TableCell>
                      <TableCell>Privileges</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {privileges.map((item) => (
                      <TableRow key={item.database} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{item.database}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                            {item.privileges.map(p => (
                              <Typography key={p} variant="caption" sx={{ px: 0.8, py: 0.2, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                {p}
                              </Typography>
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Revoke All Privileges on this DB">
                            <IconButton size="small" color="error" onClick={() => onRevoke(item.database)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
