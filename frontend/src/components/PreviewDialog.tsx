import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    CircularProgress,
    IconButton,
} from '@mui/material';
import { Close, Download, Edit } from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import { filesAPI } from '../api/files';

interface PreviewDialogProps {
    open: boolean;
    onClose: () => void;
    file: { name: string; path: string } | null;
    onEdit: (file: { name: string; path: string }) => void;
}

export const PreviewDialog: React.FC<PreviewDialogProps> = ({
    open,
    onClose,
    file,
    onEdit,
}) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isImage = file?.name.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
    const isVideo = file?.name.match(/\.(mp4|webm|ogg)$/i);
    const isAudio = file?.name.match(/\.(mp3|wav|ogg)$/i);
    const isCode = !isImage && !isVideo && !isAudio;

    useEffect(() => {
        if (open && file && isCode) {
            loadContent();
        }
    }, [open, file]);

    const loadContent = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const response = await filesAPI.read(file.path);
            if (response.success) {
                setContent(response.content);
            } else {
                setError(response.error || 'Failed to load file content');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!file) return;
        try {
            window.open(filesAPI.downloadURL(file.path), '_blank');
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    if (!file) return null;

    const rawUrl = filesAPI.getRawUrl(file.path);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Typography variant="h6" component="div" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 2 }}>
                    {file.name}
                </Typography>
                <Box>
                    {isCode && (
                        <Button
                            startIcon={<Edit />}
                            onClick={() => { onClose(); onEdit(file); }}
                            sx={{ mr: 1 }}
                        >
                            Edit
                        </Button>
                    )}
                    <Button
                        startIcon={<Download />}
                        onClick={handleDownload}
                        sx={{ mr: 1 }}
                    >
                        Download
                    </Button>
                    <IconButton onClick={onClose} size="small">
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#1e1e1e' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Box sx={{ p: 3, color: 'error.main' }}>
                        <Typography variant="h6">Error loading preview</Typography>
                        <Typography>{error}</Typography>
                    </Box>
                ) : isImage ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: '#000' }}>
                        <img
                            src={rawUrl}
                            alt={file.name}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                    </Box>
                ) : isVideo ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: '#000' }}>
                        <video controls style={{ maxWidth: '100%', maxHeight: '100%' }}>
                            <source src={rawUrl} />
                            Your browser does not support the video tag.
                        </video>
                    </Box>
                ) : isAudio ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: '#1e1e1e' }}>
                        <audio controls>
                            <source src={rawUrl} />
                            Your browser does not support the audio element.
                        </audio>
                    </Box>
                ) : (
                    <Editor
                        height="100%"
                        defaultLanguage={undefined} // Auto-detect
                        path={file.name} // Helps auto-detect language
                        value={content}
                        theme="vs-dark"
                        options={{
                            readOnly: true,
                            minimap: { enabled: true },
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};
