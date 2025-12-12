import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import archiver from 'archiver';
import unzipper from 'unzipper';
import tar from 'tar';

@Injectable()
export class FilesService {
  private getRootPath(username: string) {
    const p = path.join('/home/clearpanel', username);
    if (!fsSync.existsSync(p)) {
      try {
        fsSync.mkdirSync(p, { recursive: true });
      } catch (e) {
        console.error(`Failed to create user root ${p}:`, e);
      }
    }
    return p;
  }

  private validatePath(requestedPath: string | undefined, username: string) {
    const rootPath = this.getRootPath(username);
    const rel = (requestedPath || '.').replace(/^\/+/, '');
    const full = path.resolve(rootPath, rel);
    const rootResolved = path.resolve(rootPath);
    if (!full.startsWith(rootResolved)) throw new Error('Access denied');
    return full;
  }

  getAbsolutePath(path: string, username: string) {
    return this.validatePath(path, username);
  }

  async list(username: string, dir?: string) {
    const dirPath = this.validatePath(dir, username);
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const list = await Promise.all(
      items.map(async (it) => {
        const p = path.join(dirPath, it.name);
        const stats = await fs.stat(p);
        return {
          name: it.name,
          type: it.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
          permissions: stats.mode.toString(8).slice(-3),
        };
      })
    );
    list.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
    return { success: true, path: dirPath, items: list };
  }

  async mkdir(username: string, dir: string, name: string) {
    const full = this.validatePath(path.join(dir || '', name), username);
    await fs.mkdir(full, { recursive: false });
    return { success: true, message: 'Directory created' };
  }

