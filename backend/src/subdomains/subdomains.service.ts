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
  ) {
    const fullName = `${prefix.trim().toLowerCase()}.${parentDomain.trim().toLowerCase()}`;
    const { domain, logs } = await this.domainsService.addDomain(
      username,
      fullName,
      folderPath || undefined,
      undefined, // use default nameservers
      folderPath ? undefined : 'public_html', // default path mode
      phpVersion,
    );
    return { domain, logs };
  }

  async deleteSubdomain(id: string) {
    return this.domainsService.deleteDomain(id);
  }
}
