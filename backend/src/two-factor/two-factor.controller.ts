import {
  Controller, Get, Post, Body, Req, Res,
  UseGuards, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { TwoFactorService } from './two-factor.service';
import { Request, Response } from 'express';

@Controller('two-factor')
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly authService: AuthService,
  ) {}

  /* ─── Status ───────────────────────────────────────────── */
  @Get('status')
  @UseGuards(AuthGuard)
  async status() {
    return this.twoFactorService.getStatus();
  }

  /* ─── Generate setup (secret + otpauth URI) ────────────── */
  @Post('setup')
  @UseGuards(AuthGuard)
  async setup(@Req() req: Request) {
    const username = (req.session as any)?.username || 'admin';
    return this.twoFactorService.generateSetup(username);
  }

  /* ─── Verify code & enable 2FA ─────────────────────────── */
  @Post('enable')
  @UseGuards(AuthGuard)
  async enable(@Body('token') token: string) {
    if (!token || token.length !== 6) {
      return { success: false, message: 'Please enter a 6-digit code.' };
    }
    return this.twoFactorService.verifyAndEnable(token);
  }

  /* ─── Disable 2FA (requires password re-entry) ─────────── */
  @Post('disable')
  @UseGuards(AuthGuard)
  async disable(@Body('password') password: string, @Req() req: Request) {
    const username = (req.session as any)?.username || 'admin';
    const valid = await this.authService.validate(username, password);
    if (!valid) {
      return { success: false, message: 'Invalid password.' };
    }
    return this.twoFactorService.disable(password);
  }

  /* ─── Verify 2FA code during login ─────────────────────── */
  @Post('verify')
  async verify(@Body('token') token: string, @Req() req: Request, @Res() res: Response) {
    const session = req.session as any;

    // Must have passed password step first
    if (!session?.twoFactorPending) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'No pending 2FA challenge.',
      });
    }

    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Token required.',
      });
    }

    const result = await this.twoFactorService.verifyCode(token);
    if (result.success) {
      session.isAuthenticated = true;
      session.twoFactorPending = false;
      return res.json({ success: true, message: 'Authenticated' });
    }

    return res.status(HttpStatus.UNAUTHORIZED).json(result);
  }

  /* ─── Regenerate recovery codes ────────────────────────── */
  @Post('recovery-codes')
  @UseGuards(AuthGuard)
  async regenerateRecoveryCodes() {
    return this.twoFactorService.regenerateRecoveryCodes();
  }
}
