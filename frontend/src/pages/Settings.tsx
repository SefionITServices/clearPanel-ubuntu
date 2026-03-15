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
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Computer as ComputerIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Save as SaveIcon,
  Security as SecurityIcon,
  Dns as DnsIcon,
  Info as InfoIcon,
  VpnKey as VpnKeyIcon,
  SystemUpdateAlt as UpdateIcon,
  Verified as VerifiedIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { serverApi } from '../api/server';
import { licenseApi } from '../api/license';

interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0);

  // ── Hostname state ──
  const [currentHostname, setCurrentHostname] = useState('');
  const [systemHostname, setSystemHostname] = useState('');
  const [newHostname, setNewHostname] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Nameserver state ──
  const [nsLoading, setNsLoading] = useState(true);
  const [nsSaving, setNsSaving] = useState(false);
  const [nsError, setNsError] = useState<string | null>(null);
  const [nsSuccess, setNsSuccess] = useState(false);
  const [nsLogs, setNsLogs] = useState<AutomationLog[]>([]);
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [ns1, setNs1] = useState('');
  const [ns2, setNs2] = useState('');
  const [nsInfo, setNsInfo] = useState<any>(null);

  // ── Panel info state ──
  const [panelInfo, setPanelInfo] = useState<{
    nodeVersion: string;
    uptime: string;
    platform: string;
    arch: string;
    memTotal: string;
    memFree: string;
  } | null>(null);

  // ── Load current hostname ──
  useEffect(() => {
    serverApi.getHostname()
      .then((data) => {
        setCurrentHostname(data.hostname || '');
        setSystemHostname(data.systemHostname || '');
        setNewHostname(data.hostname || data.systemHostname || '');
      })
      .catch(() => setError('Failed to load hostname'))
      .finally(() => setLoading(false));
  }, []);

  // ── Load nameservers ──
  useEffect(() => {
    serverApi.getNameservers()
      .then((data: any) => {
        const s = data.settings || {};
        setPrimaryDomain(s.primaryDomain || '');
        setServerIp(s.serverIp || '');
        setNs1(s.nameservers?.[0] || '');
        setNs2(s.nameservers?.[1] || '');
        setNsInfo(data.nameserverInfo || null);
      })
      .catch(() => setNsError('Failed to load nameserver settings'))
      .finally(() => setNsLoading(false));
  }, []);

  // ── Panel info (client-side) ──
  useEffect(() => {
    // We can get basic info from the browser; for real server info we'd need a backend endpoint
    setPanelInfo({
      nodeVersion: '-',
      uptime: '-',
      platform: navigator.platform || '-',
      arch: '-',
      memTotal: '-',
      memFree: '-',
    });
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
      const data = await serverApi.setHostname(trimmed);

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

  // ── Save nameservers ──
  const handleSaveNameservers = async () => {
    const domain = primaryDomain.trim().toLowerCase();
    if (!domain) {
      setNsError('Primary domain is required');
      return;
    }

    setNsSaving(true);
    setNsError(null);
    setNsSuccess(false);
    setNsLogs([]);

    try {
      const nameservers = [ns1, ns2].map(s => s.trim().toLowerCase()).filter(Boolean);
      const data = await serverApi.configureNameservers({
        primaryDomain: domain,
        serverIp: serverIp.trim() || undefined,
        nameservers: nameservers.length > 0 ? nameservers : undefined,
      });
      setNsLogs(data.automationLogs || []);
      setNsInfo(data.nameserverInfo || null);
      setNsSuccess(true);
    } catch (err: any) {
      setNsError(err.message || 'Failed to configure nameservers');
    } finally {
      setNsSaving(false);
    }
  };

  const hasChanged = newHostname.trim().toLowerCase() !== currentHostname;

  return (
    <DashboardLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage your server configuration.
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 0, borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<ComputerIcon />} iconPosition="start" label="General" />
          <Tab icon={<DnsIcon />} iconPosition="start" label="Nameservers" />
          <Tab icon={<VpnKeyIcon />} iconPosition="start" label="License & Updates" />
          <Tab icon={<InfoIcon />} iconPosition="start" label="Panel Info" />
        </Tabs>

        {/* ═══════════ TAB 0: General ═══════════ */}
        <TabPanel value={tab} index={0}>
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
                <AutomationLogList logs={logs} />
              )}
            </CardContent>
          </Card>

          {/* Security Reminder */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <SecurityIcon color="warning" />
                <Typography variant="h6" fontWeight={600}>
                  Security Checklist
                </Typography>
              </Stack>
              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Authentication"
                    secondary="All API endpoints require login (AuthGuard)"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Password Hashing"
                    secondary="Passwords are hashed with bcrypt before storage"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Terminal Filtering"
                    secondary="Dangerous commands are blocked by the terminal sandbox"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Input Validation"
                    secondary="DTOs with class-validator protect all endpoints"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              </List>
              <Alert severity="info" sx={{ mt: 1, fontSize: 12 }}>
                Set <code>SESSION_SECRET</code> and <code>SSO_SECRET</code> environment variables in production
                to avoid ephemeral session keys.
              </Alert>
            </CardContent>
          </Card>
        </TabPanel>

        {/* ═══════════ TAB 1: Nameservers ═══════════ */}
        <TabPanel value={tab} index={1}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                <DnsIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Nameserver Configuration
                </Typography>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Configure your primary domain and nameservers. This will create DNS zone records
                and set up BIND9 zones for your domain.
              </Typography>

              {nsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  <TextField
                    label="Primary Domain"
                    value={primaryDomain}
                    onChange={(e) => { setPrimaryDomain(e.target.value); setNsError(null); setNsSuccess(false); }}
                    placeholder="example.com"
                    size="small"
                    fullWidth
                    sx={{ maxWidth: 400, '& input': { fontFamily: 'monospace' } }}
                    helperText="The main domain for this server"
                  />
                  <TextField
                    label="Server IP"
                    value={serverIp}
                    onChange={(e) => { setServerIp(e.target.value); setNsError(null); }}
                    placeholder="203.0.113.10"
                    size="small"
                    fullWidth
                    sx={{ maxWidth: 400, '& input': { fontFamily: 'monospace' } }}
                    helperText="Public IPv4 address of this server (auto-detected if empty)"
                  />

                  <Divider />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="NS1"
                      value={ns1}
                      onChange={(e) => { setNs1(e.target.value); setNsError(null); }}
                      placeholder="ns1.example.com"
                      size="small"
                      fullWidth
                      sx={{ '& input': { fontFamily: 'monospace' } }}
                    />
                    <TextField
                      label="NS2"
                      value={ns2}
                      onChange={(e) => { setNs2(e.target.value); setNsError(null); }}
                      placeholder="ns2.example.com"
                      size="small"
                      fullWidth
                      sx={{ '& input': { fontFamily: 'monospace' } }}
                    />
                  </Stack>

                  <Button
                    variant="contained"
                    startIcon={nsSaving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveNameservers}
                    disabled={nsSaving || !primaryDomain.trim()}
                    sx={{ alignSelf: 'flex-start', minWidth: 180 }}
                  >
                    {nsSaving ? 'Configuring...' : 'Save Nameservers'}
                  </Button>
                </Stack>
              )}

              {nsSuccess && (
                <Alert severity="success" sx={{ mt: 2.5 }}>
                  Nameserver configuration saved and DNS zones updated!
                </Alert>
              )}
              {nsError && (
                <Alert severity="error" sx={{ mt: 2.5 }}>
                  {nsError}
                </Alert>
              )}

              {nsLogs.length > 0 && (
                <AutomationLogList logs={nsLogs} />
              )}

              {/* Nameserver instructions */}
              {nsInfo && (
                <Paper variant="outlined" sx={{ mt: 3, p: 2.5 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Registrar Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    At your domain registrar, set the following nameservers and glue records:
                  </Typography>
                  {nsInfo.nameservers?.map((ns: string, i: number) => (
                    <Chip key={i} label={ns} size="small" variant="outlined" sx={{ mr: 1, mb: 1, fontFamily: 'monospace' }} />
                  ))}
                  {nsInfo.glueRecords?.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Glue records (point each NS to your server IP):
                      </Typography>
                      {nsInfo.glueRecords.map((g: any, i: number) => (
                        <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', ml: 1 }}>
                          {g.hostname} → {g.ip}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Paper>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        {/* ═══════════ TAB 2: License & Updates ═══════════ */}
        <TabPanel value={tab} index={2}>
          <LicenseAndUpdatesTab />
        </TabPanel>

        {/* ═══════════ TAB 3: Panel Info ═══════════ */}
        <TabPanel value={tab} index={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                <InfoIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Panel Information
                </Typography>
              </Stack>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Panel"
                    secondary="ClearPanel"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
                  />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText
                    primary="DNS Server"
                    secondary="BIND9 (managed)"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
                  />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText
                    primary="Web Server"
                    secondary="Nginx"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
                  />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText
                    primary="Mail Stack"
                    secondary="Postfix + Dovecot + OpenDKIM"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
                  />
                </ListItem>
              </List>

              <Alert severity="info" sx={{ mt: 2 }}>
                Visit the <strong>Dashboard</strong> for live server status, domain counts, and SSL certificate overview.
              </Alert>
            </CardContent>
          </Card>
        </TabPanel>
      </Box>
    </DashboardLayout>
  );
}

/* ── License & Updates Tab ── */
function LicenseAndUpdatesTab() {
  const [license, setLicense] = useState<any>(null);
  const [update, setUpdate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activateKey, setActivateKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    licenseApi.getStatus()
      .then(setLicense)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleActivate = async () => {
    if (!activateKey.trim()) return;
    setActivating(true);
    setMsg(null);
    try {
      const res = await licenseApi.activate(activateKey.trim());
      setMsg({ text: res.message, severity: res.success ? 'success' : 'error' });
      if (res.success) {
        setActivateKey('');
        const fresh = await licenseApi.getStatus();
        setLicense(fresh);
      }
    } catch (e: any) {
      setMsg({ text: e.message, severity: 'error' });
    }
    setActivating(false);
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate your license? You can re-activate later.')) return;
    try {
      const res = await licenseApi.deactivate();
      setMsg({ text: res.message, severity: res.success ? 'success' : 'error' });
      const fresh = await licenseApi.getStatus();
      setLicense(fresh);
    } catch (e: any) {
      setMsg({ text: e.message, severity: 'error' });
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await licenseApi.checkUpdate();
      setUpdate(res);
    } catch {
      setMsg({ text: 'Could not check for updates', severity: 'error' });
    }
    setCheckingUpdate(false);
  };

  const copyFingerprint = async () => {
    if (license?.fingerprint) {
      try {
        await navigator.clipboard.writeText(license.fingerprint);
        setMsg({ text: 'Fingerprint copied', severity: 'info' });
      } catch {}
    }
  };

  const statusColor: Record<string, string> = {
    active: '#34A853', expired: '#EA4335', invalid: '#EA4335',
    grace: '#F9AB00', unactivated: '#9E9E9E',
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={3}>
      {/* License Status Card */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
            <VpnKeyIcon sx={{ color: statusColor[license?.status] || '#9E9E9E' }} />
            <Typography variant="h6" fontWeight={600}>License</Typography>
            {license?.status && (
              <Chip
                size="small"
                label={license.status.toUpperCase()}
                sx={{
                  fontWeight: 700,
                  bgcolor: `${statusColor[license.status] || '#9E9E9E'}18`,
                  color: statusColor[license.status] || '#9E9E9E',
                }}
              />
            )}
            {license?.plan && license.plan !== 'unknown' && (
              <Chip size="small" label={license.plan.toUpperCase()} variant="outlined" sx={{ fontWeight: 600 }} />
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {license?.message || 'License information unavailable'}
          </Typography>

          {/* Details */}
          <List dense sx={{ mb: 2 }}>
            <ListItem disableGutters>
              <ListItemText
                primary="Panel Version"
                secondary={license?.panelVersion || '-'}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
              />
            </ListItem>
            <Divider component="li" />
            {license?.key && (
              <>
                <ListItem disableGutters>
                  <ListItemText
                    primary="License Key"
                    secondary={license.key}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
                  />
                </ListItem>
                <Divider component="li" />
              </>
            )}
            {license?.expiresAt && (
              <>
                <ListItem disableGutters>
                  <ListItemText
                    primary="Expires"
                    secondary={new Date(license.expiresAt).toLocaleDateString()}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
                  />
                </ListItem>
                <Divider component="li" />
              </>
            )}
            <ListItem disableGutters>
              <ListItemText
                primary="Server Fingerprint"
                secondary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {license?.fingerprint || '-'}
                    </Typography>
                    <Button size="small" onClick={copyFingerprint} startIcon={<ContentCopyIcon />}
                      sx={{ textTransform: 'none', fontSize: '0.7rem', minWidth: 'auto' }}>
                      Copy
                    </Button>
                  </Stack>
                }
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
              />
            </ListItem>
            {license?.lastChecked && (
              <>
                <Divider component="li" />
                <ListItem disableGutters>
                  <ListItemText
                    primary="Last Verified"
                    secondary={new Date(license.lastChecked).toLocaleString()}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1', fontFamily: 'monospace' }}
                  />
                </ListItem>
              </>
            )}
          </List>

          {/* Activate form */}
          {(!license?.key || license?.status === 'unactivated' || license?.status === 'invalid') && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <TextField
                size="small"
                label="License Key"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={activateKey}
                onChange={e => setActivateKey(e.target.value)}
                sx={{ flex: 1, maxWidth: 360, '& input': { fontFamily: 'monospace' } }}
              />
              <Button
                variant="contained"
                onClick={handleActivate}
                disabled={activating || !activateKey.trim()}
                startIcon={activating ? <CircularProgress size={16} color="inherit" /> : <VerifiedIcon />}
                sx={{ minWidth: 120, height: 40, textTransform: 'none' }}
              >
                {activating ? 'Activating...' : 'Activate'}
              </Button>
            </Stack>
          )}

          {/* Deactivate button (for active licenses) */}
          {license?.status === 'active' && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleDeactivate}
              sx={{ mt: 2, textTransform: 'none' }}
            >
              Deactivate License
            </Button>
          )}

          {msg && (
            <Alert severity={msg.severity} sx={{ mt: 2 }} onClose={() => setMsg(null)}>
              {msg.text}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Updates Card */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <UpdateIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>Updates</Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Check for new ClearPanel releases. Updates preserve all your data, domains, email, and SSL certificates.
          </Typography>

          <Button
            variant="outlined"
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            startIcon={checkingUpdate ? <CircularProgress size={16} /> : <UpdateIcon />}
            sx={{ textTransform: 'none', mb: 2 }}
          >
            {checkingUpdate ? 'Checking...' : 'Check for Updates'}
          </Button>

          {update && (
            <Paper variant="outlined" sx={{ p: 2.5, mt: 1 }}>
              {update.available ? (
                <>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Chip label="Update Available" size="small" color="primary" sx={{ fontWeight: 700 }} />
                    <Typography variant="subtitle2">v{update.latestVersion}</Typography>
                  </Stack>
                  {update.releaseDate && (
                    <Typography variant="caption" color="text.secondary">
                      Released: {new Date(update.releaseDate).toLocaleDateString()}
                    </Typography>
                  )}
                  {update.changelog && (
                    <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>
                      {update.changelog}
                    </Typography>
                  )}
                  <Alert severity="info" sx={{ mt: 2, fontSize: 12 }}>
                    Run <code>sudo clearpanel update</code> on your server to apply the update.
                  </Alert>
                </>
              ) : (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckIcon color="success" fontSize="small" />
                  <Typography variant="body2">
                    You're running the latest version (v{update.currentVersion})
                  </Typography>
                </Stack>
              )}
            </Paper>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

/* ── Shared component: Automation log list ── */
function AutomationLogList({ logs }: { logs: AutomationLog[] }) {
  return (
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
  );
}
