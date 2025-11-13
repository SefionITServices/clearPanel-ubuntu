const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = req.body.path || '/tmp';
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 } // 100MB default
});

// Helper function to sanitize and validate paths
const validatePath = (requestedPath) => {
    const rootPath = process.env.ROOT_PATH || '/home';
    // Remove leading slash to prevent absolute path resolution
    const relativePath = (requestedPath || '.').replace(/^\/+/, '');
    const fullPath = path.resolve(rootPath, relativePath);
    
    // Prevent directory traversal attacks
    if (!fullPath.startsWith(path.resolve(rootPath))) {
        throw new Error('Access denied');
    }
    
    return fullPath;
};

// List files and directories
router.get('/list', async (req, res) => {
    try {
        const dirPath = validatePath(req.query.path || '');
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        const fileList = await Promise.all(items.map(async (item) => {
            const itemPath = path.join(dirPath, item.name);
            const stats = await fs.stat(itemPath);
            
            return {
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modified: stats.mtime,
                permissions: stats.mode.toString(8).slice(-3)
            };
        }));
        
        res.json({ 
            success: true, 
            path: dirPath,
            items: fileList.sort((a, b) => {
                // Directories first, then alphabetically
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
            })
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Create new directory
router.post('/mkdir', async (req, res) => {
    try {
        const { path: dirPath, name } = req.body;
        const fullPath = validatePath(path.join(dirPath || '', name));
        
        await fs.mkdir(fullPath, { recursive: false });
        res.json({ success: true, message: 'Directory created' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        res.json({ 
            success: true, 
            message: 'File uploaded successfully',
            filename: req.file.filename 
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Download file
router.get('/download', async (req, res) => {
    try {
        const filePath = validatePath(req.query.path);
        const stats = await fs.stat(filePath);
        
        if (!stats.isFile()) {
            return res.status(400).json({ success: false, error: 'Not a file' });
        }
        
        res.download(filePath);
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Delete file or directory
router.delete('/delete', async (req, res) => {
    try {
        const itemPath = validatePath(req.body.path);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
            await fs.rm(itemPath, { recursive: true, force: true });
        } else {
            await fs.unlink(itemPath);
        }
        
        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Rename/move file or directory
router.post('/rename', async (req, res) => {
    try {
        const { oldPath, newName } = req.body;
        const oldFullPath = validatePath(oldPath);
        const newFullPath = validatePath(path.join(path.dirname(oldPath), newName));
        
        await fs.rename(oldFullPath, newFullPath);
        res.json({ success: true, message: 'Item renamed' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Read file content (for text files)
router.get('/read', async (req, res) => {
    try {
        const filePath = validatePath(req.query.path);
        const content = await fs.readFile(filePath, 'utf-8');
        
        res.json({ success: true, content });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Write file content
router.post('/write', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        const fullPath = validatePath(filePath);
        
        await fs.writeFile(fullPath, content, 'utf-8');
        res.json({ success: true, message: 'File saved' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Download directory as ZIP
router.get('/download-zip', async (req, res) => {
    try {
        const dirPath = validatePath(req.query.path);
        const stats = await fs.stat(dirPath);
        
        if (!stats.isDirectory()) {
            return res.status(400).json({ success: false, error: 'Not a directory' });
        }
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        const dirName = path.basename(dirPath);
        
        res.attachment(`${dirName}.zip`);
        archive.pipe(res);
        archive.directory(dirPath, false);
        await archive.finalize();
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

module.exports = router;
