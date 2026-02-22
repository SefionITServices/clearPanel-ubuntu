import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Stack,
  CircularProgress, Tabs, Tab, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
  Grid, Switch, FormControlLabel, MenuItem, Select, FormControl,
  InputLabel, Divider,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import ShieldIcon from '@mui/icons-material/Shield';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SecurityIcon from '@mui/icons-material/Security';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import GavelIcon from '@mui/icons-material/Gavel';
import { firewallApi } from '../api/firewall';

// ─── Types ────────────────────────────────────────────────────────────

interface FirewallRule {
  id: number;
  to: string;
  action: string;
  from: string;
  port?: string;
  protocol?: string;
  comment?: string;
  v6?: boolean;
}

interface FirewallStatus {
  enabled: boolean;
  installed: boolean;
  defaultIncoming: string;
  defaultOutgoing: string;
  rules: FirewallRule[];
}

interface Fail2BanJail {
  name: string;
  enabled: boolean;
  currentlyBanned: number;
  totalBanned: number;
  currentlyFailed: number;
  totalFailed: number;
}

// ─── Presets ──────────────────────────────────────────────────────────

const RULE_PRESETS = [
  { label: 'Web Server', desc: 'HTTP + HTTPS (80, 443)', value: 'web-server', color: '#4285F4' },
  { label: 'Mail Server', desc: 'SMTP, IMAP, POP3', value: 'mail-server', color: '#34A853' },
  { label: 'DNS Server', desc: 'TCP + UDP port 53', value: 'dns-server', color: '#FBBC04' },
  { label: 'Database', desc: 'MySQL + PostgreSQL', value: 'database', color: '#7B1FA2' },
  { label: 'Panel Defaults', desc: 'SSH, HTTP, HTTPS, Panel', value: 'panel', color: '#EA4335' },
];

// ─── Main Component ───────────────────────────────────────────────────

