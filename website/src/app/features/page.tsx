'use client';
import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Container,
    Grid,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DynamicIcon from '@/components/DynamicIcon';
import { featureCategories } from '@/content/features';

export default function FeaturesPage() {
    const [activeTab, setActiveTab] = useState(0);

    const currentCategory = featureCategories[activeTab];

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
                        <Chip label="26 FEATURES · PHASE 1 COMPLETE" size="small" color="primary" variant="outlined" sx={{ mb: 3, fontWeight: 700 }} />
                        <Typography variant="h2" mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
                            Everything Your VPS Needs
                        </Typography>
                        <Typography color="text.secondary" sx={{ maxWidth: 560, mx: 'auto', fontSize: '1.1rem', lineHeight: 1.7 }}>
                            clearPanel ships 26 fully-implemented features across domains, DNS, email, databases, security, and server management — out of the box.
                        </Typography>
                    </Container>
                </Box>

                {/* Tabs + Content */}
                <Container maxWidth="lg" sx={{ pb: 12 }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 6 }}>
                        <Tabs
                            value={activeTab}
                            onChange={(_, v) => setActiveTab(v)}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{ '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.9rem' } }}
                        >
                            {featureCategories.map((cat) => (
                                <Tab key={cat.id} label={cat.label} id={cat.id} />
                            ))}
                        </Tabs>
                    </Box>

                    <Box>
                        <Typography variant="h4" fontWeight={700} mb={1}>
                            {currentCategory.label}
                        </Typography>
                        <Typography color="text.secondary" mb={5}>
                            {currentCategory.features.length} features in this category
                        </Typography>
                        <Grid container spacing={3}>
                            {currentCategory.features.map((feature) => (
                                <Grid item xs={12} sm={6} md={4} key={feature.title}>
                                    <Card
                                        variant="outlined"
                                        sx={{
                                            height: '100%',
                                            p: 1,
                                            transition: 'border-color 0.2s, box-shadow 0.2s',
                                            '&:hover': {
                                                borderColor: 'primary.main',
                                                boxShadow: '0 0 0 1px rgba(99,102,241,0.3)',
                                            },
                                        }}
                                    >
                                        <CardContent>
                                            <Stack direction="row" spacing={2} alignItems="flex-start">
                                                <Box
                                                    sx={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 2,
                                                        flexShrink: 0,
                                                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.15))',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <DynamicIcon name={feature.icon} sx={{ color: 'primary.main', fontSize: 22 }} />
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                                                        {feature.title}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                                                        {feature.description}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    {/* All categories overview */}
                    <Box mt={10}>
                        <Typography variant="h4" fontWeight={700} mb={2} textAlign="center">All Feature Categories</Typography>
                        <Typography color="text.secondary" mb={6} textAlign="center">
                            Click any category to explore
                        </Typography>
                        <Grid container spacing={2}>
                            {featureCategories.map((cat, i) => (
                                <Grid item xs={6} sm={4} md={3} key={cat.id}>
                                    <Card
                                        variant="outlined"
                                        onClick={() => setActiveTab(i)}
                                        sx={{
                                            p: 2,
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            transition: 'all 0.2s',
                                            bgcolor: activeTab === i ? 'action.selected' : 'transparent',
                                            borderColor: activeTab === i ? 'primary.main' : 'divider',
                                            '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.light' },
                                        }}
                                    >
                                        <Typography variant="body2" fontWeight={600}>{cat.label}</Typography>
                                        <Typography variant="caption" color="text.secondary">{cat.features.length} features</Typography>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                </Container>
            </Box>
            <Footer />
        </>
    );
}
