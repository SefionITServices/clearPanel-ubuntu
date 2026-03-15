import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LanguageIcon from '@mui/icons-material/Language';

import { DashboardLayout } from '../../layouts/dashboard/layout';
import { SmtpRelayPanel, QuotaWarningPanel } from '../../components/MailGlobalPanels';
import { MailDomainCard } from '../../components/mail/MailDomainCard';
import { mailAPI, MailDomain } from '../../api/mail';

export default function MailDomainsPage() {
  const [domains, setDomains] = useState<MailDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);

  const fetchDomains = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const items = await mailAPI.listDomains();
      setDomains(items);
    } catch (error) {
       setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load mail domains' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDomains();
  }, []);

  const handleFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (type === 'success') {
      setTimeout(() => setFeedback(null), 5000); // Auto-dismiss success
    }
  };

  const handleDomainUpdate = (updatedDomain: MailDomain) => {
    setDomains((prev) => prev.map((d) => d.id === updatedDomain.id ? updatedDomain : d));
  };

  const handleAddDomain = async () => {
    const raw = newDomainName.trim().toLowerCase();
    if (!raw) {
       handleFeedback('error', 'Please enter a domain name');
       return;
    }
    setAddingBusy(true);
    try {
       const result = await mailAPI.createDomain({ domain: raw });
       setDomains((prev) => [...prev, result.domain]);
       handleFeedback('success', `Added mail domain ${raw}`);
       setAddDialogOpen(false);
       setNewDomainName('');
    } catch (error) {
       handleFeedback('error', error instanceof Error ? error.message : 'Failed to add domain');
    } finally {
       setAddingBusy(false);
    }
  };

  const handleRemoveDomain = async (domain: MailDomain) => {
    if (!window.confirm(`WARNING: Deleting ${domain.domain} will permanently remove all mailboxes, aliases, and emails associated with it. This cannot be undone.\n\nType OK to confirm deletion.`)) {
        return;
    }
    setLoading(true); // Treat as a full page loading state for safety during massive deletion
    try {
       await mailAPI.deleteDomain(domain.id);
       setDomains((prev) => prev.filter((d) => d.id !== domain.id));
       handleFeedback('success', `Deleted mail domain ${domain.domain}`);
    } catch (error) {
       handleFeedback('error', error instanceof Error ? error.message : 'Failed to delete domain');
    } finally {
       setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Stack spacing={4}>
         {/* Global Config Panels */}
         <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
            <Box sx={{ flex: 1 }}>
               <SmtpRelayPanel onFeedback={handleFeedback} />
            </Box>
            <Box sx={{ flex: 1 }}>
               <QuotaWarningPanel onFeedback={handleFeedback} />
            </Box>
         </Stack>

         {feedback && (
           <Alert severity={feedback.type} onClose={() => setFeedback(null)} variant="outlined">
             {feedback.message}
           </Alert>
         )}

         {/* Domains Header */}
         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              <LanguageIcon sx={{ mr: 1, color: 'primary.main' }} />
              Active Mail Domains
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialogOpen(true)} sx={{ textTransform: 'none' }}>
              Add Domain
            </Button>
         </Box>

         {loading ? (
             <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
                 <CircularProgress />
             </Box>
         ) : domains.length === 0 ? (
             <Box sx={{ p: 5, textAlign: 'center', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
                 <Typography variant="h6" color="text.secondary">No mail domains configured.</Typography>
                 <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>Add a domain to start accepting emails, creating mailboxes, and managing aliases.</Typography>
                 <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddDialogOpen(true)}>
                    Add Domain
                 </Button>
             </Box>
         ) : (
             <Stack spacing={3}>
                {domains.map((domain) => (
                    <MailDomainCard
                      key={domain.id}
                      domain={domain}
                      onDomainUpdate={handleDomainUpdate}
                      onRemove={handleRemoveDomain}
                      onFeedback={handleFeedback}
                    />
                ))}
             </Stack>
         )}
      </Stack>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
         <DialogTitle>Add Mail Domain</DialogTitle>
         <DialogContent dividers>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the fully qualified domain name (e.g. example.com). This will automatically provision DKIM keys and setup initial routing rules.
            </Typography>
            <TextField
               fullWidth
               autoFocus
               label="Domain Name"
               value={newDomainName}
               onChange={(e) => setNewDomainName(e.target.value)}
               placeholder="example.com"
               disabled={addingBusy}
            />
         </DialogContent>
         <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setAddDialogOpen(false)} disabled={addingBusy} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={handleAddDomain} disabled={addingBusy || !newDomainName.trim()} startIcon={addingBusy ? <CircularProgress size={16} color="inherit" /> : null} sx={{ textTransform: 'none' }}>
               {addingBusy ? 'Provisioning...' : 'Add Domain'}
            </Button>
         </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
