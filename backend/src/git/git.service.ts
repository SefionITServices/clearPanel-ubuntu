import { Injectable } from '@nestjs/common';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeShell(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

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
      HOME: this.getRootPath(username),
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: username,
      GIT_COMMITTER_NAME: username,
      GIT_SSH_COMMAND: `ssh -i ${escapeShell(keyFile)} -o StrictHostKeyChecking=no -o BatchMode=yes`,
      ...extraEnv,
    };

    const cmd = ['git', ...args.map(escapeShell)].join(' ');
    const { stdout } = await exec(cmd, { cwd, env, maxBuffer: 10 * 1024 * 1024 });
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

  async clone(username: string, url: string, destDir: string, repoName?: string) {
    const absParent = this.validatePath(destDir, username);
    const creds = await this.readCreds(username);
    let cloneUrl = url;

    // If HTTPS and we have a token for this destination
    const absTarget = path.join(absParent, repoName || url.split('/').pop()?.replace(/\.git$/, '') || 'repo');
    const cred = creds[absTarget];
    if (cred && (url.startsWith('http://') || url.startsWith('https://'))) {
      cloneUrl = this.injectToken(url, cred.token, cred.username);
    }

    const cloneArgs = repoName
      ? ['clone', cloneUrl, repoName]
      : ['clone', cloneUrl];

    await this.runGit(cloneArgs, absParent, username);

    const cloned = repoName
      ? path.join(absParent, repoName)
      : absTarget;

    // Set identity in cloned repo
    await this.runGit(['config', 'user.name', username], cloned, username);
    await this.runGit(['config', 'user.email', `${username}@localhost`], cloned, username);

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
    const cred = creds[abs];

    let remoteUrl = await this.resolveRemoteUrl(username, repoPath, remote);
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
    const cred = creds[abs];

    let remoteUrl = await this.resolveRemoteUrl(username, repoPath, remote);
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
}
