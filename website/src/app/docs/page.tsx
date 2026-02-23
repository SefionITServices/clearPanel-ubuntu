'use client';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Grid,
    Link,
    Stack,
    Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DynamicIcon from '@/components/DynamicIcon';
import { docSections } from '@/content/docs';

export default function DocsPage() {
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
                        <Chip label="DOCUMENTATION" size="small" color="primary" variant="outlined" sx={{ mb: 3, fontWeight: 700 }} />
                        <Typography variant="h2" mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
                            clearPanel Documentation
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.7, maxWidth: 540, mx: 'auto' }}>
                            Everything you need to install, configure, and get the most out of clearPanel.
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            component="a"
                            href="https://github.com/SefionITServices/clearPanel/blob/main/docs/QUICK-START.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            endIcon={<ArrowForwardIcon />}
                            sx={{ mt: 4 }}
                        >
                            Quick Start Guide
                        </Button>
                    </Container>
                </Box>

                {/* Doc Sections Grid */}
                <Container maxWidth="lg" sx={{ pb: 12 }}>
                    <Grid container spacing={3}>
                        {docSections.map((section) => (
                            <Grid item xs={12} sm={6} md={4} key={section.title}>
                                <Card variant="outlined" sx={{ height: '100%', p: 1 }}>
                                    <CardContent>
                                        <Box
                                            sx={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 2,
                                                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.15))',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mb: 2,
                                            }}
                                        >
                                            <DynamicIcon name={section.icon} sx={{ color: 'primary.main', fontSize: 22 }} />
                                        </Box>
                                        <Typography variant="h6" fontWeight={700} mb={2}>{section.title}</Typography>
                                        <Stack spacing={1}>
                                            {section.links.map((link) => (
                                                <Link
                                                    key={link.label}
                                                    href={link.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    variant="body2"
                                                    color="primary"
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        '&:hover': { textDecoration: 'underline' },
                                                    }}
                                                >
                                                    {link.label} →
                                                </Link>
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* GitHub banner */}
                    <Box
                        mt={8}
                        sx={{
                            p: 4,
                            borderRadius: 3,
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(6,182,212,0.08))',
                            border: '1px solid',
                            borderColor: 'divider',
                            textAlign: 'center',
                        }}
                    >
                        <Typography variant="h5" fontWeight={700} mb={1}>Full documentation lives on GitHub</Typography>
                        <Typography color="text.secondary" mb={3}>
                            All guides, API references, and installation documentation are maintained in the repository.
                        </Typography>
                        <Button
                            variant="outlined"
                            component="a"
                            href="https://github.com/SefionITServices/clearPanel/tree/main/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            endIcon={<ArrowForwardIcon />}
                        >
                            Browse docs/ on GitHub
                        </Button>
                    </Box>
                </Container>
            </Box>
            <Footer />
        </>
    );
}
