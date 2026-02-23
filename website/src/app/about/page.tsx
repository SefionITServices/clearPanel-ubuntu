'use client';
import NextLink from 'next/link';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Grid,
    Stack,
    Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const PHASE_ITEMS = [
    { phase: 'Phase 1', title: 'Core Foundation', status: 'complete', items: ['Authentication + Setup Wizard', 'File Manager + Terminal', 'Domain, DNS, Nginx, SSL, PHP', 'Email Stack (Postfix/Dovecot/DKIM/DMARC)', 'MySQL/MariaDB/PostgreSQL Databases', 'App Store + Logs', 'Cron Jobs + Firewall + Monitoring', 'Backup & Restore + 2FA + Process Manager'] },
    { phase: 'Phase 2', title: 'Pro Panel Parity', status: 'planned', items: ['FTP Account Manager', 'Subdomain & Redirect Manager', 'Auto-responders & Mailing Lists', 'Spam Filter UI', 'Remote MySQL + DB Import/Export'] },
    { phase: 'Phase 3', title: 'Competitive Edge', status: 'future', items: ['Docker Manager', 'Git Push-to-Deploy', 'Node.js/Python App Manager', 'Bandwidth Monitoring', 'Cloudflare Integration UI'] },
    { phase: 'Phase 4', title: 'Commercial & Scale', status: 'future', items: ['Multi-User & Reseller Accounts', 'White-Label Branding', 'REST API & Webhooks', 'WHMCS Integration'] },
];

const TEAM_VALUES = [
    { title: 'Open Source First', desc: 'Free to use, modify, and self-host. No telemetry. No vendor lock-in. Your server, your data.' },
    { title: 'Security by Design', desc: 'Every feature is built with security in mind: bcrypt, TOTP 2FA, scoped sudoers, DTO validation, and command filtering.' },
    { title: 'Ubuntu Native', desc: 'Designed specifically for Ubuntu and Debian — using apt, UFW, systemd, and Ondřej PHP PPA the right way.' },
    { title: 'Developer-Grade Stack', desc: 'NestJS + React 18 + TypeScript throughout. No brittle PHP scripts or shell-only automation.' },
];

