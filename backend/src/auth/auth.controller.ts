import { Controller, Get, Post, Body, Req, Res, HttpStatus, Inject, Optional } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { TwoFactorService } from '../two-factor/two-factor.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Optional() @Inject(TwoFactorService) private readonly twoFactorService?: TwoFactorService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request, @Res() res: Response) {
    const { username, password } = body;

    const ok = await this.authService.validate(username, password);
    if (!ok) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: 'Invalid credentials' });
    }

    // Check if 2FA is enabled
    if (this.twoFactorService) {
      const twoFaEnabled = await this.twoFactorService.isEnabled();
      if (twoFaEnabled) {
        (req.session as any).twoFactorPending = true;
        (req.session as any).username = username;
        return res.json({ success: true, twoFactorRequired: true, message: 'Please enter your 2FA code.' });
      }
    }

    (req.session as any).isAuthenticated = true;
    (req.session as any).username = username;
    return res.json({ success: true, message: 'Login successful' });
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session?.destroy(() => {});
    return res.json({ success: true, message: 'Logged out' });
  }

  @Post('extend')
  extend(@Req() req: Request, @Res() res: Response) {
    const s = req.session as any;
    if (!s?.isAuthenticated) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
    }

    req.session?.touch?.();
    const maxAge = typeof s?.cookie?.maxAge === 'number' && s.cookie.maxAge > 0 ? s.cookie.maxAge : 15 * 60 * 1000;
    return res.json({
      success: true,
      expiresAt: new Date(Date.now() + maxAge).toISOString(),
      message: 'Session extended',
    });
  }

  @Get('status')
  status(@Req() req: Request) {
    const s = req.session as any;
    const maxAge = typeof s?.cookie?.maxAge === 'number' && s.cookie.maxAge > 0 ? s.cookie.maxAge : 15 * 60 * 1000;
    const expiresAt = s?.cookie?.expires ? new Date(s.cookie.expires).toISOString() : new Date(Date.now() + maxAge).toISOString();

    return {
      authenticated: !!s?.isAuthenticated,
      twoFactorPending: !!s?.twoFactorPending,
      username: s?.username,
      expiresAt,
    };
  }
}
