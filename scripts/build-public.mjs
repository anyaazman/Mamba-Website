#!/usr/bin/env node
// Builds dist/ — the only folder Cloudflare Pages publishes.
//
// Pages used to publish the repository root, so tests/, migrations/, tools/,
// docs/ and wrangler.toml were all downloadable from the live site. The
// .assetsignore file that was meant to prevent that did nothing: the Pages
// uploader does not read it. This copies an allowlist instead, so a new file
// stays private until it is deliberately made public here.
//
// Functions are unaffected: Pages reads them from functions/ at the project
// root, never from the output directory.
//
// Cloudflare runs this on every deploy (Pages > Settings > Build > Build
// command). Locally:  node scripts/build-public.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

// Root-level files with these extensions are site pages, scripts and media.
const PUBLIC_EXT = new Set([
  '.html', '.css', '.js',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  '.mp4', '.webm', '.woff', '.woff2'
]);
// Published by exact name. Not by extension: a stray notes.txt must stay private.
const PUBLIC_FILES = ['_headers', 'robots.txt', 'sitemap.xml'];
// Folders that hold nothing but site media.
const PUBLIC_DIRS = ['feedback', 'how-it-works', 'web-files'];

function copyFile(rel) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dest);
}

function copyDir(rel) {
  for (const entry of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const child = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) copyDir(child);
    else if (PUBLIC_EXT.has(path.extname(entry.name).toLowerCase())) copyFile(child);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && PUBLIC_EXT.has(path.extname(entry.name).toLowerCase())) copyFile(entry.name);
}
for (const name of PUBLIC_FILES) copyFile(name);
for (const dir of PUBLIC_DIRS) copyDir(dir);

// Every local file a page or stylesheet points at must have been published. A
// miss fails the build, and a failed Pages build leaves the live site on its
// previous deployment — better than shipping a page with a hole in it.
const SKIP = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/api\/|\/cdn-cgi\/)/i;
const missing = [];

function exists(ref) {
  const clean = decodeURIComponent(ref.split(/[?#]/)[0]).replace(/^\//, '');
  if (clean === '') return true;
  const target = path.join(OUT, clean);
  // Pages serves /dashboard for dashboard.html and /dir/ for dir/index.html.
  return [target, target + '.html', path.join(target, 'index.html')].some(p => fs.existsSync(p));
}

function check(file, refs) {
  for (const ref of refs) {
    if (!SKIP.test(ref) && !exists(ref)) missing.push(`${file} -> ${ref}`);
  }
}

for (const name of fs.readdirSync(OUT)) {
  if (!/\.(html|css)$/.test(name)) continue;
  const text = fs.readFileSync(path.join(OUT, name), 'utf8');
  if (name.endsWith('.html')) {
    const refs = [...text.matchAll(/\s(?:src|href|poster)\s*=\s*"([^"]+)"/gi)].map(m => m[1]);
    for (const m of text.matchAll(/\ssrcset\s*=\s*"([^"]+)"/gi)) {
      refs.push(...m[1].split(',').map(s => s.trim().split(/\s+/)[0]));
    }
    check(name, refs);
  } else if (name.endsWith('.css')) {
    check(name, [...text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map(m => m[1]));
  }
}

if (missing.length) {
  console.error('build-public: these references point at files that are not published:');
  for (const m of missing) console.error('  ' + m);
  console.error('Add the file (or its folder) to the allowlist in scripts/build-public.mjs.');
  process.exit(1);
}

let count = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name)); else count++;
  }
})(OUT);
console.log(`build-public: wrote ${count} files to dist/`);
