import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Paper,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  CheckCircle as PassIcon,
  Warning as WarnIcon,
  Error as FailIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { mailAPI, DeliverabilityReport, DeliverabilityCheckItem } from '../../api/mail';

interface DeliverabilityWizardModalProps {
  open: boolean;
  onClose: () => void;
  domainId: string;
  domainName: string;
  allDomains?: { id: string; domain: string }[];
  onSelectDomain?: (id: string, domain: string) => void;
}

export const DeliverabilityWizardModal: React.FC<DeliverabilityWizardModalProps> = ({
  open,
  onClose,
  domainId,
  domainName,
  allDomains,
  onSelectDomain,
}) => {
  const [report, setReport] = useState<DeliverabilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchDeliverability = async (targetId: string) => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await mailAPI.checkDeliverability(targetId);
      setReport(data);
    } catch (e: any) {
      setError(e.message || 'Failed to inspect DNS deliverability records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && domainId) {
      fetchDeliverability(domainId);
    }
  }, [open, domainId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getStatusChip = (status: 'pass' | 'warn' | 'fail') => {
    if (status === 'pass') {
      return (
        <Chip
          icon={<PassIcon sx={{ fontSize: '16px !important' }} />}
          label="VERIFIED"
          size="small"
          color="success"
          sx={{ fontWeight: 600, fontSize: '0.75rem', height: 24 }}
        />
      );
    }
    if (status === 'warn') {
      return (
        <Chip
          icon={<WarnIcon sx={{ fontSize: '16px !important' }} />}
          label="WARNING"
          size="small"
          color="warning"
          sx={{ fontWeight: 600, fontSize: '0.75rem', height: 24 }}
        />
      );
    }
    return (
      <Chip
        icon={<FailIcon sx={{ fontSize: '16px !important' }} />}
        label="MISSING"
        size="small"
        color="error"
        sx={{ fontWeight: 600, fontSize: '0.75rem', height: 24 }}
      />
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#34A853'; // Google Green
    if (score >= 65) return '#FBBC04'; // Google Yellow
    return '#EA4335'; // Google Red
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8f9fa' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: '#e8f0fe', color: '#1a73e8', display: 'flex' }}>
            <ShieldIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Email Deliverability & DNS Wizard
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Reverse-engineered Google Workspace SPF, DKIM, DMARC & MX validator
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {/* Domain Selector & Refresh */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          {allDomains && allDomains.length > 1 ? (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Selected Domain</InputLabel>
              <Select
                value={domainId}
                label="Selected Domain"
                onChange={(e) => {
                  const selected = allDomains.find(d => d.id === e.target.value);
                  if (selected && onSelectDomain) {
                    onSelectDomain(selected.id, selected.domain);
                  }
                }}
              >
                {allDomains.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.domain}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Domain: <span style={{ color: '#1a73e8' }}>{domainName}</span>
            </Typography>
          )}

          <Button
            size="small"
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => fetchDeliverability(domainId)}
            disabled={loading}
          >
            Re-check Live DNS
          </Button>
        </Box>

        {loading && !report ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={40} sx={{ color: '#1a73e8' }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Querying live DNS resolvers for MX, SPF, DKIM, DMARC & PTR...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : report ? (
          <>
            {/* Score Banner */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: 2,
                border: '1px solid',
                borderColor: getScoreColor(report.score) + '40',
                bgcolor: getScoreColor(report.score) + '0D',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: getScoreColor(report.score), lineHeight: 1 }}>
                  {report.score}%
                </Typography>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: getScoreColor(report.score) }}>
                  {report.rating}
                </Typography>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124', mb: 0.5 }}>
                  {report.score >= 90
                    ? '🎉 Excellent Deliverability — Ready for Business Inboxes'
                    : report.score >= 65
                    ? '⚠️ Good — Minor DNS adjustments recommended to avoid spam folders'
                    : '🚨 Critical DNS Misconfigurations — High risk of rejected or spam mail'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Checked on {new Date(report.checkedAt).toLocaleTimeString()} against server IP {report.serverIp}.
                  Ensure all 5 records below are published on your DNS provider (Cloudflare, Route53, Namecheap, etc.).
                </Typography>
              </Box>
            </Paper>

            {/* Verification Checklist */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', fontSize: '0.75rem' }}>
              Authentication Protocol Status
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {report.items.map((item) => (
                <Paper
                  key={item.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: item.status === 'fail' ? '#fff9f9' : item.status === 'warn' ? '#fffdf5' : '#ffffff',
                    borderLeft: '4px solid',
                    borderLeftColor: item.status === 'pass' ? '#34A853' : item.status === 'warn' ? '#FBBC04' : '#EA4335',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                      <Chip label={item.recordType} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                    </Box>
                    {getStatusChip(item.status)}
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.85rem' }}>
                    {item.description}
                  </Typography>

                  {/* Recommendation / Current vs Expected */}
                  <Box sx={{ p: 1.5, bgcolor: '#f8f9fa', borderRadius: 1.5, border: '1px solid #e9ecef', fontSize: '0.8rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: item.currentValue ? 1 : 0 }}>
                      <Box sx={{ flex: 1, pr: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          RECOMMENDED DNS RECORD:
                        </Typography>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', color: '#1a73e8' }}>
                          <strong>Host:</strong> {item.expectedHost} &nbsp;|&nbsp; <strong>Value:</strong> {item.expectedValue}
                        </Typography>
                      </Box>
                      <Tooltip title={copiedKey === item.id ? 'Copied!' : 'Copy Value'}>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(item.expectedValue, item.id)}
                          sx={{ color: copiedKey === item.id ? 'success.main' : 'default' }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {item.currentValue && (
                      <Box sx={{ pt: 1, borderTop: '1px dashed #dee2e6' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          DETECTED IN LIVE DNS:
                        </Typography>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', color: item.status === 'pass' ? '#2e7d32' : '#d32f2f' }}>
                          {item.currentValue}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" sx={{ color: item.status === 'pass' ? '#2e7d32' : 'text.primary', fontWeight: 500 }}>
                        {item.recommendation}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#f8f9fa', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          DNS changes propagate globally within 5 minutes to 24 hours.
        </Typography>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#1a73e8', textTransform: 'none' }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

