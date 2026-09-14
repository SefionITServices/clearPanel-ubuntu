import React, { useState } from 'react';
import {
  Box,
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
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DnsIcon from '@mui/icons-material/Dns';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

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
            </Tabs>
          </Box>
          <Box sx={{ p: 3 }}>
            {tab === 0 && <MailboxManager domain={domain} onDomainUpdate={onDomainUpdate} onFeedback={onFeedback} />}
            {tab === 1 && <AliasManager domain={domain} onDomainUpdate={onDomainUpdate} onFeedback={onFeedback} />}
            {tab === 2 && <SecuritySettings domain={domain} onDomainUpdate={onDomainUpdate} onFeedback={onFeedback} />}
            {tab === 3 && <MailDnsPanel domainId={domain.id} />}
            {tab === 4 && <DomainLogs domainId={domain.id} />}
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
}
