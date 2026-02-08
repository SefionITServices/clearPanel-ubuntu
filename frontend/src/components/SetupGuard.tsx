import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

/**
 * Route guard that redirects to setup wizard if setup is not completed
 */
export function SetupGuard() {
    const [loading, setLoading] = useState(true);
    const [setupCompleted, setSetupCompleted] = useState(false);

    useEffect(() => {
        checkSetupStatus();
    }, []);

    const checkSetupStatus = async () => {
        try {
            const response = await fetch('/api/setup/status');
            const data = await response.json();
            setSetupCompleted(data.completed);
        } catch (error) {
            console.error('Failed to check setup status:', error);
            // Assume setup is not completed on error
            setSetupCompleted(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (!setupCompleted) {
        return <Navigate to="/setup" replace />;
    }

    return <Outlet />;
}
