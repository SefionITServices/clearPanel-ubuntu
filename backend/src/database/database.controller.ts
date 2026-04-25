import { Controller, Get, Post, Delete, Body, Param, Req, Res, HttpStatus, Query, UseInterceptors, UseGuards } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { DatabaseService } from './database.service';
import { AuthGuard } from '../auth/auth.guard';
import {
  CreateDatabaseDto, DeleteDatabaseDto, CreateUserDto, DeleteUserDto,
  ChangePasswordDto, GrantPrivilegesDto, RevokePrivilegesDto, ExecuteQueryDto,
  EngineActionDto, TableOperationDto, SetRemoteAccessDto, UpdateUserHostDto,
} from './dto/database.dto';

@Controller('database')
@UseGuards(AuthGuard)
export class DatabaseController {
  constructor(private readonly db: DatabaseService) {}

  private isPg(engine?: string): boolean {
    return engine === 'postgresql' || engine === 'pg';
  }

  // ========================
  // STATUS
  // ========================

  @Get('status')
  async status(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.db.getStatus();
      return res.json({ success: true, ...data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('engines')
  async engines(@Req() req: Request, @Res() res: Response) {
    try {
      const engines = await this.db.getAllEngineStatus();
      return res.json({ success: true, engines });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('install')
  async install(@Req() req: Request, @Res() res: Response) {
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
  async createDatabase(@Body() body: CreateDatabaseDto, @Req() req: Request, @Res() res: Response) {
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
  async deleteDatabase(@Body() body: DeleteDatabaseDto, @Req() req: Request, @Res() res: Response) {
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
    @Body() body: CreateUserDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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
    @Body() body: DeleteUserDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = this.isPg(body.engine)
        ? await this.db.changePgPassword(body.name, body.password)
        : await this.db.changePassword(body.name, body.password, body.host);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('users/host')
  async updateUserHost(
    @Body() body: UpdateUserHostDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = this.isPg(body.engine)
        ? await this.db.updatePgUserHost(body.name, body.newHost)
        : await this.db.updateUserHost(body.name, body.oldHost, body.newHost);
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
    @Body() body: GrantPrivilegesDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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
    @Body() body: RevokePrivilegesDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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

  // ========================
  // EXPORT / BACKUP
  // ========================

  @Get('export/:database')
  async exportDatabase(
    @Param('database') database: string,
    @Query('engine') engine: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!database) return res.status(400).json({ success: false, error: 'database required' });
    try {
      const sql = this.isPg(engine)
        ? await this.db.exportPgDatabase(database)
        : await this.db.exportDatabase(database);
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${database}.sql"`);
      return res.send(sql);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // IMPORT / RESTORE
  // ========================

  @Post('import')
  @UseInterceptors(AnyFilesInterceptor())
  async importDatabase(@Req() req: Request, @Res() res: Response) {
    try {
      const { database, engine, sql: sqlBody } = req.body || {};
      if (!database) return res.status(400).json({ success: false, error: 'database required' });

      let sql = sqlBody || '';

      // Check for uploaded file
      const files: Express.Multer.File[] = (req as any).files || [];
      if (files.length > 0) {
        sql = files[0].buffer.toString('utf-8');
      }

      if (!sql) return res.status(400).json({ success: false, error: 'No SQL provided (upload a file or send sql in body)' });

      const data = this.isPg(engine)
        ? await this.db.importPgDatabase(database, sql)
        : await this.db.importDatabase(database, sql);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // SQL QUERY RUNNER
  // ========================

  @Post('query')
  async executeQuery(
    @Body() body: ExecuteQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = this.isPg(body.engine)
        ? await this.db.executePgQuery(body.database, body.sql)
        : await this.db.executeQuery(body.database, body.sql);
      return res.json({ success: true, ...result });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ========================
  // METRICS
  // ========================

  @Get('metrics')
  async metrics(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.db.getMetrics();
      return res.json({ success: true, ...data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // UNINSTALL
  // ========================

  @Post('uninstall/:engine')
  async uninstallEngine(
    @Param('engine') engine: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const valid = ['mariadb', 'mysql', 'postgresql'];
    if (!valid.includes(engine)) {
      return res.status(400).json({ success: false, error: `Invalid engine. Use one of: ${valid.join(', ')}` });
    }
    try {
      const data = await this.db.uninstallEngine(engine as any);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // ENGINE LIFECYCLE (start / stop / restart / logs / diagnose)
  // ========================

  @Post('engine/start')
  async startEngine(
    @Body() body: EngineActionDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = await this.db.startEngine(body.engine as any);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('engine/stop')
  async stopEngine(
    @Body() body: EngineActionDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = await this.db.stopEngine(body.engine as any);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('engine/restart')
  async restartEngine(
    @Body() body: EngineActionDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = await this.db.restartEngine(body.engine as any);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('engine/logs')
  async getEngineLogs(
    @Query('engine') engine: string,
    @Query('lines') lines: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const valid = ['mariadb', 'mysql', 'postgresql'];
    if (!engine || !valid.includes(engine)) {
      return res.status(400).json({ success: false, error: `Invalid engine. Use one of: ${valid.join(', ')}` });
    }
    try {
      const data = await this.db.getEngineLogs(engine as any, lines ? parseInt(lines, 10) : 50);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('engine/diagnose')
  async diagnoseEngine(
    @Query('engine') engine: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const valid = ['mariadb', 'mysql', 'postgresql'];
    if (!engine || !valid.includes(engine)) {
      return res.status(400).json({ success: false, error: `Invalid engine. Use one of: ${valid.join(', ')}` });
    }
    try {
      const data = await this.db.diagnoseEngine(engine as any);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // REMOTE ACCESS
  // ========================

  @Get('connection-info')
  async getConnectionInfo(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.db.getConnectionInfo();
      return res.json({ success: true, ...data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========================
  // TABLE OPERATIONS (REPAIR / OPTIMIZE / CHECK)
  // ========================

  @Post('tables/repair')
  async repairTable(
    @Body() body: TableOperationDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = await this.db.repairTable(body.database, body.table);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('tables/optimize')
  async optimizeTable(
    @Body() body: TableOperationDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = await this.db.optimizeTable(body.database, body.table);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Post('tables/check')
  async checkTable(
    @Body() body: TableOperationDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = await this.db.checkTable(body.database, body.table);
      return res.json(data);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  @Get('remote-access')
  async getRemoteAccess(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.db.getRemoteAccessStatus();
      return res.json({ success: true, ...data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('remote-access')
  async setRemoteAccess(
    @Body() body: SetRemoteAccessDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const data = await this.db.setRemoteAccess(body.engine, body.enabled);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
