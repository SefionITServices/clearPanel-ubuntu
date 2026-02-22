import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { getPanelVersion } from '../migrations/migration-runner';

// ─── Types ────────────────────────────────────────────────────────────

export type LicensePlan = 'starter' | 'pro' | 'enterprise' | 'trial' | 'unknown';
export type LicenseStatus = 'active' | 'expired' | 'invalid' | 'grace' | 'unactivated';

export interface LicenseInfo {
  status: LicenseStatus;
  plan: LicensePlan;
  key: string | null;
  fingerprint: string;
  expiresAt: string | null;
  features: string[];
  panelVersion: string;
  lastChecked: string | null;
  graceDaysRemaining: number | null;
  message: string;
}

interface LicenseCache {
  status: LicenseStatus;
  plan: LicensePlan;
  expiresAt: string | null;
  features: string[];
  lastChecked: string;
  lastValid: string;
}

interface UpdateInfo {
  available: boolean;
  latestVersion: string;
  currentVersion: string;
  changelog: string;
  downloadUrl: string | null;
  releaseDate: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────

const API_BASE = 'https://api.clearpanel.net/v1';
const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const GRACE_PERIOD_DAYS = 7;                     // offline grace period
const EXPIRY_GRACE_DAYS = 30;                    // after license expires
const CACHE_FILENAME = 'license-cache.json';

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private cache: LicenseCache | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private fingerprint: string = '';

  constructor(private readonly configService: ConfigService) {}

