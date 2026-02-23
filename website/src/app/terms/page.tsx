'use client';
import { Box, Container, Typography, Chip, Divider, Stack } from '@mui/material';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsPage() {
    const sections = [
        {
            title: 'License',
            content: 'clearPanel is released under the MIT License. You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, provided that the original copyright notice and this permission notice appear in all copies or substantial portions of the Software.',
        },
        {
            title: 'Permitted Use',
            content: 'You may install and use clearPanel on any number of servers you own or control. You may modify the source code for your own use. You may redistribute modified versions of clearPanel under the same MIT license.',
        },
        {
            title: 'Prohibited Use',
            content: 'You may not use clearPanel to facilitate illegal activity, violate the terms of service of server providers, send unsolicited commercial email (spam), or conduct unauthorized access to systems. Commercial redistribution under a different license is also prohibited.',
        },
        {
            title: 'Disclaimer of Warranties',
            content: 'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. YOU USE CLEARPANEL AT YOUR OWN RISK.',
        },
        {
            title: 'Limitation of Liability',
            content: 'IN NO EVENT SHALL THE AUTHORS, COPYRIGHT HOLDERS, OR SEFION IT SERVICES BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
        },
        {
            title: 'Modifications to Terms',
            content: 'Sefion IT Services reserves the right to modify these terms at any time. Material changes will be announced via the GitHub repository. Continued use of the software after such changes constitutes acceptance of the new terms.',
        },
        {
            title: 'Contact',
            content: 'For legal inquiries, contact us at support@clearpanel.net.',
        },
    ];

    return (
        <>
            <Navbar />
            <Box component="main">
                <Box sx={{ py: { xs: 8, md: 10 }, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.1) 0%, transparent 70%)' }}>
                    <Container maxWidth="md">
                        <Chip label="LEGAL" size="small" color="primary" variant="outlined" sx={{ mb: 3, fontWeight: 700 }} />
                        <Typography variant="h2" mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>Terms of Service</Typography>
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
