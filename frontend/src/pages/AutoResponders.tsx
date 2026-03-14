import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  CircularProgress,
  Button,
  Switch,
  TextField,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { mailAPI } from '../api/mail';
import { autorespondersApi } from '../api/autoresponders';

export default function AutoResponders() {
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingResponders, setLoadingResponders] = useState(false);
  const [responders, setResponders] = useState<any[]>([]);
  const [toast, setToast] = useState('');
  
  // Dialog state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    subject: 'Out of Office Re:',
    body: 'I am currently out of the office and will respond to your email as soon as possible.',
    startDate: '',
    endDate: '',
    enabled: true,
  });

  useEffect(() => {
    loadDomains();
  }, []);

  useEffect(() => {
    if (selectedDomainId) loadResponders(selectedDomainId);
  }, [selectedDomainId]);

  const loadDomains = async () => {
    try {
      const data = await mailAPI.listDomains();
      setDomains(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedDomainId) {
        setSelectedDomainId(data[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadResponders = async (domainId: string) => {
    setLoadingResponders(true);
    try {
      const res = await autorespondersApi.list(domainId);
      setResponders(res || []);
    } catch {
      setResponders([]);
    } finally {
      setLoadingResponders(false);
    }
  };

  const selectedDomain = domains.find(d => d.id === selectedDomainId);

  const handleOpenNew = () => {
    setFormData({
      email: selectedDomain?.mailboxes?.[0]?.email || '',
      subject: 'Out of Office Re:',
      body: 'I am currently out of the office and will respond to your email as soon as possible.',
      startDate: '',
      endDate: '',
      enabled: true,
    });
    setOpen(true);
  };

  const handleOpenEdit = (responder: any) => {
    setFormData({
      email: responder.email,
      subject: responder.subject,
      body: responder.body,
      startDate: responder.startDate || '',
      endDate: responder.endDate || '',
      enabled: responder.enabled,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!formData.email) {
      setToast('Please select an email account');
      return;
    }
    setSaving(true);
    try {
      await autorespondersApi.save(selectedDomainId, formData);
      setToast('Auto-responder saved successfully');
      setOpen(false);
      loadResponders(selectedDomainId);
    } catch (e: any) {
      setToast(e.message || 'Failed to save auto-responder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Are you sure you want to delete the auto-responder for ${email}?`)) return;
    try {
      await autorespondersApi.remove(selectedDomainId, email);
      setToast('Auto-responder deleted');
      loadResponders(selectedDomainId);
    } catch (e: any) {
      setToast(e.message || 'Failed to delete');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Auto-Responders
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Set up vacation messages and out-of-office replies for your email accounts.
            </Typography>
          </Box>
          <Button
            variant="contained"
            disabled={!selectedDomainId || !selectedDomain?.mailboxes?.length}
            startIcon={<AddIcon />}
            onClick={handleOpenNew}
          >
            New Auto-Responder
          </Button>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Domain</InputLabel>
              <Select
                value={selectedDomainId}
                label="Select Domain"
                onChange={(e) => setSelectedDomainId(e.target.value)}
              >
                {domains.length === 0 ? (
                  <MenuItem disabled value="">No mail domains found</MenuItem>
                ) : (
                  domains.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.domain}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {selectedDomainId ? (
          loadingResponders ? (
            <CircularProgress />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead sx={{ bgcolor: 'background.default' }}>
                  <TableRow>
                    <TableCell>Email Account</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Active Period</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {responders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No auto-responders configured for this domain
                      </TableCell>
                    </TableRow>
                  ) : (
                    responders.map((r) => (
                      <TableRow key={r.email}>
                        <TableCell sx={{ fontWeight: 500 }}>{r.email}</TableCell>
                        <TableCell>{r.subject.length > 30 ? r.subject.substring(0, 30) + '...' : r.subject}</TableCell>
                        <TableCell>
                          {r.startDate || r.endDate ? `${r.startDate || 'Always'} - ${r.endDate || 'Forever'}` : 'Always'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            size="small"
                            checked={r.enabled}
                            onChange={async (e) => {
                              try {
                                await autorespondersApi.save(selectedDomainId, { ...r, enabled: e.target.checked });
                                loadResponders(selectedDomainId);
                              } catch (err: any) {
                                setToast('Failed to toggle status: ' + err.message);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleOpenEdit(r)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(r.email)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )
        ) : (
          <Alert severity="info">Please select a domain to manage auto-responders.</Alert>
        )}
      </Box>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{responders.some(r => r.email === formData.email) ? 'Edit Auto-Responder' : 'New Auto-Responder'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Email Account</InputLabel>
              <Select
                value={formData.email}
                label="Email Account"
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={responders.some(r => r.email === formData.email) && formData.email !== ''}
              >
                {selectedDomain?.mailboxes?.map((m: any) => (
                  <MenuItem key={m.email} value={m.email}>{m.email}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Subject"
              fullWidth
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            />

            <TextField
              label="Message Body"
              fullWidth
              multiline
              rows={6}
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Date (Optional)"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
              <TextField
                label="End Date (Optional)"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <Typography variant="body2">Enable auto-responder immediately</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !formData.email}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
      />
    </DashboardLayout>
  );
}
