import React, { useState, useEffect } from 'react';
import {
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Collapse,
    Box,
    CircularProgress,
} from '@mui/material';
import {
    Folder,
    FolderOpen,
    KeyboardArrowRight,
    KeyboardArrowDown,
} from '@mui/icons-material';
import { filesAPI, FileItem } from '../api/files';

interface FileTreeProps {
    currentPath: string;
    onNavigate: (path: string) => void;
}

interface TreeNodeProps {
    name: string;
    path: string;
    level: number;
    currentPath: string;
    onNavigate: (path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ name, path, level, currentPath, onNavigate }) => {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const isSelected = currentPath === path || currentPath.startsWith(path + '/');
    const isExactMatch = currentPath === path;

    const handleExpand = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (expanded) {
            setExpanded(false);
            return;
        }

        setExpanded(true);
        if (!loaded) {
            setLoading(true);
            try {
                const data = await filesAPI.list(path);
                if (data.success) {
                    const folders = (data.items || [])
                        .filter((item) => item.type === 'directory')
                        .sort((a, b) => a.name.localeCompare(b.name));
                    setChildren(folders);
                    setLoaded(true);
                }
            } catch (error) {
                console.error('Failed to load tree nodes', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleClick = () => {
        onNavigate(path);
    };

    return (
        <>
            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                    selected={isExactMatch}
                    sx={{
                        minHeight: 32,
                        px: 1,
                        pl: level * 2 + 1,
                        py: 0.5,
                        '&.Mui-selected': {
                            bgcolor: '#e3f2fd',
                        },
                        '&:hover': {
                            bgcolor: '#f5f5f5',
                        },
                    }}
                    onClick={handleClick}
                >
                    <Box
                        component="span"
                        onClick={handleExpand}
                        sx={{
                            mr: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            color: 'text.secondary',
                            '&:hover': { color: 'text.primary' },
                        }}
                    >
                        {loading ? (
                            <CircularProgress size={16} />
                        ) : expanded ? (
                            <KeyboardArrowDown fontSize="small" />
                        ) : (
                            <KeyboardArrowRight fontSize="small" />
                        )}
                    </Box>
                    <ListItemIcon sx={{ minWidth: 28, mr: 0.5 }}>
                        {expanded || isSelected ? (
                            <FolderOpen fontSize="small" color="primary" />
                        ) : (
                            <Folder fontSize="small" color="primary" />
                        )}
                    </ListItemIcon>
                    <ListItemText
                        primary={name}
                        primaryTypographyProps={{
                            variant: 'body2',
                            noWrap: true,
                            fontWeight: isSelected ? 600 : 400,
                        }}
                    />
                </ListItemButton>
            </ListItem>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    {children.map((child) => (
                        <TreeNode
                            key={child.name}
                            name={child.name}
                            path={path ? `${path}/${child.name}` : child.name}
                            level={level + 1}
                            currentPath={currentPath}
                            onNavigate={onNavigate}
                        />
                    ))}
                </List>
            </Collapse>
        </>
    );
};

export const FileTree: React.FC<FileTreeProps> = ({ currentPath, onNavigate }) => {
    const [rootChildren, setRootChildren] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadRoot = async () => {
            setLoading(true);
            try {
                const data = await filesAPI.list('');
                if (data.success) {
                    const folders = (data.items || [])
                        .filter((item) => item.type === 'directory')
                        .sort((a, b) => a.name.localeCompare(b.name));
                    setRootChildren(folders);
                }
            } catch (error) {
                console.error('Failed to load root', error);
            } finally {
                setLoading(false);
            }
        };
        void loadRoot();
    }, []);

    return (
        <List
            sx={{
                width: '100%',
                bgcolor: 'background.paper',
                overflow: 'auto',
                height: '100%',
                '& .MuiListItemButton-root': {
                    py: 0,
                },
            }}
            component="nav"
        >
            <ListItem disablePadding>
                <ListItemButton
                    selected={currentPath === ''}
                    onClick={() => onNavigate('')}
                    sx={{ py: 0.5 }}
                >
                    <ListItemIcon sx={{ minWidth: 28, mr: 0.5 }}>
                        <FolderOpen fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText primary="Home" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
                </ListItemButton>
            </ListItem>
            {rootChildren.map((child) => (
                <TreeNode
                    key={child.name}
                    name={child.name}
                    path={child.name}
                    level={1}
                    currentPath={currentPath}
                    onNavigate={onNavigate}
                />
            ))}
        </List>
    );
};
