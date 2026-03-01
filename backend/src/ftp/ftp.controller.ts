import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { FtpService } from './ftp.service';
import { CreateFtpAccountDto, ResetFtpPasswordDto } from './dto/ftp.dto';

@Controller('ftp')
@UseGuards(AuthGuard)
export class FtpController {
  constructor(private readonly ftp: FtpService) {}

  private user(req: Request): string {
    return (req.session as any).username;
  }

  @Get('status')
  async status(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.ftp.getStatus();
      return res.json({ success: true, ...data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('accounts')
  async listAccounts(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.ftp.listAccounts(this.user(req));
      return res.json({ success: true, accounts: data });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('accounts')
  async createAccount(@Body() body: CreateFtpAccountDto, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.ftp.createAccount(this.user(req), body);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('password')
  async resetPassword(@Body() body: ResetFtpPasswordDto, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.ftp.resetPassword(this.user(req), body.login, body.password);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.ftp.deleteAccount(this.user(req), id);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
