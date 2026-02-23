'use client';
import { Box, Container, Typography, Chip, Divider, Stack } from '@mui/material';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
    const sections = [
        {
            title: 'Overview',
            content: 'clearPanel is a self-hosted, open-source web hosting control panel. Because you install and run clearPanel on your own server, clearPanel does not collect, transmit, or store any data about you or your users on our servers. All data remains on your VPS.',
        },
        {
            title: 'Data We Do Not Collect',
            content: 'clearPanel does not have telemetry, analytics, or call-home functionality. Your server\'s hostname, IP addresses, domain names, email accounts, database contents, and files are never sent to clearPanel or Sefion IT Services.',
        },
        {
            title: 'Local Data Storage',
            content: 'clearPanel stores configuration data in JSON files on your VPS inside the DATA_DIR you configure. This includes domain records, DNS zone data, and application settings. Your admin credentials are stored as bcrypt hashes — never in plaintext.',
        },
        {
            title: 'Optional Third-Party Services',
            content: 'clearPanel can optionally integrate with: (1) Cloudflare Tunnel — if you choose to use Cloudflare Tunnel for connectivity, your traffic passes through Cloudflare\'s network per their Privacy Policy. (2) Let\'s Encrypt — SSL certificates are obtained from Let\'s Encrypt, which logs certificate issuance. Both integrations are entirely optional.',
        },
        {
            title: 'This Website',
            content: 'This marketing website (clearpanel.net) may use standard web server access logs (IP addresses, browser user agents) for security and operational purposes. These are not shared with third parties.',
        },
        {
            title: 'Contact',
            content: 'For privacy questions, contact us at support@clearpanel.net.',
        },
    ];

    return (
        <>
            <Navbar />
            <Box component="main">
                <Box sx={{ py: { xs: 8, md: 10 }, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.1) 0%, transparent 70%)' }}>
                    <Container maxWidth="md">
                        <Chip label="LEGAL" size="small" color="primary" variant="outlined" sx={{ mb: 3, fontWeight: 700 }} />
                        <Typography variant="h2" mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>Privacy Policy</Typography>
                        <Typography color="text.secondary">Last updated: February 22, 2026</Typography>
                    </Container>
                </Box>
                <Container maxWidth="md" sx={{ pb: 12 }}>
                    <Stack spacing={4}>
                        {sections.map((s, i) => (
                            <Box key={s.title}>
                                <Typography variant="h5" fontWeight={700} mb={1.5}>
                                    {i + 1}. {s.title}
                                </Typography>
                                <Typography color="text.secondary" lineHeight={1.8}>
                                    {s.content}
                                </Typography>
                                {i < sections.length - 1 && <Divider sx={{ mt: 4 }} />}
                            </Box>
                        ))}
                    </Stack>
                </Container>
            </Box>
            <Footer />
        </>
    );
}
