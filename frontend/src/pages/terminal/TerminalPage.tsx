import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, Typography, CircularProgress, IconButton } from '@mui/material';
import { DashboardLayout } from '../../layouts/dashboard/layout';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export default function TerminalPage() {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ line: string; isError?: boolean }[]>([]);
  const [cwd, setCwd] = useState<string>('');
  const [userHost, setUserHost] = useState<string>('');
  const [cursor, setCursor] = useState<number>(-1); // for navigating history
  const inputRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commandsHistory = useRef<string[]>([]);

  const loadInfo = async () => {
    try {
      const res = await fetch('/api/terminal/info', { credentials: 'include' });
      const data = await res.json();
      setCwd(data?.cwd || '~');
      setUserHost(`${data?.user || 'server'}@${data?.host || 'localhost'}`);
    } catch {}
  };

  useEffect(() => { loadInfo(); }, []);

  const pushHistory = (line: string, isError = false) => {
    setHistory((h) => [...h, { line, isError }]);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, loading]);

  const handleExec = async (raw?: string) => {
    const c = (raw ?? command).trim();
    if (!c) return;
    setLoading(true);
    const prompt = `${userHost || 'server@localhost'}:${cwd || '~'}$`;
    pushHistory(`${prompt} ${c}`);
    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: c.toLowerCase() === 'dir' ? 'ls -la' : c }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.stdout) data.stdout.split(/\n/).forEach((l: string) => l && pushHistory(l));
      if (data.stderr) data.stderr.split(/\n/).forEach((l: string) => l && pushHistory(l, true));
      if (data.cwd) setCwd(data.cwd);
    } catch (e) {
      pushHistory('Network error', true);
    }
    setLoading(false);
    setCursor(-1);
    setCommand('');
    inputRef.current?.focus();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Clear screen with Ctrl+L similar to bash
    if (e.key.toLowerCase() === 'l' && e.ctrlKey) {
      e.preventDefault();
      handleClear();
      return;
    }
    // Ignore formatting shortcuts
    if (e.key === 'Tab') {
      e.preventDefault();
      // Future: autocomplete stub
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = (inputRef.current?.innerText || '').replace(/\n/g, ' ').trim();
      if (text) {
        commandsHistory.current.push(text);
        handleExec(text);
      }
      if (inputRef.current) inputRef.current.innerText = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((cur) => {
        const cmds = commandsHistory.current;
        const next = cur < cmds.length - 1 ? cur + 1 : cmds.length - 1;
        const val = cmds[cmds.length - 1 - next] || '';
        if (inputRef.current) inputRef.current.innerText = val;
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((cur) => {
        const cmds = commandsHistory.current;
        if (cur <= 0) { if (inputRef.current) inputRef.current.innerText = ''; return -1; }
        const next = cur - 1;
        const val = cmds[cmds.length - 1 - next] || '';
        if (inputRef.current) inputRef.current.innerText = val;
        return next;
      });
    }
  };

  const handleClear = () => {
    setHistory([]);
    setCommand('');
    setCursor(-1);
    inputRef.current?.focus();
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 4 }}>
        <Paper elevation={4} sx={{ p: 2, bgcolor: '#0d1117', color: '#e6edf3', minHeight: 500, display: 'flex', flexDirection: 'column', border: '1px solid #1f2630' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1, color: '#58a6ff' }}>{userHost}:{cwd}</Typography>
            <IconButton size="small" onClick={handleClear} sx={{ color: '#e6edf3' }} title="Clear">
              <ClearIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })} sx={{ color: '#e6edf3' }} title="Scroll bottom">
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box ref={scrollRef} sx={{ fontFamily: 'monospace', flexGrow: 1, fontSize: 14, overflowY: 'auto', mb: 2, p: 1, bgcolor: '#010409', border: '1px solid #1f2630', borderRadius: 1 }}>
            {history.length === 0 && <Typography variant="caption" sx={{ color: '#7d8590' }}>Type a command (e.g. ls, pwd, cd /tmp) and press Enter</Typography>}
            {history.map((h, i) => (
              <div key={i} style={{ whiteSpace: 'pre-wrap', color: h.isError ? '#ff7b72' : undefined }}>{h.line}</div>
            ))}
            {loading && <div style={{ color: '#7d8590' }}>Running...</div>}
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ color: '#58a6ff' }}>{`${userHost || 'server@localhost'}:${cwd || '~'}$`}&nbsp;</span>
              <div
                ref={inputRef}
                contentEditable
                spellCheck={false}
                onKeyDown={handleKeyDown}
                style={{ outline: 'none', whiteSpace: 'pre-wrap', flexGrow: 1, minHeight: 18 }}
                aria-label="terminal-input"
              />
            </div>
          </Box>
          {/* Inline prompt input replaces old input controls */}
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
