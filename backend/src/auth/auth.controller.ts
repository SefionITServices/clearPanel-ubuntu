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

  @Get('status')
  status(@Req() req: Request) {
    const s = req.session as any;
    return {
      authenticated: !!s?.isAuthenticated,
      twoFactorPending: !!s?.twoFactorPending,
      username: s?.username,
    };
  }
}
