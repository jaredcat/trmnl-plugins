#!/usr/bin/env node
/**
 * Builds all plugins: copies to dist/, compiles transform.ts → transform.js, zips each plugin.
 * Plugin = directory that contains settings.yml (excluding .cursor, .git, node_modules, dist, scripts).
 */

import { ZipArchive } from 'archiver';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

const IGNORE_DIRS = new Set([
  '.cursor',
  '.git',
  'node_modules',
  'dist',
  'scripts',
]);

function getPluginDirs() {
  const names = fs.readdirSync(repoRoot, { withFileTypes: true });
  return names
    .filter(
      (d) =>
        d.isDirectory() && !d.name.startsWith('.') && !IGNORE_DIRS.has(d.name),
    )
    .filter((d) => fs.existsSync(path.join(repoRoot, d.name, 'settings.yml')))
    .map((d) => d.name);
}

function copyDirRecursive(
  src: string,
  dest: string,
  options: { exclude?: (fileName: string, filePath: string) => boolean } = {},
) {
  const { exclude = () => false } = options;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    if (exclude(name, srcPath)) continue;
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath, options);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function compileTransform(pluginName: string) {
  const pluginDir = path.join(repoRoot, pluginName);
  const transformTs = path.join(pluginDir, 'transform.ts');
  if (!fs.existsSync(transformTs)) return;

  const outDir = path.join(distRoot, pluginName);
  const tscPath = path.join(
    repoRoot,
    'node_modules',
    'typescript',
    'bin',
    'tsc',
  );
  const result = spawnSync(
    process.execPath,
    [
      tscPath,
      '--outDir',
      outDir,
      '--rootDir',
      path.join(repoRoot, pluginName),
      '--module',
      'ESNext',
      '--target',
      'ES2020',
      '--skipLibCheck',
      // The file is passed on the command line, so TypeScript 6 will not load
      // tsconfig.json. Skip that error and keep the flags above.
      '--ignoreConfig',
      transformTs,
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error(`tsc failed for ${pluginName}`);
}

function zipDir(dirPath: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    out.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(out);
    archive.directory(dirPath, false);
    archive.finalize();
  });
}

async function main() {
  if (fs.existsSync(distRoot)) fs.rmSync(distRoot, { recursive: true });
  fs.mkdirSync(distRoot, { recursive: true });

  const plugins = getPluginDirs();
  if (plugins.length === 0) {
    console.log('No plugin directories (with settings.yml) found.');
    return;
  }

  console.log('Building plugins:', plugins.join(', '));

  for (const name of plugins) {
    const srcDir = path.join(repoRoot, name);
    const destDir = path.join(distRoot, name);
    copyDirRecursive(srcDir, destDir, {
      exclude: (fileName) => fileName === 'transform.ts',
    });
    compileTransform(name);
    console.log('  Built:', name);
  }

  console.log('Creating zips...');
  for (const name of plugins) {
    const dirPath = path.join(distRoot, name);
    const zipPath = path.join(distRoot, `${name}.zip`);
    await zipDir(dirPath, zipPath);
    console.log('  Zipped:', name + '.zip');
  }

  console.log('Done. Output in dist/');
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
