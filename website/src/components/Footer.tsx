'use client';
import NextLink from 'next/link';
import {
    Box,
    Container,
    Divider,
    Grid,
    IconButton,
    Link,
    Stack,
    Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';

const footerLinks = {
    Product: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Changelog', href: 'https://github.com/SefionITServices/clearPanel/blob/main/CHANGELOG.md' },
        { label: 'Roadmap', href: 'https://github.com/SefionITServices/clearPanel/blob/main/ROADMAP.md' },
    ],
    Resources: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Installation Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/INSTALL.md' },
        { label: 'GitHub Repo', href: 'https://github.com/SefionITServices/clearPanel' },
    ],
    Company: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
    ],
};

export default function Footer() {
    return (
        <Box
            component="footer"
            sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                mt: 'auto',
                pt: 6,
                pb: 4,
                bgcolor: 'background.paper',
            }}
        >
            <Container maxWidth="lg">
                <Grid container spacing={4}>
                    {/* Brand */}
                    <Grid item xs={12} md={4}>
                        <Stack spacing={2}>
                            <NextLink href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 1.5,
                                        background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>cp</Typography>
                                </Box>
                                <Typography variant="h6" fontWeight={800} sx={{ color: 'text.primary' }}>
                                    clearPanel
                                </Typography>
                            </NextLink>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
                                Open-source web hosting control panel for Ubuntu VPS servers. No licensing fees, full data ownership.
                            </Typography>
                            <Box>
                                <IconButton
                                    component="a"
                                    href="https://github.com/SefionITServices/clearPanel"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    size="small"
                                    sx={{ color: 'text.secondary', ml: -1 }}
                                >
                                    <GitHubIcon />
                                </IconButton>
                            </Box>
                        </Stack>
                    </Grid>

                    {/* Link columns */}
                    {Object.entries(footerLinks).map(([section, links]) => (
                        <Grid item xs={6} sm={4} md={8 / 3} key={section}>
                            <Typography variant="body2" fontWeight={700} color="text.primary" gutterBottom>
                                {section}
                            </Typography>
                            <Stack spacing={1}>
                                {links.map((link) => (
                                    <Link
                                        key={link.label}
                                        component={link.href.startsWith('http') ? 'a' : NextLink}
                                        href={link.href}
                                        target={link.href.startsWith('http') ? '_blank' : undefined}
                                        rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ '&:hover': { color: 'primary.main' } }}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </Stack>
                        </Grid>
                    ))}
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        © {new Date().getFullYear()} Sefion IT Services. MIT License — free to use and modify.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Built with NestJS + React + MUI on Ubuntu
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
}
