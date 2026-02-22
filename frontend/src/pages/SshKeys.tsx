import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Stack,
  CircularProgress, Tabs, Tab, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Divider, LinearProgress, InputAdornment,
  MenuItem, Select, FormControl, InputLabel, FormHelperText,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import KeyIcon from '@mui/icons-material/Key';
import SecurityIcon from '@mui/icons-material/Security';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { sshKeysApi } from '../api/ssh-keys';

// ─── Types ────────────────────────────────────────────────────────────

interface SshKey {
  name: string;
  type: string;
  bits?: number;
  fingerprint: string;
  publicKey: string;
  createdAt: string;
  comment: string;
}

type KeyAlgorithm = 'ed25519' | 'rsa' | 'ecdsa';

// ─── Constants ────────────────────────────────────────────────────────

const ALGO_INFO: Record<KeyAlgorithm, { label: string; description: string; color: string; recommended?: boolean }> = {
  ed25519: { label: 'Ed25519', description: 'Modern, fast, secure — recommended for GitHub & most services', color: '#34A853', recommended: true },
  rsa: { label: 'RSA', description: 'Widely compatible — use 4096 bits for legacy systems', color: '#4285F4' },
  ecdsa: { label: 'ECDSA', description: 'Good performance — 256/384/521-bit curves', color: '#7B1FA2' },
};

// ─── Main Component ───────────────────────────────────────────────────