  // ─── Lifecycle ──────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.fingerprint = await this.generateFingerprint();
    await this.loadCache();
    // Validate on startup (non-blocking — don't prevent boot)
    this.validateLicense().catch(err => {
      this.logger.warn(`Startup license check failed: ${err.message}`);
    });
    // Schedule periodic heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.validateLicense().catch(() => {});
    }, HEARTBEAT_INTERVAL);
  }

  // ─── Public API ─────────────────────────────────────────────────

  /** Get current license info for UI display */
  async getLicenseInfo(): Promise<LicenseInfo> {
    const key = this.getLicenseKey();
    const panelVersion = getPanelVersion();

    if (!key) {
      return {
        status: 'unactivated',
        plan: 'unknown',
        key: null,
        fingerprint: this.fingerprint,
        expiresAt: null,
        features: [],
        panelVersion,
        lastChecked: null,
        graceDaysRemaining: null,
        message: 'No license key configured. Activate a license to unlock all features.',
      };
    }

    if (!this.cache) {
      return {
        status: 'unactivated',
        plan: 'unknown',
        key: this.maskKey(key),
        fingerprint: this.fingerprint,
        expiresAt: null,
        features: [],
        panelVersion,
        lastChecked: null,
        graceDaysRemaining: null,
        message: 'License has not been validated yet.',
      };
    }

    const graceDays = this.getGraceDaysRemaining();

    return {
      status: this.cache.status === 'active' && graceDays !== null && graceDays < GRACE_PERIOD_DAYS
        ? 'grace' : this.cache.status,
      plan: this.cache.plan,
      key: this.maskKey(key),
      fingerprint: this.fingerprint,
      expiresAt: this.cache.expiresAt,
      features: this.cache.features,
      panelVersion,
      lastChecked: this.cache.lastChecked,
      graceDaysRemaining: graceDays,
      message: this.getStatusMessage(),
    };
  }

  /** Activate a license key */
  async activateLicense(key: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.apiCall('/license/activate', {
        method: 'POST',
        body: JSON.stringify({
          key: key.trim(),
          fingerprint: this.fingerprint,
          panelVersion: getPanelVersion(),
          hostname: os.hostname(),
        }),
      });

      if (response.valid) {
        // Write key to .env
        await this.setLicenseKey(key.trim());

        // Update cache
        this.cache = {
          status: 'active',
          plan: response.plan || 'starter',
          expiresAt: response.expiresAt || null,
          features: response.features || [],
          lastChecked: new Date().toISOString(),
          lastValid: new Date().toISOString(),
        };
        await this.saveCache();

        return { success: true, message: `License activated — ${response.plan} plan` };
      }

      return { success: false, message: response.message || 'Activation failed' };
    } catch (err: any) {
      return { success: false, message: `Could not reach license server: ${err.message}` };
    }
  }

  /** Deactivate current license (free the slot) */
  async deactivateLicense(): Promise<{ success: boolean; message: string }> {
    const key = this.getLicenseKey();
    if (!key) return { success: false, message: 'No license key configured' };

    try {
      await this.apiCall('/license/deactivate', {
        method: 'POST',
        body: JSON.stringify({ key, fingerprint: this.fingerprint }),
      });
    } catch {
      // Deactivation failure is non-critical — proceed with local removal
    }

    // Remove from .env and clear cache
    await this.removeLicenseKey();
    this.cache = null;
    await this.saveCache();

    return { success: true, message: 'License deactivated' };
  }

  /** Check for available updates */
  async checkForUpdate(): Promise<UpdateInfo> {
    const currentVersion = getPanelVersion();
    const key = this.getLicenseKey();

    if (!key) {
      return {
        available: false,
        latestVersion: currentVersion,
        currentVersion,
        changelog: '',
        downloadUrl: null,
        releaseDate: null,
      };
    }

    try {
      const response = await this.apiCall(
        `/releases/latest?license=${encodeURIComponent(key)}&current=${encodeURIComponent(currentVersion)}`,
        { method: 'GET' },
      );

      return {
        available: response.available ?? false,
        latestVersion: response.version || currentVersion,
        currentVersion,
        changelog: response.changelog || '',
        downloadUrl: response.url || null,
        releaseDate: response.releaseDate || null,
      };
    } catch (err: any) {
      this.logger.warn(`Update check failed: ${err.message}`);
      return {
        available: false,
        latestVersion: currentVersion,
        currentVersion,
        changelog: '',
        downloadUrl: null,
        releaseDate: null,
      };
    }
  }

  // ─── Feature Gating ─────────────────────────────────────────────

  /** Check if the current license allows a specific feature */
  isFeatureAllowed(feature: string): boolean {
    if (!this.cache) return true; // No license system → allow all (dev mode)
    if (this.cache.status !== 'active' && this.cache.status !== 'grace' as any) return false;
    if (this.cache.features.length === 0) return true; // Empty = all features
    return this.cache.features.includes(feature) || this.cache.features.includes('*');
  }

  /** Check if the panel should operate in read-only mode (expired 30+ days) */
  isReadOnly(): boolean {
    if (!this.cache) return false; // No cache = first run or dev, allow everything
    if (this.cache.status === 'active') return false;
    if (this.cache.status === 'expired') {
      // Check if we're past the expiry grace period
      if (this.cache.expiresAt) {
        const expiry = new Date(this.cache.expiresAt).getTime();
        const now = Date.now();
        const daysPastExpiry = (now - expiry) / (24 * 60 * 60 * 1000);
        return daysPastExpiry > EXPIRY_GRACE_DAYS;
      }
    }
    return false;
  }

  getPlan(): LicensePlan {
    return this.cache?.plan || 'unknown';
  }

  getStatus(): LicenseStatus {
    if (!this.getLicenseKey()) return 'unactivated';
    return this.cache?.status || 'unactivated';
  }

  // ─── Internal: Validation ───────────────────────────────────────

  /** Validate license with the remote API */
  private async validateLicense(): Promise<void> {
    const key = this.getLicenseKey();
    if (!key) return;

    try {
      const response = await this.apiCall('/license/validate', {
        method: 'POST',
        body: JSON.stringify({
          key,
          fingerprint: this.fingerprint,
          panelVersion: getPanelVersion(),
        }),
      });

      this.cache = {
        status: response.valid ? 'active' : (response.expired ? 'expired' : 'invalid'),
        plan: response.plan || this.cache?.plan || 'unknown',
        expiresAt: response.expiresAt || this.cache?.expiresAt || null,
        features: response.features || this.cache?.features || [],
        lastChecked: new Date().toISOString(),
        lastValid: response.valid ? new Date().toISOString() : (this.cache?.lastValid || new Date().toISOString()),
      };
      await this.saveCache();

      if (response.valid) {
        this.logger.log(`License valid — plan: ${this.cache.plan}`);
      } else {
        this.logger.warn(`License invalid: ${response.message || 'unknown reason'}`);
      }
    } catch (err: any) {
      // API unreachable — use grace period
      this.logger.warn(`License API unreachable: ${err.message}`);
      const graceDays = this.getGraceDaysRemaining();
      if (graceDays !== null && graceDays <= 0) {
        this.logger.error('Offline grace period exhausted — license cannot be verified');
        if (this.cache) {
          this.cache.status = 'grace' as any;
          await this.saveCache();
        }
      }
    }
  }

  // ─── Internal: Fingerprint ──────────────────────────────────────

  /** Generate a unique server fingerprint based on machine-id + network */
  private async generateFingerprint(): Promise<string> {
    const parts: string[] = [];

    // Machine ID (Linux)
    try {
      const machineId = await fs.readFile('/etc/machine-id', 'utf-8');
      parts.push(machineId.trim());
    } catch {
      parts.push(os.hostname());
    }

    // Primary network interface MAC
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (!addr.internal && addr.family === 'IPv4' && addr.mac !== '00:00:00:00:00:00') {
          parts.push(addr.mac);
          break;
        }
      }
      if (parts.length > 1) break;
    }

    parts.push(os.arch());

    const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex');
    return hash.substring(0, 32); // 32-char fingerprint
  }

  // ─── Internal: .env Management ──────────────────────────────────

  private getLicenseKey(): string | null {
    return this.configService.get<string>('LICENSE_KEY') || process.env.LICENSE_KEY || null;
  }

  private async setLicenseKey(key: string): Promise<void> {
    process.env.LICENSE_KEY = key;
    const envPath = path.join(process.cwd(), '.env');
    try {
      let content = await fs.readFile(envPath, 'utf-8');
      if (/^LICENSE_KEY=/m.test(content)) {
        content = content.replace(/^LICENSE_KEY=.*/m, `LICENSE_KEY=${key}`);
      } else {
        content += `\nLICENSE_KEY=${key}\n`;
      }
      await fs.writeFile(envPath, content, 'utf-8');
    } catch {
      this.logger.warn('Could not write LICENSE_KEY to .env');
    }
  }

  private async removeLicenseKey(): Promise<void> {
    delete process.env.LICENSE_KEY;
    const envPath = path.join(process.cwd(), '.env');
    try {
      let content = await fs.readFile(envPath, 'utf-8');
      content = content.replace(/^LICENSE_KEY=.*\n?/m, '');
      await fs.writeFile(envPath, content, 'utf-8');
    } catch {}
  }

  // ─── Internal: Cache ────────────────────────────────────────────

  private getCachePath(): string {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '..', 'data');
    return path.join(dataDir, CACHE_FILENAME);
  }

  private async loadCache(): Promise<void> {
    try {
      const raw = await fs.readFile(this.getCachePath(), 'utf-8');
      this.cache = JSON.parse(raw);
    } catch {
      this.cache = null;
    }
  }

  private async saveCache(): Promise<void> {
    try {
      const dir = path.dirname(this.getCachePath());
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.getCachePath(), JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`Could not save license cache: ${err}`);
    }
  }

  // ─── Internal: Helpers ──────────────────────────────────────────

  private getGraceDaysRemaining(): number | null {
    if (!this.cache?.lastValid) return null;
    const lastValid = new Date(this.cache.lastValid).getTime();
    const elapsed = (Date.now() - lastValid) / (24 * 60 * 60 * 1000);
    return Math.max(0, Math.round(GRACE_PERIOD_DAYS - elapsed));
  }

  private getStatusMessage(): string {
    if (!this.cache) return 'License not validated';
    switch (this.cache.status) {
      case 'active': return `License active — ${this.cache.plan} plan`;
      case 'expired': {
        const grace = this.getGraceDaysRemaining();
        return grace !== null && grace > 0
          ? `License expired — ${grace} days remaining before read-only mode`
          : 'License expired — panel in read-only mode. Renew at clearpanel.net';
      }
      case 'invalid': return 'License key is invalid. Contact support@clearpanel.net';
      default: return 'License status unknown';
    }
  }

  private maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '-****-****-' + key.substring(key.length - 4);
  }

  /** HTTP call to the license API */
  private async apiCall(endpoint: string, opts: RequestInit): Promise<any> {
    const url = `${API_BASE}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const res = await fetch(url, {
        ...opts,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `ClearPanel/${getPanelVersion()}`,
          ...(opts.headers || {}),
        },
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
}
