import { Controller, Get, Post, Delete, Body, Param, Query, Headers, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CloudService } from './cloud.service';
import {
  CloudOverviewStats,
  S3Bucket,
  S3AccessKey,
  CreateBucketDto,
  SesApiKey,
  SendEmailDto,
  EmailLogEntry,
  VaultSecret,
  SaveSecretDto,
  RedisCacheInfo,
} from './cloud.types';

@Controller('cloud')
export class CloudController {
  constructor(private readonly cloudService: CloudService) {}

  @Get('stats')
  @UseGuards(AuthGuard)
  async getStats(): Promise<CloudOverviewStats> {
    return this.cloudService.getOverviewStats();
  }

  // ── S3 Object Storage (ClearStorage) ───────────────────────────────────────

  @Get('s3/buckets')
  @UseGuards(AuthGuard)
  async listBuckets(): Promise<{ success: boolean; buckets: S3Bucket[] }> {
    const buckets = await this.cloudService.listBuckets();
    return { success: true, buckets };
  }

  @Post('s3/buckets')
  @UseGuards(AuthGuard)
  async createBucket(@Body() dto: CreateBucketDto): Promise<{ success: boolean; bucket: S3Bucket }> {
    const bucket = await this.cloudService.createBucket(dto);
    return { success: true, bucket };
  }

  @Delete('s3/buckets/:name')
  @UseGuards(AuthGuard)
  async deleteBucket(@Param('name') name: string): Promise<{ success: boolean; message: string }> {
    return this.cloudService.deleteBucket(name);
  }

  @Get('s3/keys')
  @UseGuards(AuthGuard)
  async listS3Keys(): Promise<{ success: boolean; keys: S3AccessKey[] }> {
    const keys = await this.cloudService.listS3Keys();
    return { success: true, keys };
  }

  @Post('s3/keys')
  @UseGuards(AuthGuard)
  async createS3Key(@Body('name') name: string): Promise<{ success: boolean; key: S3AccessKey }> {
    const key = await this.cloudService.createS3Key(name || 'Default Key');
    return { success: true, key };
  }

  @Delete('s3/keys/:id')
  @UseGuards(AuthGuard)
  async deleteS3Key(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.cloudService.deleteS3Key(id);
  }

  // ── Transactional Email API (ClearSES) ────────────────────────────────────

  @Get('ses/keys')
  @UseGuards(AuthGuard)
  async listSesKeys(): Promise<{ success: boolean; keys: SesApiKey[] }> {
    const keys = await this.cloudService.listSesKeys();
    return { success: true, keys };
  }

  @Post('ses/keys')
  @UseGuards(AuthGuard)
  async createSesKey(
    @Body('name') name: string,
    @Body('domain') domain?: string,
  ): Promise<{ success: boolean; key: SesApiKey }> {
    const key = await this.cloudService.createSesKey(name, domain);
    return { success: true, key };
  }

  @Post('ses/keys/:id/revoke')
  @UseGuards(AuthGuard)
  async revokeSesKey(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.cloudService.revokeSesKey(id);
  }

  @Post('ses/send')
  async sendEmail(
    @Body() dto: SendEmailDto,
    @Headers('authorization') auth?: string,
  ): Promise<{ success: boolean; messageId: string }> {
    return this.cloudService.sendEmail(dto, auth);
  }

  @Get('ses/logs')
  @UseGuards(AuthGuard)
  async getEmailLogs(): Promise<{ success: boolean; logs: EmailLogEntry[] }> {
    const logs = await this.cloudService.getEmailLogs();
    return { success: true, logs };
  }

  // ── Secrets & Environment Vault (ClearVault) ──────────────────────────────

  @Get('vault/secrets')
  @UseGuards(AuthGuard)
  async listSecrets(
    @Query('project') project?: string,
    @Query('env') env?: string,
  ): Promise<{ success: boolean; secrets: VaultSecret[] }> {
    const secrets = await this.cloudService.listSecrets(project, env);
    return { success: true, secrets };
  }

  @Post('vault/secrets')
  @UseGuards(AuthGuard)
  async saveSecret(@Body() dto: SaveSecretDto): Promise<{ success: boolean; secret: VaultSecret }> {
    const secret = await this.cloudService.saveSecret(dto);
    return { success: true, secret };
  }

  @Delete('vault/secrets/:id')
  @UseGuards(AuthGuard)
  async deleteSecret(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.cloudService.deleteSecret(id);
  }

  @Get('vault/export')
  @UseGuards(AuthGuard)
  async exportEnv(
    @Query('project') project: string,
    @Query('env') env: 'production' | 'staging' | 'development',
  ): Promise<{ success: boolean; envContent: string }> {
    const envContent = await this.cloudService.exportEnv(project || 'default', env || 'production');
    return { success: true, envContent };
  }

  // ── Redis Cache (ClearCache) ──────────────────────────────────────────────

  @Get('cache/redis')
  @UseGuards(AuthGuard)
  async getRedisInfo(): Promise<RedisCacheInfo> {
    return this.cloudService.getRedisInfo();
  }
}
