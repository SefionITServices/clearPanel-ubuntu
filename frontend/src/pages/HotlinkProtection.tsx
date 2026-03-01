import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { hotlinkApi } from '../api/hotlink';
import { domainsApi } from '../api/domains';

const DEFAULT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 'mp4', 'mp3', 'pdf', 'zip'];

interface HotlinkConfig {
  domain: string;
  enabled: boolean;
  allowedDomains: string[];
  blockExtensions: string[];
  updatedAt: string;
}

export default function HotlinkProtectionPage() {
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [config, setConfig] = useState<HotlinkConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // form state
  const [enabled, setEnabled] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [blockExtensions, setBlockExtensions] = useState<string[]>(DEFAULT_EXTENSIONS);
  const [newAllowed, setNewAllowed] = useState('');
  const [newExt, setNewExt] = useState('');

  useEffect(() => {
    domainsApi.list().then((data: any) => {
      const dl = data.domains ?? data ?? [];
      const names = dl.map((d: any) => d.name ?? d);
      setDomains(names);
      if (names.length > 0) setSelectedDomain(names[0]);
    }).catch(() => {});
  }, []);

  const loadConfig = useCallback(async () => {
    if (!selectedDomain) return;
    setLoading(true);
    setError(null);
    try {
      const data = await hotlinkApi.get(selectedDomain);
      const cfg: HotlinkConfig = data.config;
      setConfig(cfg);
      setEnabled(cfg.enabled);
      setAllowedDomains(cfg.allowedDomains);
      setBlockExtensions(cfg.blockExtensions.length > 0 ? cfg.blockExtensions : DEFAULT_EXTENSIONS);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDomain]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await hotlinkApi.set({
        domain: selectedDomain,
        enabled,
        allowedDomains,
        blockExtensions,
      });
      setSuccess(enabled ? 'Hotlink protection enabled' : 'Hotlink protection disabled');
      loadConfig();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addAllowedDomain = () => {
    const d = newAllowed.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (d && !allowedDomains.includes(d)) {
      setAllowedDomains([...allowedDomains, d]);
    }
    setNewAllowed('');
  };

  const removeAllowedDomain = (d: string) =>
    setAllowedDomains(allowedDomains.filter((x) => x !== d));

  const toggleExt = (ext: string) => {
    setBlockExtensions(
      blockExtensions.includes(ext)
        ? blockExtensions.filter((e) => e !== ext)
        : [...blockExtensions, ext],
    );
  };

  const addExt = () => {
    const e = newExt.trim().toLowerCase().replace(/^\./, '');
    if (e && !blockExtensions.includes(e)) {
      setBlockExtensions([...blockExtensions, e]);
    }
    setNewExt('');
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={3}>
          <LinkOffIcon color="warning" sx={{ fontSize: 32 }} />
          <Box flex={1}>
            <Typography variant="h5" fontWeight={700}>Hotlink Protection</Typography>
            <Typography variant="body2" color="text.secondary">
              Prevent external sites from embedding your images and files
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Domain</InputLabel>
            <Select
              value={selectedDomain}
              label="Domain"
              onChange={(e) => setSelectedDomain(e.target.value)}
            >
              {domains.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <Tooltip title="Refresh"><IconButton onClick={loadConfig}><RefreshIcon /></IconButton></Tooltip>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>
        ) : (
          <Stack spacing={3}>
            {/* Toggle */}
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>Enable Hotlink Protection</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Block external referrers from loading your files directly
                    </Typography>
                  </Box>
                  <Switch
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    color="warning"
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Protected extensions */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  Protected File Extensions
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" mb={2} useFlexGap>
                  {DEFAULT_EXTENSIONS.map((ext) => (
                    <Chip
                      key={ext}
                      label={`.${ext}`}
                      size="small"
                      color={blockExtensions.includes(ext) ? 'primary' : 'default'}
                      onClick={() => toggleExt(ext)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
                {/* Custom extensions */}
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    placeholder="e.g. webp"
                    value={newExt}
                    onChange={(e) => setNewExt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addExt()}
                    sx={{ maxWidth: 140 }}
                  />
                  <Button size="small" startIcon={<AddIcon />} onClick={addExt}>Add</Button>
                </Stack>
                {/* Custom added extensions */}
                {blockExtensions.filter((e) => !DEFAULT_EXTENSIONS.includes(e)).length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" mt={1} useFlexGap>
                    {blockExtensions.filter((e) => !DEFAULT_EXTENSIONS.includes(e)).map((ext) => (
                      <Chip
                        key={ext}
                        label={`.${ext}`}
                        size="small"
                        color="primary"
                        onDelete={() => toggleExt(ext)}
                      />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Allowed domains */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={0.5}>
                  Allowed Referrer Domains
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  These domains will be allowed to hotlink your files (e.g. CDN, sister sites)
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" mb={2} useFlexGap>
                  {allowedDomains.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Only your own domain is allowed (default)
                    </Typography>
                  ) : allowedDomains.map((d) => (
                    <Chip key={d} label={d} size="small" onDelete={() => removeAllowedDomain(d)} />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    placeholder="partner.com"
                    value={newAllowed}
                    onChange={(e) => setNewAllowed(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAllowedDomain()}
                    sx={{ maxWidth: 220 }}
                  />
                  <Button size="small" startIcon={<AddIcon />} onClick={addAllowedDomain}>Add</Button>
                </Stack>
              </CardContent>
            </Card>

            <Button
              variant="contained"
              color="warning"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              disabled={saving || !selectedDomain}
              onClick={handleSave}
              sx={{ alignSelf: 'flex-start' }}
            >
              {saving ? 'Saving…' : 'Save Configuration'}
            </Button>
          </Stack>
        )}

        <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess(null)} message={success} />
      </Box>
    </DashboardLayout>
  );
}
