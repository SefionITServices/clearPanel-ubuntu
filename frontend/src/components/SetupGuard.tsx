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
        // Cache setup status in sessionStorage so it's only fetched once per browser session
        const cached = sessionStorage.getItem('setupCompleted');
        if (cached === 'true') {
            setSetupCompleted(true);
            setLoading(false);
            return;
        }
        try {
            const response = await fetch('/api/setup/status');
            const data = await response.json();
            setSetupCompleted(data.completed);
            if (data.completed) {
                sessionStorage.setItem('setupCompleted', 'true');
            }
        } catch {
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
