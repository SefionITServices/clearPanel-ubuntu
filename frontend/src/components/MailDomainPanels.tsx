import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FilterListIcon from '@mui/icons-material/FilterList';
import InboxIcon from '@mui/icons-material/Inbox';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  mailAPI,
  MailDomain,
  MailboxSummary,
  SieveFilterEntry,
  DmarcReport,
  DmarcReportSummary,
} from '../api/mail';

// ─── Sieve Filters Panel ─────────────────────────────────────────────────

interface SieveFiltersPanelProps {
  domainId: string;
  mailbox: MailboxSummary;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function SieveFiltersPanel({ domainId, mailbox, onFeedback }: SieveFiltersPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<SieveFilterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFilterName, setEditFilterName] = useState('');
  const [editScript, setEditScript] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await mailAPI.listSieveFilters(domainId, mailbox.id);
      setFilters(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) void load();
  };

  const openNewFilter = () => {
    setEditFilterName('');
    setEditScript(`require ["fileinto", "reject"];\n\n# Example: file messages from a sender into a folder\nif header :contains "From" "newsletter@example.com" {\n  fileinto "Newsletters";\n  stop;\n}\n`);
    setDialogOpen(true);
  };

  const openEditFilter = async (name: string) => {
    try {
      const detail = await mailAPI.getSieveFilter(domainId, mailbox.id, name);
      setEditFilterName(detail.name);
      setEditScript(detail.script);
      setDialogOpen(true);
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to load filter');
    }
  };

  const handleSave = async () => {
    if (!editFilterName || !editScript) return;
    setBusy(true);
    try {
      const result = await mailAPI.putSieveFilter(domainId, mailbox.id, editFilterName, editScript);
      const ok = result.automationLogs.every((l) => l.success);
      onFeedback(ok ? 'success' : 'error', ok ? `Filter '${editFilterName}' saved` : 'Failed to save filter');
      setDialogOpen(false);
      await load();
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to save filter');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (name: string) => {
    setBusy(true);
    try {
      await mailAPI.deleteSieveFilter(domainId, mailbox.id, name);
      onFeedback('success', `Filter '${name}' deleted`);
      await load();
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to delete filter');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ cursor: 'pointer' }} onClick={handleToggle}>
          <FilterListIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600}>Sieve Filters</Typography>
          {filters.length > 0 && <Chip size="small" label={`${filters.length} filter${filters.length > 1 ? 's' : ''}`} />}
          <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
        </Stack>

        <Collapse in={expanded}>
          <Stack spacing={1} sx={{ pt: 1, pl: 3 }}>
            {loading && <LinearProgress />}
            {!loading && filters.length === 0 && (
              <Typography variant="body2" color="text.secondary">No Sieve filters configured.</Typography>
            )}
            {filters.map((f) => (
              <Stack key={f.name} direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>{f.name}</Typography>
                <Chip size="small" label={f.active ? 'active' : 'inactive'} color={f.active ? 'success' : 'default'} />
                <IconButton size="small" onClick={() => void openEditFilter(f.name)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => void handleDelete(f.name)} disabled={busy}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={openNewFilter} sx={{ alignSelf: 'flex-start' }}>
              New filter
            </Button>
          </Stack>
        </Collapse>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editFilterName ? `Edit Filter: ${editFilterName}` : 'New Sieve Filter'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Filter name"
              size="small"
              value={editFilterName}
              onChange={(e) => setEditFilterName(e.target.value)}
              placeholder="my-filter"
              fullWidth
            />
            <TextField
              label="Sieve script"
              multiline
              minRows={8}
              maxRows={20}
              value={editScript}
              onChange={(e) => setEditScript(e.target.value)}
              fullWidth
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void handleSave()} variant="contained" disabled={busy || !editFilterName || !editScript}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Catch-All Panel ──────────────────────────────────────────────────────

interface CatchAllPanelProps {
  domain: MailDomain;
  onDomainUpdate: (domain: MailDomain) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function CatchAllPanel({ domain, onDomainUpdate, onFeedback }: CatchAllPanelProps) {
  const [busy, setBusy] = useState(false);
  const [targetEmail, setTargetEmail] = useState(domain.catchAllAddress || '');
  const enabled = !!domain.catchAllAddress;

  const handleToggle = async () => {
    setBusy(true);
    try {
      const action = enabled ? 'disable' : 'enable';
      if (action === 'enable' && !targetEmail) {
        onFeedback('error', 'Please enter a target email for catch-all');
        setBusy(false);
        return;
      }
      const result = await mailAPI.setupCatchAll(domain.id, action, action === 'enable' ? targetEmail : undefined);
      const ok = result.automationLogs.every((l) => l.success);
      if (ok) {
        onDomainUpdate(result.domain);
        onFeedback('success', action === 'enable' ? `Catch-all enabled → ${targetEmail}` : 'Catch-all disabled');
      } else {
        onFeedback('error', result.automationLogs.find((l) => !l.success)?.message || 'Catch-all setup failed');
      }
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to toggle catch-all');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <InboxIcon fontSize="small" color="action" />
      <Typography variant="body2" fontWeight={600}>Catch-All:</Typography>
      {!enabled && (
        <TextField
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
          size="small"
          placeholder="admin@..."
          sx={{ width: 200 }}
        />
      )}
      {enabled && (
        <Chip size="small" color="success" label={`→ ${domain.catchAllAddress}`} />
      )}
      <Switch checked={enabled} disabled={busy} onChange={() => void handleToggle()} size="small" />
      <Typography variant="caption" color="text.secondary">
        {enabled ? 'Enabled' : 'Disabled'}
      </Typography>
    </Stack>
  );
}

// ─── DMARC Reports Panel ──────────────────────────────────────────────────

interface DmarcReportsPanelProps {
  domainId: string;
  domainName: string;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function DmarcReportsPanel({ domainId, domainName, onFeedback }: DmarcReportsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<DmarcReportSummary | null>(null);
  const [reports, setReports] = useState<DmarcReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        mailAPI.getDmarcSummary(domainId),
        mailAPI.getDmarcReports(domainId),
      ]);
      setSummary(s);
      setReports(r);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) void load();
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handleToggle}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AssessmentIcon fontSize="small" color="action" />
            <Typography variant="body2" fontWeight={600}>DMARC Reports</Typography>
            {summary && summary.reportCount > 0 && (
              <Chip size="small" label={`${summary.reportCount} reports`} color="info" />
            )}
          </Stack>
          <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
        </Box>

        <Collapse in={expanded}>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            {loading && <LinearProgress />}
            {!loading && summary && (
              <>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip label={`${summary.totalMessages} messages`} size="small" />
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${summary.passCount} passed (${summary.passRate}%)`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    icon={<CancelIcon />}
                    label={`${summary.failCount} failed`}
                    size="small"
                    color={summary.failCount > 0 ? 'error' : 'default'}
                    variant="outlined"
                  />
                </Stack>

                {summary.organizations.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Reporting orgs: {summary.organizations.join(', ')}
                  </Typography>
                )}

                {summary.topSenders.length > 0 && (
                  <Box>
                    <Button size="small" onClick={() => setShowDetails(!showDetails)}>
                      {showDetails ? 'Hide details' : 'Show top senders'}
                    </Button>
                    <Collapse in={showDetails}>
                      <Table size="small" sx={{ mt: 1 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Source IP</TableCell>
                            <TableCell align="right">Messages</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {summary.topSenders.map((s) => (
                            <TableRow key={s.ip}>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.ip}</TableCell>
                              <TableCell align="right">{s.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Collapse>
                  </Box>
                )}
              </>
            )}
            {!loading && (!summary || summary.reportCount === 0) && (
              <Typography variant="body2" color="text.secondary">
                No DMARC reports found for {domainName}. Reports are collected when remote servers send
                aggregate feedback to your DMARC report email address.
              </Typography>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
