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
  IconButton,
  Tooltip,
  Button,
  Stack,
  Alert,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PublicIcon from '@mui/icons-material/Public';

import { mailAPI } from '../../api/mail';

interface Props {
  domainId: string;
}

export function MailDnsPanel({ domainId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [publishResult, setPublishResult] = useState<any | null>(null);
  const [propagationResult, setPropagationResult] = useState<any | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    setPublishResult(null);
    setPropagationResult(null);
    try {
      const resp = await mailAPI.getDnsSuggestions(domainId);
      setServerIp((resp as any).serverIp ?? null);
      setRecords((resp as any).records ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load DNS suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetch();
  }, [domainId]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const handlePublish = async () => {
    setPublishResult(null);
    try {
      const res = await mailAPI.publishDns(domainId);
      setPublishResult(res);
    } catch (e) {
      setPublishResult({ error: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleCheck = async () => {
    setPropagationResult(null);
    try {
      const res = await mailAPI.checkDnsPropagation(domainId);
      setPropagationResult(res);
    } catch (e) {
      setPropagationResult({ error: e instanceof Error ? e.message : String(e) });
    }
  };

  if (loading && records.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && records.length === 0) {
    return <Typography color="error" sx={{ p: 2 }}>{error}</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
        <Typography variant="subtitle2">DNS Suggestions</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Refresh suggestions">
            <IconButton size="small" onClick={fetch}><RefreshIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={handlePublish}>Publish to clearPanel DNS</Button>
          <Button variant="outlined" startIcon={<PublicIcon />} onClick={handleCheck}>Check propagation</Button>
        </Stack>
      </Box>

      {serverIp && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2">Server IP: <strong>{serverIp}</strong></Typography>
          <Tooltip title="Copy server IP">
            <IconButton size="small" onClick={() => copyText(serverIp)}><ContentCopyIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5' }}>
              <TableCell>Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>TTL</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((r, idx) => (
              <TableRow key={idx} hover>
                <TableCell>{r.type}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{r.value}</TableCell>
                <TableCell>{r.ttl ?? '3600'}</TableCell>
                <TableCell>
                  <Tooltip title="Copy value">
                    <IconButton size="small" onClick={() => copyText(String(r.value))}><ContentCopyIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Copy BIND record">
                    <IconButton size="small" onClick={() => copyText(`${r.name === '@' ? '' : r.name} ${r.ttl ?? 3600} IN ${r.type} ${r.value}`)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {publishResult && (
        <Box sx={{ mt: 2 }}>
          {publishResult.error ? (
            <Alert severity="error">{publishResult.error}</Alert>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Publish results:</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {publishResult.published?.map((p: any, i: number) => (
                      <TableRow key={i} hover>
                        <TableCell>{p.type}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{p.value}</TableCell>
                        <TableCell>{p.status}{p.error ? `: ${p.error}` : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {publishResult.zoneReload && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>{publishResult.zoneReload.success ? 'Zone reload succeeded' : `Zone reload: ${publishResult.zoneReload.message}`}</Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {propagationResult && (
        <Box sx={{ mt: 2 }}>
          {propagationResult.error ? (
            <Alert severity="error">{propagationResult.error}</Alert>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Propagation check:</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Record</TableCell>
                      <TableCell>Actual</TableCell>
                      <TableCell>Match</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {propagationResult.results?.map((r: any, i: number) => (
                      <TableRow key={i} hover>
                        <TableCell>{r.record.type} {r.record.name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{(r.actual || []).join(', ')}</TableCell>
                        <TableCell>{r.match ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default MailDnsPanel;
