import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
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
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
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
import CallSplitIcon from '@mui/icons-material/CallSplit';
import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CircleIcon from '@mui/icons-material/Circle';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import HistoryIcon from '@mui/icons-material/History';
import KeyIcon from '@mui/icons-material/Key';
import LanguageIcon from '@mui/icons-material/Language';
import MergeIcon from '@mui/icons-material/Merge';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import UndoIcon from '@mui/icons-material/Undo';
import { gitApi, Commit, GitStatus, PathOption } from '../api/git';

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
          <Box
            key={i}
            sx={{
              display: 'flex',
              bgcolor: bg,
              '&:hover': { filter: 'brightness(0.96)' },
            }}
          >
            {/* Line numbers */}
            {line.type !== 'hunk' && line.type !== 'meta' && (
              <Box sx={{ display: 'flex', minWidth: 72, flexShrink: 0, userSelect: 'none', borderRight: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ width: 36, textAlign: 'right', pr: 0.5, color: 'text.disabled', fontSize: 11 }}>
                  {line.lineOld ?? ''}
                </Box>
                <Box sx={{ width: 36, textAlign: 'right', pr: 0.5, color: 'text.disabled', fontSize: 11 }}>
                  {line.lineNew ?? ''}
                </Box>
              </Box>
            )}
            <Box
              sx={{
                pl: 1,
                pr: 2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color,
                flexGrow: 1,
                ...(line.type === 'hunk' || line.type === 'meta' ? { fontStyle: 'italic' } : {}),
              }}
            >
              {line.type !== 'meta' ? `${prefix}${line.content}` : line.content}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileLabel(entry: string): string {
  return entry.slice(2).trim();
}

function statusBadgeColor(ch: string): string {
  const map: Record<string, string> = {
    M: '#ff9800', A: '#4caf50', D: '#f44336', R: '#2196f3',
    C: '#9c27b0', U: '#ff5722', '?': '#607d8b',
  };
  return map[ch.toUpperCase()] || '#9e9e9e';
}

// ─── Clone Dialog ─────────────────────────────────────────────────────────────

