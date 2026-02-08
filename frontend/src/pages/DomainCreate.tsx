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
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
  const [vpsNameservers, setVpsNameservers] = useState<string[]>([]);
  const [serverIp, setServerIp] = useState<string>('');
  const [createdDomain, setCreatedDomain] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

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

  // Fetch VPS nameservers from server settings
  useEffect(() => {
    const loadServerSettings = async () => {
      try {
        const res = await fetch('/api/server/nameservers');
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.nameservers?.length) {
            setVpsNameservers(data.settings.nameservers);
          }
          if (data.settings?.serverIp) {
            setServerIp(data.settings.serverIp);
          }
        }
      } catch (err) {
        console.error('Failed to load server settings:', err);
      }
    };
    loadServerSettings();
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
      const payload: { name: string; folderPath?: string; pathMode?: string; nameservers?: string[] } = { name: domain };
      const trimmedSharedPath = sharedFolderPath.trim();
      const trimmedCustomPath = customFolderPath.trim();

      if (shareRoot) {
        if (!trimmedSharedPath) {
          alert('Enter the document root path you want to share, or disable "Share document root".');
          return;
        }
        payload.folderPath = trimmedSharedPath;
      } else {
        if (pathMode === 'custom') {
          if (trimmedCustomPath) {
            payload.folderPath = trimmedCustomPath;
          }
        } else {
          // Send pathMode so backend knows where to place the domain folder
          // 'root' = ~/{domain}, 'public_html' = ~/public_html/{domain}
          payload.pathMode = pathMode;
        }
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
        setCreatedDomain(domain);
        setDomain('');
        setCustomFolderPath('');
        setSharedFolderPath('');
        setShareRoot(false);
        setPathMode('public_html');
        setSubdomain('');
        setNameservers('');
      } else {
        setCreatedDomain(domain);
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

        {/* DNS Instructions Panel - shown after domain creation */}
        {createdDomain && (
          <Card variant="outlined" sx={{ mb: 3, borderColor: 'success.main', borderWidth: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircleIcon color="success" />
                  <Typography variant="h6" fontWeight={600}>
                    Domain "{createdDomain}" Created Successfully!
                  </Typography>
                </Stack>

                <Alert severity="info" icon={false}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Next Steps: Update DNS at Your Domain Registrar
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    For <strong>{createdDomain}</strong> to resolve to your VPS, update DNS records at the registrar where you purchased the domain.
                  </Typography>
                </Alert>

                {/* Option A: Using A Records */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Option A: Point Domain via A Record
                  </Typography>
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.85em' }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" fontFamily="monospace">
                          Type: <strong>A</strong> &nbsp;|&nbsp; Host: <strong>@</strong> &nbsp;|&nbsp; Value: <strong>{serverIp || '(your VPS IP)'}</strong> &nbsp;|&nbsp; TTL: <strong>3600</strong>
                        </Typography>
                        {serverIp && (
                          <IconButton size="small" onClick={() => copyText(serverIp, 'ip')}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                      <Typography variant="body2" fontFamily="monospace">
                        Type: <strong>A</strong> &nbsp;|&nbsp; Host: <strong>www</strong> &nbsp;|&nbsp; Value: <strong>{serverIp || '(your VPS IP)'}</strong> &nbsp;|&nbsp; TTL: <strong>3600</strong>
                      </Typography>
                    </Stack>
                  </Box>
                  {copied === 'ip' && <Chip label="IP copied!" color="success" size="small" sx={{ mt: 0.5 }} />}
                </Box>

                {/* Option B: Custom Nameservers */}
                {vpsNameservers.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Option B: Use Your Custom Nameservers (Recommended)
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Change the domain's nameservers at your registrar to point to your VPS nameservers. This gives you full DNS control from this panel.
                    </Typography>
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                      {vpsNameservers.map((ns, i) => (
                        <Stack key={i} direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" fontFamily="monospace">
                            Nameserver {i + 1}: <strong>{ns}</strong>
                          </Typography>
                          <IconButton size="small" onClick={() => copyText(ns, `ns${i}`)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                    </Box>
                    {copied?.startsWith('ns') && <Chip label="Copied!" color="success" size="small" sx={{ mt: 0.5 }} />}
                  </Box>
                )}

                {/* Provider-specific instructions */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    How to Update DNS at Your Registrar
                  </Typography>

                  <Accordion variant="outlined" disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" fontWeight={500}>GoDaddy</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                        <li><Typography variant="body2">Log in to your GoDaddy account and go to <strong>My Products</strong></Typography></li>
                        <li><Typography variant="body2">Click <strong>DNS</strong> next to the domain</Typography></li>
                        <li><Typography variant="body2">To use A records: Add/Edit A records with Host <strong>@</strong> and <strong>www</strong> pointing to <strong>{serverIp || 'your VPS IP'}</strong></Typography></li>
                        <li><Typography variant="body2">To use custom nameservers: Click <strong>Nameservers</strong> → <strong>Change</strong> → <strong>Enter my own nameservers</strong> → Enter your NS records</Typography></li>
                      </Box>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion variant="outlined" disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" fontWeight={500}>Namecheap</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                        <li><Typography variant="body2">Log in to Namecheap and go to <strong>Domain List</strong></Typography></li>
                        <li><Typography variant="body2">Click <strong>Manage</strong> next to your domain</Typography></li>
                        <li><Typography variant="body2">For A records: Go to <strong>Advanced DNS</strong> tab → Add A records</Typography></li>
                        <li><Typography variant="body2">For nameservers: Under <strong>Nameservers</strong> → Select <strong>Custom DNS</strong> → Enter your nameservers</Typography></li>
                      </Box>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion variant="outlined" disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" fontWeight={500}>Cloudflare</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                        <li><Typography variant="body2">Log in to Cloudflare and select the domain</Typography></li>
                        <li><Typography variant="body2">Go to <strong>DNS</strong> → <strong>Records</strong></Typography></li>
                        <li><Typography variant="body2">Add A record: Name <strong>@</strong>, Content <strong>{serverIp || 'your VPS IP'}</strong>, Proxy status <strong>DNS only</strong></Typography></li>
                        <li><Typography variant="body2">Add A record: Name <strong>www</strong>, Content <strong>{serverIp || 'your VPS IP'}</strong></Typography></li>
                        <li><Typography variant="body2"><em>Note: If using custom nameservers, remove the domain from Cloudflare and update nameservers at the original registrar</em></Typography></li>
                      </Box>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion variant="outlined" disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" fontWeight={500}>Google Domains / Squarespace</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                        <li><Typography variant="body2">Go to <strong>domains.google.com</strong> (or Squarespace Domains)</Typography></li>
                        <li><Typography variant="body2">Click on the domain → <strong>DNS</strong></Typography></li>
                        <li><Typography variant="body2">Under <strong>Custom records</strong>: Add A record for <strong>@</strong> with value <strong>{serverIp || 'your VPS IP'}</strong></Typography></li>
                        <li><Typography variant="body2">For custom nameservers: <strong>DNS</strong> → <strong>Custom name servers</strong> → Switch to custom and add your NS records</Typography></li>
                      </Box>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion variant="outlined" disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" fontWeight={500}>Hostinger</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                        <li><Typography variant="body2">Log in to Hostinger and go to <strong>Domains</strong></Typography></li>
                        <li><Typography variant="body2">Click on the domain → <strong>DNS / Nameservers</strong></Typography></li>
                        <li><Typography variant="body2">For A records: Go to <strong>DNS Zone</strong> → Add A record pointing to <strong>{serverIp || 'your VPS IP'}</strong></Typography></li>
                        <li><Typography variant="body2">For nameservers: Under <strong>Nameservers</strong> → <strong>Change nameservers</strong> → Enter custom nameservers</Typography></li>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Box>

                <Alert severity="warning" icon={false}>
                  <Typography variant="body2">
                    <strong>DNS propagation can take 1-48 hours.</strong> During this time, the domain may not resolve to your server.
                    You can check propagation at{' '}
                    <Link href="https://www.whatsmydns.net/" target="_blank" rel="noopener">whatsmydns.net</Link>.
                  </Typography>
                </Alert>

                <Stack direction="row" spacing={2}>
                  <Button variant="contained" onClick={() => navigate('/domains')}>
                    Go to Domains
                  </Button>
                  <Button variant="outlined" onClick={() => setCreatedDomain(null)}>
                    Create Another Domain
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

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
                          placeholder="/custom/path/to/document-root"
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
                    <Typography variant="subtitle2" fontWeight={600}>Nameservers</Typography>
                    <IconButton size="small"><InfoOutlinedIcon fontSize="small" /></IconButton>
                  </Stack>
                  {vpsNameservers.length > 0 ? (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 1, fontWeight: 500 }}>
                      ✅ Your VPS nameservers are configured: {vpsNameservers.join(', ')}
                      {serverIp ? ` (IP: ${serverIp})` : ''}. All new domains will automatically use these nameservers and be configured for internet accessibility.
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1, fontWeight: 500 }}>
                      ⚠️ No VPS nameservers configured. Go to Settings → Nameservers to set up your VPS nameservers for proper internet accessibility.
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Override with custom nameservers only if needed. Leave blank to use your VPS nameservers{vpsNameservers.length > 0 ? ` (${vpsNameservers.join(', ')})` : ''}.
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={nameservers}
                    onChange={(e) => setNameservers(e.target.value)}
                    disabled={submitting}
                    placeholder={vpsNameservers.length > 0 ? vpsNameservers.join('\n') : `ns1.${domain || 'example.com'}\nns2.${domain || 'example.com'}`}
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