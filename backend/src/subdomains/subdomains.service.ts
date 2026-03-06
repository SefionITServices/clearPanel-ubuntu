import { Injectable } from '@nestjs/common';
import { DomainsService } from '../domains/domains.service';
import { Domain } from '../domains/domain.model';

export interface SubdomainRecord extends Domain {
  parentDomain: string;
}

@Injectable()
export class SubdomainsService {
  constructor(private readonly domainsService: DomainsService) {}

  async listSubdomains(): Promise<SubdomainRecord[]> {
    const domains = await this.domainsService.listDomains();
    const result: SubdomainRecord[] = [];
    for (const d of domains) {
      const parent = domains.find(
        (p) => p.id !== d.id && d.name.endsWith('.' + p.name),
      );
      if (parent) {
        result.push({ ...d, parentDomain: parent.name });
      }
    }
    return result;
  }

  async createSubdomain(
    username: string,
    prefix: string,
    parentDomain: string,
    folderPath?: string,
    phpVersion?: string,
    pathMode?: string,
  ) {
    const fullName = `${prefix.trim().toLowerCase()}.${parentDomain.trim().toLowerCase()}`;

    // Resolve folderPath and pathMode similar to DomainCreate frontend logic
    let resolvedFolderPath: string | undefined = folderPath;
    let resolvedPathMode: string | undefined = pathMode ?? 'public_html';

    if (pathMode === 'websites') {
      // Compute websites path server-side using the username
      const safeUser = (username ?? '').trim() || 'clearpanel';
      resolvedFolderPath = `/home/${safeUser}/websites/${fullName}`;
      resolvedPathMode = undefined;
    } else if (pathMode === 'root') {
      // Root mode = default backend behavior (no pathMode passed)
      resolvedPathMode = undefined;
    } else if (pathMode === 'custom') {
      // Custom: folderPath is already set, clear pathMode
      resolvedPathMode = undefined;
    }

    const { domain, logs } = await this.domainsService.addDomain(
      username,
      fullName,
      resolvedFolderPath,
      undefined, // use default nameservers
      resolvedPathMode,
      phpVersion,
      true, // skipMail — subdomains don't need their own mail stack
    );
    return { domain, logs };
  }

  async deleteSubdomain(id: string) {
    return this.domainsService.deleteDomain(id);
  }
}
