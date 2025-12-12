import { Controller, Get, Post, Query, Body, Req, Res, HttpStatus, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { FilesService } from './files.service';
import multer from 'multer';
import path from 'path';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) { }

  private ensureAuth(req: Request, res: Response) {
    if (!(req.session as any)?.isAuthenticated) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  @Get('list')
  async list(@Query('path') path: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const username = (req.session as any).username;
      const data = await this.files.list(username, path || '');
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('mkdir')
  async mkdir(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const username = (req.session as any).username;
      const data = await this.files.mkdir(username, body.path || '', body.name);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('upload')
  @UseInterceptors(AnyFilesInterceptor({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 104857600) },
  }))
  async upload(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    const dest: string = body.path || '';
    const files: Express.Multer.File[] = (req as any).files || [];
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }
    const results: Array<{ name: string; ok: boolean; error?: string }> = [];
    for (const f of files) {
      try {
        const username = (req.session as any).username;
        await this.files.writeFile(username, dest, f.originalname, f.buffer, false);
        results.push({ name: f.originalname, ok: true });
      } catch (e: any) {
        results.push({ name: f.originalname, ok: false, error: e.message });
      }
    }
    return res.json({ success: true, results });
  }

  @Get('download')
  async download(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!p) return res.status(400).json({ success: false, error: 'path required' });
    try {
      const username = (req.session as any).username;
      const info = await this.files.getFileInfo(username, p);
      if (info.stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Cannot download a directory' });
      }
      return res.download(info.full, path.basename(info.full));
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('archive')
  async archive(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    const paths: string[] = body.paths || [];
    const name: string = body.name || 'archive.zip';
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ success: false, error: 'paths array required' });
    }
    try {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      const username = (req.session as any).username;
      const zip = this.files.createArchiveStream(username, paths);
      zip.on('error', (err: any) => {
        if (!res.headersSent) res.status(500);
        res.end(`Archive error: ${err.message}`);
      });
      zip.pipe(res);
      await zip.finalize();
    } catch (e: any) {
      if (!res.headersSent) return res.status(400).json({ success: false, error: e.message });
      res.end();
    }
  }
  @Post('delete')
  async delete(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    const targets: string[] = body.paths || [];
    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ success: false, error: 'paths array required' });
    }
    const results: Array<{ path: string; ok: boolean; error?: string }> = [];
    for (const p of targets) {
      try {
        const username = (req.session as any).username;
        const r = await this.files.remove(username, p);
        results.push({ path: p, ok: true });
      } catch (e: any) {
        results.push({ path: p, ok: false, error: e.message });
      }
    }
    return res.json({ success: true, results });
  }

  @Post('rename')
  async rename(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.path || !body.newName) {
      return res.status(400).json({ success: false, error: 'path and newName required' });
    }
    try {
      const username = (req.session as any).username;
      const data = await this.files.rename(username, body.path, body.newName);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('move')
  async move(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    const targets: string[] = body.paths || [];
    const dest: string = body.dest;
    if (!Array.isArray(targets) || targets.length === 0 || !dest) {
      return res.status(400).json({ success: false, error: 'paths[] and dest required' });
    }
    try {
      const username = (req.session as any).username;
      const data = await this.files.move(username, targets, dest);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('copy')
  async copy(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    const sources: string[] = body.sources || [];
    const destination: string = body.destination;
    if (!Array.isArray(sources) || sources.length === 0 || !destination) {
      return res.status(400).json({ success: false, error: 'sources[] and destination required' });
    }
    try {
      const username = (req.session as any).username;
      const data = await this.files.copy(username, sources, destination);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('chmod')
  async chmod(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.path || !body.mode) {
      return res.status(400).json({ success: false, error: 'path and mode required' });
    }
    try {
      const username = (req.session as any).username;
      const data = await this.files.chmod(username, body.path, body.mode);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('read')
  async read(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!p) return res.status(400).json({ success: false, error: 'path required' });
    try {
      const username = (req.session as any).username;
      const data = await this.files.readFile(username, p);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('raw')
  async raw(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!p) return res.status(400).json({ success: false, error: 'path required' });
    try {
      const username = (req.session as any).username;
      const fullPath = this.files.getAbsolutePath(p, username);
      return res.sendFile(fullPath);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('disk-usage')
  async getDiskUsage(@Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    const username = (req.session as any).username;
    const usage = await this.files.getDiskUsage(username);
    return res.json({ success: true, ...usage });
  }

  @Post('write')
  async write(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.path || body.content === undefined) {
      return res.status(400).json({ success: false, error: 'path and content required' });
    }
    try {
      const username = (req.session as any).username;
      const data = await this.files.writeFileContent(username, body.path, body.content);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('create')
  async create(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.path) {
      return res.status(400).json({ success: false, error: 'path required' });
    }
    try {
      const username = (req.session as any).username;
      const data = await this.files.createFile(username, body.path, body.content || '');
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('info')
  async info(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!p) return res.status(400).json({ success: false, error: 'path required' });
    try {
      const username = (req.session as any).username;
      const info = await this.files.getFileInfo(username, p);
      const stat = info.stat;
      return res.json({
        success: true,
        name: path.basename(p),
        path: p,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modified: stat.mtime,
        permissions: stat.mode.toString(8).slice(-3),
        owner: stat.uid,
        group: stat.gid,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('extract')
  async extract(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.archive || !body.destination) {
      return res.status(400).json({ success: false, error: 'archive and destination required' });
    }
    try {
      const username = (req.session as any).username;
      const data = await this.files.extract(username, body.archive, body.destination);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
