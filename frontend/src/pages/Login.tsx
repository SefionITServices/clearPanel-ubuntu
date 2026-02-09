import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff, Person, Lock } from '@mui/icons-material';
import { AuthCenteredLayout } from '../layouts/auth-centered/layout';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const ok = await login(username, password);
    setLoading(false);
    
    if (ok) {
      navigate('/dashboard');
    } else {
      setError('Invalid credentials. Please check your username and password.');
    }
  };

  return (
    <AuthCenteredLayout
      title="Welcome back"
      description="Sign in to your ClearPanel account"
    >
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
    </AuthCenteredLayout>
  );
}
