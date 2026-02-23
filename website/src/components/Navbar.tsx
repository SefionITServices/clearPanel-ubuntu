'use client';
import { useState } from 'react';
import NextLink from 'next/link';
import {
    AppBar,
    Box,
    Button,
    Container,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Toolbar,
    Typography,
    useScrollTrigger,
    Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import GitHubIcon from '@mui/icons-material/GitHub';
import { navLinks } from '@/content/nav';
import { useColorMode } from '@/lib/ThemeContext';

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { toggleColorMode, mode } = useColorMode();
    const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 10 });

    return (
        <>
            <AppBar
                position="fixed"
                color="transparent"
                elevation={scrolled ? 3 : 0}
                sx={{
                    transition: 'all 0.3s ease',
                    backdropFilter: scrolled ? 'blur(20px)' : 'none',
                    borderBottom: '1px solid',
                    borderColor: scrolled ? 'divider' : 'transparent',
                    bgcolor: scrolled ? 'background.paper' : 'transparent',
                }}
            >
                <Container maxWidth="lg">
                    <Toolbar disableGutters sx={{ height: 72 }}>
                        {/* Logo */}
                        <NextLink href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                            <Box
                                component="img"
                                src="/logo.svg"
                                alt="ClearPanel"
                                sx={{ width: 36, height: 30 }}
                            />
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: 'text.primary' }}
                            >
                                clearPanel
                            </Typography>
                        </NextLink>

                        {/* Desktop nav */}
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, ml: 5, gap: 0.5, flexGrow: 1 }}>
                            {navLinks.map((link) => (
                                <Button
                                    key={link.href}
                                    component={NextLink}
                                    href={link.href}
                                    sx={{
                                        color: 'text.secondary',
                                        '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
                                    }}
                                >
                                    {link.label}
                                </Button>
                            ))}
                        </Box>

                        {/* Right actions */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>
                            <Tooltip title="Toggle dark/light mode">
                                <IconButton onClick={toggleColorMode} size="small" sx={{ color: 'text.secondary' }}>
                                    {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                            <IconButton
                                component="a"
                                href="https://github.com/SefionITServices/clearPanel"
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'flex' } }}
                            >
                                <GitHubIcon fontSize="small" />
                            </IconButton>
                            <Button
                                variant="contained"
                                size="small"
                                component={NextLink}
                                href="/pricing"
                                sx={{ display: { xs: 'none', sm: 'flex' } }}
                            >
                                Get Started
                            </Button>
                            <IconButton
                                sx={{ display: { xs: 'flex', md: 'none' }, color: 'text.secondary' }}
                                onClick={() => setMobileOpen(true)}
                            >
                                <MenuIcon />
                            </IconButton>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            {/* Mobile Drawer */}
            <Drawer
                anchor="right"
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
                PaperProps={{ sx: { width: 280, pt: 2, bgcolor: 'background.default' } }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pb: 2 }}>
                    <Box component="img" src="/logo.svg" alt="ClearPanel" sx={{ width: 28, height: 23, mr: 1 }} />
                    <Typography variant="h6" fontWeight={800}>clearPanel</Typography>
                    <IconButton onClick={() => setMobileOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <List>
                    {navLinks.map((link) => (
                        <ListItem key={link.href} disablePadding>
                            <ListItemButton
                                component={NextLink}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                            >
                                <ListItemText primary={link.label} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                    <ListItem sx={{ pt: 2 }}>
                        <Button
                            variant="contained"
                            fullWidth
                            component={NextLink}
                            href="/pricing"
                            onClick={() => setMobileOpen(false)}
                        >
                            Get Started
                        </Button>
                    </ListItem>
                </List>
            </Drawer>

            {/* Toolbar spacer */}
            <Toolbar sx={{ height: 72 }} />
        </>
    );
}
