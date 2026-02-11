import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Computer as ComputerIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';

interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

export default function SettingsPage() {
  const [currentHostname, setCurrentHostname] = useState('');
  const [systemHostname, setSystemHostname] = useState('');
  const [newHostname, setNewHostname] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Load current hostname ──
  useEffect(() => {
    fetch('/api/server/hostname', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setCurrentHostname(data.hostname || '');
        setSystemHostname(data.systemHostname || '');
        setNewHostname(data.hostname || data.systemHostname || '');
      })
      .catch(() => setError('Failed to load hostname'))
      .finally(() => setLoading(false));
  }, []);

  // ── Save hostname ──
  const handleSave = async () => {
    const trimmed = newHostname.trim().toLowerCase();
    if (!trimmed) {
      setError('Hostname cannot be empty');
      return;
    }
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(trimmed)) {
      setError('Invalid hostname format. Use lowercase letters, numbers, dots, and hyphens.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    setLogs([]);

    try {
      const resp = await fetch('/api/server/hostname', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: trimmed }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to update hostname');

      setCurrentHostname(data.hostname);
      setSystemHostname(data.hostname);
      setLogs(data.automationLogs || []);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update hostname');
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = newHostname.trim().toLowerCase() !== currentHostname;

  return (
    <DashboardLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Manage your server configuration.
        </Typography>

        {/* Hostname Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
              <ComputerIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Server Hostname
              </Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              The server hostname is used by Postfix for mail delivery, SSL certificates, and system
              identification. Changing it will update the system hostname, <code>/etc/hosts</code>,
              and Postfix configuration.
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Current hostname display */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current:
                  </Typography>
                  <Chip
                    label={systemHostname || 'unknown'}
                    size="small"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />
                </Stack>

                {/* Edit field */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
                  <TextField
                    label="Hostname"
                    value={newHostname}
                    onChange={(e) => {
                      setNewHostname(e.target.value);
                      setError(null);
                      setSuccess(false);
                    }}
                    placeholder="mail.example.com"
                    size="small"
                    fullWidth
                    sx={{
                      maxWidth: 400,
                      '& input': { fontFamily: 'monospace' },
                    }}
                    helperText="FQDN recommended, e.g. mail.yourdomain.com"
                  />
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    onClick={handleSave}
                    disabled={saving || !hasChanged}
                    sx={{ minWidth: 120, height: 40 }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </Stack>
              </>
            )}

            {/* Success */}
            {success && (
              <Alert severity="success" sx={{ mt: 2.5 }}>
                Hostname updated successfully!
              </Alert>
            )}

            {/* Error */}
            {error && (
              <Alert severity="error" sx={{ mt: 2.5 }}>
                {error}
              </Alert>
            )}

            {/* Automation logs */}
            {logs.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 2.5, p: 0 }}>
                <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                  Automation Log
                </Typography>
                <Divider />
                <List dense disablePadding>
                  {logs.map((log, i) => (
                    <ListItem key={i} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {log.success ? (
                          <CheckIcon fontSize="small" color="success" />
                        ) : (
                          <ErrorIcon fontSize="small" color="error" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={log.task}
                        secondary={log.detail || log.message}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  );
}
