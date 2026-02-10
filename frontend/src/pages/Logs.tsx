import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  VerticalAlignBottom as ScrollBottomIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { logsApi, LogSource, LogResult } from '../api/logs';

const LINE_COUNTS = [50, 100, 200, 500];

/** Colour-code a log line based on keywords */
function lineColor(line: string): string | undefined {
  const l = line.toLowerCase();
  if (/\berror\b|\bfatal\b|\bpanic\b|\bcrit(ical)?\b/.test(l)) return '#d32f2f';
  if (/\bwarn(ing)?\b/.test(l)) return '#ed6c02';
  if (/\bfail(ed|ure)?\b|\breject(ed)?\b|\bdenied\b/.test(l)) return '#c62828';
  return undefined;
}

export default function LogsPage() {
  // ── State ──
  const [sources, setSources] = useState<LogSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('clearpanel');
  const [lines, setLines] = useState(100);
  const [logResult, setLogResult] = useState<LogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const logBoxRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load sources on mount ──
  useEffect(() => {
    logsApi.getSources().then(setSources).catch(() => {});
  }, []);

  // ── Fetch log ──
  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await logsApi.getLog(selectedSource, lines);
      setLogResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [selectedSource, lines]);

  // Fetch on source/lines change
  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logResult, autoScroll]);

  // Auto-refresh timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLog, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchLog]);

  // ── Filtered lines ──
  const displayLines = React.useMemo(() => {
    if (!logResult) return [];
    if (!filter.trim()) return logResult.lines;
    const lf = filter.toLowerCase();
    return logResult.lines.filter((l) => l.toLowerCase().includes(lf));
  }, [logResult, filter]);

  // ── Handlers ──
  const handleCopy = () => {
    navigator.clipboard.writeText(displayLines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([displayLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSource}-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group sources by category for the dropdown
  const grouped = React.useMemo(() => {
    const map: Record<string, LogSource[]> = {};
    sources.forEach((s) => {
      (map[s.category] ??= []).push(s);
    });
    return map;
  }, [sources]);

  return (
    <DashboardLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
        {/* Header */}
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Log Viewer
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          View real-time logs from all ClearPanel services. Select a source, filter, and copy.
        </Typography>

        {/* Controls */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
            flexWrap="wrap"
          >
            {/* Source picker */}
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Log Source</InputLabel>
              <Select
                value={selectedSource}
                label="Log Source"
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                {Object.entries(grouped).map(([cat, items]) => [
                  <MenuItem key={`cat-${cat}`} disabled sx={{ fontWeight: 700, opacity: '1 !important', fontSize: 12, textTransform: 'uppercase', color: 'text.secondary', mt: 0.5 }}>
                    {cat}
                  </MenuItem>,
                  ...items.map((s) => (
                    <MenuItem key={s.id} value={s.id} sx={{ pl: 3 }}>
                      {s.label}
                    </MenuItem>
                  )),
                ])}
              </Select>
            </FormControl>

            {/* Lines count */}
            <ToggleButtonGroup
              value={lines}
              exclusive
              onChange={(_, val) => val && setLines(val)}
              size="small"
            >
              {LINE_COUNTS.map((n) => (
                <ToggleButton key={n} value={n}>
                  {n}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {/* Filter */}
            <TextField
              size="small"
              placeholder="Filter lines..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: filter ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setFilter('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

            {/* Auto-refresh */}
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Auto (5s)</Typography>}
            />

            {/* Auto-scroll */}
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Auto-scroll</Typography>}
            />

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
              <Tooltip title="Refresh">
                <IconButton onClick={fetchLog} disabled={loading} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={copied ? 'Copied!' : 'Copy all'}>
                <IconButton onClick={handleCopy} size="small" color={copied ? 'success' : 'default'}>
                  <CopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download .log">
                <IconButton onClick={handleDownload} size="small">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Scroll to bottom">
                <IconButton
                  onClick={() => {
                    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
                  }}
                  size="small"
                >
                  <ScrollBottomIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        </Paper>

        {/* Status bar */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {logResult && (
            <>
              <Chip
                label={logResult.label}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                {displayLines.length} line{displayLines.length !== 1 ? 's' : ''}
                {filter && ` (filtered from ${logResult.lines.length})`}
              </Typography>
              {logResult.truncated && (
                <Chip label="truncated" size="small" color="warning" variant="outlined" />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
                {new Date(logResult.timestamp).toLocaleTimeString()}
              </Typography>
            </>
          )}
          {loading && <CircularProgress size={16} />}
          {autoRefresh && (
            <Chip label="LIVE" size="small" color="success" sx={{ animation: 'pulse 2s infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }} />
          )}
        </Stack>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Log output */}
        <Paper
          ref={logBoxRef}
          sx={{
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            fontSize: 12.5,
            lineHeight: 1.65,
            p: 2,
            borderRadius: 1.5,
            overflow: 'auto',
            height: { xs: 'calc(100vh - 420px)', md: 'calc(100vh - 360px)' },
            minHeight: 300,
            whiteSpace: 'pre',
            '& .log-line': {
              display: 'block',
              px: 1,
              borderRadius: 0.5,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.06)',
              },
            },
            // Scrollbar
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-track': { bgcolor: '#1e1e1e' },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#555', borderRadius: 4 },
          }}
        >
          {displayLines.length === 0 && !loading && (
            <Typography variant="body2" sx={{ color: '#888', fontStyle: 'italic' }}>
              {filter ? 'No lines match the filter.' : 'No log output.'}
            </Typography>
          )}
          {displayLines.map((line, i) => {
            const color = lineColor(line);
            // Highlight search filter matches
            if (filter && line.toLowerCase().includes(filter.toLowerCase())) {
              const idx = line.toLowerCase().indexOf(filter.toLowerCase());
              const before = line.slice(0, idx);
              const match = line.slice(idx, idx + filter.length);
              const after = line.slice(idx + filter.length);
              return (
                <span key={i} className="log-line" style={{ color: color || '#d4d4d4' }}>
                  <span style={{ color: '#666', userSelect: 'none', marginRight: 8, fontSize: 11 }}>
                    {String(i + 1).padStart(4)}
                  </span>
                  {before}
                  <span style={{ backgroundColor: '#b5890066', color: '#fff', borderRadius: 2, padding: '0 2px' }}>
                    {match}
                  </span>
                  {after}
                  {'\n'}
                </span>
              );
            }
            return (
              <span key={i} className="log-line" style={{ color: color || '#d4d4d4' }}>
                <span style={{ color: '#666', userSelect: 'none', marginRight: 8, fontSize: 11 }}>
                  {String(i + 1).padStart(4)}
                </span>
                {line}
                {'\n'}
              </span>
            );
          })}
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
