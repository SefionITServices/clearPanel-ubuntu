import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';

export type AuthCenteredLayoutProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthCenteredLayout({ title, description, children, footer }: AuthCenteredLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, borderRadius: 3, boxShadow: 6 }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {title && (
            <Typography variant="h5" fontWeight={600} component="h1">
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
          {children}
        </CardContent>
        {footer && <Box sx={{ px: 3, pb: 3 }}>{footer}</Box>}
      </Card>
    </Box>
  );
}
