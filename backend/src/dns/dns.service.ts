import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface DnsRecord {
  id: string;
  type: 'A' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  name: string; // '@', 'www', etc.
  value: string;
  ttl: number;
  priority?: number; // MX only
}

export interface DnsZone {
  domain: string;
  records: DnsRecord[];
}

const DNS_FILE = path.join(process.cwd(), 'dns.json');

@Injectable()
export class DnsService {
  private async readZones(): Promise<DnsZone[]> {
    try {
      const data = await fs.readFile(DNS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeZones(zones: DnsZone[]): Promise<void> {
    await fs.writeFile(DNS_FILE, JSON.stringify(zones, null, 2));
  }

  async ensureDefaultZone(
    domain: string,
    options?: {
      nameservers?: string[];
      serverIp?: string;
    },
  ): Promise<DnsZone> {
    const zones = await this.readZones();
    let zone = zones.find(z => z.domain === domain);

    const serverIp = options?.serverIp || process.env.SERVER_IP || '127.0.0.1';
    const nameservers = (options?.nameservers?.length ? options.nameservers : [`ns1.${domain}`, `ns2.${domain}`])
      .map(ns => (ns.endsWith('.') ? ns.slice(0, -1) : ns));
    const nameserverFqdns = nameservers.map(ns => (ns.endsWith('.') ? ns : `${ns}.`));

    if (!zone) {
      const records: DnsRecord[] = [
        { id: randomUUID(), type: 'A', name: '@', value: serverIp, ttl: 3600 },
        { id: randomUUID(), type: 'CNAME', name: 'www', value: domain, ttl: 3600 },
      ];

      nameservers.forEach(ns => {
        const fqdn = ns.endsWith('.') ? ns : `${ns}.`;
        records.push({
          id: randomUUID(),
          type: 'NS',
          name: '@',
          value: fqdn,
          ttl: 3600,
        });

        const suffix = `.${domain}`;
        const plain = ns.endsWith('.') ? ns.slice(0, -1) : ns;
        if (plain.toLowerCase().endsWith(suffix.toLowerCase())) {
          const label = plain.slice(0, -suffix.length) || '@';
          if (label !== '@') {
            records.push({
              id: randomUUID(),
              type: 'A',
              name: label,
              value: serverIp,
              ttl: 3600,
            });
          }
        }
      });

      const newZone: DnsZone = {
        domain,
        records,
      };

      zones.push(newZone);
      await this.writeZones(zones);
      zone = newZone;
    } else {
      let mutated = false;

      const ensureARecord = (label: string, value: string) => {
        const record = zone!.records.find(r => r.type === 'A' && r.name === label);
        if (!record) {
          zone!.records.push({ id: randomUUID(), type: 'A', name: label, value, ttl: 3600 });
          mutated = true;
          return;
        }
        if (record.value !== value) {
          record.value = value;
          mutated = true;
        }
      };

      if (serverIp) {
        ensureARecord('@', serverIp);
      }

      const wwwRecord = zone.records.find(r => r.name === 'www');
      if (!wwwRecord) {
        zone.records.push({ id: randomUUID(), type: 'CNAME', name: 'www', value: domain, ttl: 3600 });
        mutated = true;
      }

      const suffix = `.${domain}`;
      nameservers.forEach(ns => {
        const plain = ns.endsWith('.') ? ns.slice(0, -1) : ns;
        const fqdn = plain.endsWith('.') ? plain : `${plain}.`;
        const nsRecordExists = zone!.records.some(
          r => r.type === 'NS' && r.name === '@' && r.value.toLowerCase() === fqdn.toLowerCase(),
        );
        if (!nsRecordExists) {
          zone!.records.push({ id: randomUUID(), type: 'NS', name: '@', value: fqdn, ttl: 3600 });
          mutated = true;
        }

        if (plain.toLowerCase().endsWith(suffix.toLowerCase())) {
          const label = plain.slice(0, -suffix.length) || '@';
          if (label !== '@' && serverIp) {
            ensureARecord(label, serverIp);
          }
        }
      });

      // Remove stale NS records that match previous defaults (ns1/ns2 within domain) but are no longer desired.
      const desiredSet = new Set(nameserverFqdns.map(ns => (ns.endsWith('.') ? ns : `${ns}.`).toLowerCase()));
      const domainSuffixWithDot = `${domain}.`.toLowerCase();
      const nsBefore = zone.records.length;
      zone.records = zone.records.filter(record => {
        if (record.type !== 'NS' || record.name !== '@') {
          return true;
        }
        if (desiredSet.size === 0) {
          return true;
        }
        const valueLower = record.value.toLowerCase();
        if (desiredSet.has(valueLower)) {
          return true;
        }
        if (valueLower.endsWith(domainSuffixWithDot)) {
          return false;
        }
        return true;
      });
      if (zone.records.length !== nsBefore) {
        mutated = true;
      }

      if (mutated) {
        await this.writeZones(zones);
      }
    }

    return zone as DnsZone;
  }

  async listZones(): Promise<DnsZone[]> {
    return this.readZones();
  }

  async getZone(domain: string): Promise<DnsZone | null> {
    const zones = await this.readZones();
    return zones.find(z => z.domain === domain) || null;
  }

  async addRecord(domain: string, record: Omit<DnsRecord,'id'>): Promise<DnsRecord | null> {
    const zones = await this.readZones();
    const zone = zones.find(z => z.domain === domain);
    if (!zone) return null;
    const newRecord: DnsRecord = { id: randomUUID(), ...record };
    zone.records.push(newRecord);
    await this.writeZones(zones);
    return newRecord;
  }

  async updateRecord(domain: string, id: string, patch: Partial<Omit<DnsRecord,'id'>>): Promise<DnsRecord | null> {
    const zones = await this.readZones();
    const zone = zones.find(z => z.domain === domain);
    if (!zone) return null;
    const rec = zone.records.find(r => r.id === id);
    if (!rec) return null;
    Object.assign(rec, patch);
    await this.writeZones(zones);
    return rec;
  }

  async deleteRecord(domain: string, id: string): Promise<boolean> {
    const zones = await this.readZones();
    const zone = zones.find(z => z.domain === domain);
    if (!zone) return false;
    const before = zone.records.length;
    zone.records = zone.records.filter(r => r.id !== id);
    await this.writeZones(zones);
    return zone.records.length !== before;
  }

  async deleteZone(domain: string): Promise<boolean> {
    const zones = await this.readZones();
    const before = zones.length;
    const filtered = zones.filter(z => z.domain !== domain);
    await this.writeZones(filtered);
    return filtered.length !== before;
  }
}
