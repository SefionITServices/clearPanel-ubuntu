import React, { useEffect, useState, useCallback } from 'react';
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
} from '@mui/icons-material';
import { filesAPI, FileItem } from '../api/files';
import { DashboardLayout } from '../layouts/dashboard/layout';

export default function FileManagerPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await filesAPI.list(path);
      setItems(data.items || []);
      setCurrentPath(path);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles(currentPath);
  }, []);

  const navigate = (path: string) => {
    void loadFiles(path);
  };

  const handleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((it) => it.name)));
    }
  };

  const handleMkdir = async () => {
    if (!mkdirName) return;
    try {
      await filesAPI.mkdir(currentPath, mkdirName);
      setMkdirOpen(false);
      setMkdirName('');
      void loadFiles(currentPath);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRename = async () => {
    if (!renameNewName || !renameTarget) return;
    try {
      const targetPath = currentPath ? `${currentPath}/${renameTarget}` : renameTarget;
      await filesAPI.rename(targetPath, renameNewName);
      setRenameOpen(false);
      setRenameTarget('');
      setRenameNewName('');
      void loadFiles(currentPath);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} item(s)?`)) return;
    const paths = Array.from(selected).map((name) =>
      currentPath ? `${currentPath}/${name}` : name
    );
    try {
      await filesAPI.delete(paths);
      void loadFiles(currentPath);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadOpen(false);
    setLoading(true);
    try {
      await filesAPI.upload(currentPath, Array.from(files));
      void loadFiles(currentPath);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleDownload = (name: string) => {
    const path = currentPath ? `${currentPath}/${name}` : name;
    window.open(filesAPI.downloadURL(path), '_blank');
  };

  const handleArchive = async () => {
    if (selected.size === 0) return;
    const paths = Array.from(selected).map((name) =>
      currentPath ? `${currentPath}/${name}` : name
    );
    try {
      const blob = await filesAPI.archive(paths, 'selected.zip');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selected.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const pathParts = currentPath ? currentPath.split('/') : [];

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">File Manager</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<CreateNewFolder />}
            onClick={() => setMkdirOpen(true)}
          >
            New Folder
          </Button>
          <Button
            variant="contained"
            component="label"
            startIcon={<Upload />}
          >
            Upload
            <input
              type="file"
              hidden
              multiple
              onChange={(e) => handleUpload(e.target.files)}
            />
          </Button>
          {selected.size > 0 && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={handleDelete}
              >
                Delete ({selected.size})
              </Button>
              <Button
                variant="outlined"
                startIcon={<Archive />}
                onClick={handleArchive}
              >
                Download ZIP
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component="button" variant="body1" onClick={() => navigate('')}>
          Root
        </Link>
        {pathParts.map((part, idx) => {
          const partialPath = pathParts.slice(0, idx + 1).join('/');
          return (
            <Link
              key={idx}
              component="button"
              variant="body1"
              onClick={() => navigate(partialPath)}
            >
              {part}
            </Link>
          );
        })}
      </Breadcrumbs>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={items.length > 0 && selected.size === items.length}
                    indeterminate={selected.size > 0 && selected.size < items.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;
                return (
                  <TableRow key={item.name} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(item.name)}
                        onChange={() => handleSelect(item.name)}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {item.type === 'directory' ? <Folder color="primary" /> : <InsertDriveFile />}
                        {item.type === 'directory' ? (
                          <Link
                            component="button"
                            variant="body1"
                            onClick={() => navigate(fullPath)}
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <Typography>{item.name}</Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {item.type === 'file' ? `${(item.size / 1024).toFixed(1)} KB` : '-'}
                    </TableCell>
                    <TableCell>{new Date(item.modified).toLocaleString()}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {item.type === 'file' && (
                          <IconButton size="small" onClick={() => handleDownload(item.name)}>
                            <Download fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => {
                            setRenameTarget(item.name);
                            setRenameNewName(item.name);
                            setRenameOpen(true);
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={mkdirOpen} onClose={() => setMkdirOpen(false)}>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            value={mkdirName}
            onChange={(e) => setMkdirName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleMkdir();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMkdirOpen(false)}>Cancel</Button>
          <Button onClick={handleMkdir} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)}>
        <DialogTitle>Rename</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New Name"
            fullWidth
            value={renameNewName}
            onChange={(e) => setRenameNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button onClick={handleRename} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </DashboardLayout>
  );
}
