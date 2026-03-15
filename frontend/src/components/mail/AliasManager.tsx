import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
  CircularProgress,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';

import { mailAPI, MailDomain, MailAliasSummary } from '../../api/mail';

interface AliasManagerProps {
  domain: MailDomain;
  onDomainUpdate: (domain: MailDomain) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function AliasManager({ domain, onDomainUpdate, onFeedback }: AliasManagerProps) {
  const [form, setForm] = useState({ source: '', destination: '' });
  const [addingError, setAddingError] = useState<string | null>(null);
  const [addingBusy, setAddingBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

  const [dialogOpen, setDialogOpen] = useState<{ aliasId: string } | null>(null);
  const [editForm, setEditForm] = useState({ destination: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const handleCreateAlias = async () => {
    const sourceRaw = form.source.trim().toLowerCase();
    if (!sourceRaw.length) {
      setAddingError('Enter an alias name');
      return;
    }

    let source = sourceRaw;
    if (!source.includes('@')) {
      source = `${source}@${domain.domain}`;
    }

    const destination = form.destination.trim().toLowerCase();
    if (!destination.includes('@')) {
      setAddingError('Destination must be an email address');
      return;
    }

    setAddingError(null);
    setAddingBusy(true);
    try {
      const result = await mailAPI.addAlias(domain.id, { source, destination });
      onDomainUpdate(result.domain);
      setForm({ source: '', destination: '' });
      onFeedback('success', `Created alias ${source}`);
    } catch (error) {
      setAddingError(error instanceof Error ? error.message : 'Failed to create alias');
    } finally {
      setAddingBusy(false);
    }
  };

  const handleRemoveAlias = async (alias: MailAliasSummary) => {
    if (!window.confirm(`Remove alias ${alias.source}?`)) {
      return;
    }
    setRowBusy((prev) => ({ ...prev, [alias.id]: true }));
    try {
      const result = await mailAPI.removeAlias(domain.id, alias.id);
      onDomainUpdate(result.domain);
      onFeedback('success', `Removed alias ${alias.source}`);
    } catch (error) {
      onFeedback('error', error instanceof Error ? error.message : 'Failed to remove alias');
    } finally {
      setRowBusy((prev) => {
        const copy = { ...prev };
        delete copy[alias.id];
        return copy;
      });
    }
  };

  const handleOpenEdit = (alias: MailAliasSummary) => {
    setDialogOpen({ aliasId: alias.id });
    setEditForm({ destination: alias.destination });
    setEditError(null);
  };

  const handleUpdateAlias = async () => {
    if (!dialogOpen) return;
    const alias = domain.aliases.find((a) => a.id === dialogOpen.aliasId);
    if (!alias) {
      setDialogOpen(null);
      return;
    }

    const destination = editForm.destination.trim().toLowerCase();
    if (!destination.includes('@')) {
      setEditError('Destination must be a valid email address');
      return;
    }
    if (destination === alias.source) {
      setEditError('Destination cannot be the same as the source');
      return;
    }

    setEditBusy(true);
    setEditError(null);
    try {
      const result = await mailAPI.updateAlias(domain.id, alias.id, { destination });
      onDomainUpdate(result.domain);
      onFeedback('success', `Updated alias ${alias.source}`);
      setDialogOpen(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update alias');
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ p: 2, bgcolor: (t) => t.palette.mode === 'dark' ? 'background.paper' : '#f8f9fa', borderRadius: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>Create New Forwader Component (Alias)</Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Alias Email"
              value={form.source}
              onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
              placeholder="e.g. info"
              InputProps={{
                endAdornment: <InputAdornment position="end">@{domain.domain}</InputAdornment>
              }}
              sx={{ minWidth: 250 }}
            />
            <TextField
              size="small"
              label="Forward To"
              value={form.destination}
              onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
              placeholder="user@example.com"
              sx={{ minWidth: 250 }}
            />
            <Button
              variant="contained"
              startIcon={addingBusy ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              onClick={handleCreateAlias}
              disabled={addingBusy}
              sx={{ textTransform: 'none' }}
            >
              Add Forwarder
            </Button>
          </Stack>
          {addingError && <Typography color="error" variant="body2">{addingError}</Typography>}
        </Stack>
      </Box>

      {domain.aliases.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
          <ForwardToInboxIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
          <Typography color="text.secondary">No aliases created for {domain.domain}</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5' }}>
                <TableCell>Alias Source</TableCell>
                <TableCell>Destination</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {domain.aliases.map((alias) => (
                <TableRow key={alias.id} hover>
                  <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{alias.source}</Typography>
                  </TableCell>
                  <TableCell>
                      <Chip size="small" variant="outlined" label={alias.destination} icon={<ForwardToInboxIcon fontSize="small"/>} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit Destination">
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(alias)} disabled={rowBusy[alias.id]}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Alias">
                        <IconButton size="small" color="error" onClick={() => handleRemoveAlias(alias)} disabled={rowBusy[alias.id]}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!dialogOpen} onClose={() => setDialogOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Forwarder</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
             <Box>
                <TextField
                  fullWidth
                  size="small"
                  label="New Destination"
                  value={editForm.destination}
                  onChange={(e) => setEditForm((p) => ({ ...p, destination: e.target.value }))}
                />
             </Box>
             {editError && <Typography color="error" variant="body2">{editError}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateAlias} disabled={editBusy} sx={{ textTransform: 'none' }}>
            {editBusy ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
