import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DashboardLayout } from '../layouts/dashboard/layout';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CircleIcon from '@mui/icons-material/Circle';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import MergeIcon from '@mui/icons-material/Merge';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import UndoIcon from '@mui/icons-material/Undo';
import { gitApi, Commit, GitStatus, PathOption, ManagedRepo, HeadCommit } from '../api/git';

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'list' | 'create' | 'manage';

// ─── Diff Viewer ─────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'hunk' | 'meta';
  content: string;
  lineOld?: number;
  lineNew?: number;
}

function parseDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const content of raw.split('\n')) {
    if (content.startsWith('@@')) {
      const m = content.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldLine = parseInt(m[1], 10); newLine = parseInt(m[2], 10); }
      lines.push({ type: 'hunk', content });
    } else if (content.startsWith('+') && !content.startsWith('+++')) {
      lines.push({ type: 'add', content: content.slice(1), lineNew: newLine++ });
    } else if (content.startsWith('-') && !content.startsWith('---')) {
      lines.push({ type: 'remove', content: content.slice(1), lineOld: oldLine++ });
    } else if (content.startsWith('diff ') || content.startsWith('index ') || content.startsWith('---') || content.startsWith('+++')) {
      lines.push({ type: 'meta', content });
    } else {
      lines.push({ type: 'context', content: content.slice(1), lineOld: oldLine++, lineNew: newLine++ });
    }
  }
  return lines;
}

function DiffViewer({ diff, title }: { diff: string; title?: string }) {
  const lines = parseDiff(diff);
  if (!diff.trim()) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography variant="body2">No changes to display</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ height: '100%', overflow: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
      {title && (
        <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', bgcolor: 'action.hover', color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>
          {title}
        </Typography>
      )}
      {lines.map((line, i) => {
        let bg = 'transparent';
        let color = 'text.primary';
        let prefix = ' ';
        if (line.type === 'add') { bg = 'rgba(0,200,83,0.12)'; color = '#00c853'; prefix = '+'; }
        if (line.type === 'remove') { bg = 'rgba(244,67,54,0.12)'; color = '#f44336'; prefix = '-'; }
        if (line.type === 'hunk') { bg = 'rgba(33,150,243,0.10)'; color = '#2196f3'; prefix = ''; }
        if (line.type === 'meta') { color = 'text.disabled'; prefix = ''; }
        return (
          <Box key={i} sx={{ display: 'flex', bgcolor: bg }}>
            {line.type !== 'hunk' && line.type !== 'meta' && (
              <Box sx={{ display: 'flex', minWidth: 72, flexShrink: 0, userSelect: 'none', borderRight: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ width: 36, textAlign: 'right', pr: 0.5, color: 'text.disabled', fontSize: 11 }}>{line.lineOld ?? ''}</Box>
                <Box sx={{ width: 36, textAlign: 'right', pr: 0.5, color: 'text.disabled', fontSize: 11 }}>{line.lineNew ?? ''}</Box>
              </Box>
            )}
            <Box sx={{ pl: 1, pr: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color, flexGrow: 1, ...(line.type === 'hunk' || line.type === 'meta' ? { fontStyle: 'italic' } : {}) }}>
              {line.type !== 'meta' ? `${prefix}${line.content}` : line.content}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileLabel(entry: string): string { return entry.slice(2).trim(); }

function statusBadgeColor(ch: string): string {
  const map: Record<string, string> = { M: '#ff9800', A: '#4caf50', D: '#f44336', R: '#2196f3', C: '#9c27b0', U: '#ff5722', '?': '#607d8b' };
  return map[ch.toUpperCase()] || '#9e9e9e';
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton size="small" onClick={copy} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
        {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', alignItems: 'flex-start', gap: 2 }}>
      <Typography variant="body2" fontWeight={600} sx={{ width: 180, flexShrink: 0, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ flexGrow: 1 }}>{children}</Box>
    </Box>
  );
}

// ─── Branch Dialog ─────────────────────────────────────────────────────────────

function BranchDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (name: string, from?: string) => void }) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create Branch</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Branch name" value={name} onChange={e => setName(e.target.value)} fullWidth size="small" autoFocus />
          <TextField label="From (branch/commit, optional)" value={from} onChange={e => setFrom(e.target.value)} fullWidth size="small" placeholder="HEAD" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onDone(name.trim(), from.trim() || undefined); onClose(); }} variant="contained" disabled={!name.trim()}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Remote Dialog ────────────────────────────────────────────────────────────

function RemoteDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (name: string, url: string) => void }) {
  const [name, setName] = useState('origin');
  const [url, setUrl] = useState('');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Remote</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Remote name" value={name} onChange={e => setName(e.target.value)} fullWidth size="small" />
          <TextField label="URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/user/repo.git" fullWidth size="small" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onDone(name.trim(), url.trim()); onClose(); }} variant="contained" disabled={!name.trim() || !url.trim()}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Stash Panel ─────────────────────────────────────────────────────────────

