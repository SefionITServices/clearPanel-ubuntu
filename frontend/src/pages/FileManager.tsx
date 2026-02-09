import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Breadcrumbs,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  IconButton,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  LinearProgress,
  Snackbar,
  InputAdornment,
  Chip,
  FormGroup,
  FormLabel,
} from '@mui/material';
import {
  Folder,
  InsertDriveFile,
  Download,
  Delete,
  CreateNewFolder,
  Upload,
  DriveFileMove,
  Archive,
  Edit,
  ContentCopy,
  ContentPaste,
  ContentCut,
  Search,
  Lock,
  Info,
  NoteAdd,
  Unarchive,
  Compress,
  FolderOpen,
  Home,
  VisibilityOff,
  Visibility,
  Close,
  Save,
  ArrowUpward,
  Image as ImageIcon,
  Code as CodeIcon,
  Description,
} from '@mui/icons-material';
import { filesAPI, FileItem } from '../api/files';
import { DashboardLayout } from '../layouts/dashboard/layout';

// ---------- helpers ----------

type SortKey = 'name' | 'size' | 'modified' | 'permissions';
type SortDir = 'asc' | 'desc';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function isArchive(name: string): boolean {
  const ext = getFileExtension(name);
  return ['zip', 'tar', 'gz', 'tgz', 'tar.gz', 'bz2'].includes(ext) || name.endsWith('.tar.gz');
}

function isImage(name: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(getFileExtension(name));
}

function isEditable(name: string): boolean {
  const ext = getFileExtension(name);
  const editable = [
    'txt', 'md', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'yml', 'yaml',
    'sh', 'bash', 'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'conf', 'cfg',
    'ini', 'env', 'log', 'sql', 'csv', 'htaccess', 'nginx', 'toml', 'lock', 'gitignore',
    'dockerfile', 'makefile', 'vue', 'svelte',
  ];
  if (editable.includes(ext)) return true;
  // Files without extension are often editable (e.g. Makefile, Dockerfile)
  if (!ext && name !== '') return true;
  return false;
}

function getMonacoLanguage(name: string): string {
  const ext = getFileExtension(name);
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    json: 'json', html: 'html', htm: 'html', css: 'css', xml: 'xml',
    md: 'markdown', py: 'python', rb: 'ruby', php: 'php', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', rs: 'rust', go: 'go',
    sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml', sql: 'sql',
    ini: 'ini', toml: 'ini', conf: 'plaintext', log: 'plaintext',
    txt: 'plaintext', csv: 'plaintext', env: 'plaintext',
  };
  return map[ext] || 'plaintext';
}

function permOctalToRwx(octal: string): boolean[] {
  // returns 9 booleans: owner r,w,x, group r,w,x, other r,w,x
  const digits = octal.padStart(3, '0').split('').map(Number);
  const result: boolean[] = [];
  for (const d of digits) {
    result.push(!!(d & 4), !!(d & 2), !!(d & 1));
  }
  return result;
}

function rwxToOctal(perms: boolean[]): string {
  let result = '';
  for (let i = 0; i < 3; i++) {
    const base = i * 3;
    const val = (perms[base] ? 4 : 0) + (perms[base + 1] ? 2 : 0) + (perms[base + 2] ? 1 : 0);
    result += val.toString();
  }
  return result;
}

// ---------- Lazy Monaco import ----------
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

// ==========================================================
// FileManager
// ==========================================================

