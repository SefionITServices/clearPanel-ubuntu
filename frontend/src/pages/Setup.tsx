import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Stepper,
    Step,
    StepLabel,
    Stack,
    Alert,
    LinearProgress,
    IconButton,
    InputAdornment,
    Collapse,
    Chip,
    CircularProgress,
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    CheckCircle,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface SetupConfig {
    adminUsername: string;
    adminPassword: string;
    confirmPassword: string;
    serverIp: string;
    primaryDomain?: string;
    nameservers?: string;
    sessionSecret?: string;
    rootPath?: string;
    domainsRoot?: string;
    port?: number;
    maxFileSize?: number;
}

const steps = ['Welcome', 'Admin Account', 'Server Configuration', 'Advanced Settings', 'Review'];

export default function SetupPage() {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [detectingIp, setDetectingIp] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [config, setConfig] = useState<SetupConfig>({
        adminUsername: '',
        adminPassword: '',
        confirmPassword: '',
        serverIp: '',
        primaryDomain: '',
        nameservers: '',
        sessionSecret: '',
        rootPath: '/opt/clearpanel/data',
        domainsRoot: '~/clearpanel-domains',
        port: 3334,
        maxFileSize: 104857600,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Auto-detect server IP on mount
    useEffect(() => {
        detectServerIp();
    }, []);

    // Generate session secret on mount
    useEffect(() => {
        generateSessionSecret();
    }, []);

    // Load from localStorage on mount (recovery)
    useEffect(() => {
        const saved = localStorage.getItem('setupConfig');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setConfig(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error('Failed to load saved config:', e);
            }
        }
    }, []);

    // Save to localStorage on config change
    useEffect(() => {
        localStorage.setItem('setupConfig', JSON.stringify(config));
    }, [config]);

    const detectServerIp = async () => {
        if (config.serverIp) return; // Already set

        setDetectingIp(true);
        try {
            const response = await fetch('/api/setup/detect-ip');
            const data = await response.json();
            if (data.ip) {
                setConfig(prev => ({ ...prev, serverIp: data.ip }));
            }
        } catch (err) {
            console.error('Failed to detect IP:', err);
        } finally {
            setDetectingIp(false);
        }
    };

    const generateSessionSecret = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const secret = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        setConfig(prev => ({ ...prev, sessionSecret: secret }));
    };

    const validateStep = (step: number): boolean => {
        const newErrors: Record<string, string> = {};

        switch (step) {
            case 1: // Admin Account
                if (!config.adminUsername) {
                    newErrors.adminUsername = 'Username is required';
                } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(config.adminUsername)) {
                    newErrors.adminUsername = 'Username must be 3-20 characters (alphanumeric and underscore only)';
                }

                if (!config.adminPassword) {
                    newErrors.adminPassword = 'Password is required';
                } else if (config.adminPassword.length < 8) {
                    newErrors.adminPassword = 'Password must be at least 8 characters';
                }

                if (config.adminPassword !== config.confirmPassword) {
                    newErrors.confirmPassword = 'Passwords do not match';
                }
                break;

            case 2: // Server Configuration
                if (!config.serverIp) {
                    newErrors.serverIp = 'Server IP is required';
                } else if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(config.serverIp)) {
                    newErrors.serverIp = 'Invalid IPv4 address format';
                }
                break;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(activeStep)) {
            setActiveStep(prev => prev + 1);
            setError(null);
        }
    };

    const handleBack = () => {
        setActiveStep(prev => prev - 1);
        setError(null);
    };

    const handleComplete = async () => {
        setLoading(true);
        setError(null);

        try {
            const payload = {
                adminUsername: config.adminUsername,
                adminPassword: config.adminPassword,
                serverIp: config.serverIp,
                primaryDomain: config.primaryDomain || undefined,
                nameservers: config.nameservers ? config.nameservers.split(/\r?\n|,/).map(ns => ns.trim()).filter(ns => ns.length > 0) : undefined,
                sessionSecret: config.sessionSecret,
                rootPath: config.rootPath,
                domainsRoot: config.domainsRoot,
                port: config.port,
                maxFileSize: config.maxFileSize,
            };

            const response = await fetch('/api/setup/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Setup failed');
            }

            setSuccess(true);
            localStorage.removeItem('setupConfig'); // Clear saved config

            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Setup failed. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
        if (!password) return { strength: 0, label: '', color: '' };

        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        if (strength <= 2) return { strength: 33, label: 'Weak', color: 'error' };
        if (strength <= 4) return { strength: 66, label: 'Medium', color: 'warning' };
        return { strength: 100, label: 'Strong', color: 'success' };
    };

    const passwordStrength = getPasswordStrength(config.adminPassword);

    const renderStepContent = (step: number) => {
        switch (step) {
            case 0: // Welcome
                return (
                    <Stack spacing={3}>
                        <Typography variant="h4" fontWeight={600}>
                            Welcome to clearPanel
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Let's get your control panel set up. This wizard will guide you through the initial configuration.
                        </Typography>
                        <Alert severity="info">
                            <Typography variant="body2">
                                This setup wizard will collect mandatory information needed to run clearPanel:
                            </Typography>
                            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                                <li>Administrator credentials</li>
                                <li>Server IP address</li>
                                <li>Optional: Primary domain and nameservers</li>
                            </ul>
                        </Alert>
                        {detectingIp && (
                            <Box display="flex" alignItems="center" gap={1}>
                                <CircularProgress size={20} />
                                <Typography variant="body2" color="text.secondary">
                                    Detecting server IP address...
                                </Typography>
                            </Box>
                        )}
                        {config.serverIp && !detectingIp && (
                            <Alert severity="success">
                                Server IP detected: <strong>{config.serverIp}</strong>
                            </Alert>
                        )}
                    </Stack>
                );

            case 1: // Admin Account
                return (
                    <Stack spacing={3}>
                        <Typography variant="h5" fontWeight={600}>
                            Create Admin Account
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            This will be your login credentials for the control panel.
                        </Typography>

                        <TextField
                            label="Admin Username"
                            required
                            fullWidth
                            value={config.adminUsername}
                            onChange={e => setConfig(prev => ({ ...prev, adminUsername: e.target.value }))}
                            error={!!errors.adminUsername}
                            helperText={errors.adminUsername || '3-20 characters, alphanumeric and underscore only'}
                            autoComplete="username"
                        />

                        <TextField
                            label="Admin Password"
                            required
                            fullWidth
                            type={showPassword ? 'text' : 'password'}
                            value={config.adminPassword}
                            onChange={e => setConfig(prev => ({ ...prev, adminPassword: e.target.value }))}
                            error={!!errors.adminPassword}
                            helperText={errors.adminPassword || 'At least 8 characters'}
                            autoComplete="new-password"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {config.adminPassword && (
                            <Box>
                                <Box display="flex" justifyContent="space-between" mb={0.5}>
                                    <Typography variant="caption">Password Strength</Typography>
                                    <Typography variant="caption" color={`${passwordStrength.color}.main`}>
                                        {passwordStrength.label}
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={passwordStrength.strength}
                                    color={passwordStrength.color as any}
                                />
                            </Box>
                        )}

                        <TextField
                            label="Confirm Password"
                            required
                            fullWidth
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={config.confirmPassword}
                            onChange={e => setConfig(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            error={!!errors.confirmPassword}
                            helperText={errors.confirmPassword}
                            autoComplete="new-password"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Stack>
                );

            case 2: // Server Configuration
                return (
                    <Stack spacing={3}>
                        <Typography variant="h5" fontWeight={600}>
                            Server Configuration
                        </Typography>

                        <TextField
                            label="Server IP Address"
                            required
                            fullWidth
                            value={config.serverIp}
                            onChange={e => setConfig(prev => ({ ...prev, serverIp: e.target.value }))}
                            error={!!errors.serverIp}
                            helperText={errors.serverIp || 'Public IPv4 address of this server'}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={detectServerIp} edge="end" disabled={detectingIp}>
                                            <RefreshIcon />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <TextField
                            label="Primary Domain (Optional)"
                            fullWidth
                            value={config.primaryDomain}
                            onChange={e => setConfig(prev => ({ ...prev, primaryDomain: e.target.value }))}
                            placeholder="panel.example.com"
                            helperText="The main domain for accessing this panel"
                        />

                        <TextField
                            label="Nameservers (Optional)"
                            fullWidth
                            multiline
                            minRows={3}
                            value={config.nameservers}
                            onChange={e => setConfig(prev => ({ ...prev, nameservers: e.target.value }))}
                            placeholder="ns1.example.com&#10;ns2.example.com"
                            helperText="One nameserver per line or comma-separated"
                        />
                    </Stack>
                );

            case 3: // Advanced Settings
                return (
                    <Stack spacing={3}>
                        <Typography variant="h5" fontWeight={600}>
                            Advanced Settings
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            These settings have sensible defaults. Only modify if needed.
                        </Typography>

                        <TextField
                            label="Session Secret"
                            fullWidth
                            value={config.sessionSecret}
                            onChange={e => setConfig(prev => ({ ...prev, sessionSecret: e.target.value }))}
                            helperText="Auto-generated secure random string"
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={generateSessionSecret} edge="end">
                                            <RefreshIcon />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <TextField
                            label="File Manager Root Path"
                            fullWidth
                            value={config.rootPath}
                            onChange={e => setConfig(prev => ({ ...prev, rootPath: e.target.value }))}
                            helperText="Base directory for file manager"
                        />

                        <TextField
                            label="Domains Root Path"
                            fullWidth
                            value={config.domainsRoot}
                            onChange={e => setConfig(prev => ({ ...prev, domainsRoot: e.target.value }))}
                            helperText="Directory where domain folders will be created"
                        />

                        <TextField
                            label="Application Port"
                            fullWidth
                            type="number"
                            value={config.port}
                            onChange={e => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                            helperText="Port for the backend server"
                        />

                        <TextField
                            label="Max File Upload Size (bytes)"
                            fullWidth
                            type="number"
                            value={config.maxFileSize}
                            onChange={e => setConfig(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) }))}
                            helperText={`${Math.round((config.maxFileSize || 0) / 1024 / 1024)}MB - Maximum file size for uploads`}
                        />
                    </Stack>
                );

            case 4: // Review
                return (
                    <Stack spacing={3}>
                        <Typography variant="h5" fontWeight={600}>
                            Review Configuration
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Please review your configuration before completing setup.
                        </Typography>

                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                    Admin Account
                                </Typography>
                                <Typography variant="body2">Username: <strong>{config.adminUsername}</strong></Typography>
                                <Typography variant="body2">Password: <strong>{'•'.repeat(config.adminPassword.length)}</strong></Typography>
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                    Server Configuration
                                </Typography>
                                <Typography variant="body2">Server IP: <strong>{config.serverIp}</strong></Typography>
                                {config.primaryDomain && (
                                    <Typography variant="body2">Primary Domain: <strong>{config.primaryDomain}</strong></Typography>
                                )}
                                {config.nameservers && (
                                    <Typography variant="body2">
                                        Nameservers: <strong>{config.nameservers.split(/\r?\n|,/).filter(ns => ns.trim()).length} configured</strong>
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                    Paths & Settings
                                </Typography>
                                <Typography variant="body2">File Manager Root: <strong>{config.rootPath}</strong></Typography>
                                <Typography variant="body2">Domains Root: <strong>{config.domainsRoot}</strong></Typography>
                                <Typography variant="body2">Port: <strong>{config.port}</strong></Typography>
                                <Typography variant="body2">
                                    Max Upload Size: <strong>{Math.round((config.maxFileSize || 0) / 1024 / 1024)}MB</strong>
                                </Typography>
                            </CardContent>
                        </Card>
                    </Stack>
                );

            default:
                return null;
        }
    };

    if (success) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                    p: 2,
                }}
            >
                <Card sx={{ maxWidth: 500, width: '100%' }}>
                    <CardContent>
                        <Stack spacing={3} alignItems="center">
                            <CheckCircle color="success" sx={{ fontSize: 80 }} />
                            <Typography variant="h4" fontWeight={600} textAlign="center">
                                Setup Complete!
                            </Typography>
                            <Typography variant="body1" color="text.secondary" textAlign="center">
                                Your control panel has been configured successfully. Redirecting to login...
                            </Typography>
                            <CircularProgress />
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: 'background.default',
                p: 2,
            }}
        >
            <Box sx={{ maxWidth: 800, mx: 'auto', py: 4 }}>
                <Card>
                    <CardContent sx={{ p: 4 }}>
                        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        <Box sx={{ minHeight: 300 }}>
                            {renderStepContent(activeStep)}
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                            <Button
                                disabled={activeStep === 0 || loading}
                                onClick={handleBack}
                            >
                                Back
                            </Button>
                            <Box sx={{ flex: 1 }} />
                            {activeStep < steps.length - 1 ? (
                                <Button
                                    variant="contained"
                                    onClick={handleNext}
                                    disabled={loading}
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={handleComplete}
                                    disabled={loading}
                                    startIcon={loading && <CircularProgress size={20} />}
                                >
                                    {loading ? 'Completing Setup...' : 'Complete Setup'}
                                </Button>
                            )}
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
