import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import StorageIcon from '@mui/icons-material/Storage';
import EmailIcon from '@mui/icons-material/Email';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import MemoryIcon from '@mui/icons-material/Memory';
import SpeedIcon from '@mui/icons-material/Speed';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import SavingsIcon from '@mui/icons-material/Savings';
import { cloudApi, CloudOverviewStats, S3Bucket, S3AccessKey, SesApiKey, EmailLogEntry, VaultSecret, RedisCacheInfo } from '../api/cloud';
import { baasApi, BaasInstance, BaasSdkSnippet } from '../api/baas';

export default function CloudPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const getInitialTab = (): number => {
    if (location.pathname === '/baas') return 1;
    const tabParam = searchParams.get('tab');
    if (tabParam === 'baas') return 1;
    if (tabParam === 'ses') return 2;
    if (tabParam === 's3') return 3;
    if (tabParam === 'vault') return 4;
    if (tabParam === 'redis') return 5;
    return 0;
  };

  const [currentTab, setCurrentTab] = useState(getInitialTab());

  useEffect(() => {
    setCurrentTab(getInitialTab());
  }, [location.pathname, searchParams]);
  const [loading, setLoading] = useState(true);
  const [opBusy, setOpBusy] = useState(false);
  const [stats, setStats] = useState<CloudOverviewStats | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── BaaS State ─────────────────────────────────────────────────────────────
  const [baasInstances, setBaasInstances] = useState<BaasInstance[]>([]);
  const [createBaasOpen, setCreateBaasOpen] = useState(false);
  const [baasName, setBaasName] = useState('');
  const [baasPort, setBaasPort] = useState('8090');
  const [baasDomain, setBaasDomain] = useState('');
  const [baasAdminEmail, setBaasAdminEmail] = useState('');
  const [baasAdminPassword, setBaasAdminPassword] = useState('');
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [activeSnippetInstance, setActiveSnippetInstance] = useState<BaasInstance | null>(null);
  const [snippets, setSnippets] = useState<BaasSdkSnippet[]>([]);
  const [snippetTab, setSnippetTab] = useState(0);

  // ── S3 State ───────────────────────────────────────────────────────────────
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [s3Keys, setS3Keys] = useState<S3AccessKey[]>([]);
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [bucketName, setBucketName] = useState('');
  const [bucketVisibility, setBucketVisibility] = useState<'private' | 'public-read'>('private');
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');

  // ── SES State ──────────────────────────────────────────────────────────────
  const [sesKeys, setSesKeys] = useState<SesApiKey[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [createSesKeyOpen, setCreateSesKeyOpen] = useState(false);
  const [sesKeyName, setSesKeyName] = useState('');
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('Test Transactional Email via ClearPanel SES');
  const [testBody, setTestBody] = useState('<p>Hello from <strong>ClearPanel SES</strong>! Transactional delivery is verified.</p>');

  // ── Vault State ────────────────────────────────────────────────────────────
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [selectedProject, setSelectedProject] = useState('default');
  const [selectedEnv, setSelectedEnv] = useState<'production' | 'staging' | 'development'>('production');
  const [createSecretOpen, setCreateSecretOpen] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [showSecretValues, setShowSecretValues] = useState<Record<string, boolean>>({});

  // ── Redis State ────────────────────────────────────────────────────────────
  const [redisInfo, setRedisInfo] = useState<RedisCacheInfo | null>(null);

  const showToast = (msg: string, sev: 'success' | 'error' | 'info' = 'success') => setToast({ msg, sev });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, baasRes, bucketsRes, s3KeysRes, sesKeysRes, logsRes, secretsRes, redisRes] = await Promise.all([
        cloudApi.getStats().catch(() => null),
        baasApi.listInstances().catch(() => ({ instances: [] })),
        cloudApi.listBuckets().catch(() => ({ buckets: [] })),
        cloudApi.listS3Keys().catch(() => ({ keys: [] })),
        cloudApi.listSesKeys().catch(() => ({ keys: [] })),
        cloudApi.getEmailLogs().catch(() => ({ logs: [] })),
        cloudApi.listSecrets().catch(() => ({ secrets: [] })),
        cloudApi.getRedisInfo().catch(() => null),
      ]);

      if (statsRes) setStats(statsRes);
      setBaasInstances(baasRes.instances || []);
      setBuckets(bucketsRes.buckets || []);
      setS3Keys(s3KeysRes.keys || []);
      setSesKeys(sesKeysRes.keys || []);
      setEmailLogs(logsRes.logs || []);
      setSecrets(secretsRes.secrets || []);
      setRedisInfo(redisRes);
    } catch (e: any) {
      showToast(e.message || 'Error loading cloud services', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── BaaS Handlers ──────────────────────────────────────────────────────────
  const handleCreateBaas = async () => {
    if (!baasName.trim() || !baasAdminEmail.trim()) {
      showToast('Name and admin email are required', 'error');
      return;
    }
    setOpBusy(true);
    try {
      await baasApi.createInstance({
        name: baasName.trim(),
        port: baasPort ? parseInt(baasPort, 10) : undefined,
        domain: baasDomain.trim() || undefined,
        adminEmail: baasAdminEmail.trim(),
        adminPassword: baasAdminPassword.trim() || undefined,
      });
      showToast(`Created BaaS instance "${baasName}"`);
      setCreateBaasOpen(false);
      setBaasName('');
      setBaasDomain('');
      setBaasAdminEmail('');
      setBaasAdminPassword('');
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleOpenSnippets = async (inst: BaasInstance) => {
    setActiveSnippetInstance(inst);
    setSnippetsOpen(true);
    try {
      const res = await baasApi.getSnippets(inst.id);
      setSnippets(res.snippets);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // ── S3 Handlers ────────────────────────────────────────────────────────────
  const handleCreateBucket = async () => {
    if (!bucketName.trim()) {
      showToast('Bucket name is required', 'error');
      return;
    }
    setOpBusy(true);
    try {
      await cloudApi.createBucket({ name: bucketName.trim(), visibility: bucketVisibility });
      showToast(`Bucket "${bucketName}" created!`);
      setCreateBucketOpen(false);
      setBucketName('');
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleDeleteBucket = async (name: string) => {
    if (!confirm(`Delete bucket "${name}" and all objects?`)) return;
    setOpBusy(true);
    try {
      await cloudApi.deleteBucket(name);
      showToast(`Bucket "${name}" deleted`);
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleCreateS3Key = async () => {
    setOpBusy(true);
    try {
      await cloudApi.createS3Key(keyName.trim() || 'App S3 Key');
      showToast('S3 Access Key generated!');
      setCreateKeyOpen(false);
      setKeyName('');
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  // ── SES Handlers ───────────────────────────────────────────────────────────
  const handleCreateSesKey = async () => {
    setOpBusy(true);
    try {
      await cloudApi.createSesKey(sesKeyName.trim() || 'API Mailer');
      showToast('SES API Key generated!');
      setCreateSesKeyOpen(false);
      setSesKeyName('');
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testTo.trim()) {
      showToast('Recipient email is required', 'error');
      return;
    }
    setOpBusy(true);
    try {
      await cloudApi.sendEmail({
        to: testTo.trim(),
        subject: testSubject.trim(),
        html: testBody,
      });
      showToast(`Email dispatched to ${testTo}! Check delivery log.`);
      setSendTestOpen(false);
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  // ── Vault Handlers ─────────────────────────────────────────────────────────
  const handleSaveSecret = async () => {
    if (!secretKey.trim()) {
      showToast('Secret key name is required', 'error');
      return;
    }
    setOpBusy(true);
    try {
      await cloudApi.saveSecret({
        project: selectedProject,
        environment: selectedEnv,
        key: secretKey.trim(),
        value: secretValue,
      });
      showToast(`Saved secret "${secretKey}"`);
      setCreateSecretOpen(false);
      setSecretKey('');
      setSecretValue('');
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleDeleteSecret = async (id: string) => {
    setOpBusy(true);
    try {
      await cloudApi.deleteSecret(id);
      showToast('Secret deleted');
      await loadAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setOpBusy(false);
    }
  };

  const handleExportEnv = async () => {
    try {
      const res = await cloudApi.exportEnv(selectedProject, selectedEnv);
      copyToClipboard(res.envContent);
      showToast(`.env file copied to clipboard!`);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 1180, mx: 'auto' }}>
        {/* Top Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <CloudQueueIcon sx={{ mr: 1.5, color: '#f58220', fontSize: 36 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight={700}>ClearPanel Cloud™</Typography>
            <Typography variant="body2" color="text.secondary">
              Self-Hosted AWS, Azure & Firebase Cloud Primitives on your Ubuntu VPS.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="Refresh All Services">
              <IconButton onClick={loadAllData} disabled={loading || opBusy}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Cloud Cost Savings & Overview Meter */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(245,130,32,0.1) 0%, rgba(33,150,243,0.06) 100%)',
            borderColor: 'rgba(245,130,32,0.3)',
          }}
        >
          <Grid container spacing={2.5} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <SavingsIcon sx={{ color: 'success.main', fontSize: 36 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    ESTIMATED CLOUD SAVINGS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="success.main">
                    ${stats?.estimatedMonthlySavingsUsd || 350}/mo
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    vs AWS S3, RDS, Firebase & ElastiCache
                  </Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip icon={<SpeedIcon />} label={`${stats?.baasRunningCount || 0} Firebase (BaaS) Active`} color="warning" size="small" />
                <Chip icon={<StorageIcon />} label={`${stats?.s3BucketsCount || 0} S3 Buckets`} color="primary" size="small" />
                <Chip icon={<EmailIcon />} label={`${stats?.sesEmailsSentCount || 0} SES Mails Sent`} color="info" size="small" />
                <Chip icon={<VpnKeyIcon />} label={`${stats?.vaultSecretsCount || 0} Encrypted Secrets`} color="secondary" size="small" />
                <Chip icon={<MemoryIcon />} label={redisInfo?.running ? 'Redis Cache: Online' : 'Redis: Standby'} color={redisInfo?.running ? 'success' : 'default'} size="small" />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Cloud Services Navigation Tabs */}
        <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <Tabs
            value={currentTab}
            onChange={(_, v) => setCurrentTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Cloud Overview" id="tab-0" sx={{ fontWeight: 600 }} />
            <Tab label="ClearBaaS (Firebase)" id="tab-1" sx={{ fontWeight: 600 }} />
            <Tab label="ClearSES (Email API)" id="tab-2" sx={{ fontWeight: 600 }} />
            <Tab label="ClearStorage (S3)" id="tab-3" sx={{ fontWeight: 600 }} />
            <Tab label="ClearVault (Secrets)" id="tab-4" sx={{ fontWeight: 600 }} />
            <Tab label="ClearCache (Redis)" id="tab-5" sx={{ fontWeight: 600 }} />
          </Tabs>

          {/* ── TAB 0: CLOUD OVERVIEW & MATRIX ── */}
          {currentTab === 0 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Active Cloud Services on this VPS
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Click any service card to configure, generate SDK keys, and view live endpoints.
              </Typography>

              <Grid container spacing={2.5}>
                {/* ClearBaaS Card */}
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>ClearBaaS</Typography>
                        <Chip label="Firebase Alt" size="small" color="warning" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        User Authentication, Realtime Database, and File Storage with JS, Flutter, and Python SDKs.
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {baasInstances.length} INSTANCES CONFIGURED
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 1.5 }}>
                      <Button size="small" onClick={() => setCurrentTab(1)} sx={{ fontWeight: 600 }}>
                        Manage BaaS Engines
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>

                {/* ClearSES Card */}
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>ClearSES</Typography>
                        <Chip label="AWS SES Alt" size="small" color="info" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        REST API for transactional email delivery. API keys, delivery logs, and DKIM signing.
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {sesKeys.length} API KEYS • {stats?.sesEmailsSentCount || 0} EMAILS SENT
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 1.5 }}>
                      <Button size="small" onClick={() => setCurrentTab(2)} sx={{ fontWeight: 600 }}>
                        Open Email API
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>

                {/* ClearStorage S3 Card */}
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>ClearStorage</Typography>
                        <Chip label="Amazon S3 Alt" size="small" color="primary" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        S3-compatible Object Storage for backups, user uploads, and media. Compatible with AWS SDKs.
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {buckets.length} BUCKETS • {s3Keys.length} ACCESS KEYS
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 1.5 }}>
                      <Button size="small" onClick={() => setCurrentTab(3)} sx={{ fontWeight: 600 }}>
                        Manage S3 Buckets
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>

                {/* ClearVault Card */}
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>ClearVault</Typography>
                        <Chip label="Secrets Manager" size="small" color="secondary" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        AES-256 encrypted environment variables and credentials vault with 1-click .env export.
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {secrets.length} SECRETS STORED
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 1.5 }}>
                      <Button size="small" onClick={() => setCurrentTab(4)} sx={{ fontWeight: 600 }}>
                        Manage Secrets
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>

                {/* ClearCache Redis Card */}
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>ClearCache</Typography>
                        <Chip label="ElastiCache Alt" size="small" color="success" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Managed in-memory Redis database for caching, session stores, and background queue workers.
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        STATUS: {redisInfo?.running ? 'ONLINE (PORT 6379)' : 'STANDBY'}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 1.5 }}>
                      <Button size="small" onClick={() => setCurrentTab(5)} sx={{ fontWeight: 600 }}>
                        View Cache Stats
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ── TAB 1: CLEARBAAS (FIREBASE ALTERNATIVE) ── */}
          {currentTab === 1 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>ClearBaaS Instances</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Lightweight PocketBase engines (Auth, Realtime DB, File Uploads) in 15MB RAM.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateBaasOpen(true)}
                  sx={{ bgcolor: '#f58220', '&:hover': { bgcolor: '#e06f15' } }}
                >
                  New BaaS Instance
                </Button>
              </Box>

              {baasInstances.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center', bgcolor: 'action.hover' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>No BaaS instances active yet.</Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateBaasOpen(true)}>Create Instance</Button>
                </Paper>
              ) : (
                <Grid container spacing={2}>
                  {baasInstances.map((inst) => (
                    <Grid size={{ xs: 12, md: 6 }} key={inst.id}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight={700}>{inst.name}</Typography>
                            <Chip label={inst.status.toUpperCase()} color={inst.status === 'running' ? 'success' : 'default'} size="small" />
                          </Box>
                          <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            {inst.apiUrl}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip label={`Port: ${inst.port}`} size="small" variant="outlined" />
                            {inst.domain && <Chip label={inst.domain} size="small" color="primary" variant="outlined" />}
                          </Stack>
                        </CardContent>
                        <Divider />
                        <CardActions sx={{ p: 1.5, justifyContent: 'space-between' }}>
                          <Button
                            size="small"
                            variant="contained"
                            endIcon={<OpenInNewIcon />}
                            component="a"
                            href={inst.adminUrl}
                            target="_blank"
                            sx={{ bgcolor: '#f58220', '&:hover': { bgcolor: '#e06f15' } }}
                          >
                            Admin Portal (/_/)
                          </Button>
                          <Button size="small" startIcon={<CodeIcon />} onClick={() => handleOpenSnippets(inst)}>
                            SDK Code
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* ── TAB 2: CLEARSES (AWS SES ALTERNATIVE) ── */}
          {currentTab === 2 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>ClearSES: Transactional Email API</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Send transactional emails from your code via REST API (<code>POST /api/cloud/ses/send</code>) using your server's Postfix engine.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setSendTestOpen(true)}>
                    Send Test Email
                  </Button>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateSesKeyOpen(true)}>
                    Generate API Key
                  </Button>
                </Stack>
              </Box>

              {/* API Keys List */}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2, mb: 1 }}>API Authentication Keys</Typography>
              {sesKeys.length === 0 ? (
                <Alert severity="info" sx={{ mb: 3 }}>
                  No SES API keys created yet. Click <strong>Generate API Key</strong> to authenticate your application backend.
                </Alert>
              ) : (
                <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                  {sesKeys.map((k) => (
                    <Box key={k.id} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{k.name}</Typography>
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">{k.key}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={k.status.toUpperCase()} size="small" color={k.status === 'active' ? 'success' : 'default'} />
                        <IconButton size="small" onClick={() => copyToClipboard(k.key)}><ContentCopyIcon fontSize="small" /></IconButton>
                      </Stack>
                    </Box>
                  ))}
                </Paper>
              )}

              {/* Outbound Delivery Logs */}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Recent Outbound Emails</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 250, overflow: 'auto', p: 2, borderRadius: 2 }}>
                {emailLogs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No transactional emails logged yet.</Typography>
                ) : (
                  emailLogs.map((log) => (
                    <Box key={log.id} sx={{ py: 0.75, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>To: {log.to}</Typography>
                        <Typography variant="caption" color="text.secondary">{log.subject}</Typography>
                      </Box>
                      <Chip label={log.status} color="success" size="small" />
                    </Box>
                  ))
                )}
              </Paper>
            </Box>
          )}

          {/* ── TAB 3: CLEARSTORAGE (S3 OBJECT STORAGE) ── */}
          {currentTab === 3 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>ClearStorage: S3-Compatible Buckets</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Store and serve user media, assets, and backups. Compatible with standard AWS S3 SDKs and Boto3.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="outlined" startIcon={<VpnKeyIcon />} onClick={() => setCreateKeyOpen(true)}>
                    New S3 Key
                  </Button>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateBucketOpen(true)}>
                    Create Bucket
                  </Button>
                </Stack>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                {buckets.length === 0 ? (
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info">No S3 buckets yet. Click Create Bucket to start storing files.</Alert>
                  </Grid>
                ) : (
                  buckets.map((b) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.name}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={700}>{b.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            Visibility: {b.visibility} • Objects: {b.objectsCount}
                          </Typography>
                          <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                            {b.endpointUrl}
                          </Typography>
                        </CardContent>
                        <Divider />
                        <CardActions sx={{ justifyContent: 'flex-end' }}>
                          <IconButton size="small" color="error" onClick={() => handleDeleteBucket(b.name)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))
                )}
              </Grid>

              {/* S3 Access Keys */}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>S3 Access Credentials</Typography>
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                {s3Keys.length === 0 ? (
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">No S3 access keys created yet.</Typography>
                  </Box>
                ) : (
                  s3Keys.map((k) => (
                    <Box key={k.id} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{k.name}</Typography>
                        <Typography variant="caption" fontFamily="monospace">Access Key: {k.accessKeyId}</Typography>
                      </Box>
                      <IconButton size="small" onClick={() => copyToClipboard(`AWS_ACCESS_KEY_ID=${k.accessKeyId}\nAWS_SECRET_ACCESS_KEY=${k.secretAccessKey}`)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))
                )}
              </Paper>
            </Box>
          )}

          {/* ── TAB 4: CLEARVAULT (AWS SECRETS MANAGER) ── */}
          {currentTab === 4 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>ClearVault: Encrypted Secrets Store</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Store application API keys, database credentials, and tokens with AES-256 encryption.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleExportEnv}>
                    Copy as .env
                  </Button>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateSecretOpen(true)}>
                    Add Secret
                  </Button>
                </Stack>
              </Box>

              {/* Secrets Table */}
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                {secrets.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">No secrets stored in this environment yet.</Typography>
                  </Box>
                ) : (
                  secrets.map((s) => (
                    <Box key={s.id} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700} fontFamily="monospace">{s.key}</Typography>
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                          {showSecretValues[s.id] ? s.value : '••••••••••••••••••••'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <IconButton size="small" onClick={() => setShowSecretValues((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}>
                          {showSecretValues[s.id] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                        <IconButton size="small" onClick={() => copyToClipboard(s.value)}><ContentCopyIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteSecret(s.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </Box>
                  ))
                )}
              </Paper>
            </Box>
          )}

          {/* ── TAB 5: CLEARCACHE (REDIS) ── */}
          {currentTab === 5 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>ClearCache: Managed Redis</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                High-speed caching and background job queues powered by local Redis.
              </Typography>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>STATUS</Typography>
                    <Typography variant="h6" fontWeight={700} color={redisInfo?.running ? 'success.main' : 'error.main'}>
                      {redisInfo?.running ? 'ONLINE' : 'STOPPED'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>MEMORY USAGE</Typography>
                    <Typography variant="h6" fontWeight={700}>{redisInfo?.usedMemory || '12 MB'}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>PORT & CLIENTS</Typography>
                    <Typography variant="h6" fontWeight={700}>Port 6379 ({redisInfo?.connectedClients || 1} client)</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Paper variant="outlined" sx={{ p: 2.5, mt: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Application Connection URI</Typography>
                <Box sx={{ p: 1.5, bgcolor: '#0d1117', borderRadius: 1, color: '#58a6ff', fontFamily: 'monospace', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{redisInfo?.connectionString || 'redis://127.0.0.1:6379/0'}</span>
                  <IconButton size="small" onClick={() => copyToClipboard(redisInfo?.connectionString || 'redis://127.0.0.1:6379/0')}>
                    <ContentCopyIcon fontSize="small" sx={{ color: '#fff' }} />
                  </IconButton>
                </Box>
              </Paper>
            </Box>
          )}
        </Paper>

        {/* ── DIALOGS ── */}

        {/* Create BaaS Dialog */}
        <Dialog open={createBaasOpen} onClose={() => setCreateBaasOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle fontWeight={700}>New ClearBaaS Instance</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField label="Project Name" fullWidth size="small" value={baasName} onChange={(e) => setBaasName(e.target.value)} required />
              <TextField label="Port" fullWidth size="small" value={baasPort} onChange={(e) => setBaasPort(e.target.value)} />
              <TextField label="Custom Domain (Optional)" fullWidth size="small" value={baasDomain} onChange={(e) => setBaasDomain(e.target.value)} />
              <TextField label="Admin Email" type="email" fullWidth size="small" value={baasAdminEmail} onChange={(e) => setBaasAdminEmail(e.target.value)} required />
              <TextField label="Admin Password" type="password" fullWidth size="small" value={baasAdminPassword} onChange={(e) => setBaasAdminPassword(e.target.value)} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateBaasOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateBaas} disabled={opBusy || !baasName.trim() || !baasAdminEmail.trim()}>Create</Button>
          </DialogActions>
        </Dialog>

        {/* Create S3 Bucket Dialog */}
        <Dialog open={createBucketOpen} onClose={() => setCreateBucketOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle fontWeight={700}>Create S3 Bucket</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField label="Bucket Name" placeholder="e.g. user-media-uploads" fullWidth size="small" value={bucketName} onChange={(e) => setBucketName(e.target.value)} required />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateBucketOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateBucket} disabled={opBusy || !bucketName.trim()}>Create Bucket</Button>
          </DialogActions>
        </Dialog>

        {/* Create S3 Key Dialog */}
        <Dialog open={createKeyOpen} onClose={() => setCreateKeyOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle fontWeight={700}>Generate S3 Access Key</DialogTitle>
          <DialogContent dividers>
            <TextField label="Key Name / Application" placeholder="e.g. Next.js Uploads" fullWidth size="small" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateKeyOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateS3Key} disabled={opBusy}>Generate</Button>
          </DialogActions>
        </Dialog>

        {/* Create SES Key Dialog */}
        <Dialog open={createSesKeyOpen} onClose={() => setCreateSesKeyOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle fontWeight={700}>Generate Transactional Email API Key</DialogTitle>
          <DialogContent dividers>
            <TextField label="Key Identifier" placeholder="e.g. Auth Service" fullWidth size="small" value={sesKeyName} onChange={(e) => setSesKeyName(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateSesKeyOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateSesKey} disabled={opBusy}>Generate Key</Button>
          </DialogActions>
        </Dialog>

        {/* Send Test Email Dialog */}
        <Dialog open={sendTestOpen} onClose={() => setSendTestOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle fontWeight={700}>Send Test Transactional Email</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField label="Recipient Email" placeholder="you@example.com" fullWidth size="small" value={testTo} onChange={(e) => setTestTo(e.target.value)} required />
              <TextField label="Subject" fullWidth size="small" value={testSubject} onChange={(e) => setTestSubject(e.target.value)} />
              <TextField label="HTML Body" multiline rows={4} fullWidth size="small" value={testBody} onChange={(e) => setTestBody(e.target.value)} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSendTestOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSendTestEmail} disabled={opBusy || !testTo.trim()}>Send Email</Button>
          </DialogActions>
        </Dialog>

        {/* Create Secret Dialog */}
        <Dialog open={createSecretOpen} onClose={() => setCreateSecretOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle fontWeight={700}>Add Encrypted Secret</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField label="Key (e.g. STRIPE_API_KEY)" fullWidth size="small" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} required />
              <TextField label="Value" fullWidth size="small" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} required />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateSecretOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveSecret} disabled={opBusy || !secretKey.trim()}>Save Secret</Button>
          </DialogActions>
        </Dialog>

        {/* SDK Snippets Dialog */}
        <Dialog open={snippetsOpen} onClose={() => setSnippetsOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={700}>SDK Snippets — {activeSnippetInstance?.name}</Typography>
            <Button size="small" startIcon={copied ? <CheckIcon color="success" /> : <ContentCopyIcon />} onClick={() => snippets[snippetTab] && copyToClipboard(snippets[snippetTab].code)}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            <Tabs value={snippetTab} onChange={(_, v) => setSnippetTab(v)} sx={{ px: 2, bgcolor: 'action.hover' }}>
              {snippets.map((s, idx) => (
                <Tab key={s.language} label={s.label} id={`snip-${idx}`} />
              ))}
            </Tabs>
            <Box sx={{ p: 2.5, bgcolor: '#0d1117', color: '#e6edf3', fontFamily: 'monospace', fontSize: 12.5, whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
              {snippets[snippetTab]?.code}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSnippetsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Toast */}
        <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          {toast ? <Alert severity={toast.sev} variant="filled">{toast.msg}</Alert> : <span />}
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
