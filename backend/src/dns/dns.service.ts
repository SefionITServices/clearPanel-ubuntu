import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface DnsRecord {
  id: string;
  type: 'A' | 'CNAME' | 'MX' | 'TXT';
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

  async ensureDefaultZone(domain: string): Promise<DnsZone> {
    const zones = await this.readZones();
    let zone = zones.find(z => z.domain === domain);
    if (!zone) {
      const serverIp = process.env.SERVER_IP || '127.0.0.1';
      zone = {
        domain,
        records: [
          { id: randomUUID(), type: 'A', name: '@', value: serverIp, ttl: 3600 },
          { id: randomUUID(), type: 'CNAME', name: 'www', value: domain, ttl: 3600 },
        ],
      };
      zones.push(zone);
      await this.writeZones(zones);
    }
    return zone;
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
