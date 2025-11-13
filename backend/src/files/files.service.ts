import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import archiver from 'archiver';

@Injectable()
export class FilesService {
  private rootPath = process.env.ROOT_PATH || '/home';

  private validatePath(requestedPath?: string) {
    const rel = (requestedPath || '.').replace(/^\/+/, '');
    const full = path.resolve(this.rootPath, rel);
    const rootResolved = path.resolve(this.rootPath);
    if (!full.startsWith(rootResolved)) throw new Error('Access denied');
    return full;
  }

  async list(dir?: string) {
    const dirPath = this.validatePath(dir);
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

  async mkdir(dir: string, name: string) {
    const full = this.validatePath(path.join(dir || '', name));
    await fs.mkdir(full, { recursive: false });
    return { success: true, message: 'Directory created' };
  }

  async remove(target: string) {
    const full = this.validatePath(target);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      await fs.rm(full, { recursive: true, force: true });
    } else {
      await fs.unlink(full);
    }
    return { success: true, message: 'Removed' };
  }

  async rename(src: string, newName: string) {
    const srcFull = this.validatePath(src);
    const destFull = this.validatePath(path.join(path.dirname(src), newName));
    await fs.rename(srcFull, destFull);
    return { success: true, message: 'Renamed' };
  }

  async move(targets: string[], destDir: string) {
    const destFull = this.validatePath(destDir);
    const results: Array<{ name: string; ok: boolean; error?: string }> = [];
    for (const t of targets) {
      try {
        const srcFull = this.validatePath(t);
        const base = path.basename(srcFull);
        await fs.rename(srcFull, path.join(destFull, base));
        results.push({ name: base, ok: true });
      } catch (e: any) {
        results.push({ name: path.basename(t), ok: false, error: e.message });
      }
    }
    return { success: true, message: 'Moved', results };
  }

  async ensureDir(dir: string) {
    const full = this.validatePath(dir);
    await fs.mkdir(full, { recursive: true });
    return full;
  }

  async writeFile(destDir: string, filename: string, buffer: Buffer, overwrite = false) {
    const dirFull = await this.ensureDir(destDir);
    let target = path.join(dirFull, path.basename(filename));
    const exists = fsSync.existsSync(target);
    if (exists && !overwrite) {
      throw new Error('File already exists');
    }
    await fs.writeFile(target, buffer);
    return { success: true, path: target };
  }

  createArchiveStream(pathsInput: string[]) {
    const zip = archiver('zip', { zlib: { level: 9 } });
    const rootResolved = path.resolve(this.rootPath);
    for (const p of pathsInput) {
      const full = this.validatePath(p);
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

  async getFileInfo(p: string) {
    const full = this.validatePath(p);
    const stat = await fs.stat(full);
    return { full, stat };
  }
}
