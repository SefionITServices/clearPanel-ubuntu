import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function writeNginxConfig(configPath: string, content: string): Promise<void> {
  let original: string | null = null;
  try {
    original = await fs.readFile(configPath, 'utf-8');
  } catch {
    // Config doesn't exist yet
  }

  const tmp = `/tmp/nginx-inject-${Date.now()}-${Math.random().toString(36).slice(2)}.conf`;
  try {
    await fs.writeFile(tmp, content, 'utf-8');
    await execAsync(`sudo tee ${configPath} < ${tmp} > /dev/null`, { timeout: 10_000 });
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }

  // Validate nginx syntax
  try {
    await execAsync('sudo nginx -t', { timeout: 15_000 });
  } catch (err: any) {
    // Rollback if syntax validation fails
    if (original !== null) {
      const rollbackTmp = `/tmp/nginx-rollback-${Date.now()}.conf`;
      try {
        await fs.writeFile(rollbackTmp, original, 'utf-8');
        await execAsync(`sudo tee ${configPath} < ${rollbackTmp} > /dev/null`, { timeout: 10_000 });
      } finally {
        await fs.unlink(rollbackTmp).catch(() => {});
      }
    } else {
      await execAsync(`sudo rm -f ${configPath} /etc/nginx/sites-enabled/${path.basename(configPath)}`, { timeout: 10_000 }).catch(() => {});
    }
    throw new Error(`Nginx syntax test failed: ${err.stderr || err.message}`);
  }
}

function findServerBlocks(config: string): { start: number; closingBrace: number; content: string }[] {
  const blocks: { start: number; closingBrace: number; content: string }[] = [];
  let pos = 0;
  while (pos < config.length) {
    const serverMatch = config.slice(pos).search(/\bserver\s*\{/);
    if (serverMatch === -1) break;
    const start = pos + serverMatch;
    const braceStart = config.indexOf('{', start);
    let depth = 1;
    let i = braceStart + 1;
    while (i < config.length && depth > 0) {
      if (config[i] === '{') depth++;
      else if (config[i] === '}') depth--;
      i++;
    }
    if (depth === 0) {
      blocks.push({
        start,
        closingBrace: i - 1,
        content: config.slice(start, i),
      });
      pos = i;
    } else {
      break;
    }
  }
  return blocks;
}

/**
 * Inject or replace a clearly-marked block inside an Nginx vhost config.
 *
 * @param domain   - vhost name (maps to /etc/nginx/sites-available/{domain})
 * @param marker   - uppercase tag used in BEGIN/END comments  e.g. 'REDIRECTS'
 * @param content  - raw nginx directives to place inside the block (no surrounding braces)
 *                   pass empty string to remove the block entirely
 */
export async function injectNginxBlock(
  domain: string,
  marker: string,
  content: string,
): Promise<void> {
  const configPath = `/etc/nginx/sites-available/${domain}`;

  let config: string;
  try {
    config = await fs.readFile(configPath, 'utf-8');
  } catch {
    // vhost doesn't exist yet
    if (!content.trim()) {
      return;
    }
    // Create a minimal vhost for this domain
    config = `server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};

    location / {
        try_files $uri $uri/ =404;
    }
}
`;
    await fs.mkdir('/etc/nginx/sites-enabled', { recursive: true });
    try {
      await execAsync(`sudo ln -sf ${configPath} /etc/nginx/sites-enabled/${domain}`);
    } catch {}
  }

  const tag = escapeRegex(marker);
  // Remove existing block (including surrounding newlines)
  const re = new RegExp(
    `\\n?[ \\t]*# BEGIN CLEARPANEL ${tag}[\\s\\S]*?# END CLEARPANEL ${tag}[ \\t]*\\n?`,
    'g',
  );
  config = config.replace(re, '\n');

  if (content.trim()) {
    const indented = content
      .trim()
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n');
    const block = `\n    # BEGIN CLEARPANEL ${marker}\n${indented}\n    # END CLEARPANEL ${marker}\n`;

    const blocks = findServerBlocks(config);
    if (blocks.length > 0) {
      // Find content-serving blocks (have root, proxy_pass, fastcgi_pass, ssl, or port 443)
      let targetBlocks = blocks.filter(
        (b) =>
          b.content.includes('root') ||
          b.content.includes('proxy_pass') ||
          b.content.includes('fastcgi_pass') ||
          b.content.includes('443') ||
          b.content.includes('ssl'),
      );

      // If no blocks matched the heuristic, fallback to the first block
      if (targetBlocks.length === 0) {
        targetBlocks = [blocks[0]];
      }

      // Find insert position for each block:
      // Prefer before the first location block so redirects have precedence over other locations;
      // fallback to before the closing brace if no location blocks exist.
      const targetsWithPos = targetBlocks.map((tb) => {
        const firstLocMatch = tb.content.search(/(?:^[ \t]*#[^\n]*\n)*[ \t]*location\s+[^{]+\{/m);
        const insertPos = firstLocMatch !== -1 ? tb.start + firstLocMatch : tb.closingBrace;
        return { tb, insertPos };
      });

      // Sort descending by insertPos so earlier replacements don't shift later string indices
      targetsWithPos.sort((a, b) => b.insertPos - a.insertPos);

      for (const item of targetsWithPos) {
        config = config.slice(0, item.insertPos) + block + config.slice(item.insertPos);
      }
    } else {
      // Fallback regex if brace matching didn't find server block
      config = config.replace(/(\n[ \t]*)(}\s*)$/, `${block}$1$2`);
    }
  }

  await writeNginxConfig(configPath, config);
}

export async function reloadNginx(): Promise<void> {
  await execAsync('sudo nginx -t', { timeout: 15_000 });
  try {
    // If /run/nginx.pid is empty or missing, repopulate it with the master nginx PID
    await execAsync('sudo bash -c \'if [ ! -s /run/nginx.pid ]; then pgrep -o -f "nginx: master process" > /run/nginx.pid || true; fi\'', { timeout: 5000 });
  } catch {}
  await execAsync('sudo systemctl reload nginx', { timeout: 30_000 });
}
