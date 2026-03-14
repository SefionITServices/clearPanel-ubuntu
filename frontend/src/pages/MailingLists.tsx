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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { domainsApi } from '../api/domains';
import { mailingListsApi } from '../api/mailing-lists';

export default function MailingLists() {
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingLists, setLoadingLists] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [toast, setToast] = useState('');

  // Dialog state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', subscribers: '' });

  // Add Subscriber
  const [subEmail, setSubEmail] = useState('');
  const [addingSubToList, setAddingSubToList] = useState<string | null>(null);

  useEffect(() => {
    loadDomains();
  }, []);

  useEffect(() => {
    if (selectedDomain) loadLists(selectedDomain);
  }, [selectedDomain]);

  const loadDomains = async () => {
    try {
      const data = await domainsApi.list();
      setDomains(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedDomain) {
        setSelectedDomain(data[0].name);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadLists = async (domain: string) => {
    setLoadingLists(true);
    try {
      const data = await mailingListsApi.list(domain);
      setLists(Array.isArray(data) ? data : []);
    } catch {
      setLists([]);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleOpenNew = () => {
    setFormData({ name: '', subscribers: '' });
    setOpen(true);
  };

  const handleCreateList = async () => {
    if (!formData.name) {
      setToast('List name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        domain: selectedDomain,
        name: formData.name,
        subscribers: formData.subscribers.split(/[,\n]/).map(s => s.trim()).filter(Boolean),
      };
      await mailingListsApi.create(payload);
      setToast('Mailing list created');
      setOpen(false);
      loadLists(selectedDomain);
    } catch (e: any) {
      setToast(e.message || 'Failed to create lists');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async (listId: string, address: string) => {
    if (!confirm(`Are you sure you want to delete mailing list ${address}?`)) return;
    try {
      await mailingListsApi.remove(listId);
      setToast('Mailing list deleted');
      loadLists(selectedDomain);
    } catch (e: any) {
      setToast(e.message || 'Failed to delete');
    }
  };

  const handleAddSubscriber = async (listId: string) => {
    if (!subEmail.trim()) return;
    setAddingSubToList(listId);
    try {
      await mailingListsApi.addSubscriber(listId, subEmail.trim());
      setSubEmail('');
      loadLists(selectedDomain);
    } catch (e: any) {
      setToast(e.message || 'Failed to add subscriber');
    } finally {
      setAddingSubToList(null);
    }
  };

  const handleRemoveSubscriber = async (listId: string, email: string) => {
    if (!confirm(`Remove ${email} from this list?`)) return;
    try {
      await mailingListsApi.removeSubscriber(listId, email);
      loadLists(selectedDomain);
    } catch (e: any) {
      setToast(e.message || 'Failed to remove subscriber');
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
              Mailing Lists
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Create simple virtual aliases to forward emails to multiple subscribers.
            </Typography>
          </Box>
          <Button
            variant="contained"
            disabled={!selectedDomain}
            startIcon={<AddIcon />}
            onClick={handleOpenNew}
          >
            Create Mailing List
          </Button>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Domain</InputLabel>
              <Select
                value={selectedDomain}
                label="Select Domain"
                onChange={(e) => setSelectedDomain(e.target.value)}
              >
                {domains.length === 0 ? (
                  <MenuItem disabled value="">No domains found</MenuItem>
                ) : (
                  domains.map((d) => (
                    <MenuItem key={d.name} value={d.name}>
                      {d.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {selectedDomain ? (
          loadingLists ? (
            <CircularProgress />
          ) : lists.length === 0 ? (
            <Alert severity="info">No mailing lists configured for {selectedDomain}.</Alert>
          ) : (
            <Stack spacing={2}>
              {lists.map((list) => (
                <Accordion key={list.id} variant="outlined" defaultExpanded={false}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
                      <Box>
                        <Typography variant="h6">{list.name}@{list.domain}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {list.subscribers.length} subscribers
                        </Typography>
                      </Box>
                      <Tooltip title="Delete List">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id, `${list.name}@${list.domain}`);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                      <TextField
                        size="small"
                        label="New Subscriber Email"
                        value={subEmail}
                        onChange={(e) => setSubEmail(e.target.value)}
                        sx={{ maxWidth: 350, flexGrow: 1 }}
                      />
                      <Button
                        variant="outlined"
                        onClick={() => handleAddSubscriber(list.id)}
                        disabled={addingSubToList === list.id || !subEmail}
                      >
                        Add
                      </Button>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {list.subscribers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No subscribers yet.
                        </Typography>
                      ) : (
                        list.subscribers.map((sub: string) => (
                          <Chip
                            key={sub}
                            label={sub}
                            onDelete={() => handleRemoveSubscriber(list.id, sub)}
                            variant="outlined"
                          />
                        ))
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )
        ) : (
          <Alert severity="info">Please select a domain to manage mailing lists.</Alert>
        )}
      </Box>

      {/* Create Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Mailing List</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                label="List Name (Address prefix)"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9.\-_]/g, '') })}
                helperText="Use only letters, numbers, dots, and hyphens"
              />
              <Typography variant="h6" color="text.secondary">
                @{selectedDomain}
              </Typography>
            </Box>

            <TextField
              label="Initial Subscribers"
              fullWidth
              multiline
              rows={4}
              value={formData.subscribers}
              onChange={(e) => setFormData({ ...formData, subscribers: e.target.value })}
              helperText="Comma or line separated email addresses"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateList} disabled={saving || !formData.name}>
            {saving ? 'Creating...' : 'Create List'}
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
