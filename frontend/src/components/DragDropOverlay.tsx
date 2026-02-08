import React from 'react';
import { Box, Typography } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

interface DragDropOverlayProps {
    open: boolean;
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ open }) => {
    if (!open) return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none', // Allow drops to pass through to the window listener
            }}
        >
            <Box
                sx={{
                    border: '3px dashed #fff',
                    borderRadius: 4,
                    p: 5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                }}
            >
                <CloudUpload sx={{ fontSize: 80, mb: 2 }} />
                <Typography variant="h4" component="div">
                    Drop files to upload
                </Typography>
            </Box>
        </Box>
    );
};
