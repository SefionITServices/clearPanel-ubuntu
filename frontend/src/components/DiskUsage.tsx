import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';

interface DiskUsageProps {
    total: number;
    used: number;
}

export const DiskUsage: React.FC<DiskUsageProps> = ({ total, used }) => {
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const percentage = total > 0 ? (used / total) * 100 : 0;

    let color: 'primary' | 'warning' | 'error' = 'primary';
    if (percentage > 90) color = 'error';
    else if (percentage > 70) color = 'warning';

    return (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                    Storage
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {Math.round(percentage)}%
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={percentage}
                color={color}
                sx={{ height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
                {formatSize(used)} / {formatSize(total)}
            </Typography>
        </Box>
    );
};
