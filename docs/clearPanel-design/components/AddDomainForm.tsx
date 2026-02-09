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
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  MenuItem,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  FormGroup,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface AddDomainFormProps {
  onClose: () => void;
  type: 'addon' | 'subdomain' | 'parked';
}

export function AddDomainForm({ onClose, type }: AddDomainFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    domainName: '',
    subdomain: '',
    parentDomain: 'mainserver.in',
    documentRoot: '',
    ftpUsername: '',
    ftpPassword: '',
    createFtp: true,
    createDatabase: false,
    databaseName: '',
    enableSsl: true,
  });

  const steps = ['Domain Details', 'Additional Settings', 'Review'];

  const availableDomains = ['mainserver.in', 'myaddondomain.com'];

  const handleChange = (field: string) => (event: any) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = () => {
    // Submit logic here
    console.log('Form submitted:', formData);
    onClose();
  };

  const getTitle = () => {
    switch (type) {
      case 'addon':
        return 'Add Addon Domain';
      case 'subdomain':
        return 'Create Subdomain';
      case 'parked':
        return 'Park Domain';
      default:
        return 'Add Domain';
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                {type === 'addon' &&
                  'An addon domain allows you to host multiple domains from a single hosting account.'}
                {type === 'subdomain' &&
                  'A subdomain is a subset of your main domain (e.g., blog.yourdomain.com).'}
                {type === 'parked' &&
                  'A parked domain will display the same content as your primary domain.'}
              </Typography>
            </Alert>

            {type === 'addon' && (
              <>
                <TextField
                  fullWidth
                  label="New Domain Name"
                  placeholder="example.com"
                  value={formData.domainName}
                  onChange={handleChange('domainName')}
                  helperText="Enter the domain name without www (e.g., example.com)"
                  sx={{ mb: 3 }}
                  required
                />
                <TextField
                  fullWidth
                  label="Subdomain (Optional)"
                  placeholder="subdomain"
                  value={formData.subdomain}
                  onChange={handleChange('subdomain')}
                  helperText="This creates a subdomain on your main domain that redirects to this addon domain"
                  sx={{ mb: 3 }}
                />
              </>
            )}

            {type === 'subdomain' && (
              <>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <TextField
                    label="Subdomain"
                    placeholder="blog"
                    value={formData.subdomain}
                    onChange={handleChange('subdomain')}
                    sx={{ flex: 1 }}
                    required
                  />
                  <Typography variant="h5" sx={{ alignSelf: 'center' }}>
                    .
                  </Typography>
                  <TextField
                    select
                    label="Domain"
                    value={formData.parentDomain}
                    onChange={handleChange('parentDomain')}
                    sx={{ flex: 2 }}
                    required
                  >
                    {availableDomains.map((domain) => (
                      <MenuItem key={domain} value={domain}>
                        {domain}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    Full subdomain will be: <strong>{formData.subdomain || 'subdomain'}.{formData.parentDomain}</strong>
                  </Typography>
                </Alert>
              </>
            )}

            {type === 'parked' && (
              <TextField
                fullWidth
                label="Domain to Park"
                placeholder="example.com"
                value={formData.domainName}
                onChange={handleChange('domainName')}
                helperText="This domain will display the same content as your primary domain"
                sx={{ mb: 3 }}
                required
              />
            )}

            {type !== 'parked' && (
              <TextField
                fullWidth
                label="Document Root"
                placeholder={
                  type === 'addon'
                    ? '/home/hadm751/example.com'
                    : '/home/hadm751/public_html/subdomain'
                }
                value={formData.documentRoot}
                onChange={handleChange('documentRoot')}
                helperText="Directory where files for this domain will be stored"
                sx={{ mb: 2 }}
                required
              />
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            {type !== 'parked' && (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  FTP Account
                </Typography>
                <FormGroup sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.createFtp}
                        onChange={handleChange('createFtp')}
                      />
                    }
                    label="Create FTP account for this domain"
                  />
                </FormGroup>

                {formData.createFtp && (
                  <Box sx={{ pl: 4, mb: 3 }}>
                    <TextField
                      fullWidth
                      label="FTP Username"
                      value={formData.ftpUsername}
                      onChange={handleChange('ftpUsername')}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      type="password"
                      label="FTP Password"
                      value={formData.ftpPassword}
                      onChange={handleChange('ftpPassword')}
                    />
                  </Box>
                )}

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Database
                </Typography>
                <FormGroup sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.createDatabase}
                        onChange={handleChange('createDatabase')}
                      />
                    }
                    label="Create MySQL database for this domain"
                  />
                </FormGroup>

                {formData.createDatabase && (
                  <Box sx={{ pl: 4, mb: 3 }}>
                    <TextField
                      fullWidth
                      label="Database Name"
                      value={formData.databaseName}
                      onChange={handleChange('databaseName')}
                      helperText="Database will be prefixed with your username"
                    />
                  </Box>
                )}

                <Divider sx={{ my: 3 }} />
              </>
            )}

            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              SSL/TLS
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox checked={formData.enableSsl} onChange={handleChange('enableSsl')} />
                }
                label="Enable SSL/TLS (Let's Encrypt)"
              />
            </FormGroup>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 4, display: 'block' }}>
              Free SSL certificate will be automatically installed and renewed
            </Typography>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
              Review your settings before creating the domain
            </Alert>

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Domain Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 1, mt: 1 }}>
                {type === 'addon' && (
                  <>
                    <Typography variant="body2" fontWeight={600}>
                      Domain Name:
                    </Typography>
                    <Typography variant="body2">{formData.domainName || 'Not specified'}</Typography>
                  </>
                )}
                {type === 'subdomain' && (
                  <>
                    <Typography variant="body2" fontWeight={600}>
                      Subdomain:
                    </Typography>
                    <Typography variant="body2">
                      {formData.subdomain || 'subdomain'}.{formData.parentDomain}
                    </Typography>
                  </>
                )}
                {type === 'parked' && (
                  <>
                    <Typography variant="body2" fontWeight={600}>
                      Parked Domain:
                    </Typography>
                    <Typography variant="body2">{formData.domainName || 'Not specified'}</Typography>
                  </>
                )}
                {type !== 'parked' && (
                  <>
                    <Typography variant="body2" fontWeight={600}>
                      Document Root:
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {formData.documentRoot || 'Not specified'}
                    </Typography>
                  </>
                )}
              </Box>
            </Paper>

            {type !== 'parked' && (
              <>
                {formData.createFtp && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      FTP Account
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 1, mt: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        Username:
                      </Typography>
                      <Typography variant="body2">{formData.ftpUsername || 'Auto-generated'}</Typography>
                    </Box>
                  </Paper>
                )}

                {formData.createDatabase && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Database
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 1, mt: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        Database Name:
                      </Typography>
                      <Typography variant="body2">
                        hadm751_{formData.databaseName || 'auto'}
                      </Typography>
                    </Box>
                  </Paper>
                )}
              </>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Security
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 1, mt: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  SSL/TLS:
                </Typography>
                <Typography variant="body2">{formData.enableSsl ? 'Enabled' : 'Disabled'}</Typography>
              </Box>
            </Paper>
          </Box>
        );

      default:
        return null;
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
            {getTitle()}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Paper sx={{ p: 3 }}>
          {renderStepContent(activeStep)}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button onClick={activeStep === 0 ? onClose : handleBack} sx={{ textTransform: 'none' }}>
              {activeStep === 0 ? 'Cancel' : 'Back'}
            </Button>
            <Button
              variant="contained"
              onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
              sx={{ textTransform: 'none' }}
            >
              {activeStep === steps.length - 1 ? 'Create' : 'Next'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