function CloneDialog({ open, repoRoot, onClose, onDone }: {
  open: boolean; repoRoot: string; onClose: () => void; onDone: (path: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    if (!url.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await gitApi.clone(url.trim(), repoRoot, name.trim() || undefined);
      onDone(r.path);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Clone Repository</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="Repository URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/user/repo.git" fullWidth size="small" />
          <TextField label="Directory name (optional)" value={name} onChange={e => setName(e.target.value)} placeholder="Leave blank to use repo name" fullWidth size="small" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={run} variant="contained" disabled={busy || !url.trim()}>
          {busy ? <CircularProgress size={18} /> : 'Clone'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Branch Dialog ────────────────────────────────────────────────────────────

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

// ─── Credentials Dialog ───────────────────────────────────────────────────────

function CredDialog({ open, path, onClose, onSaved }: { open: boolean; path: string; onClose: () => void; onSaved: () => void }) {
  const [gitUser, setGitUser] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await gitApi.setCred(path, gitUser.trim(), token.trim());
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><KeyIcon />HTTPS Credentials</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <Typography variant="caption" color="text.secondary">Stored securely for push/pull over HTTPS. Use a GitHub/GitLab personal access token as the password.</Typography>
          <TextField label="Git username" value={gitUser} onChange={e => setGitUser(e.target.value)} fullWidth size="small" />
          <TextField label="Personal access token" type="password" value={token} onChange={e => setToken(e.target.value)} fullWidth size="small" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={save} variant="contained" disabled={busy || !gitUser || !token}>{busy ? <CircularProgress size={18} /> : 'Save'}</Button>
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

  const doPop = async (ref?: string) => {
    try { await gitApi.stashPop(repoPath, ref); load(); onRefresh(); } catch { }
  };

  const doDrop = async (ref: string) => {
    try { await gitApi.stashDrop(repoPath, ref); load(); } catch { }
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
                <Tooltip title="Pop"><IconButton size="small" onClick={() => doPop(s.ref)}><RestoreIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Drop"><IconButton size="small" onClick={() => doDrop(s.ref)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GitPage() {
  // ── state ──────────────────────────────────────────────────────────────────
  const [repoPath, setRepoPath] = useState('');
  const [repoPathInput, setRepoPathInput] = useState('');
  const [isRepo, setIsRepo] = useState(false);
  const [pathOptions, setPathOptions] = useState<PathOption[]>([]);

  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<{ current: string; local: string[]; remote: string[] }>({ current: '', local: [], remote: [] });
  const [remotes, setRemotes] = useState<Record<string, { fetch: string; push: string }>>({});

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [diffContent, setDiffContent] = useState('');
  const [diffTitle, setDiffTitle] = useState('');
  const [commitMsg, setCommitMsg] = useState('');

  // Load path suggestions once on mount
  useEffect(() => {
    gitApi.listPaths().then(r => setPathOptions(r.paths)).catch(() => {});
  }, []);

  const [tab, setTab] = useState(0); // 0 = Changes, 1 = History, 2 = Stash
  const [loading, setLoading] = useState(false);
  const [opBusy, setOpBusy] = useState(false);

  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, sev: 'success' | 'error' | 'info' = 'success') => setToast({ msg, sev });

  // Dialogs
  const [cloneOpen, setCloneOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);

  // Branch menu
  const [branchMenuEl, setBranchMenuEl] = useState<null | HTMLElement>(null);
  const [branchMenuTarget, setBranchMenuTarget] = useState('');

  // ── data loading ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async (path = repoPath) => {
    if (!path) return;
    setLoading(true);
    try {
      const [s, b, r] = await Promise.all([
        gitApi.status(path),
        gitApi.branches(path),
        gitApi.remotes(path),
      ]);
      setStatus(s);
      setBranches({ current: b.current, local: b.local, remote: b.remote });
      setRemotes(r.remotes);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [repoPath]);

  const loadCommits = useCallback(async (path = repoPath) => {
    if (!path) return;
    try {
      const r = await gitApi.log(path, 80);
      setCommits(r.commits);
    } catch { }
  }, [repoPath]);

  useEffect(() => {
    if (tab === 1 && repoPath) loadCommits();
  }, [tab, repoPath, loadCommits]);

  // ── open repo ──────────────────────────────────────────────────────────────

  const openRepo = async (path?: string) => {
    const p = (path ?? repoPathInput).trim();
    if (!p) return;
    setLoading(true);
    try {
      const r = await gitApi.isRepo(p);
      setIsRepo(r.isRepo);
      setRepoPath(p);
      if (r.isRepo) {
        await loadAll(p);
      } else {
        setStatus(null); setBranches({ current: '', local: [], remote: [] }); setRemotes({});
      }
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const initRepo = async () => {
    if (!repoPath) return;
    setOpBusy(true);
    try {
      await gitApi.init(repoPath);
      showToast('Repository initialised');
      await openRepo(repoPath);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  // ── staging / diff ─────────────────────────────────────────────────────────

  const showDiff = async (file: string, staged: boolean) => {
    try {
      const r = staged
        ? await gitApi.diffStaged(repoPath, file)
        : await gitApi.diff(repoPath, file);
      setDiffContent(r.diff);
      setDiffTitle(file);
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const showCommitDiff = async (hash: string) => {
    try {
      const r = await gitApi.diffCommit(repoPath, hash);
      setDiffContent(r.diff); setDiffTitle(hash.slice(0, 7));
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const toggleSelect = (entry: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(entry)) next.delete(entry); else next.add(entry);
      return next;
    });
  };

  const doAdd = async () => {
    setOpBusy(true);
    try {
      const files = selectedFiles.size > 0 ? [...selectedFiles].map(fileLabel) : [];
      await gitApi.add(repoPath, files);
      showToast('Staged');
      await loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doUnstage = async (file?: string) => {
    setOpBusy(true);
    try {
      await gitApi.unstage(repoPath, file ? [file] : []);
      showToast('Unstaged'); await loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doDiscard = async (file: string) => {
    if (!confirm(`Discard changes to ${file}?`)) return;
    setOpBusy(true);
    try {
      await gitApi.discard(repoPath, [file]);
      showToast('Discarded'); await loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doStageAll = async () => {
    setOpBusy(true);
    try { await gitApi.add(repoPath, []); showToast('All changes staged'); await loadAll(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    setOpBusy(true);
    try {
      await gitApi.commit(repoPath, commitMsg.trim());
      showToast('Committed!'); setCommitMsg(''); await loadAll();
      if (tab === 1) loadCommits();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  // ── push / pull ────────────────────────────────────────────────────────────

  const doPull = async () => {
    setOpBusy(true);
    try {
      const r = await gitApi.pull(repoPath);
      showToast(r.output || 'Pulled successfully');
      await loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doPush = async () => {
    setOpBusy(true);
    try {
      const r = await gitApi.push(repoPath);
      showToast(r.output || 'Pushed successfully');
      await loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  // ── branches ──────────────────────────────────────────────────────────────

  const doCheckout = async (branch: string) => {
    setOpBusy(true);
    try { await gitApi.checkout(repoPath, branch); showToast(`Switched to ${branch}`); await loadAll(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doCreateBranch = async (name: string, from?: string) => {
    setOpBusy(true);
    try { await gitApi.createBranch(repoPath, name, from); showToast(`Branch "${name}" created`); await loadAll(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doDeleteBranch = async (branch: string) => {
    if (!confirm(`Delete branch "${branch}"?`)) return;
    setOpBusy(true);
    try { await gitApi.deleteBranch(repoPath, branch); showToast(`Deleted "${branch}"`); await loadAll(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  const doMerge = async (branch: string) => {
    if (!confirm(`Merge "${branch}" into "${branches.current}"?`)) return;
    setOpBusy(true);
    try { await gitApi.merge(repoPath, branch); showToast('Merged'); await loadAll(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  // ── add remote ────────────────────────────────────────────────────────────

  const doAddRemote = async (name: string, url: string) => {
    setOpBusy(true);
    try { await gitApi.addRemote(repoPath, name, url); showToast('Remote added'); await loadAll(); }
    catch (e: any) { showToast(e.message, 'error'); }
    finally { setOpBusy(false); }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const hasChanges = status && (status.staged.length + status.unstaged.length + status.untracked.length > 0);

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', bgcolor: 'background.default' }}>

        {/* ── Top Bar ── */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
          <GitHubIcon sx={{ color: 'text.secondary' }} />
          <Typography variant="h6" fontWeight={600} sx={{ mr: 1 }}>Git</Typography>
          <Autocomplete
            freeSolo
            size="small"
            options={pathOptions}
            getOptionLabel={o => (typeof o === 'string' ? o : o.path)}
            groupBy={o => (typeof o === 'string' ? '' : o.kind === 'domain' ? 'Domains' : 'Home')}
            inputValue={repoPathInput}
            onInputChange={(_, v) => setRepoPathInput(v)}
            onChange={(_, v) => {
              if (v && typeof v !== 'string') {
                setRepoPathInput(v.path);
                openRepo(v.path);
              }
            }}
            renderOption={(props, o) => (
              <li {...props} key={typeof o === 'string' ? o : o.path}>
                {typeof o === 'string' ? o : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {o.kind === 'domain' ? <LanguageIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> : <FolderOpenIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                    <Box>
                      <Typography variant="body2">{o.label}</Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>{o.path}</Typography>
                    </Box>
                  </Stack>
                )}
              </li>
            )}
            renderInput={params => (
              <TextField
                {...params}
                placeholder="Repository path or pick from list"
                onKeyDown={e => e.key === 'Enter' && openRepo()}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <InputAdornment position="start"><FolderOpenIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                }}
              />
            )}
            sx={{ width: 380 }}
          />
          <Button variant="contained" size="small" onClick={() => openRepo()} disabled={loading || !repoPathInput.trim()}>Open</Button>
          <Button variant="outlined" size="small" startIcon={<CloudDownloadIcon />} onClick={() => setCloneOpen(true)}>Clone</Button>
          {repoPath && !isRepo && (
            <Button variant="outlined" size="small" color="warning" onClick={initRepo} disabled={opBusy}>Init Repo Here</Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {repoPath && isRepo && (
            <Stack direction="row" spacing={1} alignItems="center">
              {status && (
                <>
                  {status.ahead > 0 && <Chip size="small" icon={<ArrowUpwardIcon sx={{ fontSize: 14 }} />} label={`${status.ahead} ahead`} color="info" variant="outlined" />}
                  {status.behind > 0 && <Chip size="small" icon={<ArrowDownwardIcon sx={{ fontSize: 14 }} />} label={`${status.behind} behind`} color="warning" variant="outlined" />}
                </>
              )}
              <Chip size="small" icon={<AccountTreeIcon sx={{ fontSize: 14 }} />} label={branches.current || '—'} variant="outlined" />
              <Tooltip title="Pull"><IconButton size="small" onClick={doPull} disabled={opBusy}><CloudDownloadIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Push"><IconButton size="small" onClick={doPush} disabled={opBusy}><CloudUploadIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Refresh"><IconButton size="small" onClick={() => loadAll()} disabled={loading}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="HTTPS Credentials"><IconButton size="small" onClick={() => setCredOpen(true)}><KeyIcon fontSize="small" /></IconButton></Tooltip>
            </Stack>
          )}
        </Box>

        {!repoPath ? (
          // ── Welcome screen ──────────────────────────────────────────────────
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 3, color: 'text.secondary' }}>
            <GitHubIcon sx={{ fontSize: 64, opacity: 0.2 }} />
            <Typography variant="h6" fontWeight={400} color="text.secondary">Open a repository to get started</Typography>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<FolderOpenIcon />} onClick={() => repoPathInput && openRepo()}>Open Folder</Button>
              <Button variant="outlined" startIcon={<CloudDownloadIcon />} onClick={() => setCloneOpen(true)}>Clone Repository</Button>
            </Stack>
          </Box>
        ) : !isRepo ? (
          // ── Not a repo ──────────────────────────────────────────────────────
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 }}>
            <Typography color="text.secondary">"{repoPath}" is not a Git repository.</Typography>
            <Button variant="contained" onClick={initRepo} disabled={opBusy}>Initialize Repository</Button>
          </Box>
        ) : (
          // ── Main 3-column layout ────────────────────────────────────────────
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* ━━━ LEFT PANEL ━━━ */}
            <Box sx={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', overflow: 'auto', bgcolor: 'background.paper' }}>

              {/* Branches */}
              <Box sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Branches</Typography>
                  <Tooltip title="New branch"><IconButton size="small" onClick={() => setBranchOpen(true)}><AddIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                </Stack>
                <List dense disablePadding>
                  {branches.local.map(b => (
                    <ListItem key={b} disablePadding dense
                      secondaryAction={b !== branches.current && (
                        <IconButton size="small" edge="end" onClick={e => { e.stopPropagation(); setBranchMenuEl(e.currentTarget); setBranchMenuTarget(b); }}>
                          <MoreVertIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}>
                      <ListItemButton
                        dense
                        selected={b === branches.current}
                        onClick={() => b !== branches.current && doCheckout(b)}
                        sx={{ borderRadius: 1, py: 0.5 }}
                      >
                        {b === branches.current && <CircleIcon sx={{ fontSize: 8, mr: 0.8, color: 'success.main' }} />}
                        <ListItemText primary={b} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>

                {/* Remote branches */}
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

              {/* Remotes */}
              <Box sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Remotes</Typography>
                  <Tooltip title="Add remote"><IconButton size="small" onClick={() => setRemoteOpen(true)}><AddIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                </Stack>
                {Object.keys(remotes).length === 0 ? (
                  <Typography variant="caption" color="text.disabled">No remotes</Typography>
                ) : (
                  Object.entries(remotes).map(([name, r]) => (
                    <Box key={name} sx={{ mb: 0.5 }}>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <SyncAltIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" fontWeight={600}>{name}</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 2.5, wordBreak: 'break-all', fontSize: 10 }}>{r.fetch}</Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Box>

            {/* ━━━ MIDDLE PANEL ━━━ */}
            <Box sx={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }} variant="fullWidth">
                <Tab label="Changes" sx={{ minHeight: 40, fontSize: 12 }} />
                <Tab label="History" sx={{ minHeight: 40, fontSize: 12 }} />
                <Tab label="Stash" sx={{ minHeight: 40, fontSize: 12 }} />
              </Tabs>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={28} /></Box>
              ) : tab === 0 ? (
                // ── Changes tab ──────────────────────────────────────────────
                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                  <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                    {/* Staged */}
                    {status && status.staged.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={700} color="success.main">STAGED ({status.staged.length})</Typography>
                          <Button size="small" sx={{ fontSize: 11, py: 0, minWidth: 0 }} onClick={() => doUnstage()}>Unstage all</Button>
                        </Stack>
                        {status.staged.map(entry => {
                          const ch = entry[0];
                          const file = fileLabel(entry);
                          return (
                            <Stack key={entry} direction="row" alignItems="center" sx={{ borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }}
                              onClick={() => showDiff(file, true)}>
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

                    {/* Unstaged */}
                    {status && status.unstaged.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={700} color="warning.main">MODIFIED ({status.unstaged.length})</Typography>
                          <Button size="small" sx={{ fontSize: 11, py: 0, minWidth: 0 }} onClick={doStageAll}>Stage all</Button>
                        </Stack>
                        {status.unstaged.map(entry => {
                          const ch = entry[0];
                          const file = fileLabel(entry);
                          return (
                            <Stack key={entry} direction="row" alignItems="center" sx={{ borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }}
                              onClick={() => showDiff(file, false)}>
                              <Checkbox size="small" checked={selectedFiles.has(entry)} onClick={e => { e.stopPropagation(); toggleSelect(entry); }} sx={{ p: 0.5 }} />
                              <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: statusBadgeColor(ch), display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 0.5, flexShrink: 0 }}>
                                <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{ch}</Typography>
                              </Box>
                              <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>{file}</Typography>
                              <Stack direction="row">
                                <Tooltip title="Stage"><IconButton size="small" onClick={e => { e.stopPropagation(); gitApi.add(repoPath, [file]).then(() => loadAll()); }}><PlaylistAddCheckIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                <Tooltip title="Discard"><IconButton size="small" onClick={e => { e.stopPropagation(); doDiscard(file); }}><DeleteOutlineIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                              </Stack>
                            </Stack>
                          );
                        })}
                      </Box>
                    )}

                    {/* Untracked */}
                    {status && status.untracked.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 0.5, mb: 0.5, display: 'block' }}>UNTRACKED ({status.untracked.length})</Typography>
                        {status.untracked.map(file => (
                          <Stack key={file} direction="row" alignItems="center" sx={{ borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                            <Checkbox size="small" checked={selectedFiles.has(`? ${file}`)} onClick={() => toggleSelect(`? ${file}`)} sx={{ p: 0.5 }} />
                            <Typography variant="caption" noWrap sx={{ flexGrow: 1, color: 'text.disabled' }}>{file}</Typography>
                            <Tooltip title="Stage"><IconButton size="small" onClick={() => gitApi.add(repoPath, [file]).then(() => loadAll())}><PlaylistAddCheckIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                          </Stack>
                        ))}
                      </Box>
                    )}

                    {(!hasChanges) && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4, color: 'text.disabled', gap: 0.5 }}>
                        <CheckIcon sx={{ opacity: 0.3, fontSize: 40 }} />
                        <Typography variant="caption">Working tree clean</Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Commit area */}
                  <Box sx={{ flexShrink: 0, p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Button size="small" variant="outlined" fullWidth={false} sx={{ fontSize: 11 }} onClick={doStageAll} disabled={opBusy}><PlaylistAddCheckIcon sx={{ fontSize: 14, mr: 0.5 }} />Stage All</Button>
                    </Stack>
                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      maxRows={4}
                      fullWidth
                      placeholder="Commit message…"
                      value={commitMsg}
                      onChange={e => setCommitMsg(e.target.value)}
                      sx={{ mb: 1 }}
                    />
                    <Button variant="contained" fullWidth size="small" onClick={doCommit}
                      disabled={opBusy || !commitMsg.trim() || !status?.staged.length}>
                      {opBusy ? <CircularProgress size={16} /> : `Commit to ${branches.current || 'main'}`}
                    </Button>
                  </Box>
                </Box>
              ) : tab === 1 ? (
                // ── History tab ──────────────────────────────────────────────
                <Box sx={{ overflow: 'auto', flex: 1, p: 1 }}>
                  {commits.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                      <Typography variant="caption" color="text.secondary">No commits yet</Typography>
                    </Box>
                  ) : commits.map((c, i) => (
                    <Box key={c.hash}
                      onClick={() => showCommitDiff(c.hash)}
                      sx={{ display: 'flex', gap: 1, cursor: 'pointer', borderRadius: 1, p: 0.75, '&:hover': { bgcolor: 'action.hover' }, position: 'relative' }}>
                      {/* Timeline line */}
                      {i < commits.length - 1 && (
                        <Box sx={{ position: 'absolute', left: 14, top: 20, bottom: -10, width: 2, bgcolor: 'divider', zIndex: 0 }} />
                      )}
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.8, flexShrink: 0, zIndex: 1, boxShadow: '0 0 0 2px', boxShadowColor: 'background.paper' }} />
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
              ) : (
                // ── Stash tab ────────────────────────────────────────────────
                <Box sx={{ p: 1.5, flex: 1, overflow: 'auto' }}>
                  <StashPanel repoPath={repoPath} onRefresh={() => loadAll()} />
                </Box>
              )}
            </Box>

            {/* ━━━ RIGHT PANEL — Diff Viewer ━━━ */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#0d1117' }}>
              <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <Typography variant="caption" fontFamily="monospace" color="rgba(255,255,255,0.5)">
                  {diffTitle ? `diff: ${diffTitle}` : 'Select a file to view diff'}
                </Typography>
                {diffContent && (
                  <IconButton size="small" onClick={() => { setDiffContent(''); setDiffTitle(''); }} sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5 }}>✕</IconButton>
                )}
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <DiffViewer diff={diffContent} />
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Dialogs ── */}
      <CloneDialog
        open={cloneOpen}
        repoRoot={repoPath || '.'}
        onClose={() => setCloneOpen(false)}
        onDone={p => { setCloneOpen(false); setRepoPathInput(p); openRepo(p); }}
      />
      <BranchDialog open={branchOpen} onClose={() => setBranchOpen(false)} onDone={doCreateBranch} />
      <RemoteDialog open={remoteOpen} onClose={() => setRemoteOpen(false)} onDone={doAddRemote} />
      <CredDialog open={credOpen} path={repoPath} onClose={() => setCredOpen(false)} onSaved={() => showToast('Credentials saved')} />

      {/* Branch context menu */}
      <Menu anchorEl={branchMenuEl} open={Boolean(branchMenuEl)} onClose={() => setBranchMenuEl(null)}>
        <MenuItem onClick={() => { doCheckout(branchMenuTarget); setBranchMenuEl(null); }}>
          <CheckIcon fontSize="small" sx={{ mr: 1 }} />Checkout
        </MenuItem>
        <MenuItem onClick={() => { doMerge(branchMenuTarget); setBranchMenuEl(null); }}>
          <MergeIcon fontSize="small" sx={{ mr: 1 }} />Merge into {branches.current}
        </MenuItem>
        <MenuItem onClick={() => { doDeleteBranch(branchMenuTarget); setBranchMenuEl(null); }} sx={{ color: 'error.main' }}>
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />Delete
        </MenuItem>
      </Menu>

      {/* Toast */}
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)} variant="filled">{toast.msg}</Alert> : <span />}
      </Snackbar>
    </DashboardLayout>
  );
}
