import React from 'react';
import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Typography,
    Checkbox,
} from '@mui/material';
import { FileItem } from '../api/files';
import { FileIcon } from './FileIcon';

interface FileGridProps {
    items: FileItem[];
    selected: Set<string>;
    onSelect: (name: string) => void;
    onNavigate: (path: string) => void;
    onContextMenu: (event: React.MouseEvent, item: FileItem) => void;
    currentPath: string;
}

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const FileGrid: React.FC<FileGridProps> = ({
    items,
    selected,
    onSelect,
    onNavigate,
    onContextMenu,
    currentPath,
}) => {
    return (
        <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
            {items.map((item) => {
                const isSelected = selected.has(item.name);
                const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;

                return (
                    <Box key={item.name}>
                        <Card
                            variant="outlined"
                            sx={{
                                height: '100%',
                                bgcolor: isSelected ? 'action.selected' : 'background.paper',
                                borderColor: isSelected ? 'primary.main' : 'divider',
                                position: 'relative',
                                '&:hover': {
                                    bgcolor: 'action.hover',
                                },
                            }}
                            onContextMenu={(e) => onContextMenu(e, item)}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 4,
                                    left: 4,
                                    zIndex: 1,
                                }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={isSelected}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onSelect(item.name);
                                    }}
                                    sx={{
                                        p: 0.5,
                                        bgcolor: 'background.paper',
                                        borderRadius: '50%',
                                        opacity: isSelected ? 1 : 0,
                                        transition: 'opacity 0.2s',
                                        '.MuiCard-root:hover &': {
                                            opacity: 1,
                                        },
                                    }}
                                />
                            </Box>
                            <CardActionArea
                                onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        onSelect(item.name);
                                    } else {
                                        if (item.type === 'directory') {
                                            onNavigate(fullPath);
                                        } else {
                                            // For files, maybe preview? For now just select
                                            onSelect(item.name);
                                        }
                                    }
                                }}
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    p: 2,
                                }}
                            >
                                <FileIcon
                                    fileName={item.name}
                                    isDirectory={item.type === 'directory'}
                                    sx={{ fontSize: 48, mb: 1 }}
                                />
                                <CardContent sx={{ p: 0, width: '100%', textAlign: 'center' }}>
                                    <Typography
                                        variant="body2"
                                        noWrap
                                        title={item.name}
                                        sx={{ fontWeight: 500, mb: 0.5 }}
                                    >
                                        {item.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {item.type === 'directory'
                                            ? 'Folder'
                                            : formatSize(item.size)}
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Box>
                );
            })}
        </Box>
    );
};
