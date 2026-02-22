import {
  Controller, Get, Post, Delete, Body, Param, Res,
  UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BackupService } from './backup.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('backup')
@UseGuards(AuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /* ─── List ─────────────────────────────────────────────────── */
  @Get()
  async list() {
    return this.backupService.listBackups();
  }

  /* ─── Create ───────────────────────────────────────────────── */
  @Post()
  async create(@Body('type') type: string) {
    if (!['full', 'panel', 'mail', 'databases', 'domains'].includes(type)) {
      throw new HttpException('Invalid backup type', HttpStatus.BAD_REQUEST);
    }
    return this.backupService.createBackup(type as any);
  }

  /* ─── Restore ──────────────────────────────────────────────── */
  @Post(':filename/restore')
  async restore(@Param('filename') filename: string) {
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new HttpException('Invalid filename', HttpStatus.BAD_REQUEST);
    }
    return this.backupService.restoreBackup(filename);
  }

  /* ─── Delete ───────────────────────────────────────────────── */
  @Delete(':filename')
  async delete(@Param('filename') filename: string) {
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new HttpException('Invalid filename', HttpStatus.BAD_REQUEST);
    }
    return this.backupService.deleteBackup(filename);
  }

  /* ─── Download ─────────────────────────────────────────────── */
  @Get(':filename/download')
  async download(@Param('filename') filename: string, @Res() res: Response) {
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new HttpException('Invalid filename', HttpStatus.BAD_REQUEST);
    }
    const backupDir = process.env.BACKUP_DIR || '/home/backups/clearpanel';
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new HttpException('Backup not found', HttpStatus.NOT_FOUND);
    }
    res.download(filePath, filename);
  }

  /* ─── Schedule ─────────────────────────────────────────────── */
  @Get('schedule')
  async getSchedule() {
    return this.backupService.getSchedule();
  }

  @Post('schedule')
  async saveSchedule(@Body() schedule: any) {
    return this.backupService.saveSchedule(schedule);
  }
}
