#!/usr/bin/env node
/**
 * ClearPanel Domain & Redirect CLI Helper
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const BASE_DIR = '/opt/clearpanel';
const ENV_PATH = path.join(BASE_DIR, 'backend', '.env');

function loadEnv() {
  const env = {};
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[match[1]] = val;
      }
    }
  }
  return env;
}

const env = loadEnv();
const PORT = parseInt(env.PORT || '3334', 10);
const SESSION_SECRET = env.SESSION_SECRET || '';
const DATA_DIR = env.DATA_DIR || '/home/hasim751/etc/clearpanel';

function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'x-cli-token': SESSION_SECRET,
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.message || parsed.error || `HTTP ${res.statusCode}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Fallback direct execution if API is offline
function getDirectRedirects() {
  const p = path.join(DATA_DIR, 'redirects.json');
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveDirectRedirects(items) {
  const p = path.join(DATA_DIR, 'redirects.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(items, null, 2), 'utf-8');
}

function getDirectDomains() {
  const p = path.join(DATA_DIR, 'domains.json');
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

async function addRedirect(domain, from, to, type = '301', wildcard = false) {
  try {
    const res = await apiRequest('POST', '/api/redirects', {
      domain,
      from,
      to,
      type,
      wildcard,
    });
    return res;
  } catch (err) {
    // Fallback: direct service call via dist
    try {
      const { RedirectsService } = require(path.join(BASE_DIR, 'backend', 'dist', 'redirects', 'redirects.service.js'));
      const svc = new RedirectsService();
      return await svc.create({ domain, from, to, type, wildcard });
    } catch (fallbackErr) {
      throw new Error(`Failed to create redirect: ${err.message || fallbackErr.message}`);
    }
  }
}

async function listRedirects(domain) {
  try {
    const endpoint = domain ? `/api/redirects?domain=${encodeURIComponent(domain)}` : '/api/redirects';
    const res = await apiRequest('GET', endpoint);
    return res.redirects || [];
  } catch (err) {
    const all = getDirectRedirects();
    return domain ? all.filter((r) => r.domain.toLowerCase() === domain.toLowerCase()) : all;
  }
}

async function removeRedirect(id) {
  try {
    const res = await apiRequest('DELETE', `/api/redirects/${encodeURIComponent(id)}`);
    if (res && res.success === false) {
      throw new Error(res.message || 'Failed to remove redirect');
    }
    return res;
  } catch (err) {
    try {
      const { RedirectsService } = require(path.join(BASE_DIR, 'backend', 'dist', 'redirects', 'redirects.service.js'));
      const svc = new RedirectsService();
      return await svc.remove(id);
    } catch (fallbackErr) {
      throw new Error(`Failed to remove redirect: ${err.message || fallbackErr.message}`);
    }
  }
}

async function listDomains() {
  try {
    const res = await apiRequest('GET', '/api/domains');
    return Array.isArray(res) ? res : res.domains || [];
  } catch (err) {
    return getDirectDomains();
  }
}

async function addDomain(name, folderPath) {
  try {
    const body = { name };
    if (folderPath) body.folderPath = folderPath;
    const res = await apiRequest('POST', '/api/domains', body);
    return res;
  } catch (err) {
    throw new Error(`Failed to add domain: ${err.message}`);
  }
}

// ─── Command Line Parser ──────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  // Parse flags
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--wildcard' || arg === '-w') {
      flags.wildcard = true;
    } else if (arg === '--type' || arg === '-t') {
      flags.type = args[++i];
    } else if (arg === '--from' || arg === '-f') {
      flags.from = args[++i];
    } else if (arg === '--to') {
      flags.to = args[++i];
    } else if (arg.startsWith('--type=')) {
      flags.type = arg.split('=')[1];
    } else if (arg.startsWith('--from=')) {
      flags.from = arg.split('=')[1];
    } else if (arg.startsWith('--to=')) {
      flags.to = arg.split('=')[1];
    } else {
      positional.push(arg);
    }
  }

  // Handle: clearpanel domain add redirect ...
  if (
    (positional[0] === 'add' && positional[1] === 'redirect') ||
    (positional[0] === 'redirect' && positional[1] === 'add')
  ) {
    const domain = positional[2];
    if (!domain) {
      console.error('\x1b[31mError: Domain name is required.\x1b[0m');
      console.log('Usage: clearpanel domain add redirect <domain> <destination> [--type 301|302] [--from /path] [--wildcard]');
      process.exit(1);
    }

    let from = flags.from || '/';
    let to = flags.to || '';
    let type = flags.type || '301';
    let wildcard = !!flags.wildcard;

    const remaining = positional.slice(3);
    if (remaining.length === 1) {
      to = remaining[0];
    } else if (remaining.length >= 2) {
      if (remaining[0].startsWith('/') && !remaining[1].startsWith('/')) {
        from = remaining[0];
        to = remaining[1];
        if (remaining[2] === '301' || remaining[2] === '302') type = remaining[2];
      } else {
        to = remaining[0];
        if (remaining[1] === '301' || remaining[1] === '302') type = remaining[1];
      }
    }

    if (!to) {
      console.error('\x1b[31mError: Destination URL is required.\x1b[0m');
      console.log('Usage: clearpanel domain add redirect <domain> <destination> [--type 301|302] [--from /path] [--wildcard]');
      process.exit(1);
    }

    console.log(`\x1b[34mSetting up redirect for ${domain}...\x1b[0m`);
    console.log(`  Domain:      \x1b[1m${domain}\x1b[0m`);
    console.log(`  From path:   \x1b[1m${from}\x1b[0m`);
    console.log(`  Redirect to: \x1b[1m${to}\x1b[0m`);
    console.log(`  Type:        \x1b[1m${type}\x1b[0m`);
    console.log(`  Wildcard:    \x1b[1m${wildcard ? 'yes' : 'no'}\x1b[0m`);

    try {
      const result = await addRedirect(domain, from, to, type, wildcard);
      console.log('\x1b[32m✓ Redirect created and Nginx reloaded successfully!\x1b[0m');
      console.log(`  ID: ${result.redirect?.id || 'ok'}`);
    } catch (e) {
      console.error(`\x1b[31m✗ Failed to configure redirect: ${e.message}\x1b[0m`);
      process.exit(1);
    }
    return;
  }

  // Handle: clearpanel domain redirect list [domain]
  if (positional[0] === 'redirect' && (positional[1] === 'list' || !positional[1])) {
    const domainFilter = positional[2];
    const redirects = await listRedirects(domainFilter);
    if (redirects.length === 0) {
      console.log(domainFilter ? `No redirects configured for domain "${domainFilter}".` : 'No redirects configured.');
      return;
    }
    console.log('\x1b[1mConfigured Redirects:\x1b[0m');
    console.table(
      redirects.map((r) => ({
        ID: r.id.slice(0, 8) + '…',
        Domain: r.domain,
        From: r.from,
        To: r.to,
        Type: r.type,
        Wildcard: r.wildcard ? 'Yes' : 'No',
        Created: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-',
      }))
    );
    return;
  }

  // Handle: clearpanel domain redirect remove <id>
  if (positional[0] === 'redirect' && (positional[1] === 'remove' || positional[1] === 'delete')) {
    const target = positional[2];
    if (!target) {
      console.error('\x1b[31mError: Redirect ID is required.\x1b[0m');
      console.log('Usage: clearpanel domain redirect remove <id>');
      process.exit(1);
    }
    const all = await listRedirects();
    const found = all.find((r) => r.id === target || r.id.startsWith(target));
    const removeId = found ? found.id : target;
    try {
      await removeRedirect(removeId);
      console.log(`\x1b[32m✓ Redirect ${removeId} removed and Nginx reloaded.\x1b[0m`);
    } catch (e) {
      console.error(`\x1b[31m✗ Failed to remove redirect: ${e.message}\x1b[0m`);
      process.exit(1);
    }
    return;
  }

  // Handle: clearpanel domain list
  if (positional[0] === 'list') {
    const domains = await listDomains();
    if (domains.length === 0) {
      console.log('No domains found.');
      return;
    }
    console.log('\x1b[1mDomains on this server:\x1b[0m');
    console.table(
      domains.map((d) => ({
        Domain: d.name,
        'Document Root': d.folderPath,
        Upstream: d.linkedContainerPort || d.linkedAppPort ? `Port ${d.linkedContainerPort || d.linkedAppPort}` : 'Static/PHP',
        Created: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-',
      }))
    );
    return;
  }

  // Handle: clearpanel domain add <name> [folderPath]
  if (positional[0] === 'add') {
    const domainName = positional[1];
    if (!domainName) {
      console.error('\x1b[31mError: Domain name is required.\x1b[0m');
      console.log('Usage: clearpanel domain add <domain> [folderPath]');
      process.exit(1);
    }
    const folderPath = positional[2];
    console.log(`\x1b[34mAdding domain ${domainName}...\x1b[0m`);
    try {
      const res = await addDomain(domainName, folderPath);
      console.log(`\x1b[32m✓ Domain ${domainName} added successfully!\x1b[0m`);
      if (res.domain?.folderPath) {
        console.log(`  Document Root: ${res.domain.folderPath}`);
      }
    } catch (e) {
      console.error(`\x1b[31m✗ Failed to add domain: ${e.message}\x1b[0m`);
      process.exit(1);
    }
    return;
  }

  // Help
  console.log('\x1b[1mClearPanel Domain & Redirect CLI\x1b[0m');
  console.log('');
  console.log('Usage:');
  console.log('  clearpanel domain add redirect <domain> <destination> [options]');
  console.log('  clearpanel domain redirect list [domain]');
  console.log('  clearpanel domain redirect remove <id>');
  console.log('  clearpanel domain list');
  console.log('  clearpanel domain add <domain> [folderPath]');
  console.log('');
  console.log('Options for redirect:');
  console.log('  --from <path>       Source path (default: /)');
  console.log('  --type 301|302      HTTP redirect status code (default: 301)');
  console.log('  --wildcard, -w      Forward request URI / match all subpaths');
  console.log('');
  console.log('Examples:');
  console.log('  clearpanel domain add redirect example.com https://newsite.com');
  console.log('  clearpanel domain add redirect example.com /old-page https://example.com/new-page');
  console.log('  clearpanel domain add redirect example.com https://target.com --type 302 --wildcard');
  console.log('  clearpanel domain redirect list');
  console.log('  clearpanel domain redirect remove 12345678');
}

main().catch((e) => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', e);
  process.exit(1);
});
