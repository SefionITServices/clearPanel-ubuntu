import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack,
  TextField, Alert, CircularProgress, Chip, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stepper, Step, StepLabel, Grid,
} from '@mui/material';
import {
  Security, ContentCopy, Refresh, LockOpen,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { twoFactorApi } from '../api/twoFactor';

/* ═══════════════════════════════════════════════════════════ */

export default function TwoFactor() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [enabledAt, setEnabledAt] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);

  // Setup flow
  const [setupStep, setSetupStep] = useState(0);
  const [secret, setSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [setupLoading, setSetupLoading] = useState(false);

  // Disable dialog
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  // Regenerate codes dialog
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenCodes, setRegenCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await twoFactorApi.getStatus();
      setEnabled(data.enabled);
      setEnabledAt(data.enabledAt || null);
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── Setup Flow ───────────────────────────────────────── */

  const handleStartSetup = async () => {
    try {
      setSetupLoading(true);
      const data = await twoFactorApi.setup();
      setSecret(data.secret);
      setOtpauthUri(data.otpauthUri);
      setSetupStep(1);
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    } finally { setSetupLoading(false); }
  };

  const handleVerifyAndEnable = async () => {
    try {
      setSetupLoading(true);
      const data = await twoFactorApi.enable(verifyToken);
      if (data.success) {
        setRecoveryCodes(data.recoveryCodes || []);
        setSetupStep(3);
        setEnabled(true);
        setToast({ msg: '2FA enabled!', sev: 'success' });
      } else {
        setToast({ msg: data.message || 'Verification failed', sev: 'error' });
      }
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    } finally { setSetupLoading(false); }
  };

  const handleDisable = async () => {
    try {
      const data = await twoFactorApi.disable(disablePassword);
      if (data.success) {
        setEnabled(false);
        setSetupStep(0);
        setSecret('');
        setOtpauthUri('');
        setRecoveryCodes([]);
        setToast({ msg: '2FA disabled', sev: 'success' });
      } else {
        setToast({ msg: data.message, sev: 'error' });
      }
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    }
    setDisableOpen(false);
    setDisablePassword('');
  };

  const handleRegenCodes = async () => {
    try {
      const data = await twoFactorApi.regenerateCodes();
      if (data.success) {
        setRegenCodes(data.recoveryCodes || []);
        setRegenOpen(true);
      } else {
        setToast({ msg: data.message, sev: 'error' });
      }
    } catch (e: any) {
      setToast({ msg: e.message, sev: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ msg: 'Copied to clipboard', sev: 'info' });
  };

  /* ─── Render ───────────────────────────────────────────── */

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={700}>Two-Factor Authentication</Typography>
          <Chip
            icon={<Security />}
            label={enabled ? 'Enabled' : 'Disabled'}
            color={enabled ? 'success' : 'default'}
            variant="outlined"
          />
        </Stack>

        {toast && (
          <Alert severity={toast.sev} onClose={() => setToast(null)} sx={{ mb: 2 }}>{toast.msg}</Alert>
        )}

        {/* ═══ 2FA Enabled State ══════════════════════════════ */}
        {enabled && setupStep !== 3 && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Two-factor authentication is active</Typography>
                {enabledAt && (
                  <Typography variant="body2" color="text.secondary">
                    Enabled on {new Date(enabledAt).toLocaleDateString()}
                  </Typography>
                )}
                <Typography variant="body2">
                  Your account is protected with a time-based one-time password (TOTP).
                  You will be asked for a verification code from your authenticator app when logging in.
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" startIcon={<Refresh />} onClick={handleRegenCodes}>
                    Regenerate Recovery Codes
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<LockOpen />}
                    onClick={() => setDisableOpen(true)}>
                    Disable 2FA
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ═══ 2FA Setup Flow ════════════════════════════════ */}
        {!enabled && setupStep === 0 && (
          <Card>
            <CardContent>
              <Stack spacing={2} alignItems="flex-start">
                <Typography variant="h6">Set up two-factor authentication</Typography>
                <Typography variant="body2" color="text.secondary">
                  Add an extra layer of security to your account. You'll need an authenticator app
                  like Google Authenticator, Authy, or 1Password.
                </Typography>
                <Button variant="contained" startIcon={<Security />}
                  disabled={setupLoading} onClick={handleStartSetup}>
                  {setupLoading ? <CircularProgress size={20} /> : 'Begin Setup'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {(setupStep >= 1 && setupStep <= 3) && (
          <Card sx={{ mt: enabled ? 0 : 0 }}>
            <CardContent>
              <Stepper activeStep={setupStep - 1} sx={{ mb: 3 }}>
                <Step><StepLabel>Scan QR Code</StepLabel></Step>
                <Step><StepLabel>Verify Code</StepLabel></Step>
                <Step><StepLabel>Save Recovery Codes</StepLabel></Step>
              </Stepper>

              {/* Step 1: QR Code */}
              {setupStep === 1 && (
                <Stack spacing={2}>
                  <Typography variant="body1" fontWeight={600}>
                    Scan this QR code with your authenticator app:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', maxWidth: 400 }}>
                    {/* Use Google Charts API to render QR code (no extra deps) */}
                    <Box
                      component="img"
                      src={`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(otpauthUri)}&choe=UTF-8`}
                      alt="2FA QR Code"
                      sx={{ width: 200, height: 200 }}
                    />
                  </Paper>
                  <Typography variant="body2" color="text.secondary">
                    Or enter this secret key manually:
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1" fontFamily="monospace" fontWeight={700}
                      sx={{ letterSpacing: 2 }}>
                      {secret}
                    </Typography>
                    <Button size="small" startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(secret)}>
                      Copy
                    </Button>
                  </Stack>
                  <Button variant="contained" onClick={() => setSetupStep(2)}>
                    Next: Verify Code
                  </Button>
                </Stack>
              )}

              {/* Step 2: Verify */}
              {setupStep === 2 && (
                <Stack spacing={2} maxWidth={400}>
                  <Typography variant="body1" fontWeight={600}>
                    Enter the 6-digit code from your authenticator app:
                  </Typography>
                  <TextField
                    fullWidth
                    value={verifyToken}
                    onChange={e => setVerifyToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    slotProps={{
                      input: {
                        style: { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontFamily: 'monospace' },
                      },
                    }}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && verifyToken.length === 6 && handleVerifyAndEnable()}
                  />
                  <Stack direction="row" spacing={2}>
                    <Button onClick={() => setSetupStep(1)}>Back</Button>
                    <Button variant="contained"
                      disabled={verifyToken.length !== 6 || setupLoading}
                      onClick={handleVerifyAndEnable}>
                      {setupLoading ? <CircularProgress size={20} /> : 'Verify & Enable'}
                    </Button>
                  </Stack>
                </Stack>
              )}

              {/* Step 3: Recovery Codes */}
              {setupStep === 3 && (
                <Stack spacing={2}>
                  <Alert severity="warning">
                    Save these recovery codes in a safe place. Each code can only be used once.
                    If you lose access to your authenticator app, these codes are the only way to log in.
                  </Alert>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={1}>
                      {recoveryCodes.map((code, i) => (
                        <Grid size={{ xs: 6, sm: 3 }} key={i}>
                          <Typography fontFamily="monospace" fontSize={14} textAlign="center">
                            {code}
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                  <Button size="small" startIcon={<ContentCopy />}
                    onClick={() => copyToClipboard(recoveryCodes.join('\n'))}>
                    Copy All Codes
                  </Button>
                  <Button variant="contained" onClick={() => { setSetupStep(0); load(); }}>
                    Done
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ Disable Dialog ═════════════════════════════════ */}
        <Dialog open={disableOpen} onClose={() => setDisableOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogContent>
            <Typography mb={2}>Enter your password to disable 2FA:</Typography>
            <TextField fullWidth type="password" label="Password"
              value={disablePassword} onChange={e => setDisablePassword(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && disablePassword && handleDisable()}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDisableOpen(false)}>Cancel</Button>
            <Button color="error" variant="contained" disabled={!disablePassword}
              onClick={handleDisable}>
              Disable 2FA
            </Button>
          </DialogActions>
        </Dialog>

        {/* ═══ Regenerated Codes Dialog ═══════════════════════ */}
        <Dialog open={regenOpen} onClose={() => setRegenOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>New Recovery Codes</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Your previous recovery codes have been invalidated. Save these new codes.
            </Alert>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={1}>
                {regenCodes.map((code, i) => (
                  <Grid size={{ xs: 6, sm: 3 }} key={i}>
                    <Typography fontFamily="monospace" fontSize={14} textAlign="center">
                      {code}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </DialogContent>
          <DialogActions>
            <Button startIcon={<ContentCopy />}
              onClick={() => copyToClipboard(regenCodes.join('\n'))}>
              Copy All
            </Button>
            <Button variant="contained" onClick={() => setRegenOpen(false)}>Done</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
