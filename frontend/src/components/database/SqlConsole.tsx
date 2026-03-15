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
  TextField,
  Alert,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  Code,
  Storage,
  Timer,
  FormatListBulleted,
} from '@mui/icons-material';

interface SqlConsoleProps {
  databases: string[];
  onRunQuery: (database: string, sql: string) => Promise<{
    columns: string[];
    rows: string[][];
    rowCount: number;
    duration: number;
  }>;
  engine: string;
}

export function SqlConsole({ databases, onRunQuery, engine }: SqlConsoleProps) {
  const [selectedDb, setSelectedDb] = useState('');
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    columns: string[];
    rows: string[][];
    rowCount: number;
    duration: number;
  } | null>(null);

  const handleRun = async () => {
    if (!selectedDb || !sql.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await onRunQuery(selectedDb, sql);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <Paper sx={{ p: 2, borderRadius: 2 }} variant="outlined">
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Database</InputLabel>
                <Select
                  value={selectedDb}
                  label="Database"
                  onChange={(e) => setSelectedDb(e.target.value)}
                >
                  <MenuItem value=""><em>Select Database</em></MenuItem>
                  {databases.map(db => (
                    <MenuItem key={db} value={db}>{db}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                Running on active {engine === 'postgresql' ? 'PostgreSQL' : 'MySQL/MariaDB'} engine.
              </Typography>
            </Stack>

            <TextField
              multiline
              rows={6}
              fullWidth
              variant="outlined"
              placeholder="SELECT * FROM users LIMIT 10;"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                }
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
                onClick={handleRun}
                disabled={loading || !selectedDb || !sql.trim()}
                sx={{ textTransform: 'none' }}
              >
                Execute Query
              </Button>
            </Box>
          </Stack>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        {result && (
          <Box>
            <Stack direction="row" spacing={3} sx={{ mb: 1, ml: 1 }}>
              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FormatListBulleted sx={{ fontSize: 14 }} />
                {result.rowCount} rows returned
              </Typography>
              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Timer sx={{ fontSize: 14 }} />
                Executed in {result.duration}ms
              </Typography>
            </Stack>
            
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {result.columns.map((col, idx) => (
                      <TableCell key={idx} sx={{ bgcolor: 'action.hover', fontWeight: 600 }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={result.columns.length} align="center" sx={{ py: 3 }}>
                        No data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    result.rows.map((row, rowIdx) => (
                      <TableRow key={rowIdx} hover>
                        {row.map((val, colIdx) => (
                          <TableCell key={colIdx} sx={{ fontSize: '0.85rem' }}>{val}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
