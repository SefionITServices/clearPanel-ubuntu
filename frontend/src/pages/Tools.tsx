import React from 'react';
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
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import BackupIcon from '@mui/icons-material/Backup';
import ImageIcon from '@mui/icons-material/Image';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
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
import { useNavigate } from 'react-router-dom';

// Utility component for tool item
function ToolCard({
  icon,
  label,
  description,
  onClick,
  color = 'primary.main',
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
        '&:hover': {
          transform: onClick ? 'translateY(-4px)' : 'none',
          boxShadow: onClick ? 4 : 1,
        },
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack spacing={2} alignItems="flex-start">
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              color: color,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
              {label}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ToolsPage() {
  const navigate = useNavigate();

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
          color: 'primary.main',
        },
        {
          label: 'Disk Usage',
          icon: <StorageIcon sx={{ fontSize: 28 }} />,
          description: 'View storage usage',
          color: 'success.main',
        },
        {
          label: 'Backup',
          icon: <BackupIcon sx={{ fontSize: 28 }} />,
          description: 'Create and restore backups',
          color: 'warning.main',
        },
        {
          label: 'Images',
          icon: <ImageIcon sx={{ fontSize: 28 }} />,
          description: 'Manage image files',
          color: 'info.main',
        },
        {
          label: 'Directory Privacy',
          icon: <PrivacyTipIcon sx={{ fontSize: 28 }} />,
          description: 'Protect directories',
          color: 'error.main',
        },
        {
          label: 'FTP Manager',
          icon: <CloudUploadIcon sx={{ fontSize: 28 }} />,
          description: 'Manage FTP accounts',
          color: 'secondary.main',
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
          color: 'primary.main',
        },
        {
          label: 'Forwarders',
          icon: <ForwardToInboxIcon sx={{ fontSize: 28 }} />,
          description: 'Configure email forwarding',
          color: 'info.main',
        },
        {
          label: 'Email Filters',
          icon: <FilterAltIcon sx={{ fontSize: 28 }} />,
          description: 'Set up email filters',
          color: 'warning.main',
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
          color: 'success.main',
        },
        {
          label: 'Domains',
          icon: <DnsIcon sx={{ fontSize: 28 }} />,
          description: 'Manage hosted domains',
          onClick: () => navigate('/domains'),
          color: 'primary.main',
        },
        {
          label: 'DNS Zones',
          icon: <DnsIcon sx={{ fontSize: 28 }} />,
          description: 'Edit DNS records',
          onClick: () => navigate('/dns'),
          color: 'warning.main',
        },
        {
          label: 'Settings',
          icon: <SettingsIcon sx={{ fontSize: 28 }} />,
          description: 'System configuration',
          color: 'secondary.main',
        },
        {
          label: 'Processes',
          icon: <DataObjectIcon sx={{ fontSize: 28 }} />,
          description: 'View running processes',
          color: 'error.main',
        },
      ],
    },
  ];

  const generalInfo = {
    user: 'mainserver',
    domain: 'example.com',
    sharedIp: '178.16.138.65',
    homeDir: '/home/mainserver',
    lastLoginIp: '108.60.177.187',
    diskUsage: '38.33 GB / ∞',
    theme: 'jupiter',
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
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(3, 1fr)',
                      lg: 'repeat(3, 1fr)',
                      xl: 'repeat(4, 1fr)',
                    },
                  }}
                >
                  {section.items.map((it) => (
                    <ToolCard
                      key={it.label}
                      icon={it.icon}
                      label={it.label}
                      description={it.description}
                      onClick={it.onClick}
                      color={it.color}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Right: info sidebar */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', lg: 320 },
            flexShrink: 0,
            alignSelf: 'flex-start',
            border: (theme) => `1px solid ${theme.palette.divider}`,
            position: { lg: 'sticky' },
            top: { lg: 24 },
          }}
        >
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              General Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2}>
              <InfoRow label="Current User" value={generalInfo.user} icon={<PersonIcon />} />
              <InfoRow label="Primary Domain" value={generalInfo.domain} icon={<DnsIcon />} />
              <InfoRow label="Shared IP Address" value={generalInfo.sharedIp} />
              <InfoRow label="Home Directory" value={generalInfo.homeDir} icon={<HomeIcon />} />
              <InfoRow label="Last Login IP" value={generalInfo.lastLoginIp} />
              <InfoRow label="Disk Usage" value={generalInfo.diskUsage} />
            </Stack>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Statistics
            </Typography>
            <Stack spacing={2}>
              <StatBar label="Disk Usage" percent={70} color="primary" />
              <StatBar label="Processes" percent={45} color="success" />
              <StatBar label="Memory" percent={55} color="warning" />
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
  color = 'primary',
}: {
  label: string;
  percent: number;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={500}>
          {label}
        </Typography>
        <Chip
          size="small"
          label={`${percent}%`}
          color={color}
          sx={{ height: 20, fontSize: '0.75rem' }}
        />
      </Box>
      <Box
        sx={{
          height: 8,
          bgcolor: (theme) => alpha(theme.palette[color].main, 0.12),
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${percent}%`,
            height: '100%',
            bgcolor: `${color}.main`,
            transition: 'width 0.3s ease-in-out',
          }}
        />
      </Box>
    </Box>
  );
}

