// Global state
let currentPath = '/';
let selectedItem = null;
let isAuthenticated = false;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const fileList = document.getElementById('fileList');
const breadcrumb = document.getElementById('breadcrumb');
const statusText = document.getElementById('statusText');
const itemCount = document.getElementById('itemCount');
const currentUser = document.getElementById('currentUser');

// Buttons
const logoutBtn = document.getElementById('logoutBtn');
const uploadBtn = document.getElementById('uploadBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const refreshBtn = document.getElementById('refreshBtn');
const homeBtn = document.getElementById('homeBtn');
const deleteBtn = document.getElementById('deleteBtn');
const renameBtn = document.getElementById('renameBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Modals
const uploadModal = document.getElementById('uploadModal');
const newFolderModal = document.getElementById('newFolderModal');
const renameModal = document.getElementById('renameModal');
const editorModal = document.getElementById('editorModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupEventListeners();
});

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (data.authenticated) {
            isAuthenticated = true;
            currentUser.textContent = data.username;
            showMainApp();
            loadFiles(currentPath);
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            isAuthenticated = true;
            currentUser.textContent = username;
            showMainApp();
            loadFiles(currentPath);
        } else {
            loginError.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        loginError.textContent = 'Connection error';
        console.error('Login error:', error);
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        isAuthenticated = false;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

function showMainApp() {
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';
}

// Load files
async function loadFiles(path) {
    currentPath = path;
    fileList.innerHTML = '<div class="loading">Loading...</div>';
    updateBreadcrumb();
    
    try {
        console.log('Loading files from path:', path);
        const response = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            displayFiles(data.items);
            itemCount.textContent = `${data.items.length} items`;
            statusText.textContent = 'Ready';
        } else {
            fileList.innerHTML = `<div class="loading">Error: ${data.error}</div>`;
            console.error('File list error:', data.error);
        }
    } catch (error) {
        fileList.innerHTML = `<div class="loading">Connection error</div>`;
        console.error('Load files error:', error);
    }
}

// Display files
function displayFiles(items) {
    if (items.length === 0) {
        fileList.innerHTML = '<div class="loading">Empty directory</div>';
        return;
    }
    
    fileList.innerHTML = '';
    
    items.forEach(item => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.name = item.name;
        fileItem.dataset.type = item.type;
        fileItem.dataset.path = currentPath + (currentPath.endsWith('/') ? '' : '/') + item.name;
        
        const icon = item.type === 'directory' ? '📁' : getFileIcon(item.name);
        const size = item.type === 'directory' ? '-' : formatBytes(item.size);
        const date = new Date(item.modified).toLocaleString();
        
        fileItem.innerHTML = `
            <span class="file-icon">${icon}</span>
            <span class="file-name">${item.name}</span>
            <span class="file-size">${size}</span>
            <span class="file-date">${date}</span>
        `;
        
        fileItem.addEventListener('click', () => selectItem(fileItem, item));
        fileItem.addEventListener('dblclick', () => openItem(item));
        
        fileList.appendChild(fileItem);
    });
}

// Select item
function selectItem(element, item) {
    // Remove previous selection
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    
    // Add selection
    element.classList.add('selected');
    selectedItem = item;
    
    // Enable/disable buttons
    deleteBtn.disabled = false;
    renameBtn.disabled = false;
    downloadBtn.disabled = item.type === 'directory';
}

// Open item
function openItem(item) {
    if (item.type === 'directory') {
        const newPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + item.name;
        loadFiles(newPath);
    } else if (isTextFile(item.name)) {
        openTextEditor(item);
    } else {
        downloadFile(currentPath + (currentPath.endsWith('/') ? '' : '/') + item.name);
    }
}

// Update breadcrumb
function updateBreadcrumb() {
    const parts = currentPath.split('/').filter(p => p);
    breadcrumb.innerHTML = '<span class="breadcrumb-item" data-path="/">Root</span>';
    
    let path = '';
    parts.forEach(part => {
        path += '/' + part;
        const item = document.createElement('span');
        item.className = 'breadcrumb-item';
        item.textContent = part;
        item.dataset.path = path;
        item.addEventListener('click', () => loadFiles(item.dataset.path));
        breadcrumb.appendChild(item);
    });
}

