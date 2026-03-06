import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Stack,
  alpha,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormHelperText,
  Tooltip,
  IconButton,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import TuneIcon from '@mui/icons-material/Tune';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { useNavigate } from 'react-router-dom';
import { appStoreApi } from '../api/app-store';
import { mailAPI } from '../api/mail';

interface EmailTool {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action: 'navigate' | 'open-webmail';
  path?: string;
}

export default function EmailPage() {
  const navigate = useNavigate();
  const [roundcubeInstalled, setRoundcubeInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webmailUrl, setWebmailUrl] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    Promise.all([
      appStoreApi.listApps().then((data) => {
        if (Array.isArray(data.apps)) {
          const rc = data.apps.find((a: any) => a.id === 'roundcube');
          setRoundcubeInstalled(!!rc?.status?.installed);
        }
      }).catch(() => {}),
      mailAPI.getWebmailUrl().then((res) => {
        setWebmailUrl(res.webmailUrl);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const openConfigDialog = () => {
    setUrlInput(webmailUrl ?? '');
    setUrlError('');
    setConfigOpen(true);
  };

  const saveWebmailUrl = async () => {
    const trimmed = urlInput.trim();
    // Accept empty (reset to default), or a valid URL/path
    if (trimmed && !trimmed.startsWith('/') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlError('Enter a full URL (https://webmail.example.com) or a path (/roundcube)');
      return;
    }
    setUrlSaving(true);
    try {
      const res = await mailAPI.setWebmailUrl(trimmed || null);
      setWebmailUrl(res.webmailUrl);
      setConfigOpen(false);
    } catch {
      setUrlError('Failed to save. Please try again.');
    } finally {
      setUrlSaving(false);
    }
  };

  /** Resolve the effective URL to open Roundcube */
  const resolvedWebmailUrl = webmailUrl || '/roundcube/';

  const managementTools: EmailTool[] = [
    {
      id: 'accounts',
      label: 'Email Accounts',
      description: 'Create, edit and delete email accounts. Manage passwords, quotas and access.',
      icon: <EmailIcon sx={{ fontSize: 32 }} />,
      color: '#4285F4',
      action: 'navigate',
      path: '/email-accounts',
    },
    {
      id: 'domains',
      label: 'Mail Domains',
      description: 'Manage mail domains, DKIM, DNS records, security policies and metrics.',
      icon: <SettingsIcon sx={{ fontSize: 32 }} />,
      color: '#1A73E8',
      action: 'navigate',
      path: '/mail-domains',
    },
    {
      id: 'forwarders',
      label: 'Forwarders',
      description: 'Set up email forwarding rules to redirect messages to other addresses.',
      icon: <ForwardToInboxIcon sx={{ fontSize: 32 }} />,
      color: '#34A853',
      action: 'navigate',
      path: '/forwarders',
    },
    {
      id: 'filters',
      label: 'Email Filters',
      description: 'Create server-side email filtering rules (Sieve) for automatic sorting.',
      icon: <FilterAltIcon sx={{ fontSize: 32 }} />,
      color: '#FF6B35',
      action: 'navigate',
      path: '/email-filters',
    },
  ];

  const webmailClients: {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    installed: boolean;
    url: string;
  }[] = [
    {
      id: 'roundcube',
      label: 'Roundcube',
      description:
        'Modern, full-featured webmail client with rich text editor, address book, and folder management.',
      icon: <MailOutlineIcon sx={{ fontSize: 32 }} />,
      color: '#2196F3',
      installed: roundcubeInstalled,
      url: resolvedWebmailUrl,
    },
  ];

  return (
    <DashboardLayout>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Email
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Manage your email accounts, domains, and access webmail clients.
        </Typography>

        {/* Management Tools */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Management
        </Typography>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {managementTools.map((tool) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={tool.id}>
              <Card
                onClick={() => tool.path && navigate(tool.path)}
                sx={{
                  cursor: 'pointer',
                  height: '100%',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow:
                      '0 4px 12px 0 rgba(60,64,67,0.2), 0 8px 24px 4px rgba(60,64,67,0.1)',
                  },
                }}
              >
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      bgcolor: `${tool.color}12`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: tool.color,
                      mb: 2,
                    }}
                  >
                    {tool.icon}
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {tool.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                    {tool.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Webmail Clients */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Webmail Clients
          </Typography>
          <Tooltip title="Configure webmail URL">
            <IconButton size="small" onClick={openConfigDialog}>
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Grid container spacing={2}>
            {webmailClients.map((client) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={client.id}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'all 0.2s ease-in-out',
                    opacity: client.installed ? 1 : 0.6,
                    '&:hover': client.installed
                      ? {
                          transform: 'translateY(-4px)',
                          boxShadow:
                            '0 4px 12px 0 rgba(60,64,67,0.2), 0 8px 24px 4px rgba(60,64,67,0.1)',
                        }
                      : {},
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 2,
                          bgcolor: `${client.color}12`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: client.color,
                        }}
                      >
                        {client.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {client.label}
                          </Typography>
                          <Chip
                            label={client.installed ? 'Installed' : 'Not Installed'}
                            size="small"
                            color={client.installed ? 'success' : 'default'}
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        </Box>
                      </Box>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2, lineHeight: 1.4 }}
                    >
                      {client.description}
                    </Typography>
                    {client.installed ? (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<OpenInNewIcon />}
                        onClick={() =>
                          window.open(client.url, '_blank', 'noopener,noreferrer')
                        }
                        sx={{ textTransform: 'none' }}
                      >
                        Open {client.label}
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate('/app-store')}
                        sx={{ textTransform: 'none' }}
                      >
                        Install from App Store
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {!loading && !roundcubeInstalled && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No webmail client is installed. Visit the{' '}
            <Box
              component="span"
              sx={{ fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/app-store')}
            >
              App Store
            </Box>{' '}
            to install Roundcube or another email client.
          </Alert>
        )}

        {/* Webmail URL configuration dialog */}
        <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Configure Webmail URL</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose how users access Roundcube:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2, mb: 2 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                <strong>Default (server IP/domain):</strong> leave empty — opens{' '}
                <code>/roundcube/</code> on this server
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                <strong>Custom domain:</strong> e.g.{' '}
                <code>https://mail.example.com</code> or{' '}
                <code>https://webmail.example.com</code>
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Webmail URL"
              placeholder="Leave empty for /roundcube/ (default)"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
              error={!!urlError}
              autoFocus
            />
            {urlError && <FormHelperText error>{urlError}</FormHelperText>}
            {!urlError && (
              <FormHelperText>
                Current:{' '}
                <strong>{webmailUrl || '/roundcube/ (default)'}</strong>
              </FormHelperText>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigOpen(false)} disabled={urlSaving}>Cancel</Button>
            {webmailUrl && (
              <Button color="warning" onClick={() => { setUrlInput(''); }} disabled={urlSaving}>
                Reset to Default
              </Button>
            )}
            <Button variant="contained" onClick={saveWebmailUrl} disabled={urlSaving}>
              {urlSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