export default function AboutPage() {
    return (
        <>
            <Navbar />
            <Box component="main">
                {/* Header */}
                <Box
                    sx={{
                        py: { xs: 8, md: 12 },
                        textAlign: 'center',
                        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)',
                    }}
                >
                    <Container maxWidth="md">
                        <Chip label="ABOUT US" size="small" color="primary" variant="outlined" sx={{ mb: 3, fontWeight: 700 }} />
                        <Typography variant="h2" mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
                            Built by Developers,{' '}
                            <Box component="span" className="gradient-text">for Developers</Box>
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
                            clearPanel was born from frustration with expensive, bloated control panels that haven&apos;t kept up with modern development standards.
                        </Typography>
                    </Container>
                </Box>

                {/* Story */}
                <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: 'background.paper' }}>
                    <Container maxWidth="md">
                        <Typography variant="h4" fontWeight={700} mb={3}>Our Story</Typography>
                        <Stack spacing={2}>
                            {[
                                'Running your own VPS should give you complete control over your hosting stack. But between cPanel\'s $20/month licensing, Plesk\'s complex tiering, and the hours spent configuring Nginx, BIND9, Postfix, and Let\'s Encrypt by hand — most developers ended up choosing managed hosting and giving up control.',
                                'We built clearPanel to eliminate that trade-off. It started as an internal tool for managing Ubuntu VPS servers: a clean React frontend backed by a properly structured NestJS API that could automate what we kept doing manually.',
                                'As the feature set grew — DNS zones, email provisioning with DKIM/DMARC, multi-version PHP, backup scheduling, TOTP 2FA — it became clear this was a real alternative to commercial panels. So we open-sourced it under the MIT license.',
                                'Today, clearPanel v2.1.0 ships 26 production-ready features covering the full hosting stack, with Phase 2 (FTP, subdomain manager, advanced email) actively in development.',
                            ].map((p, i) => (
                                <Typography key={i} color="text.secondary" lineHeight={1.8}>{p}</Typography>
                            ))}
                        </Stack>
                    </Container>
                </Box>

                {/* Values */}
                <Box sx={{ py: { xs: 8, md: 10 } }}>
                    <Container maxWidth="lg">
                        <Typography variant="h4" fontWeight={700} textAlign="center" mb={2}>Our Philosophy</Typography>
                        <Typography color="text.secondary" textAlign="center" mb={6}>
                            The principles that guide every decision in clearPanel
                        </Typography>
                        <Grid container spacing={3}>
                            {TEAM_VALUES.map((v) => (
                                <Grid item xs={12} sm={6} key={v.title}>
                                    <Card variant="outlined" sx={{ p: 1, height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" fontWeight={700} mb={1}>{v.title}</Typography>
                                            <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{v.desc}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Container>
                </Box>

                {/* Tech stack */}
                <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: 'background.paper' }}>
                    <Container maxWidth="md">
                        <Typography variant="h4" fontWeight={700} mb={2}>Technical Philosophy</Typography>
                        <Typography color="text.secondary" mb={4} lineHeight={1.8}>
                            clearPanel uses a modern, structured tech stack — not a collection of bash scripts glued to a PHP interface. Every layer is typed, validated, and maintainable.
                        </Typography>
                        {[
                            { label: 'Backend', val: 'NestJS 10 + TypeScript — modular architecture with dependency injection, DTO validation (class-validator), and auth guards on every endpoint.' },
                            { label: 'Frontend', val: 'React 18 + MUI v7 + TypeScript — 21 pages, Monaco editor for code editing, React Router v6, lazy-loaded components.' },
                            { label: 'Auth', val: 'Session-based with express-session + bcrypt password hashing + optional TOTP 2FA (speakeasy, QR code + 8 recovery codes).' },
                            { label: 'DNS', val: 'BIND9 authoritative nameserver — automated zone file creation and reload, time-based deterministic zone serials.' },
                            { label: 'Email', val: 'Postfix + Dovecot + Rspamd + ClamAV + OpenDKIM — complete deliverability setup via 27 provisioning scripts.' },
                            { label: 'Data', val: 'JSON file-based storage in a configurable DATA_DIR — suitable for single-admin panels; no separate database required.' },
                        ].map(({ label, val }) => (
                            <Box key={label} sx={{ mb: 2 }}>
                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                    <CheckCircleIcon sx={{ color: 'primary.main', mt: 0.3, flexShrink: 0 }} fontSize="small" />
                                    <Box>
                                        <Typography variant="body1" fontWeight={700}>{label}</Typography>
                                        <Typography variant="body2" color="text.secondary">{val}</Typography>
                                    </Box>
                                </Stack>
                                <Divider sx={{ mt: 2 }} />
                            </Box>
                        ))}
                    </Container>
                </Box>

                {/* Roadmap Preview */}
                <Box sx={{ py: { xs: 8, md: 10 } }}>
                    <Container maxWidth="lg">
                        <Typography variant="h4" fontWeight={700} textAlign="center" mb={2}>Development Roadmap</Typography>
                        <Typography color="text.secondary" textAlign="center" mb={6}>
                            clearPanel is actively developed in 4 phases
                        </Typography>
                        <Grid container spacing={3}>
                            {PHASE_ITEMS.map((phase) => (
                                <Grid item xs={12} sm={6} md={3} key={phase.phase}>
                                    <Card
                                        variant="outlined"
                                        sx={{
                                            height: '100%',
                                            borderColor: phase.status === 'complete' ? 'success.main' : phase.status === 'planned' ? 'primary.main' : 'divider',
                                        }}
                                    >
                                        <CardContent>
                                            <Chip
                                                label={phase.status === 'complete' ? '✅ Complete' : phase.status === 'planned' ? '🔄 In Progress' : '🔲 Planned'}
                                                size="small"
                                                sx={{ mb: 2, fontWeight: 600 }}
                                            />
                                            <Typography variant="overline" color="text.secondary" display="block">{phase.phase}</Typography>
                                            <Typography variant="h6" fontWeight={700} mb={2}>{phase.title}</Typography>
                                            <Stack spacing={0.5}>
                                                {phase.items.map((item) => (
                                                    <Typography key={item} variant="caption" color="text.secondary" display="block" sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
                                                        {item}
                                                    </Typography>
                                                ))}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Container>
                </Box>

                {/* CTA */}
                <Box sx={{ py: 10, textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Container maxWidth="sm">
                        <Typography variant="h4" mb={2}>Join the clearPanel community</Typography>
                        <Typography color="text.secondary" mb={4}>
                            Open source on GitHub. MIT licensed. Contributions welcome.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                            <Button variant="contained" size="large" component="a" href="https://github.com/SefionITServices/clearPanel" target="_blank" endIcon={<ArrowForwardIcon />}>
                                View on GitHub
                            </Button>
                            <Button variant="outlined" size="large" component={NextLink} href="/contact">
                                Get in Touch
                            </Button>
                        </Stack>
                    </Container>
                </Box>
            </Box>
            <Footer />
        </>
    );
}
