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
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import BackupIcon from '@mui/icons-material/Backup';
import ImageIcon from '@mui/icons-material/Image';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import StoreIcon from '@mui/icons-material/Store';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import BlockIcon from '@mui/icons-material/Block';
import LinkOffIcon from '@mui/icons-material/LinkOff';
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
import CloudIcon from '@mui/icons-material/Cloud';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ArticleIcon from '@mui/icons-material/Article';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShieldIcon from '@mui/icons-material/Shield';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import SecurityIcon from '@mui/icons-material/Security';
import MemoryIcon from '@mui/icons-material/Memory';
import CodeIcon from '@mui/icons-material/Code';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { appStoreApi } from '../api/app-store';
import { serverApi } from '../api/server';

// Tool card matching the design reference - centered icon with hover lift
function ToolCard({
  icon,
  label,
  description,
  onClick,
  color = '#4285F4',
  isFavorite,
  onToggleFavorite,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  color?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: `${color}12`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </Box>
          {onToggleFavorite && (
            <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                sx={{
                  color: isFavorite ? '#FBC02D' : 'text.disabled',
                  '&:hover': { color: '#FBC02D' },
                }}
              >
                {isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
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
  const [search, setSearch] = useState('');
  const [phpMyAdminInstalled, setPhpMyAdminInstalled] = useState(false);
  const [roundcubeInstalled, setRoundcubeInstalled] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  useEffect(() => {
    serverApi.getNameservers().then(data => {
      setServerInfo({
        primaryDomain: data.settings?.primaryDomain || '-',
        serverIp: data.settings?.serverIp || '-',
      });
    }).catch(() => {});
    fetch('/api/files/disk-usage').then(r => r.json()).then(data => {
      if (data.used && data.total) setDiskUsage(`${formatBytes(data.used)} / ${formatBytes(data.total)}`);
      else if (data.used) setDiskUsage(formatBytes(data.used));
    }).catch(() => setDiskUsage('-'));
    appStoreApi.listApps()
      .then(data => {
        if (Array.isArray(data.apps)) {
          const php = data.apps.find((a: any) => a.id === 'phpmyadmin');
          const rc = data.apps.find((a: any) => a.id === 'roundcube');
          setPhpMyAdminInstalled(!!php?.status?.installed);
          setRoundcubeInstalled(!!rc?.status?.installed);
        }
      })
      .catch(() => {});
    if (username) {
      try {
        const raw = localStorage.getItem(`clearpanel:favorites:${username}`);
        if (raw) {
          const parsed: string[] = JSON.parse(raw);
          setFavorites(parsed);
        }
      } catch {
        // ignore
      }
    }
    setFavoritesLoaded(true);
  }, []);

  useEffect(() => {
    if (!username || !favoritesLoaded) return;
    try {
      localStorage.setItem(`clearpanel:favorites:${username}`, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites, username, favoritesLoaded]);

  const toggleFavorite = (path: string) => {
    setFavorites((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const toolSections: {
    title: string;
    items: {
      label: string;
      icon: React.ReactNode;
      description?: string;
      onClick?: () => void;
      color?: string;
        favoritePath?: string;
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
          favoritePath: '/files',
        },
        {
          label: 'Disk Usage',
          icon: <StorageIcon sx={{ fontSize: 28 }} />,
          description: 'View storage usage',
          onClick: () => navigate('/files'),
          color: '#34A853',
          favoritePath: '/files',
        },
        {
          label: 'Backup',
          icon: <BackupIcon sx={{ fontSize: 28 }} />,
          description: 'Create and restore backups',
          onClick: () => navigate('/backup'),
          color: '#FBBC04',
          favoritePath: '/backup',
        },
        {
          label: 'Images',
          icon: <ImageIcon sx={{ fontSize: 28 }} />,
          description: 'Manage image files',
          onClick: () => navigate('/files'),
          color: '#4285F4',
          favoritePath: '/files',
        },
        {
          label: 'Directory Privacy',
          icon: <PrivacyTipIcon sx={{ fontSize: 28 }} />,
          description: 'Password-protect directories',
          onClick: () => navigate('/dir-privacy'),
          color: '#EA4335',
          favoritePath: '/dir-privacy',
        },
        {
          label: 'FTP Manager',
          icon: <CloudUploadIcon sx={{ fontSize: 28 }} />,
          description: 'Manage FTP accounts',
          onClick: () => navigate('/ftp'),
          color: '#7B8A99',
          favoritePath: '/ftp',
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
          favoritePath: '/domains',
        },
        {
          label: 'DNS Zones',
          icon: <DnsIcon sx={{ fontSize: 28 }} />,
          description: 'Edit DNS records',
          onClick: () => navigate('/dns'),
          color: '#FBBC04',
          favoritePath: '/dns',
        },
        {
          label: 'SSL Certificates',
          icon: <LockIcon sx={{ fontSize: 28 }} />,
          description: 'Manage SSL / HTTPS',
          onClick: () => navigate('/ssl'),
          color: '#34A853',
          favoritePath: '/ssl',
        },
        {
          label: 'Nameservers',
          icon: <LanIcon sx={{ fontSize: 28 }} />,
          description: 'Configure nameservers',
          onClick: () => navigate('/nameservers'),
          color: '#00ACC1',
        },
        {
          label: 'Redirects',
          icon: <AltRouteIcon sx={{ fontSize: 28 }} />,
          description: '301/302 URL redirects',
          onClick: () => navigate('/redirects'),
          color: '#0288D1',
          favoritePath: '/redirects',
        },
        {
          label: 'IP Blocker',
          icon: <BlockIcon sx={{ fontSize: 28 }} />,
          description: 'Block IPs per domain',
          onClick: () => navigate('/ip-blocker'),
          color: '#E53935',
          favoritePath: '/ip-blocker',
        },
        {
          label: 'Hotlink Protection',
          icon: <LinkOffIcon sx={{ fontSize: 28 }} />,
          description: 'Prevent image/file hotlinking',
          onClick: () => navigate('/hotlink-protection'),
          color: '#F57C00',
          favoritePath: '/hotlink-protection',
        },
      ],
    },
    {
      title: 'Email',
      items: [
        {
          label: 'Email',
          icon: <EmailIcon sx={{ fontSize: 28 }} />,
          description: 'Email hub — accounts, webmail & more',
          onClick: () => navigate('/email'),
          color: '#1A73E8',
          favoritePath: '/email',
        },
        {
          label: 'Email Accounts',
          icon: <EmailIcon sx={{ fontSize: 28 }} />,
          description: 'Manage email accounts',
          onClick: () => navigate('/email-accounts'),
          color: '#4285F4',
          favoritePath: '/email-accounts',
        },
        {
          label: 'Mail Domains',
          icon: <EmailIcon sx={{ fontSize: 28 }} />,
          description: 'Manage mail domains & settings',
          onClick: () => navigate('/mail-domains'),
          color: '#1A73E8',
          favoritePath: '/mail-domains',
        },
        {
          label: 'Forwarders',
          icon: <ForwardToInboxIcon sx={{ fontSize: 28 }} />,
          description: 'Configure email forwarding',
          onClick: () => navigate('/forwarders'),
          color: '#4285F4',
          favoritePath: '/forwarders',
        },
        {
          label: 'Email Filters',
          icon: <FilterAltIcon sx={{ fontSize: 28 }} />,
          description: 'Set up email filters',
          onClick: () => navigate('/email-filters'),
          color: '#FF6B35',
          favoritePath: '/email-filters',
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
          favoritePath: '/terminal',
        },
        {
          label: 'Databases',
          icon: <StorageIcon sx={{ fontSize: 28 }} />,
          description: 'MySQL databases & users',
          onClick: () => navigate('/databases'),
          color: '#4285F4',
          favoritePath: '/databases',
        },
        {
          label: 'Web Server',
          icon: <CloudIcon sx={{ fontSize: 28 }} />,
          description: 'Nginx web server management',
          onClick: () => navigate('/webserver'),
          color: '#00ACC1',
          favoritePath: '/webserver',
        },
        {
          label: 'Logs',
          icon: <ArticleIcon sx={{ fontSize: 28 }} />,
          description: 'View system and access logs',
          onClick: () => navigate('/logs'),
          color: '#607D8B',
          favoritePath: '/logs',
        },
        {
          label: 'Settings',
          icon: <SettingsIcon sx={{ fontSize: 28 }} />,
          description: 'System configuration',
          onClick: () => navigate('/settings'),
          color: '#5F6368',
          favoritePath: '/settings',
        },
        {
          label: 'App Store',
          icon: <StoreIcon sx={{ fontSize: 28 }} />,
          description: 'Install server tools & apps',
          onClick: () => navigate('/app-store'),
          color: '#7B1FA2',
          favoritePath: '/app-store',
        },
        {
          label: 'PHP Manager',
          icon: <DataObjectIcon sx={{ fontSize: 28 }} />,
          description: 'PHP versions, extensions & config',
          onClick: () => navigate('/php'),
          color: '#777BB3',
          favoritePath: '/php',
        },
        {
          label: 'SSH Keys',
          icon: <VpnKeyIcon sx={{ fontSize: 28 }} />,
          description: 'Generate & manage SSH keys',
          onClick: () => navigate('/ssh-keys'),
          color: '#FF6B35',
          favoritePath: '/ssh-keys',
        },
        {
          label: 'Cron Jobs',
          icon: <ScheduleIcon sx={{ fontSize: 28 }} />,
          description: 'Schedule automated tasks',
          onClick: () => navigate('/cron-jobs'),
          color: '#009688',
          favoritePath: '/cron-jobs',
        },
        {
          label: 'Firewall',
          icon: <ShieldIcon sx={{ fontSize: 28 }} />,
          description: 'UFW firewall rules & presets',
          onClick: () => navigate('/firewall'),
          color: '#E53935',
          favoritePath: '/firewall',
        },
        {
          label: 'Monitoring',
          icon: <MonitorHeartIcon sx={{ fontSize: 28 }} />,
          description: 'CPU, memory, disk & services',
          onClick: () => navigate('/monitoring'),
          color: '#43A047',
          favoritePath: '/monitoring',
        },
        {
          label: 'Backup & Restore',
          icon: <BackupIcon sx={{ fontSize: 28 }} />,
          description: 'Server backups & scheduling',
          onClick: () => navigate('/backup'),
          color: '#FB8C00',
          favoritePath: '/backup',
        },
        {
          label: '2FA Security',
          icon: <SecurityIcon sx={{ fontSize: 28 }} />,
          description: 'Two-factor authentication',
          onClick: () => navigate('/two-factor'),
          color: '#6A1B9A',
          favoritePath: '/two-factor',
        },
        {
          label: 'Processes',
          icon: <MemoryIcon sx={{ fontSize: 28 }} />,
          description: 'Process & service manager',
          onClick: () => navigate('/processes'),
          color: '#0277BD',
          favoritePath: '/processes',
        },
        {
          label: 'Docker Manager',
          icon: <StorageIcon sx={{ fontSize: 28 }} />,
          description: 'Containers, images & Compose stacks',
          onClick: () => navigate('/docker'),
          color: '#2496ED',
          favoritePath: '/docker',
        },
        {
          label: 'App Manager',
          icon: <CodeIcon sx={{ fontSize: 28 }} />,
          description: 'Node.js & Python apps via PM2',
          onClick: () => navigate('/node-apps'),
          color: '#68A063',
          favoritePath: '/node-apps',
        },
        ...(phpMyAdminInstalled
          ? [
              {
                label: 'phpMyAdmin',
                icon: <StorageIcon sx={{ fontSize: 28 }} />,
                description: 'MySQL web interface',
                onClick: () => window.open('/phpmyadmin/', '_blank', 'noopener,noreferrer'),
                color: '#F89C0E',
              },
            ]
          : []),
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Tools
            </Typography>
            <TextField
              size="small"
              placeholder="Search tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ ml: 'auto', width: 260 }}
            />
          </Box>
          <Stack spacing={4}>
            {toolSections
              .map((section) => {
                const filtered = section.items.filter(
                  (it) =>
                    !search ||
                    it.label.toLowerCase().includes(search.toLowerCase()) ||
                    it.description?.toLowerCase().includes(search.toLowerCase())
                );
                if (filtered.length === 0) return null;
                return (
                  <Box key={section.title}>
                    <Typography
                      variant="h6"
                      sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}
                    >
                      {section.title}
                    </Typography>
                    <Grid container spacing={2}>
                      {filtered.map((it) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={it.label}>
                          <ToolCard
                            icon={it.icon}
                            label={it.label}
                            description={it.description}
                            onClick={it.onClick}
                            isFavorite={!!it.favoritePath && favorites.includes(it.favoritePath)}
                            onToggleFavorite={it.favoritePath ? () => toggleFavorite(it.favoritePath!) : undefined}
                            color={it.color}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                );
              })
              .filter(Boolean)}
            {toolSections.every((s) =>
              s.items.every(
                (it) =>
                  search &&
                  !it.label.toLowerCase().includes(search.toLowerCase()) &&
                  !it.description?.toLowerCase().includes(search.toLowerCase())
              )
            ) && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No tools found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try a different search term
                </Typography>
              </Box>
            )}
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

