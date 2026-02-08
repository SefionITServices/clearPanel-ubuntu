#!/usr/bin/env node
import { mkdir, readdir, rm, stat, copyFile, readlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const includeLocal = args.length === 0 || args.includes('--all') || args.includes('--local');
const includeDist = args.length === 0 || args.includes('--all') || args.includes('--dist');

const sourceDir = path.resolve(__dirname, '..', '..', 'scripts', 'email');
const targets = [];

if (includeLocal) {
  targets.push(path.resolve(__dirname, '..', 'scripts', 'email'));
}
if (includeDist) {
  targets.push(path.resolve(__dirname, '..', 'dist', 'scripts', 'email'));
}

async function pathExists(location) {
  try {
    await stat(location);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = await readlink(srcPath);
      await mkdir(path.dirname(destPath), { recursive: true });
      await rm(destPath, { force: true });
      await copyFile(path.resolve(path.dirname(srcPath), linkTarget), destPath);
    } else {
      await mkdir(path.dirname(destPath), { recursive: true });
      await copyFile(srcPath, destPath);
    }
  }
}

async function sync(target) {
  await rm(target, { recursive: true, force: true });
  await copyDir(sourceDir, target);
}

async function main() {
  const sourceAvailable = await pathExists(sourceDir);
  if (!sourceAvailable) {
    console.error(`Email scripts not found at ${sourceDir}.`);
    process.exitCode = 1;
    return;
  }

  if (!targets.length) {
    console.warn('No copy targets selected (use --local, --dist, or --all).');
    return;
  }

  for (const destination of targets) {
    await sync(destination);
    console.log(`Copied email scripts to ${destination}`);
  }
}

main().catch((error) => {
  console.error('Failed to copy email scripts:', error);
  process.exitCode = 1;
});
