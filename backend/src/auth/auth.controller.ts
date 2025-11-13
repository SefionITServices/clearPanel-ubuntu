import { Controller, Get, Post, Body, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const { username, password } = body;
    console.log('[Auth] Login attempt:', { username, passwordLength: password?.length });
    const ok = this.authService.validate(username, password);
    if (ok) {
      (req.session as any).isAuthenticated = true;
      (req.session as any).username = username;
      console.log('[Auth] Login successful for:', username);
      return res.json({ success: true, message: 'Login successful' });
    }
    console.log('[Auth] Login failed for:', username);
    return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: 'Invalid credentials' });
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session?.destroy(() => {});
    return res.json({ success: true, message: 'Logged out' });
  }

  @Get('status')
  status(@Req() req: Request) {
    return {
      authenticated: !!(req.session as any)?.isAuthenticated,
      username: (req.session as any)?.username,
    };
  }
}
