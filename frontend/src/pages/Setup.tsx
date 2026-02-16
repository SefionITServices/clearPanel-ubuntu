import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Paper,
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
    Divider,
    CircularProgress,
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    CheckCircle,
    Refresh as RefreshIcon,
    Language,
    Dns,
    Person,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface SetupConfig {
    adminUsername: string;
    adminPassword: string;
    confirmPassword: string;
    serverIp: string;
    primaryDomain: string;
    ns1: string;
    ns2: string;
    sessionSecret: string;
    rootPath: string;
    port: number;
    maxFileSize: number;
}

const steps = ['Welcome', 'Admin Account', 'Domain & Nameservers', 'Review & Complete'];

export default function SetupPage() {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [detectingIp, setDetectingIp] = useState(false);
    const [ipDetectFailed, setIpDetectFailed] = useState(false);

    const [config, setConfig] = useState<SetupConfig>({
        adminUsername: '',
        adminPassword: '',
        confirmPassword: '',
        serverIp: '',
        primaryDomain: '',
        ns1: '',
        ns2: '',
        sessionSecret: '',
        rootPath: '/home',
        port: 3334,
        maxFileSize: 104857600,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Check if already set up
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/setup/status');
                const data = await res.json();
                if (data.completed) {
                    navigate('/login', { replace: true });
                    return;
                }
            } catch { }
            setCheckingStatus(false);
        })();
    }, [navigate]);

    // Auto-detect IP on mount
    useEffect(() => {
        if (!checkingStatus) detectServerIp();
    }, [checkingStatus]);

    // Generate session secret on mount
    useEffect(() => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const secret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
        setConfig(prev => ({ ...prev, sessionSecret: secret }));
    }, []);

    const detectServerIp = async () => {
        setDetectingIp(true);
        setIpDetectFailed(false);
        try {
            const res = await fetch('/api/setup/detect-ip');
            const data = await res.json();
            if (data.ip) {
                setConfig(prev => ({ ...prev, serverIp: data.ip }));
            } else {
                setIpDetectFailed(true);
            }
        } catch {
            setIpDetectFailed(true);
        }
        setDetectingIp(false);
    };

    const validateStep = (step: number): boolean => {
        const e: Record<string, string> = {};

        if (step === 1) {
            if (!config.adminUsername) e.adminUsername = 'Username is required';
            else if (!/^[a-zA-Z0-9_]{3,20}$/.test(config.adminUsername))
                e.adminUsername = 'Must be 3-20 characters (letters, numbers, underscore)';

            if (!config.adminPassword) e.adminPassword = 'Password is required';
            else if (config.adminPassword.length < 8) e.adminPassword = 'Must be at least 8 characters';

            if (config.adminPassword !== config.confirmPassword)
                e.confirmPassword = 'Passwords do not match';
        }

        if (step === 2) {
            if (!config.serverIp) e.serverIp = 'Server IP is required';
            else if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(config.serverIp))
                e.serverIp = 'Invalid IP address';

            if (!config.primaryDomain) e.primaryDomain = 'Primary domain is required';
            else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(config.primaryDomain))
                e.primaryDomain = 'Invalid domain format';
        }

        setErrors(e);
        return Object.keys(e).length === 0;
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
            const nameservers = [config.ns1, config.ns2].map(ns => ns.trim()).filter(ns => ns.length > 0);
            const payload = {
                adminUsername: config.adminUsername,
                adminPassword: config.adminPassword,
                serverIp: config.serverIp,
                primaryDomain: config.primaryDomain,
                nameservers: nameservers.length > 0 ? nameservers : undefined,
                sessionSecret: config.sessionSecret,
                rootPath: config.rootPath,
                port: config.port,
                maxFileSize: config.maxFileSize,
            };

            const res = await fetch('/api/setup/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await res.json();

            if (!res.ok || !result.success) throw new Error(result.message || 'Setup failed');
            setSuccess(true);

            // The server auto-restarts after setup; wait a moment then redirect to dashboard
            // The session is already authenticated (server auto-logged us in)
            setTimeout(() => {
                window.location.href = '/';
            }, 8000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Setup failed');
        } finally {
            setLoading(false);
        }
    };

    const getPasswordStrength = (pw: string) => {
        if (!pw) return { strength: 0, label: '', color: 'inherit' as const };
        let s = 0;
        if (pw.length >= 8) s++;
        if (pw.length >= 12) s++;
        if (/[a-z]/.test(pw)) s++;
        if (/[A-Z]/.test(pw)) s++;
        if (/\d/.test(pw)) s++;
        if (/[^a-zA-Z0-9]/.test(pw)) s++;
        if (s <= 2) return { strength: 33, label: 'Weak', color: 'error' as const };
        if (s <= 4) return { strength: 66, label: 'Medium', color: 'warning' as const };
        return { strength: 100, label: 'Strong', color: 'success' as const };
    };

    const pwStrength = getPasswordStrength(config.adminPassword);

    if (checkingStatus) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eaf6 50%, #c5cae9 100%)' }}>
                <CircularProgress sx={{ color: '#4285F4' }} />
            </Box>
        );
    }

    // ---- SUCCESS SCREEN ----
    if (success) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eaf6 50%, #c5cae9 100%)', p: 2 }}>
                <Card sx={{ maxWidth: 680, width: '100%', borderRadius: 3, boxShadow: '0 8px 40px rgba(66,133,244,0.12)' }}>
                    <CardContent sx={{ p: 4 }}>
                        <Stack spacing={3} alignItems="center">
                            <CheckCircle sx={{ fontSize: 80, color: '#34A853' }} />
                            <Typography variant="h4" fontWeight={700} textAlign="center">
                                Setup Complete!
                            </Typography>

                            <Alert severity="info" sx={{ width: '100%', borderRadius: 2 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    The server is restarting to apply your configuration...
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    You'll be redirected to the dashboard in a few seconds.
                                </Typography>
                                <CircularProgress size={16} sx={{ mt: 1, color: '#4285F4' }} />
                            </Alert>

                            {config.primaryDomain && (
                                <Alert severity="info" sx={{ width: '100%', borderRadius: 2 }}>
                                    <Typography variant="body2" fontWeight={600} gutterBottom>
                                        DNS Setup for {config.primaryDomain}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and update:
                                    </Typography>
                                    <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                                        <li>
                                            <Typography variant="body2">
                                                Set <strong>A record</strong> for <strong>{config.primaryDomain}</strong> &rarr; <strong>{config.serverIp}</strong>
                                            </Typography>
                                        </li>
                                        {config.ns1 && (
                                            <>
                                                <li>
                                                    <Typography variant="body2">
                                                        Create <strong>Glue records</strong> (Child Nameservers) at your registrar:
                                                    </Typography>
                                                    <Box sx={{ ml: 2, fontFamily: 'monospace', fontSize: '0.85em', mt: 0.5 }}>
                                                        <Typography variant="body2" fontFamily="monospace">{config.ns1} &rarr; {config.serverIp}</Typography>
                                                        <Typography variant="body2" fontFamily="monospace">{config.ns2} &rarr; {config.serverIp}</Typography>
                                                    </Box>
                                                </li>
                                                <li>
                                                    <Typography variant="body2">
                                                        Update <strong>Nameservers</strong> to: <strong>{config.ns1}</strong> and <strong>{config.ns2}</strong>
                                                    </Typography>
                                                </li>
                                            </>
                                        )}
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                                        DNS propagation may take 1-48 hours.
                                    </Typography>
                                </Alert>
                            )}

                            <Paper variant="outlined" sx={{ width: '100%', borderRadius: 2, p: 2.5 }}>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Login Credentials</Typography>
                                <Typography variant="body2">Username: <strong>{config.adminUsername}</strong></Typography>
                                <Typography variant="body2">Password: <strong>{'*'.repeat(Math.min(config.adminPassword.length, 12))}</strong></Typography>
                            </Paper>

                            <Button variant="contained" size="large" onClick={() => window.location.href = '/'} sx={{ borderRadius: 2, px: 4 }}>
                                Go to Dashboard
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    // ---- WIZARD STEPS ----
    const renderStep = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <Stack spacing={3}>
                        <Typography variant="h4" fontWeight={700}>Welcome to clearPanel</Typography>
                        <Typography variant="body1" color="text.secondary">
                            Let's set up your VPS control panel. This wizard will configure everything needed to get your server running.
                        </Typography>
                        <Stack spacing={1.5}>
                            {[
                                { icon: <Person fontSize="small" />, text: 'Create admin account (username & password)' },
                                { icon: <Language fontSize="small" />, text: 'Set your primary domain and document root' },
                                { icon: <Dns fontSize="small" />, text: 'Configure custom nameservers for your VPS' },
                            ].map((item, i) => (
                                <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
                                    <Box sx={{ color: 'primary.main' }}>{item.icon}</Box>
                                    <Typography variant="body2">{item.text}</Typography>
                                </Stack>
                            ))}
                        </Stack>
                        {detectingIp && (
                            <Box display="flex" alignItems="center" gap={1}>
                                <CircularProgress size={18} />
                                <Typography variant="body2" color="text.secondary">Detecting server IP...</Typography>
                            </Box>
                        )}
                        {config.serverIp && !detectingIp && (
                            <Alert severity="success" icon={false}>
                                Server IP detected: <strong>{config.serverIp}</strong>
                            </Alert>
                        )}
                        {ipDetectFailed && !config.serverIp && !detectingIp && (
                            <Alert severity="warning" icon={false}>
                                Could not auto-detect server IP. You can enter it manually in the next step.
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                    Run <code>curl ifconfig.me</code> or <code>hostname -I</code> on your server to find your IP.
                                </Typography>
                            </Alert>
                        )}
                    </Stack>
                );

            case 1:
                return (
                    <Stack spacing={3}>
                        <Typography variant="h5" fontWeight={600}>Create Admin Account</Typography>
                        <Typography variant="body2" color="text.secondary">
                            These credentials will be used to log in to the control panel.
                        </Typography>
                        <TextField
                            label="Username" required fullWidth
                            value={config.adminUsername}
                            onChange={e => setConfig(p => ({ ...p, adminUsername: e.target.value }))}
                            error={!!errors.adminUsername}
                            helperText={errors.adminUsername || 'Letters, numbers, and underscore only'}
                            autoComplete="username"
                        />
                        <TextField
                            label="Password" required fullWidth
                            type={showPassword ? 'text' : 'password'}
                            value={config.adminPassword}
                            onChange={e => setConfig(p => ({ ...p, adminPassword: e.target.value }))}
                            error={!!errors.adminPassword}
                            helperText={errors.adminPassword || 'Minimum 8 characters'}
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
                                    <Typography variant="caption" color={`${pwStrength.color}.main`}>{pwStrength.label}</Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={pwStrength.strength} color={pwStrength.color} />
                            </Box>
                        )}
                        <TextField
                            label="Confirm Password" required fullWidth
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={config.confirmPassword}
                            onChange={e => setConfig(p => ({ ...p, confirmPassword: e.target.value }))}
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

            case 2:
                return (
                    <Stack spacing={3}>
                        <Typography variant="h5" fontWeight={600}>Domain & Nameservers</Typography>

                        <TextField
                            label="Server IP Address" required fullWidth
                            value={config.serverIp}
                            onChange={e => setConfig(p => ({ ...p, serverIp: e.target.value }))}
                            error={!!errors.serverIp}
                            helperText={errors.serverIp || (ipDetectFailed && !config.serverIp ? 'Auto-detect failed — enter your VPS public IP manually' : 'Public IPv4 address of this VPS')}
                            placeholder={ipDetectFailed ? 'e.g. 185.199.108.10' : ''}
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

                        <Divider />

                        <TextField
                            label="Primary Domain" required fullWidth
                            value={config.primaryDomain}
                            onChange={e => {
                                const d = e.target.value;
                                setConfig(p => ({ ...p, primaryDomain: d, ns1: d ? `ns1.${d}` : '', ns2: d ? `ns2.${d}` : '' }));
                            }}
                            error={!!errors.primaryDomain}
                            helperText={errors.primaryDomain || 'Your main domain (e.g. example.com). Document root: ~/public_html'}
                            placeholder="example.com"
                        />

                        <Alert severity="info" icon={false}>
                            <Typography variant="body2" fontWeight={600} gutterBottom>Custom Nameservers</Typography>
                            <Typography variant="body2">
                                These let you host DNS for all your domains on this VPS. After setup, create <strong>Glue records</strong> (Child Nameservers) at your domain registrar pointing these to <strong>{config.serverIp || 'your server IP'}</strong>.
                            </Typography>
                        </Alert>

                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Nameserver 1" fullWidth
                                value={config.ns1}
                                onChange={e => setConfig(p => ({ ...p, ns1: e.target.value }))}
                                placeholder="ns1.example.com"
                            />
                            <TextField
                                label="Nameserver 2" fullWidth
                                value={config.ns2}
                                onChange={e => setConfig(p => ({ ...p, ns2: e.target.value }))}
                                placeholder="ns2.example.com"
                            />
                        </Stack>
                    </Stack>
                );

            case 3:
                return (
                    <Stack spacing={3}>
                        <Typography variant="h5" fontWeight={600}>Review & Complete</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Review your configuration. The server will apply changes automatically after setup.
                        </Typography>

                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Admin Account</Typography>
                                <Typography variant="body2">Username: <strong>{config.adminUsername}</strong></Typography>
                                <Typography variant="body2">Password: <strong>{'*'.repeat(Math.min(config.adminPassword.length, 12))}</strong></Typography>
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Server & Domain</Typography>
                                <Typography variant="body2">Server IP: <strong>{config.serverIp}</strong></Typography>
                                <Typography variant="body2">Primary Domain: <strong>{config.primaryDomain}</strong></Typography>
                                <Typography variant="body2">Document Root: <strong>~/{config.adminUsername}/public_html</strong></Typography>
                                {config.ns1 && (
                                    <Typography variant="body2">
                                        Nameservers: <strong>{config.ns1}</strong>, <strong>{config.ns2}</strong>
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>

                        <Alert severity="info">
                            <Typography variant="body2">
                                After setup completes, your home directory will be created with cPanel-like folders
                                (public_html, mail, logs, ssl, etc.) and a default index.html for your primary domain.
                            </Typography>
                        </Alert>

                        <Alert severity="warning">
                            <Typography variant="body2" fontWeight={600}>
                                After setup, you'll need to update DNS at your domain registrar.
                            </Typography>
                        </Alert>
                    </Stack>
                );

            default:
                return null;
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f0f4ff', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eaf6 50%, #c5cae9 100%)', p: 2 }}>
            <Box sx={{ maxWidth: 720, mx: 'auto', py: 4 }}>
                {/* Logo */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <Box sx={{
                        width: 56, height: 56, borderRadius: 2,
                        background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 20px rgba(66,133,244,0.3)',
                    }}>
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>CP</Typography>
                    </Box>
                </Box>

                <Card sx={{ borderRadius: 3, boxShadow: '0 8px 40px rgba(66,133,244,0.12)' }}>
                    <CardContent sx={{ p: 4 }}>
                        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
                            {steps.map(label => (
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

                        <Box sx={{ minHeight: 320 }}>
                            {renderStep(activeStep)}
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                            <Button disabled={activeStep === 0 || loading} onClick={handleBack}>
                                Back
                            </Button>
                            <Box flex={1} />
                            {activeStep < steps.length - 1 ? (
                                <Button variant="contained" onClick={handleNext}>Next</Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={handleComplete}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
                                >
                                    {loading ? 'Setting up...' : 'Complete Setup'}
                                </Button>
                            )}
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
