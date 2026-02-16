import { Controller, Get, Post, Body, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const { username, password } = body;
    if (!username || !password) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, error: 'Username and password are required' });
    }

    const ok = await this.authService.validate(username, password);
    if (ok) {
      (req.session as any).isAuthenticated = true;
      (req.session as any).username = username;
      return res.json({ success: true, message: 'Login successful' });
    }
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
