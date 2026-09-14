import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import path from 'path';
import { FilesService } from './files.service';
import { FileShareService } from './file-share.service';

@Controller('files')
export class FilesPublicController {
  constructor(private readonly files: FilesService, private readonly share: FileShareService) {}

  @Get('public/:token')
  async publicAccess(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    try {
      const payload = this.share.verifyToken(token);
      const username = payload.username;
      const p = payload.path;
      const info = await this.files.getFileInfo(username, p);

      if (info.stat.isDirectory()) {
        res.setHeader('Content-Type', 'application/zip');
        const name = path.basename(info.full) || 'archive';
        res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`);
        const zip = this.files.createArchiveStream(username, [p]);
        zip.on('error', (err: any) => {
          if (!res.headersSent) res.status(500);
          res.end(`Archive error: ${err.message}`);
        });
        zip.pipe(res);
        await zip.finalize();
        return;
      }

      if (payload.disposition === 'attachment') {
        return res.download(info.full, path.basename(info.full));
      }
      return res.sendFile(info.full);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
