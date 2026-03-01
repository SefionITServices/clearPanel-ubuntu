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
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eaf6 50%, #c5cae9 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, borderRadius: 3, boxShadow: '0 8px 40px rgba(66,133,244,0.12)' }}>
        <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="ClearPanel"
              sx={{ width: 60, height: 40, objectFit: 'contain' }}
            />
          </Box>
          {title && (
            <Typography variant="h5" fontWeight={700} component="h1" textAlign="center">
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {description}
            </Typography>
          )}
          {children}
        </CardContent>
        {footer && <Box sx={{ px: 4, pb: 3 }}>{footer}</Box>}
      </Card>
      <Typography variant="caption" color="text.disabled" sx={{ mt: 2 }}>
        ClearPanel &copy; {new Date().getFullYear()}
      </Typography>
    </Box>
  );
}
