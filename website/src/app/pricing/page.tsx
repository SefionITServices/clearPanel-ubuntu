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
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import StarIcon from '@mui/icons-material/Star';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { pricingTiers, comparisonRows } from '@/content/pricing';

function FeatureValue({ val }: { val: string | boolean }) {
    if (val === true) return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />;
    if (val === false) return <CancelIcon sx={{ color: 'text.disabled', fontSize: 20 }} />;
    return <Typography variant="body2" fontWeight={500}>{val}</Typography>;
}

export default function PricingPage() {
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
                        <Typography variant="h2" mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
                            Simple, Transparent Pricing
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
                            Start free with the Community edition. Upgrade when you need more.
                        </Typography>
                    </Container>
                </Box>

                {/* Pricing Cards */}
                <Container maxWidth="lg" sx={{ pb: 8 }}>
                    <Grid container spacing={3} alignItems="stretch">
                        {pricingTiers.map((tier) => (
                            <Grid item xs={12} md={4} key={tier.id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        border: tier.highlighted ? '2px solid' : '1px solid',
                                        borderColor: tier.highlighted ? 'primary.main' : 'divider',
                                        position: 'relative',
                                        overflow: 'visible',
                                    }}
                                >
                                    {tier.highlighted && (
                                        <Chip
                                            icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
                                            label="Most Popular"
                                            size="small"
                                            color="primary"
                                            sx={{
                                                position: 'absolute',
                                                top: -12,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                fontWeight: 700,
                                                px: 1,
                                            }}
                                        />
                                    )}
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h5" fontWeight={800} mb={0.5}>{tier.name}</Typography>
                                        <Typography variant="body2" color="text.secondary" mb={3}>{tier.tagline}</Typography>

                                        <Stack direction="row" alignItems="baseline" spacing={0.5} mb={0.5}>
                                            <Typography variant="h3" fontWeight={800}>{tier.price}</Typography>
                                            <Typography color="text.secondary" variant="body2">/{tier.pricePeriod}</Typography>
                                        </Stack>
                                        {tier.priceNote && (
                                            <Typography variant="caption" color="text.secondary" display="block" mb={3}>
                                                {tier.priceNote}
                                            </Typography>
                                        )}

                                        <Button
                                            variant={tier.highlighted ? 'contained' : 'outlined'}
                                            fullWidth
                                            component={tier.ctaHref.startsWith('http') ? 'a' : NextLink}
                                            href={tier.ctaHref}
                                            target={tier.ctaHref.startsWith('http') ? '_blank' : undefined}
                                            rel={tier.ctaHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                                            sx={{ mb: 3 }}
                                        >
                                            {tier.ctaLabel}
                                        </Button>

                                        <Divider sx={{ mb: 3 }} />

                                        <Stack spacing={1}>
                                            {tier.features.map((f) => (
                                                <Stack key={f} direction="row" spacing={1.5} alignItems="flex-start">
                                                    <CheckCircleIcon sx={{ color: 'success.main', mt: 0.2, flexShrink: 0, fontSize: 18 }} />
                                                    <Typography variant="body2" lineHeight={1.5}>{f}</Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Comparison Table */}
                    <Box mt={10}>
                        <Typography variant="h4" fontWeight={700} textAlign="center" mb={1}>
                            Full Feature Comparison
                        </Typography>
                        <Typography color="text.secondary" textAlign="center" mb={5}>
                            A detailed breakdown of what&apos;s included in each plan
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, width: '40%' }}>Feature</TableCell>
                                        {pricingTiers.map((tier) => (
                                            <TableCell key={tier.id} align="center" sx={{ fontWeight: 700 }}>
                                                {tier.name}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {comparisonRows.map((row, i) => (
                                        <TableRow
                                            key={row.feature}
                                            sx={{ bgcolor: i % 2 === 0 ? 'transparent' : 'action.hover' }}
                                        >
                                            <TableCell sx={{ fontWeight: 500 }}>{row.feature}</TableCell>
                                            <TableCell align="center"><FeatureValue val={row.community} /></TableCell>
                                            <TableCell align="center"><FeatureValue val={row.pro} /></TableCell>
                                            <TableCell align="center"><FeatureValue val={row.business} /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>

                    {/* CTA */}
                    <Box textAlign="center" mt={8}>
                        <Typography variant="h4" mb={2}>Not sure which plan?</Typography>
                        <Typography color="text.secondary" mb={4}>Start with Community — it&apos;s completely free and open source.</Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                            <Button
                                variant="contained"
                                size="large"
                                component="a"
                                href="https://github.com/SefionITServices/clearPanel"
                                target="_blank"
                                endIcon={<ArrowForwardIcon />}
                            >
                                Start for Free
                            </Button>
                            <Button variant="outlined" size="large" component={NextLink} href="/contact">
                                Talk to Sales
                            </Button>
                        </Stack>
                    </Box>
                </Container>
            </Box>
            <Footer />
        </>
    );
}
