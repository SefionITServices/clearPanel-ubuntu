import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

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
   * Backward-compatible install (MariaDB)
   */
  async installMySQL(): Promise<{ success: boolean; message: string; logs?: string[] }> {
    return this.installEngine('mariadb');
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
    return raw.split('\n').filter(Boolean).map((line) => {
      const [name, size] = line.split('|');
      return { name, size: parseInt(size, 10) || 0, tables: 0 };
    });
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
      `SELECT tablename, pg_total_relation_size(quote_ident(tablename))::bigint as size FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map((line) => {
      const [name, size] = line.split('|');
      return { name, rows: 0, size: parseInt(size, 10) || 0, engine: 'PostgreSQL' };
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
    return raw.split('\n').filter(Boolean).map((db) => ({
      database: db.trim(),
      privileges: ['CONNECT'],
    }));
  }
}
