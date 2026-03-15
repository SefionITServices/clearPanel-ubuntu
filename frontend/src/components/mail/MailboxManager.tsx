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
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InboxIcon from '@mui/icons-material/Inbox';
import StorageIcon from '@mui/icons-material/Storage';

import { mailAPI, MailDomain, MailboxSummary, UpdateMailboxPayload } from '../../api/mail';
import { validatePasswordStrength, generateStrongPassword, formatTimestamp } from './utils';

// You can re-import SieveFiltersPanel if you want it nested here (or leave it in MailDomainPanels)
import { SieveFiltersPanel } from '../MailDomainPanels';

interface MailboxManagerProps {
  domain: MailDomain;
  onDomainUpdate: (domain: MailDomain) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function MailboxManager({ domain, onDomainUpdate, onFeedback }: MailboxManagerProps) {
  const [form, setForm] = useState({ localPart: '', password: '', quotaMb: '' });
  const [addingError, setAddingError] = useState<string | null>(null);
  const [addingBusy, setAddingBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

  const [dialogOpen, setDialogOpen] = useState<{ mailboxId: string } | null>(null);
  const [editForm, setEditForm] = useState({ password: '', quotaMb: '', clearQuota: false });
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const handleCreateMailbox = async () => {
    const localPart = form.localPart.trim().toLowerCase();
    if (!localPart.length) {
      setAddingError('Enter a mailbox name');
      return;
    }

    let email = localPart;
    if (!email.includes('@')) {
      email = `${email}@${domain.domain}`;
    }

    const password = form.password.trim();
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setAddingError(passwordError);
      return;
    }

    let quotaMb: number | undefined;
    const quotaRaw = form.quotaMb.trim();
    if (quotaRaw) {
      const parsed = Number.parseInt(quotaRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setAddingError('Quota must be a positive integer');
        return;
      }
      quotaMb = Math.floor(parsed);
    }

    setAddingError(null);
    setAddingBusy(true);
    try {
      const result = await mailAPI.addMailbox(domain.id, { email, password, quotaMb });
      onDomainUpdate(result.domain);
      setForm({ localPart: '', password: '', quotaMb: '' });
      onFeedback('success', `Created mailbox ${email}`);
    } catch (error) {
      setAddingError(error instanceof Error ? error.message : 'Failed to create mailbox');
    } finally {
      setAddingBusy(false);
    }
  };

  const handleRemoveMailbox = async (mailbox: MailboxSummary) => {
    if (!window.confirm(`Remove mailbox ${mailbox.email}?`)) {
      return;
    }
    setRowBusy((prev) => ({ ...prev, [mailbox.id]: true }));
    try {
      const result = await mailAPI.removeMailbox(domain.id, mailbox.id);
      onDomainUpdate(result.domain);
      onFeedback('success', `Removed mailbox ${mailbox.email}`);
    } catch (error) {
      onFeedback('error', error instanceof Error ? error.message : 'Failed to remove mailbox');
    } finally {
      setRowBusy((prev) => {
        const copy = { ...prev };
        delete copy[mailbox.id];
        return copy;
      });
    }
  };

  const handleOpenEdit = (mailbox: MailboxSummary) => {
    setDialogOpen({ mailboxId: mailbox.id });
    setEditForm({
      password: '',
      quotaMb: mailbox.quotaMb !== undefined && mailbox.quotaMb !== null ? String(mailbox.quotaMb) : '',
      clearQuota: mailbox.quotaMb === undefined || mailbox.quotaMb === null,
    });
    setEditError(null);
  };

  const handleUpdateMailbox = async () => {
    if (!dialogOpen) return;
    const mailbox = domain.mailboxes.find((m) => m.id === dialogOpen.mailboxId);
    if (!mailbox) {
      setDialogOpen(null);
      return;
    }

    const payload: UpdateMailboxPayload = {};
    const trimmedPassword = editForm.password.trim();
    if (trimmedPassword) {
      const passwordError = validatePasswordStrength(trimmedPassword);
      if (passwordError) {
        setEditError(passwordError);
        return;
      }
      payload.password = trimmedPassword;
    }

    if (editForm.clearQuota) {
      payload.quotaMb = null;
    } else if (editForm.quotaMb.trim()) {
      const parsed = Number.parseInt(editForm.quotaMb.trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setEditError('Quota must be a positive integer');
        return;
      }
      payload.quotaMb = Math.floor(parsed);
    }

    if (Object.keys(payload).length === 0) {
      setEditError('Update password and/or quota before saving');
      return;
    }

    setEditBusy(true);
    setEditError(null);
    try {
      const result = await mailAPI.updateMailbox(domain.id, mailbox.id, payload);
      onDomainUpdate(result.domain);
      onFeedback('success', `Updated mailbox ${mailbox.email}`);
      setDialogOpen(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update mailbox');
    } finally {
      setEditBusy(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onFeedback('success', 'Copied to clipboard');
  };

  return (
    <Box>
      <Box sx={{ p: 2, bgcolor: (t) => t.palette.mode === 'dark' ? 'background.paper' : '#f8f9fa', borderRadius: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>Create New Mailbox</Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Email Address"
              value={form.localPart}
              onChange={(e) => setForm((p) => ({ ...p, localPart: e.target.value }))}
              placeholder="e.g. user"
              InputProps={{
                endAdornment: <InputAdornment position="end">@{domain.domain}</InputAdornment>
              }}
              sx={{ minWidth: 250 }}
            />
            <TextField
              size="small"
              label="Password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button size="small" onClick={() => {
                        const pwd = generateStrongPassword();
                        setForm((p) => ({ ...p, password: pwd }));
                        handleCopy(pwd);
                    }}>Gen</Button>
                  </InputAdornment>
                )
              }}
              sx={{ minWidth: 250 }}
            />
            <TextField
              size="small"
              label="Quota (MB)"
              placeholder="Unlimited"
              value={form.quotaMb}
              onChange={(e) => setForm((p) => ({ ...p, quotaMb: e.target.value }))}
              type="number"
              sx={{ width: 120 }}
            />
            <Button
              variant="contained"
              startIcon={addingBusy ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              onClick={handleCreateMailbox}
              disabled={addingBusy}
              sx={{ textTransform: 'none' }}
            >
              Create Mailbox
            </Button>
          </Stack>
          {addingError && <Typography color="error" variant="body2">{addingError}</Typography>}
        </Stack>
      </Box>

      {domain.mailboxes.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
          <InboxIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
          <Typography color="text.secondary">No mailboxes created for {domain.domain}</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5' }}>
                <TableCell>Email Address</TableCell>
                <TableCell>Quota</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {domain.mailboxes.map((mailbox) => (
                <React.Fragment key={mailbox.id}>
                  <TableRow hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{mailbox.email}</Typography>
                        <Tooltip title="Copy Email">
                          <IconButton size="small" onClick={() => handleCopy(mailbox.email)}>
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {mailbox.quotaMb ? (
                        <Chip size="small" variant="outlined" label={`${mailbox.quotaMb} MB`} icon={<StorageIcon fontSize="small"/>} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">Unlimited</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                        <Chip size="small" label={mailbox.active ? 'Active' : 'Inactive'} color={mailbox.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Edit Password / Quota">
                          <IconButton size="small" color="primary" onClick={() => handleOpenEdit(mailbox)} disabled={rowBusy[mailbox.id]}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Mailbox">
                          <IconButton size="small" color="error" onClick={() => handleRemoveMailbox(mailbox)} disabled={rowBusy[mailbox.id]}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  {/* Nest Sieve Filters panel here in a collapsible row or just standard if we want it isolated, for brevity we will just put it in a separate row */}
                  <TableRow>
                     <TableCell colSpan={4} sx={{ borderBottom: 'none', py: 0.5, bgcolor: 'background.default' }}>
                         <SieveFiltersPanel domainId={domain.id} mailbox={mailbox} onFeedback={onFeedback} />
                     </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!dialogOpen} onClose={() => setDialogOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Mailbox</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
             <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Change Password (Optional)</Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="New Password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={() => {
                            const pwd = generateStrongPassword();
                            setEditForm((p) => ({ ...p, password: pwd }));
                            handleCopy(pwd);
                        }}>Gen</Button>
                      </InputAdornment>
                    )
                  }}
                />
             </Box>
             <Divider />
             <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Set Quota</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    size="small"
                    label="Quota (MB)"
                    value={editForm.quotaMb}
                    onChange={(e) => setEditForm((p) => ({ ...p, quotaMb: e.target.value, clearQuota: false }))}
                    disabled={editForm.clearQuota}
                    type="number"
                  />
                  <Button variant={editForm.clearQuota ? "contained" : "outlined"} size="small" onClick={() => setEditForm((p) => ({...p, clearQuota: true, quotaMb: ''}))}>
                     Unlimited
                  </Button>
                </Stack>
             </Box>
             {editError && <Typography color="error" variant="body2">{editError}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateMailbox} disabled={editBusy} sx={{ textTransform: 'none' }}>
            {editBusy ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
