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
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Dns as DnsIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { AddDNSRecord } from './AddDNSRecord';

interface DNSRecord {
  id: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA';
  value: string;
  ttl: number;
  priority?: number;
}

interface DNSRecordsProps {
  onClose: () => void;
  domain: string;
}

export function DNSRecords({ onClose, domain }: DNSRecordsProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const records: DNSRecord[] = [
    {
      id: '1',
      name: domain,
      type: 'A',
      value: '72.8.7.15',
      ttl: 14400,
    },
    {
      id: '2',
      name: `www.${domain}`,
      type: 'A',
      value: '72.8.7.15',
      ttl: 14400,
    },
    {
      id: '3',
      name: domain,
      type: 'MX',
      value: `mail.${domain}`,
      ttl: 14400,
      priority: 10,
    },
    {
      id: '4',
      name: `mail.${domain}`,
      type: 'A',
      value: '72.8.7.15',
      ttl: 14400,
    },
    {
      id: '5',
      name: `ftp.${domain}`,
      type: 'CNAME',
      value: domain,
      ttl: 14400,
    },
    {
      id: '6',
      name: domain,
      type: 'TXT',
      value: 'v=spf1 +a +mx +ip4:72.8.7.15 ~all',
      ttl: 14400,
    },
    {
      id: '7',
      name: domain,
      type: 'NS',
      value: 'ns1.mainserver.in',
      ttl: 86400,
    },
    {
      id: '8',
      name: domain,
      type: 'NS',
      value: 'ns2.mainserver.in',
      ttl: 86400,
    },
  ];

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, recordId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedRecord(recordId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRecord(null);
  };

  const getRecordTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      A: '#4285F4',
      AAAA: '#0F9D58',
      CNAME: '#F4B400',
      MX: '#DB4437',
      TXT: '#AB47BC',
      NS: '#00ACC1',
      SRV: '#FF7043',
      CAA: '#8E24AA',
    };
    return colors[type] || '#757575';
  };

  const formatTTL = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    if (hours >= 24) {
      return `${Math.floor(hours / 24)}d`;
    }
    return `${hours}h`;
  };

  const filterRecordsByTab = (records: DNSRecord[]) => {
    if (activeTab === 0) return records; // All
    const types = ['A', 'MX', 'CNAME', 'TXT', 'NS'];
    const selectedType = types[activeTab - 1];
    return records.filter((r) => r.type === selectedType);
  };

  if (showAddRecord) {
    return (
      <AddDNSRecord
        onClose={() => setShowAddRecord(false)}
        domain={domain}
      />
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <DnsIcon sx={{ mr: 1, color: '#4285F4' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              DNS Zone Editor
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {domain}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', mr: 1 }}
            onClick={() => setShowAddRecord(true)}
          >
            Add Record
          </Button>
          <IconButton>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Alert severity="info" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            DNS changes may take up to 24-48 hours to propagate worldwide. Be careful when editing DNS records as
            incorrect values can make your website or email inaccessible.
          </Typography>
        </Alert>

        <Paper>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="All Records" sx={{ textTransform: 'none' }} />
            <Tab label="A Records" sx={{ textTransform: 'none' }} />
            <Tab label="MX Records" sx={{ textTransform: 'none' }} />
            <Tab label="CNAME Records" sx={{ textTransform: 'none' }} />
            <Tab label="TXT Records" sx={{ textTransform: 'none' }} />
            <Tab label="NS Records" sx={{ textTransform: 'none' }} />
          </Tabs>

          <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="body2" color="text.secondary">
              {filterRecordsByTab(records).length} DNS records found
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>TTL</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filterRecordsByTab(records).map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>
                      <Chip
                        label={record.type}
                        size="small"
                        sx={{
                          bgcolor: `${getRecordTypeColor(record.type)}15`,
                          color: getRecordTypeColor(record.type),
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          minWidth: 60,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {record.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {record.value}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={formatTTL(record.ttl)}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: 'monospace' }}
                      />
                    </TableCell>
                    <TableCell>
                      {record.priority ? (
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {record.priority}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={(e) => handleMenuClick(e, record.id)}>
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Common DNS Record Types
          </Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#4285F4' }}>
                A Record
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Maps a domain name to an IPv4 address
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#DB4437' }}>
                MX Record
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Specifies mail servers for the domain
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F4B400' }}>
                CNAME Record
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Creates an alias for another domain name
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#AB47BC' }}>
                TXT Record
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Stores text information (SPF, DKIM, domain verification)
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Edit Record
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete Record
        </MenuItem>
      </Menu>
    </Box>
  );
}
