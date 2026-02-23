'use client';
import NextLink from 'next/link';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFound() {
    return (
        <>
            <Navbar />
            <Box
                component="main"
                sx={{
                    minHeight: '70vh',
                    display: 'flex',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(99,102,241,0.1) 0%, transparent 70%)',
                }}
            >
                <Container maxWidth="sm">
                    <Typography
                        variant="h1"
                        sx={{
                            fontSize: { xs: '6rem', md: '10rem' },
                            fontWeight: 800,
                            lineHeight: 1,
                            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 2,
                        }}
                    >
                        404
                    </Typography>
                    <Typography variant="h4" fontWeight={700} mb={2}>
                        Page not found
                    </Typography>
                    <Typography color="text.secondary" mb={5} lineHeight={1.7}>
                        The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                        <Button
                            variant="contained"
                            size="large"
                            component={NextLink}
                            href="/"
                            startIcon={<HomeIcon />}
                        >
                            Back to Home
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            component={NextLink}
                            href="/features"
                            endIcon={<ArrowForwardIcon />}
                        >
                            Explore Features
                        </Button>
                    </Stack>
                </Container>
            </Box>
            <Footer />
        </>
    );
}
