import React from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  InputBase,
  alpha,
  Badge,
  Menu,
  MenuItem,
  Divider,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Build as BuildIcon,
  Language as LanguageIcon,
  Lock as LockIcon,
  Dns as DnsIcon,
  Terminal as TerminalIcon,
  Storage as StorageIcon,
  Code as CodeIcon,
  Email as EmailIcon,
  Article as LogsIcon,
  Star as StarIcon,
  Cloud as CloudIcon,
  Schedule as ScheduleIcon,
  Shield as ShieldIcon,
  MonitorHeart as MonitorIcon,
  Backup as BackupIcon,
  Security as SecurityIcon,
  Memory as MemoryIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { DashboardContent } from './content';
import { dashboardLayoutVars } from './css-vars';

const DRAWER_WIDTH = 260;

type NavItem = {
  title: string;
  path: string;
  icon: React.ReactNode;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const BASE_NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { title: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { title: 'Tools', path: '/tools', icon: <BuildIcon /> },
    ],
  },
  {
    title: 'Quick Access',
    items: [
      { title: 'File Manager', path: '/files', icon: <FolderIcon /> },
      { title: 'Domains', path: '/domains', icon: <LanguageIcon /> },
      { title: 'Email', path: '/email', icon: <EmailIcon /> },
      { title: 'Databases', path: '/databases', icon: <StorageIcon /> },
      { title: 'Terminal', path: '/terminal', icon: <TerminalIcon /> },
    ],
  },
  {
    title: 'System',
    items: [
      { title: 'Settings', path: '/settings', icon: <SettingsIcon /> },
    ],
  },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [favoriteNavItems, setFavoriteNavItems] = React.useState<NavItem[]>([]);

  const loadFavorites = React.useCallback(() => {
    if (!username) return;
    try {
      const raw = localStorage.getItem(`clearpanel:favorites:${username}`);
      if (!raw) { setFavoriteNavItems([]); return; }
      const paths: string[] = JSON.parse(raw);
      const map: Record<string, NavItem> = {
        '/files': { title: 'File Manager', path: '/files', icon: <FolderIcon /> },
        '/domains': { title: 'Domains', path: '/domains', icon: <LanguageIcon /> },
        '/dns': { title: 'DNS Zones', path: '/dns', icon: <DnsIcon /> },
        '/ssl': { title: 'SSL Certificates', path: '/ssl', icon: <LockIcon /> },
        '/databases': { title: 'Databases', path: '/databases', icon: <StorageIcon /> },
        '/php': { title: 'PHP Manager', path: '/php', icon: <CodeIcon /> },
        '/email-accounts': { title: 'Email Accounts', path: '/email-accounts', icon: <EmailIcon /> },
        '/email': { title: 'Email', path: '/email', icon: <EmailIcon /> },
        '/mail-domains': { title: 'Mail Domains', path: '/mail-domains', icon: <EmailIcon /> },
        '/terminal': { title: 'Terminal', path: '/terminal', icon: <TerminalIcon /> },
        '/webserver': { title: 'Web Server', path: '/webserver', icon: <CloudIcon /> },
        '/logs': { title: 'Logs', path: '/logs', icon: <LogsIcon /> },
        '/app-store': { title: 'App Store', path: '/app-store', icon: <BuildIcon /> },
        '/settings': { title: 'Settings', path: '/settings', icon: <SettingsIcon /> },
        '/ssh-keys': { title: 'SSH Keys', path: '/ssh-keys', icon: <TerminalIcon /> },
        '/cron-jobs': { title: 'Cron Jobs', path: '/cron-jobs', icon: <ScheduleIcon /> },
        '/firewall': { title: 'Firewall', path: '/firewall', icon: <ShieldIcon /> },
        '/monitoring': { title: 'Monitoring', path: '/monitoring', icon: <MonitorIcon /> },
        '/backup': { title: 'Backup', path: '/backup', icon: <BackupIcon /> },
        '/two-factor': { title: '2FA Security', path: '/two-factor', icon: <SecurityIcon /> },
        '/processes': { title: 'Processes', path: '/processes', icon: <MemoryIcon /> },
      };
      const items = paths
        .map((p) => map[p])
        .filter((v): v is NavItem => !!v);
      setFavoriteNavItems(items);
    } catch {
      // ignore parse errors
    }
  }, [username]);

  React.useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Re-read favorites when another component updates localStorage
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `clearpanel:favorites:${username}`) loadFavorites();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [username, loadFavorites]);

  const handleDrawerToggle = () => setMobileOpen((p) => !p);
  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/login');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const navSections: NavSection[] = React.useMemo(() => {
    const sections: NavSection[] = [...BASE_NAV_SECTIONS];
    if (favoriteNavItems.length > 0) {
      sections.splice(1, 0, {
        title: 'Favorites',
        items: favoriteNavItems.slice(0, 7).map((item) => ({
          ...item,
          icon: (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StarIcon sx={{ fontSize: 16, color: '#FBC02D' }} />
              <Box component="span" sx={{ display: 'flex', '& svg': { fontSize: 20 } }}>
                {item.icon}
              </Box>
            </Box>
          ),
        })),
      });
    }
    return sections;
  }, [favoriteNavItems]);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          component="img"
          src="/logo.svg"
          alt="ClearPanel"
          sx={{ width: 36, height: 30 }}
        />
        <Typography variant="h6" fontWeight={700} noWrap sx={{ color: '#202124' }}>
          clearPanel
        </Typography>
      </Box>
      <Divider />

      {/* Navigation Sections */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
        {navSections.map((section, sIdx) => (
          <Box key={sIdx} sx={{ mb: 1 }}>
            {section.title && (
              <Typography
                variant="overline"
                sx={{
                  px: 1.5,
                  pt: 2,
                  pb: 0.5,
                  display: 'block',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'text.secondary',
                  letterSpacing: '0.08em',
                }}
              >
                {section.title}
              </Typography>
            )}
            <List disablePadding>
              {section.items.map((item) => {
                const isActive = location.pathname === item.path
                  || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'))
                  || (item.path === '/domains' && (location.pathname.startsWith('/domain-create') || location.pathname.startsWith('/nameserver-setup')))
                  || (item.path === '/email' && (location.pathname.startsWith('/email-accounts') || location.pathname.startsWith('/mail-domains') || location.pathname.startsWith('/forwarders') || location.pathname.startsWith('/email-filters')));
                return (
                  <ListItem key={item.title} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton
                      onClick={() => {
                        navigate(item.path);
                        setMobileOpen(false);
                      }}
                      sx={{
                        borderRadius: 2,
                        minHeight: 42,
                        py: 0.75,
                        color: isActive ? 'primary.main' : 'text.secondary',
                        bgcolor: isActive ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
                        '&:hover': {
                          bgcolor: isActive
                            ? (theme) => alpha(theme.palette.primary.main, 0.12)
                            : (theme) => alpha(theme.palette.action.hover, 0.04),
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                          color: isActive ? 'primary.main' : 'text.secondary',
                          '& svg': { fontSize: 20 },
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.title}
                        primaryTypographyProps={{
                          fontSize: '0.85rem',
                          fontWeight: isActive ? 600 : 500,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Bottom User Info */}
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'primary.main',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {username?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.3 }}>
            {username}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            Administrator
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Search Bar */}
          <Box
            sx={{
              position: 'relative',
              borderRadius: 2,
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.grey[500], 0.12),
              },
              mr: 2,
              ml: { xs: 0, sm: 2 },
              width: { xs: '100%', sm: 'auto' },
              maxWidth: { sm: 400 },
              flexGrow: { sm: 1 },
            }}
          >
            <Box
              sx={{
                padding: (theme) => theme.spacing(0, 2),
                height: '100%',
                position: 'absolute',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SearchIcon sx={{ color: 'text.secondary' }} />
            </Box>
            <InputBase
              placeholder="Search…"
              sx={{
                color: 'inherit',
                width: '100%',
                '& .MuiInputBase-input': {
                  padding: (theme) => theme.spacing(1.25, 1.25, 1.25, 0),
                  paddingLeft: (theme) => `calc(1em + ${theme.spacing(4)})`,
                  transition: (theme) => theme.transitions.create('width'),
                  width: '100%',
                },
              }}
            />
          </Box>

          <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />

          {/* Right Side Actions */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Notifications">
              <IconButton
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08) },
                }}
              >
                <Badge badgeContent={0} color="error">
                  <NotificationsIcon sx={{ fontSize: 22 }} />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Account Menu */}
            <IconButton
              onClick={handleMenuOpen}
              sx={{
                p: 0.5,
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08) },
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: 'primary.main',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {username?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Stack>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            onClick={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
                mt: 1.5,
                minWidth: 200,
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {username}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Administrator
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => navigate('/settings')} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
        <DashboardContent>{children}</DashboardContent>
      </Box>
    </Box>
  );
}
