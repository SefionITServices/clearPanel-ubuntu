import { Injectable } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

interface DatabaseInfo {
  name: string;
  size: number;       // bytes
  tables: number;
  created?: string;
}

interface DatabaseUser {
  user: string;
  host: string;
  databases: string[];
}

interface UserPrivilege {
  database: string;
  privileges: string[];
}

@Injectable()
export class DatabaseService {
  private prefix = '';

  private getPrefix(): string {
    // Use the system username as prefix for databases and users
    if (this.prefix) return this.prefix;
    const username = process.env.PANEL_USERNAME || process.env.USER || 'cp';
    this.prefix = username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    return this.prefix;
  }

  /**
   * Run a MySQL command via sudo mysql
   */
  private async mysqlExec(sql: string): Promise<string> {
    // Use sudo mysql which uses unix socket auth (no password needed for root)
    const escaped = sql.replace(/"/g, '\\"');
    const { stdout } = await exec(`sudo -n mysql -N -B -e "${escaped}"`, { timeout: 30000 });
    return stdout.trim();
  }

  /**
   * Check if MySQL/MariaDB is installed and running
   */
  async getStatus(): Promise<{ installed: boolean; running: boolean; version: string }> {
    try {
      const { stdout: version } = await exec('sudo -n mysql --version 2>/dev/null || echo "not installed"', { timeout: 5000 });
      const installed = !version.includes('not installed');

      let running = false;
      if (installed) {
        try {
          await exec('sudo -n mysqladmin ping 2>/dev/null', { timeout: 5000 });
          running = true;
        } catch { running = false; }
      }

      return { installed, running, version: installed ? version.trim() : '' };
    } catch {
      return { installed: false, running: false, version: '' };
    }
  }

  /**
   * Install MySQL/MariaDB
   */
  async installMySQL(): Promise<{ success: boolean; message: string }> {
    try {
      await exec('sudo -n apt-get update', { timeout: 60000 });
      await exec('sudo -n apt-get install -y mariadb-server mariadb-client', { timeout: 300000 });
      await exec('sudo -n systemctl enable mariadb', { timeout: 10000 });
      await exec('sudo -n systemctl start mariadb', { timeout: 10000 });
      return { success: true, message: 'MariaDB installed and started successfully' };
    } catch (e: any) {
      throw new Error(`Failed to install MariaDB: ${e.message}`);
    }
  }

  /**
   * List databases (filtered to user-prefixed ones)
   */
  async listDatabases(): Promise<DatabaseInfo[]> {
    const prefix = this.getPrefix();
    const raw = await this.mysqlExec(
      `SELECT s.SCHEMA_NAME, IFNULL(SUM(t.DATA_LENGTH + t.INDEX_LENGTH), 0) AS size, COUNT(t.TABLE_NAME) AS tables_count FROM information_schema.SCHEMATA s LEFT JOIN information_schema.TABLES t ON s.SCHEMA_NAME = t.TABLE_SCHEMA WHERE s.SCHEMA_NAME LIKE '${prefix}\\_%' GROUP BY s.SCHEMA_NAME ORDER BY s.SCHEMA_NAME`
    );

    if (!raw) return [];

    return raw.split('\n').map((line) => {
      const [name, size, tables] = line.split('\t');
      return {
        name,
        size: parseInt(size, 10) || 0,
        tables: parseInt(tables, 10) || 0,
      };
    });
  }

  /**
   * Create a new database
   */
  async createDatabase(name: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    // Sanitize: only allow alphanumeric and underscore
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeName) throw new Error('Invalid database name');

    const fullName = safeName.startsWith(`${prefix}_`) ? safeName : `${prefix}_${safeName}`;
    if (fullName.length > 64) throw new Error('Database name too long (max 64 chars)');

    await this.mysqlExec(`CREATE DATABASE IF NOT EXISTS \\\`${fullName}\\\``);
    return { success: true, message: `Database "${fullName}" created` };
  }

  /**
   * Delete a database
   */
  async deleteDatabase(name: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');

    await this.mysqlExec(`DROP DATABASE IF EXISTS \\\`${name}\\\``);
    return { success: true, message: `Database "${name}" deleted` };
  }

  /**
   * Get tables in a database
   */
  async listTables(database: string): Promise<{ name: string; rows: number; size: number; engine: string }[]> {
    const prefix = this.getPrefix();
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');

    const raw = await this.mysqlExec(
      `SELECT TABLE_NAME, TABLE_ROWS, (DATA_LENGTH + INDEX_LENGTH) AS size, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${database}' ORDER BY TABLE_NAME`
    );

    if (!raw) return [];

    return raw.split('\n').map((line) => {
      const [name, rows, size, engine] = line.split('\t');
      return {
        name,
        rows: parseInt(rows, 10) || 0,
        size: parseInt(size, 10) || 0,
        engine: engine || 'InnoDB',
      };
    });
  }

  // ========================
  // DATABASE USERS
  // ========================

