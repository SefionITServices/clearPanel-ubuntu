import { Injectable, Logger } from '@nestjs/common';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { getDataFilePath } from '../common/paths';

// ─── Managed Repo ─────────────────────────────────────────────────────────────

export interface ManagedRepo {
  name: string;
  path: string;
  cloneUrl?: string;
  addedAt?: string;
  isCloning?: boolean;
  cloneError?: string;
  currentBranch?: string;
  webhookId?: string;
  webhookSecret?: string;
  autoDeployEnabled?: boolean;
}

export interface WebhookLog {
  id: string;
  repoPath: string;
  date: string;
  status: 'deploying' | 'success' | 'failed';
  output?: string;
  error?: string;
  branch?: string;
}

const execFile = promisify(execFileCb);


// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);

  // ── Path helpers (same sandbox as FilesService) ──────────────────────────

  private getRootPath(username: string): string {
    const envRoot = process.env.ROOT_PATH?.trim();
    const base = envRoot && envRoot.length > 0 ? path.resolve(envRoot) : '/home/clearpanel';
    return path.join(base, username);
  }

  private validatePath(requestedPath: string, username: string): string {
    const rootPath = this.getRootPath(username);
    const rootResolved = path.resolve(rootPath);
    
    let full: string;
    if (path.isAbsolute(requestedPath)) {
      full = path.resolve(requestedPath);
    } else {
      const rel = requestedPath.replace(/^\/+/, '');
      full = path.resolve(rootPath, rel);
    }

    if (!full.startsWith(rootResolved)) {
      const msg = `Access denied: full='${full}' outside rootResolved='${rootResolved}' (req='${requestedPath}', user='${username}')`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    return full;
  }

  // Helper to extract hostname from a URL (used as a credentials key for host-wide auth)
  private extractUrlHost(url: string): string | null {
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  }

  // ── Credential store ──────────────────────────────────────────────────────
  // Stored at /home/clearpanel/<user>/.git-credentials.json
  // { [repoPath]: { token: string, username: string } }

  private credFile(username: string): string {
    return path.join(this.getRootPath(username), '.git-credentials.json');
  }

  private async readCreds(username: string): Promise<Record<string, { token: string; username: string }>> {
    try {
      const raw = await fs.readFile(this.credFile(username), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private async writeCreds(username: string, data: Record<string, { token: string; username: string }>) {
    await fs.writeFile(this.credFile(username), JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  async setRepoCred(username: string, repoPath: string, token: string, gitUsername: string) {
    const abs = this.validatePath(repoPath, username);
    const creds = await this.readCreds(username);
    creds[abs] = { token, username: gitUsername };
    await this.writeCreds(username, creds);
    return { success: true };
  }

  async removeRepoCred(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const creds = await this.readCreds(username);
    delete creds[abs];
    await this.writeCreds(username, creds);
    return { success: true };
  }

  // ── Webhook Logs ──────────────────────────────────────────────────────────

  private getWebhookLogsFile(): string {
    return getDataFilePath('webhook-logs.json');
  }

  private async readWebhookLogs(): Promise<WebhookLog[]> {
    try {
      const raw = await fs.readFile(this.getWebhookLogsFile(), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeWebhookLogs(logs: WebhookLog[]) {
    // Keep only the last 500 logs globally to prevent file bloat
    const trimmed = logs.slice(0, 500);
    await fs.writeFile(this.getWebhookLogsFile(), JSON.stringify(trimmed, null, 2), { mode: 0o600 });
  }

  async getWebhookLogsForRepo(repoPath: string): Promise<WebhookLog[]> {
    const allLogs = await this.readWebhookLogs();
    return allLogs.filter(log => log.repoPath === repoPath);
  }

  private async addOrUpdateWebhookLog(logEntry: WebhookLog) {
    const logs = await this.readWebhookLogs();
    const existingIndex = logs.findIndex(l => l.id === logEntry.id);
    if (existingIndex >= 0) {
      logs[existingIndex] = { ...logs[existingIndex], ...logEntry };
    } else {
      logs.unshift(logEntry);
    }
    await this.writeWebhookLogs(logs);
  }

  // ── Core git runner ───────────────────────────────────────────────────────

  private async runGit(
    args: string[],
    cwd: string,
    username: string,
    extraEnv: Record<string, string> = {},
  ): Promise<string> {
    const sshKey = path.join(this.getRootPath(username), '.ssh', 'id_ed25519');
    const sshKeyFallback = path.join(this.getRootPath(username), '.ssh', 'id_rsa');
    const keyFile = fsSync.existsSync(sshKey) ? sshKey : sshKeyFallback;

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      PATH: `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${process.env.PATH ?? ''}`,
      HOME: this.getRootPath(username),
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: username,
      GIT_COMMITTER_NAME: username,
      GIT_SSH_COMMAND: `ssh -i "${keyFile}" -o StrictHostKeyChecking=no -o BatchMode=yes`,
      ...extraEnv,
    };

    this.logger.debug(`Executing /usr/bin/git ${args.join(' ')} in ${cwd}`);

    try {
      const gitArgs = ['-c', 'safe.directory=*', ...args];
      const { stdout } = await execFile('/usr/bin/git', gitArgs, { cwd, env: env as NodeJS.ProcessEnv, maxBuffer: 10 * 1024 * 1024 });
      return stdout.trim();
    } catch (e: any) {
      this.logger.error(`Git command failed: git ${args.join(' ')} - Error: ${e.message}`, e.stack);
      if (e.code === 'ENOENT') {
        this.logger.error(`PATH during failure: ${env.PATH}`);
      }
      throw e;
    }
  }

  // Inject HTTPS token into remote URL before push/pull
  private injectToken(url: string, token: string, gitUsername: string): string {
    try {
      const u = new URL(url);
      u.username = encodeURIComponent(gitUsername);
      u.password = encodeURIComponent(token);
      return u.toString();
    } catch {
      return url;
    }
  }

  // ── Repository detection ──────────────────────────────────────────────────

  async isRepo(username: string, repoPath: string): Promise<boolean> {
    const abs = this.validatePath(repoPath, username);
    return fsSync.existsSync(path.join(abs, '.git'));
  }

  // ── Init / Clone ──────────────────────────────────────────────────────────

  async init(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    await fs.mkdir(abs, { recursive: true });
    await this.runGit(['init'], abs, username);

    // Set default identity
    await this.runGit(['config', 'user.name', username], abs, username);
    await this.runGit(['config', 'user.email', `${username}@localhost`], abs, username);

    return { success: true, message: `Initialized empty repository in ${abs}` };
  }

  async clone(username: string, url: string, destDir: string, repoName?: string, token?: string, gitUser?: string) {
    const absParent = this.validatePath(destDir, username);

    // Ensure the destination parent directory exists
    await fs.mkdir(absParent, { recursive: true });

    // Determine the final destination folder
    const guessedNameEarly = url.split('/').pop()?.replace(/\.git$/, '') || 'repo';
    const isDirectClone = repoName === '.';
    const destFolder = isDirectClone ? absParent : path.join(absParent, repoName || guessedNameEarly);

    // If a destination folder exists but has no git history it is a leftover from a
    // previous failed clone — remove it so git can clone cleanly.
    // NOTE: For direct clone (.), we don't want to wipe the whole parent dir!
    // We only check if it's already a repo.
    if (fsSync.existsSync(destFolder)) {
      const isAlreadyRepo = fsSync.existsSync(path.join(destFolder, '.git'));
      if (isAlreadyRepo) {
        throw new Error(`A repository already exists at "${destFolder}". Remove it first before cloning again.`);
      }
      
      if (!isDirectClone) {
        // Partial / empty leftover — wipe it
        await fs.rm(destFolder, { recursive: true, force: true });
      } else {
        // For direct clone, git requires the directory to be empty.
        // We'll let git itself complain if it's not empty, or we could check here.
        const files = await fs.readdir(destFolder);
        if (files.length > 0) {
          throw new Error(`Destination path "${destFolder}" is not empty. Git cloning into an existing directory requires it to be empty.`);
        }
      }
    }

    let cloneUrl = url;
    // Inject HTTPS token directly into the URL if provided
    if (token && gitUser && (url.startsWith('http://') || url.startsWith('https://'))) {
      cloneUrl = this.injectToken(url, token, gitUser);
    } else {
      // Fall back to stored credentials keyed by URL host
      const creds = await this.readCreds(username);
      const urlHost = this.extractUrlHost(url);
      const hostCred = urlHost ? (creds[urlHost] || null) : null;
      if (hostCred && (url.startsWith('http://') || url.startsWith('https://'))) {
        cloneUrl = this.injectToken(url, hostCred.token, hostCred.username);
      }
    }

    const guessedName = url.split('/').pop()?.replace(/\.git$/, '') || 'repo';
    const cloneArgs = repoName
      ? ['clone', cloneUrl, repoName]
      : ['clone', cloneUrl];

    // For direct clone, we run it in the parent of absParent? No, we run it in absParent with '.' as target.
    // Wait, if repoName is '.', runGit(cloneArgs, absParent, username) executes:
    // /usr/bin/git clone <url> .  inside  absParent.
    // This is correct.

    await this.runGit(cloneArgs, absParent, username);

    const cloned = isDirectClone ? absParent : path.join(absParent, repoName || guessedName);

    // Set identity in cloned repo
    await this.runGit(['config', 'user.name', username], cloned, username).catch(() => null);
    await this.runGit(['config', 'user.email', `${username}@localhost`], cloned, username).catch(() => null);

    // Save credentials keyed by BOTH the repo path and the URL host for future pulls/pushes
    if (token && gitUser) {
      const creds = await this.readCreds(username);
      creds[cloned] = { token, username: gitUser };
      const urlHost = this.extractUrlHost(url);
      if (urlHost) creds[urlHost] = { token, username: gitUser };
      await this.writeCreds(username, creds);
    }

    return { success: true, message: 'Repository cloned', path: cloned };
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async status(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);

    const porcelain = await this.runGit(['status', '--porcelain', '-uall'], abs, username);
    const branch = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], abs, username).catch(() => 'HEAD');
    const ahead = await this.runGit(['rev-list', '--count', 'HEAD..@{u}'], abs, username).catch(() => '0');
    const behind = await this.runGit(['rev-list', '--count', '@{u}..HEAD'], abs, username).catch(() => '0');

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of porcelain.split('\n').filter(Boolean)) {
      const x = line[0];
      const y = line[1];
      const file = line.slice(3);
      if (x !== ' ' && x !== '?') staged.push(`${x} ${file}`);
      if (y === 'M' || y === 'D') unstaged.push(`${y} ${file}`);
      if (x === '?' && y === '?') untracked.push(file);
    }

    return {
      success: true,
      branch,
      ahead: parseInt(ahead, 10) || 0,
      behind: parseInt(behind, 10) || 0,
      staged,
      unstaged,
      untracked,
    };
  }

  // ── Staging ───────────────────────────────────────────────────────────────

  async add(username: string, repoPath: string, files: string[]) {
    const abs = this.validatePath(repoPath, username);
    const args = files.length ? ['add', '--', ...files] : ['add', '-A'];
    await this.runGit(args, abs, username);
    return { success: true };
  }

  async unstage(username: string, repoPath: string, files: string[]) {
    const abs = this.validatePath(repoPath, username);
    const args = files.length ? ['reset', 'HEAD', '--', ...files] : ['reset', 'HEAD'];
    await this.runGit(args, abs, username);
    return { success: true };
  }

  async discard(username: string, repoPath: string, files: string[]) {
    const abs = this.validatePath(repoPath, username);
    if (!files.length) throw new Error('Provide at least one file to discard');
    await this.runGit(['checkout', '--', ...files], abs, username);
    return { success: true };
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  async commit(username: string, repoPath: string, message: string, authorName?: string, authorEmail?: string) {
    const abs = this.validatePath(repoPath, username);
    const name = authorName || username;
    const email = authorEmail || `${username}@localhost`;
    await this.runGit(
      ['commit', '-m', message],
      abs,
      username,
      { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email },
    );
    return { success: true };
  }

  // ── Log ───────────────────────────────────────────────────────────────────

  async log(username: string, repoPath: string, limit = 50, branch?: string) {
    const abs = this.validatePath(repoPath, username);
    const ref = branch || 'HEAD';
    const fmt = '%H%x1f%h%x1f%an%x1f%ae%x1f%ai%x1f%s%x1f%D';
    const raw = await this.runGit(['log', ref, `--max-count=${limit}`, `--format=${fmt}`], abs, username)
      .catch(() => '');

    const commits = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, short, authorName, authorEmail, date, subject, refs] = line.split('\x1f');
        return { hash, short, authorName, authorEmail, date, subject, refs };
      });

    return { success: true, commits };
  }

  // ── Diff ─────────────────────────────────────────────────────────────────

  async diff(username: string, repoPath: string, file?: string) {
    const abs = this.validatePath(repoPath, username);
    const args = file ? ['diff', '--', file] : ['diff'];
    const output = await this.runGit(args, abs, username).catch(() => '');
    return { success: true, diff: output };
  }

  async diffStaged(username: string, repoPath: string, file?: string) {
    const abs = this.validatePath(repoPath, username);
    const args = file ? ['diff', '--cached', '--', file] : ['diff', '--cached'];
    const output = await this.runGit(args, abs, username).catch(() => '');
    return { success: true, diff: output };
  }

  async diffCommit(username: string, repoPath: string, commitHash: string) {
    const abs = this.validatePath(repoPath, username);
    const output = await this.runGit(['show', '--format=', commitHash], abs, username).catch(() => '');
    return { success: true, diff: output };
  }

  // ── Branches ─────────────────────────────────────────────────────────────

  async branches(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const local = await this.runGit(['branch', '--format=%(refname:short)'], abs, username).catch(() => '');
    const current = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], abs, username).catch(() => '');
    const remote = await this.runGit(['branch', '-r', '--format=%(refname:short)'], abs, username).catch(() => '');

    return {
      success: true,
      current: current.trim(),
      local: local.split('\n').filter(Boolean),
      remote: remote.split('\n').filter(Boolean),
    };
  }

  async checkoutBranch(username: string, repoPath: string, branch: string) {
    const abs = this.validatePath(repoPath, username);
    await this.runGit(['checkout', branch], abs, username);
    return { success: true };
  }

  async createBranch(username: string, repoPath: string, branch: string, from?: string) {
    const abs = this.validatePath(repoPath, username);
    const args = from ? ['checkout', '-b', branch, from] : ['checkout', '-b', branch];
    await this.runGit(args, abs, username);
    return { success: true };
  }

  async deleteBranch(username: string, repoPath: string, branch: string, force = false) {
    const abs = this.validatePath(repoPath, username);
    await this.runGit(['branch', force ? '-D' : '-d', branch], abs, username);
    return { success: true };
  }

  async mergeBranch(username: string, repoPath: string, branch: string) {
    const abs = this.validatePath(repoPath, username);
    await this.runGit(['merge', branch], abs, username);
    return { success: true };
  }

  // ── Remotes ───────────────────────────────────────────────────────────────

  async remotes(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const raw = await this.runGit(['remote', '-v'], abs, username).catch(() => '');
    const map: Record<string, { fetch: string; push: string }> = {};
    for (const line of raw.split('\n').filter(Boolean)) {
      const [name, url, type] = line.split(/\s+/);
      if (!map[name]) map[name] = { fetch: '', push: '' };
      if (type === '(fetch)') map[name].fetch = url;
      if (type === '(push)') map[name].push = url;
    }
    return { success: true, remotes: map };
  }

  async addRemote(username: string, repoPath: string, name: string, url: string) {
    const abs = this.validatePath(repoPath, username);
    await this.runGit(['remote', 'add', name, url], abs, username);
    return { success: true };
  }

  async removeRemote(username: string, repoPath: string, name: string) {
    const abs = this.validatePath(repoPath, username);
    await this.runGit(['remote', 'remove', name], abs, username);
    return { success: true };
  }

  // ── Pull / Push ───────────────────────────────────────────────────────────

  private async resolveRemoteUrl(username: string, repoPath: string, remote: string): Promise<string | null> {
    const abs = this.validatePath(repoPath, username);
    try {
      const url = await this.runGit(['remote', 'get-url', remote], abs, username);
      return url.trim();
    } catch {
      return null;
    }
  }

  async pull(username: string, repoPath: string, remote = 'origin', branch?: string) {
    const abs = this.validatePath(repoPath, username);
    const creds = await this.readCreds(username);
    const remoteUrl = await this.resolveRemoteUrl(username, repoPath, remote);
    const urlHost = remoteUrl ? this.extractUrlHost(remoteUrl) : null;
    // Look up by exact repo path first, fall back to URL host
    const cred = creds[abs] || (urlHost ? creds[urlHost] : null) || null;
    const extraEnv: Record<string, string> = {};

    if (remoteUrl && cred && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'))) {
      const tokenUrl = this.injectToken(remoteUrl, cred.token, cred.username);
      // Override remote URL temporarily via env
      extraEnv['GIT_CONFIG_COUNT'] = '1';
      extraEnv['GIT_CONFIG_KEY_0'] = `url.${tokenUrl}.insteadOf`;
      extraEnv['GIT_CONFIG_VALUE_0'] = remoteUrl;
    }

    const args = branch ? ['pull', remote, branch] : ['pull', remote];
    const output = await this.runGit(args, abs, username, extraEnv);
    return { success: true, output };
  }

  async push(username: string, repoPath: string, remote = 'origin', branch?: string, force = false) {
    const abs = this.validatePath(repoPath, username);
    const creds = await this.readCreds(username);
    const remoteUrl = await this.resolveRemoteUrl(username, repoPath, remote);
    const urlHost = remoteUrl ? this.extractUrlHost(remoteUrl) : null;
    const cred = creds[abs] || (urlHost ? creds[urlHost] : null) || null;
    const extraEnv: Record<string, string> = {};

    if (remoteUrl && cred && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'))) {
      const tokenUrl = this.injectToken(remoteUrl, cred.token, cred.username);
      extraEnv['GIT_CONFIG_COUNT'] = '1';
      extraEnv['GIT_CONFIG_KEY_0'] = `url.${tokenUrl}.insteadOf`;
      extraEnv['GIT_CONFIG_VALUE_0'] = remoteUrl;
    }

    const currentBranch = branch || (await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], abs, username).catch(() => 'main'));
    const args = ['push', ...(force ? ['-f'] : []), remote, currentBranch];
    const output = await this.runGit(args, abs, username, extraEnv);
    return { success: true, output };
  }

  async fetch(username: string, repoPath: string, remote = 'origin') {
    const abs = this.validatePath(repoPath, username);
    const output = await this.runGit(['fetch', remote, '--prune'], abs, username);
    return { success: true, output };
  }

  // ── Stash ─────────────────────────────────────────────────────────────────

  async stash(username: string, repoPath: string, message?: string) {
    const abs = this.validatePath(repoPath, username);
    const args = message ? ['stash', 'push', '-m', message] : ['stash', 'push'];
    await this.runGit(args, abs, username);
    return { success: true };
  }

  async stashList(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const raw = await this.runGit(['stash', 'list', '--format=%gd%x1f%s%x1f%ai'], abs, username).catch(() => '');
    const stashes = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [ref, subject, date] = line.split('\x1f');
        return { ref, subject, date };
      });
    return { success: true, stashes };
  }

  async stashPop(username: string, repoPath: string, ref?: string) {
    const abs = this.validatePath(repoPath, username);
    const args = ref ? ['stash', 'pop', ref] : ['stash', 'pop'];
    await this.runGit(args, abs, username);
    return { success: true };
  }

  async stashDrop(username: string, repoPath: string, ref?: string) {
    const abs = this.validatePath(repoPath, username);
    const args = ref ? ['stash', 'drop', ref] : ['stash', 'drop'];
    await this.runGit(args, abs, username);
    return { success: true };
  }

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfig(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const name = await this.runGit(['config', 'user.name'], abs, username).catch(() => '');
    const email = await this.runGit(['config', 'user.email'], abs, username).catch(() => '');
    return { success: true, name, email };
  }

  async setConfig(username: string, repoPath: string, name: string, email: string) {
    const abs = this.validatePath(repoPath, username);
    await this.runGit(['config', 'user.name', name], abs, username);
    await this.runGit(['config', 'user.email', email], abs, username);
    return { success: true };
  }

  // ── Path discovery ────────────────────────────────────────────────────────

  async listPaths(username: string) {
    const root = this.getRootPath(username);
    const results: Array<{ label: string; path: string; kind: 'home' | 'domain' }> = [];

    // Subdirectories of the user home root
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      results.push({ label: '~ (home root)', path: root, kind: 'home' });
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.')) {
          results.push({ label: e.name, path: path.join(root, e.name), kind: 'home' });
        }
      }
    } catch { /* home doesn't exist yet */ }

    // Domain document roots from domains.json
    try {
      const raw = await fs.readFile(getDataFilePath('domains.json'), 'utf-8');
      const domains: Array<{ name: string; folderPath: string }> = JSON.parse(raw);
      for (const d of domains) {
        if (d.folderPath) {
          results.push({ label: d.name, path: d.folderPath, kind: 'domain' });
        }
      }
    } catch { /* no domains yet */ }

    return { success: true, paths: results };
  }

  // ── Managed Repositories ──────────────────────────────────────────────────

  private managedReposPath(): string {
    return getDataFilePath('git-repos.json');
  }

  private async readAllManagedRepos(): Promise<ManagedRepo[]> {
    try {
      const raw = await fs.readFile(this.managedReposPath(), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeAllManagedRepos(repos: ManagedRepo[]) {
    await fs.writeFile(this.managedReposPath(), JSON.stringify(repos, null, 2));
  }

  async listManagedRepos(username: string) {
    const repos = await this.readAllManagedRepos();
    const enriched = await Promise.all(
      repos.map(async (repo) => {
        if (repo.isCloning) return repo;
        try {
          const abs = path.resolve(repo.path);
          if (!fsSync.existsSync(path.join(abs, '.git'))) {
            return { ...repo, currentBranch: '' };
          }
          const branch = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], abs, username).catch(() => '');
          return { ...repo, currentBranch: branch.trim() };
        } catch {
          return repo;
        }
      }),
    );
    return { success: true, repos: enriched };
  }

  async addManagedRepo(username: string, name: string, repoPath: string, cloneUrl?: string) {
    const abs = this.validatePath(repoPath, username);
    const repos = await this.readAllManagedRepos();
    const idx = repos.findIndex((r) => r.path === abs);
    const entry: ManagedRepo = { name, path: abs, cloneUrl, addedAt: new Date().toISOString() };
    if (idx >= 0) repos[idx] = entry;
    else repos.push(entry);
    await this.writeAllManagedRepos(repos);
    return { success: true };
  }

  async removeManagedRepo(username: string, repoPath: string, deleteFiles = true) {
    const abs = this.validatePath(repoPath, username);
    // Remove from managed list
    const repos = await this.readAllManagedRepos();
    await this.writeAllManagedRepos(repos.filter((r) => r.path !== abs));
    // Delete the repository directory from disk
    if (deleteFiles && fsSync.existsSync(abs)) {
      await fs.rm(abs, { recursive: true, force: true });
    }
    return { success: true };
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  async enableWebhook(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const repos = await this.readAllManagedRepos();
    const repo = repos.find((r) => r.path === abs);
    if (!repo) throw new Error('Repository not found in managed list');
    
    repo.webhookId = crypto.randomUUID();
    repo.webhookSecret = crypto.randomBytes(32).toString('hex');
    repo.autoDeployEnabled = true;
    
    await this.writeAllManagedRepos(repos);
    return { success: true, webhookId: repo.webhookId, webhookSecret: repo.webhookSecret };
  }

  async disableWebhook(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const repos = await this.readAllManagedRepos();
    const repo = repos.find((r) => r.path === abs);
    if (!repo) throw new Error('Repository not found in managed list');
    
    delete repo.webhookId;
    delete repo.webhookSecret;
    repo.autoDeployEnabled = false;
    
    await this.writeAllManagedRepos(repos);
    return { success: true };
  }

  async processGithubWebhook(webhookId: string, signature: string, payload: any) {
    const repos = await this.readAllManagedRepos();
    // We need to find which user and repo this belongs to
    // In a real multi-tenant scenario we might need the username from context,
    // but the webhook ID should be globally unique across all repos in clearpanel.
    const repo = repos.find((r) => r.webhookId === webhookId);
    if (!repo || !repo.webhookSecret) {
      throw new Error('Webhook not found or not configured');
    }

    // Validate signature
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', repo.webhookSecret);
    const digest = 'sha256=' + hmac.update(payloadString).digest('hex');
    
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
         throw new Error('Invalid signature');
      }
    } catch {
       throw new Error('Invalid signature');
    }

    // Since we don't store the username in ManagedRepo currently, we have to deduce it from the path.
    const envRoot = process.env.ROOT_PATH?.trim();
    const base = envRoot && envRoot.length > 0 ? path.resolve(envRoot).replace(/\\/g, '/') : '/home/clearpanel';
    const normalizedRepoPath = repo.path.replace(/\\/g, '/');
    
    let username: string;
    if (normalizedRepoPath.startsWith(base)) {
      const relPath = normalizedRepoPath.substring(base.length).replace(/^\/+/, '');
      username = relPath.split('/')[0];
    } else {
      const pathParts = normalizedRepoPath.split('/').filter(Boolean);
      username = pathParts[1];
    }

    if (!username) {
      throw new Error('Could not deduce username from repository path');
    }

    // Get branch from ref, e.g. refs/heads/main -> main
    const ref = payload.ref || '';
    const branchMatch = ref.match(/^refs\/heads\/(.*)$/);
    let branchToPull = '';
    if (branchMatch) {
       branchToPull = branchMatch[1];
    }

    const logEntry: WebhookLog = {
      id: crypto.randomUUID(),
      repoPath: repo.path,
      date: new Date().toISOString(),
      status: 'deploying',
      branch: branchToPull || 'unknown',
    };

    try {
      this.logger.log(`Processing auto-deploy for webhook ${webhookId} (repo: ${repo.path})`);
      await this.addOrUpdateWebhookLog(logEntry);
      
      // Check current checked out branch
      const abs = this.validatePath(repo.path, username);
      const currentBranch = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], abs, username).catch(() => '');
      
      // If a specific branch was pushed, and it doesn't match the current branch, we can skip or log.
      if (branchToPull && currentBranch && branchToPull !== currentBranch.trim()) {
         this.logger.log(`Push was to branch ${branchToPull}, but repo is on ${currentBranch}. Skipping auto-deploy.`);
         logEntry.status = 'failed';
         logEntry.error = `Skipped: Push was to branch ${branchToPull}, but repo is on ${currentBranch}.`;
         await this.addOrUpdateWebhookLog(logEntry);
         return { success: true, message: `Skipped: Push to ${branchToPull} ignored` };
      }

      // Pull
      const pullResult = await this.pull(username, repo.path, 'origin', currentBranch.trim());
      
      // Deploy
      const deployResult = await this.deploy(username, repo.path);
      
      this.logger.log(`Auto-deploy successful for ${repo.path}`);
      
      logEntry.status = 'success';
      logEntry.output = `=== GIT PULL ===\n${pullResult.output || 'Already up to date.'}\n\n=== DEPLOY SCRIPT ===\n${deployResult.output}`;
      await this.addOrUpdateWebhookLog(logEntry);
      
      return { success: true, output: deployResult.output };
    } catch (error: any) {
      this.logger.error(`Auto-deploy failed for ${repo.path}: ${error.message}`);
      
      logEntry.status = 'failed';
      logEntry.error = error.message;
      await this.addOrUpdateWebhookLog(logEntry);
      
      throw error;
    }
  }

  // ── Repository Info ───────────────────────────────────────────────────────

  async getHeadCommit(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const fmt = '%H%x1f%h%x1f%an%x1f%ae%x1f%ai%x1f%s';
    const raw = await this.runGit(['log', '-1', `--format=${fmt}`], abs, username).catch(() => '');
    if (!raw.trim()) return { success: true, commit: null };
    const [hash, short, authorName, authorEmail, date, subject] = raw.trim().split('\x1f');
    const remoteUrl = await this.runGit(['remote', 'get-url', 'origin'], abs, username).catch(() => '');
    return { success: true, commit: { hash, short, authorName, authorEmail, date, subject, remoteUrl: remoteUrl.trim() } };
  }

  // ── Deploy Script ─────────────────────────────────────────────────────────

  private deployScriptPath(repoPath: string): string {
    return path.join(repoPath, '.clearpanel-deploy.sh');
  }

  async getDeployScript(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const scriptPath = this.deployScriptPath(abs);
    try {
      const content = await fs.readFile(scriptPath, 'utf-8');
      return { success: true, script: content };
    } catch {
      const template =
        `#!/bin/bash\n# ClearPanel Deploy Script\n# This script runs when you click "Deploy HEAD Commit"\n# Environment: runs from your repository root directory\n\n# Example — copy built files to your web root:\n# export DEPLOYPATH=/home/clearpanel/public_html/\n# cp -r dist/* $DEPLOYPATH\n`;
      return { success: true, script: template };
    }
  }

  async setDeployScript(username: string, repoPath: string, script: string) {
    const abs = this.validatePath(repoPath, username);
    const scriptPath = this.deployScriptPath(abs);
    await fs.writeFile(scriptPath, script, { mode: 0o755 });
    return { success: true };
  }

  async deploy(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const scriptPath = this.deployScriptPath(abs);
    if (!fsSync.existsSync(scriptPath)) {
      throw new Error('No deploy script found. Save a deploy script first in the Pull or Deploy tab.');
    }
    let stdout = '';
    let stderr = '';
    try {
      const r = await execFile('bash', [scriptPath], {
        cwd: abs,
        env: {
          ...process.env,
          PATH: `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${process.env.PATH ?? ''}`,
          HOME: this.getRootPath(username),
        } as NodeJS.ProcessEnv,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000,
      });
      stdout = r.stdout;
      stderr = r.stderr;
    } catch (e: any) {
      stdout = e.stdout || '';
      stderr = e.stderr || e.message || 'Deploy script failed';
    }
    return { success: true, output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : '') };
  }
}
