import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Paper,
  Typography,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Menu,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  TextField,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Storage as StorageIcon,
  VpnKey as PasswordIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { CreateEmailAccount } from './CreateEmailAccount';

interface EmailAccount {
  id: string;
  email: string;
  domain: string;
  quota: number;
  usedSpace: number;
  created: string;
  status: 'active' | 'suspended';
}

interface EmailAccountsProps {
  onClose: () => void;
}

export function EmailAccounts({ onClose }: EmailAccountsProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const availableDomains = [
    'mainserver.in',
    'myaddondomain.com',
    'blog.mainserver.in',
    'shop.mainserver.in',
  ];

  const emailAccounts: EmailAccount[] = [
    {
      id: '1',
      email: 'admin@mainserver.in',
      domain: 'mainserver.in',
      quota: 1024,
      usedSpace: 450,
      created: '2024-01-15',
      status: 'active',
    },
    {
      id: '2',
      email: 'support@mainserver.in',
      domain: 'mainserver.in',
      quota: 2048,
      usedSpace: 1200,
      created: '2024-01-20',
      status: 'active',
    },
    {
      id: '3',
      email: 'sales@mainserver.in',
      domain: 'mainserver.in',
      quota: 512,
      usedSpace: 128,
      created: '2024-02-01',
      status: 'active',
    },
    {
      id: '4',
      email: 'info@myaddondomain.com',
      domain: 'myaddondomain.com',
      quota: 1024,
      usedSpace: 680,
      created: '2024-02-05',
      status: 'active',
    },
    {
      id: '5',
      email: 'contact@blog.mainserver.in',
      domain: 'blog.mainserver.in',
      quota: 512,
      usedSpace: 200,
      created: '2024-02-08',
      status: 'active',
    },
  ];

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, emailId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedEmail(emailId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedEmail(null);
  };

  const formatSize = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const calculateUsagePercentage = (used: number, total: number) => {
    return Math.round((used / total) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#f44336';
    if (percentage >= 75) return '#ff9800';
    return '#4caf50';
  };

  const filteredEmails = emailAccounts.filter((account) => {
    const matchesDomain = selectedDomainFilter === 'all' || account.domain === selectedDomainFilter;
    const matchesSearch = account.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesSearch;
  });

  const totalAccounts = emailAccounts.length;
  const totalQuota = emailAccounts.reduce((sum, acc) => sum + acc.quota, 0);
  const totalUsed = emailAccounts.reduce((sum, acc) => sum + acc.usedSpace, 0);

  if (showCreateForm) {
    return <CreateEmailAccount onClose={() => setShowCreateForm(false)} availableDomains={availableDomains} />;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <EmailIcon sx={{ mr: 1, color: '#4285F4' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Email Accounts
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', mr: 1 }}
            onClick={() => setShowCreateForm(true)}
          >
            Create Email Account
          </Button>
          <IconButton>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    bgcolor: '#4285F415',
                    color: '#4285F4',
                    p: 1.5,
                    borderRadius: 2,
                    display: 'flex',
                  }}
                >
                  <EmailIcon />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {totalAccounts}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Accounts
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    bgcolor: '#34A85315',
                    color: '#34A853',
                    p: 1.5,
                    borderRadius: 2,
                    display: 'flex',
                  }}
                >
                  <StorageIcon />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {formatSize(totalUsed)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Space Used
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    bgcolor: '#FBBC0415',
                    color: '#FBBC04',
                    p: 1.5,
                    borderRadius: 2,
                    display: 'flex',
                  }}
                >
                  <CheckCircleIcon />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {formatSize(totalQuota)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Quota
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Email accounts allow you to send and receive emails using your domain name. You can access your emails via webmail, IMAP, or POP3.
          </Typography>
        </Alert>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search email accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Domain</InputLabel>
                <Select
                  value={selectedDomainFilter}
                  onChange={(e) => setSelectedDomainFilter(e.target.value)}
                  label="Filter by Domain"
                >
                  <MenuItem value="all">All Domains</MenuItem>
                  {availableDomains.map((domain) => (
                    <MenuItem key={domain} value={domain}>
                      {domain}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Email Accounts Table */}
        <Paper>
          <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="body2" color="text.secondary">
              {filteredEmails.length} email account(s) found
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Email Address</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Domain</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Disk Usage</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Quota</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmails.map((account) => {
                  const usagePercentage = calculateUsagePercentage(account.usedSpace, account.quota);
                  return (
                    <TableRow key={account.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmailIcon sx={{ color: '#4285F4', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                            {account.email}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {account.domain}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {formatSize(account.usedSpace)}
                            </Typography>
                            <Chip
                              label={`${usagePercentage}%`}
                              size="small"
                              sx={{
                                bgcolor: `${getUsageColor(usagePercentage)}15`,
                                color: getUsageColor(usagePercentage),
                                fontWeight: 600,
                                height: 20,
                                fontSize: '0.7rem',
                              }}
                            />
                          </Box>
                          <Box
                            sx={{
                              width: '100%',
                              height: 4,
                              bgcolor: '#e0e0e0',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                width: `${usagePercentage}%`,
                                height: '100%',
                                bgcolor: getUsageColor(usagePercentage),
                                transition: 'width 0.3s',
                              }}
                            />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {formatSize(account.quota)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={account.status}
                          size="small"
                          color={account.status === 'active' ? 'success' : 'error'}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {account.created}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={(e) => handleMenuClick(e, account.id)}>
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Email Configuration Info */}
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Email Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Incoming Mail Server (IMAP)
                </Typography>
                <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Server: mail.mainserver.in
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Port: 993 (SSL/TLS)
                  </Typography>
                  <Typography variant="body2">Port: 143 (STARTTLS)</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Outgoing Mail Server (SMTP)
                </Typography>
                <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Server: mail.mainserver.in
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Port: 465 (SSL/TLS)
                  </Typography>
                  <Typography variant="body2">Port: 587 (STARTTLS)</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2">
              Use your full email address as the username and enable SSL/TLS encryption for secure connections.
            </Typography>
          </Alert>
        </Paper>
      </Box>

      {/* Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleMenuClose}>
          <PasswordIcon sx={{ mr: 1, fontSize: 20 }} />
          Change Password
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <SettingsIcon sx={{ mr: 1, fontSize: 20 }} />
          Manage Quota
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <EmailIcon sx={{ mr: 1, fontSize: 20 }} />
          Access Webmail
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete Account
        </MenuItem>
      </Menu>
    </Box>
  );
}