  /**
   * List MySQL users (filtered to user-prefixed)
   */
  async listUsers(): Promise<DatabaseUser[]> {
    const prefix = this.getPrefix();
    const raw = await this.mysqlExec(
      `SELECT User, Host FROM mysql.user WHERE User LIKE '${prefix}\\_%' ORDER BY User`
    );

    if (!raw) return [];

    const users: DatabaseUser[] = [];
    for (const line of raw.split('\n')) {
      const [user, host] = line.split('\t');
      // Get databases this user has access to
      const grantsRaw = await this.mysqlExec(`SHOW GRANTS FOR '${user}'@'${host}'`).catch(() => '');
      const databases: string[] = [];
      for (const grant of grantsRaw.split('\n')) {
        const match = grant.match(/ON `([^`]+)`/);
        if (match && match[1] !== '*') databases.push(match[1]);
      }
      users.push({ user, host, databases });
    }

    return users;
  }

  /**
   * Create a MySQL user
   */
  async createUser(name: string, password: string, host: string = 'localhost'): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeName) throw new Error('Invalid username');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

    const fullName = safeName.startsWith(`${prefix}_`) ? safeName : `${prefix}_${safeName}`;
    if (fullName.length > 32) throw new Error('Username too long (max 32 chars)');

    const safeHost = host.replace(/[^a-zA-Z0-9.%_-]/g, '') || 'localhost';
    const safePassword = password.replace(/'/g, "\\'");

    await this.mysqlExec(`CREATE USER '${fullName}'@'${safeHost}' IDENTIFIED BY '${safePassword}'`);
    await this.mysqlExec(`FLUSH PRIVILEGES`);
    return { success: true, message: `User "${fullName}" created` };
  }

  /**
   * Delete a MySQL user
   */
  async deleteUser(name: string, host: string = 'localhost'): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your user');

    const safeHost = host.replace(/[^a-zA-Z0-9.%_-]/g, '') || 'localhost';
    await this.mysqlExec(`DROP USER IF EXISTS '${name}'@'${safeHost}'`);
    await this.mysqlExec(`FLUSH PRIVILEGES`);
    return { success: true, message: `User "${name}" deleted` };
  }

  /**
   * Change a MySQL user's password
   */
  async changePassword(name: string, password: string, host: string = 'localhost'): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

    const safeHost = host.replace(/[^a-zA-Z0-9.%_-]/g, '') || 'localhost';
    const safePassword = password.replace(/'/g, "\\'");

    await this.mysqlExec(`ALTER USER '${name}'@'${safeHost}' IDENTIFIED BY '${safePassword}'`);
    await this.mysqlExec(`FLUSH PRIVILEGES`);
    return { success: true, message: 'Password changed' };
  }

  /**
   * Grant privileges on a database to a user
   */
  async grantPrivileges(
    user: string,
    database: string,
    privileges: string[] = ['ALL PRIVILEGES'],
    host: string = 'localhost',
  ): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!user.startsWith(`${prefix}_`)) throw new Error('Access denied: not your user');
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');

    const safeHost = host.replace(/[^a-zA-Z0-9.%_-]/g, '') || 'localhost';
    const validPrivs = ['ALL PRIVILEGES', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX', 'REFERENCES'];
    const cleanPrivs = privileges.filter(p => validPrivs.includes(p.toUpperCase()));
    if (cleanPrivs.length === 0) throw new Error('No valid privileges specified');

    const privStr = cleanPrivs.join(', ');
    await this.mysqlExec(`GRANT ${privStr} ON \\\`${database}\\\`.* TO '${user}'@'${safeHost}'`);
    await this.mysqlExec(`FLUSH PRIVILEGES`);
    return { success: true, message: `Granted ${privStr} on ${database} to ${user}` };
  }

  /**
   * Revoke all privileges on a database from a user
   */
  async revokePrivileges(
    user: string,
    database: string,
    host: string = 'localhost',
  ): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!user.startsWith(`${prefix}_`)) throw new Error('Access denied');
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');

    const safeHost = host.replace(/[^a-zA-Z0-9.%_-]/g, '') || 'localhost';
    await this.mysqlExec(`REVOKE ALL PRIVILEGES ON \\\`${database}\\\`.* FROM '${user}'@'${safeHost}'`);
    await this.mysqlExec(`FLUSH PRIVILEGES`);
    return { success: true, message: `Revoked privileges on ${database} from ${user}` };
  }

  /**
   * Get privileges for a user on a specific database
   */
  async getUserPrivileges(user: string, host: string = 'localhost'): Promise<UserPrivilege[]> {
    const prefix = this.getPrefix();
    if (!user.startsWith(`${prefix}_`)) throw new Error('Access denied');

    const safeHost = host.replace(/[^a-zA-Z0-9.%_-]/g, '') || 'localhost';
    const raw = await this.mysqlExec(`SHOW GRANTS FOR '${user}'@'${safeHost}'`);

    const results: UserPrivilege[] = [];
    for (const line of raw.split('\n')) {
      const dbMatch = line.match(/ON `([^`]+)`/);
      if (!dbMatch || dbMatch[1] === '*') continue;

      const privMatch = line.match(/GRANT (.+?) ON/);
      if (!privMatch) continue;

      results.push({
        database: dbMatch[1],
        privileges: privMatch[1].split(',').map(p => p.trim()),
      });
    }

    return results;
  }
}
