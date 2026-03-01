import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { DashboardLayout } from '../../layouts/dashboard/layout';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

/**
 * Full PTY-backed terminal using xterm.js + Socket.IO.
 *
 * Flow:  Browser (xterm.js) ↔ Socket.IO /terminal namespace ↔ node-pty (bash)
 *
 * The server session cookie is forwarded automatically (withCredentials).
 * The backend TerminalGateway verifies the session before spawning a PTY.
 */
export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef      = useRef<Terminal | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);
  const socketRef    = useRef<Socket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // ── Create xterm.js terminal ──────────────────────────────────────────
    const term = new Terminal({
      fontFamily:   '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize:     14,
      lineHeight:   1.2,
      cursorBlink:  true,
      cursorStyle:  'block',
      scrollback:   5000,
      allowProposedApi: true,
      theme: {
        background:           '#0d1117',
        foreground:           '#e6edf3',
        cursor:               '#58a6ff',
        cursorAccent:         '#0d1117',
        selectionBackground:  '#264f78',
        // Normal colours (matches GitHub Dark colour scheme)
        black:   '#0d1117',  brightBlack:   '#8b949e',
        red:     '#ff7b72',  brightRed:     '#ffa198',
        green:   '#3fb950',  brightGreen:   '#56d364',
        yellow:  '#d29922',  brightYellow:  '#e3b341',
        blue:    '#58a6ff',  brightBlue:    '#79c0ff',
        magenta: '#bc8cff',  brightMagenta: '#d2a8ff',
        cyan:    '#39d353',  brightCyan:    '#56d364',
        white:   '#b1bac4',  brightWhite:   '#f0f6fc',
      },
    });

    const fitAddon      = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current  = fitAddon;

    // ── Connect Socket.IO to the /terminal namespace ──────────────────────
    const socket: Socket = io('/terminal', {
      path:            '/socket.io',
      withCredentials: true,                    // forward session cookie
      transports:      ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Sync terminal dimensions immediately after connecting
      socket.emit('terminal:resize', { cols: term.cols, rows: term.rows });
    });

    socket.on('connect_error', (err) => {
      term.writeln(`\r\n\x1b[31mConnection error: ${err.message}\x1b[0m`);
    });

    // Raw PTY output → write directly to xterm (ANSI sequences handled natively)
    socket.on('terminal:output', (data: string) => {
      term.write(data);
    });

    socket.on('terminal:exit', ({ exitCode }: { exitCode: number }) => {
      term.writeln(`\r\n\x1b[33mSession ended (exit code ${exitCode}).\x1b[0m`);
    });

    socket.on('terminal:error', (msg: string) => {
      term.writeln(`\r\n\x1b[31mError: ${msg}\x1b[0m`);
    });

    socket.on('disconnect', (reason) => {
      term.writeln(`\r\n\x1b[33mDisconnected: ${reason}\x1b[0m`);
    });

    // ── Input / resize forwarding ─────────────────────────────────────────
    // Forward every keystroke / paste to the PTY
    term.onData((data) => {
      socket.emit('terminal:input', data);
    });

    // When xterm re-measures and reports new cols/rows, tell the PTY
    term.onResize(({ cols, rows }) => {
      socket.emit('terminal:resize', { cols, rows });
    });

    // Re-fit whenever the container's CSS size changes (sidebar open/close, etc.)
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* container may briefly be 0×0 */ }
    });
    ro.observe(containerRef.current!);

    // ── Cleanup on unmount ────────────────────────────────────────────────
    return () => {
      ro.disconnect();
      socket.disconnect();
      term.dispose();
      termRef.current   = null;
      fitRef.current    = null;
      socketRef.current = null;
    };
  }, []); // intentional empty-dep: connect once on mount

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 124px)' }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
          Terminal
        </Typography>

        <Paper
          elevation={4}
          sx={{
            flexGrow: 1,
            minHeight: 0,
            bgcolor:  '#0d1117',
            border:   '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            p: 0.5,
          }}
        >
          {/* xterm.js mounts into this div */}
          <Box
            ref={containerRef}
            sx={{
              flexGrow: 1,
              minHeight: 0,
              p: '4px 8px',
              '& .xterm':          { height: '100%' },
              '& .xterm-viewport': { overflowY: 'hidden !important' },
              '& .xterm-screen':   { width: '100% !important' },
            }}
          />
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
