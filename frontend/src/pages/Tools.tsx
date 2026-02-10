import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Paper,
  Typography,
  Divider,
  Stack,
  Chip,
  alpha,
  LinearProgress,
  Grid,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import BackupIcon from '@mui/icons-material/Backup';
import ImageIcon from '@mui/icons-material/Image';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import StoreIcon from '@mui/icons-material/Store';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TerminalIcon from '@mui/icons-material/Terminal';
import SettingsIcon from '@mui/icons-material/Settings';
import DataObjectIcon from '@mui/icons-material/DataObject';
import PersonIcon from '@mui/icons-material/Person';
import DnsIcon from '@mui/icons-material/Dns';
import HomeIcon from '@mui/icons-material/Home';
import EmailIcon from '@mui/icons-material/Email';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import LockIcon from '@mui/icons-material/Lock';
import LanIcon from '@mui/icons-material/Lan';
import LanguageIcon from '@mui/icons-material/Language';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Tool card matching the design reference - centered icon with hover lift
function ToolCard({
  icon,
  label,
  description,
  onClick,
  color = '#4285F4',
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: '0 4px 12px 0 rgba(60,64,67,0.2), 0 8px 24px 4px rgba(60,64,67,0.1)',
        } : {},
        height: '100%',
        opacity: onClick ? 1 : 0.7,
      }}
    >
      <CardContent sx={{ textAlign: 'center', p: 3, '&:last-child': { pb: 3 } }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: `${color}12`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            color: color,
          }}
        >
          {icon}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, lineHeight: 1.3 }}>
          {label}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
}

