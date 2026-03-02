import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { NodeAppsService } from './node-apps.service';
import { CreateAppDto, UpdateAppDto, CloneAppDto } from './dto/node-apps.dto';

@Controller('node-apps')
@UseGuards(AuthGuard)
export class NodeAppsController {
  constructor(private readonly svc: NodeAppsService) {}

  @Get('runtimes')
  async runtimes(@Res() res: Response) {
    try { return res.json({ success: true, runtimes: await this.svc.getRuntimes() }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Get('pm2/status')
  async pm2Status(@Res() res: Response) {
    try { return res.json(await this.svc.getPm2Status()); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Post('pm2/install')
  async installPm2(@Res() res: Response) {
    try { return res.json(await this.svc.installPm2()); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Get()
  async list(@Res() res: Response) {
    try { return res.json({ success: true, apps: await this.svc.listApps() }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Post()
  async create(@Body() dto: CreateAppDto, @Res() res: Response) {
    try { return res.json({ success: true, app: await this.svc.createApp(dto) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post('clone')
  async clone(@Body() dto: CloneAppDto, @Res() res: Response) {
    try { return res.json({ success: true, app: await this.svc.cloneAndCreate(dto) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAppDto, @Res() res: Response) {
    try { return res.json({ success: true, app: await this.svc.updateApp(id, dto) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    try { return res.json(await this.svc.deleteApp(id)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post(':id/start')
  async start(@Param('id') id: string, @Res() res: Response) {
    try { return res.json(await this.svc.startApp(id)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string, @Res() res: Response) {
    try { return res.json(await this.svc.stopApp(id)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post(':id/restart')
  async restart(@Param('id') id: string, @Res() res: Response) {
    try { return res.json(await this.svc.restartApp(id)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Get(':id/logs')
  async logs(@Param('id') id: string, @Query('lines') lines: string, @Res() res: Response) {
    try { return res.json({ success: true, logs: await this.svc.getAppLogs(id, lines ? parseInt(lines) : 200) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post(':id/pull')
  async pull(@Param('id') id: string, @Res() res: Response) {
    try { return res.json(await this.svc.pullAndRestart(id)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post(':id/env')
  async setEnv(@Param('id') id: string, @Body() body: { env: { key: string; value: string }[] }, @Res() res: Response) {
    try { return res.json({ success: true, app: await this.svc.setEnv(id, body.env) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }
}
