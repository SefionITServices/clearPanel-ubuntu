import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Button,
  Tooltip,
  Switch,
  Box,
  Typography,
  Link,
  Stack,
  Paper,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BuildIcon from '@mui/icons-material/Build';
import EmailIcon from '@mui/icons-material/Email';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteIcon from '@mui/icons-material/Delete';

export interface DomainRow {
  id: string;
  name: string;
  folderPath: string;
  createdAt: string;
  isMain?: boolean;
  redirectsTo?: string;
  forceHttps?: boolean;
}

interface Props {
  rows: DomainRow[];
  selected: string[];
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onManage: (row: DomainRow) => void;
  onCreateEmail: (row: DomainRow) => void;
  onToggleHttps: (row: DomainRow, value: boolean) => void;
  onDelete: (row: DomainRow) => void;
}

export function DomainsTable({
  rows,
  selected,
  onSelect,
  onSelectAll,
  onManage,
  onCreateEmail,
  onToggleHttps,
  onDelete,
}: Props) {
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const someSelected = selected.length > 0 && selected.length < rows.length;

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={e => onSelectAll(e.target.checked)}
              />
            </TableCell>
            <TableCell>Domain</TableCell>
            <TableCell>Document Root</TableCell>
            <TableCell>Redirects To</TableCell>
            <TableCell>Force HTTPS Redirect</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id} hover selected={selected.includes(row.id)}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selected.includes(row.id)}
                  onChange={e => onSelect(row.id, e.target.checked)}
                />
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Link href={`http://${row.name}`} target="_blank" underline="hover" sx={{ fontWeight: 600 }}>
                    {row.name}
                  </Link>
                  <OpenInNewIcon fontSize="small" color="action" />
                  {row.isMain && (
                    <Box component="span" sx={{ ml: 1, bgcolor: 'primary.main', color: 'white', px: 1, borderRadius: 1, fontSize: 12, fontWeight: 500 }}>
                      Main Domain
                    </Box>
                  )}
                </Stack>
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <HomeIcon fontSize="small" color="action" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.folderPath}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {row.redirectsTo || 'Not Redirected'}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Switch
                    checked={!!row.forceHttps}
                    onChange={e => onToggleHttps(row, e.target.checked)}
                    size="small"
                  />
                  <Typography variant="caption" color={row.forceHttps ? 'primary' : 'text.secondary'}>
                    {row.forceHttps ? 'on' : 'off'}
                  </Typography>
                  <Tooltip title="Force HTTPS Redirect">
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </Tooltip>
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" size="small" startIcon={<BuildIcon />} onClick={() => onManage(row)}>
                    Manage
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<EmailIcon />} onClick={() => onCreateEmail(row)}>
                    Create Email
                  </Button>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => onDelete(row)}
                    title="Delete Domain"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
