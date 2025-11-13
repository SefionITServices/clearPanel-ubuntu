import { Theme } from '@mui/material/styles';

export function dashboardLayoutVars() {
  return {
    '--layout-dashboard-content-pt': '24px',
    '--layout-dashboard-content-pb': '40px',
    '--layout-dashboard-content-px': '32px',
  } as React.CSSProperties;
}

export function dashboardNavColorVars(theme: Theme) {
  return {
    section: {
      bgcolor: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
  };
}