export default function ToolsPage() {
  const navigate = useNavigate();
  const { username } = useAuth();
  const [serverInfo, setServerInfo] = useState<{ primaryDomain?: string; serverIp?: string }>({});
  const [diskUsage, setDiskUsage] = useState('Loading...');

  useEffect(() => {
    fetch('/api/server/nameservers').then(r => r.json()).then(data => {
      setServerInfo({
        primaryDomain: data.settings?.primaryDomain || '-',
        serverIp: data.settings?.serverIp || '-',
      });
    }).catch(() => {});
    fetch('/api/files/disk-usage').then(r => r.json()).then(data => {
      if (data.used && data.total) setDiskUsage(`${formatBytes(data.used)} / ${formatBytes(data.total)}`);
      else if (data.used) setDiskUsage(formatBytes(data.used));
    }).catch(() => setDiskUsage('-'));
  }, []);

  const toolSections: {
    title: string;
    items: {
      label: string;
      icon: React.ReactNode;
      description?: string;
      onClick?: () => void;
      color?: string;
    }[];
  }[] = [
    {
      title: 'Files',
      items: [
        {
          label: 'File Manager',
          icon: <FolderIcon sx={{ fontSize: 28 }} />,
          description: 'Browse and manage files',
          onClick: () => navigate('/files'),
          color: '#4285F4',
        },
        {
          label: 'Disk Usage',
          icon: <StorageIcon sx={{ fontSize: 28 }} />,
          description: 'View storage usage',
          color: '#34A853',
        },
        {
          label: 'Backup',
          icon: <BackupIcon sx={{ fontSize: 28 }} />,
          description: 'Create and restore backups',
          color: '#FBBC04',
        },
        {
          label: 'Images',
          icon: <ImageIcon sx={{ fontSize: 28 }} />,
          description: 'Manage image files',
          color: '#4285F4',
        },
        {
          label: 'Directory Privacy',
          icon: <PrivacyTipIcon sx={{ fontSize: 28 }} />,
          description: 'Protect directories',
          color: '#EA4335',
        },
        {
          label: 'FTP Manager',
          icon: <CloudUploadIcon sx={{ fontSize: 28 }} />,
          description: 'Manage FTP accounts',
          color: '#7B8A99',
        },
      ],
    },
    {
      title: 'Domains',
      items: [
        {
          label: 'Domains',
          icon: <LanguageIcon sx={{ fontSize: 28 }} />,
          description: 'Manage hosted domains',
          onClick: () => navigate('/domains'),
          color: '#4285F4',
        },
        {
          label: 'DNS Zones',
          icon: <DnsIcon sx={{ fontSize: 28 }} />,
          description: 'Edit DNS records',
          onClick: () => navigate('/dns'),
          color: '#FBBC04',
        },
        {
          label: 'SSL Certificates',
          icon: <LockIcon sx={{ fontSize: 28 }} />,
          description: 'Manage SSL / HTTPS',
          onClick: () => navigate('/ssl'),
          color: '#34A853',
        },
        {
          label: 'Nameservers',
          icon: <LanIcon sx={{ fontSize: 28 }} />,
          description: 'Configure nameservers',
          onClick: () => navigate('/nameservers'),
          color: '#00ACC1',
        },
      ],
    },
    {
      title: 'Email',
      items: [
        {
          label: 'Email Accounts',
          icon: <EmailIcon sx={{ fontSize: 28 }} />,
          description: 'Manage email accounts',
          color: '#4285F4',
        },
        {
          label: 'Forwarders',
          icon: <ForwardToInboxIcon sx={{ fontSize: 28 }} />,
          description: 'Configure email forwarding',
          color: '#4285F4',
        },
        {
          label: 'Email Filters',
          icon: <FilterAltIcon sx={{ fontSize: 28 }} />,
          description: 'Set up email filters',
          color: '#FF6B35',
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          label: 'Terminal',
          icon: <TerminalIcon sx={{ fontSize: 28 }} />,
          description: 'Open shell access',
          onClick: () => navigate('/terminal'),
          color: '#34A853',
        },
        {
          label: 'Databases',
          icon: <StorageIcon sx={{ fontSize: 28 }} />,
          description: 'MySQL databases & users',
          onClick: () => navigate('/databases'),
          color: '#4285F4',
        },
        {
          label: 'Settings',
          icon: <SettingsIcon sx={{ fontSize: 28 }} />,
          description: 'System configuration',
          color: '#5F6368',
        },
        {
          label: 'Processes',
          icon: <DataObjectIcon sx={{ fontSize: 28 }} />,
          description: 'View running processes',
          color: '#EA4335',
        },
        {
          label: 'App Store',
          icon: <StoreIcon sx={{ fontSize: 28 }} />,
          description: 'Install server tools & apps',
          onClick: () => navigate('/app-store'),
          color: '#7B1FA2',
        },
        {
          label: 'PHP Manager',
          icon: <DataObjectIcon sx={{ fontSize: 28 }} />,
          description: 'PHP versions, extensions & config',
          onClick: () => navigate('/php'),
          color: '#777BB3',
        },
      ],
    },
  ];

  const generalInfo = {
    user: username || '-',
    domain: serverInfo.primaryDomain || '-',
    sharedIp: serverInfo.serverIp || '-',
    homeDir: username ? `/home/${username}` : '-',
    diskUsage,
  };

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
        {/* Left: tools grid */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
            Tools
          </Typography>
          <Stack spacing={4}>
            {toolSections.map((section) => (
              <Box key={section.title}>
                <Typography
                  variant="h6"
                  sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}
                >
                  {section.title}
                </Typography>
                <Grid container spacing={2}>
                  {section.items.map((it) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={it.label}>
                      <ToolCard
                        icon={it.icon}
                        label={it.label}
                        description={it.description}
                        onClick={it.onClick}
                        color={it.color}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Right: info sidebar */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', lg: 300 },
            flexShrink: 0,
            alignSelf: 'flex-start',
            border: (theme) => `1px solid ${theme.palette.divider}`,
            position: { lg: 'sticky' },
            top: { lg: 88 },
          }}
        >
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              General Information
            </Typography>
            <Stack spacing={1.5}>
              <InfoRow label="Current User" value={generalInfo.user} icon={<PersonIcon />} />
              <InfoRow label="Primary Domain" value={generalInfo.domain} icon={<LanguageIcon />} />
              <InfoRow label="Shared IP Address" value={generalInfo.sharedIp} />
              <InfoRow label="Home Directory" value={generalInfo.homeDir} icon={<HomeIcon />} />
              <InfoRow label="Disk Usage" value={generalInfo.diskUsage} />
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Statistics
            </Typography>
            <Stack spacing={2}>
              <StatBar label="Disk Usage" percent={70} barColor="#4285F4" bgColor="#E8F0FE" />
              <StatBar label="Processes" percent={6} barColor="#34A853" bgColor="#E6F4EA" />
              <StatBar label="Memory" percent={55} barColor="#FBBC04" bgColor="#FEF7E0" />
            </Stack>
          </Box>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {icon && (
        <Box
          sx={{
            color: 'text.secondary',
            display: 'flex',
            '& svg': { fontSize: 20 },
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={500} noWrap>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function StatBar({
  label,
  percent,
  barColor = '#4285F4',
  bgColor = '#E8F0FE',
}: {
  label: string;
  percent: number;
  barColor?: string;
  bgColor?: string;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={500}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: barColor }}>
          {percent}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 8,
          borderRadius: 1,
          bgcolor: bgColor,
          '& .MuiLinearProgress-bar': {
            bgcolor: barColor,
            borderRadius: 1,
          },
        }}
      />
    </Box>
  );
}

