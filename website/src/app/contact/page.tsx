'use client';
import React, { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const SUBJECTS = ['Technical Support', 'Sales Inquiry', 'Partnership', 'Bug Report', 'Feature Request', 'General'];

interface FormState {
    name: string;
    email: string;
    subject: string;
    message: string;
}

interface FormErrors {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
}

function validate(form: FormState): FormErrors {
    const errors: FormErrors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) {
        errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Enter a valid email address';
    }
    if (!form.subject) errors.subject = 'Please select a subject';
    if (!form.message.trim()) {
        errors.message = 'Message is required';
    } else if (form.message.trim().length < 20) {
        errors.message = 'Message must be at least 20 characters';
    }
    return errors;
}

export default function ContactPage() {
    const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' });
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubject = (e: SelectChangeEvent) => {
        setForm((prev) => ({ ...prev, subject: e.target.value }));
        if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate(form);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        setLoading(true);
        // Simulate submission (replace with real API call)
        await new Promise((r) => setTimeout(r, 1200));
        setLoading(false);
        setSubmitted(true);
    };

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
                        <Chip label="CONTACT" size="small" color="primary" variant="outlined" sx={{ mb: 3, fontWeight: 700 }} />
                        <Typography variant="h2" mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
                            Get in Touch
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
                            Have a question, feature request, or partnership inquiry? We&apos;d love to hear from you.
                        </Typography>
                    </Container>
                </Box>

                <Container maxWidth="lg" sx={{ pb: 12 }}>
                    <Grid container spacing={6}>
                        {/* Contact Info */}
                        <Grid item xs={12} md={4}>
                            <Stack spacing={3}>
                                <Card variant="outlined" sx={{ p: 2 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                            <EmailIcon color="primary" />
                                            <Typography variant="h6" fontWeight={700}>Email Support</Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" mb={1}>
                                            For technical issues, please include your Ubuntu version and clearPanel version number.
                                        </Typography>
                                        <Typography variant="body2" color="primary" fontWeight={600}>support@clearpanel.net</Typography>
                                    </CardContent>
                                </Card>

                                <Card variant="outlined" sx={{ p: 2 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                            <GitHubIcon color="primary" />
                                            <Typography variant="h6" fontWeight={700}>GitHub Issues</Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" mb={2}>
                                            Bug reports and feature requests are best tracked as GitHub Issues so the community can follow along.
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            component="a"
                                            href="https://github.com/SefionITServices/clearPanel/issues"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Open an Issue
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'action.hover' }}>
                                    <Typography variant="body2" fontWeight={600} mb={1}>Response Time</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Community: best-effort via GitHub<br />
                                        Pro plan: 72-hour email SLA<br />
                                        Business: 48-hour priority SLA
                                    </Typography>
                                </Box>
                            </Stack>
                        </Grid>

                        {/* Contact Form */}
                        <Grid item xs={12} md={8}>
                            {submitted ? (
                                <Alert severity="success" sx={{ borderRadius: 3, p: 3 }}>
                                    <Typography variant="h6" fontWeight={700} mb={1}>Message sent — thank you!</Typography>
                                    <Typography variant="body2">
                                        We&apos;ve received your message and will get back to you at {form.email} within 72 hours.
                                    </Typography>
                                </Alert>
                            ) : (
                                <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
                                    <CardContent>
                                        <Typography variant="h5" fontWeight={700} mb={3}>Send a Message</Typography>
                                        <Box component="form" onSubmit={handleSubmit} noValidate>
                                            <Grid container spacing={3}>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        id="contact-name"
                                                        fullWidth
                                                        label="Your Name"
                                                        name="name"
                                                        value={form.name}
                                                        onChange={handleChange}
                                                        error={!!errors.name}
                                                        helperText={errors.name}
                                                        required
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        id="contact-email"
                                                        fullWidth
                                                        label="Email Address"
                                                        name="email"
                                                        type="email"
                                                        value={form.email}
                                                        onChange={handleChange}
                                                        error={!!errors.email}
                                                        helperText={errors.email}
                                                        required
                                                    />
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <FormControl fullWidth error={!!errors.subject} required>
                                                        <InputLabel id="subject-label">Subject</InputLabel>
                                                        <Select
                                                            labelId="subject-label"
                                                            id="contact-subject"
                                                            value={form.subject}
                                                            label="Subject"
                                                            onChange={handleSubject}
                                                        >
                                                            {SUBJECTS.map((s) => (
                                                                <MenuItem key={s} value={s}>{s}</MenuItem>
                                                            ))}
                                                        </Select>
                                                        {errors.subject && (
                                                            <Typography variant="caption" color="error" mt={0.5} ml={1.5}>
                                                                {errors.subject}
                                                            </Typography>
                                                        )}
                                                    </FormControl>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <TextField
                                                        id="contact-message"
                                                        fullWidth
                                                        multiline
                                                        rows={6}
                                                        label="Message"
                                                        name="message"
                                                        value={form.message}
                                                        onChange={handleChange}
                                                        error={!!errors.message}
                                                        helperText={errors.message || 'Minimum 20 characters'}
                                                        required
                                                    />
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button
                                                        type="submit"
                                                        variant="contained"
                                                        size="large"
                                                        endIcon={<SendIcon />}
                                                        disabled={loading}
                                                        sx={{ minWidth: 160 }}
                                                    >
                                                        {loading ? 'Sending...' : 'Send Message'}
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                    </Grid>
                </Container>
            </Box>
            <Footer />
        </>
    );
}
