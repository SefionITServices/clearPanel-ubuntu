import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Stack,
    Typography,
    Alert,
    Box,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import { Close, Save, LightMode, DarkMode } from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import { filesAPI } from '../api/files';

interface FileEditorProps {
    open: boolean;
    onClose: () => void;
    file: { path: string; name: string } | null;
    onSave?: (content: string) => void;
}

export const FileEditor: React.FC<FileEditorProps> = ({
    open,
    onClose,
    file,
    onSave,
}) => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [theme, setTheme] = useState<'light' | 'vs-dark'>('vs-dark');

    // Detect language from file extension
    const getLanguage = (filename: string): string => {
        if (!filename) return 'plaintext';
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const langMap: { [key: string]: string } = {
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            json: 'json',
            html: 'html',
            htm: 'html',
            css: 'css',
            scss: 'scss',
            less: 'less',
            php: 'php',
            py: 'python',
            rb: 'ruby',
            go: 'go',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
            cs: 'csharp',
            xml: 'xml',
            yaml: 'yaml',
            yml: 'yaml',
            md: 'markdown',
            sql: 'sql',
            sh: 'shell',
            bash: 'shell',
            dockerfile: 'dockerfile',
            rs: 'rust',
        };
        return langMap[ext] || 'plaintext';
    };

    useEffect(() => {
        if (open && file) {
            loadFile();
        }
    }, [open, file]);

    const loadFile = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const data = await filesAPI.read(file.path);
            setContent(data.content || '');
            setHasChanges(false);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            // If onSave is provided, let parent handle saving (which it does in FileManager)
            // Or we can keep the write logic here if onSave is just a callback.
            // In FileManager, onSave does the writing. So we should just call onSave(content).

            if (onSave) {
                await onSave(content);
            } else {
                // Fallback if no onSave provided (though FileManager provides it)
                await filesAPI.write(file.path, content);
            }

            setHasChanges(false);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (hasChanges) {
            if (window.confirm('You have unsaved changes. Close anyway?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleEditorChange = (value: string | undefined) => {
        setContent(value || '');
        setHasChanges(true);
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
            <DialogTitle>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Edit: {file?.name}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <ToggleButtonGroup
                            value={theme}
                            exclusive
                            onChange={(e, newTheme) => {
                                if (newTheme) setTheme(newTheme);
                            }}
                            size="small"
                        >
                            <ToggleButton value="light">
                                <LightMode fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="vs-dark">
                                <DarkMode fontSize="small" />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <IconButton size="small" onClick={handleClose}>
                            <Close />
                        </IconButton>
                    </Stack>
                </Stack>
            </DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}
                <Box sx={{ height: '600px', border: '1px solid', borderColor: 'divider' }}>
                    <Editor
                        height="100%"
                        language={getLanguage(file?.name || '')}
                        value={content}
                        onChange={handleEditorChange}
                        theme={theme}
                        options={{
                            minimap: { enabled: true },
                            fontSize: 14,
                            wordWrap: 'on',
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            readOnly: loading,
                        }}
                        loading={<Typography>Loading editor...</Typography>}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
                    {hasChanges && '● Unsaved changes'}
                </Typography>
                <Button onClick={handleClose}>Close</Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    startIcon={<Save />}
                    disabled={loading || !hasChanges}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};
