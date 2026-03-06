import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SubdomainsService } from './subdomains.service';
import { CreateSubdomainDto } from './dto/subdomain.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('subdomains')
@UseGuards(AuthGuard)
export class SubdomainsController {
  constructor(private readonly subdomainsService: SubdomainsService) {}

  @Get()
  listSubdomains() {
    return this.subdomainsService.listSubdomains();
  }

  @Post()
  async createSubdomain(@Body() body: CreateSubdomainDto, @Req() req: any) {
    const username = req.session?.username ?? 'admin';
    const { domain, logs } = await this.subdomainsService.createSubdomain(
      username,
      body.prefix,
      body.parentDomain,
      body.folderPath,
      body.phpVersion,
    );
    return { success: true, subdomain: domain, automationLogs: logs };
  }

  @Delete(':id')
  async deleteSubdomain(@Param('id') id: string) {
    const result = await this.subdomainsService.deleteSubdomain(id);
    if (!result) {
      return { success: false, message: 'Subdomain not found' };
    }
    return {
      success: true,
      message: 'Subdomain deleted successfully',
      automationLogs: result.logs,
    };
  }
}
