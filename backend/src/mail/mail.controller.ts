import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { MailService, DomainSettingsUpdate } from './mail.service';
import { MailStatusService } from './mail-status.service';

@UseGuards(ThrottlerGuard)
@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly mailStatusService: MailStatusService,
  ) {}

  @SkipThrottle()
  @Get('status')
  getStatus() {
    return this.mailStatusService.getStatus();
  }

  @SkipThrottle()
  @Get('domains')
  listDomains() {
    return this.mailService.listDomains();
  }

  @Throttle(10, 60)
  @Post('domains')
  async createDomain(
    @Body()
    body: {
      domain: string;
      spamThreshold?: number;
      greylistingEnabled?: boolean;
      greylistingDelaySeconds?: number;
      virusScanEnabled?: boolean;
    },
  ) {
    if (!body.domain) {
      throw new BadRequestException('domain is required');
    }

    const options: DomainSettingsUpdate = {};
    let hasOptions = false;
    if (body.spamThreshold !== undefined) {
      options.spamThreshold = body.spamThreshold;
      hasOptions = true;
    }
    if (body.greylistingEnabled !== undefined) {
      options.greylistingEnabled = body.greylistingEnabled;
      hasOptions = true;
    }
    if (body.greylistingDelaySeconds !== undefined) {
      options.greylistingDelaySeconds = body.greylistingDelaySeconds;
      hasOptions = true;
    }
    if (body.virusScanEnabled !== undefined) {
      options.virusScanEnabled = body.virusScanEnabled;
      hasOptions = true;
    }

    return this.mailService.createDomain(body.domain, hasOptions ? options : undefined);
  }

  @Throttle(10, 60)
  @Delete('domains/:id')
  deleteDomain(@Param('id') id: string) {
    return this.mailService.deleteDomain(id);
  }

  @Throttle(10, 60)
  @Patch('domains/:id/settings')
  updateDomainSettings(
    @Param('id') id: string,
    @Body()
    body: {
      spamThreshold?: number | null;
      greylistingEnabled?: boolean | null;
      greylistingDelaySeconds?: number | null;
      virusScanEnabled?: boolean | null;
    },
  ) {
    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('Provide at least one setting to update');
    }

    const updates: DomainSettingsUpdate = {};
    let hasUpdates = false;
    if (body.spamThreshold !== undefined) {
      updates.spamThreshold = body.spamThreshold;
      hasUpdates = true;
    }
    if (body.greylistingEnabled !== undefined) {
      updates.greylistingEnabled = body.greylistingEnabled;
      hasUpdates = true;
    }
    if (body.greylistingDelaySeconds !== undefined) {
      updates.greylistingDelaySeconds = body.greylistingDelaySeconds;
      hasUpdates = true;
    }
    if (body.virusScanEnabled !== undefined) {
      updates.virusScanEnabled = body.virusScanEnabled;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      throw new BadRequestException('Provide at least one setting to update');
    }

    return this.mailService.updateDomainSettings(id, updates);
  }

  @Throttle(5, 60)
  @Post('domains/:id/mailboxes')
  addMailbox(
    @Param('id') id: string,
    @Body() body: { email: string; password?: string; passwordHash?: string; quotaMb?: number },
  ) {
    if (!body.email) {
      throw new BadRequestException('email is required');
    }
    if (!body.password && !body.passwordHash) {
      throw new BadRequestException('password or passwordHash is required');
    }
    return this.mailService.addMailbox(id, {
      email: body.email,
      password: body.password,
      passwordHash: body.passwordHash,
      quotaMb: body.quotaMb,
    });
  }

  @Throttle(10, 60)
  @Patch('domains/:id/mailboxes/:mailboxId')
  updateMailbox(
    @Param('id') id: string,
    @Param('mailboxId') mailboxId: string,
    @Body() body: { password?: string; passwordHash?: string; quotaMb?: number | null },
  ) {
    if (!body) {
      throw new BadRequestException('update payload is required');
    }
    if (!body.password && !body.passwordHash && body.quotaMb === undefined) {
      throw new BadRequestException('Provide password/passwordHash and/or quotaMb');
    }
    return this.mailService.updateMailbox(id, mailboxId, {
      password: body.password,
      passwordHash: body.passwordHash,
      quotaMb: body.quotaMb,
    });
  }

  @Throttle(10, 60)
  @Delete('domains/:id/mailboxes/:mailboxId')
  removeMailbox(@Param('id') id: string, @Param('mailboxId') mailboxId: string) {
    return this.mailService.removeMailbox(id, mailboxId);
  }

  @Throttle(10, 60)
  @Post('domains/:id/aliases')
  addAlias(@Param('id') id: string, @Body() body: { source: string; destination: string }) {
    if (!body.source || !body.destination) {
      throw new BadRequestException('source and destination are required');
    }
    return this.mailService.addAlias(id, body.source, body.destination);
  }

  @Throttle(10, 60)
  @Delete('domains/:id/aliases/:aliasId')
  removeAlias(@Param('id') id: string, @Param('aliasId') aliasId: string) {
    return this.mailService.removeAlias(id, aliasId);
  }

  @Throttle(10, 60)
  @Patch('domains/:id/aliases/:aliasId')
  updateAlias(
    @Param('id') id: string,
    @Param('aliasId') aliasId: string,
    @Body() body: { destination: string },
  ) {
    if (!body?.destination) {
      throw new BadRequestException('destination is required');
    }
    return this.mailService.updateAlias(id, aliasId, { destination: body.destination });
  }

  @SkipThrottle()
  @Get('domains/:id/dns')
  getDnsSuggestions(@Param('id') id: string) {
    return this.mailService.getDnsSuggestions(id);
  }

  @SkipThrottle()
  @Get('domains/:id/logs')
  getDomainLogs(@Param('id') id: string, @Query('limit') limit?: string) {
    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      const numeric = Number.parseInt(limit, 10);
      if (Number.isNaN(numeric) || numeric <= 0) {
        throw new BadRequestException('limit must be a positive integer');
      }
      parsedLimit = numeric;
    }

    return this.mailService.getDomainLogs(id, parsedLimit);
  }

  @Throttle(5, 60)
  @Post('domains/:id/dkim/rotate')
  rotateDkim(@Param('id') id: string, @Body() body: { selector?: string }) {
    return this.mailService.rotateDkim(id, body?.selector);
  }
}