  async remove(username: string, target: string) {
    const full = this.validatePath(target, username);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      await fs.rm(full, { recursive: true, force: true });
    } else {
      await fs.unlink(full);
    }
    return { success: true, message: 'Removed' };
  }

  async rename(username: string, src: string, newName: string) {
    const srcFull = this.validatePath(src, username);
    const destFull = this.validatePath(path.join(path.dirname(src), newName), username);
    await fs.rename(srcFull, destFull);
    return { success: true, message: 'Renamed' };
  }

  async move(username: string, targets: string[], destDir: string) {
    const destFull = this.validatePath(destDir, username);
    const results: Array<{ name: string; ok: boolean; error?: string }> = [];
    for (const t of targets) {
      try {
        const srcFull = this.validatePath(t, username);
        const base = path.basename(srcFull);
        await fs.rename(srcFull, path.join(destFull, base));
        results.push({ name: base, ok: true });
      } catch (e: any) {
        results.push({ name: path.basename(t), ok: false, error: e.message });
      }
    }
    return { success: true, message: 'Moved', results };
  }

  async ensureDir(username: string, dir: string) {
    const full = this.validatePath(dir, username);
    await fs.mkdir(full, { recursive: true });
    return full;
  }

  async writeFile(username: string, destDir: string, filename: string, buffer: Buffer, overwrite = false) {
    const dirFull = await this.ensureDir(username, destDir);
    let target = path.join(dirFull, path.basename(filename));
    const exists = fsSync.existsSync(target);
    if (exists && !overwrite) {
      throw new Error('File already exists');
    }
    await fs.writeFile(target, buffer);
    return { success: true, path: target };
  }

  createArchiveStream(username: string, pathsInput: string[]) {
    const zip = archiver('zip', { zlib: { level: 9 } });
    const rootResolved = path.resolve(this.getRootPath(username));
    for (const p of pathsInput) {
      const full = this.validatePath(p, username);
      const name = path.relative(rootResolved, full) || path.basename(full);
      if (fsSync.statSync(full).isDirectory()) {
        zip.directory(full, name);
      } else {
        zip.file(full, { name });
      }
    }
    // Caller must pipe zip and call finalize when ready
    return zip;
  }

  async getFileInfo(username: string, p: string) {
    const full = this.validatePath(p, username);
    const stat = await fs.stat(full);
    return { full, stat };
  }

  /**
   * Copy files/folders to destination
   */
  async copy(username: string, sources: string[], destination: string) {
    const destFull = this.validatePath(destination, username);
    const results: Array<{ name: string; ok: boolean; error?: string }> = [];

    for (const src of sources) {
      try {
        const srcFull = this.validatePath(src, username);
        const baseName = path.basename(srcFull);
        const destPath = path.join(destFull, baseName);

        const stat = await fs.stat(srcFull);

        if (stat.isDirectory()) {
          // Copy directory recursively
          await this.copyDirectory(srcFull, destPath);
        } else {
          // Copy file
          await fs.copyFile(srcFull, destPath);
        }

        results.push({ name: baseName, ok: true });
      } catch (e: any) {
        results.push({ name: path.basename(src), ok: false, error: e.message });
      }
    }

    return { success: true, message: 'Copy completed', results };
  }

  /**
   * Recursively copy directory
   */
  private async copyDirectory(src: string, dest: string) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Change file permissions (chmod)
   */
  async chmod(username: string, p: string, mode: string) {
    const full = this.validatePath(p, username);

    // Parse mode (supports octal string like "644" or "755")
    const modeNum = parseInt(mode, 8);

    if (isNaN(modeNum)) {
      throw new Error('Invalid mode format. Use octal notation (e.g., 644, 755)');
    }

    await fs.chmod(full, modeNum);

    return { success: true, message: `Permissions changed to ${mode}` };
  }

  /**
   * Read file content
   */
  async readFile(username: string, p: string) {
    const full = this.validatePath(p, username);
    const stat = await fs.stat(full);

    if (stat.isDirectory()) {
      throw new Error('Cannot read a directory');
    }

    // Limit file size for reading (1MB)
    const maxSize = 1024 * 1024;
    if (stat.size > maxSize) {
      throw new Error(`File too large to edit (max ${maxSize / 1024}KB)`);
    }

    const content = await fs.readFile(full, 'utf-8');

    return {
      success: true,
      content,
      size: stat.size,
      modified: stat.mtime,
    };
  }

  async getDiskUsage(username: string) {
    try {
      const { stdout } = await import('util').then((util) =>
        util.promisify(require('child_process').exec)(`df -kP ${this.getRootPath(username)}`)
      );
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) throw new Error('Unexpected df output');

      const parts = lines[1].split(/\s+/);
      // Filesystem 1024-blocks Used Available Capacity Mounted on
      const total = parseInt(parts[1], 10) * 1024; // KB to Bytes
      const used = parseInt(parts[2], 10) * 1024;
      const available = parseInt(parts[3], 10) * 1024;

      return { total, used, available };
    } catch (e) {
      console.error('Disk usage error:', e);
      return { total: 0, used: 0, available: 0 };
    }
  }

  /**
   * Write file content
   */
  async writeFileContent(username: string, p: string, content: string) {
    const full = this.validatePath(p, username);

    await fs.writeFile(full, content, 'utf-8');

    return { success: true, message: 'File saved successfully' };
  }

  /**
   * Create new file
   */
  async createFile(username: string, p: string, content: string = '') {
    const full = this.validatePath(p, username);

    // Check if file already exists
    const exists = await fs.access(full).then(() => true).catch(() => false);

    if (exists) {
      throw new Error('File already exists');
    }

    await fs.writeFile(full, content, 'utf-8');

    return { success: true, message: 'File created successfully', path: full };
  }

  /**
   * Extract archive file
   */
  async extract(username: string, archivePath: string, destination: string) {
    const archiveFull = this.validatePath(archivePath, username);
    const destFull = this.validatePath(destination, username);

    // Ensure destination directory exists
    await fs.mkdir(destFull, { recursive: true });

    // Determine archive type by extension
    const ext = path.extname(archivePath).toLowerCase();

    try {
      if (ext === '.zip') {
        // Extract ZIP
        await fsSync.createReadStream(archiveFull)
          .pipe(unzipper.Extract({ path: destFull }))
          .promise();
      } else if (ext === '.tar' || ext === '.gz' || archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
        // Extract TAR/GZ
        await tar.extract({
          file: archiveFull,
          cwd: destFull,
        });
      } else {
        throw new Error('Unsupported archive format. Supported: .zip, .tar, .gz, .tar.gz, .tgz');
      }

      return { success: true, message: 'Archive extracted successfully' };
    } catch (e: any) {
      throw new Error(`Failed to extract archive: ${e.message}`);
    }
  }
}

