import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { MailingListsService } from './mailing-lists.service';

@Controller('mailing-lists')
@UseGuards(AuthGuard)
export class MailingListsController {
  constructor(private readonly svc: MailingListsService) {}

  @Get()
  async list(@Query('domain') domain: string) {
    if (!domain) throw new BadRequestException('domain query parameter required');
    return this.svc.list(domain);
  }

  @Post()
  async createList(@Body() body: { domain: string; name: string; subscribers: string[] }) {
    return this.svc.create(body);
  }

  @Delete(':id')
  async deleteList(@Param('id') id: string) {
    return this.svc.deleteList(id);
  }

  @Post(':id/subscribers')
  async addSubscriber(
    @Param('id') id: string,
    @Body() body: { email: string }
  ) {
    if (!body?.email) throw new BadRequestException('email is required');
    return this.svc.addSubscriber(id, body.email);
  }

  @Delete(':id/subscribers/:email')
  async removeSubscriber(
    @Param('id') id: string,
    @Param('email') email: string
  ) {
    return this.svc.removeSubscriber(id, email);
  }
}
