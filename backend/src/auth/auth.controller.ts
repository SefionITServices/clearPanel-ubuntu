import { Controller, Get, Post, Body, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request, @Res() res: Response) {
    const { username, password } = body;

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
