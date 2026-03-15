import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';

import { mailAPI, MailAutomationHistoryRecord } from '../../api/mail';

interface DomainLogsProps {
  domainId: string;
}

export function DomainLogs({ domainId }: DomainLogsProps) {
  const [logs, setLogs] = useState<MailAutomationHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await mailAPI.getDomainLogs(domainId, 20); // fetch last 20
      setLogs(records);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, [domainId]);

  if (loading && logs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && logs.length === 0) {
     return (
        <Typography color="error" sx={{ p: 2 }}>{error}</Typography>
     );
  }

  if (logs.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>No automation logs found for this domain.</Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
         <Typography variant="subtitle2">Recent Automation Tasks</Typography>
         <Tooltip title="Refresh Logs">
           <IconButton size="small" onClick={fetchLogs} disabled={loading}>
             <RefreshIcon fontSize="small" />
           </IconButton>
         </Tooltip>
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5' }}>
              <TableCell>Timestamp</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Task</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.executedAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={log.scope} variant="outlined" />
                </TableCell>
                <TableCell>{log.task}</TableCell>
                <TableCell>
                  {log.success ? (
                    <CheckCircleIcon color="success" fontSize="small" />
                  ) : (
                    <CancelIcon color="error" fontSize="small" />
                  )}
                </TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>
                  {log.message}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
