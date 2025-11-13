import React from 'react';
import { Box, Typography, Paper, Card, CardContent, Stack } from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Dashboard
        </Typography>
        
        <Stack direction="row" spacing={3} sx={{ mb: 3, flexWrap: 'wrap', gap: 3 }}>
          <Card sx={{ flex: '1 1 300px', minWidth: 250 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Files
              </Typography>
              <Typography variant="h5">0</Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: '1 1 300px', minWidth: 250 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Storage Used
              </Typography>
              <Typography variant="h5">0 MB</Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: '1 1 300px', minWidth: 250 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="h5">No activity</Typography>
            </CardContent>
          </Card>
        </Stack>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            File manager and other modules will be added here.
          </Typography>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
