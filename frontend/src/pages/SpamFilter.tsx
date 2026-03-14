import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  CircularProgress,
  Button,
  Grid,
  Slider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { domainsApi } from '../api/domains';
import { spamFilterApi } from '../api/spam-filter';

export default function SpamFilter() {
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // form state
  const [addHeaderScore, setAddHeaderScore] = useState<number>(6);
  const [rejectScore, setRejectScore] = useState<number>(15);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [newWhite, setNewWhite] = useState('');
  const [newBlack, setNewBlack] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDomain) loadDomainSettings(selectedDomain);
  }, [selectedDomain]);

  const loadData = async () => {
    try {
      const dData = await domainsApi.list();
      const domainList = Array.isArray(dData) ? dData : [];
      setDomains(domainList);
      
      const st = await spamFilterApi.getStatus();
      setStatus(st);
      
      const hist = await spamFilterApi.getHistory(30);
      setHistory(Array.isArray(hist) ? hist : []);
      
      if (domainList.length > 0 && !selectedDomain) {
        setSelectedDomain(domainList[0].name);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadDomainSettings = async (domain: string) => {
    setLoadingConfig(true);
    try {
      const data = await spamFilterApi.getSettings(domain);
      setSettings(data);
      setAddHeaderScore(data.addHeaderScore);
      setRejectScore(data.rejectScore);
      setWhitelist(data.whitelist || []);
      setBlacklist(data.blacklist || []);
    } catch {
      setSettings(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      if (addHeaderScore >= rejectScore) {
        throw new Error('Reject score must be strictly greater than add-header score');
      }
      await spamFilterApi.saveSettings({
        domain: selectedDomain,
        addHeaderScore,
        rejectScore,
        whitelist,
        blacklist,
      });
      setToast('Spam filter configuration saved');
      loadDomainSettings(selectedDomain);
    } catch (e: any) {
      setToast(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addToList = (type: 'white' | 'black') => {
    if (type === 'white' && newWhite.trim()) {
      setWhitelist([...new Set([...whitelist, newWhite.trim().toLowerCase()])]);
      setNewWhite('');
    } else if (type === 'black' && newBlack.trim()) {
      setBlacklist([...new Set([...blacklist, newBlack.trim().toLowerCase()])]);
      setNewBlack('');
    }
  };

  const removeFromList = (type: 'white' | 'black', item: string) => {
    if (type === 'white') setWhitelist(whitelist.filter(x => x !== item));
    else setBlacklist(blacklist.filter(x => x !== item));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Spam Filtering (Rspamd)
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Manage global anti-spam engine statistics and per-domain filtering policies.
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} mb={4}>
          <Box sx={{ flex: 1 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Scan Engine Status</Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: status?.running ? 'success.main' : 'error.main' }} />
                  <Typography variant="h6">{status?.running ? 'Active (Rspamd)' : 'Offline'}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Total Scanned</Typography>
                <Typography variant="h6">{status?.scanned?.toLocaleString() || 0} messages</Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Spam Caught</Typography>
                <Typography variant="h6">{(status?.spamCount + status?.rejectCount)?.toLocaleString() || 0}</Typography>
              </CardContent>
            </Card>
          </Box>
        </Stack>

        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Domain for Policy Setup</InputLabel>
              <Select
                value={selectedDomain}
                label="Select Domain for Policy Setup"
                onChange={(e) => setSelectedDomain(e.target.value)}
              >
                {domains.length === 0 ? (
                  <MenuItem disabled value="">No domains found</MenuItem>
                ) : (
                  domains.map((d) => (
                    <MenuItem key={d.name} value={d.name}>
                      {d.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {selectedDomain && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} mb={4}>
            <Box sx={{ flex: 1 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Spam Score Thresholds
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Adjust the sensitivity of the spam filter for {selectedDomain}.
                  </Typography>

                  <Box mb={4} px={1}>
                    <Typography gutterBottom>Add Spam Header Score (Current: {addHeaderScore})</Typography>
                    <Slider
                      value={addHeaderScore}
                      min={0}
                      max={20}
                      step={0.5}
                      marks
                      onChange={(_, v) => setAddHeaderScore(v as number)}
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Emails scoring above this will be delivered to the Junk folder.
                    </Typography>
                  </Box>

                  <Box mb={4} px={1}>
                    <Typography gutterBottom>Reject Score (Current: {rejectScore})</Typography>
                    <Slider
                      value={rejectScore}
                      min={0}
                      max={30}
                      step={1}
                      marks
                      color="error"
                      onChange={(_, v) => setRejectScore(v as number)}
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Emails scoring above this will be rejected at the SMTP level (bounced).
                    </Typography>
                  </Box>

                  <Button variant="contained" onClick={handleSaveSettings} disabled={saving}>
                    {saving ? 'Saving...' : 'Apply Thresholds & Lists'}
                  </Button>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Whitelist & Blacklist
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Enter full email addresses (user@domain) or whole domains (@domain).
                  </Typography>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Whitelist (Always Accept)</Typography>
                      <Box display="flex" gap={1} mb={2}>
                        <TextField size="small" value={newWhite} onChange={(e) => setNewWhite(e.target.value)} placeholder="*@trusted.com" fullWidth />
                        <Button variant="outlined" onClick={() => addToList('white')}>Add</Button>
                      </Box>
                      <Paper variant="outlined" sx={{ height: 180, overflowY: 'auto' }}>
                        <List dense disablePadding>
                          {whitelist.map(w => (
                            <ListItem key={w} secondaryAction={
                              <IconButton edge="end" size="small" onClick={() => removeFromList('white', w)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            }>
                              <ListItemText primary={w} />
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    </Box>
                    
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Blacklist (Always Reject)</Typography>
                      <Box display="flex" gap={1} mb={2}>
                        <TextField size="small" value={newBlack} onChange={(e) => setNewBlack(e.target.value)} placeholder="*@spammer.net" fullWidth />
                        <Button variant="outlined" color="error" onClick={() => addToList('black')}>Add</Button>
                      </Box>
                      <Paper variant="outlined" sx={{ height: 180, overflowY: 'auto' }}>
                        <List dense disablePadding>
                          {blacklist.map(b => (
                            <ListItem key={b} secondaryAction={
                              <IconButton edge="end" size="small" onClick={() => removeFromList('black', b)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            }>
                              <ListItemText primary={b} />
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    </Box>
                  </Stack>

                </CardContent>
              </Card>
            </Box>
          </Stack>
        )}

        <Typography variant="h6" fontWeight={600} gutterBottom mt={5}>
          Recent Scan History
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Sender</TableCell>
                <TableCell>Recipient</TableCell>
                <TableCell>Action</TableCell>
                <TableCell align="right">Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No recent history available</TableCell>
                </TableRow>
              ) : (
                history.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>{new Date(h.time_real * 1000).toLocaleString()}</TableCell>
                    <TableCell>{h.sender || 'Unknown'}</TableCell>
                    <TableCell>{h.rcpt || 'Unknown'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={h.action}
                        color={
                          h.action === 'no action' ? 'success' :
                          h.action === 'reject' ? 'error' :
                          h.action === 'add header' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500, color: h.score > 10 ? 'error.main' : h.score > 5 ? 'warning.main' : 'success.main' }}>
                      {h.score?.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
      />
    </DashboardLayout>
  );
}
