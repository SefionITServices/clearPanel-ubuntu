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

  private isPg(engine?: string): boolean {
    return engine === 'postgresql' || engine === 'pg';
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

  @Get('engines')
  async engines(@Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const engines = await this.db.getAllEngineStatus();
      return res.json({ success: true, engines });
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

  @Post('install/:engine')
  async installEngine(
    @Param('engine') engine: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    const valid = ['mariadb', 'mysql', 'postgresql'];
    if (!valid.includes(engine)) {
      return res.status(400).json({ success: false, error: `Invalid engine. Use one of: ${valid.join(', ')}` });
    }
    try {
      const data = await this.db.installEngine(engine as any);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // DATABASES
  // ========================

  @Get('list')
  async listDatabases(@Query('engine') engine: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const databases = this.isPg(engine)
        ? await this.db.listPgDatabases()
        : await this.db.listDatabases();
      return res.json({ success: true, databases });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('create')
  async createDatabase(@Body() body: { name: string; engine?: string }, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name) return res.status(400).json({ success: false, error: 'name required' });
    try {
      const data = this.isPg(body.engine)
        ? await this.db.createPgDatabase(body.name)
        : await this.db.createDatabase(body.name);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('delete')
  async deleteDatabase(@Body() body: { name: string; engine?: string }, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name) return res.status(400).json({ success: false, error: 'name required' });
    try {
      const data = this.isPg(body.engine)
        ? await this.db.deletePgDatabase(body.name)
        : await this.db.deleteDatabase(body.name);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('tables')
  async listTables(
    @Query('database') database: string,
    @Query('engine') engine: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!database) return res.status(400).json({ success: false, error: 'database required' });
    try {
      const tables = this.isPg(engine)
        ? await this.db.listPgTables(database)
        : await this.db.listTables(database);
      return res.json({ success: true, tables });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ========================
  // USERS
  // ========================

  @Get('users')
  async listUsers(@Query('engine') engine: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const users = this.isPg(engine)
        ? await this.db.listPgUsers()
        : await this.db.listUsers();
      return res.json({ success: true, users });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('users/create')
  async createUser(
    @Body() body: { name: string; password: string; host?: string; engine?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name || !body.password) {
      return res.status(400).json({ success: false, error: 'name and password required' });
    }
    try {
      const data = this.isPg(body.engine)
        ? await this.db.createPgUser(body.name, body.password)
        : await this.db.createUser(body.name, body.password, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('users/delete')
  async deleteUser(
    @Body() body: { name: string; host?: string; engine?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name) return res.status(400).json({ success: false, error: 'name required' });
    try {
      const data = this.isPg(body.engine)
        ? await this.db.deletePgUser(body.name)
        : await this.db.deleteUser(body.name, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('users/password')
  async changePassword(
    @Body() body: { name: string; password: string; host?: string; engine?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.name || !body.password) {
      return res.status(400).json({ success: false, error: 'name and password required' });
    }
    try {
      const data = this.isPg(body.engine)
        ? await this.db.changePgPassword(body.name, body.password)
        : await this.db.changePassword(body.name, body.password, body.host);
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
    @Body() body: { user: string; database: string; privileges?: string[]; host?: string; engine?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.user || !body.database) {
      return res.status(400).json({ success: false, error: 'user and database required' });
    }
    try {
      const data = this.isPg(body.engine)
        ? await this.db.grantPgPrivileges(body.user, body.database, body.privileges)
        : await this.db.grantPrivileges(body.user, body.database, body.privileges, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('privileges/revoke')
  async revoke(
    @Body() body: { user: string; database: string; host?: string; engine?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!body.user || !body.database) {
      return res.status(400).json({ success: false, error: 'user and database required' });
    }
    try {
      const data = this.isPg(body.engine)
        ? await this.db.revokePgPrivileges(body.user, body.database)
        : await this.db.revokePrivileges(body.user, body.database, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('privileges')
  async getPrivileges(
    @Query('user') user: string,
    @Query('host') host: string,
    @Query('engine') engine: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.ensureAuth(req, res)) return;
    if (!user) return res.status(400).json({ success: false, error: 'user required' });
    try {
      const privileges = this.isPg(engine)
        ? await this.db.getPgUserPrivileges(user)
        : await this.db.getUserPrivileges(user, host);
      return res.json({ success: true, privileges });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
