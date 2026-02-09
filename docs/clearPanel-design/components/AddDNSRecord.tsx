import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Paper,
  Typography,
  IconButton,
  TextField,
  Button,
  MenuItem,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Grid,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface AddDNSRecordProps {
  onClose: () => void;
  domain: string;
}

export function AddDNSRecord({ onClose, domain }: AddDNSRecordProps) {
  const [recordType, setRecordType] = useState<string>('A');
  const [formData, setFormData] = useState({
    name: domain,
    value: '',
    ttl: '14400',
    priority: '10',
  });

  const recordTypes = [
    { value: 'A', label: 'A - IPv4 Address' },
    { value: 'AAAA', label: 'AAAA - IPv6 Address' },
    { value: 'CNAME', label: 'CNAME - Canonical Name' },
    { value: 'MX', label: 'MX - Mail Exchange' },
    { value: 'TXT', label: 'TXT - Text Record' },
    { value: 'NS', label: 'NS - Name Server' },
    { value: 'SRV', label: 'SRV - Service' },
    { value: 'CAA', label: 'CAA - Certificate Authority' },
  ];

  const ttlPresets = [
    { value: '300', label: '5 minutes' },
    { value: '3600', label: '1 hour' },
    { value: '14400', label: '4 hours' },
    { value: '43200', label: '12 hours' },
    { value: '86400', label: '24 hours' },
  ];

  const handleChange = (field: string) => (event: any) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  const handleSubmit = () => {
    console.log('DNS Record submitted:', { type: recordType, ...formData });
    onClose();
  };

  const getRecordDescription = () => {
    switch (recordType) {
      case 'A':
        return 'An A record maps a domain name to an IPv4 address. Example: 192.168.1.1';
      case 'AAAA':
        return 'An AAAA record maps a domain name to an IPv6 address. Example: 2001:0db8:85a3::8a2e:0370:7334';
      case 'CNAME':
        return 'A CNAME record creates an alias for another domain name. Example: www.example.com';
      case 'MX':
        return 'An MX record specifies the mail server responsible for accepting emails. Example: mail.example.com';
      case 'TXT':
        return 'A TXT record stores text information. Commonly used for SPF, DKIM, and domain verification.';
      case 'NS':
        return 'An NS record delegates a subdomain to a set of name servers. Example: ns1.example.com';
      case 'SRV':
        return 'An SRV record defines the location of servers for specified services.';
      case 'CAA':
        return 'A CAA record specifies which certificate authorities are allowed to issue certificates for your domain.';
      default:
        return '';
    }
  };

  const getValuePlaceholder = () => {
    switch (recordType) {
      case 'A':
        return '192.168.1.1';
      case 'AAAA':
        return '2001:0db8:85a3::8a2e:0370:7334';
      case 'CNAME':
        return 'example.com';
      case 'MX':
        return 'mail.example.com';
      case 'TXT':
        return 'v=spf1 include:_spf.example.com ~all';
      case 'NS':
        return 'ns1.example.com';
      case 'SRV':
        return '10 5 5060 sipserver.example.com';
      case 'CAA':
        return '0 issue "letsencrypt.org"';
      default:
        return '';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Add DNS Record
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            DNS changes may take 24-48 hours to propagate. Make sure you understand the record type before adding.
          </Typography>
        </Alert>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Record Details
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Record Type</InputLabel>
                <Select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value)}
                  label="Record Type"
                >
                  {recordTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info" sx={{ bgcolor: '#f5f5f5' }}>
                <Typography variant="body2">{getRecordDescription()}</Typography>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={handleChange('name')}
                helperText="Enter the subdomain or @ for root domain"
                placeholder={domain}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Value"
                value={formData.value}
                onChange={handleChange('value')}
                placeholder={getValuePlaceholder()}
                helperText={`Enter the ${recordType} record value`}
                multiline={recordType === 'TXT'}
                rows={recordType === 'TXT' ? 3 : 1}
                required
              />
            </Grid>

            <Grid item xs={12} md={recordType === 'MX' || recordType === 'SRV' ? 6 : 12}>
              <FormControl fullWidth>
                <InputLabel>TTL (Time To Live)</InputLabel>
                <Select value={formData.ttl} onChange={handleChange('ttl')} label="TTL (Time To Live)">
                  {ttlPresets.map((preset) => (
                    <MenuItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {(recordType === 'MX' || recordType === 'SRV') && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Priority"
                  value={formData.priority}
                  onChange={handleChange('priority')}
                  helperText="Lower values have higher priority"
                />
              </Grid>
            )}
          </Grid>

          <Box sx={{ mt: 4, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Preview
            </Typography>
            <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              <Box sx={{ mb: 0.5 }}>
                <Typography component="span" sx={{ color: '#4285F4', fontWeight: 600 }}>
                  Type:{' '}
                </Typography>
                <Typography component="span">{recordType}</Typography>
              </Box>
              <Box sx={{ mb: 0.5 }}>
                <Typography component="span" sx={{ color: '#4285F4', fontWeight: 600 }}>
                  Name:{' '}
                </Typography>
                <Typography component="span">{formData.name || domain}</Typography>
              </Box>
              <Box sx={{ mb: 0.5 }}>
                <Typography component="span" sx={{ color: '#4285F4', fontWeight: 600 }}>
                  Value:{' '}
                </Typography>
                <Typography component="span">{formData.value || 'Not set'}</Typography>
              </Box>
              <Box sx={{ mb: 0.5 }}>
                <Typography component="span" sx={{ color: '#4285F4', fontWeight: 600 }}>
                  TTL:{' '}
                </Typography>
                <Typography component="span">
                  {ttlPresets.find((p) => p.value === formData.ttl)?.label}
                </Typography>
              </Box>
              {(recordType === 'MX' || recordType === 'SRV') && (
                <Box>
                  <Typography component="span" sx={{ color: '#4285F4', fontWeight: 600 }}>
                    Priority:{' '}
                  </Typography>
                  <Typography component="span">{formData.priority}</Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!formData.value}
              sx={{ textTransform: 'none' }}
            >
              Add Record
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Quick Tips
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              • Use @ or leave blank for the root domain
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • CNAME records cannot be used with the root domain
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Lower TTL values allow faster DNS updates but increase server load
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • For MX records, lower priority numbers are preferred
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Always end domain names with a dot (.) to specify fully qualified domain names
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
