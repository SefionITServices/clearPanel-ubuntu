import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { DockerService } from './docker.service';
import { PullImageDto, RunContainerDto, CreateComposeDto, ComposeActionDto } from './dto/docker.dto';

@Controller('docker')
@UseGuards(AuthGuard)
export class DockerController {
  constructor(private readonly docker: DockerService) {}

  // ── Status & install ────────────────────────────────────────────────────────

  @Get('status')
  async status(@Res() res: Response) {
    try { return res.json(await this.docker.getStatus()); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Post('install')
  async install(@Res() res: Response) {
    try { return res.json(await this.docker.install()); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  // ── Containers ─────────────────────────────────────────────────────────────

  @Get('containers')
  async listContainers(@Query('all') all: string, @Res() res: Response) {
    try { return res.json({ success: true, containers: await this.docker.listContainers(all !== 'false') }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Post('containers')
  async run(@Body() dto: RunContainerDto, @Res() res: Response) {
    try { return res.json(await this.docker.runContainer(dto)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post('containers/:id/:action')
  async containerAction(@Param('id') id: string, @Param('action') action: any, @Res() res: Response) {
    try { return res.json(await this.docker.containerAction(id, action)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Delete('containers/:id')
  async removeContainer(@Param('id') id: string, @Query('force') force: string, @Res() res: Response) {
    try { return res.json(await this.docker.removeContainer(id, force === 'true')); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Get('containers/:id/logs')
  async logs(@Param('id') id: string, @Query('tail') tail: string, @Res() res: Response) {
    try { return res.json({ success: true, logs: await this.docker.getContainerLogs(id, tail ? parseInt(tail) : 200) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Get('containers/:id/inspect')
  async inspect(@Param('id') id: string, @Res() res: Response) {
    try { return res.json({ success: true, data: await this.docker.inspectContainer(id) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Get('stats')
  async stats(@Res() res: Response) {
    try { return res.json({ success: true, stats: await this.docker.getStats() }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  // ── Images ─────────────────────────────────────────────────────────────────

  @Get('images')
  async listImages(@Res() res: Response) {
    try { return res.json({ success: true, images: await this.docker.listImages() }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Post('images/pull')
  async pullImage(@Body() dto: PullImageDto, @Res() res: Response) {
    try { return res.json(await this.docker.pullImage(dto)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Delete('images/:id')
  async removeImage(@Param('id') id: string, @Query('force') force: string, @Res() res: Response) {
    try { return res.json(await this.docker.removeImage(id, force === 'true')); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  // ── Compose stacks ─────────────────────────────────────────────────────────

  @Get('stacks')
  async listStacks(@Res() res: Response) {
    try { return res.json({ success: true, stacks: await this.docker.listStacks() }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Post('stacks')
  async createStack(@Body() dto: CreateComposeDto, @Res() res: Response) {
    try { return res.json(await this.docker.createStack(dto)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Delete('stacks/:name')
  async deleteStack(@Param('name') name: string, @Res() res: Response) {
    try { return res.json(await this.docker.deleteStack(name)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post('stacks/up')
  async composeUp(@Body() dto: ComposeActionDto, @Res() res: Response) {
    try { return res.json(await this.docker.composeUp(dto.projectPath)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post('stacks/down')
  async composeDown(@Body() dto: ComposeActionDto, @Res() res: Response) {
    try { return res.json(await this.docker.composeDown(dto.projectPath)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Get('stacks/logs')
  async composeLogs(@Query('projectPath') projectPath: string, @Query('tail') tail: string, @Res() res: Response) {
    try { return res.json({ success: true, logs: await this.docker.composeLogs(projectPath, tail ? parseInt(tail) : 100) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Get('stacks/file')
  async getComposeFile(@Query('projectPath') projectPath: string, @Res() res: Response) {
    try { return res.json({ success: true, content: await this.docker.getComposeFile(projectPath) }); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  @Post('stacks/file')
  async saveComposeFile(@Body() body: { projectPath: string; content: string }, @Res() res: Response) {
    try { return res.json(await this.docker.saveComposeFile(body.projectPath, body.content)); }
    catch (e: any) { return res.status(400).json({ success: false, error: e.message }); }
  }

  // ── Networks & volumes ─────────────────────────────────────────────────────

  @Get('networks')
  async networks(@Res() res: Response) {
    try { return res.json({ success: true, networks: await this.docker.listNetworks() }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Get('volumes')
  async volumes(@Res() res: Response) {
    try { return res.json({ success: true, volumes: await this.docker.listVolumes() }); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }

  @Post('prune')
  async prune(@Res() res: Response) {
    try { return res.json(await this.docker.pruneSystem()); }
    catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }
}
