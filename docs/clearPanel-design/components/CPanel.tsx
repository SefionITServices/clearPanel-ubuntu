import { FileManager } from './FileManager';
import { DomainsPage } from './DomainsPage';
import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  InputBase,
  Typography,
  Card,
  CardContent,
  Grid,
  Badge,
  Avatar,
  LinearProgress,
  Paper,
  alpha,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Dashboard as DashboardIcon,
  Build as BuildIcon,
  FolderOpen as FolderOpenIcon,
  Language as LanguageIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Folder as FolderIcon,
  Storage as StorageIcon,
  Backup as BackupIcon,
  Image as ImageIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
  Email as EmailIcon,
  Forward as ForwardIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.black, 0.05),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.black, 0.08),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  maxWidth: '400px',
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
  },
}));

const ToolCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

interface Tool {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

export function CPanel() {
  const [selectedMenu, setSelectedMenu] = useState('Tools');
  const [showFileManager, setShowFileManager] = useState(false);
  const [showDomains, setShowDomains] = useState(false);

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon /> },
    { text: 'Tools', icon: <BuildIcon /> },
    { text: 'File Manager', icon: <FolderOpenIcon /> },
    { text: 'Domains', icon: <LanguageIcon /> },
    { text: 'Settings', icon: <SettingsIcon /> },
  ];

  const fileTools: Tool[] = [
    {
      icon: <FolderIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
      title: 'File Manager',
      description: 'Browse and manage files',
      color: '#4285F4',
    },
    {
      icon: <StorageIcon sx={{ fontSize: 40, color: '#34A853' }} />,
      title: 'Disk Usage',
      description: 'View storage usage',
      color: '#34A853',
    },
    {
      icon: <BackupIcon sx={{ fontSize: 40, color: '#FBBC04' }} />,
      title: 'Backup',
      description: 'Create and restore backups',
      color: '#FBBC04',
    },
    {
      icon: <ImageIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
      title: 'Images',
      description: 'Manage image files',
      color: '#4285F4',
    },
  ];

  const securityTools: Tool[] = [
    {
      icon: <SecurityIcon sx={{ fontSize: 40, color: '#EA4335' }} />,
      title: 'Directory Privacy',
      description: 'Protect directories',
      color: '#EA4335',
    },
    {
      icon: <CloudIcon sx={{ fontSize: 40, color: '#7B8A99' }} />,
      title: 'FTP Manager',
      description: 'Manage FTP accounts',
      color: '#7B8A99',
    },
  ];

  const emailTools: Tool[] = [
    {
      icon: <EmailIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
      title: 'Email Accounts',
      description: 'Manage email accounts',
      color: '#4285F4',
    },
    {
      icon: <ForwardIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
      title: 'Forwarders',
      description: 'Configure email forwarding',
      color: '#4285F4',
    },
    {
      icon: <FilterListIcon sx={{ fontSize: 40, color: '#FF6B35' }} />,
      title: 'Email Filters',
      description: 'Set up email filters',
      color: '#FF6B35',
    },
  ];

  const domainTools: Tool[] = [
    {
      icon: <LanguageIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
      title: 'Domains',
      description: 'Manage domains',
      color: '#4285F4',
    },
    {
      icon: <FolderOpenIcon sx={{ fontSize: 40, color: '#34A853' }} />,
      title: 'Subdomains',
      description: 'Manage subdomains',
      color: '#34A853',
    },
    {
      icon: <BackupIcon sx={{ fontSize: 40, color: '#FBBC04' }} />,
      title: 'DNS Records',
      description: 'Manage DNS records',
      color: '#FBBC04',
    },
    {
      icon: <ImageIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
      title: 'Email Forwarders',
      description: 'Manage email forwarders',
      color: '#4285F4',
    },
  ];

  const handleToolClick = (toolTitle: string) => {
    if (toolTitle === 'File Manager') {
      setShowFileManager(true);
    } else if (toolTitle === 'Domains') {
      setShowDomains(true);
    }
  };

  const handleMenuClick = (menuText: string) => {
    setSelectedMenu(menuText);
    if (menuText === 'File Manager') {
      setShowFileManager(true);
    } else if (menuText === 'Domains') {
      setShowDomains(true);
    }
  };

  if (showFileManager) {
    return <FileManager onClose={() => setShowFileManager(false)} />;
  }

  if (showDomains) {
    return <DomainsPage onClose={() => setShowDomains(false)} />;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          bgcolor: 'white',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Toolbar>
          <Search>
            <SearchIconWrapper>
              <SearchIcon sx={{ color: '#9e9e9e' }} />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search…"
              inputProps={{ 'aria-label': 'search' }}
            />
          </Search>
          <Box sx={{ flexGrow: 1 }} />
          <Badge badgeContent={3} color="error" sx={{ mr: 3 }}>
            <NotificationsIcon sx={{ color: '#757575' }} />
          </Badge>
          <Avatar sx={{ bgcolor: '#4285F4', width: 36, height: 36 }}>H</Avatar>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #e0e0e0',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: '#4285F4', width: 32, height: 32 }}>H</Avatar>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            clearPanel
          </Typography>
        </Box>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={selectedMenu === item.text}
                onClick={() => handleMenuClick(item.text)}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: alpha('#4285F4', 0.08),
                    '&:hover': {
                      bgcolor: alpha('#4285F4', 0.12),
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: selectedMenu === item.text ? '#4285F4' : 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: selectedMenu === item.text ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: '#f5f5f5',
          p: 3,
          mt: 8,
        }}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} lg={9}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
              Tools
            </Typography>

            {/* Files Section */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
              Files
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {fileTools.map((tool) => (
                <Grid item xs={12} sm={6} md={3} key={tool.title}>
                  <ToolCard onClick={() => handleToolClick(tool.title)}>
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box sx={{ mb: 2 }}>{tool.icon}</Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {tool.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {tool.description}
                      </Typography>
                    </CardContent>
                  </ToolCard>
                </Grid>
              ))}
            </Grid>

            {/* Security Section (Row) */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {securityTools.map((tool) => (
                <Grid item xs={12} sm={6} md={3} key={tool.title}>
                  <ToolCard>
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box sx={{ mb: 2 }}>{tool.icon}</Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {tool.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {tool.description}
                      </Typography>
                    </CardContent>
                  </ToolCard>
                </Grid>
              ))}
            </Grid>

            {/* Email Section */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
              Email
            </Typography>
            <Grid container spacing={2}>
              {emailTools.map((tool) => (
                <Grid item xs={12} sm={6} md={3} key={tool.title}>
                  <ToolCard>
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box sx={{ mb: 2 }}>{tool.icon}</Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {tool.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {tool.description}
                      </Typography>
                    </CardContent>
                  </ToolCard>
                </Grid>
              ))}
            </Grid>

            {/* Domains Section */}
            <Typography variant="h6" sx={{ mb: 2, mt: 4, fontWeight: 500 }}>
              Domains
            </Typography>
            <Grid container spacing={2}>
              {domainTools.map((tool) => (
                <Grid item xs={12} sm={6} md={3} key={tool.title}>
                  <ToolCard onClick={() => handleToolClick(tool.title)}>
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box sx={{ mb: 2 }}>{tool.icon}</Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {tool.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {tool.description}
                      </Typography>
                    </CardContent>
                  </ToolCard>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Right Sidebar - Statistics */}
          <Grid item xs={12} lg={3}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                General Information
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Current User
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  hadm751
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Primary Domain
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  mainserver.in
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Shared IP Address
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  72.8.7.15
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Home Directory
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  /home/hadm751
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Disk Usage
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  394056329b / 20090203144
                </Typography>
              </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Statistics
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Disk Usage</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    70%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={70}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: '#e3f2fd',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: '#2196f3',
                      borderRadius: 1,
                    },
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Processes</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    6%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={6}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: '#e8f5e9',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: '#4caf50',
                      borderRadius: 1,
                    },
                  }}
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Memory</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    55%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={55}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: '#fff3e0',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: '#ff9800',
                      borderRadius: 1,
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}