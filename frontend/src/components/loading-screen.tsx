import React from 'react';
import { Box, CircularProgress } from '@mui/material';

export function LoadingScreen() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <CircularProgress />
    </Box>
  );
}
