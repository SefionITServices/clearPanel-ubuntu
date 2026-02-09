import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Paper,
  Button,
  Breadcrumbs,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
  Checkbox,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Upload as UploadIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  ContentCut as CutIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Compress as CompressIcon,
  Code as CodeIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';

interface FileItem {
  name: string;
  type: 'folder' | 'file';
  size?: string;
  modified: string;
  permissions: string;
  extension?: string;
}

interface FileManagerProps {
  onClose: () => void;
}

export function FileManager({ onClose }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState(['home', 'hadm751']);
  const [selected, setSelected] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [contextFile, setContextFile] = useState<string | null>(null);

  const files: FileItem[] = [
    { name: 'public_html', type: 'folder', modified: '2024-02-08 14:30', permissions: '0755' },
    { name: 'www', type: 'folder', modified: '2024-02-07 10:15', permissions: '0755' },
    { name: 'logs', type: 'folder', modified: '2024-02-08 09:20', permissions: '0755' },
    { name: 'mail', type: 'folder', modified: '2024-02-05 16:45', permissions: '0755' },
    { name: 'tmp', type: 'folder', modified: '2024-02-08 08:00', permissions: '0755' },
    { name: '.htaccess', type: 'file', size: '2.4 KB', modified: '2024-02-06 12:30', permissions: '0644', extension: 'htaccess' },
    { name: 'index.php', type: 'file', size: '15.2 KB', modified: '2024-02-08 11:20', permissions: '0644', extension: 'php' },
    { name: 'config.json', type: 'file', size: '1.8 KB', modified: '2024-02-07 15:10', permissions: '0644', extension: 'json' },
    { name: 'style.css', type: 'file', size: '8.5 KB', modified: '2024-02-08 13:45', permissions: '0644', extension: 'css' },
    { name: 'banner.jpg', type: 'file', size: '245 KB', modified: '2024-02-05 09:30', permissions: '0644', extension: 'jpg' },
    { name: 'backup.zip', type: 'file', size: '125 MB', modified: '2024-02-04 22:15', permissions: '0644', extension: 'zip' },
  ];

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(files.map((f) => f.name));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>, fileName: string) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setContextFile(fileName);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setContextFile(null);
  };

  const handleDoubleClick = (file: FileItem) => {
    if (file.type === 'folder') {
      setCurrentPath([...currentPath, file.name]);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') {
      return <FolderIcon sx={{ color: '#FFA726', fontSize: 28 }} />;
    }

    switch (file.extension) {
      case 'jpg':
      case 'png':
      case 'gif':
      case 'svg':
        return <ImageIcon sx={{ color: '#66BB6A', fontSize: 28 }} />;
      case 'php':
      case 'js':
      case 'html':
      case 'css':
      case 'json':
        return <CodeIcon sx={{ color: '#42A5F5', fontSize: 28 }} />;
      case 'zip':
      case 'tar':
      case 'gz':
        return <CompressIcon sx={{ color: '#AB47BC', fontSize: 28 }} />;
      default:
        return <DescriptionIcon sx={{ color: '#78909C', fontSize: 28 }} />;
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            File Manager
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Toolbar */}
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0', p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            sx={{ textTransform: 'none' }}
          >
            Upload
          </Button>
          <Button
            variant="outlined"
            startIcon={<CreateNewFolderIcon />}
            sx={{ textTransform: 'none' }}
          >
            New Folder
          </Button>
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            disabled={selected.length === 0}
            sx={{ textTransform: 'none' }}
          >
            Copy
          </Button>
          <Button
            variant="outlined"
            startIcon={<CutIcon />}
            disabled={selected.length === 0}
            sx={{ textTransform: 'none' }}
          >
            Move
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            disabled={selected.length === 0}
            color="error"
            sx={{ textTransform: 'none' }}
          >
            Delete
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={selected.length === 0}
            sx={{ textTransform: 'none' }}
          >
            Download
          </Button>
        </Box>

        {/* Breadcrumbs */}
        <Breadcrumbs>
          <Link
            component="button"
            variant="body2"
            onClick={() => setCurrentPath(['home', 'hadm751'])}
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'primary.main',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <HomeIcon sx={{ mr: 0.5, fontSize: 20 }} />
            Home
          </Link>
          {currentPath.slice(2).map((path, index) => (
            <Link
              key={index}
              component="button"
              variant="body2"
              onClick={() => handleBreadcrumbClick(index + 2)}
              sx={{
                textDecoration: 'none',
                color: 'primary.main',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {path}
            </Link>
          ))}
        </Breadcrumbs>
      </Box>

      {/* File List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < files.length}
                      checked={selected.length === files.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Modified</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Permissions</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map((file) => (
                  <TableRow
                    key={file.name}
                    hover
                    onDoubleClick={() => handleDoubleClick(file)}
                    sx={{
                      cursor: file.type === 'folder' ? 'pointer' : 'default',
                      bgcolor: selected.includes(file.name) ? 'action.selected' : 'inherit',
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.includes(file.name)}
                        onChange={() => handleSelect(file.name)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {getFileIcon(file)}
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {file.name}
                          </Typography>
                          {file.type === 'folder' && (
                            <Typography variant="caption" color="text.secondary">
                              Folder
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {file.size || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {file.modified}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={file.permissions}
                        size="small"
                        sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => handleContextMenu(e, file.name)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        <MenuItem onClick={handleCloseMenu}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Rename
        </MenuItem>
        <MenuItem onClick={handleCloseMenu}>
          <CopyIcon sx={{ mr: 1, fontSize: 20 }} />
          Copy
        </MenuItem>
        <MenuItem onClick={handleCloseMenu}>
          <CutIcon sx={{ mr: 1, fontSize: 20 }} />
          Move
        </MenuItem>
        <MenuItem onClick={handleCloseMenu}>
          <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
          Download
        </MenuItem>
        <MenuItem onClick={handleCloseMenu} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Status Bar */}
      <Box
        sx={{
          bgcolor: 'white',
          borderTop: '1px solid #e0e0e0',
          p: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {files.length} items {selected.length > 0 && `(${selected.length} selected)`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          /{currentPath.join('/')}
        </Typography>
      </Box>
    </Box>
  );
}
