import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SendIcon from '@mui/icons-material/Send';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  mailAPI,
  SmtpRelayConfig,
  QuotaWarningConfig,
} from '../api/mail';

// ─── SMTP Relay Panel ──────────────────────────────────────────────────────

interface SmtpRelayPanelProps {
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function SmtpRelayPanel({ onFeedback }: SmtpRelayPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<SmtpRelayConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ host: '', port: '587', username: '', password: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await mailAPI.getSmtpRelay();
      setConfig(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSetup = async () => {
    if (!form.host || !form.port) return;
    setBusy(true);
    try {
      const result = await mailAPI.setupSmtpRelay(
        form.host,
        parseInt(form.port, 10),
        form.username || undefined,
        form.password || undefined,
      );
      const ok = result.automationLogs.every((l) => l.success);
      onFeedback(ok ? 'success' : 'error', ok ? `SMTP relay configured: [${form.host}]:${form.port}` : 'SMTP relay setup failed');
      await load();
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to setup SMTP relay');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await mailAPI.removeSmtpRelay();
      onFeedback('success', 'SMTP relay removed');
      setConfig({ configured: false });
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to remove SMTP relay');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}>
      <Stack spacing={2}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <SendIcon color="action" />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>SMTP Relay</Typography>
            {config?.configured && (
              <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`${config.host}:${config.port}`} />
            )}
          </Stack>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Route outbound mail through an external SMTP relay (e.g. SendGrid, Mailgun, Amazon SES).
            </Typography>

            {config?.configured ? (
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Relay Host:</strong> {config.host}:{config.port}
                  {config.authenticated && ' (authenticated)'}
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  disabled={busy}
                  onClick={() => void handleRemove()}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {busy ? 'Removing…' : 'Remove relay'}
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="flex-end">
                  <TextField label="Relay host" size="small" value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} placeholder="smtp.sendgrid.net" sx={{ minWidth: 220 }} />
                  <TextField label="Port" size="small" type="number" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))} sx={{ width: 90 }} />
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="flex-end">
                  <TextField label="Username (optional)" size="small" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} sx={{ minWidth: 200 }} />
                  <TextField label="Password (optional)" size="small" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} sx={{ minWidth: 200 }} />
                </Stack>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon />}
                  disabled={busy || !form.host || !form.port}
                  onClick={() => void handleSetup()}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {busy ? 'Configuring…' : 'Configure relay'}
                </Button>
              </Stack>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}

// ─── Quota Warning Panel ────────────────────────────────────────────────────

interface QuotaWarningPanelProps {
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

export function QuotaWarningPanel({ onFeedback }: QuotaWarningPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<QuotaWarningConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ threshold: '80', adminEmail: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await mailAPI.getQuotaWarningConfig();
      if (data) {
        setConfig(data);
        setForm({ threshold: String(data.threshold), adminEmail: data.adminEmail || '' });
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSetup = async () => {
    const threshold = parseInt(form.threshold, 10);
    if (!threshold || threshold < 1 || threshold > 100) return;
    setBusy(true);
    try {
      const result = await mailAPI.setupQuotaWarning(threshold, form.adminEmail || undefined);
      const ok = result.automationLogs.every((l) => l.success);
      onFeedback(ok ? 'success' : 'error', ok ? `Quota warning set at ${threshold}%` : 'Quota warning setup failed');
      await load();
    } catch (e) {
      onFeedback('error', e instanceof Error ? e.message : 'Failed to setup quota warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}>
      <Stack spacing={2}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <WarningAmberIcon color="action" />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>Quota Warnings</Typography>
            {config && (
              <Chip size="small" color="warning" label={`${config.threshold}% threshold`} />
            )}
          </Stack>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Automatically notify users when their mailbox quota usage exceeds a threshold.
              Warnings are sent at the configured threshold, 95%, and 100%.
            </Typography>

            <Stack direction="row" spacing={1.5} alignItems="flex-end">
              <TextField
                label="Warning threshold (%)"
                size="small"
                type="number"
                value={form.threshold}
                onChange={(e) => setForm((p) => ({ ...p, threshold: e.target.value }))}
                inputProps={{ min: 1, max: 100 }}
                sx={{ width: 160 }}
              />
              <TextField
                label="Admin email (optional)"
                size="small"
                value={form.adminEmail}
                onChange={(e) => setForm((p) => ({ ...p, adminEmail: e.target.value }))}
                placeholder="admin@example.com"
                sx={{ minWidth: 220 }}
              />
              <Button
                variant="contained"
                size="small"
                disabled={busy || !form.threshold}
                onClick={() => void handleSetup()}
              >
                {busy ? 'Saving…' : config ? 'Update' : 'Enable'}
              </Button>
            </Stack>
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