// Setup event listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => loadFiles(currentPath));
    homeBtn.addEventListener('click', () => loadFiles('/'));
    
    uploadBtn.addEventListener('click', () => uploadModal.style.display = 'block');
    newFolderBtn.addEventListener('click', () => newFolderModal.style.display = 'block');
    
    deleteBtn.addEventListener('click', deleteItem);
    renameBtn.addEventListener('click', () => {
        if (selectedItem) {
            document.getElementById('newName').value = selectedItem.name;
            renameModal.style.display = 'block';
        }
    });
    
    downloadBtn.addEventListener('click', () => {
        if (selectedItem && selectedItem.type === 'file') {
            downloadFile(currentPath + (currentPath.endsWith('/') ? '' : '/') + selectedItem.name);
        }
    });
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').style.display = 'none';
        });
    });
    
    // Upload file
    document.getElementById('uploadConfirmBtn').addEventListener('click', uploadFile);
    
    // Create folder
    document.getElementById('createFolderBtn').addEventListener('click', createFolder);
    
    // Rename
    document.getElementById('renameConfirmBtn').addEventListener('click', renameItem);
    
    // Save file
    document.getElementById('saveFileBtn').addEventListener('click', saveFile);
}

// Upload file
async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    
    if (files.length === 0) {
        alert('Please select a file');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('path', currentPath);
    
    try {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            uploadModal.style.display = 'none';
            fileInput.value = '';
            loadFiles(currentPath);
            statusText.textContent = 'File uploaded successfully';
        } else {
            alert('Upload failed: ' + data.error);
        }
    } catch (error) {
        alert('Upload error: ' + error.message);
    }
}

// Create folder
async function createFolder() {
    const folderName = document.getElementById('folderName').value.trim();
    
    if (!folderName) {
        alert('Please enter a folder name');
        return;
    }
    
    try {
        console.log('Creating folder:', folderName, 'in path:', currentPath);
        const response = await fetch('/api/files/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentPath, name: folderName })
        });
        
        console.log('Create folder response status:', response.status);
        const data = await response.json();
        console.log('Create folder response data:', data);
        
        if (data.success) {
            newFolderModal.style.display = 'none';
            document.getElementById('folderName').value = '';
            loadFiles(currentPath);
            statusText.textContent = 'Folder created successfully';
        } else {
            alert('Create folder failed: ' + data.error);
        }
    } catch (error) {
        console.error('Create folder error:', error);
        alert('Error: ' + error.message);
    }
}

// Delete item
async function deleteItem() {
    if (!selectedItem) return;
    
    if (!confirm(`Are you sure you want to delete "${selectedItem.name}"?`)) {
        return;
    }
    
    try {
        const itemPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + selectedItem.name;
        const response = await fetch('/api/files/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: itemPath })
        });
        
        const data = await response.json();
        
        if (data.success) {
            selectedItem = null;
            deleteBtn.disabled = true;
            renameBtn.disabled = true;
            downloadBtn.disabled = true;
            loadFiles(currentPath);
            statusText.textContent = 'Item deleted successfully';
        } else {
            alert('Delete failed: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Rename item
async function renameItem() {
    if (!selectedItem) return;
    
    const newName = document.getElementById('newName').value.trim();
    
    if (!newName) {
        alert('Please enter a new name');
        return;
    }
    
    try {
        const itemPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + selectedItem.name;
        const response = await fetch('/api/files/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath: itemPath, newName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            renameModal.style.display = 'none';
            loadFiles(currentPath);
            statusText.textContent = 'Item renamed successfully';
        } else {
            alert('Rename failed: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Download file
function downloadFile(path) {
    window.location.href = `/api/files/download?path=${encodeURIComponent(path)}`;
    statusText.textContent = 'Downloading file...';
}

// Open text editor
async function openTextEditor(item) {
    const filePath = currentPath + (currentPath.endsWith('/') ? '' : '/') + item.name;
    
    try {
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('editorTitle').textContent = `Edit: ${item.name}`;
            document.getElementById('fileContent').value = data.content;
            document.getElementById('fileContent').dataset.path = filePath;
            editorModal.style.display = 'block';
        } else {
            alert('Failed to read file: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Save file
async function saveFile() {
    const content = document.getElementById('fileContent').value;
    const path = document.getElementById('fileContent').dataset.path;
    
    try {
        const response = await fetch('/api/files/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            editorModal.style.display = 'none';
            statusText.textContent = 'File saved successfully';
        } else {
            alert('Save failed: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Helper functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'txt': '📄', 'doc': '📄', 'docx': '📄', 'pdf': '📕',
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
        'mp3': '🎵', 'wav': '🎵', 'mp4': '🎬', 'avi': '🎬',
        'zip': '📦', 'rar': '📦', 'tar': '📦', 'gz': '📦',
        'js': '📜', 'json': '📜', 'html': '📜', 'css': '📜', 'php': '📜',
        'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
        'sh': '⚡', 'bat': '⚡', 'exe': '⚙️'
    };
    return iconMap[ext] || '📄';
}

function isTextFile(filename) {
    const textExtensions = ['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 
                           'php', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'yaml', 'yml', 
                           'ini', 'conf', 'cfg'];
    const ext = filename.split('.').pop().toLowerCase();
    return textExtensions.includes(ext);
}
