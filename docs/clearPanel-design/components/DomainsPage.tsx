import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Paper,
  Button,
  Typography,
  IconButton,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Language as LanguageIcon,
  Dns as DnsIcon,
  ViewList as ViewListIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  SubdirectoryArrowRight as SubdirectoryIcon,
  LocalParking as ParkingIcon,
  ImportExport as RedirectIcon,
  Public as PublicIcon,
  Email as EmailIcon,
  VpnKey as SslIcon,
} from '@mui/icons-material';
import { AddDomainForm } from './AddDomainForm';
import { DNSRecords } from './DNSRecords';

interface Domain {
  name: string;
  type: 'primary' | 'addon' | 'subdomain' | 'parked';
  status: 'active' | 'pending' | 'suspended';
  documentRoot: string;
  created: string;
  ssl: boolean;
}

interface DomainsPageProps {
  onClose: () => void;
}

export function DomainsPage({ onClose }: DomainsPageProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'addon' | 'subdomain' | 'parked'>('addon');
  const [showAddDomainForm, setShowAddDomainForm] = useState(false);
  const [showDNSRecords, setShowDNSRecords] = useState(false);
  const [selectedDomainForDNS, setSelectedDomainForDNS] = useState<string | null>(null);

  const domains: Domain[] = [
    {
      name: 'mainserver.in',
      type: 'primary',
      status: 'active',
      documentRoot: '/home/hadm751/public_html',
      created: '2024-01-15',
      ssl: true,
    },
    {
      name: 'blog.mainserver.in',
      type: 'subdomain',
      status: 'active',
      documentRoot: '/home/hadm751/public_html/blog',
      created: '2024-02-01',
      ssl: true,
    },
    {
      name: 'shop.mainserver.in',
      type: 'subdomain',
      status: 'active',
      documentRoot: '/home/hadm751/public_html/shop',
      created: '2024-02-03',
      ssl: false,
    },
    {
      name: 'myaddondomain.com',
      type: 'addon',
      status: 'active',
      documentRoot: '/home/hadm751/myaddondomain',
      created: '2024-01-20',
      ssl: true,
    },
    {
      name: 'parkedexample.com',
      type: 'parked',
      status: 'active',
      documentRoot: '/home/hadm751/public_html',
      created: '2024-01-25',
      ssl: false,
    },
  ];

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, domainName: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedDomain(domainName);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDomain(null);
  };

  const handleOpenDialog = (type: 'addon' | 'subdomain' | 'parked') => {
    setDialogType(type);
    setShowAddDomainForm(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleManageDNS = (domainName: string) => {
    setSelectedDomainForDNS(domainName);
    setShowDNSRecords(true);
    handleMenuClose();
  };

  if (showAddDomainForm) {
    return (
      <AddDomainForm
        onClose={() => setShowAddDomainForm(false)}
        type={dialogType}
      />
    );
  }

  if (showDNSRecords) {
    return (
      <DNSRecords
        onClose={() => setShowDNSRecords(false)}
        domain={selectedDomainForDNS}
      />
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'suspended':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'primary':
        return '#4285F4';
      case 'addon':
        return '#34A853';
      case 'subdomain':
        return '#FBBC04';
      case 'parked':
        return '#EA4335';
      default:
        return '#757575';
    }
  };

  const domainStats = [
    { label: 'Total Domains', value: domains.length, icon: <LanguageIcon />, color: '#4285F4' },
    { label: 'Addon Domains', value: domains.filter(d => d.type === 'addon').length, icon: <AddIcon />, color: '#34A853' },
    { label: 'Subdomains', value: domains.filter(d => d.type === 'subdomain').length, icon: <SubdirectoryIcon />, color: '#FBBC04' },
    { label: 'Parked Domains', value: domains.filter(d => d.type === 'parked').length, icon: <ParkingIcon />, color: '#EA4335' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <LanguageIcon sx={{ mr: 1, color: '#4285F4' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Domains
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', mr: 1 }}
            onClick={() => handleOpenDialog('addon')}
          >
            Add Domain
          </Button>
          <IconButton>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {domainStats.map((stat) => (
            <Grid item xs={12} sm={6} md={3} key={stat.label}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      bgcolor: `${stat.color}15`,
                      color: stat.color,
                      p: 1.5,
                      borderRadius: 2,
                      display: 'flex',
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Quick Actions */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
                onClick={() => handleOpenDialog('addon')}
              >
                Add Addon Domain
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SubdirectoryIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
                onClick={() => handleOpenDialog('subdomain')}
              >
                Create Subdomain
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ParkingIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
                onClick={() => handleOpenDialog('parked')}
              >
                Park Domain
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<DnsIcon />}
                sx={{ textTransform: 'none', py: 1.5 }}
              >
                Manage DNS
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Paper>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="All Domains" sx={{ textTransform: 'none' }} />
            <Tab label="Redirects" sx={{ textTransform: 'none' }} />
            <Tab label="DNS Zones" sx={{ textTransform: 'none' }} />
            <Tab label="Email Routing" sx={{ textTransform: 'none' }} />
          </Tabs>

          {/* All Domains Tab */}
          {activeTab === 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Domain Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Document Root</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>SSL</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.name} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PublicIcon sx={{ color: '#4285F4', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {domain.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={domain.type}
                          size="small"
                          sx={{
                            bgcolor: `${getTypeColor(domain.type)}15`,
                            color: getTypeColor(domain.type),
                            textTransform: 'capitalize',
                            fontWeight: 500,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={domain.status === 'active' ? <CheckCircleIcon /> : <ScheduleIcon />}
                          label={domain.status}
                          size="small"
                          color={getStatusColor(domain.status) as any}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {domain.documentRoot}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {domain.ssl ? (
                          <Chip
                            icon={<SslIcon />}
                            label="Enabled"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip label="Disabled" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {domain.created}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuClick(e, domain.name)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Redirects Tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <RedirectIcon sx={{ fontSize: 64, color: '#bdbdbd', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No redirects configured
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create redirects to forward traffic from one domain to another
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} sx={{ textTransform: 'none' }}>
                  Add Redirect
                </Button>
              </Box>
            </Box>
          )}

          {/* DNS Zones Tab */}
          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              <List>
                {domains.map((domain, index) => (
                  <Box key={domain.name}>
                    <ListItem>
                      <DnsIcon sx={{ mr: 2, color: '#4285F4' }} />
                      <ListItemText
                        primary={domain.name}
                        secondary="Click to manage DNS records"
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{ textTransform: 'none' }}
                          onClick={() => handleManageDNS(domain.name)}
                        >
                          Manage Zone
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < domains.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </Box>
          )}

          {/* Email Routing Tab */}
          {activeTab === 3 && (
            <Box sx={{ p: 3 }}>
              <List>
                {domains.map((domain, index) => (
                  <Box key={domain.name}>
                    <ListItem>
                      <EmailIcon sx={{ mr: 2, color: '#4285F4' }} />
                      <ListItemText
                        primary={domain.name}
                        secondary="Configure email routing settings"
                      />
                      <ListItemSecondaryAction>
                        <Button variant="outlined" size="small" sx={{ textTransform: 'none' }}>
                          Configure
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < domains.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Edit Settings
        </MenuItem>
        <MenuItem onClick={() => selectedDomain && handleManageDNS(selectedDomain)}>
          <DnsIcon sx={{ mr: 1, fontSize: 20 }} />
          Manage DNS
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <SslIcon sx={{ mr: 1, fontSize: 20 }} />
          SSL/TLS
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <RedirectIcon sx={{ mr: 1, fontSize: 20 }} />
          Add Redirect
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Remove Domain
        </MenuItem>
      </Menu>

      {/* Add Domain Dialog - Removed, replaced with AddDomainForm */}
    </Box>
  );
}