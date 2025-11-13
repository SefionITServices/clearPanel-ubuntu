import { Controller, Get, Post, Query, Body, Req, Res, HttpStatus, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { FilesService } from './files.service';
import multer from 'multer';
import path from 'path';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

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
      const data = await this.files.list(path || '');
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('mkdir')
  async mkdir(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const data = await this.files.mkdir(body.path || '', body.name);
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
        await this.files.writeFile(dest, f.originalname, f.buffer, false);
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
      const info = await this.files.getFileInfo(p);
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
      const zip = this.files.createArchiveStream(paths);
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
        const r = await this.files.remove(p);
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
      const data = await this.files.rename(body.path, body.newName);
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
      const data = await this.files.move(targets, dest);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
