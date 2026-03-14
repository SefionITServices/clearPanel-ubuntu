import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  CircularProgress,
  Button,
  Switch,
  TextField,
  Snackbar,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { domainsApi } from '../api/domains';
import { errorPagesApi } from '../api/error-pages';

const ERROR_CODES = [
  { code: '404', label: '404 Not Found', desc: 'When the requested file or path does not exist.' },
  { code: '500', label: '500 Internal Server Error', desc: 'When a script crashes or backend fails.' },
  { code: '503', label: '503 Service Unavailable', desc: 'When the server is temporarily overloaded or down for maintenance.' },
];

const DEFAULT_HTML: Record<string, string> = {
  '404': `<!DOCTYPE html>\n<html>\n<head>\n  <title>404 Not Found</title>\n  <style>\n    body { font-family: sans-serif; text-align: center; padding: 50px; }\n    h1 { font-size: 50px; }\n  </style>\n</head>\n<body>\n  <h1>404</h1>\n  <h2>Page Not Found</h2>\n  <p>The requested URL was not found on this server.</p>\n</body>\n</html>`,
  '500': `<!DOCTYPE html>\n<html>\n<head>\n  <title>500 Internal Server Error</title>\n  <style>\n    body { font-family: sans-serif; text-align: center; padding: 50px; }\n    h1 { font-size: 50px; }\n  </style>\n</head>\n<body>\n  <h1>500</h1>\n  <h2>Internal Server Error</h2>\n  <p>The server encountered an internal error or misconfiguration.</p>\n</body>\n</html>`,
  '503': `<!DOCTYPE html>\n<html>\n<head>\n  <title>503 Service Unavailable</title>\n  <style>\n    body { font-family: sans-serif; text-align: center; padding: 50px; }\n    h1 { font-size: 50px; }\n  </style>\n</head>\n<body>\n  <h1>503</h1>\n  <h2>Service Unavailable</h2>\n  <p>The server is temporarily unable to service your request.</p>\n</body>\n</html>`,
};

function ErrorPageEditor({
  domain,
  codeConfig,
  initialData,
  onSave,
}: {
  domain: string;
  codeConfig: typeof ERROR_CODES[0];
  initialData?: any;
  onSave: () => void;
}) {
  const [html, setHtml] = useState(initialData?.html || DEFAULT_HTML[codeConfig.code]);
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Update state when initialData changes due to a re-fetch
  useEffect(() => {
    if (initialData) {
      setHtml(initialData.html);
      setEnabled(initialData.enabled);
    } else {
      setHtml(DEFAULT_HTML[codeConfig.code]);
      setEnabled(true);
    }
  }, [initialData, codeConfig.code]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await errorPagesApi.save({
        domain,
        code: codeConfig.code,
        html,
        enabled,
      });
      onSave(); // trigger refresh and toast
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = () => {
    setHtml(DEFAULT_HTML[codeConfig.code]);
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Error {codeConfig.code}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {codeConfig.desc}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Enabled
            </Typography>
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              color="primary"
            />
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          multiline
          fullWidth
          variant="outlined"
          rows={12}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          sx={{
            mb: 2,
            fontFamily: 'monospace',
            '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '13px' },
          }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !domain}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outlined" color="inherit" onClick={handleRestore}>
            Restore Default
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function ErrorPages() {
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [pages, setPages] = useState<any[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadDomains();
  }, []);

  useEffect(() => {
    if (selectedDomain) loadPages(selectedDomain);
  }, [selectedDomain]);

  const loadDomains = async () => {
    try {
      const data = await domainsApi.list();
      const domainNames = Array.isArray(data) ? data.map((d: any) => d.name) : [];
      setDomains(domainNames);
      if (domainNames.length > 0 && !selectedDomain) {
        setSelectedDomain(domainNames[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadPages = async (domain: string) => {
    setLoadingPages(true);
    try {
      const res = await errorPagesApi.list(domain);
      setPages(res.pages || []);
    } catch {
      setPages([]);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleSaved = () => {
    setToast('Error page updated and Nginx reloaded successfully');
    loadPages(selectedDomain);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Custom Error Pages
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Customize the HTML served for common HTTP error codes. These overrides are injected directly into your Nginx configuration.
          </Typography>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Domain</InputLabel>
              <Select
                value={selectedDomain}
                label="Select Domain"
                onChange={(e) => setSelectedDomain(e.target.value)}
              >
                {domains.length === 0 ? (
                  <MenuItem disabled value="">No domains found</MenuItem>
                ) : (
                  domains.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {selectedDomain ? (
          loadingPages ? (
            <CircularProgress />
          ) : (
            <Stack spacing={0}>
              {ERROR_CODES.map((codeConfig) => {
                const existing = pages.find((p) => p.code === codeConfig.code);
                return (
                  <ErrorPageEditor
                    key={codeConfig.code}
                    domain={selectedDomain}
                    codeConfig={codeConfig}
                    initialData={existing}
                    onSave={handleSaved}
                  />
                );
              })}
            </Stack>
          )
        ) : (
          <Alert severity="info">Please select a domain to manage error pages.</Alert>
        )}
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
      />
    </DashboardLayout>
  );
}
