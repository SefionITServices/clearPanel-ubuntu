import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DnsIcon from '@mui/icons-material/Dns';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveIcon from '@mui/icons-material/Save';

import { mailAPI, MailDomain } from '../../api/mail';
import { MailboxManager } from './MailboxManager';
import { AliasManager } from './AliasManager';
import { SecuritySettings } from './SecuritySettings';
import { DomainLogs } from './DomainLogs';
import { MailDnsPanel } from './MailDnsPanel';

interface MailDomainCardProps {
  domain: MailDomain;
  onDomainUpdate: (domain: MailDomain) => void;
  onRemove: (domain: MailDomain) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function MailDomainCard({ domain, onDomainUpdate, onRemove, onFeedback }: MailDomainCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState(0);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [globalWebmailUrl, setGlobalWebmailUrl] = useState<string | null>(null);
  const [webmailInput, setWebmailInput] = useState('');
  const [webmailSaving, setWebmailSaving] = useState(false);
  const [openingMailbox, setOpeningMailbox] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setWebmailInput(domain.webmailUrl || '');
  }, [domain.webmailUrl]);

  useEffect(() => {
    if (!expanded) return;
    mailAPI.getWebmailUrl().then((r) => setGlobalWebmailUrl(r.webmailUrl)).catch(() => setGlobalWebmailUrl(null));
  }, [expanded]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };

  const handleSetupDns = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDnsLoading(true);
    try {
      const result = await mailAPI.publishDns(domain.id);
      const created = result.published.filter((r: any) => r.status === 'created').length;
      const unchanged = result.published.filter((r: any) => r.status === 'exists').length;
      onFeedback('success', `DNS setup: ${created} record(s) created, ${unchanged} unchanged`);
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'DNS setup failed');
    } finally {
      setDnsLoading(false);
    }
  };

  const resolveDomainWebmailUrl = () => {
    if (domain.webmailUrl && domain.webmailUrl.trim()) return domain.webmailUrl.trim();
    if (globalWebmailUrl && globalWebmailUrl.trim()) return globalWebmailUrl.trim();
    return `https://webmail.${domain.domain}`;
  };

  const saveDomainWebmailLink = async () => {
    setWebmailSaving(true);
    try {
      const trimmed = webmailInput.trim();
      if (trimmed && !trimmed.startsWith('/') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        onFeedback('error', 'Use absolute URL (https://...) or path (/roundcube)');
        return;
      }
      const result = await mailAPI.updateDomainSettings(domain.id, { webmailUrl: trimmed || null });
      onDomainUpdate(result.domain);
      onFeedback('success', trimmed ? `Webmail linked for ${domain.domain}` : `Domain webmail link reset for ${domain.domain}`);
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to save webmail link');
    } finally {
      setWebmailSaving(false);
    }
  };

  const openMailboxInWebmail = async (mailboxId: string) => {
    setOpeningMailbox((p) => ({ ...p, [mailboxId]: true }));
    try {
      const { url } = await mailAPI.getSsoUrl(domain.id, mailboxId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to generate SSO URL, opening fallback webmail');
      window.open(resolveDomainWebmailUrl(), '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningMailbox((p) => {
        const next = { ...p };
        delete next[mailboxId];
        return next;
      });
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'visible', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 2 } }}>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          bgcolor: expanded ? (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' : 'transparent',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ p: 1, bgcolor: 'primary.light', borderRadius: 1.5, display: 'flex', color: 'primary.contrastText' }}>
            <MailOutlineIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>{domain.domain}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
               <Chip size="small" label={`${domain.mailboxes.length} Mailboxes`} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
               <Chip size="small" label={`${domain.aliases.length} Forwards`} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Setup all mail DNS records">
            <span>
              <IconButton size="small" color="primary" onClick={handleSetupDns} disabled={dnsLoading}>
                {dnsLoading ? <CircularProgress size={16} /> : <DnsIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onRemove(domain); }}>
            <DeleteIcon />
          </IconButton>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
            <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
              <Tab label="Mailboxes" />
              <Tab label="Forwarders" />
              <Tab label="Security & Limits" />
              <Tab label="DNS" />
              <Tab label="Audit Logs" />
              <Tab label="Webmail Access" />
            </Tabs>
          </Box>
          <Box sx={{ p: 3 }}>
            {tab === 0 && <MailboxManager domain={domain} onDomainUpdate={onDomainUpdate} onFeedback={onFeedback} />}
            {tab === 1 && <AliasManager domain={domain} onDomainUpdate={onDomainUpdate} onFeedback={onFeedback} />}
            {tab === 2 && <SecuritySettings domain={domain} onDomainUpdate={onDomainUpdate} onFeedback={onFeedback} />}
            {tab === 3 && <MailDnsPanel domainId={domain.id} />}
            {tab === 4 && <DomainLogs domainId={domain.id} />}
            {tab === 5 && (
              <Stack spacing={2}>
                <Alert severity="info">
                  Link this domain to Roundcube by setting a domain-specific webmail URL (for example: <strong>https://webmail.{domain.domain}</strong>).
                </Alert>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Domain Webmail URL (optional override)"
                    placeholder={`https://webmail.${domain.domain}`}
                    value={webmailInput}
                    onChange={(e) => setWebmailInput(e.target.value)}
                    helperText="Leave empty to use global webmail URL, then fallback to https://webmail.<domain>."
                  />
                  <Button
                    variant="contained"
                    startIcon={webmailSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    disabled={webmailSaving}
                    onClick={saveDomainWebmailLink}
                    sx={{ textTransform: 'none', minWidth: 140 }}
                  >
                    {webmailSaving ? 'Saving...' : 'Save Link'}
                  </Button>
                </Stack>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                    Effective Webmail URL
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {resolveDomainWebmailUrl()}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => window.open(resolveDomainWebmailUrl(), '_blank', 'noopener,noreferrer')}
                      sx={{ textTransform: 'none' }}
                    >
                      Open Domain Webmail
                    </Button>
                  </Stack>
                </Paper>

                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Mailbox Quick Login (SSO)
                </Typography>
                {domain.mailboxes.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No mailboxes yet for this domain.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {domain.mailboxes.map((m) => (
                      <Paper key={m.id} variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">{m.email}</Typography>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={openingMailbox[m.id] ? <CircularProgress size={14} color="inherit" /> : <OpenInNewIcon />}
                          disabled={!!openingMailbox[m.id]}
                          onClick={() => openMailboxInWebmail(m.id)}
                          sx={{ textTransform: 'none' }}
                        >
                          Open in Webmail
                        </Button>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
}
