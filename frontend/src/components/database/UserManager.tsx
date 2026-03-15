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
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Delete,
  Key,
  KeyOff,
  Search as SearchIcon,
  Security,
  Person,
} from '@mui/icons-material';
import { DbUser } from './utils';

interface UserManagerProps {
  users: DbUser[];
  onRefresh: () => void;
  onCreateOpen: () => void;
  onDelete: (name: string, host: string) => void;
  onChangePasswordOpen: (name: string, host: string) => void;
  onViewPrivileges: (name: string, host: string) => void;
  loading?: boolean;
}

export function UserManager({
  users,
  onRefresh,
  onCreateOpen,
  onDelete,
  onChangePasswordOpen,
  onViewPrivileges,
  loading,
}: UserManagerProps) {
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => 
    u.user.toLowerCase().includes(search.toLowerCase()) || 
    u.host.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" justifyContent="space-between">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Database Users</Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 250 }}
          />
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onCreateOpen}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Create User
          </Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }}>
              <TableCell>User</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Authorized Databases</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  {search ? 'No results found' : 'No users found'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={`${user.user}@${user.host}`} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Person fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{user.user}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={user.host} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                      {user.databases.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">None</Typography>
                      ) : (
                        user.databases.map(db => (
                          <Chip key={db} label={db} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        ))
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="View/Edit Privileges">
                        <IconButton size="small" color="primary" onClick={() => onViewPrivileges(user.user, user.host)}>
                          <Security fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Change Password">
                        <IconButton size="small" color="primary" onClick={() => onChangePasswordOpen(user.user, user.host)}>
                          <Key fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete User">
                        <IconButton size="small" color="error" onClick={() => onDelete(user.user, user.host)}>
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
    </Box>
  );
}
