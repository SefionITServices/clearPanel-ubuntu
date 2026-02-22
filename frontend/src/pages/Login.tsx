import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff, Person, Lock } from '@mui/icons-material';
import { AuthCenteredLayout } from '../layouts/auth-centered/layout';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const result = await login(username, password);
    setLoading(false);
    
    if (result === '2fa-required') {
      setTwoFactorStep(true);
    } else if (result === true) {
      navigate('/dashboard');
    } else {
      setError('Invalid credentials. Please check your username and password.');
    }
  };

  const onVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const ok = await verify2FA(totpCode);
    setLoading(false);

    if (ok) {
      navigate('/dashboard');
    } else {
      setError('Invalid verification code. Please try again.');
    }
  };

  return (
    <AuthCenteredLayout
      title={twoFactorStep ? 'Two-Factor Authentication' : 'Welcome back'}
      description={twoFactorStep ? 'Enter the code from your authenticator app' : 'Sign in to your ClearPanel account'}
    >
      {twoFactorStep ? (
        <Box component="form" onSubmit={onVerify2FA}>
          <Stack spacing={2}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            <TextField
              label="Verification Code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              fullWidth
              placeholder="000000"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                style: { fontSize: 22, letterSpacing: 6, textAlign: 'center' },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading || totpCode.length < 6}
              size="large"
              sx={{ mt: 1, py: 1.2 }}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>

            <Button
              variant="text"
              size="small"
              onClick={() => { setTwoFactorStep(false); setTotpCode(''); setError(null); }}
            >
              Back to login
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={loading || !username || !password}
            size="large"
            sx={{ mt: 1, py: 1.2 }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </Stack>
      </Box>
      )}
    </AuthCenteredLayout>
  );
}