export default function SshKeysPage() {
  const [tab, setTab] = useState(0);
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const toast = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sshKeysApi.list();
      if (data.success) setKeys(data.keys || []);
    } catch {
      setKeys([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete SSH key "${name}"? This cannot be undone.`)) return;
    try {
      const data = await sshKeysApi.delete(name);
      data.success ? toast(`Key "${name}" deleted`) : toast(data.message || 'Failed', 'error');
    } catch (e: any) {
      toast(e.message, 'error');
    }
    loadKeys();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Public key copied to clipboard', 'info');
    } catch {
      toast('Failed to copy — please select and copy manually', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <VpnKeyIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>SSH Keys</Typography>
              <Typography variant="body1" color="text.secondary">
                Generate and manage SSH keys for GitHub, GitLab, and remote servers
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadKeys} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenerateOpen(true)} sx={{ textTransform: 'none' }}>
              Generate New Key
            </Button>
          </Stack>
        </Box>

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
            <Tab icon={<KeyIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="My Keys" />
            <Tab icon={<SecurityIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Authorized Keys" />
          </Tabs>
        </Card>

        {/* Tab Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {tab === 0 && (
              <MyKeysTab
                keys={keys}
                onDelete={handleDelete}
                onCopy={copyToClipboard}
                onGenerate={() => setGenerateOpen(true)}
              />
            )}
            {tab === 1 && (
              <AuthorizedKeysTab toast={toast} />
            )}
          </>
        )}

        {/* Generate Dialog */}
        <GenerateKeyDialog
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
          onSuccess={(pubKey) => {
            setGenerateOpen(false);
            loadKeys();
            toast('SSH key generated successfully');
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
//  MY KEYS TAB
// ═══════════════════════════════════════════════════════════════════════

function MyKeysTab({
  keys, onDelete, onCopy, onGenerate,
}: {
  keys: SshKey[];
  onDelete: (name: string) => void;
  onCopy: (text: string) => void;
  onGenerate: () => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (keys.length === 0) {
    return (
      <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <VpnKeyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No SSH keys found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Generate your first SSH key to get started with Git, GitHub, and remote servers
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onGenerate} sx={{ textTransform: 'none' }}>
            Generate SSH Key
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {keys.map(key => {
        const isExpanded = expandedKey === key.name;
        const algoInfo = ALGO_INFO[key.type as KeyAlgorithm];
        const color = algoInfo?.color || '#4285F4';

        return (
          <Card
            key={key.name}
            elevation={0}
            sx={{
              border: t => `1px solid ${t.palette.divider}`,
              borderRadius: 2,
              transition: 'all 0.2s',
              '&:hover': { borderColor: color },
            }}
          >
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              {/* Key Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48, height: 48, borderRadius: 2,
                      bgcolor: `${color}14`, color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <KeyIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {key.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={key.type.toUpperCase()}
                        sx={{
                          height: 20, fontSize: '0.65rem', fontWeight: 700,
                          bgcolor: `${color}18`, color,
                        }}
                      />
                      {key.bits && (
                        <Chip
                          size="small"
                          label={`${key.bits}-bit`}
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: 'grey.100', color: 'text.secondary' }}
                        />
                      )}
                    </Box>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} alignItems="center">
                      {key.fingerprint && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          <FingerprintIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                          {key.fingerprint}
                        </Typography>
                      )}
                    </Stack>
                    {key.comment && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {key.comment}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Stack direction="row" spacing={0.5}>
                  <Tooltip title={isExpanded ? 'Hide public key' : 'Show public key'}>
                    <IconButton size="small" onClick={() => setExpandedKey(isExpanded ? null : key.name)}>
                      {isExpanded ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copy public key">
                    <IconButton size="small" onClick={() => onCopy(key.publicKey)} color="primary">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete key">
                    <IconButton size="small" onClick={() => onDelete(key.name)} color="error">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>

              {/* Expanded public key */}
              {isExpanded && (
                <Box
                  sx={{
                    mt: 2, p: 2, borderRadius: 1.5,
                    bgcolor: '#1E1E1E', color: '#D4D4D4',
                    fontFamily: '"Fira Code", "Cascadia Code", monospace',
                    fontSize: '0.72rem',
                    lineHeight: 1.6,
                    wordBreak: 'break-all',
                    position: 'relative',
                  }}
                >
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => onCopy(key.publicKey)}
                    sx={{
                      position: 'absolute', top: 8, right: 8,
                      textTransform: 'none', fontSize: '0.7rem',
                      bgcolor: 'rgba(255,255,255,0.15)', color: '#fff',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                    }}
                  >
                    Copy
                  </Button>
                  {key.publicKey}
                </Box>
              )}

              {/* Usage hint */}
              {isExpanded && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: '#E8F0FE', border: '1px solid #C2D7FE' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#1A73E8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <GitHubIcon sx={{ fontSize: 14 }} /> Add to GitHub
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Go to GitHub → Settings → SSH and GPG keys → New SSH key → paste the public key above
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  AUTHORIZED KEYS TAB
// ═══════════════════════════════════════════════════════════════════════

function AuthorizedKeysTab({ toast }: { toast: (msg: string, sev?: 'success' | 'error' | 'info') => void }) {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sshKeysApi.getAuthorizedKeys();
      if (data.success) setKeys(data.keys || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    setAdding(true);
    try {
      const data = await sshKeysApi.addAuthorizedKey(newKey.trim());
      data.success ? toast('Key added to authorized_keys') : toast(data.message || 'Failed', 'error');
      if (data.success) { setNewKey(''); setAddOpen(false); }
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setAdding(false);
    load();
  };

  const handleRemove = async (index: number) => {
    if (!confirm('Remove this authorized key?')) return;
    try {
      const data = await sshKeysApi.removeAuthorizedKey(index);
      data.success ? toast('Key removed') : toast(data.message || 'Failed', 'error');
    } catch (e: any) {
      toast(e.message, 'error');
    }
    load();
  };

  const parseKeyLabel = (key: string): { type: string; comment: string; short: string } => {
    const parts = key.trim().split(/\s+/);
    const type = parts[0]?.replace('ssh-', '').toUpperCase() || 'KEY';
    const comment = parts.slice(2).join(' ') || '';
    const body = parts[1] || '';
    const short = body.length > 30 ? `${body.slice(0, 15)}...${body.slice(-15)}` : body;
    return { type, comment, short };
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <>
      <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Authorized Keys</Typography>
              <Typography variant="body2" color="text.secondary">
                Public keys authorized to SSH into this server (~/.ssh/authorized_keys)
              </Typography>
            </Box>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ textTransform: 'none' }}>
              Add Key
            </Button>
          </Box>

          {keys.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <SecurityIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No authorized keys configured</Typography>
              <Typography variant="body2" color="text.secondary">
                Add a public key to allow SSH access to this server
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {keys.map((key, i) => {
                const { type, comment, short } = parseKeyLabel(key);
                return (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                      <SecurityIcon sx={{ fontSize: 20, color: '#34A853', flexShrink: 0 }} />
                      <Chip size="small" label={type} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }} noWrap>
                        {short}
                      </Typography>
                      {comment && (
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }} noWrap>
                          {comment}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title="Remove key">
                      <IconButton size="small" color="error" onClick={() => handleRemove(i)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Add Key Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Add Authorized Key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste a public SSH key to allow its owner to connect to this server via SSH.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... user@example.com"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!newKey.trim() || adding}
            startIcon={adding ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
            sx={{ textTransform: 'none' }}>
            {adding ? 'Adding...' : 'Add Key'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GENERATE KEY DIALOG
// ═══════════════════════════════════════════════════════════════════════

function GenerateKeyDialog({
  open, onClose, onSuccess, toast,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (publicKey: string) => void;
  toast: (msg: string, sev?: 'success' | 'error' | 'info') => void;
}) {
  const [algorithm, setAlgorithm] = useState<KeyAlgorithm>('ed25519');
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [bits, setBits] = useState(4096);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ publicKey: string; fingerprint: string } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const data = await sshKeysApi.generate({
        name: name.trim() || undefined,
        algorithm,
        bits: algorithm !== 'ed25519' ? bits : undefined,
        comment: comment.trim() || undefined,
        passphrase: passphrase || undefined,
      });
      if (data.success) {
        setResult({ publicKey: data.publicKey, fingerprint: data.fingerprint });
        onSuccess(data.publicKey);
      } else {
        toast(data.message || 'Generation failed', 'error');
      }
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setGenerating(false);
  };

  const handleClose = () => {
    setResult(null);
    setName('');
    setComment('');
    setPassphrase('');
    setAlgorithm('ed25519');
    setBits(4096);
    onClose();
  };

  const copyKey = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Public key copied!', 'info');
    } catch {
      toast('Failed to copy', 'error');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <VpnKeyIcon color="primary" />
        Generate SSH Key
      </DialogTitle>
      <DialogContent>
        {!result ? (
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Algorithm Selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>Algorithm</Typography>
              <Grid container spacing={1.5}>
                {(Object.entries(ALGO_INFO) as [KeyAlgorithm, typeof ALGO_INFO['ed25519']][]).map(([algo, info]) => (
                  <Grid size={{ xs: 12, sm: 4 }} key={algo}>
                    <Card
                      elevation={0}
                      onClick={() => setAlgorithm(algo)}
                      sx={{
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: algorithm === algo ? info.color : 'divider',
                        borderRadius: 2,
                        transition: 'all 0.15s',
                        bgcolor: algorithm === algo ? `${info.color}08` : 'transparent',
                        '&:hover': { borderColor: info.color },
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: info.color }}>
                            {info.label}
                          </Typography>
                          {info.recommended && (
                            <Chip
                              size="small"
                              label="Best"
                              icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
                              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#E6F4EA', color: '#34A853' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, fontSize: '0.68rem' }}>
                          {info.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Key Name */}
            <TextField
              fullWidth size="small"
              label="Key Name"
              placeholder={`id_${algorithm}`}
              value={name}
              onChange={e => setName(e.target.value)}
              helperText={`Saved as ~/.ssh/${name || `id_${algorithm}`}`}
              sx={{ '& .MuiFormHelperText-root': { fontFamily: 'monospace', fontSize: '0.7rem' } }}
            />

            {/* Bits (for RSA/ECDSA) */}
            {algorithm === 'rsa' && (
              <FormControl fullWidth size="small">
                <InputLabel>Key Size</InputLabel>
                <Select value={bits} label="Key Size" onChange={e => setBits(Number(e.target.value))}>
                  <MenuItem value={2048}>2048 bits</MenuItem>
                  <MenuItem value={3072}>3072 bits</MenuItem>
                  <MenuItem value={4096}>4096 bits (recommended)</MenuItem>
                </Select>
              </FormControl>
            )}
            {algorithm === 'ecdsa' && (
              <FormControl fullWidth size="small">
                <InputLabel>Curve Size</InputLabel>
                <Select value={bits} label="Curve Size" onChange={e => setBits(Number(e.target.value))}>
                  <MenuItem value={256}>256 bits</MenuItem>
                  <MenuItem value={384}>384 bits</MenuItem>
                  <MenuItem value={521}>521 bits (recommended)</MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Comment */}
            <TextField
              fullWidth size="small"
              label="Comment"
              placeholder="user@server — shown at end of public key"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />

            {/* Passphrase */}
            <TextField
              fullWidth size="small"
              label="Passphrase (optional)"
              type={showPassphrase ? 'text' : 'password'}
              placeholder="Leave empty for no passphrase"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassphrase(!showPassphrase)}>
                        {showPassphrase ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Info box */}
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#FEF7E0', border: '1px solid #FDE293' }}>
              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: '#F9AB00' }}>
                <InfoOutlinedIcon sx={{ fontSize: 14 }} /> Tip
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ed25519 is the recommended algorithm for most use cases including GitHub, GitLab, and modern SSH servers. Use RSA 4096-bit only if you need compatibility with older systems.
              </Typography>
            </Box>
          </Stack>
        ) : (
          /* Result */
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: '#34A853', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Key Generated!</Typography>
            </Box>

            {result.fingerprint && (
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Fingerprint</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mt: 0.5 }}>
                  {result.fingerprint}
                </Typography>
              </Box>
            )}

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Public Key</Typography>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copyKey(result.publicKey)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                  Copy
                </Button>
              </Box>
              <Box
                sx={{
                  p: 2, borderRadius: 1.5,
                  bgcolor: '#1E1E1E', color: '#D4D4D4',
                  fontFamily: '"Fira Code", monospace',
                  fontSize: '0.72rem',
                  lineHeight: 1.6,
                  wordBreak: 'break-all',
                  maxHeight: 120,
                  overflow: 'auto',
                }}
              >
                {result.publicKey}
              </Box>
            </Box>

            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#E8F0FE', border: '1px solid #C2D7FE' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#1A73E8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GitHubIcon sx={{ fontSize: 14 }} /> Next Steps
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                1. Copy the public key above<br />
                2. Go to <strong>GitHub → Settings → SSH and GPG keys → New SSH key</strong><br />
                3. Paste the key and save
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
          {result ? 'Done' : 'Cancel'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={generating}
            startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <VpnKeyIcon />}
            sx={{ textTransform: 'none' }}
          >
            {generating ? 'Generating...' : 'Generate Key'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
