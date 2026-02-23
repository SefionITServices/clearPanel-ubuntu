import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCb);

type DbEngine = 'mariadb' | 'mysql' | 'postgresql';

interface EngineStatus {
  engine: DbEngine;
  label: string;
  installed: boolean;
  running: boolean;
  version: string;
}

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
  private readonly logger = new Logger(DatabaseService.name);
  private prefix = '';

  private getPrefix(): string {
    if (this.prefix) return this.prefix;
    const username = process.env.PANEL_USERNAME || process.env.USER || 'cp';
    this.prefix = username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    return this.prefix;
  }

  /**
   * Run a shell command, trying sudo if direct execution fails
   */
  private async run(cmd: string, timeout = 30000): Promise<string> {
    try {
      const { stdout } = await exec(cmd, { timeout });
      return stdout.trim();
    } catch {
      // Retry with sudo
      const { stdout } = await exec(`sudo ${cmd}`, { timeout });
      return stdout.trim();
    }
  }

  /**
   * Run a command that requires root — use sudo directly
   */
  private async sudo(cmd: string, timeout = 30000): Promise<string> {
    const { stdout } = await exec(`sudo ${cmd}`, { timeout });
    return stdout.trim();
  }

  /**
   * Run a MySQL/MariaDB command
   */
  private async mysqlExec(sql: string): Promise<string> {
    const escaped = sql.replace(/"/g, '\\"');
    return this.sudo(`mysql -N -B -e "${escaped}"`, 30000);
  }

  /**
   * Run a PostgreSQL command as postgres user
   */
  private async pgExec(sql: string): Promise<string> {
    const escaped = sql.replace(/"/g, '\\"');
    return this.sudo(`-u postgres psql -t -A -c "${escaped}"`, 30000);
  }

  /**
   * Run a PostgreSQL command against a specific database
   */
  private async pgExecDb(database: string, sql: string): Promise<string> {
    const escaped = sql.replace(/"/g, '\\"');
    const safeDb = database.replace(/[^a-zA-Z0-9_]/g, '');
    return this.sudo(`-u postgres psql -t -A -d "${safeDb}" -c "${escaped}"`, 30000);
  }

  // ========================
  // STATUS — all engines
  // ========================

  async getAllEngineStatus(): Promise<EngineStatus[]> {
    const [mariadb, mysql, postgresql] = await Promise.all([
      this.checkEngine('mariadb'),
      this.checkEngine('mysql'),
      this.checkEngine('postgresql'),
    ]);
    return [mariadb, mysql, postgresql];
  }

  private async checkEngine(engine: DbEngine): Promise<EngineStatus> {
    const labels: Record<DbEngine, string> = { mariadb: 'MariaDB', mysql: 'MySQL', postgresql: 'PostgreSQL' };
    const status: EngineStatus = { engine, label: labels[engine], installed: false, running: false, version: '' };

    try {
      if (engine === 'mariadb') {
        // Check mariadb specifically
        try {
          const v = await exec('mariadb --version 2>/dev/null', { timeout: 5000 });
          status.version = v.stdout.trim();
          status.installed = true;
        } catch {
          // Also check mysql --version which might be mariadb
          try {
            const v = await exec('mysql --version 2>/dev/null', { timeout: 5000 });
            if (v.stdout.toLowerCase().includes('mariadb')) {
              status.version = v.stdout.trim();
              status.installed = true;
            }
          } catch {}
        }
        if (status.installed) {
          try {
            const { stdout } = await exec('sudo systemctl is-active mariadb 2>/dev/null', { timeout: 5000 });
            status.running = stdout.trim() === 'active';
          } catch { status.running = false; }
        }
      } else if (engine === 'mysql') {
        try {
          const v = await exec('mysql --version 2>/dev/null', { timeout: 5000 });
          // Only count as MySQL if it's NOT MariaDB
          if (!v.stdout.toLowerCase().includes('mariadb')) {
            status.version = v.stdout.trim();
            status.installed = true;
          }
        } catch {}
        if (status.installed) {
          try {
            const { stdout } = await exec('sudo systemctl is-active mysql 2>/dev/null', { timeout: 5000 });
            status.running = stdout.trim() === 'active';
          } catch {
            try {
              const { stdout } = await exec('sudo systemctl is-active mysqld 2>/dev/null', { timeout: 5000 });
              status.running = stdout.trim() === 'active';
            } catch { status.running = false; }
          }
        }
      } else if (engine === 'postgresql') {
        try {
          const v = await exec('psql --version 2>/dev/null', { timeout: 5000 });
          status.version = v.stdout.trim();
          status.installed = true;
        } catch {}
        if (status.installed) {
          try {
            const { stdout } = await exec('sudo systemctl is-active postgresql 2>/dev/null', { timeout: 5000 });
            status.running = stdout.trim() === 'active';
          } catch { status.running = false; }
        }
      }
    } catch {}

    return status;
  }

  /**
   * Backward-compatible getStatus (checks if MariaDB or MySQL is available)
   */
  async getStatus(): Promise<{ installed: boolean; running: boolean; version: string }> {
    const engines = await this.getAllEngineStatus();
    const active = engines.find(e => e.installed && (e.engine === 'mariadb' || e.engine === 'mysql'));
    if (active) return { installed: true, running: active.running, version: active.version };
    return { installed: false, running: false, version: '' };
  }

  // ========================
  // INSTALL
  // ========================

  async installEngine(engine: DbEngine): Promise<{ success: boolean; message: string; logs: string[] }> {
    const logs: string[] = [];

    try {
      logs.push('Updating package list...');
      await exec('sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq', { timeout: 60000 });

      if (engine === 'mariadb') {
        logs.push('Installing MariaDB server and client...');
        await exec('sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server mariadb-client', { timeout: 300000 });

        logs.push('Enabling MariaDB service...');
        await exec('sudo systemctl enable mariadb', { timeout: 10000 });
        await exec('sudo systemctl start mariadb', { timeout: 15000 });

        // Verify
        try {
          await exec('sudo mysqladmin ping 2>/dev/null', { timeout: 5000 });
          logs.push('MariaDB is running and responding');
        } catch {
          logs.push('Warning: MariaDB installed but may need a moment to start');
        }
        return { success: true, message: 'MariaDB installed and started successfully', logs };

      } else if (engine === 'mysql') {
        logs.push('Installing MySQL server and client...');
        await exec('sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server mysql-client', { timeout: 300000 });

        logs.push('Enabling MySQL service...');
        await exec('sudo systemctl enable mysql', { timeout: 10000 });
        await exec('sudo systemctl start mysql', { timeout: 15000 });

        try {
          await exec('sudo mysqladmin ping 2>/dev/null', { timeout: 5000 });
          logs.push('MySQL is running and responding');
        } catch {
          logs.push('Warning: MySQL installed but may need a moment to start');
        }
        return { success: true, message: 'MySQL installed and started successfully', logs };

      } else if (engine === 'postgresql') {
        logs.push('Installing PostgreSQL server and client...');
        await exec('sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-client postgresql-contrib', { timeout: 300000 });

        logs.push('Enabling PostgreSQL service...');
        await exec('sudo systemctl enable postgresql', { timeout: 10000 });
        await exec('sudo systemctl start postgresql', { timeout: 15000 });

        try {
          await exec('sudo -u postgres psql -c "SELECT 1" 2>/dev/null', { timeout: 5000 });
          logs.push('PostgreSQL is running and responding');
        } catch {
          logs.push('Warning: PostgreSQL installed but may need a moment to start');
        }
        return { success: true, message: 'PostgreSQL installed and started successfully', logs };
      }

      return { success: false, message: `Unknown engine: ${engine}`, logs };
    } catch (e: any) {
      const errMsg = e.stderr || e.message || String(e);
      logs.push(`Error: ${errMsg}`);
      this.logger.error(`Failed to install ${engine}: ${errMsg}`);
      throw new Error(`Failed to install ${engine}: ${errMsg}`);
    }
  }

  /**
   * Backward-compatible install (MySQL)
   */
  async installMySQL(): Promise<{ success: boolean; message: string; logs?: string[] }> {
    return this.installEngine('mysql');
  }

  // ========================
  // ENGINE LIFECYCLE (start / stop / restart / logs)
  // ========================

  private getServiceName(engine: DbEngine): string[] {
    switch (engine) {
      case 'mariadb':  return ['mariadb'];
      case 'mysql':    return ['mysql', 'mysqld'];
      case 'postgresql': return ['postgresql'];
      default: return [engine];
    }
  }

  async startEngine(engine: DbEngine): Promise<{ success: boolean; message: string }> {
    const services = this.getServiceName(engine);
    let lastError = '';
    for (const svc of services) {
      try {
        await exec(`sudo systemctl start ${svc}`, { timeout: 30000 });
        return { success: true, message: `${engine} started successfully` };
      } catch (e: any) {
        lastError = e.stderr || e.message || String(e);
      }
    }
    throw new Error(`Failed to start ${engine}: ${lastError}`);
  }

  async stopEngine(engine: DbEngine): Promise<{ success: boolean; message: string }> {
    const services = this.getServiceName(engine);
    let lastError = '';
    for (const svc of services) {
      try {
        await exec(`sudo systemctl stop ${svc}`, { timeout: 30000 });
        return { success: true, message: `${engine} stopped successfully` };
      } catch (e: any) {
        lastError = e.stderr || e.message || String(e);
      }
    }
    throw new Error(`Failed to stop ${engine}: ${lastError}`);
  }

  async restartEngine(engine: DbEngine): Promise<{ success: boolean; message: string }> {
    const services = this.getServiceName(engine);
    let lastError = '';
    for (const svc of services) {
      try {
        await exec(`sudo systemctl restart ${svc}`, { timeout: 30000 });
        return { success: true, message: `${engine} restarted successfully` };
      } catch (e: any) {
        lastError = e.stderr || e.message || String(e);
      }
    }
    throw new Error(`Failed to restart ${engine}: ${lastError}`);
  }

  async getEngineLogs(engine: DbEngine, lines = 50): Promise<{ success: boolean; logs: string }> {
    const services = this.getServiceName(engine);
    for (const svc of services) {
      try {
        const { stdout } = await exec(
          `sudo journalctl -u ${svc} --no-pager -n ${lines} 2>/dev/null || echo "No logs available"`,
          { timeout: 15000 },
        );
        return { success: true, logs: stdout.trim() };
      } catch {}
    }
    return { success: true, logs: 'No logs available for this engine.' };
  }

  async diagnoseEngine(engine: DbEngine): Promise<{
    success: boolean;
    engine: string;
    installed: boolean;
    running: boolean;
    version: string;
    logs: string;
    diskUsage: string;
    configFile: string;
    port: string;
  }> {
    const status = await this.checkEngine(engine);
    const logsResult = await this.getEngineLogs(engine, 30);

    let diskUsage = 'N/A';
    let configFile = 'N/A';
    let port = 'N/A';

    try {
      if (engine === 'postgresql') {
        try { diskUsage = await this.run('du -sh /var/lib/postgresql/ 2>/dev/null | cut -f1'); } catch {}
        try { configFile = (await this.sudo('-u postgres psql -t -A -c "SHOW config_file"')).trim(); } catch {}
        try { port = (await this.sudo('-u postgres psql -t -A -c "SHOW port"')).trim(); } catch {}
      } else {
        const dataDir = engine === 'mariadb' ? '/var/lib/mysql/' : '/var/lib/mysql/';
        try { diskUsage = await this.run(`du -sh ${dataDir} 2>/dev/null | cut -f1`); } catch {}
        for (const p of ['/etc/mysql/mariadb.conf.d/50-server.cnf', '/etc/mysql/mysql.conf.d/mysqld.cnf', '/etc/mysql/my.cnf']) {
          try {
            await exec(`test -f ${p}`);
            configFile = p;
            break;
          } catch {}
        }
        try { port = await this.mysqlExec("SELECT @@port"); } catch {}
      }
    } catch {}

    return {
      success: true,
      engine,
      installed: status.installed,
      running: status.running,
      version: status.version,
      logs: logsResult.logs,
      diskUsage,
      configFile,
      port,
    };
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

  // ========================
  // POSTGRESQL — Databases
  // ========================

  async listPgDatabases(): Promise<DatabaseInfo[]> {
    const prefix = this.getPrefix();
    const raw = await this.pgExec(
      `SELECT d.datname, pg_database_size(d.datname) as size FROM pg_database d WHERE d.datname LIKE '${prefix}_%' ORDER BY d.datname`
    );
    if (!raw) return [];
    const dbs: DatabaseInfo[] = [];
    for (const line of raw.split('\n').filter(Boolean)) {
      const [name, size] = line.split('|');
      let tables = 0;
      try {
        const tblCount = await this.pgExecDb(name,
          `SELECT count(*) FROM pg_tables WHERE schemaname = 'public'`
        );
        tables = parseInt(tblCount, 10) || 0;
      } catch {}
      dbs.push({ name, size: parseInt(size, 10) || 0, tables });
    }
    return dbs;
  }

  async createPgDatabase(name: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeName) throw new Error('Invalid database name');
    const fullName = safeName.startsWith(`${prefix}_`) ? safeName : `${prefix}_${safeName}`;
    if (fullName.length > 63) throw new Error('Database name too long (max 63 chars)');
    await this.pgExec(`CREATE DATABASE ${fullName}`);
    return { success: true, message: `Database "${fullName}" created` };
  }

  async deletePgDatabase(name: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');
    // Terminate active connections before dropping
    try {
      await this.pgExec(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}' AND pid <> pg_backend_pid()`);
    } catch {}
    await this.pgExec(`DROP DATABASE IF EXISTS ${name}`);
    return { success: true, message: `Database "${name}" deleted` };
  }

  async listPgTables(database: string): Promise<{ name: string; rows: number; size: number; engine: string }[]> {
    const prefix = this.getPrefix();
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');
    const raw = await this.pgExecDb(database,
      `SELECT t.tablename, pg_total_relation_size(quote_ident(t.tablename))::bigint as size, COALESCE(s.n_live_tup, 0)::bigint as rows FROM pg_tables t LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname WHERE t.schemaname = 'public' ORDER BY t.tablename`
    );
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map((line) => {
      const [name, size, rows] = line.split('|');
      return { name, rows: parseInt(rows, 10) || 0, size: parseInt(size, 10) || 0, engine: 'PostgreSQL' };
    });
  }

  // ========================
  // POSTGRESQL — Users / Roles
  // ========================

  async listPgUsers(): Promise<DatabaseUser[]> {
    const prefix = this.getPrefix();
    const raw = await this.pgExec(
      `SELECT rolname FROM pg_roles WHERE rolname LIKE '${prefix}_%' AND rolcanlogin = true ORDER BY rolname`
    );
    if (!raw) return [];
    const users: DatabaseUser[] = [];
    for (const rolname of raw.split('\n').filter(Boolean)) {
      const user = rolname.trim();
      let databases: string[] = [];
      try {
        const dbRaw = await this.pgExec(
          `SELECT datname FROM pg_database WHERE has_database_privilege('${user}', datname, 'CONNECT') AND datname LIKE '${prefix}_%' AND datistemplate = false`
        );
        databases = dbRaw.split('\n').filter(Boolean);
      } catch {}
      users.push({ user, host: 'local', databases });
    }
    return users;
  }

  async createPgUser(name: string, password: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeName) throw new Error('Invalid username');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    const fullName = safeName.startsWith(`${prefix}_`) ? safeName : `${prefix}_${safeName}`;
    if (fullName.length > 63) throw new Error('Username too long (max 63 chars)');
    const safePassword = password.replace(/'/g, "''");
    await this.pgExec(`CREATE ROLE ${fullName} WITH LOGIN PASSWORD '${safePassword}'`);
    return { success: true, message: `User "${fullName}" created` };
  }

  async deletePgUser(name: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your user');
    // Revoke connect from all databases first
    try {
      const dbs = await this.pgExec(`SELECT datname FROM pg_database WHERE datname LIKE '${prefix}_%'`);
      for (const db of dbs.split('\n').filter(Boolean)) {
        try { await this.pgExec(`REVOKE ALL PRIVILEGES ON DATABASE ${db.trim()} FROM ${name}`); } catch {}
      }
    } catch {}
    await this.pgExec(`DROP ROLE IF EXISTS ${name}`);
    return { success: true, message: `User "${name}" deleted` };
  }

  async changePgPassword(name: string, password: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    const safePassword = password.replace(/'/g, "''");
    await this.pgExec(`ALTER ROLE ${name} WITH PASSWORD '${safePassword}'`);
    return { success: true, message: 'Password changed' };
  }

  // ========================
  // POSTGRESQL — Privileges
  // ========================

  async grantPgPrivileges(
    user: string,
    database: string,
    privileges: string[] = ['ALL'],
  ): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!user.startsWith(`${prefix}_`)) throw new Error('Access denied: not your user');
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');
    const validPrivs = ['ALL', 'CREATE', 'CONNECT', 'TEMPORARY', 'TEMP'];
    const cleanPrivs = privileges.map(p => p.toUpperCase()).filter(p => validPrivs.includes(p));
    if (cleanPrivs.length === 0) throw new Error('No valid privileges specified');
    const privStr = cleanPrivs.join(', ');
    await this.pgExec(`GRANT ${privStr} ON DATABASE ${database} TO ${user}`);
    // Also grant schema usage and table privileges
    try {
      await this.pgExecDb(database, `GRANT USAGE ON SCHEMA public TO ${user}`);
      await this.pgExecDb(database, `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${user}`);
      await this.pgExecDb(database, `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${user}`);
    } catch {}
    return { success: true, message: `Granted ${privStr} on ${database} to ${user}` };
  }

  async revokePgPrivileges(user: string, database: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!user.startsWith(`${prefix}_`)) throw new Error('Access denied');
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');
    try {
      await this.pgExecDb(database, `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${user}`);
      await this.pgExecDb(database, `REVOKE USAGE ON SCHEMA public FROM ${user}`);
    } catch {}
    await this.pgExec(`REVOKE ALL PRIVILEGES ON DATABASE ${database} FROM ${user}`);
    return { success: true, message: `Revoked privileges on ${database} from ${user}` };
  }

  async getPgUserPrivileges(user: string): Promise<UserPrivilege[]> {
    const prefix = this.getPrefix();
    if (!user.startsWith(`${prefix}_`)) throw new Error('Access denied');
    const raw = await this.pgExec(
      `SELECT datname FROM pg_database WHERE has_database_privilege('${user}', datname, 'CONNECT') AND datname LIKE '${prefix}_%' AND datistemplate = false`
    );
    if (!raw) return [];

    const results: UserPrivilege[] = [];
    for (const dbLine of raw.split('\n').filter(Boolean)) {
      const db = dbLine.trim();
      const privs: string[] = ['CONNECT'];
      // Check additional database-level privileges
      try {
        const dbPrivRaw = await this.pgExec(
          `SELECT privilege_type FROM information_schema.role_usage_grants WHERE grantee = '${user}' AND object_catalog = '${db}' UNION SELECT CASE WHEN has_database_privilege('${user}', '${db}', 'CREATE') THEN 'CREATE' END WHERE has_database_privilege('${user}', '${db}', 'CREATE')`
        );
        if (dbPrivRaw) {
          for (const p of dbPrivRaw.split('\n').filter(Boolean)) {
            const pt = p.trim();
            if (pt && !privs.includes(pt)) privs.push(pt);
          }
        }
      } catch {}
      // Check table-level privileges
      try {
        const tablePrivRaw = await this.pgExecDb(db,
          `SELECT DISTINCT privilege_type FROM information_schema.role_table_grants WHERE grantee = '${user}' AND table_schema = 'public'`
        );
        if (tablePrivRaw) {
          for (const p of tablePrivRaw.split('\n').filter(Boolean)) {
            const pt = p.trim();
            if (pt && !privs.includes(pt)) privs.push(pt);
          }
        }
      } catch {}
      results.push({ database: db, privileges: privs });
    }
    return results;
  }

  // ========================
  // EXPORT / BACKUP
  // ========================

  /**
   * Export a MySQL/MariaDB database to SQL dump string
   */
  async exportDatabase(name: string): Promise<string> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    return this.sudo(`mysqldump --single-transaction --routines --triggers "${safeName}"`, 120000);
  }

  /**
   * Export a PostgreSQL database to SQL dump string
   */
  async exportPgDatabase(name: string): Promise<string> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
    return this.sudo(`-u postgres pg_dump "${safeName}"`, 120000);
  }

  // ========================
  // IMPORT / RESTORE
  // ========================

  /**
   * Import SQL into a MySQL/MariaDB database
   */
  async importDatabase(name: string, sql: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');

    // Write SQL to temp file, then import
    const tmpFile = path.join(os.tmpdir(), `cp-import-${Date.now()}.sql`);
    try {
      fs.writeFileSync(tmpFile, sql, 'utf-8');
      await this.sudo(`bash -c "mysql '${safeName}' < '${tmpFile}'"`, 300000);
      return { success: true, message: `Imported SQL into "${safeName}" successfully` };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  /**
   * Import SQL into a PostgreSQL database
   */
  async importPgDatabase(name: string, sql: string): Promise<{ success: boolean; message: string }> {
    const prefix = this.getPrefix();
    if (!name.startsWith(`${prefix}_`)) throw new Error('Access denied: not your database');
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');

    const tmpFile = path.join(os.tmpdir(), `cp-import-${Date.now()}.sql`);
    try {
      fs.writeFileSync(tmpFile, sql, 'utf-8');
      await this.sudo(`-u postgres psql -d "${safeName}" -f "${tmpFile}"`, 300000);
      return { success: true, message: `Imported SQL into "${safeName}" successfully` };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  // ========================
  // SQL QUERY RUNNER
  // ========================

  /**
   * Execute a read-only SQL query on a MySQL/MariaDB database
   */
  async executeQuery(
    database: string,
    sql: string,
  ): Promise<{ columns: string[]; rows: string[][]; rowCount: number; duration: number }> {
    const prefix = this.getPrefix();
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');
    // Block destructive statements for safety
    const upperSql = sql.trim().toUpperCase();
    const blocked = ['DROP DATABASE', 'DROP SCHEMA', 'TRUNCATE DATABASE', 'SHUTDOWN'];
    if (blocked.some(b => upperSql.startsWith(b))) {
      throw new Error('This statement type is not allowed via the query runner');
    }
    // Limit results
    const hasLimit = /\bLIMIT\b/i.test(sql);
    const safeSql = hasLimit ? sql : `${sql.replace(/;\s*$/, '')} LIMIT 1000`;
    const escaped = safeSql.replace(/"/g, '\\"').replace(/`/g, '\\`');
    const safeName = database.replace(/[^a-zA-Z0-9_]/g, '');
    const start = Date.now();
    const raw = await this.sudo(`mysql -N -B "${safeName}" -e "${escaped}"`, 60000);
    const duration = Date.now() - start;
    // Get column names
    let columns: string[] = [];
    try {
      const colRaw = await this.sudo(`mysql "${safeName}" -e "${escaped}" 2>/dev/null | head -1`, 10000);
      columns = colRaw.split('\t');
    } catch {}
    const rows = raw ? raw.split('\n').map(line => line.split('\t')) : [];
    return { columns, rows, rowCount: rows.length, duration };
  }

  /**
   * Execute a SQL query on a PostgreSQL database
   */
  async executePgQuery(
    database: string,
    sql: string,
  ): Promise<{ columns: string[]; rows: string[][]; rowCount: number; duration: number }> {
    const prefix = this.getPrefix();
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');
    const upperSql = sql.trim().toUpperCase();
    const blocked = ['DROP DATABASE', 'DROP SCHEMA', 'SHUTDOWN'];
    if (blocked.some(b => upperSql.startsWith(b))) {
      throw new Error('This statement type is not allowed via the query runner');
    }
    const hasLimit = /\bLIMIT\b/i.test(sql);
    const safeSql = hasLimit ? sql : `${sql.replace(/;\s*$/, '')} LIMIT 1000`;
    const escaped = safeSql.replace(/"/g, '\\"');
    const safeName = database.replace(/[^a-zA-Z0-9_]/g, '');
    const start = Date.now();
    // Use csv format for easier parsing
    const raw = await this.sudo(`-u postgres psql -d "${safeName}" -c "${escaped}" --csv`, 60000);
    const duration = Date.now() - start;
    const lines = raw.split('\n').filter(Boolean);
    const columns = lines.length > 0 ? lines[0].split(',') : [];
    const rows = lines.slice(1).map(line => {
      // Simple CSV parse (handles basic cases)
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { cells.push(current); current = ''; continue; }
        current += ch;
      }
      cells.push(current);
      return cells;
    });
    return { columns, rows, rowCount: rows.length, duration };
  }

  // ========================
  // METRICS / STATS
  // ========================

  async getMetrics(): Promise<{
    totalDatabases: number;
    totalUsers: number;
    totalSize: number;
    engines: { engine: string; databases: number; users: number; size: number }[];
  }> {
    const engineStatuses = await this.getAllEngineStatus();
    const engineMetrics: { engine: string; databases: number; users: number; size: number }[] = [];
    let totalDbs = 0, totalUsers = 0, totalSize = 0;

    for (const eng of engineStatuses) {
      if (!eng.installed || !eng.running) continue;
      let dbs = 0, usrs = 0, sz = 0;
      try {
        if (eng.engine === 'mariadb' || eng.engine === 'mysql') {
          const dbList = await this.listDatabases();
          dbs = dbList.length;
          sz = dbList.reduce((s, d) => s + d.size, 0);
          const userList = await this.listUsers();
          usrs = userList.length;
        } else if (eng.engine === 'postgresql') {
          const dbList = await this.listPgDatabases();
          dbs = dbList.length;
          sz = dbList.reduce((s, d) => s + d.size, 0);
          const userList = await this.listPgUsers();
          usrs = userList.length;
        }
      } catch {}
      totalDbs += dbs;
      totalUsers += usrs;
      totalSize += sz;
      engineMetrics.push({ engine: eng.engine, databases: dbs, users: usrs, size: sz });
    }

    return { totalDatabases: totalDbs, totalUsers: totalUsers, totalSize: totalSize, engines: engineMetrics };
  }

  // ========================
  // CONNECTION INFO
  // ========================

  async getConnectionInfo(): Promise<{
    mysql: { host: string; port: number; socket: string } | null;
    postgresql: { host: string; port: number } | null;
  }> {
    const result: any = { mysql: null, postgresql: null };

    // MySQL / MariaDB
    try {
      const portRaw = await this.mysqlExec(`SELECT @@port`);
      const socketRaw = await this.mysqlExec(`SELECT @@socket`);
      const hostnameRaw = await this.mysqlExec(`SELECT @@hostname`);
      result.mysql = {
        host: hostnameRaw?.trim() || 'localhost',
        port: parseInt(portRaw?.trim(), 10) || 3306,
        socket: socketRaw?.trim() || '/var/run/mysqld/mysqld.sock',
      };
    } catch {}

    // PostgreSQL
    try {
      const portRaw = await this.pgExec(`SHOW port`);
      result.postgresql = {
        host: 'localhost',
        port: parseInt(portRaw?.trim(), 10) || 5432,
      };
    } catch {}

    return result;
  }

  // ========================
  // REPAIR / OPTIMIZE TABLES
  // ========================

  async repairTable(database: string, table: string): Promise<{ success: boolean; message: string; output: string }> {
    const prefix = this.getPrefix();
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');
    const safeDb = database.replace(/[^a-zA-Z0-9_]/g, '');
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const raw = await this.mysqlExec(`REPAIR TABLE \`${safeDb}\`.\`${safeTable}\``);
    return { success: true, message: `Repair completed for ${safeTable}`, output: raw };
  }

  async optimizeTable(database: string, table: string): Promise<{ success: boolean; message: string; output: string }> {
    const prefix = this.getPrefix();
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');
    const safeDb = database.replace(/[^a-zA-Z0-9_]/g, '');
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const raw = await this.mysqlExec(`OPTIMIZE TABLE \`${safeDb}\`.\`${safeTable}\``);
    return { success: true, message: `Optimize completed for ${safeTable}`, output: raw };
  }

  async checkTable(database: string, table: string): Promise<{ success: boolean; message: string; output: string }> {
    const prefix = this.getPrefix();
    if (!database.startsWith(`${prefix}_`)) throw new Error('Access denied');
    const safeDb = database.replace(/[^a-zA-Z0-9_]/g, '');
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const raw = await this.mysqlExec(`CHECK TABLE \`${safeDb}\`.\`${safeTable}\``);
    return { success: true, message: `Check completed for ${safeTable}`, output: raw };
  }

  // ========================
  // UNINSTALL ENGINE
  // ========================

  async uninstallEngine(engine: DbEngine): Promise<{ success: boolean; message: string; logs: string[] }> {
    const logs: string[] = [];
    try {
      if (engine === 'mariadb') {
        logs.push('Stopping MariaDB...');
        try { await exec('sudo systemctl stop mariadb', { timeout: 15000 }); } catch {}
        logs.push('Removing MariaDB packages...');
        await exec('sudo env DEBIAN_FRONTEND=noninteractive apt-get remove --purge -y mariadb-server mariadb-client mariadb-common', { timeout: 120000 });
        await exec('sudo env DEBIAN_FRONTEND=noninteractive apt-get autoremove -y', { timeout: 60000 });
        logs.push('MariaDB removed successfully');
        return { success: true, message: 'MariaDB uninstalled', logs };
      } else if (engine === 'mysql') {
        logs.push('Stopping MySQL...');
        try { await exec('sudo systemctl stop mysql', { timeout: 15000 }); } catch {}
        try { await exec('sudo systemctl stop mysqld', { timeout: 15000 }); } catch {}
        logs.push('Removing MySQL packages...');
        await exec('sudo env DEBIAN_FRONTEND=noninteractive apt-get remove --purge -y mysql-server mysql-client mysql-common', { timeout: 120000 });
        await exec('sudo env DEBIAN_FRONTEND=noninteractive apt-get autoremove -y', { timeout: 60000 });
        logs.push('MySQL removed successfully');
        return { success: true, message: 'MySQL uninstalled', logs };
      } else if (engine === 'postgresql') {
        logs.push('Stopping PostgreSQL...');
        try { await exec('sudo systemctl stop postgresql', { timeout: 15000 }); } catch {}
        logs.push('Removing PostgreSQL packages...');
        await exec('sudo env DEBIAN_FRONTEND=noninteractive apt-get remove --purge -y postgresql postgresql-client postgresql-contrib', { timeout: 120000 });
        await exec('sudo env DEBIAN_FRONTEND=noninteractive apt-get autoremove -y', { timeout: 60000 });
        logs.push('PostgreSQL removed successfully');
        return { success: true, message: 'PostgreSQL uninstalled', logs };
      }
      return { success: false, message: `Unknown engine: ${engine}`, logs };
    } catch (e: any) {
      const errMsg = e.stderr || e.message || String(e);
      logs.push(`Error: ${errMsg}`);
      throw new Error(`Failed to uninstall ${engine}: ${errMsg}`);
    }
  }

  // ========================
  // REMOTE ACCESS CONFIG
  // ========================

  async getRemoteAccessStatus(): Promise<{
    mysql: { enabled: boolean; bindAddress: string } | null;
    postgresql: { enabled: boolean; listenAddresses: string } | null;
  }> {
    const result: any = { mysql: null, postgresql: null };

    // MySQL/MariaDB
    const mysqlConfPaths = [
      '/etc/mysql/mariadb.conf.d/50-server.cnf',
      '/etc/mysql/mysql.conf.d/mysqld.cnf',
      '/etc/mysql/my.cnf',
    ];
    for (const confPath of mysqlConfPaths) {
      try {
        const content = await this.sudo(`cat "${confPath}"`, 5000);
        const bindMatch = content.match(/bind-address\s*=\s*(.+)/);
        const bindAddr = bindMatch ? bindMatch[1].trim() : '127.0.0.1';
        result.mysql = {
          enabled: bindAddr === '0.0.0.0' || bindAddr === '*',
          bindAddress: bindAddr,
        };
        break;
      } catch {}
    }

    // PostgreSQL
    try {
      const pgConf = await this.sudo(`-u postgres psql -t -A -c "SHOW config_file"`, 5000);
      if (pgConf) {
        const content = await this.sudo(`cat "${pgConf.trim()}"`, 5000);
        const listenMatch = content.match(/listen_addresses\s*=\s*'([^']+)'/);
        const listenAddr = listenMatch ? listenMatch[1].trim() : 'localhost';
        result.postgresql = {
          enabled: listenAddr === '*' || listenAddr === '0.0.0.0',
          listenAddresses: listenAddr,
        };
      }
    } catch {}

    return result;
  }

  async setRemoteAccess(
    engine: 'mysql' | 'postgresql',
    enabled: boolean,
  ): Promise<{ success: boolean; message: string }> {
    if (engine === 'mysql') {
      const confPaths = [
        '/etc/mysql/mariadb.conf.d/50-server.cnf',
        '/etc/mysql/mysql.conf.d/mysqld.cnf',
        '/etc/mysql/my.cnf',
      ];
      let found = false;
      for (const confPath of confPaths) {
        try {
          await this.sudo(`test -f "${confPath}"`, 3000);
          const newBind = enabled ? '0.0.0.0' : '127.0.0.1';
          await this.sudo(`sed -i "s/^bind-address\\s*=.*/bind-address = ${newBind}/" "${confPath}"`, 5000);
          found = true;
          break;
        } catch {}
      }
      if (!found) throw new Error('MySQL/MariaDB configuration file not found');

      // Restart the service
      try {
        await exec('sudo systemctl restart mariadb', { timeout: 15000 });
      } catch {
        try {
          await exec('sudo systemctl restart mysql', { timeout: 15000 });
        } catch {
          await exec('sudo systemctl restart mysqld', { timeout: 15000 });
        }
      }

      return {
        success: true,
        message: `MySQL remote access ${enabled ? 'enabled' : 'disabled'}. Service restarted.`,
      };
    } else if (engine === 'postgresql') {
      try {
        const pgConf = (await this.sudo(`-u postgres psql -t -A -c "SHOW config_file"`, 5000)).trim();
        const newListen = enabled ? "'*'" : "'localhost'";
        await this.sudo(`sed -i "s/^#\\?listen_addresses\\s*=.*/listen_addresses = ${newListen}/" "${pgConf}"`, 5000);

        // Also update pg_hba.conf to allow remote connections
        const hbaConf = (await this.sudo(`-u postgres psql -t -A -c "SHOW hba_file"`, 5000)).trim();
        if (enabled) {
          // Add entry for remote connections if not already present
          const hbaContent = await this.sudo(`cat "${hbaConf}"`, 5000);
          if (!hbaContent.includes('0.0.0.0/0')) {
            await this.sudo(`bash -c "echo 'host    all    all    0.0.0.0/0    md5' >> '${hbaConf}'"`, 5000);
            await this.sudo(`bash -c "echo 'host    all    all    ::/0         md5' >> '${hbaConf}'"`, 5000);
          }
        } else {
          // Remove remote entries
          await this.sudo(`sed -i '/0\\.0\\.0\\.0\\/0/d' "${hbaConf}"`, 5000);
          await this.sudo(`sed -i '/::\\/0/d' "${hbaConf}"`, 5000);
        }

        await exec('sudo systemctl restart postgresql', { timeout: 15000 });
        return {
          success: true,
          message: `PostgreSQL remote access ${enabled ? 'enabled' : 'disabled'}. Service restarted.`,
        };
      } catch (e: any) {
        throw new Error(`Failed to configure PostgreSQL remote access: ${e.message}`);
      }
    }

    throw new Error('Invalid engine');
  }
}
