import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Collapse,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Add,
  Delete,
  ExpandMore,
  ExpandLess,
  Download,
  Upload,
  TableChart,
  Search as SearchIcon,
} from '@mui/icons-material';
import { DbInfo, TableInfo, formatSize } from './utils';

interface DatabaseListProps {
  databases: DbInfo[];
  engine: string;
  onRefresh: () => void;
  onCreateOpen: () => void;
  onDelete: (name: string) => void;
  onExport: (name: string) => void;
  onImportOpen: (dbName: string) => void;
  onExpandTables: (dbName: string) => Promise<TableInfo[]>;
  loading?: boolean;
}

export function DatabaseList({
  databases,
  engine,
  onRefresh,
  onCreateOpen,
  onDelete,
  onExport,
  onImportOpen,
  onExpandTables,
  loading,
}: DatabaseListProps) {
  const [search, setSearch] = useState('');
  const [expandedDb, setExpandedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  const filtered = databases.filter((db) => db.name.toLowerCase().includes(search.toLowerCase()));

  const handleToggleExpand = async (dbName: string) => {
    if (expandedDb === dbName) {
      setExpandedDb(null);
      return;
    }
    setExpandedDb(dbName);
    setTablesLoading(true);
    try {
      const data = await onExpandTables(dbName);
      setTables(data);
    } catch (error) {
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" justifyContent="space-between">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Databases</Typography>
        <Stack direction="row" spacing={1}>
           <TextField
            size="small"
            placeholder="Search databases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 250 }}
          />
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onCreateOpen}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Create Database
          </Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }}>
              <TableCell sx={{ width: 40 }} />
              <TableCell>Database Name</TableCell>
              <TableCell>Tables</TableCell>
              <TableCell>Size</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  {search ? 'No results found' : 'No databases found'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((db) => (
                <React.Fragment key={db.name}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleToggleExpand(db.name)}>
                        {expandedDb === db.name ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{db.name}</TableCell>
                    <TableCell>{db.tables}</TableCell>
                    <TableCell>{formatSize(db.size)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Export SQL">
                          <IconButton size="small" color="primary" onClick={() => onExport(db.name)}>
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Import SQL">
                          <IconButton size="small" color="primary" onClick={() => onImportOpen(db.name)}>
                            <Upload fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Database">
                          <IconButton size="small" color="error" onClick={() => onDelete(db.name)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 0, px: 0 }}>
                      <Collapse in={expandedDb === db.name} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TableChart fontSize="small" />
                            Tables in {db.name}
                          </Typography>
                          {tablesLoading ? (
                            <CircularProgress size={20} sx={{ m: 2 }} />
                          ) : tables.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', ml: 1 }}>Empty database</Typography>
                          ) : (
                            <Table size="small" sx={{ ml: 1 }}>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Table Name</TableCell>
                                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Rows</TableCell>
                                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Size</TableCell>
                                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Engine</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {tables.map((table) => (
                                  <TableRow key={table.name}>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{table.name}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{table.rows}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{formatSize(table.size)}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>
                                      <Chip label={table.engine} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
