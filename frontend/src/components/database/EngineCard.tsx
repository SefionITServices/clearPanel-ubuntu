import React from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  Stack,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Storage,
  Refresh,
  Download,
  PlayArrow,
  LinkOff,
  DeleteForever,
  HealthAndSafety,
} from '@mui/icons-material';
import { EngineInfo } from './utils';

interface EngineCardProps {
  engine: EngineInfo;
  activeEngine: string;
  onManage: (engine: string) => void;
  onRestart: (engine: string) => void;
  onStart: (engine: string) => void;
  onStop: (engine: string) => void;
  onInstall: (engine: string) => void;
  onUninstall: (engine: string) => void;
  onDiagnose: (engine: string) => void;
  busyStates: {
    installing?: string | null;
    restarting?: string | null;
    starting?: string | null;
    stopping?: string | null;
    uninstalling?: string | null;
  };
}

const ENGINE_COLORS: Record<string, string> = {
  mariadb: '#003545',
  mysql: '#00758F',
  postgresql: '#336791',
};

const ENGINE_DESCRIPTIONS: Record<string, string> = {
  mariadb: 'Community-developed fork of MySQL with enhanced performance.',
  mysql: "World's most popular open-source relational database.",
  postgresql: 'Advanced open-source database with powerful features.',
};

export function EngineCard({
  engine,
  activeEngine,
  onManage,
  onRestart,
  onStart,
  onStop,
  onInstall,
  onUninstall,
  onDiagnose,
  busyStates,
}: EngineCardProps) {
  const isInstalled = engine.installed;
  const isRunning = engine.running;
  const color = ENGINE_COLORS[engine.engine] || '#666';
  
  const isManaging = isRunning && (
    (engine.engine === 'postgresql' && activeEngine === 'postgresql') ||
    ((engine.engine === 'mariadb' || engine.engine === 'mysql') && activeEngine !== 'postgresql')
  );

  const isInstalling = busyStates.installing === engine.engine;
  const isRestarting = busyStates.restarting === engine.engine;
  const isStarting = busyStates.starting === engine.engine;
  const isStopping = busyStates.stopping === engine.engine;
  const isUninstalling = busyStates.uninstalling === engine.engine;

  return (
    <Paper
      sx={{
        flex: 1,
        overflow: 'hidden',
        border: isManaging ? `2px solid ${color}` : isInstalled ? '2px solid #34A853' : '1px solid #e0e0e0',
        transition: 'all 0.2s',
        ...(isManaging && { boxShadow: `0 0 0 1px ${color}20, 0 4px 12px ${color}15` }),
      }}
    >
      <Box sx={{ p: 2, bgcolor: color, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{engine.label}</Typography>
        {isInstalled && (
          <Chip
            label={isRunning ? 'Running' : 'Stopped'}
            size="small"
            sx={{ bgcolor: isRunning ? '#34A853' : '#F4B400', color: '#fff', fontWeight: 600 }}
          />
        )}
      </Box>
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>
          {ENGINE_DESCRIPTIONS[engine.engine]}
        </Typography>
        {engine.version && (
          <Chip
            label={engine.version.split('\n')[0].substring(0, 50)}
            size="small"
            variant="outlined"
            sx={{ fontFamily: 'monospace', fontSize: '0.7rem', mb: 1.5 }}
          />
        )}

        {isInstalled && isRunning ? (
          <Stack spacing={1}>
            <Button
              variant={isManaging ? 'contained' : 'outlined'}
              fullWidth
              size="small"
              startIcon={<Storage />}
              onClick={() => onManage(engine.engine)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                ...(isManaging && { bgcolor: color, '&:hover': { bgcolor: color, opacity: 0.9 } }),
              }}
            >
              {isManaging ? 'Managing' : 'Manage'}
            </Button>
            <Stack direction="row" spacing={0.5}>
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={isRestarting ? <CircularProgress size={14} color="inherit" /> : <Refresh />}
                onClick={() => onRestart(engine.engine)}
                disabled={isRestarting || isStopping}
                sx={{ textTransform: 'none', fontSize: '0.7rem', flex: 1 }}
              >
                {isRestarting ? 'Restarting...' : 'Restart'}
              </Button>
              <Tooltip title="Diagnose">
                <IconButton size="small" onClick={() => onDiagnose(engine.engine)} sx={{ color: '#666' }}>
                  <HealthAndSafety fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={isStopping ? <CircularProgress size={14} color="inherit" /> : <LinkOff />}
                onClick={() => onStop(engine.engine)}
                disabled={isStopping || isRestarting}
                sx={{ textTransform: 'none', fontSize: '0.7rem', flex: 1 }}
              >
                {isStopping ? 'Stopping...' : 'Stop'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={isUninstalling ? <CircularProgress size={14} color="inherit" /> : <DeleteForever />}
                onClick={() => onUninstall(engine.engine)}
                disabled={isUninstalling}
                sx={{ textTransform: 'none', fontSize: '0.7rem', flex: 1 }}
              >
                {isUninstalling ? 'Removing...' : 'Uninstall'}
              </Button>
            </Stack>
          </Stack>
        ) : isInstalled && !isRunning ? (
          <Stack spacing={1}>
            <Button
              variant="contained"
              fullWidth
              size="small"
              color="success"
              startIcon={isStarting ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
              onClick={() => onStart(engine.engine)}
              disabled={isStarting}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {isStarting ? 'Starting...' : `Start ${engine.label}`}
            </Button>
            <Stack direction="row" spacing={0.5}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<HealthAndSafety />}
                onClick={() => onDiagnose(engine.engine)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', flex: 1 }}
              >
                Diagnose
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={isUninstalling ? <CircularProgress size={14} color="inherit" /> : <DeleteForever />}
                onClick={() => onUninstall(engine.engine)}
                disabled={isUninstalling}
                sx={{ textTransform: 'none', fontSize: '0.75rem', flex: 1 }}
              >
                {isUninstalling ? 'Removing...' : 'Uninstall'}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={() => onInstall(engine.engine)}
            disabled={isInstalling}
            startIcon={isInstalling ? <CircularProgress size={16} color="inherit" /> : <Download />}
            sx={{ textTransform: 'none', bgcolor: color, '&:hover': { bgcolor: color, opacity: 0.9 } }}
          >
            {isInstalling ? `Installing ${engine.label}...` : `Install ${engine.label}`}
          </Button>
        )}
      </Box>
    </Paper>
  );
}
