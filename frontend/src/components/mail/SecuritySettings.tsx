import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocalPoliceIcon from '@mui/icons-material/LocalPolice';

import { mailAPI, MailDomain, DomainSettingsUpdate } from '../../api/mail';
import { CatchAllPanel, DmarcReportsPanel } from '../MailDomainPanels'; // Keep these nested if they still exist

interface SecuritySettingsProps {
  domain: MailDomain;
  onDomainUpdate: (domain: MailDomain) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

const SPAM_THRESHOLD_MIN = 0;
const SPAM_THRESHOLD_MAX = 20;

export function SecuritySettings({ domain, onDomainUpdate, onFeedback }: SecuritySettingsProps) {
  const [draft, setDraft] = useState<DomainSettingsUpdate>({});
  const [busy, setBusy] = useState(false);
  const [dkimBusy, setDkimBusy] = useState(false);

  const getNumericVal = (field: 'spamThreshold' | 'greylistingDelaySeconds'): string | number => {
    if (draft[field] !== undefined && draft[field] !== null) {
      return draft[field] as number;
    }
    return domain[field] ?? '';
  };

  const getBooleanVal = (field: 'greylistingEnabled' | 'virusScanEnabled'): boolean => {
    if (draft[field] !== undefined && draft[field] !== null) {
      return draft[field] as boolean;
    }
    return domain[field] ?? true;
  };

  const isDirty = Object.keys(draft).length > 0;

  const handleNumericChange = (field: 'spamThreshold' | 'greylistingDelaySeconds', valStr: string) => {
    if (valStr === '') {
      setDraft((p) => ({ ...p, [field]: null }));
      return;
    }
    const num = Number(valStr);
    if (isNaN(num)) return;
    setDraft((p) => ({ ...p, [field]: num }));
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const result = await mailAPI.updateDomainSettings(domain.id, draft);
      onDomainUpdate(result.domain);
      setDraft({});
      onFeedback('success', `Security settings updated for ${domain.domain}`);
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Settings update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRotateDkim = async () => {
    if (!window.confirm(`Rotate DKIM keys for ${domain.domain}? This may temporary disrupt validation until DNS propagates.`)) {
      return;
    }
    setDkimBusy(true);
    try {
      const result = await mailAPI.rotateDkim(domain.id);
      onDomainUpdate(result.domain);
      onFeedback('success', `Rotated DKIM keys. New selector: ${result.domain.dkimSelector}`);
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'DKIM rotation failed');
    } finally {
      setDkimBusy(false);
    }
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2, display: 'flex', alignItems: 'center' }}>
          <ShieldIcon sx={{ mr: 1, color: 'text.secondary' }} />
          Anti-Spam & Routing Policies
        </Typography>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">Spam Threshold Score</Typography>
                <Typography variant="body2" color="text.secondary">
                  Reject messages scoring above this value (Rspamd). Lower is stricter. 0-20.
                </Typography>
              </Box>
              <TextField
                size="small"
                type="number"
                inputProps={{ min: SPAM_THRESHOLD_MIN, max: SPAM_THRESHOLD_MAX, step: 0.1 }}
                value={getNumericVal('spamThreshold')}
                onChange={(e) => handleNumericChange('spamThreshold', e.target.value)}
                sx={{ width: 100 }}
              />
            </Stack>
            <Divider />
            
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">Greylisting</Typography>
                <Typography variant="body2" color="text.secondary">
                  Temporarily reject unknown senders to thwart spam bots.
                </Typography>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                 <TextField
                  size="small"
                  label="Delay (s)"
                  type="number"
                  value={getNumericVal('greylistingDelaySeconds')}
                  onChange={(e) => handleNumericChange('greylistingDelaySeconds', e.target.value)}
                  disabled={!getBooleanVal('greylistingEnabled')}
                  sx={{ width: 100 }}
                 />
                 <Switch
                  checked={getBooleanVal('greylistingEnabled')}
                  onChange={(e) => setDraft((p) => ({ ...p, greylistingEnabled: e.target.checked }))}
                />
              </Stack>
            </Stack>
            <Divider />

            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">Virus Scanning</Typography>
                <Typography variant="body2" color="text.secondary">
                  Scan attachments with ClamAV. May impact performance slightly.
                </Typography>
              </Box>
              <Switch
                checked={getBooleanVal('virusScanEnabled')}
                onChange={(e) => setDraft((p) => ({ ...p, virusScanEnabled: e.target.checked }))}
              />
            </Stack>
            <Divider />

            <CatchAllPanel domain={domain} onDomainUpdate={onDomainUpdate} onFeedback={onFeedback} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button size="small" onClick={() => setDraft({})} disabled={!isDirty || busy} sx={{ mr: 1, textTransform: 'none' }}>Discard Changes</Button>
              <Button size="small" variant="contained" onClick={handleSave} disabled={!isDirty || busy} sx={{ textTransform: 'none' }}>
                {busy ? 'Saving...' : 'Apply Security Rules'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2, display: 'flex', alignItems: 'center' }}>
          <LocalPoliceIcon sx={{ mr: 1, color: 'text.secondary' }} />
          DKIM & DMARC Validation
        </Typography>
        <Stack spacing={2}>
           <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
             <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
               <Box>
                 <Typography variant="subtitle2">DKIM Signature</Typography>
                 <Typography variant="body2" color="text.secondary">
                   Selector: <strong>{domain.dkimSelector}</strong> (Last updated: {new Date(domain.dkimUpdatedAt || '').toLocaleDateString()})
                 </Typography>
               </Box>
               <Button
                  size="small"
                  variant="outlined"
                  startIcon={dkimBusy ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                  onClick={handleRotateDkim}
                  disabled={dkimBusy}
                  sx={{ textTransform: 'none' }}
                >
                  Rotate Key
                </Button>
             </Stack>
           </Paper>

           <DmarcReportsPanel domainId={domain.id} domainName={domain.domain} onFeedback={onFeedback} />
        </Stack>
      </Box>

    </Stack>
  );
}
