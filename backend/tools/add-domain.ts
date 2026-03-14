#!/usr/bin/env ts-node
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DomainsService } from '../src/domains/domains.service';

async function main(): Promise<void> {
  const [, , domainArg, folderPathArg] = process.argv;
  if (!domainArg) {
    // eslint-disable-next-line no-console
    console.error('Usage: add-domain <domain> [folderPath]');
    process.exit(1);
  }

  const username = process.env.DOMAIN_USER || 'demo';
  const nameservers = process.env.DOMAIN_NAMESERVERS
    ? process.env.DOMAIN_NAMESERVERS.split(',').map((value) => value.trim()).filter(Boolean)
    : undefined;

  const appContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const domainsService = appContext.get(DomainsService);
    const result = await domainsService.addDomain(username, domainArg, folderPathArg, nameservers);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      domain: result.domain,
      nameservers: result.domain.nameservers,
      documentRoot: result.domain.folderPath,
      automationLogs: result.logs,
    }, null, 2));
  } finally {
    await appContext.close();
  }
}

main().catch((error) => {
  Logger.error(error?.message || error, 'add-domain');
  process.exit(1);
});
