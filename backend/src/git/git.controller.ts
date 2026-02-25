import { Controller, Get, Post, Query, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { GitService } from './git.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('git')
@UseGuards(AuthGuard)
export class GitController {
  constructor(private readonly git: GitService) {}

  private user(req: Request): string {
    return (req.session as any).username;
  }

  // ── Repo status ──────────────────────────────────────────────────────────

  @Get('paths')
  async listPaths(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.listPaths(this.user(req));
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('is-repo')
  async isRepo(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    try {
      const is = await this.git.isRepo(this.user(req), p || '');
      return res.json({ success: true, isRepo: is });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('status')
  async status(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.status(this.user(req), p);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Init / Clone ─────────────────────────────────────────────────────────

  @Post('init')
  async init(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.init(this.user(req), body.path);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('clone')
  async clone(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.clone(this.user(req), body.url, body.dest || '', body.name);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Staging ──────────────────────────────────────────────────────────────

  @Post('add')
  async add(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.add(this.user(req), body.path, body.files || []);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('unstage')
  async unstage(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.unstage(this.user(req), body.path, body.files || []);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('discard')
  async discard(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.discard(this.user(req), body.path, body.files || []);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Commit ───────────────────────────────────────────────────────────────

  @Post('commit')
  async commit(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.commit(
        this.user(req), body.path, body.message, body.authorName, body.authorEmail,
      );
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Log ──────────────────────────────────────────────────────────────────

  @Get('log')
  async log(@Query() q: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.log(this.user(req), q.path, q.limit ? parseInt(q.limit, 10) : 50, q.branch);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Diff ─────────────────────────────────────────────────────────────────

  @Get('diff')
  async diff(@Query() q: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.diff(this.user(req), q.path, q.file);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('diff-staged')
  async diffStaged(@Query() q: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.diffStaged(this.user(req), q.path, q.file);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('diff-commit')
  async diffCommit(@Query() q: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.diffCommit(this.user(req), q.path, q.hash);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Branches ─────────────────────────────────────────────────────────────

  @Get('branches')
  async branches(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.branches(this.user(req), p);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('checkout')
  async checkout(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.checkoutBranch(this.user(req), body.path, body.branch);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('create-branch')
  async createBranch(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.createBranch(this.user(req), body.path, body.branch, body.from);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('delete-branch')
  async deleteBranch(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.deleteBranch(this.user(req), body.path, body.branch, body.force);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('merge')
  async merge(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.mergeBranch(this.user(req), body.path, body.branch);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Remotes ──────────────────────────────────────────────────────────────

  @Get('remotes')
  async remotes(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.remotes(this.user(req), p);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('add-remote')
  async addRemote(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.addRemote(this.user(req), body.path, body.name, body.url);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('remove-remote')
  async removeRemote(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.removeRemote(this.user(req), body.path, body.name);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Pull / Push / Fetch ──────────────────────────────────────────────────

  @Post('pull')
  async pull(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.pull(this.user(req), body.path, body.remote, body.branch);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('push')
  async push(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.push(this.user(req), body.path, body.remote, body.branch, body.force);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('fetch')
  async fetch(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.fetch(this.user(req), body.path, body.remote);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Stash ────────────────────────────────────────────────────────────────

  @Post('stash')
  async stash(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.stash(this.user(req), body.path, body.message);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('stash-list')
  async stashList(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.stashList(this.user(req), p);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('stash-pop')
  async stashPop(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.stashPop(this.user(req), body.path, body.ref);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('stash-drop')
  async stashDrop(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.stashDrop(this.user(req), body.path, body.ref);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Config ───────────────────────────────────────────────────────────────

  @Get('config')
  async getConfig(@Query('path') p: string, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.getConfig(this.user(req), p);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('config')
  async setConfig(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.setConfig(this.user(req), body.path, body.name, body.email);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ── Credentials (HTTPS token) ────────────────────────────────────────────

  @Post('set-cred')
  async setCred(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.setRepoCred(this.user(req), body.path, body.token, body.username);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('remove-cred')
  async removeCred(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.git.removeRepoCred(this.user(req), body.path);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
