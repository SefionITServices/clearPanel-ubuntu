import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField } from '@mui/material';
import { AuthCenteredLayout } from '../layouts/auth-centered/layout';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    console.log('[Login] Attempting login for:', username);
    const ok = await login(username, password);
    setLoading(false);
    
    if (ok) {
      console.log('[Login] Success, navigating to dashboard');
      navigate('/dashboard');
    } else {
      console.error('[Login] Failed');
      setError('Invalid credentials. Check console for details.');
    }
  };

  return (
    <AuthCenteredLayout
      title="Sign in"
      description="Use admin / admin123 (default)"
    >
      <Box component="form" onSubmit={onSubmit}>
        <Stack spacing={1.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            fullWidth
            size="medium"
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            size="medium"
          />

          <Button type="submit" variant="contained" disabled={loading} sx={{ mt: 1.5 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </Box>
    </AuthCenteredLayout>
  );
}

// Inline styles removed in favor of MUI components to match template look
