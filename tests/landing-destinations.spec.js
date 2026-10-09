#!/usr/bin/env node
// Catch links into sections removed by the landing/guide rebuild.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(name => name.endsWith('.html'));
let checked = 0;
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/(?:href|data-app-fallback)="((?:index|how-Mamba-work)\.html)#([^"]+)"/g)) {
    const target = fs.readFileSync(path.join(root, match[1]), 'utf8');
    assert.ok(target.includes('id="' + match[2] + '"'), file + ' links to missing section ' + match[1] + '#' + match[2]);
    checked++;
  }
}
const config = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const fallback = config.match(/DOWNLOAD_ANCHOR:\s*'([^']+)'/)[1];
const [page, id] = fallback.split('#');
assert.ok(fs.readFileSync(path.join(root, page), 'utf8').includes('id="' + id + '"'), 'Desktop app fallback exists');
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<script[^>]+src="tracking\.js\?v=2"/);
console.log(checked + ' section links, desktop app fallback and homepage tracking passed');
