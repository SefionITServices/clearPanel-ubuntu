import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Collapse,
    CircularProgress,
    Alert,
    Box,
    Breadcrumbs,
    Link,
} from '@mui/material';
import { Folder, FolderOpen, ExpandMore, ChevronRight } from '@mui/icons-material';
import { filesAPI } from '../api/files';
import { ConflictDialog } from './ConflictDialog';

interface CopyMoveDialogProps {
    open: boolean;
    onClose: () => void;
    mode: 'copy' | 'move';
    sourcePaths: string[];
    sourceNames: string[];
    onComplete: () => void;
    currentPath: string;
}

interface TreeNode {
    name: string;
    path: string;
    children?: TreeNode[];
    loaded: boolean;
    expanded: boolean;
}

export const CopyMoveDialog: React.FC<CopyMoveDialogProps> = ({
    open,
    onClose,
    mode,
    sourcePaths,
    sourceNames,
    onComplete,
    currentPath,
}) => {
    const [selectedPath, setSelectedPath] = useState('');
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflictOpen, setConflictOpen] = useState(false);
    const [conflictFileName, setConflictFileName] = useState('');
    const [conflictIndex, setConflictIndex] = useState(0);

    useEffect(() => {
        if (open) {
            loadRoot();
        }
    }, [open]);

    const loadRoot = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await filesAPI.list('');
            const dirs = data.items
                .filter((item) => item.type === 'directory')
                .map((dir) => ({
                    name: dir.name,
                    path: dir.name,
                    loaded: false,
                    expanded: false,
                }));
            setTree(dirs);
            setSelectedPath('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadChildren = async (node: TreeNode, path: string[]) => {
        try {
            const data = await filesAPI.list(node.path);
            const dirs = data.items
                .filter((item) => item.type === 'directory')
                .map((dir) => ({
                    name: dir.name,
                    path: node.path ? `${node.path}/${dir.name}` : dir.name,
                    loaded: false,
                    expanded: false,
                }));

            // Update tree with new children
            setTree((prevTree) => {
                const newTree = [...prevTree];
                let current: TreeNode[] = newTree;

                for (let i = 0; i < path.length - 1; i++) {
                    const found = current.find((n) => n.name === path[i]);
                    if (found && found.children) {
                        current = found.children;
                    }
                }

                const targetNode = current.find((n) => n.name === node.name);
                if (targetNode) {
                    targetNode.children = dirs;
                    targetNode.loaded = true;
                }

                return newTree;
            });
        } catch (e: any) {
            setError(e.message);
        }
    };

    const toggleNode = async (node: TreeNode, path: string[]) => {
        if (!node.expanded && !node.loaded) {
            await loadChildren(node, path);
        }

        setTree((prevTree) => {
            const newTree = [...prevTree];
            let current: TreeNode[] = newTree;

            for (let i = 0; i < path.length - 1; i++) {
                const found = current.find((n) => n.name === path[i]);
                if (found && found.children) {
                    current = found.children;
                }
            }

            const targetNode = current.find((n) => n.name === node.name);
            if (targetNode) {
                targetNode.expanded = !targetNode.expanded;
            }

            return newTree;
        });
    };

    const renderTree = (nodes: TreeNode[], path: string[] = []): React.ReactNode => {
        return nodes.map((node) => {
            const currentPath = [...path, node.name];
            return (
                <React.Fragment key={node.path}>
                    <ListItem disablePadding sx={{ pl: path.length * 2 }}>
                        <ListItemButton
                            onClick={() => setSelectedPath(node.path)}
                            selected={selectedPath === node.path}
                        >
                            <ListItemIcon onClick={(e) => { e.stopPropagation(); toggleNode(node, currentPath); }} sx={{ minWidth: 32 }}>
                                {node.expanded ? <ExpandMore /> : <ChevronRight />}
                            </ListItemIcon>
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                {node.expanded ? <FolderOpen color="primary" /> : <Folder />}
                            </ListItemIcon>
                            <ListItemText primary={node.name} />
                        </ListItemButton>
                    </ListItem>
                    {node.expanded && node.children && (
                        <Collapse in={node.expanded} timeout="auto" unmountOnExit>
                            {renderTree(node.children, currentPath)}
                        </Collapse>
                    )}
                </React.Fragment>
            );
        });
    };

    const handleConfirm = async () => {
        // Check if files already exist in destination
        const checkConflicts = async () => {
            try {
                const destData = await filesAPI.list(selectedPath);
                const existingNames = destData.items.map(item => item.name);

                for (let i = 0; i < sourceNames.length; i++) {
                    if (existingNames.includes(sourceNames[i])) {
                        // Conflict found
                        setConflictFileName(sourceNames[i]);
                        setConflictIndex(i);
                        setConflictOpen(true);
                        return true; // Has conflict
                    }
                }
                return false; // No conflict
            } catch (e: any) {
                setError(e.message);
                return false;
            }
        };

        const hasConflict = await checkConflicts();
        if (!hasConflict) {
            await performOperation();
        }
    };

    const handleConflictResolve = async (action: 'replace' | 'rename', newName?: string) => {
        if (action === 'rename' && newName) {
            // For rename, we need to copy/move with a different destination name
            // We'll copy to the destination with the new name
            setLoading(true);
            setError(null);

            try {
                const sourcePath = sourcePaths[conflictIndex];
                const destPath = selectedPath ? `${selectedPath}/${newName}` : newName;

                if (mode === 'copy') {
                    // Copy just this one file with new name
                    await filesAPI.copy([sourcePath], selectedPath);
                    // Note: The backend copy API doesn't support custom names yet
                    // We need to rename after copying
                    const tempDest = selectedPath ? `${selectedPath}/${sourceNames[conflictIndex]}` : sourceNames[conflictIndex];
                    await filesAPI.rename(tempDest, newName);
                } else {
                    // Move with rename
                    await filesAPI.move([sourcePath], selectedPath);
                    const tempDest = selectedPath ? `${selectedPath}/${sourceNames[conflictIndex]}` : sourceNames[conflictIndex];
                    await filesAPI.rename(tempDest, newName);
                }

                onComplete();
                onClose();
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        } else {
            // Replace - just do the operation normally (will overwrite)
            await performOperation();
        }
    };

    const performOperation = async (paths = sourcePaths, names = sourceNames) => {
        setLoading(true);
        setError(null);

        try {
            if (mode === 'copy') {
                await filesAPI.copy(paths, selectedPath);
            } else {
                await filesAPI.move(paths, selectedPath);
            }
            onComplete();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const pathParts = selectedPath ? selectedPath.split('/') : [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {mode === 'copy' ? 'Copy' : 'Move'} {sourceNames.length} item(s)
            </DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Select destination folder:
                </Typography>

                <Box sx={{ mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Breadcrumbs>
                        <Link
                            component="button"
                            variant="body2"
                            onClick={() => setSelectedPath('')}
                            sx={{ cursor: 'pointer' }}
                        >
                            Root
                        </Link>
                        {pathParts.map((part, idx) => {
                            const partialPath = pathParts.slice(0, idx + 1).join('/');
                            return (
                                <Link
                                    key={idx}
                                    component="button"
                                    variant="body2"
                                    onClick={() => setSelectedPath(partialPath)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    {part}
                                </Link>
                            );
                        })}
                    </Breadcrumbs>
                </Box>

                {loading && tree.length === 0 ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <List dense>
                            <ListItem disablePadding>
                                <ListItemButton
                                    onClick={() => setSelectedPath('')}
                                    selected={selectedPath === ''}
                                >
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <FolderOpen color="primary" />
                                    </ListItemIcon>
                                    <ListItemText primary="Root" />
                                </ListItemButton>
                            </ListItem>
                            {renderTree(tree)}
                        </List>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={loading}
                >
                    {mode === 'copy' ? 'Copy Here' : 'Move Here'}
                </Button>
            </DialogActions>

            <ConflictDialog
                open={conflictOpen}
                onClose={() => setConflictOpen(false)}
                fileName={conflictFileName}
                onResolve={handleConflictResolve}
            />
        </Dialog>
    );
};
