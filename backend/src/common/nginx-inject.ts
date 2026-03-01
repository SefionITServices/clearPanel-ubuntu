import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function writeNginxConfig(configPath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(configPath, content, 'utf-8');
  } catch {
    const tmp = `/tmp/nginx-inject-${Date.now()}.conf`;
    await fs.writeFile(tmp, content, 'utf-8');
    await execAsync(`sudo tee ${configPath} < ${tmp} > /dev/null`, { timeout: 10_000 });
    await fs.unlink(tmp).catch(() => {});
  }
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
    // vhost doesn't exist yet — skip silently
    return;
  }

  const tag = escapeRegex(marker);
  // Remove existing block (including surrounding newlines)
  const re = new RegExp(
    `\\n[ \\t]*# BEGIN CLEARPANEL ${tag}[\\s\\S]*?# END CLEARPANEL ${marker}[ \\t]*`,
    'g',
  );
  config = config.replace(re, '');

  if (content.trim()) {
    const indented = content
      .trim()
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n');
    const block = `\n    # BEGIN CLEARPANEL ${marker}\n${indented}\n    # END CLEARPANEL ${marker}`;

    // Insert before the final closing brace of the first server {} block
    config = config.replace(/(\n[ \t]*)(}\s*)$/, `${block}\n$1$2`);
  }

  await writeNginxConfig(configPath, config);
}

export async function reloadNginx(): Promise<void> {
  await execAsync('sudo nginx -t', { timeout: 15_000 });
  await execAsync('sudo systemctl reload nginx', { timeout: 30_000 });
}
