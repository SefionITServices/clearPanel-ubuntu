import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Stack,
  CircularProgress, Tabs, Tab, Grid, LinearProgress, Divider,
  Snackbar, Alert, Tooltip, IconButton,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import MonitorIcon from '@mui/icons-material/Monitor';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import RefreshIcon from '@mui/icons-material/Refresh';
import SpeedIcon from '@mui/icons-material/Speed';
import DnsIcon from '@mui/icons-material/Dns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ComputerIcon from '@mui/icons-material/Computer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { monitoringApi } from '../api/monitoring';

// ─── Types ────────────────────────────────────────────────────────────

interface CpuInfo { model: string; cores: number; usagePercent: number; loadAverage: number[]; }
interface MemoryInfo { totalMB: number; usedMB: number; freeMB: number; availableMB: number; usagePercent: number; swapTotalMB: number; swapUsedMB: number; swapPercent: number; }
interface DiskInfo { filesystem: string; mountpoint: string; totalGB: number; usedGB: number; availableGB: number; usagePercent: number; }
interface NetworkInterface { name: string; ipv4?: string; ipv6?: string; rxBytes: number; txBytes: number; rxPackets: number; txPackets: number; }
interface ServiceStatus { name: string; active: boolean; enabled: boolean; description: string; }
interface SystemOverview { hostname: string; os: string; kernel: string; uptime: string; uptimeSeconds: number; cpu: CpuInfo; memory: MemoryInfo; disks: DiskInfo[]; network: NetworkInterface[]; services: ServiceStatus[]; }

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
}

function getBarColor(percent: number): string {
  if (percent >= 90) return '#EA4335';
  if (percent >= 75) return '#F9AB00';
  return '#34A853';
}

// ─── Main Component ───────────────────────────────────────────────────

export default function MonitoringPage() {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const toast = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const loadData = useCallback(async () => {
    try {
      const result = await monitoringApi.getOverview();
      if (result.success) setData(result.data);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 10_000); // 10 sec
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <MonitorIcon sx={{ color: '#1A73E8', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>Resource Monitor</Typography>
              <Typography variant="body1" color="text.secondary">
                Real-time server resource usage and service status
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              color={autoRefresh ? 'success' : 'inherit'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              sx={{ textTransform: 'none' }}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
          </Stack>
        </Box>

        {loading || !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={3}>
            {/* System Info Bar */}
            <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ComputerIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Hostname</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.hostname}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DnsIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">OS</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.os}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SpeedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Kernel</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.kernel}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Uptime</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.uptime}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* CPU + Memory */}
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <GaugeCard
                  icon={<MemoryIcon />}
                  title="CPU"
                  subtitle={`${data.cpu.model} — ${data.cpu.cores} cores`}
                  percent={data.cpu.usagePercent}
                  details={[
                    { label: 'Load Avg (1m)', value: data.cpu.loadAverage[0]?.toFixed(2) || '0' },
                    { label: 'Load Avg (5m)', value: data.cpu.loadAverage[1]?.toFixed(2) || '0' },
                    { label: 'Load Avg (15m)', value: data.cpu.loadAverage[2]?.toFixed(2) || '0' },
                  ]}
                  color="#4285F4"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <GaugeCard
                  icon={<StorageIcon />}
                  title="Memory"
                  subtitle={`${data.memory.usedMB} MB / ${data.memory.totalMB} MB`}
                  percent={data.memory.usagePercent}
                  details={[
                    { label: 'Available', value: `${data.memory.availableMB} MB` },
                    { label: 'Swap', value: data.memory.swapTotalMB > 0 ? `${data.memory.swapUsedMB} / ${data.memory.swapTotalMB} MB (${data.memory.swapPercent}%)` : 'N/A' },
                  ]}
                  color="#34A853"
                />
              </Grid>
            </Grid>

            {/* Disks */}
            <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StorageIcon sx={{ color: '#FBBC04' }} /> Disk Usage
                </Typography>
                <Stack spacing={2}>
                  {data.disks.map((disk, i) => (
                    <Box key={i}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {disk.mountpoint}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({disk.filesystem})
                          </Typography>
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: getBarColor(disk.usagePercent) }}>
                          {disk.usedGB}G / {disk.totalGB}G ({disk.usagePercent}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={disk.usagePercent}
                        sx={{
                          height: 8, borderRadius: 1,
                          bgcolor: `${getBarColor(disk.usagePercent)}20`,
                          '& .MuiLinearProgress-bar': { bgcolor: getBarColor(disk.usagePercent), borderRadius: 1 },
                        }}
                      />
                    </Box>
                  ))}
                  {data.disks.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No disk information available</Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Network + Services */}
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2, height: '100%' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <NetworkCheckIcon sx={{ color: '#7B1FA2' }} /> Network
                    </Typography>
                    <Stack spacing={1.5}>
                      {data.network.map((iface, i) => (
                        <Box key={i} sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{iface.name}</Typography>
                            {iface.ipv4 && <Chip size="small" label={iface.ipv4} sx={{ height: 20, fontSize: '0.65rem' }} />}
                          </Box>
                          <Stack direction="row" spacing={2}>
                            <Typography variant="caption" color="text.secondary">
                              RX: {formatBytes(iface.rxBytes)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              TX: {formatBytes(iface.txBytes)}
                            </Typography>
                          </Stack>
                        </Box>
                      ))}
                      {data.network.length === 0 && (
                        <Typography variant="body2" color="text.secondary">No network interfaces</Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2, height: '100%' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DnsIcon sx={{ color: '#EA4335' }} /> Services
                    </Typography>
                    <Stack spacing={1}>
                      {data.services.map((svc, i) => (
                        <Box key={i} sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' },
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {svc.active
                              ? <CheckCircleIcon sx={{ fontSize: 16, color: '#34A853' }} />
                              : <CancelIcon sx={{ fontSize: 16, color: '#EA4335' }} />
                            }
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{svc.name}</Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={svc.active ? 'Running' : 'Stopped'}
                            color={svc.active ? 'success' : 'error'}
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }}
                          />
                        </Box>
                      ))}
                      {data.services.length === 0 && (
                        <Typography variant="body2" color="text.secondary">No services detected</Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Stack>
        )}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GAUGE CARD  
// ═══════════════════════════════════════════════════════════════════════

function GaugeCard({
  icon, title, subtitle, percent, details, color,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  percent: number;
  details: { label: string; value: string }[];
  color: string;
}) {
  const barColor = getBarColor(percent);

  return (
    <Card elevation={0} sx={{ border: t => `1px solid ${t.palette.divider}`, borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 1.5,
            bgcolor: `${color}14`, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: barColor }}>
            {percent}%
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={percent}
          sx={{
            height: 10, borderRadius: 1.5, mb: 2,
            bgcolor: `${barColor}20`,
            '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 1.5 },
          }}
        />

        <Stack spacing={0.5}>
          {details.map((d, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">{d.label}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{d.value}</Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