export default function FileManagerPage() {
  // Core state
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Disk usage
  const [diskUsage, setDiskUsage] = useState<{ total: number; used: number; available: number } | null>(null);

  // Clipboard (copy / cut)
  const [clipboard, setClipboard] = useState<{ paths: string[]; mode: 'copy' | 'cut' } | null>(null);

  // Dialogs
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [createFileName, setCreateFileName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDest, setMoveDest] = useState('');
  const [chmodOpen, setChmodOpen] = useState(false);
  const [chmodTarget, setChmodTarget] = useState('');
  const [chmodPerms, setChmodPerms] = useState<boolean[]>(Array(9).fill(false));
  const [chmodOctal, setChmodOctal] = useState('644');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPath, setEditorPath] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('plaintext');
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoData, setInfoData] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractArchive, setExtractArchive] = useState('');
  const [extractDest, setExtractDest] = useState('');
  const [compressOpen, setCompressOpen] = useState(false);
  const [compressDest, setCompressDest] = useState('');
  const [compressFormat, setCompressFormat] = useState<'zip' | 'tar.gz'>('zip');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [goToPathOpen, setGoToPathOpen] = useState(false);
  const [goToPathValue, setGoToPathValue] = useState('');

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ mouseX: number; mouseY: number; item: FileItem | null } | null>(null);

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // ---- data fetching ----

  const loadFiles = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await filesAPI.list(p);
      setItems(data.items || []);
      setCurrentPath(p);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDiskUsage = useCallback(async () => {
    try {
      const data = await filesAPI.diskUsage();
      setDiskUsage({ total: data.total, used: data.used, available: data.available });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadFiles(currentPath);
    void loadDiskUsage();
  }, []);

  const refresh = () => void loadFiles(currentPath);

  const navigate = (p: string) => void loadFiles(p);

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    navigate(parts.join('/'));
  };

  // ---- sorting & filtering ----

  const filteredItems = showHidden ? items : items.filter((it) => !it.name.startsWith('.'));

  const sortedItems = [...filteredItems].sort((a, b) => {
    // Always directories first
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'size': cmp = a.size - b.size; break;
      case 'modified': cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime(); break;
      case 'permissions': cmp = a.permissions.localeCompare(b.permissions); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ---- selection ----

  const handleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === sortedItems.length) setSelected(new Set());
    else setSelected(new Set(sortedItems.map((it) => it.name)));
  };

  const selectedPaths = () =>
    Array.from(selected).map((name) => (currentPath ? `${currentPath}/${name}` : name));

  // ---- actions ----

  const handleMkdir = async () => {
    if (!mkdirName) return;
    try {
      await filesAPI.mkdir(currentPath, mkdirName);
      setMkdirOpen(false);
      setMkdirName('');
      setSuccessMsg('Folder created');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  const handleCreateFile = async () => {
    if (!createFileName) return;
    try {
      const p = currentPath ? `${currentPath}/${createFileName}` : createFileName;
      await filesAPI.create(p);
      setCreateFileOpen(false);
      setCreateFileName('');
      setSuccessMsg('File created');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  const handleRename = async () => {
    if (!renameNewName || !renameTarget) return;
    try {
      const targetPath = currentPath ? `${currentPath}/${renameTarget}` : renameTarget;
      await filesAPI.rename(targetPath, renameNewName);
      setRenameOpen(false);
      setRenameTarget('');
      setRenameNewName('');
      setSuccessMsg('Renamed');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
    try {
      await filesAPI.delete(selectedPaths());
      setSuccessMsg(`Deleted ${selected.size} item(s)`);
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  const handleUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      await filesAPI.upload(currentPath, Array.from(files) as File[]);
      setSuccessMsg(`Uploaded ${files.length} file(s)`);
      refresh();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleDownload = (name: string) => {
    const p = currentPath ? `${currentPath}/${name}` : name;
    window.open(filesAPI.downloadURL(p), '_blank');
  };

  const handleDownloadSelected = async () => {
    if (selected.size === 1) {
      const name = Array.from(selected)[0];
      const item = items.find((i) => i.name === name);
      if (item?.type === 'file') {
        handleDownload(name);
        return;
      }
    }
    // Multiple or directory: create zip
    try {
      const blob = await filesAPI.archive(selectedPaths(), 'selected.zip');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selected.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message); }
  };

  // Clipboard operations
  const handleCopy = () => {
    setClipboard({ paths: selectedPaths(), mode: 'copy' });
    setSuccessMsg(`${selected.size} item(s) copied to clipboard`);
  };

  const handleCut = () => {
    setClipboard({ paths: selectedPaths(), mode: 'cut' });
    setSuccessMsg(`${selected.size} item(s) cut to clipboard`);
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    try {
      if (clipboard.mode === 'copy') {
        await filesAPI.copy(clipboard.paths, currentPath || '.');
      } else {
        await filesAPI.move(clipboard.paths, currentPath || '.');
        setClipboard(null);
      }
      setSuccessMsg('Paste completed');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  // Move dialog
  const handleMoveSubmit = async () => {
    if (!moveDest) return;
    try {
      await filesAPI.move(selectedPaths(), moveDest);
      setMoveOpen(false);
      setMoveDest('');
      setSuccessMsg('Moved');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  // Chmod
  const openChmod = (item: FileItem) => {
    const p = currentPath ? `${currentPath}/${item.name}` : item.name;
    setChmodTarget(p);
    const perms = permOctalToRwx(item.permissions);
    setChmodPerms(perms);
    setChmodOctal(item.permissions);
    setChmodOpen(true);
  };

  const handleChmodSubmit = async () => {
    try {
      await filesAPI.chmod(chmodTarget, chmodOctal);
      setChmodOpen(false);
      setSuccessMsg('Permissions updated');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  // Editor
  const openEditor = async (name: string) => {
    const p = currentPath ? `${currentPath}/${name}` : name;
    try {
      const data = await filesAPI.read(p);
      setEditorPath(p);
      setEditorContent(data.content);
      setEditorLanguage(getMonacoLanguage(name));
      setEditorDirty(false);
      setEditorOpen(true);
    } catch (e: any) { setError(e.message); }
  };

  const handleEditorSave = async () => {
    setEditorSaving(true);
    try {
      await filesAPI.write(editorPath, editorContent);
      setEditorSaving(false);
      setEditorDirty(false);
      setSuccessMsg('File saved');
    } catch (e: any) {
      setEditorSaving(false);
      setError(e.message);
    }
  };

  // Info / properties
  const openInfo = async (item: FileItem) => {
    const p = currentPath ? `${currentPath}/${item.name}` : item.name;
    try {
      const data = await filesAPI.info(p);
      setInfoData(data);
      setInfoOpen(true);
    } catch (e: any) { setError(e.message); }
  };

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const data = await filesAPI.search(currentPath, searchQuery);
      setSearchResults(data.results || []);
    } catch (e: any) { setError(e.message); }
    setSearchLoading(false);
  };

  // Extract
  const openExtract = (name: string) => {
    const p = currentPath ? `${currentPath}/${name}` : name;
    setExtractArchive(p);
    setExtractDest(currentPath || '.');
    setExtractOpen(true);
  };

  const handleExtract = async () => {
    try {
      await filesAPI.extract(extractArchive, extractDest);
      setExtractOpen(false);
      setSuccessMsg('Archive extracted');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  // Compress
  const handleCompress = async () => {
    if (!compressDest) return;
    try {
      await filesAPI.compress(selectedPaths(), compressDest, compressFormat);
      setCompressOpen(false);
      setCompressDest('');
      setSuccessMsg('Compression completed');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  // Image preview
  const openPreview = (name: string) => {
    const p = currentPath ? `${currentPath}/${name}` : name;
    setPreviewUrl(filesAPI.getRawUrl(p));
    setPreviewName(name);
    setPreviewOpen(true);
  };

  // Double-click
  const handleDoubleClick = (item: FileItem) => {
    if (item.type === 'directory') {
      navigate(currentPath ? `${currentPath}/${item.name}` : item.name);
    } else if (isImage(item.name)) {
      openPreview(item.name);
    } else if (isEditable(item.name)) {
      openEditor(item.name);
    } else {
      handleDownload(item.name);
    }
  };

  // Go-to path
  const handleGoToPath = () => {
    navigate(goToPathValue.replace(/^\/+/, ''));
    setGoToPathOpen(false);
    setGoToPathValue('');
  };

  // ---- context menu ----

  const handleContextMenu = (e: React.MouseEvent, item: FileItem | null) => {
    e.preventDefault();
    setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY, item });
  };

  const closeCtxMenu = () => setCtxMenu(null);

  const ctxAction = (fn: () => void) => {
    closeCtxMenu();
    fn();
  };

  // ---- drag & drop ----

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when dialogs are open or focus is in input
      if (editorOpen || mkdirOpen || createFileOpen || renameOpen || searchOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Delete' && selected.size > 0) { e.preventDefault(); handleDelete(); }
      if (e.key === 'F2' && selected.size === 1) {
        e.preventDefault();
        const name = Array.from(selected)[0];
        setRenameTarget(name);
        setRenameNewName(name);
        setRenameOpen(true);
      }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); handleSelectAll(); }
      if (e.ctrlKey && e.key === 'c') { e.preventDefault(); handleCopy(); }
      if (e.ctrlKey && e.key === 'x') { e.preventDefault(); handleCut(); }
      if (e.ctrlKey && e.key === 'v') { e.preventDefault(); handlePaste(); }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorOpen, mkdirOpen, createFileOpen, renameOpen, searchOpen, selected, items, clipboard, currentPath]);

  // ---- breadcrumbs ----
  const pathParts = currentPath ? currentPath.split('/') : [];

  // ---- render ----
  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h4">File Manager</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={<Switch size="small" checked={showHidden} onChange={(_, v) => setShowHidden(v)} />}
              label={<Typography variant="body2">Hidden files</Typography>}
            />
          </Stack>
        </Stack>

        {/* Disk usage bar */}
        {diskUsage && diskUsage.total > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Disk: {formatSize(diskUsage.used)} / {formatSize(diskUsage.total)} used
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatSize(diskUsage.available)} free
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min((diskUsage.used / diskUsage.total) * 100, 100)}
              sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
              color={diskUsage.used / diskUsage.total > 0.9 ? 'error' : diskUsage.used / diskUsage.total > 0.7 ? 'warning' : 'primary'}
            />
          </Box>
        )}

        {/* Toolbar */}
        <Paper sx={{ p: 1, mb: 2 }}>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Tooltip title="Go up"><span>
              <IconButton size="small" onClick={navigateUp} disabled={!currentPath}><ArrowUpward fontSize="small" /></IconButton>
            </span></Tooltip>
            <Tooltip title="Home"><span>
              <IconButton size="small" onClick={() => navigate('')}><Home fontSize="small" /></IconButton>
            </span></Tooltip>
            <Tooltip title="Go to path">
              <IconButton size="small" onClick={() => { setGoToPathValue(currentPath); setGoToPathOpen(true); }}>
                <FolderOpen fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={refresh}>
                <Search fontSize="small" sx={{ transform: 'rotate(0deg)' }} />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="New File">
              <IconButton size="small" onClick={() => setCreateFileOpen(true)}><NoteAdd fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="New Folder">
              <IconButton size="small" onClick={() => setMkdirOpen(true)}><CreateNewFolder fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Upload Files">
              <IconButton size="small" component="label">
                <Upload fontSize="small" />
                <input type="file" hidden multiple onChange={(e) => e.target.files && handleUpload(e.target.files)} />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Copy (Ctrl+C)"><span>
              <IconButton size="small" disabled={selected.size === 0} onClick={handleCopy}><ContentCopy fontSize="small" /></IconButton>
            </span></Tooltip>
            <Tooltip title="Cut (Ctrl+X)"><span>
              <IconButton size="small" disabled={selected.size === 0} onClick={handleCut}><ContentCut fontSize="small" /></IconButton>
            </span></Tooltip>
            <Tooltip title="Paste (Ctrl+V)"><span>
              <IconButton size="small" disabled={!clipboard} onClick={handlePaste}><ContentPaste fontSize="small" /></IconButton>
            </span></Tooltip>
            {clipboard && (
              <Chip
                label={`${clipboard.paths.length} ${clipboard.mode === 'copy' ? 'copied' : 'cut'}`}
                size="small"
                onDelete={() => setClipboard(null)}
                sx={{ alignSelf: 'center' }}
              />
            )}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Move to..."><span>
              <IconButton size="small" disabled={selected.size === 0} onClick={() => setMoveOpen(true)}>
                <DriveFileMove fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Download"><span>
              <IconButton size="small" disabled={selected.size === 0} onClick={handleDownloadSelected}>
                <Download fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Compress"><span>
              <IconButton size="small" disabled={selected.size === 0} onClick={() => {
                const ext = compressFormat === 'tar.gz' ? '.tar.gz' : '.zip';
                setCompressDest(currentPath ? `${currentPath}/archive${ext}` : `archive${ext}`);
                setCompressOpen(true);
              }}>
                <Compress fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Delete (Del)"><span>
              <IconButton size="small" disabled={selected.size === 0} color="error" onClick={handleDelete}>
                <Delete fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Search (Ctrl+F)">
              <IconButton size="small" onClick={() => setSearchOpen(true)}><Search fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Paper>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
        )}

        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component="button" variant="body1" underline="hover" onClick={() => navigate('')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Home fontSize="small" /> Home
          </Link>
          {pathParts.map((part, idx) => {
            const partialPath = pathParts.slice(0, idx + 1).join('/');
            return (
              <Link key={idx} component="button" variant="body1" underline="hover"
                onClick={() => navigate(partialPath)}>
                {part}
              </Link>
            );
          })}
        </Breadcrumbs>

        {/* Drag & Drop Zone + Table */}
        <Box
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            position: 'relative',
            border: dragOver ? '2px dashed' : '2px solid transparent',
            borderColor: dragOver ? 'primary.main' : 'transparent',
            borderRadius: 2,
            transition: 'border-color 0.2s',
          }}
          onContextMenu={(e) => handleContextMenu(e, null)}
        >
          {dragOver && (
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(25, 118, 210, 0.08)', borderRadius: 2,
              pointerEvents: 'none',
            }}>
              <Stack alignItems="center">
                <Upload sx={{ fontSize: 48, color: 'primary.main' }} />
                <Typography color="primary" variant="h6">Drop files to upload</Typography>
              </Stack>
            </Box>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ width: 42 }}>
                      <Checkbox
                        size="small"
                        checked={sortedItems.length > 0 && selected.size === sortedItems.length}
                        indeterminate={selected.size > 0 && selected.size < sortedItems.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>
                      <TableSortLabel active={sortKey === 'name'} direction={sortKey === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                        Name
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ width: 100 }}>
                      <TableSortLabel active={sortKey === 'size'} direction={sortKey === 'size' ? sortDir : 'asc'} onClick={() => handleSort('size')}>
                        Size
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ width: 180 }}>
                      <TableSortLabel active={sortKey === 'modified'} direction={sortKey === 'modified' ? sortDir : 'asc'} onClick={() => handleSort('modified')}>
                        Modified
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ width: 80 }}>
                      <TableSortLabel active={sortKey === 'permissions'} direction={sortKey === 'permissions' ? sortDir : 'asc'} onClick={() => handleSort('permissions')}>
                        Perms
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ width: 100 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">This folder is empty</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedItems.map((item) => {
                    const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;
                    return (
                      <TableRow
                        key={item.name}
                        hover
                        selected={selected.has(item.name)}
                        onDoubleClick={() => handleDoubleClick(item)}
                        onContextMenu={(e) => { handleSelect(item.name); handleContextMenu(e, item); }}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.has(item.name)} onChange={() => handleSelect(item.name)} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {item.type === 'directory' ? (
                              <Folder fontSize="small" color="primary" />
                            ) : isImage(item.name) ? (
                              <ImageIcon fontSize="small" color="secondary" />
                            ) : isArchive(item.name) ? (
                              <Archive fontSize="small" color="warning" />
                            ) : isEditable(item.name) ? (
                              <CodeIcon fontSize="small" color="info" />
                            ) : (
                              <InsertDriveFile fontSize="small" />
                            )}
                            {item.type === 'directory' ? (
                              <Link component="button" variant="body2" underline="hover"
                                onClick={(e) => { e.stopPropagation(); navigate(fullPath); }}>
                                {item.name}
                              </Link>
                            ) : (
                              <Typography variant="body2">{item.name}</Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.type === 'file' ? formatSize(item.size) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(item.modified).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                            {item.permissions}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0}>
                            {item.type === 'file' && isEditable(item.name) && (
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditor(item.name); }}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {item.type === 'file' && isImage(item.name) && (
                              <Tooltip title="Preview">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openPreview(item.name); }}>
                                  <ImageIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {item.type === 'file' && isArchive(item.name) && (
                              <Tooltip title="Extract">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openExtract(item.name); }}>
                                  <Unarchive fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {item.type === 'file' && (
                              <Tooltip title="Download">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }}>
                                  <Download fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* Status bar */}
        <Stack direction="row" justifyContent="space-between" mt={1}>
          <Typography variant="body2" color="text.secondary">
            {sortedItems.length} item(s){showHidden ? '' : ` (${items.length - sortedItems.length} hidden)`}
            {selected.size > 0 ? ` \u00B7 ${selected.size} selected` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            /{currentPath || '~'}
          </Typography>
        </Stack>

        {/* ===================== CONTEXT MENU ===================== */}
        <Menu
          open={ctxMenu !== null}
          onClose={closeCtxMenu}
          anchorReference="anchorPosition"
          anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        >
          {ctxMenu?.item && [
            ctxMenu.item.type === 'directory' && (
              <MenuItem key="open" onClick={() => ctxAction(() => navigate(currentPath ? `${currentPath}/${ctxMenu.item!.name}` : ctxMenu.item!.name))}>
                <ListItemIcon><FolderOpen fontSize="small" /></ListItemIcon>
                <ListItemText>Open</ListItemText>
              </MenuItem>
            ),
            ctxMenu.item.type === 'file' && isEditable(ctxMenu.item.name) && (
              <MenuItem key="edit" onClick={() => ctxAction(() => openEditor(ctxMenu.item!.name))}>
                <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            ),
            ctxMenu.item.type === 'file' && isImage(ctxMenu.item.name) && (
              <MenuItem key="preview" onClick={() => ctxAction(() => openPreview(ctxMenu.item!.name))}>
                <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Preview</ListItemText>
              </MenuItem>
            ),
            ctxMenu.item.type === 'file' && (
              <MenuItem key="download" onClick={() => ctxAction(() => handleDownload(ctxMenu.item!.name))}>
                <ListItemIcon><Download fontSize="small" /></ListItemIcon>
                <ListItemText>Download</ListItemText>
              </MenuItem>
            ),
            ctxMenu.item.type === 'file' && isArchive(ctxMenu.item.name) && (
              <MenuItem key="extract" onClick={() => ctxAction(() => openExtract(ctxMenu.item!.name))}>
                <ListItemIcon><Unarchive fontSize="small" /></ListItemIcon>
                <ListItemText>Extract</ListItemText>
              </MenuItem>
            ),
            <Divider key="d1" />,
            <MenuItem key="rename" onClick={() => ctxAction(() => {
              setRenameTarget(ctxMenu.item!.name);
              setRenameNewName(ctxMenu.item!.name);
              setRenameOpen(true);
            })}>
              <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
              <ListItemText>Rename</ListItemText>
            </MenuItem>,
            <MenuItem key="copy" onClick={() => ctxAction(() => {
              const p = currentPath ? `${currentPath}/${ctxMenu.item!.name}` : ctxMenu.item!.name;
              setClipboard({ paths: [p], mode: 'copy' });
              setSuccessMsg('Copied to clipboard');
            })}>
              <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
              <ListItemText>Copy</ListItemText>
            </MenuItem>,
            <MenuItem key="cut" onClick={() => ctxAction(() => {
              const p = currentPath ? `${currentPath}/${ctxMenu.item!.name}` : ctxMenu.item!.name;
              setClipboard({ paths: [p], mode: 'cut' });
              setSuccessMsg('Cut to clipboard');
            })}>
              <ListItemIcon><ContentCut fontSize="small" /></ListItemIcon>
              <ListItemText>Cut</ListItemText>
            </MenuItem>,
            <Divider key="d2" />,
            <MenuItem key="chmod" onClick={() => ctxAction(() => openChmod(ctxMenu.item!))}>
              <ListItemIcon><Lock fontSize="small" /></ListItemIcon>
              <ListItemText>Permissions</ListItemText>
            </MenuItem>,
            <MenuItem key="info" onClick={() => ctxAction(() => openInfo(ctxMenu.item!))}>
              <ListItemIcon><Info fontSize="small" /></ListItemIcon>
              <ListItemText>Properties</ListItemText>
            </MenuItem>,
            <Divider key="d3" />,
            <MenuItem key="delete" onClick={() => ctxAction(() => {
              const p = currentPath ? `${currentPath}/${ctxMenu.item!.name}` : ctxMenu.item!.name;
              if (window.confirm(`Delete "${ctxMenu.item!.name}"?`)) {
                filesAPI.delete([p]).then(() => { setSuccessMsg('Deleted'); refresh(); }).catch((e: any) => setError(e.message));
              }
            })}>
              <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
              <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
            </MenuItem>,
          ]}
          {/* Background context menu (no item clicked) */}
          {!ctxMenu?.item && [
            <MenuItem key="newfile" onClick={() => ctxAction(() => setCreateFileOpen(true))}>
              <ListItemIcon><NoteAdd fontSize="small" /></ListItemIcon>
              <ListItemText>New File</ListItemText>
            </MenuItem>,
            <MenuItem key="newfolder" onClick={() => ctxAction(() => setMkdirOpen(true))}>
              <ListItemIcon><CreateNewFolder fontSize="small" /></ListItemIcon>
              <ListItemText>New Folder</ListItemText>
            </MenuItem>,
            clipboard && (
              <MenuItem key="paste" onClick={() => ctxAction(handlePaste)}>
                <ListItemIcon><ContentPaste fontSize="small" /></ListItemIcon>
                <ListItemText>Paste ({clipboard.paths.length})</ListItemText>
              </MenuItem>
            ),
            <Divider key="d1" />,
            <MenuItem key="upload" component="label" onClick={closeCtxMenu}>
              <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
              <ListItemText>Upload</ListItemText>
              <input type="file" hidden multiple onChange={(e) => e.target.files && handleUpload(e.target.files)} />
            </MenuItem>,
            <MenuItem key="refresh" onClick={() => ctxAction(refresh)}>
              <ListItemIcon><Search fontSize="small" /></ListItemIcon>
              <ListItemText>Refresh</ListItemText>
            </MenuItem>,
          ]}
        </Menu>

        {/* ===================== DIALOGS ===================== */}

        {/* Create Folder */}
        <Dialog open={mkdirOpen} onClose={() => setMkdirOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Folder Name" fullWidth
              value={mkdirName} onChange={(e) => setMkdirName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleMkdir(); }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMkdirOpen(false)}>Cancel</Button>
            <Button onClick={handleMkdir} variant="contained">Create</Button>
          </DialogActions>
        </Dialog>

        {/* Create File */}
        <Dialog open={createFileOpen} onClose={() => setCreateFileOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Create New File</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="File Name" fullWidth placeholder="e.g. index.html"
              value={createFileName} onChange={(e) => setCreateFileName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFile(); }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateFileOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFile} variant="contained">Create</Button>
          </DialogActions>
        </Dialog>

        {/* Rename */}
        <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Rename "{renameTarget}"</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="New Name" fullWidth
              value={renameNewName} onChange={(e) => setRenameNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} variant="contained">Rename</Button>
          </DialogActions>
        </Dialog>

        {/* Move */}
        <Dialog open={moveOpen} onClose={() => setMoveOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Move {selected.size} item(s)</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Destination path" fullWidth placeholder="e.g. public_html/images"
              value={moveDest} onChange={(e) => setMoveDest(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleMoveSubmit(); }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button onClick={handleMoveSubmit} variant="contained">Move</Button>
          </DialogActions>
        </Dialog>

        {/* Chmod */}
        <Dialog open={chmodOpen} onClose={() => setChmodOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Change Permissions</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" mb={2}>{chmodTarget}</Typography>
            <TextField
              label="Octal mode"
              value={chmodOctal}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-7]/g, '').slice(0, 3);
                setChmodOctal(val);
                if (val.length === 3) setChmodPerms(permOctalToRwx(val));
              }}
              sx={{ mb: 2, width: 120 }}
              inputProps={{ maxLength: 3, style: { fontFamily: 'monospace', fontSize: 18 } }}
            />
            {(['Owner', 'Group', 'Other'] as const).map((label, gi) => (
              <Box key={label} sx={{ mb: 1 }}>
                <FormLabel component="legend" sx={{ fontSize: 13 }}>{label}</FormLabel>
                <FormGroup row>
                  {(['Read', 'Write', 'Execute'] as const).map((perm, pi) => {
                    const idx = gi * 3 + pi;
                    return (
                      <FormControlLabel key={perm} label={perm}
                        control={
                          <Checkbox size="small" checked={chmodPerms[idx]}
                            onChange={(_, checked) => {
                              const next = [...chmodPerms];
                              next[idx] = checked;
                              setChmodPerms(next);
                              setChmodOctal(rwxToOctal(next));
                            }}
                          />
                        }
                      />
                    );
                  })}
                </FormGroup>
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChmodOpen(false)}>Cancel</Button>
            <Button onClick={handleChmodSubmit} variant="contained">Apply</Button>
          </DialogActions>
        </Dialog>

        {/* Extract */}
        <Dialog open={extractOpen} onClose={() => setExtractOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Extract Archive</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" mb={1}>Archive: {extractArchive}</Typography>
            <TextField autoFocus margin="dense" label="Extract to" fullWidth
              value={extractDest} onChange={(e) => setExtractDest(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleExtract(); }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExtractOpen(false)}>Cancel</Button>
            <Button onClick={handleExtract} variant="contained" startIcon={<Unarchive />}>Extract</Button>
          </DialogActions>
        </Dialog>

        {/* Compress */}
        <Dialog open={compressOpen} onClose={() => setCompressOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Compress {selected.size} item(s)</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Destination file" fullWidth
                value={compressDest} onChange={(e) => setCompressDest(e.target.value)} />
              <Stack direction="row" spacing={1}>
                <Button variant={compressFormat === 'zip' ? 'contained' : 'outlined'} size="small"
                  onClick={() => {
                    setCompressFormat('zip');
                    setCompressDest((d) => d.replace(/\.(zip|tar\.gz)$/, '.zip'));
                  }}>ZIP</Button>
                <Button variant={compressFormat === 'tar.gz' ? 'contained' : 'outlined'} size="small"
                  onClick={() => {
                    setCompressFormat('tar.gz');
                    setCompressDest((d) => d.replace(/\.(zip|tar\.gz)$/, '.tar.gz'));
                  }}>TAR.GZ</Button>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCompressOpen(false)}>Cancel</Button>
            <Button onClick={handleCompress} variant="contained" startIcon={<Compress />}>Compress</Button>
          </DialogActions>
        </Dialog>

        {/* Go-to Path */}
        <Dialog open={goToPathOpen} onClose={() => setGoToPathOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Go to Path</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Path" fullWidth placeholder="e.g. public_html/css"
              value={goToPathValue} onChange={(e) => setGoToPathValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGoToPath(); }}
              InputProps={{ startAdornment: <InputAdornment position="start">/</InputAdornment> }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGoToPathOpen(false)}>Cancel</Button>
            <Button onClick={handleGoToPath} variant="contained">Go</Button>
          </DialogActions>
        </Dialog>

        {/* Properties / Info */}
        <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Properties</DialogTitle>
          <DialogContent>
            {infoData && (
              <Table size="small">
                <TableBody>
                  {([
                    ['Name', infoData.name],
                    ['Type', infoData.type],
                    ['Size', formatSize(infoData.size)],
                    ['Permissions', infoData.permissions],
                    ['Owner UID', infoData.owner],
                    ['Group GID', infoData.group],
                    ['Modified', new Date(infoData.modified).toLocaleString()],
                    ['Path', infoData.path],
                  ] as [string, any][]).map(([label, value]) => (
                    <TableRow key={label}>
                      <TableCell sx={{ fontWeight: 600, width: 120 }}>{label}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{String(value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInfoOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Search */}
        <Dialog open={searchOpen} onClose={() => { setSearchOpen(false); setSearchResults([]); setSearchQuery(''); }} maxWidth="sm" fullWidth>
          <DialogTitle>Search Files</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Search query" fullWidth placeholder="File or folder name..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSearch} disabled={searchLoading} edge="end">
                      {searchLoading ? <CircularProgress size={20} /> : <Search />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {searchResults.length > 0 && (
              <TableContainer sx={{ maxHeight: 300, mt: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Path</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Size</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchResults.map((r, i) => (
                      <TableRow key={i} hover sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          const dir = r.type === 'directory' ? r.path : r.path.split('/').slice(0, -1).join('/');
                          navigate(dir);
                          setSearchOpen(false);
                          setSearchResults([]);
                          setSearchQuery('');
                        }}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {r.type === 'directory' ? <Folder fontSize="small" color="primary" /> : <InsertDriveFile fontSize="small" />}
                            <Typography variant="body2">{r.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{r.path}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{r.type}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{r.type === 'file' ? formatSize(r.size) : '-'}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {searchResults.length === 0 && searchQuery && !searchLoading && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                No results found
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setSearchOpen(false); setSearchResults([]); setSearchQuery(''); }}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Image Preview */}
        <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">{previewName}</Typography>
              <IconButton onClick={() => setPreviewOpen(false)}><Close /></IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center' }}>
            <Box
              component="img"
              src={previewUrl}
              alt={previewName}
              sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          </DialogContent>
        </Dialog>

        {/* ===================== CODE EDITOR (fullscreen dialog) ===================== */}
        <Dialog open={editorOpen} onClose={() => { if (editorDirty && !window.confirm('Unsaved changes will be lost. Close?')) return; setEditorOpen(false); }}
          fullScreen>
          <DialogTitle sx={{ py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CodeIcon />
              <Typography variant="subtitle1" fontFamily="monospace">{editorPath}</Typography>
              {editorDirty && <Chip label="Modified" size="small" color="warning" />}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={editorSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                disabled={editorSaving || !editorDirty} onClick={handleEditorSave}>
                Save
              </Button>
              <Button variant="outlined" onClick={() => { if (editorDirty && !window.confirm('Unsaved changes will be lost. Close?')) return; setEditorOpen(false); }}>
                Close
              </Button>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
            <React.Suspense fallback={<Box display="flex" justifyContent="center" alignItems="center" height="100%"><CircularProgress /></Box>}>
              <MonacoEditor
                height="100%"
                language={editorLanguage}
                value={editorContent}
                onChange={(val) => { setEditorContent(val || ''); setEditorDirty(true); }}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  minimap: { enabled: true },
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </React.Suspense>
          </DialogContent>
        </Dialog>

        {/* ===================== SNACKBAR ===================== */}
        <Snackbar
          open={!!successMsg}
          autoHideDuration={3000}
          onClose={() => setSuccessMsg(null)}
          message={successMsg}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </DashboardLayout>
  );
}
