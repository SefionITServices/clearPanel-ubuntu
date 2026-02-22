import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Grid,
  LinearProgress,
  alpha,
  Button,
  Chip,
  Paper,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Language as LanguageIcon,
  Folder as FolderIcon,
  Storage as StorageIcon,
  Lock as LockIcon,
  Terminal as TerminalIcon,
  Dns as DnsIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Speed as SpeedIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { domainsApi } from '../api/domains';
import { sslApi } from '../api/ssl';
import { serverApi } from '../api/server';

interface StatCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { username } = useAuth();
  const [domainCount, setDomainCount] = useState(0);
  const [sslCount, setSslCount] = useState(0);
  const [diskUsed, setDiskUsed] = useState('--');
  const [diskTotal, setDiskTotal] = useState('--');
  const [diskPercent, setDiskPercent] = useState(0);
  const [serverInfo, setServerInfo] = useState<{ primaryDomain?: string; serverIp?: string; hostname?: string }>({});

  useEffect(() => {
    // Load domains count
    domainsApi.list().then(data => {
      setDomainCount(Array.isArray(data) ? data.length : 0);
    }).catch(() => {});

    // Load SSL certificates
    sslApi.certificates().then(data => {
      setSslCount(Array.isArray(data) ? data.filter((c: any) => c.status === 'active').length : 0);
    }).catch(() => {});

    // Load disk usage
    fetch('/api/files/disk-usage').then(r => r.json()).then(data => {
      if (data.used) setDiskUsed(formatBytes(data.used));
      if (data.total) setDiskTotal(formatBytes(data.total));
      if (data.used && data.total && data.total > 0) {
        setDiskPercent(Math.round((data.used / data.total) * 100));
      } else if (data.percentage) {
        setDiskPercent(parseInt(data.percentage));
      }
    }).catch(() => {});

    // Load server info
    serverApi.getNameservers().then(data => {
      setServerInfo({
        primaryDomain: data.settings?.primaryDomain || '-',
        serverIp: data.settings?.serverIp || '-',
        hostname: data.settings?.hostname,
      });
    }).catch(() => {});

    // Load hostname if not in settings
    serverApi.getHostname().then(data => {
      setServerInfo(prev => ({ ...prev, hostname: prev.hostname || data.hostname || data.systemHostname }));
    }).catch(() => {});
  }, []);

  const statCards: StatCard[] = [
    {
      title: 'Domains',
      value: domainCount,
      subtitle: 'Active domains',
      icon: <LanguageIcon sx={{ fontSize: 28 }} />,
      color: '#4285F4',
      bgColor: '#E8F0FE',
    },
    {
      title: 'SSL Certificates',
      value: sslCount,
      subtitle: 'Active certificates',
      icon: <LockIcon sx={{ fontSize: 28 }} />,
      color: '#34A853',
      bgColor: '#E6F4EA',
    },
    {
      title: 'Disk Usage',
      value: diskUsed,
      subtitle: `of ${diskTotal}`,
      icon: <StorageIcon sx={{ fontSize: 28 }} />,
      color: '#FBBC04',
      bgColor: '#FEF7E0',
    },
    {
      title: 'Server IP',
      value: serverInfo.serverIp || '--',
      subtitle: 'Public address',
      icon: <CloudIcon sx={{ fontSize: 28 }} />,
      color: '#EA4335',
      bgColor: '#FCE8E6',
    },
  ];

  const quickActions = [
    { title: 'File Manager', icon: <FolderIcon />, path: '/files', color: '#4285F4' },
    { title: 'Domains', icon: <LanguageIcon />, path: '/domains', color: '#34A853' },
    { title: 'DNS Zones', icon: <DnsIcon />, path: '/dns', color: '#FBBC04' },
    { title: 'SSL', icon: <LockIcon />, path: '/ssl', color: '#34A853' },
    { title: 'Databases', icon: <StorageIcon />, path: '/databases', color: '#4285F4' },
    { title: 'Terminal', icon: <TerminalIcon />, path: '/terminal', color: '#5F6368' },
  ];

  return (
    <DashboardLayout>
      <Box>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back, <strong>{username}</strong>. Here's what's happening with your server.
          </Typography>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {statCards.map((stat) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.title}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                        {stat.title}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color, mb: 0.5 }}>
                        {stat.value}
                      </Typography>
                      {stat.subtitle && (
                        <Typography variant="caption" color="text.secondary">
                          {stat.subtitle}
                        </Typography>
                      )}
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: stat.bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: stat.color,
                      }}
                    >
                      {stat.icon}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          {/* Quick Actions */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5 }}>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                {quickActions.map((action) => (
                  <Grid size={{ xs: 6, sm: 4, md: 4 }} key={action.title}>
                    <Card
                      onClick={() => navigate(action.path)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 3,
                        },
                      }}
                    >
                      <CardContent sx={{ textAlign: 'center', py: 2.5, '&:last-child': { pb: 2.5 } }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: `${action.color}15`,
                            color: action.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 1.5,
                          }}
                        >
                          {action.icon}
                        </Box>
                        <Typography variant="body2" fontWeight={600}>
                          {action.title}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          {/* Server Information */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5 }}>
                Server Information
              </Typography>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    Hostname
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                    {serverInfo.hostname || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    Primary Domain
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {serverInfo.primaryDomain || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    Server IP
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                    {serverInfo.serverIp || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    Home Directory
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                    {username ? `/home/${username}` : '-'}
                  </Typography>
                </Box>
                <Divider />
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={500}>Disk Usage</Typography>
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {diskPercent}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={diskPercent}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      bgcolor: '#E8F0FE',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 1,
                        bgcolor: diskPercent > 90 ? '#EA4335' : diskPercent > 70 ? '#FBBC04' : '#4285F4',
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {diskUsed} of {diskTotal} used
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
}
