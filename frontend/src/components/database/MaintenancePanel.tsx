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
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
} from '@mui/material';
import {
  Build as BuildIcon,
  HealthAndSafety,
  Speed,
  CheckCircle,
} from '@mui/icons-material';

interface MaintenancePanelProps {
  databases: string[];
  activeEngine: string;
  onRepair: (database: string, table: string) => Promise<void>;
  onOptimize: (database: string, table: string) => Promise<void>;
  onCheck: (database: string, table: string) => Promise<void>;
  onListTables: (database: string) => Promise<string[]>;
}

export function MaintenancePanel({
  databases,
  activeEngine,
  onRepair,
  onOptimize,
  onCheck,
  onListTables,
}: MaintenancePanelProps) {
  const [selectedDb, setSelectedDb] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isMysql = activeEngine === 'mysql' || activeEngine === 'mariadb';

  const handleDbChange = async (dbName: string) => {
    setSelectedDb(dbName);
    setSelectedTable('');
    if (!dbName) {
      setTables([]);
      return;
    }
    setTablesLoading(true);
    try {
      const list = await onListTables(dbName);
      setTables(list);
    } catch (e) {
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  };

  const handleAction = async (action: 'repair' | 'optimize' | 'check') => {
    if (!selectedDb || !selectedTable) return;
    setBusy(action);
    setResult(null);
    try {
      if (action === 'repair') await onRepair(selectedDb, selectedTable);
      else if (action === 'optimize') await onOptimize(selectedDb, selectedTable);
      else if (action === 'check') await onCheck(selectedDb, selectedTable);
      setResult({ type: 'success', message: `${action.charAt(0).toUpperCase() + action.slice(1)} completed for ${selectedTable}` });
    } catch (e: any) {
      setResult({ type: 'error', message: e.message || `Failed to ${action} table` });
    } finally {
      setBusy(null);
    }
  };

  if (!isMysql) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }} variant="outlined">
        <Typography color="text.secondary">
          Maintenance operations (Repair/Optimize/Check) are currently only available for MySQL and MariaDB engines.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, borderRadius: 2 }} variant="outlined">
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon color="primary" />
          Table Maintenance
        </Typography>
        
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Database</InputLabel>
              <Select
                value={selectedDb}
                label="Database"
                onChange={(e) => handleDbChange(e.target.value)}
              >
                <MenuItem value=""><em>Select Database</em></MenuItem>
                {databases.map(db => (
                  <MenuItem key={db} value={db}>{db}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }} disabled={!selectedDb || tablesLoading}>
              <InputLabel>Table</InputLabel>
              <Select
                value={selectedTable}
                label="Table"
                onChange={(e) => setSelectedTable(e.target.value)}
              >
                <MenuItem value=""><em>Select Table</em></MenuItem>
                {tables.map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={busy === 'check' ? <CircularProgress size={16} /> : <HealthAndSafety />}
              onClick={() => handleAction('check')}
              disabled={!!busy || !selectedTable}
              sx={{ textTransform: 'none' }}
            >
              Check Table
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={busy === 'repair' ? <CircularProgress size={16} /> : <BuildIcon fontSize="small" />}
              onClick={() => handleAction('repair')}
              disabled={!!busy || !selectedTable}
              sx={{ textTransform: 'none' }}
            >
              Repair Table
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={busy === 'optimize' ? <CircularProgress size={16} /> : <Speed />}
              onClick={() => handleAction('optimize')}
              disabled={!!busy || !selectedTable}
              sx={{ textTransform: 'none' }}
            >
              Optimize Table
            </Button>
          </Box>

          {result && (
            <Alert severity={result.type} onClose={() => setResult(null)}>
              {result.message}
            </Alert>
          )}

          <Divider />
          
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              <strong>Check:</strong> Verifies the integrity of table data and indexes.<br />
              <strong>Repair:</strong> Attempts to fix corrupted tables (MyISAM only).<br />
              <strong>Optimize:</strong> Reorganizes table storage and indexes to reclaim unused space and improve performance.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
