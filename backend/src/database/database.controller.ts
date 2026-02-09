import { Controller, Get, Post, Delete, Body, Param, Req, Res, HttpStatus, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseService } from './database.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly db: DatabaseService) {}

  private ensureAuth(req: Request, res: Response) {
    if (!(req.session as any)?.isAuthenticated) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  // ========================
  // STATUS
  // ========================

  @Get('status')
  async status(@Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const data = await this.db.getStatus();
      return res.json({ success: true, ...data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('install')
  async install(@Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const data = await this.db.installMySQL();
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // DATABASES
  // ========================

  @Get('list')
  async listDatabases(@Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const databases = await this.db.listDatabases();
      return res.json({ success: true, databases });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('create')
  async createDatabase(@Body() body: { name: string }, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name) return res.status(400).json({ success: false, error: 'name required' });
    try {
      const data = await this.db.createDatabase(body.name);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('delete')
  async deleteDatabase(@Body() body: { name: string }, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name) return res.status(400).json({ success: false, error: 'name required' });
    try {
      const data = await this.db.deleteDatabase(body.name);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('tables')
  async listTables(@Query('database') database: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!database) return res.status(400).json({ success: false, error: 'database required' });
    try {
      const tables = await this.db.listTables(database);
      return res.json({ success: true, tables });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ========================
  // USERS
  // ========================

  @Get('users')
  async listUsers(@Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const users = await this.db.listUsers();
      return res.json({ success: true, users });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('users/create')
  async createUser(
    @Body() body: { name: string; password: string; host?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name || !body.password) {
      return res.status(400).json({ success: false, error: 'name and password required' });
    }
    try {
      const data = await this.db.createUser(body.name, body.password, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('users/delete')
  async deleteUser(
    @Body() body: { name: string; host?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name) return res.status(400).json({ success: false, error: 'name required' });
    try {
      const data = await this.db.deleteUser(body.name, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('users/password')
  async changePassword(
    @Body() body: { name: string; password: string; host?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name || !body.password) {
      return res.status(400).json({ success: false, error: 'name and password required' });
    }
    try {
      const data = await this.db.changePassword(body.name, body.password, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ========================
  // PRIVILEGES
  // ========================

  @Post('privileges/grant')
  async grant(
    @Body() body: { user: string; database: string; privileges?: string[]; host?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.user || !body.database) {
      return res.status(400).json({ success: false, error: 'user and database required' });
    }
    try {
      const data = await this.db.grantPrivileges(body.user, body.database, body.privileges, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('privileges/revoke')
  async revoke(
    @Body() body: { user: string; database: string; host?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.user || !body.database) {
      return res.status(400).json({ success: false, error: 'user and database required' });
    }
    try {
      const data = await this.db.revokePrivileges(body.user, body.database, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('privileges')
  async getPrivileges(
    @Query('user') user: string,
    @Query('host') host: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!user) return res.status(400).json({ success: false, error: 'user required' });
    try {
      const privileges = await this.db.getUserPrivileges(user, host);
      return res.json({ success: true, privileges });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
