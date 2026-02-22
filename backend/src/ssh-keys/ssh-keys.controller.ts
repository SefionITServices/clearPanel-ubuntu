import {
  Controller, Get, Post, Delete, Body, Param, Query,
  Req, Res, UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SshKeysService, KeyAlgorithm } from './ssh-keys.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('ssh-keys')
@UseGuards(AuthGuard)
export class SshKeysController {
  constructor(private readonly sshKeys: SshKeysService) {}

  // ───────────────────────────────────────────────────────────────────
  //  KEY MANAGEMENT
  // ───────────────────────────────────────────────────────────────────

  @Get()
  async listKeys(@Req() req: Request, @Res() res: Response) {
    try {
      const keys = await this.sshKeys.listKeys();
      return res.json({ success: true, keys });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('generate')
  async generateKey(
    @Body() body: {
      name?: string;
      algorithm?: KeyAlgorithm;
      bits?: number;
      comment?: string;
      passphrase?: string;
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.sshKeys.generateKey({
        name: body.name,
        algorithm: body.algorithm,
        bits: body.bits,
        comment: body.comment,
        passphrase: body.passphrase,
      });
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Delete(':name')
  async deleteKey(@Param('name') name: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.sshKeys.deleteKey(name);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get(':name/public')
  async getPublicKey(@Param('name') name: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.sshKeys.getPublicKey(name);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ───────────────────────────────────────────────────────────────────
  //  AUTHORIZED KEYS
  // ───────────────────────────────────────────────────────────────────

  @Get('authorized')
  async getAuthorizedKeys(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.sshKeys.getAuthorizedKeys();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('authorized')
  async addAuthorizedKey(
    @Body() body: { publicKey: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.publicKey?.trim()) {
      return res.status(400).json({ success: false, error: 'publicKey is required' });
    }
    try {
      const result = await this.sshKeys.addAuthorizedKey(body.publicKey);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Delete('authorized/:index')
  async removeAuthorizedKey(
    @Param('index') index: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.sshKeys.removeAuthorizedKey(parseInt(index, 10));
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