function StashPanel({ repoPath, onRefresh }: { repoPath: string; onRefresh: () => void }) {
  const [stashes, setStashes] = useState<Array<{ ref: string; subject: string; date: string }>>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await gitApi.stashList(repoPath); setStashes(r.stashes); } catch { }
  }, [repoPath]);

  useEffect(() => { if (repoPath) load(); }, [repoPath, load]);

  const doStash = async () => {
    setBusy(true);
    try { await gitApi.stash(repoPath, msg || undefined); setMsg(''); load(); onRefresh(); } catch { }
    finally { setBusy(false); }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField size="small" placeholder="Stash message (optional)" value={msg} onChange={e => setMsg(e.target.value)} sx={{ flexGrow: 1 }} />
        <Button variant="outlined" size="small" onClick={doStash} disabled={busy}>Stash</Button>
      </Stack>
      {stashes.length === 0 ? (
        <Typography variant="caption" color="text.secondary">No stashes</Typography>
      ) : (
        <List dense disablePadding>
          {stashes.map(s => (
            <ListItem key={s.ref} disablePadding secondaryAction={
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Pop"><IconButton size="small" onClick={() => gitApi.stashPop(repoPath, s.ref).then(load)}><RestoreIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Drop"><IconButton size="small" onClick={() => gitApi.stashDrop(repoPath, s.ref).then(load)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            }>
              <ListItemText primary={s.subject} secondary={`${s.ref} · ${new Date(s.date).toLocaleDateString()}`} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

// ─── Manage Repository View ───────────────────────────────────────────────────

function ManageView({ repo, onBack }: { repo: ManagedRepo; onBack: () => void }) {
  const [tab, setTab] = useState(0);
  const [repoName, setRepoName] = useState(repo.name);
  const [branches, setBranches] = useState<{ current: string; local: string[]; remote: string[] }>({ current: '', local: [], remote: [] });
  const [remotes, setRemotes] = useState<Record<string, { fetch: string; push: string }>>({});
  const [headCommit, setHeadCommit] = useState<HeadCommit | null>(null);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [deployScript, setDeployScript] = useState('');
  const [deployScriptLoaded, setDeployScriptLoaded] = useState(false);
  const [deployOutput, setDeployOutput] = useState('');
  const [pullOutput, setPullOutput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [diffContent, setDiffContent] = useState('');
  const [diffTitle, setDiffTitle] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [historyTab, setHistoryTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opBusy, setOpBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, sev: 'success' | 'error' | 'info' = 'success') => setToast({ msg, sev });
  const [branchOpen, setBranchOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [branchMenuEl, setBranchMenuEl] = useState<null | HTMLElement>(null);
  const [branchMenuTarget, setBranchMenuTarget] = useState('');

  const repoPath = repo.path;

  const loadBasicInfo = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r, h] = await Promise.all([
        gitApi.branches(repoPath),
        gitApi.remotes(repoPath),
        gitApi.getHeadCommit(repoPath),
      ]);
      setBranches({ current: b.current, local: b.local, remote: b.remote });
      setRemotes(r.remotes);
      setHeadCommit(h.commit);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [repoPath]);

  const loadStatus = useCallback(async () => {
    try { const s = await gitApi.status(repoPath); setStatus(s); } catch { }
  }, [repoPath]);

  const loadCommits = useCallback(async () => {
    try { const r = await gitApi.log(repoPath, 80); setCommits(r.commits); } catch { }
  }, [repoPath]);

  const loadDeployScript = useCallback(async () => {
    if (deployScriptLoaded) return;
    try { const r = await gitApi.getDeployScript(repoPath); setDeployScript(r.script); setDeployScriptLoaded(true); } catch { }
  }, [repoPath, deployScriptLoaded]);

  useEffect(() => { loadBasicInfo(); }, [loadBasicInfo]);
  useEffect(() => { if (tab === 1) loadDeployScript(); }, [tab, loadDeployScript]);
  useEffect(() => { if (tab === 2) loadStatus(); }, [tab, loadStatus]);
  useEffect(() => { if (tab === 2 && historyTab === 1) loadCommits(); }, [tab, historyTab, loadCommits]);

  const doUpdateName = async () => {
    if (!repoName.trim()) return;
    setOpBusy(true);
    try { await gitApi.addRepo(repoName.trim(), repoPath, repo.cloneUrl); showToast('Repository name updated'); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doCheckoutBranch = async (branch: string) => {
    setOpBusy(true);
    try { await gitApi.checkout(repoPath, branch); showToast(`Switched to ${branch}`); await loadBasicInfo(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doPull = async () => {
    setOpBusy(true); setPullOutput('');
    try { const r = await gitApi.pull(repoPath); setPullOutput(r.output || 'Already up to date.'); showToast('Updated from remote'); loadBasicInfo(); }
    catch (e: any) { setPullOutput(`Error: ${e.message}`); showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doPush = async () => {
    setOpBusy(true);
    try { const r = await gitApi.push(repoPath); showToast(r.output || 'Pushed successfully'); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doSaveScript = async () => {
    setOpBusy(true);
    try { await gitApi.setDeployScript(repoPath, deployScript); showToast('Deploy script saved'); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doDeploy = async () => {
    setOpBusy(true); setDeployOutput('Running deploy script...');
    try { const r = await gitApi.deploy(repoPath); setDeployOutput(r.output || '(no output)'); showToast('Deploy completed'); }
    catch (e: any) { setDeployOutput(`Error: ${e.message}`); showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doCreateBranch = async (name: string, from?: string) => {
    setOpBusy(true);
    try { await gitApi.createBranch(repoPath, name, from); showToast(`Branch "${name}" created`); await loadBasicInfo(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doDeleteBranch = async (branch: string) => {
    if (!confirm(`Delete branch "${branch}"?`)) return;
    setOpBusy(true);
    try { await gitApi.deleteBranch(repoPath, branch); showToast(`Deleted "${branch}"`); await loadBasicInfo(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doMerge = async (branch: string) => {
    if (!confirm(`Merge "${branch}" into "${branches.current}"?`)) return;
    setOpBusy(true);
    try { await gitApi.merge(repoPath, branch); showToast('Merged'); await loadBasicInfo(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doAddRemote = async (name: string, url: string) => {
    setOpBusy(true);
    try { await gitApi.addRemote(repoPath, name, url); showToast('Remote added'); await loadBasicInfo(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const showDiff = async (file: string, staged: boolean) => {
    try {
      const r = staged ? await gitApi.diffStaged(repoPath, file) : await gitApi.diff(repoPath, file);
      setDiffContent(r.diff); setDiffTitle(file);
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const showCommitDiff = async (hash: string) => {
    try { const r = await gitApi.diffCommit(repoPath, hash); setDiffContent(r.diff); setDiffTitle(hash.slice(0, 7)); }
    catch (e: any) { showToast(e.message, 'error'); }
  };

  const toggleSelect = (entry: string) => {
    setSelectedFiles(prev => { const next = new Set(prev); if (next.has(entry)) next.delete(entry); else next.add(entry); return next; });
  };

  const doAdd = async (files: string[] = []) => {
    try { await gitApi.add(repoPath, files); await loadStatus(); } catch { }
  };

  const doUnstage = async (file?: string) => {
    try { await gitApi.unstage(repoPath, file ? [file] : []); await loadStatus(); } catch { }
  };

  const doDiscard = async (file: string) => {
    if (!confirm(`Discard changes to ${file}?`)) return;
    try { await gitApi.discard(repoPath, [file]); await loadStatus(); } catch { }
  };

  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    setOpBusy(true);
    try {
      await gitApi.commit(repoPath, commitMsg.trim());
      showToast('Committed!'); setCommitMsg(''); await loadStatus(); await loadBasicInfo();
      if (historyTab === 1) loadCommits();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const cloneUrl = headCommit?.remoteUrl || Object.values(remotes)[0]?.fetch || '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <IconButton size="small" onClick={onBack}><ArrowBackIcon fontSize="small" /></IconButton>
        <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer' }} onClick={onBack}>Repositories</Typography>
        <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        <Typography variant="subtitle1" fontWeight={700}>{repo.name}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {loading && <CircularProgress size={18} />}
        {tab === 2 && (
          <Stack direction="row" spacing={1}>
            {status && (
              <>
                {status.ahead > 0 && <Chip size="small" icon={<ArrowUpwardIcon sx={{ fontSize: 14 }} />} label={`${status.ahead} ahead`} color="info" variant="outlined" />}
                {status.behind > 0 && <Chip size="small" icon={<ArrowDownwardIcon sx={{ fontSize: 14 }} />} label={`${status.behind} behind`} color="warning" variant="outlined" />}
              </>
            )}
            <Chip size="small" icon={<AccountTreeIcon sx={{ fontSize: 14 }} />} label={branches.current || '—'} variant="outlined" />
            <Tooltip title="Pull"><IconButton size="small" onClick={doPull} disabled={opBusy}><CloudDownloadIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Push"><IconButton size="small" onClick={doPush} disabled={opBusy}><CloudUploadIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Refresh"><IconButton size="small" onClick={() => { loadStatus(); loadBasicInfo(); }}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
          </Stack>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40, px: 2 }}>
          <Tab label="Basic Information" sx={{ minHeight: 40, fontSize: 13 }} />
          <Tab label="Pull or Deploy" sx={{ minHeight: 40, fontSize: 13 }} />
          <Tab label="Working Tree" sx={{ minHeight: 40, fontSize: 13 }} />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* ── Basic Information ── */}
        {tab === 0 && (
          <Box sx={{ p: 3, maxWidth: 720 }}>
            <InfoRow label="Repository Path">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" fontFamily="monospace">{repoPath}</Typography>
                <CopyButton text={repoPath} />
              </Stack>
            </InfoRow>

            <InfoRow label="Repository Name">
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" value={repoName} onChange={e => setRepoName(e.target.value)} sx={{ width: 280 }} />
                <Button size="small" variant="outlined" onClick={doUpdateName} disabled={opBusy || repoName === repo.name}>Update</Button>
              </Stack>
            </InfoRow>

            <InfoRow label="Checked-Out Branch">
              {branches.local.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No commits yet</Typography>
              ) : (
                <TextField select size="small" value={branches.current} sx={{ width: 240 }} onChange={e => doCheckoutBranch(e.target.value)} disabled={opBusy}>
                  {branches.local.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                </TextField>
              )}
            </InfoRow>

            {headCommit && (
              <InfoRow label="HEAD Commit">
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover' }}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" fontFamily="monospace" color="primary.main" fontWeight={700}>{headCommit.short}</Typography>
                      <CopyButton text={headCommit.hash} />
                    </Stack>
                    <Typography variant="body2" fontWeight={600}>{headCommit.subject}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {headCommit.authorName} &lt;{headCommit.authorEmail}&gt; · {new Date(headCommit.date).toLocaleString()}
                    </Typography>
                  </Stack>
                </Paper>
              </InfoRow>
            )}

            {headCommit?.remoteUrl && (
              <InfoRow label="Remote URL">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>{headCommit.remoteUrl}</Typography>
                  <CopyButton text={headCommit.remoteUrl} />
                </Stack>
              </InfoRow>
            )}

            {cloneUrl && (
              <InfoRow label="Clone URL">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>{cloneUrl}</Typography>
                  <CopyButton text={cloneUrl} />
                </Stack>
              </InfoRow>
            )}

            <Box sx={{ mt: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>Local Branches</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setBranchOpen(true)}>New Branch</Button>
              </Stack>
              {branches.local.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No branches yet</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {branches.local.map(b => (
                    <Box key={b} sx={{ display: 'flex', alignItems: 'center', p: 1, borderRadius: 1, bgcolor: b === branches.current ? 'primary.main' + '14' : 'action.hover' }}>
                      {b === branches.current && <CircleIcon sx={{ fontSize: 8, mr: 1, color: 'success.main' }} />}
                      <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: b === branches.current ? 600 : 400 }}>{b}</Typography>
                      {b !== branches.current && (
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" sx={{ fontSize: 11 }} onClick={() => doCheckoutBranch(b)}>Checkout</Button>
                          <Button size="small" sx={{ fontSize: 11 }} onClick={() => doMerge(b)}>Merge</Button>
                          <IconButton size="small" color="error" onClick={() => doDeleteBranch(b)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </Stack>
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Box sx={{ mt: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>Remotes</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setRemoteOpen(true)}>Add Remote</Button>
              </Stack>
              {Object.keys(remotes).length === 0 ? (
                <Typography variant="body2" color="text.secondary">No remotes configured</Typography>
              ) : Object.entries(remotes).map(([name, r]) => (
                <Box key={name} sx={{ mb: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <SyncAltIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" fontWeight={700}>{name}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ pl: 3.5, display: 'block' }}>{r.fetch}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ── Pull or Deploy ── */}
        {tab === 1 && (
          <Box sx={{ p: 3, maxWidth: 760 }}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>Update from Remote</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Pull the latest changes from the remote repository to this server.
              </Typography>
              <Button variant="contained" startIcon={opBusy ? <CircularProgress size={16} /> : <CloudDownloadIcon />} onClick={doPull} disabled={opBusy}>
                Update from Remote
              </Button>
              {pullOutput && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#0d1117', borderRadius: 1, fontFamily: 'monospace', fontSize: 12, color: '#e6edf3', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                  {pullOutput}
                </Box>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>Deploy HEAD Commit</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Edit the deploy script below (runs as bash from your repository root).
              </Typography>
              <TextField
                multiline minRows={8} maxRows={16} fullWidth size="small"
                value={deployScript} onChange={e => setDeployScript(e.target.value)}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
                placeholder={'#!/bin/bash\n# Add your deploy commands here'}
                sx={{ mb: 2 }}
              />
              <Stack direction="row" spacing={1.5}>
                <Button variant="outlined" startIcon={<SaveIcon />} onClick={doSaveScript} disabled={opBusy}>Save Script</Button>
                <Button variant="contained" color="success" startIcon={opBusy ? <CircularProgress size={16} /> : <PlayArrowIcon />} onClick={doDeploy} disabled={opBusy}>
                  Deploy HEAD Commit
                </Button>
              </Stack>
              {deployOutput && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#0d1117', borderRadius: 1, fontFamily: 'monospace', fontSize: 12, color: '#e6edf3', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
                  {deployOutput}
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {/* ── Working Tree ── */}
        {tab === 2 && (
          <Box sx={{ display: 'flex', height: 'calc(100vh - 64px - 48px - 49px)', overflow: 'hidden' }}>
            {/* LEFT — branches */}
            <Box sx={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', overflow: 'auto', bgcolor: 'background.paper' }}>
              <Box sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Branches</Typography>
                  <Tooltip title="New branch"><IconButton size="small" onClick={() => setBranchOpen(true)}><AddIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                </Stack>
                <List dense disablePadding>
                  {branches.local.map(b => (
                    <ListItem key={b} disablePadding dense secondaryAction={b !== branches.current && (
                      <IconButton size="small" edge="end" onClick={e => { e.stopPropagation(); setBranchMenuEl(e.currentTarget); setBranchMenuTarget(b); }}>
                        <MoreVertIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}>
                      <ListItemButton dense selected={b === branches.current} onClick={() => b !== branches.current && doCheckoutBranch(b)} sx={{ borderRadius: 1, py: 0.5 }}>
                        {b === branches.current && <CircleIcon sx={{ fontSize: 8, mr: 0.8, color: 'success.main' }} />}
                        <ListItemText primary={b} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
                {branches.remote.length > 0 && (
                  <>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mt: 1.5, mb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>Remote</Typography>
                    <List dense disablePadding>
                      {branches.remote.map(b => (
                        <ListItem key={b} disablePadding dense>
                          <ListItemText primary={b} primaryTypographyProps={{ variant: 'caption', color: 'text.secondary', noWrap: true }} sx={{ px: 1 }} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Box>
              <Divider />
              <Box sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Remotes</Typography>
                  <Tooltip title="Add remote"><IconButton size="small" onClick={() => setRemoteOpen(true)}><AddIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                </Stack>
                {Object.keys(remotes).length === 0 ? (
                  <Typography variant="caption" color="text.disabled">No remotes</Typography>
                ) : Object.entries(remotes).map(([name, r]) => (
                  <Box key={name} sx={{ mb: 0.5 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <SyncAltIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" fontWeight={600}>{name}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 2.5, wordBreak: 'break-all', fontSize: 10 }}>{r.fetch}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* MIDDLE — changes/history/stash */}
            <Box sx={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper' }}>
              <Tabs value={historyTab} onChange={(_, v) => setHistoryTab(v)} sx={{ minHeight: 40, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }} variant="fullWidth">
                <Tab label="Changes" sx={{ minHeight: 40, fontSize: 12 }} />
                <Tab label="History" sx={{ minHeight: 40, fontSize: 12 }} />
                <Tab label="Stash" sx={{ minHeight: 40, fontSize: 12 }} />
              </Tabs>

              {historyTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                  <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                    {status?.staged && status.staged.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={700} color="success.main">STAGED ({status.staged.length})</Typography>
                          <Button size="small" sx={{ fontSize: 11, py: 0, minWidth: 0 }} onClick={() => doUnstage()}>Unstage all</Button>
                        </Stack>
                        {status.staged.map(entry => {
                          const ch = entry[0]; const file = fileLabel(entry);
                          return (
                            <Stack key={entry} direction="row" alignItems="center" sx={{ borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }} onClick={() => showDiff(file, true)}>
                              <Checkbox size="small" checked={selectedFiles.has(entry)} onClick={e => { e.stopPropagation(); toggleSelect(entry); }} sx={{ p: 0.5 }} />
                              <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: statusBadgeColor(ch), display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 0.5, flexShrink: 0 }}>
                                <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{ch}</Typography>
                              </Box>
                              <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>{file}</Typography>
                              <Tooltip title="Unstage"><IconButton size="small" onClick={e => { e.stopPropagation(); doUnstage(file); }}><UndoIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                            </Stack>
                          );
                        })}
                      </Box>
                    )}
                    {status?.unstaged && status.unstaged.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={700} color="warning.main">MODIFIED ({status.unstaged.length})</Typography>
                          <Button size="small" sx={{ fontSize: 11, py: 0, minWidth: 0 }} onClick={() => doAdd([])}>Stage all</Button>
                        </Stack>
                        {status.unstaged.map(entry => {
                          const ch = entry[0]; const file = fileLabel(entry);
                          return (
                            <Stack key={entry} direction="row" alignItems="center" sx={{ borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }} onClick={() => showDiff(file, false)}>
                              <Checkbox size="small" checked={selectedFiles.has(entry)} onClick={e => { e.stopPropagation(); toggleSelect(entry); }} sx={{ p: 0.5 }} />
                              <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: statusBadgeColor(ch), display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 0.5, flexShrink: 0 }}>
                                <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{ch}</Typography>
                              </Box>
                              <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>{file}</Typography>
                              <Stack direction="row">
                                <Tooltip title="Stage"><IconButton size="small" onClick={e => { e.stopPropagation(); doAdd([file]); }}><PlaylistAddCheckIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                <Tooltip title="Discard"><IconButton size="small" onClick={e => { e.stopPropagation(); doDiscard(file); }}><DeleteOutlineIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                              </Stack>
                            </Stack>
                          );
                        })}
                      </Box>
                    )}
                    {status?.untracked && status.untracked.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 0.5, mb: 0.5, display: 'block' }}>UNTRACKED ({status.untracked.length})</Typography>
                        {status.untracked.map(file => (
                          <Stack key={file} direction="row" alignItems="center" sx={{ borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                            <Checkbox size="small" checked={selectedFiles.has(`? ${file}`)} onClick={() => toggleSelect(`? ${file}`)} sx={{ p: 0.5 }} />
                            <Typography variant="caption" noWrap sx={{ flexGrow: 1, color: 'text.disabled' }}>{file}</Typography>
                            <Tooltip title="Stage"><IconButton size="small" onClick={() => doAdd([file])}><PlaylistAddCheckIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                          </Stack>
                        ))}
                      </Box>
                    )}
                    {(!status || (status.staged.length + status.unstaged.length + status.untracked.length === 0)) && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4, color: 'text.disabled', gap: 0.5 }}>
                        <CheckIcon sx={{ opacity: 0.3, fontSize: 40 }} />
                        <Typography variant="caption">Working tree clean</Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flexShrink: 0, p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button size="small" variant="outlined" sx={{ fontSize: 11, mb: 1 }} onClick={() => doAdd([])} disabled={opBusy}>
                      <PlaylistAddCheckIcon sx={{ fontSize: 14, mr: 0.5 }} />Stage All
                    </Button>
                    <TextField size="small" multiline minRows={2} maxRows={4} fullWidth placeholder="Commit message…" value={commitMsg} onChange={e => setCommitMsg(e.target.value)} sx={{ mb: 1 }} />
                    <Button variant="contained" fullWidth size="small" onClick={doCommit} disabled={opBusy || !commitMsg.trim() || !status?.staged.length}>
                      {opBusy ? <CircularProgress size={16} /> : `Commit to ${branches.current || 'main'}`}
                    </Button>
                  </Box>
                </Box>
              )}

              {historyTab === 1 && (
                <Box sx={{ overflow: 'auto', flex: 1, p: 1 }}>
                  {commits.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                      <Typography variant="caption" color="text.secondary">No commits yet</Typography>
                    </Box>
                  ) : commits.map((c, i) => (
                    <Box key={c.hash} onClick={() => showCommitDiff(c.hash)} sx={{ display: 'flex', gap: 1, cursor: 'pointer', borderRadius: 1, p: 0.75, '&:hover': { bgcolor: 'action.hover' }, position: 'relative' }}>
                      {i < commits.length - 1 && <Box sx={{ position: 'absolute', left: 14, top: 20, bottom: -10, width: 2, bgcolor: 'divider', zIndex: 0 }} />}
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.8, flexShrink: 0, zIndex: 1 }} />
                      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                        <Typography variant="body2" noWrap fontWeight={500}>{c.subject}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" color="text.secondary" noWrap>{c.authorName}</Typography>
                          <Typography variant="caption" color="text.disabled">{new Date(c.date).toLocaleDateString()}</Typography>
                          <Chip label={c.short} size="small" variant="outlined" sx={{ height: 16, fontSize: 10, fontFamily: 'monospace' }} />
                        </Stack>
                        {c.refs && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {c.refs.split(',').map(r => r.trim()).filter(Boolean).map(r => (
                              <Chip key={r} label={r} size="small" color={r.includes('HEAD') ? 'primary' : 'default'} sx={{ height: 16, fontSize: 10 }} />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {historyTab === 2 && (
                <Box sx={{ p: 1.5, flex: 1, overflow: 'auto' }}>
                  <StashPanel repoPath={repoPath} onRefresh={() => { loadStatus(); loadBasicInfo(); }} />
                </Box>
              )}
            </Box>

            {/* RIGHT — diff viewer */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#0d1117' }}>
              <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <Typography variant="caption" fontFamily="monospace" color="rgba(255,255,255,0.5)">
                  {diffTitle ? `diff: ${diffTitle}` : 'Select a file to view diff'}
                </Typography>
                {diffContent && <IconButton size="small" onClick={() => { setDiffContent(''); setDiffTitle(''); }} sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5 }}>✕</IconButton>}
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <DiffViewer diff={diffContent} />
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <BranchDialog open={branchOpen} onClose={() => setBranchOpen(false)} onDone={doCreateBranch} />
      <RemoteDialog open={remoteOpen} onClose={() => setRemoteOpen(false)} onDone={doAddRemote} />
      <Menu anchorEl={branchMenuEl} open={Boolean(branchMenuEl)} onClose={() => setBranchMenuEl(null)}>
        <MenuItem onClick={() => { doCheckoutBranch(branchMenuTarget); setBranchMenuEl(null); }}><CheckIcon fontSize="small" sx={{ mr: 1 }} />Checkout</MenuItem>
        <MenuItem onClick={() => { doMerge(branchMenuTarget); setBranchMenuEl(null); }}><MergeIcon fontSize="small" sx={{ mr: 1 }} />Merge into {branches.current}</MenuItem>
        <MenuItem onClick={() => { doDeleteBranch(branchMenuTarget); setBranchMenuEl(null); }} sx={{ color: 'error.main' }}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />Delete</MenuItem>
      </Menu>
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)} variant="filled">{toast.msg}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}

// ─── Create View ──────────────────────────────────────────────────────────────

function CreateView({ onBack, onCreated, pathOptions }: { onBack: () => void; onCreated: (repo: ManagedRepo) => void; pathOptions: PathOption[] }) {
  const [isClone, setIsClone] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [repoPathInput, setRepoPathInput] = useState('');
  const [repoName, setRepoName] = useState('');
  const [useHttpsCreds, setUseHttpsCreds] = useState(false);
  const [gitUser, setGitUser] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (isClone && cloneUrl && !repoName) {
      const guessed = cloneUrl.split('/').pop()?.replace(/\.git$/, '') || '';
      if (guessed) setRepoName(guessed);
    }
  }, [cloneUrl, isClone]);

  const isHttps = cloneUrl.startsWith('http://') || cloneUrl.startsWith('https://');

  const handleCreate = async () => {
    if (!repoPath.trim()) { setErr('Repository path is required'); return; }
    setBusy(true); setErr('');
    try {
      if (isClone) {
        if (!cloneUrl.trim()) { setErr('Clone URL is required'); setBusy(false); return; }
        const r = await gitApi.clone(
          cloneUrl.trim(),
          repoPath.trim(),
          repoName.trim() || undefined,
          useHttpsCreds && isHttps ? token : undefined,
          useHttpsCreds && isHttps ? gitUser : undefined,
        );
        const finalPath = r.path;
        const name = repoName.trim() || cloneUrl.split('/').pop()?.replace(/\.git$/, '') || 'repo';
        await gitApi.addRepo(name, finalPath, cloneUrl.trim());
        onCreated({ name, path: finalPath, cloneUrl: cloneUrl.trim() });
      } else {
        const finalPath = repoPath.trim();
        const name = repoName.trim() || finalPath.split('/').pop() || 'repo';
        const check = await gitApi.isRepo(finalPath);
        if (!check.isRepo) await gitApi.init(finalPath);
        await gitApi.addRepo(name, finalPath);
        onCreated({ name, path: finalPath });
      }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 680, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton size="small" onClick={onBack}><ArrowBackIcon fontSize="small" /></IconButton>
        <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer' }} onClick={onBack}>Repositories</Typography>
        <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        <Typography variant="subtitle1" fontWeight={700}>Create Repository</Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={3}>
          {err && <Alert severity="error">{err}</Alert>}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Clone a Repository</Typography>
              <Typography variant="caption" color="text.secondary">
                {isClone ? 'Cloning from an existing remote URL' : 'Creating a new empty repository or registering an existing one'}
              </Typography>
            </Box>
            <Switch checked={isClone} onChange={e => setIsClone(e.target.checked)} />
          </Box>

          {isClone && (
            <Stack spacing={2}>
              <TextField
                label="Clone URL" value={cloneUrl} onChange={e => setCloneUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git  or  git@github.com:user/repo.git"
                fullWidth size="small" helperText="Supports HTTPS and SSH URLs"
              />
              {isHttps && (
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Checkbox size="small" checked={useHttpsCreds} onChange={e => setUseHttpsCreds(e.target.checked)} sx={{ p: 0 }} />
                    <Typography variant="body2">Provide HTTPS credentials (private repositories)</Typography>
                  </Stack>
                  {useHttpsCreds && (
                    <Stack spacing={1.5} sx={{ pl: 3.5 }}>
                      <Alert severity="info" sx={{ py: 0.5 }}>Use a personal access token as the password for GitHub / GitLab.</Alert>
                      <TextField label="Git username" value={gitUser} onChange={e => setGitUser(e.target.value)} size="small" fullWidth />
                      <TextField label="Personal access token" type="password" value={token} onChange={e => setToken(e.target.value)} size="small" fullWidth />
                    </Stack>
                  )}
                </Box>
              )}
              {cloneUrl.startsWith('git@') && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  SSH clone requires an SSH key to be configured on the server. Add your public key to your Git provider.
                </Alert>
              )}
            </Stack>
          )}

          <Autocomplete
            freeSolo size="small" options={pathOptions}
            getOptionLabel={o => (typeof o === 'string' ? o : o.path)}
            groupBy={o => (typeof o === 'string' ? '' : o.kind === 'domain' ? 'Domains' : 'Home')}
            inputValue={repoPathInput}
            onInputChange={(_, v) => { setRepoPathInput(v); setRepoPath(v); }}
            onChange={(_, v) => { if (v && typeof v !== 'string') { setRepoPathInput(v.path); setRepoPath(v.path); } }}
            renderOption={(props, o) => (
              <li {...props} key={typeof o === 'string' ? o : o.path}>
                {typeof o === 'string' ? o : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {o.kind === 'domain' ? <LanguageIcon sx={{ fontSize: 16 }} /> : <FolderOpenIcon sx={{ fontSize: 16 }} />}
                    <Box>
                      <Typography variant="body2">{o.label}</Typography>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">{o.path}</Typography>
                    </Box>
                  </Stack>
                )}
              </li>
            )}
            renderInput={params => (
              <TextField
                {...params} label="Repository Path"
                helperText={isClone ? 'Parent directory where the repository will be cloned' : 'Path to initialize or register as a managed repository'}
                InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><FolderOpenIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
              />
            )}
          />

          <TextField
            label="Repository Name" value={repoName} onChange={e => setRepoName(e.target.value)}
            placeholder="Display name shown in the repository list"
            fullWidth size="small"
          />

          <Stack direction="row" spacing={1.5}>
            <Button onClick={onBack} disabled={busy}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate} disabled={busy || !repoPath.trim() || (isClone && !cloneUrl.trim())}>
              {busy ? <CircularProgress size={18} /> : isClone ? 'Clone' : 'Create'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

// ─── Repository List View ─────────────────────────────────────────────────────

function ListViewPage({ onManage, onCreate }: { onManage: (repo: ManagedRepo) => void; onCreate: () => void }) {
  const [repos, setRepos] = useState<ManagedRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try { const r = await gitApi.listRepos(); setRepos(r.repos); } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRepos(); }, [loadRepos]);

  const doRemove = async (repo: ManagedRepo) => {
    if (!confirm(`Remove "${repo.name}"?\n\nThis will permanently DELETE the repository folder and all its files from disk. This cannot be undone.`)) return;
    setRemoving(repo.path);
    try { await gitApi.removeRepo(repo.path); setToast({ msg: 'Removed from management', sev: 'success' }); loadRepos(); }
    catch (e: any) { setToast({ msg: e.message, sev: 'error' }); }
    finally { setRemoving(null); }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 980, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <AccountTreeIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>Git™ Version Control</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh"><IconButton onClick={loadRepos}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>Create</Button>
        </Stack>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Manage Git repositories hosted on this server. Click <strong>Create</strong> to clone a remote repository or initialize a new one.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : repos.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <GitHubIcon sx={{ fontSize: 56, opacity: 0.15, mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No repositories yet</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            Clone a remote repository, initialize a new one, or add an existing directory.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>Create Repository</Button>
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Repository</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Repository Path</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Branch</TableCell>
                <TableCell align="right" sx={{ py: 1.5 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {repos.map(repo => (
                <TableRow key={repo.path} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccountTreeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{repo.name}</Typography>
                        {repo.cloneUrl && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 240 }}>{repo.cloneUrl}</Typography>
                        )}
                      </Box>
                      {repo.isCloning && <Chip label="Cloning…" size="small" color="info" />}
                      {repo.cloneError && <Chip label="Clone failed" size="small" color="error" title={repo.cloneError} />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{repo.path}</Typography>
                  </TableCell>
                  <TableCell>
                    {repo.currentBranch && (
                      <Chip size="small" icon={<CallSplitIcon sx={{ fontSize: 12 }} />} label={repo.currentBranch} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => onManage(repo)} disabled={repo.isCloning}>Manage</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => doRemove(repo)} disabled={removing === repo.path}>
                        {removing === repo.path ? <CircularProgress size={14} /> : 'Remove'}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} variant="filled">{toast.msg}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}

// ─── Page Root ────────────────────────────────────────────────────────────────

export default function GitPage() {
  const [view, setView] = useState<View>('list');
  const [selectedRepo, setSelectedRepo] = useState<ManagedRepo | null>(null);
  const [pathOptions, setPathOptions] = useState<PathOption[]>([]);

  useEffect(() => {
    gitApi.listPaths().then(r => setPathOptions(r.paths)).catch(() => {});
  }, []);

  return (
    <DashboardLayout>
      {view === 'list' && (
        <ListViewPage
          onManage={repo => { setSelectedRepo(repo); setView('manage'); }}
          onCreate={() => setView('create')}
        />
      )}
      {view === 'create' && (
        <CreateView
          onBack={() => setView('list')}
          onCreated={repo => { setSelectedRepo(repo); setView('manage'); }}
          pathOptions={pathOptions}
        />
      )}
      {view === 'manage' && selectedRepo && (
        <ManageView
          repo={selectedRepo}
          onBack={() => setView('list')}
        />
      )}
    </DashboardLayout>
  );
}
