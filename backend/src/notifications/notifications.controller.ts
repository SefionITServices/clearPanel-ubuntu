import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MarkMultipleDto } from './dto/mark-multiple.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Query('filter') filter?: string) {
    const f = (filter as 'all' | 'unread' | 'read') || 'unread';
    return this.notificationsService.list(f);
  }

  @Get('count')
  async count() {
    const count = await this.notificationsService.countUnread();
    return { count };
  }

  @Put(':id')
  async markOne(@Param('id') id: string) {
    const res = await this.notificationsService.markAsRead(id);
    return { ok: !!res, notification: res };
  }

  @Put()
  async markMultiple(@Body() body: MarkMultipleDto) {
    const changed = await this.notificationsService.markMultipleAsRead(body.ids || []);
    return { ok: true, changed };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const ok = await this.notificationsService.delete(id);
    return { ok };
  }
}