export default function FirewallPage() {
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState<FirewallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [fail2ban, setFail2Ban] = useState<{ installed: boolean; running: boolean; jails: Fail2BanJail[] } | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const toast = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await firewallApi.getStatus();
      if (data.success) setStatus(data.status);
      else toast(data.error || 'Failed', 'error');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally { setLoading(false); }
  }, []);

  const loadFail2Ban = useCallback(async () => {
    try {
      const data = await firewallApi.getFail2Ban();
      if (data.success) setFail2Ban(data);
    } catch {}
  }, []);

  useEffect(() => { loadStatus(); loadFail2Ban(); }, [loadStatus, loadFail2Ban]);

  const handleInstall = async () => {
    setActing(true);
    try {
      const data = await firewallApi.install();
      data.success ? toast('UFW installed') : toast(data.message, 'error');
      loadStatus();
    } catch (e: any) { toast(e.message, 'error'); }
    setActing(false);
  };

  const handleToggle = async () => {
    if (!status) return;
    setActing(true);
    try {
      const data = status.enabled
        ? await firewallApi.disable()
        : await firewallApi.enable();
      data.success
        ? toast(status.enabled ? 'Firewall disabled' : 'Firewall enabled')
        : toast(data.message, 'error');
      loadStatus();
    } catch (e: any) { toast(e.message, 'error'); }
    setActing(false);
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Delete this firewall rule?')) return;
    try {
      const data = await firewallApi.deleteRule(id);
      data.success ? toast('Rule deleted') : toast(data.message, 'error');
      loadStatus();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handlePreset = async (preset: string) => {
    setActing(true);
    try {
      const data = await firewallApi.applyPreset(preset);
      data.success ? toast(`Preset applied`) : toast(data.message, 'error');
      loadStatus();
    } catch (e: any) { toast(e.message, 'error'); }
    setActing(false);
  };

  const handleReset = async () => {
    if (!confirm('Reset firewall? This will remove ALL rules and disable the firewall.')) return;
    setActing(true);
    try {
      const data = await firewallApi.reset();
      data.success ? toast('Firewall reset') : toast(data.message, 'error');
      loadStatus();
    } catch (e: any) { toast(e.message, 'error'); }
    setActing(false);
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShieldIcon sx={{ color: '#EA4335', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>Firewall</Typography>
              <Typography variant="body1" color="text.secondary">
                Manage UFW firewall rules to secure your server
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { loadStatus(); loadFail2Ban(); }} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
            {status?.installed && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ textTransform: 'none' }}>
                Add Rule
              </Button>
            )}
          </Stack>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress /></Box>
        ) : !status?.installed ? (
          /* Not installed */
          <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <ShieldIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                UFW Firewall is not installed
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Install UFW to manage firewall rules and protect your server
              </Typography>
              <Button variant="contained" startIcon={acting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                onClick={handleInstall} disabled={acting} sx={{ textTransform: 'none' }}>
                {acting ? 'Installing...' : 'Install UFW'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status card */}
            <Card elevation={0} sx={{ mb: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 48, height: 48, borderRadius: 2,
                        bgcolor: status.enabled ? '#34A85314' : '#EA433514',
                        color: status.enabled ? '#34A853' : '#EA4335',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {status.enabled ? <CheckCircleIcon /> : <BlockIcon />}
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Firewall is {status.enabled ? 'Active' : 'Inactive'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip size="small" label={`Incoming: ${status.defaultIncoming}`}
                          color={status.defaultIncoming === 'deny' ? 'error' : 'success'} variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem' }} />
                        <Chip size="small" label={`Outgoing: ${status.defaultOutgoing}`}
                          color={status.defaultOutgoing === 'allow' ? 'success' : 'error'} variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem' }} />
                        <Chip size="small" label={`${status.rules.length} rules`}
                          sx={{ height: 20, fontSize: '0.65rem' }} />
                      </Stack>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant={status.enabled ? 'outlined' : 'contained'}
                      color={status.enabled ? 'error' : 'success'}
                      startIcon={acting ? <CircularProgress size={14} color="inherit" /> : <PowerSettingsNewIcon />}
                      onClick={handleToggle}
                      disabled={acting}
                      sx={{ textTransform: 'none' }}
                    >
                      {status.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outlined" color="warning" startIcon={<RestartAltIcon />}
                      onClick={handleReset} disabled={acting} sx={{ textTransform: 'none' }}>
                      Reset
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Card elevation={0} sx={{ mb: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                  px: 2,
                  '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, minHeight: 48 },
                }}
              >
                <Tab icon={<SecurityIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Rules" />
                <Tab icon={<ShieldIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Quick Presets" />
                <Tab icon={<GavelIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Fail2Ban" />
              </Tabs>
            </Card>

            {tab === 0 && (
              <RulesTab rules={status.rules} onDelete={handleDeleteRule} onAdd={() => setAddOpen(true)} />
            )}
            {tab === 1 && (
              <PresetsTab onApply={handlePreset} acting={acting} />
            )}
            {tab === 2 && (
              <Fail2BanTab data={fail2ban} onRefresh={loadFail2Ban} />
            )}
          </>
        )}

        {/* Add Rule Dialog */}
        <AddRuleDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            loadStatus();
            toast('Firewall rule added');
          }}
          toast={toast}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  RULES TAB
// ═══════════════════════════════════════════════════════════════════════

function RulesTab({
  rules, onDelete, onAdd,
}: {
  rules: FirewallRule[];
  onDelete: (id: number) => void;
  onAdd: () => void;
}) {
  if (rules.length === 0) {
    return (
      <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <SecurityIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No firewall rules</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add rules or apply a preset to secure your server
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ textTransform: 'none' }}>
            Add Rule
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getActionColor = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes('ALLOW')) return '#34A853';
    if (a.includes('DENY')) return '#EA4335';
    if (a.includes('REJECT')) return '#F9AB00';
    if (a.includes('LIMIT')) return '#7B1FA2';
    return '#5F6368';
  };

  return (
    <Stack spacing={1.5}>
      {rules.filter(r => !r.v6).map(rule => (
        <Card key={rule.id} elevation={0}
          sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2, '&:hover': { borderColor: getActionColor(rule.action) } }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  size="small"
                  label={rule.action}
                  sx={{
                    height: 24, fontWeight: 700, fontSize: '0.7rem',
                    bgcolor: `${getActionColor(rule.action)}18`,
                    color: getActionColor(rule.action),
                    minWidth: 70, justifyContent: 'center',
                  }}
                />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {rule.to}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    From: {rule.from}
                    {rule.comment && ` — ${rule.comment}`}
                  </Typography>
                </Box>
              </Box>
              <Tooltip title="Delete rule">
                <IconButton size="small" color="error" onClick={() => onDelete(rule.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  PRESETS TAB
// ═══════════════════════════════════════════════════════════════════════

function PresetsTab({ onApply, acting }: { onApply: (p: string) => void; acting: boolean }) {
  return (
    <Grid container spacing={2}>
      {RULE_PRESETS.map(p => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.value}>
          <Card elevation={0}
            sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2, '&:hover': { borderColor: p.color } }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5,
                  bgcolor: `${p.color}14`, color: p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ShieldIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{p.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.desc}</Typography>
                </Box>
              </Box>
              <Button fullWidth variant="outlined" size="small"
                onClick={() => onApply(p.value)} disabled={acting}
                sx={{ textTransform: 'none' }}>
                Apply Preset
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  FAIL2BAN TAB
// ═══════════════════════════════════════════════════════════════════════

function Fail2BanTab({
  data, onRefresh,
}: {
  data: { installed: boolean; running: boolean; jails: Fail2BanJail[] } | null;
  onRefresh: () => void;
}) {
  if (!data || !data.installed) {
    return (
      <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <GavelIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>Fail2Ban not installed</Typography>
          <Typography variant="body2" color="text.secondary">
            Install Fail2Ban from the App Store to see intrusion prevention status
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip
                size="small"
                label={data.running ? 'Running' : 'Stopped'}
                color={data.running ? 'success' : 'error'}
                sx={{ fontWeight: 600 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Fail2Ban</Typography>
            </Box>
            <Button variant="outlined" size="small" startIcon={<RefreshIcon />}
              onClick={onRefresh} sx={{ textTransform: 'none' }}>Refresh</Button>
          </Box>
          {data.jails.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No active jails</Typography>
          ) : (
            <Stack spacing={1.5}>
              {data.jails.map(jail => (
                <Box key={jail.name} sx={{
                  p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{jail.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Failed: {jail.currentlyFailed} / {jail.totalFailed}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip size="small" label={`${jail.currentlyBanned} banned`}
                      color={jail.currentlyBanned > 0 ? 'error' : 'default'} variant="outlined"
                      sx={{ fontWeight: 600 }} />
                    <Chip size="small" label={`${jail.totalBanned} total`}
                      sx={{ fontWeight: 600 }} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ADD RULE DIALOG
// ═══════════════════════════════════════════════════════════════════════

function AddRuleDialog({
  open, onClose, onAdded, toast,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  toast: (msg: string, sev?: 'success' | 'error' | 'info') => void;
}) {
  const [action, setAction] = useState<'allow' | 'deny' | 'reject' | 'limit'>('allow');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState<'tcp' | 'udp' | 'any'>('tcp');
  const [from, setFrom] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!port.trim() && !from.trim()) {
      toast('Port or source IP is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await firewallApi.addRule({
        action,
        port: port.trim() || undefined,
        protocol,
        from: from.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      if (data.success) {
        onAdded();
        setPort(''); setFrom(''); setComment('');
      } else {
        toast(data.message || 'Failed', 'error');
      }
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShieldIcon color="error" />
        Add Firewall Rule
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Action</InputLabel>
            <Select value={action} label="Action" onChange={e => setAction(e.target.value as any)}>
              <MenuItem value="allow">Allow</MenuItem>
              <MenuItem value="deny">Deny</MenuItem>
              <MenuItem value="reject">Reject</MenuItem>
              <MenuItem value="limit">Limit (rate-limit)</MenuItem>
            </Select>
          </FormControl>

          <TextField fullWidth size="small" label="Port(s)"
            placeholder="80 or 80,443 or 8000:9000"
            value={port} onChange={e => setPort(e.target.value)}
            helperText="Single port, comma-separated, or range (e.g. 8000:9000)" />

          <FormControl fullWidth size="small">
            <InputLabel>Protocol</InputLabel>
            <Select value={protocol} label="Protocol" onChange={e => setProtocol(e.target.value as any)}>
              <MenuItem value="tcp">TCP</MenuItem>
              <MenuItem value="udp">UDP</MenuItem>
              <MenuItem value="any">Both (TCP & UDP)</MenuItem>
            </Select>
          </FormControl>

          <TextField fullWidth size="small" label="Source IP (optional)"
            placeholder="Anywhere (leave empty) or 192.168.1.0/24"
            value={from} onChange={e => setFrom(e.target.value)}
            helperText="Leave empty to apply from all sources" />

          <TextField fullWidth size="small" label="Comment (optional)"
            placeholder="SSH access"
            value={comment} onChange={e => setComment(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          disabled={saving || (!port.trim() && !from.trim())}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          sx={{ textTransform: 'none' }}>
          {saving ? 'Adding...' : 'Add Rule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
