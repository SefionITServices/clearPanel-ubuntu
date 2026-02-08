import React from 'react';
import { Box, Button, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Add, CloudQueue, Delete, Schedule, StarBorder, Storage } from '@mui/icons-material';
import { FileTree } from './FileTree';
import { DiskUsage } from './DiskUsage';

interface FileManagerSidebarProps {
    currentPath: string;
    onNavigate: (path: string) => void;
    diskUsage: { total: number; used: number };
    onCreateNew: () => void;
}

export const FileManagerSidebar: React.FC<FileManagerSidebarProps> = ({
    currentPath,
    onNavigate,
    diskUsage,
    onCreateNew,
}) => {
    return (
        <Box
            sx={{
                width: 250,
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
            }}
        >
            <Box sx={{ p: 2 }}>
                <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Add />}
                    onClick={onCreateNew}
                    sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 2 }}
                >
                    New
                </Button>
            </Box>

            <List component="nav" sx={{ px: 1 }}>
                <ListItem disablePadding>
                    <ListItemButton selected={currentPath === ''} onClick={() => onNavigate('')} sx={{ borderRadius: 1 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                            <Storage fontSize="small" color={currentPath === '' ? 'primary' : 'action'} />
                        </ListItemIcon>
                        <ListItemText primary="My Files" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                    <ListItemButton sx={{ borderRadius: 1 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                            <Schedule fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Recent" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                    <ListItemButton sx={{ borderRadius: 1 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                            <StarBorder fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Starred" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                    <ListItemButton sx={{ borderRadius: 1 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                            <Delete fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Trash" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </ListItemButton>
                </ListItem>
            </List>

            <Divider sx={{ my: 1, mx: 2 }} />

            <Box sx={{ flexGrow: 1, overflow: 'auto', px: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block', fontWeight: 600 }}>
                    FOLDERS
                </Typography>
                <FileTree currentPath={currentPath} onNavigate={onNavigate} />
            </Box>

            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <DiskUsage total={diskUsage.total} used={diskUsage.used} />
            </Box>
        </Box>
    );
};
