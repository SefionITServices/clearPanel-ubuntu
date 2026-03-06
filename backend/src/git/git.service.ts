import { Injectable } from '@nestjs/common';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
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
}

const execFile = promisify(execFileCb);


// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GitService {
  // ── Path helpers (same sandbox as FilesService) ──────────────────────────

  private getRootPath(username: string): string {
    const envRoot = process.env.ROOT_PATH?.trim();
    const base = envRoot && envRoot.length > 0 ? path.resolve(envRoot) : '/home/clearpanel';
    return path.join(base, username);
  }

  private validatePath(requestedPath: string, username: string): string {
    const rootPath = this.getRootPath(username);
    const rel = requestedPath.replace(/^\/+/, '');
    const full = path.resolve(rootPath, rel);
    const rootResolved = path.resolve(rootPath);
    if (!full.startsWith(rootResolved)) throw new Error('Access denied');
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

    // Use 'git' (not an absolute path) so the PATH we build above resolves the
    // correct binary — avoids ENOENT when git is a snap wrapper or lives outside /usr/bin
    const { stdout } = await execFile('git', args, { cwd, env: env as NodeJS.ProcessEnv, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
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
    await this.runGit(['init'], abs, username);

    // Set default identity
    await this.runGit(['config', 'user.name', username], abs, username);
    await this.runGit(['config', 'user.email', `${username}@localhost`], abs, username);

    return { success: true, message: `Initialized empty repository in ${abs}` };
  }

  async clone(username: string, url: string, destDir: string, repoName?: string, token?: string, gitUser?: string) {
    const absParent = this.validatePath(destDir, username);

    // Ensure the destination parent directory exists — execFile throws ENOENT if cwd is missing
    await fs.mkdir(absParent, { recursive: true });

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

    await this.runGit(cloneArgs, absParent, username);

    const cloned = path.join(absParent, repoName || guessedName);

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

  async removeManagedRepo(username: string, repoPath: string) {
    const abs = this.validatePath(repoPath, username);
    const repos = await this.readAllManagedRepos();
    await this.writeAllManagedRepos(repos.filter((r) => r.path !== abs));
    return { success: true };
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
