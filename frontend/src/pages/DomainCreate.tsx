import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Paper,
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
  Tabs,
  Tab,
  Select,
  MenuItem as MuiMenuItem,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { useAuth } from '../auth/AuthContext';
import { domainsApi } from '../api/domains';
import { serverApi } from '../api/server';

// Backend defaults to ~/public_html/{domain} if no path provided.
// We dynamically discover the primary domain to offer an accurate shared-path option.

interface DomainInfo {
  name: string;
  folderPath: string;
}

export default function DomainCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { username } = useAuth();
  const [domainType, setDomainType] = useState<'addon' | 'subdomain'>(
    searchParams.get('type') === 'subdomain' ? 'subdomain' : 'addon'
  );
  const [domain, setDomain] = useState('');
  const [subdomainPrefix, setSubdomainPrefix] = useState('');
  const [parentDomain, setParentDomain] = useState('');
  const [shareRoot, setShareRoot] = useState(false);
  const [pathMode, setPathMode] = useState<'public_html' | 'root' | 'websites' | 'custom'>('public_html');
  const [customFolderPath, setCustomFolderPath] = useState('');
  const [sharedFolderPath, setSharedFolderPath] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [nameservers, setNameservers] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState<DomainInfo | null>(null);
  const [allDomains, setAllDomains] = useState<DomainInfo[]>([]);
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
        const data = await domainsApi.list();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const domainList = data as DomainInfo[];
          setAllDomains(domainList);
          const primary = domainList[0];
          setPrimaryDomain(primary);
          setParentDomain(primary.name);
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
        const data = await serverApi.getNameservers();
        if (data.settings?.nameservers?.length) {
          setVpsNameservers(data.settings.nameservers);
        }
        if (data.settings?.serverIp) {
          setServerIp(data.settings.serverIp);
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
    // Compute the final domain name based on type
    const finalDomainName = domainType === 'subdomain'
      ? `${subdomainPrefix}.${parentDomain}`
      : domain;

    if (!finalDomainName || (domainType === 'subdomain' && (!subdomainPrefix || !parentDomain))) return;
    setSubmitting(true);
    try {
      const payload: { name: string; folderPath?: string; pathMode?: string; nameservers?: string[] } = { name: finalDomainName };
      const trimmedSharedPath = sharedFolderPath.trim();
      const trimmedCustomPath = customFolderPath.trim();

      if (domainType === 'addon') {
        if (shareRoot) {
          if (!trimmedSharedPath) {
            alert('Enter the document root path you want to share, or disable "Share document root".');
            return;
          }
          payload.folderPath = trimmedSharedPath;
        } else {
          if (pathMode === 'websites') {
            payload.folderPath = `/home/${username || 'root'}/websites/${finalDomainName}`;
          } else if (pathMode === 'custom') {
            if (trimmedCustomPath) {
              payload.folderPath = trimmedCustomPath;
            }
          } else {
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
      }
      // Subdomains: pathMode defaults to public_html subfolder

      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        alert(`Failed to create ${domainType}: ${errorText}`);
        return;
      }

      if (createAnother) {
        setCreatedDomain(finalDomainName);
        setDomain('');
        setSubdomainPrefix('');
        setCustomFolderPath('');
        setSharedFolderPath('');
        setShareRoot(false);
        setPathMode('public_html');
        setSubdomain('');
        setNameservers('');
      } else {
        setCreatedDomain(finalDomainName);
      }
    } catch (err) {
      alert('Error creating domain. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LanguageIcon sx={{ color: '#34A853', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {domainType === 'subdomain' ? 'Create Subdomain' : 'Create Domain'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {domainType === 'subdomain'
                  ? 'Add a new subdomain under an existing domain'
                  : 'Add a new addon domain to your server'}
              </Typography>
            </Box>
          </Box>
          <Button variant="outlined" onClick={() => navigate('/domains')} sx={{ textTransform: 'none' }}>
            Back to Domains
          </Button>
        </Box>

        {/* Domain Type Toggle */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={domainType}
            onChange={(_, v) => { setDomainType(v); setDomain(''); setSubdomainPrefix(''); setCreatedDomain(null); }}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab value="addon" label="Addon Domain" icon={<AddIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
            <Tab value="subdomain" label="Subdomain" icon={<SubdirectoryArrowRightIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
          </Tabs>
        </Paper>

        {/* DNS Instructions Panel - shown after domain creation */}
        {createdDomain && (
          <Paper sx={{ mb: 3, border: '2px solid #34A853', overflow: 'hidden' }}>
            <Box sx={{ p: 3 }}>
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
            </Box>
          </Paper>
        )}

        <Paper sx={{ mb: 4, overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f8f9fa' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {domainType === 'subdomain' ? 'Subdomain Configuration' : 'Domain Configuration'}
            </Typography>
          </Box>
          <Box sx={{ p: 3 }}>
            <Stack spacing={3}>

              {/* ---- SUBDOMAIN MODE ---- */}
              {domainType === 'subdomain' && (
                <>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Subdomain Name</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Enter the subdomain prefix (e.g. "blog", "shop", "api"):
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        sx={{ flex: 1 }}
                        placeholder="blog"
                        value={subdomainPrefix}
                        onChange={(e) => setSubdomainPrefix(e.target.value.trim().toLowerCase())}
                        disabled={submitting}
                      />
                      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>.</Typography>
                      <TextField
                        select
                        value={parentDomain}
                        onChange={(e) => setParentDomain(e.target.value)}
                        disabled={submitting || allDomains.length === 0}
                        sx={{ minWidth: 220 }}
                      >
                        {allDomains.map((d) => (
                          <MuiMenuItem key={d.name} value={d.name}>{d.name}</MuiMenuItem>
                        ))}
                      </TextField>
                    </Stack>
                    {subdomainPrefix && parentDomain && (
                      <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'block' }}>
                        Will create: <strong>{subdomainPrefix}.{parentDomain}</strong>
                      </Typography>
                    )}
                  </Box>

                  <Divider />

                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      disabled={!subdomainPrefix || !parentDomain || submitting}
                      onClick={() => handleSubmit(false)}
                      sx={{ textTransform: 'none' }}
                    >
                      Create Subdomain
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={!subdomainPrefix || !parentDomain || submitting}
                      onClick={() => handleSubmit(true)}
                      sx={{ textTransform: 'none' }}
                    >
                      Create & Add Another
                    </Button>
                  </Stack>
                </>
              )}

              {/* ---- ADDON DOMAIN MODE ---- */}
              {domainType === 'addon' && (
                <>
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
                              <LanguageIcon fontSize="small" />
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
                          value="websites"
                          control={<Radio />}
                          label={
                            <Typography variant="body2">
                              Inside websites folder <Typography component="span" variant="caption" color="text.secondary">(/home/{username || 'user'}/websites/{domain || 'example.com'})</Typography>
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
                                <LanguageIcon fontSize="small" />
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
                </Box>

                <Divider />

                {/* Actions */}
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    disabled={!domain || submitting}
                    onClick={() => handleSubmit(false)}
                    sx={{ textTransform: 'none' }}
                  >
                    Submit
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!domain || submitting}
                    onClick={() => handleSubmit(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    Submit And Create Another
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Link component="button" type="button" underline="none" onClick={() => navigate('/domains')} sx={{ alignSelf: 'center' }}>
                    Return To Domains
                  </Link>
                </Stack>
                </>
              )}
              </Stack>
            </Box>
          </Paper>
      </Box>
    </DashboardLayout>
  );
}