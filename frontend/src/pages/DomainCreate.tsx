import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Stack,
  Checkbox,
  FormControlLabel,
  Button,
  InputAdornment,
  Link,
  Divider,
  IconButton,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/dashboard/layout';

// Note: Backend defaults to ~/clearpanel-domains/{domain} if no path provided
// Leaving folderPath empty will use backend defaults
const MAIN_USER_HOME = '/home/user/clearpanel-domains';  // Example path shown in UI
const MAIN_PUBLIC_HTML = `${MAIN_USER_HOME}/public_html`;
const MAIN_DOMAIN = 'example.com';

export default function DomainCreatePage() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [shareRoot, setShareRoot] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Keep folderPath in sync when domain changes (if not sharing root)
  useEffect(() => {
    if (!shareRoot) {
      // Leave empty to use backend default, or show example path
      setFolderPath(''); // Backend will auto-assign
    }
    setSubdomain(domain); // simple mirror; could strip TLD if needed
  }, [domain, shareRoot]);

  const handleSubmit = async (createAnother: boolean) => {
    if (!domain) return;
    setSubmitting(true);
    try {
      // Only send folderPath if shareRoot is true or user explicitly set a custom path
      const payload: { name: string; folderPath?: string } = { name: domain };
      if (shareRoot) {
        payload.folderPath = MAIN_PUBLIC_HTML;
      } else if (folderPath && folderPath.trim()) {
        payload.folderPath = folderPath.trim();
      }
      // If folderPath is empty/undefined, backend uses default: ~/clearpanel-domains/{domain}
      
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create domain:', response.status, errorText);
        alert(`Failed to create domain: ${errorText}`);
        return;
      }

      const result = await response.json();
      console.log('Domain created:', result);
      
      if (createAnother) {
        setDomain('');
        setFolderPath('');
        setShareRoot(false);
        setSubdomain('');
      } else {
        navigate('/domains');
      }
    } catch (err) {
      console.error('Error creating domain:', err);
      alert('Error creating domain. Please check the console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 900, mx: 'auto', mt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5 }}>Domains</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create a New Domain
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use this interface to manage your domains. For more information, read the documentation.
        </Typography>

        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" fontWeight={600}>Create a New Domain</Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Stack spacing={3}>
                {/* Domain */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Domain</Typography>
                    <IconButton size="small"><InfoOutlinedIcon fontSize="small" /></IconButton>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Enter the domain that you would like to create:
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.trim())}
                    disabled={submitting}
                  />
                </Box>

                {/* Share root */}
                <Box>
                  <FormControlLabel
                    control={<Checkbox checked={shareRoot} onChange={(e) => setShareRoot(e.target.checked)} />}
                    label={
                      <Typography variant="body2">
                        Share document root (<Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>{MAIN_PUBLIC_HTML}</Typography>) with "{MAIN_DOMAIN}".
                        <Typography component="span" variant="body2" sx={{ ml: 0.5, fontWeight: 500 }}>This setting is permanent.</Typography>
                      </Typography>
                    }
                  />
                </Box>

                {/* Document Root */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Document Root (File System Location)</Typography>
                    <IconButton size="small"><InfoOutlinedIcon fontSize="small" /></IconButton>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {shareRoot 
                      ? 'Using shared document root directory.'
                      : 'Leave empty to use auto-generated path (~/clearpanel-domains/{domain}), or specify a custom directory.'
                    }
                  </Typography>
                  <TextField
                    fullWidth
                    value={shareRoot ? MAIN_PUBLIC_HTML : folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    disabled={shareRoot || submitting}
                    placeholder="Leave empty for auto-path or enter custom path"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <HomeIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Subdomain */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Subdomain</Typography>
                    <IconButton size="small"><InfoOutlinedIcon fontSize="small" /></IconButton>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    An addon domain requires a subdomain in order to use a separate document root.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      disabled={submitting}
                    />
                    <TextField
                      value={`.${MAIN_DOMAIN}`}
                      disabled
                      sx={{ width: 180 }}
                    />
                  </Stack>
                </Box>

                <Divider />

                {/* Actions */}
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    disabled={!domain || submitting}
                    onClick={() => handleSubmit(false)}
                  >
                    Submit
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!domain || submitting}
                    onClick={() => handleSubmit(true)}
                  >
                    Submit And Create Another
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Link component="button" type="button" underline="none" onClick={() => navigate('/domains')} sx={{ alignSelf: 'center' }}>
                    Return To Domains
                  </Link>
                </Stack>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  );
}