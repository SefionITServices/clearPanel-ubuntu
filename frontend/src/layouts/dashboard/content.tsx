import React from 'react';
import Container from '@mui/material/Container';

export type DashboardContentProps = {
  children: React.ReactNode;
};

export function DashboardContent({ children }: DashboardContentProps) {
  return (
    <Container maxWidth="xl" sx={{ pt: 3, pb: 6 }}>
      {children}
    </Container>
  );
}
