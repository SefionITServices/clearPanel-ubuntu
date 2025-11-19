import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { DashboardLayout } from '../layouts/dashboard/layout';

interface ServerSettingsResponse {
  settings: ServerSettings;
  nameserverInfo: NameserverInfo | null;
  zone: unknown;
}

interface ServerSettings {
  primaryDomain?: string;
  serverIp?: string;
  nameservers: string[];
  updatedAt?: string;
}

interface NameserverInfo {
  nameservers: string[];
  ip: string;
  instructions: string;
}

interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

export default function NameserverSetupPage() {
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [nameserversInput, setNameserversInput] = useState('');
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [nameserverInfo, setNameserverInfo] = useState<NameserverInfo | null>(null);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const derivedNameservers = useMemo(() => {
    if (nameserversInput.trim().length > 0) {
      return nameserversInput
        .split(/\r?\n|,/)
        .map((ns) => ns.trim())
        .filter((ns) => ns.length > 0);
    }
    if (primaryDomain) {
      return [`ns1.${primaryDomain}`, `ns2.${primaryDomain}`];
    }
    return [];
  }, [nameserversInput, primaryDomain]);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/server/nameservers');
      if (!response.ok) {
        throw new Error(`Failed to load settings (${response.status})`);
      }
      const data: ServerSettingsResponse = await response.json();
      setSettings(data.settings);
      setNameserverInfo(data.nameserverInfo);
      setAutomationLogs([]);

      setPrimaryDomain(data.settings.primaryDomain ?? '');
      setServerIp(data.settings.serverIp ?? '');
      if (data.settings.nameservers && data.settings.nameservers.length > 0) {
        setNameserversInput(data.settings.nameservers.join('\n'));
      } else if (data.settings.primaryDomain) {
        setNameserversInput(`ns1.${data.settings.primaryDomain}\nns2.${data.settings.primaryDomain}`);
      } else {
        setNameserversInput('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        primaryDomain: primaryDomain.trim(),
        serverIp: serverIp.trim() || undefined,
        nameservers: derivedNameservers,
      };

      const response = await fetch('/api/server/nameservers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to update nameserver settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      setNameserverInfo(data.nameserverInfo);
      setAutomationLogs(data.automationLogs ?? []);
      if (data.settings?.primaryDomain) {
        setPrimaryDomain(data.settings.primaryDomain);
      }
      if (data.settings?.serverIp) {
        setServerIp(data.settings.serverIp);
      }
      if (data.settings?.nameservers) {
        setNameserversInput(data.settings.nameservers.join('\n'));
      }
      setSuccessMessage('Nameserver configuration updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 900, mx: 'auto', mt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          Custom Nameserver Setup
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Define the primary domain and hostnames that clearPanel should use when generating DNS zones and registrar instructions.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        <Card variant="outlined">
          <CardContent>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={3}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Primary Domain
                    </Typography>
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    The base domain that will host your branded nameservers (for example, example.com).
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="example.com"
                    value={primaryDomain}
                    onChange={(event) => setPrimaryDomain(event.target.value.trim().toLowerCase())}
                    disabled={saving}
                  />
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Server IP Address
                    </Typography>
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Public IP of this VPS. Leave empty if clearPanel should reuse the stored value.
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="204.83.99.245"
                    value={serverIp}
                    onChange={(event) => setServerIp(event.target.value.trim())}
                    disabled={saving}
                  />
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Nameserver Hostnames
                    </Typography>
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Enter one hostname per line. If left blank, clearPanel uses ns1/ns2 based on the primary domain.
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={nameserversInput}
                    onChange={(event) => setNameserversInput(event.target.value)}
                    disabled={saving}
                    placeholder={primaryDomain ? `ns1.${primaryDomain}\nns2.${primaryDomain}` : 'ns1.example.com'}
                  />
                </Box>

                <Divider />

                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={saving || !primaryDomain}
                    startIcon={<SaveAltIcon />}
                  >
                    Save Configuration
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={fetchSettings}
                    disabled={saving}
                    startIcon={<RefreshIcon />}
                  >
                    Reload
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>

        {automationLogs.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Automation Summary
            </Typography>
            <Stack spacing={1.5}>
              {automationLogs.map((log, index) => (
                <Alert key={`${log.task}-${index}`} severity={log.success ? 'success' : 'error'}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {log.task}
                  </Typography>
                  <Typography variant="body2">{log.message}</Typography>
                  {log.detail && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      Detail: {log.detail}
                    </Typography>
                  )}
                </Alert>
              ))}
            </Stack>
          </Box>
        )}

        {nameserverInfo && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Registrar Instructions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Provide these hostnames and IP address to your registrar when registering child nameservers.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
              {nameserverInfo.nameservers.map((ns) => (
                <Chip key={ns} label={ns} color="primary" variant="outlined" sx={{ mr: 1, mb: 1 }} />
              ))}
              <Chip label={`IP: ${nameserverInfo.ip}`} variant="outlined" sx={{ mr: 1, mb: 1 }} />
            </Stack>
            <Box
              component="pre"
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: (theme) => theme.palette.grey[900],
                color: (theme) => theme.palette.grey[100],
                whiteSpace: 'pre-wrap',
                fontSize: '0.85rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              {nameserverInfo.instructions}
            </Box>
          </Box>
        )}
      </Box>
    </DashboardLayout>
  );
}
