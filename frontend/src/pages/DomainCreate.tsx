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
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/dashboard/layout';

// Backend defaults to ~/public_html/{domain} if no path provided.
// We dynamically discover the primary domain to offer an accurate shared-path option.

interface DomainInfo {
  name: string;
  folderPath: string;
}

export default function DomainCreatePage() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [shareRoot, setShareRoot] = useState(false);
  const [pathMode, setPathMode] = useState<'public_html' | 'root' | 'custom'>('public_html');
  const [customFolderPath, setCustomFolderPath] = useState('');
  const [sharedFolderPath, setSharedFolderPath] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [nameservers, setNameservers] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState<DomainInfo | null>(null);
  const [loadingPrimaryDomain, setLoadingPrimaryDomain] = useState(true);
  const [primaryDomainError, setPrimaryDomainError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDomains = async () => {
      try {
        const response = await fetch('/api/domains');
        if (!response.ok) {
          throw new Error(`Failed to fetch domains (${response.status})`);
        }
        const data = await response.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const primary = data[0] as DomainInfo;
          setPrimaryDomain(primary);
          if (shareRoot) {
            setSharedFolderPath(primary.folderPath);
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('Failed to determine primary domain:', message);
          setPrimaryDomainError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingPrimaryDomain(false);
        }
      }
    };

    loadDomains();

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep folderPath in sync when domain changes (if not sharing root)
  useEffect(() => {
    if (!shareRoot) {
      // setCustomFolderPath(''); // Don't clear custom path automatically
    }
    setSubdomain(domain);
  }, [domain, shareRoot]);

  useEffect(() => {
    if (shareRoot && primaryDomain?.folderPath) {
      setSharedFolderPath(primaryDomain.folderPath);
    }
  }, [shareRoot, primaryDomain]);

  const handleShareRootToggle = (checked: boolean) => {
    setShareRoot(checked);
    if (!checked) {
      setSharedFolderPath('');
    } else if (primaryDomain?.folderPath) {
      setSharedFolderPath(primaryDomain.folderPath);
    }
  };

  const handleSubmit = async (createAnother: boolean) => {
    if (!domain) return;
    setSubmitting(true);
    try {
      // Only send folderPath if shareRoot is true or user explicitly set a custom path
      const payload: { name: string; folderPath?: string; nameservers?: string[] } = { name: domain };
      const trimmedSharedPath = sharedFolderPath.trim();
      const trimmedCustomPath = customFolderPath.trim();

      if (shareRoot) {
        if (!trimmedSharedPath) {
          alert('Enter the document root path you want to share, or disable "Share document root".');
          return;
        }
        payload.folderPath = trimmedSharedPath;
      } else {
        if (pathMode === 'root') {
          // Backend default is public_html/{domain}, so we must specify for root
          // Assuming root is /home/clearpanel
          payload.folderPath = `/home/clearpanel/${domain}`;
        } else if (pathMode === 'custom') {
          if (trimmedCustomPath) {
            payload.folderPath = trimmedCustomPath;
          }
        }
        // if pathMode === 'public_html', we can leave it undefined to let backend handle it,
        // OR we can be explicit: /home/clearpanel/public_html/{domain}
        // Let's rely on backend default for public_html to keep it simple,
        // unless backend default changes. Backend default IS public_html/{domain}.
      }

      const customNameservers = nameservers
        .split(/\r?\n|,/)
        .map((ns) => ns.trim())
        .filter((ns) => ns.length > 0);

      if (customNameservers.length > 0) {
        payload.nameservers = customNameservers;
      }

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
        setCustomFolderPath('');
        setSharedFolderPath('');
        setShareRoot(false);
        setPathMode('public_html');
        setSubdomain('');
        setNameservers('');
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
                    control={
                      <Checkbox
                        checked={shareRoot}
                        onChange={(e) => handleShareRootToggle(e.target.checked)}
                        disabled={submitting}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Share document root (
                        <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {primaryDomain?.folderPath || (loadingPrimaryDomain ? 'Loading…' : 'Enter existing path')}
                        </Typography>
                        ) with “{primaryDomain?.name || 'primary domain'}”.
                        <Typography component="span" variant="body2" sx={{ ml: 0.5, fontWeight: 500 }}>
                          This setting is permanent.
                        </Typography>
                        {!primaryDomain && primaryDomainError && !loadingPrimaryDomain && (
                          <Typography component="span" variant="body2" color="error" sx={{ ml: 0.5 }}>
                            (Unable to auto-detect primary domain path: {primaryDomainError})
                          </Typography>
                        )}
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

                  {shareRoot ? (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {primaryDomain?.folderPath
                          ? `Sharing existing directory at ${primaryDomain.folderPath}.`
                          : 'Enter the full path of the document root you want to share with another domain.'}
                      </Typography>
                      <TextField
                        fullWidth
                        value={sharedFolderPath}
                        onChange={(e) => setSharedFolderPath(e.target.value)}
                        disabled={submitting}
                        placeholder={primaryDomain?.folderPath || 'Enter existing document root path'}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <HomeIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </>
                  ) : (
                    <FormControl component="fieldset">
                      <RadioGroup
                        aria-label="path-mode"
                        name="path-mode"
                        value={pathMode}
                        onChange={(e) => setPathMode(e.target.value as any)}
                      >
                        <FormControlLabel
                          value="public_html"
                          control={<Radio />}
                          label={
                            <Typography variant="body2">
                              Inside public_html <Typography component="span" variant="caption" color="text.secondary">(~/public_html/{domain || 'example.com'})</Typography>
                            </Typography>
                          }
                        />
                        <FormControlLabel
                          value="root"
                          control={<Radio />}
                          label={
                            <Typography variant="body2">
                              Inside Home Root <Typography component="span" variant="caption" color="text.secondary">(~/{domain || 'example.com'})</Typography>
                            </Typography>
                          }
                        />
                        <FormControlLabel
                          value="custom"
                          control={<Radio />}
                          label="Custom Path"
                        />
                      </RadioGroup>
                      {pathMode === 'custom' && (
                        <TextField
                          fullWidth
                          sx={{ mt: 1, ml: 3.5, width: 'calc(100% - 28px)' }}
                          value={customFolderPath}
                          onChange={(e) => setCustomFolderPath(e.target.value)}
                          disabled={submitting}
                          placeholder="/home/clearpanel/custom/path"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <HomeIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    </FormControl>
                  )}
                </Box>

                {/* Nameservers */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Nameservers (Optional)</Typography>
                    <IconButton size="small"><InfoOutlinedIcon fontSize="small" /></IconButton>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Provide custom nameservers if you want to use branded hostnames. Enter one per line or separate with commas. Leave blank to use the default ns1/ns2.{domain ? ` (Default: ns1.${domain}, ns2.${domain})` : ''}
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={nameservers}
                    onChange={(e) => setNameservers(e.target.value)}
                    disabled={submitting}
                    placeholder={`ns1.${domain || 'example.com'}\nns2.${domain || 'example.com'}`}
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
                      value={primaryDomain ? `.${primaryDomain.name}` : '.example.com'}
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