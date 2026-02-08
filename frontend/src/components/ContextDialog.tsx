import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    Typography,
    Box,
    Chip,
    Stack,
    IconButton,
} from '@mui/material';
import {
    Visibility,
    Edit,
    FileCopy,
    DriveFileMove,
    Settings,
    Archive,
    Download,
    DriveFileRenameOutline,
    Delete,
    Close,
    Unarchive,
} from '@mui/icons-material';
import { FileItem } from '../api/files';

interface ContextDialogProps {
    open: boolean;
    onClose: () => void;
    item: FileItem | null;
    currentPath: string;
    onAction: (action: string, item: FileItem) => void;
}

export const ContextDialog: React.FC<ContextDialogProps> = ({
    open,
    onClose,
    item,
    currentPath,
    onAction,
}) => {
    if (!item) return null;

    const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    const isFile = item.type === 'file';

    // Check if file is an archive
    const isArchive = isFile && /\.(zip|tar|gz|tgz|tar\.gz)$/i.test(item.name);

    const actions = isFile
        ? [
            { label: 'View', icon: <Visibility />, action: 'view' },
            { label: 'Edit', icon: <Edit />, action: 'edit' },
            ...(isArchive ? [{ label: 'Extract', icon: <Unarchive />, action: 'extract' }] : []),
            { label: 'Copy', icon: <FileCopy />, action: 'copy' },
            { label: 'Move', icon: <DriveFileMove />, action: 'move' },
            { label: 'Permissions', icon: <Settings />, action: 'chmod' },
            { label: 'Compress', icon: <Archive />, action: 'compress' },
            { label: 'Download', icon: <Download />, action: 'download' },
            { label: 'Rename', icon: <DriveFileRenameOutline />, action: 'rename' },
            { label: 'Delete', icon: <Delete />, action: 'delete', color: 'error' as const },
        ]
        : [
            { label: 'Open', icon: <Visibility />, action: 'open' },
            { label: 'Copy', icon: <FileCopy />, action: 'copy' },
            { label: 'Move', icon: <DriveFileMove />, action: 'move' },
            { label: 'Permissions', icon: <Settings />, action: 'chmod' },
            { label: 'Compress', icon: <Archive />, action: 'compress' },
            { label: 'Download', icon: <Download />, action: 'download' },
            { label: 'Rename', icon: <DriveFileRenameOutline />, action: 'rename' },
            { label: 'Delete', icon: <Delete />, action: 'delete', color: 'error' as const },
        ];

    const handleAction = (action: string) => {
        onAction(action, item);
        if (action !== 'edit' && action !== 'chmod' && action !== 'copy') {
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{item.name}</Typography>
                    <IconButton size="small" onClick={onClose}>
                        <Close />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 3 }}>
                    <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" color="text.secondary">Type:</Typography>
                            <Chip label={item.type} size="small" />
                        </Stack>
                        {isFile && (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" color="text.secondary">Size:</Typography>
                                <Typography variant="body2">
                                    {(item.size / 1024).toFixed(1)} KB
                                </Typography>
                            </Stack>
                        )}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" color="text.secondary">Modified:</Typography>
                            <Typography variant="body2">
                                {new Date(item.modified).toLocaleString()}
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" color="text.secondary">Permissions:</Typography>
                            <Typography variant="body2" fontFamily="monospace">
                                {item.permissions}
                            </Typography>
                        </Stack>
                    </Stack>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {actions.map((action) => (
                        <Button
                            key={action.action}
                            fullWidth
                            variant="outlined"
                            color={action.color || 'primary'}
                            startIcon={action.icon}
                            onClick={() => handleAction(action.action)}
                            sx={{ justifyContent: 'flex-start' }}
                        >
                            {action.label}
                        </Button>
                    ))}
                </Box>
            </DialogContent>
        </Dialog>
    );
};
