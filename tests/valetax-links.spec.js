#!/usr/bin/env node
/*
 * Guards config.js as the single source of truth for Valetax links.
 *
 * Run:  node tests/valetax-links.spec.js
 *
 * The site previously pointed at two different Valetax domains depending on
 * the page — config.js said valetaxglobal.com while dashboard.html hardcoded
 * valetaxintl.com three times. Those are two different legal entities, so the
 * drift was a compliance problem, not just untidiness. This test fails if any
 * Valetax URL reappears outside config.js without being config-owned.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); failures++; }
};

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

// 1. config.js is the only place a Valetax domain may be declared.
const config = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
const domainMatch = config.match(/var VALETAX_DOMAIN = '([^']+)'/);
check('config.js declares VALETAX_DOMAIN', !!domainMatch);
const DOMAIN = domainMatch ? domainMatch[1] : '';
check('domain is ma.valetaxglobal.com', DOMAIN === 'https://ma.valetaxglobal.com', DOMAIN);

// 2. No page may reference the other legal entity's domain.
for (const f of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  check(`${f} has no valetaxintl reference`, !html.includes('valetaxintl'));
}

// 3. Every Valetax anchor must be config-owned via data-valetax-link.
const anchorRe = /<a\b[^>]*href="https:\/\/ma\.valetax[^"]*"[^>]*>/g;
for (const f of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const anchors = html.match(anchorRe) || [];
  const orphans = anchors.filter(a => !a.includes('data-valetax-link'));
  check(`${f}: all ${anchors.length} Valetax link(s) config-owned`,
        orphans.length === 0, orphans.map(o => o.slice(0, 70)).join(' | '));
}

// 4. Static hrefs must already match the configured domain, so the links are
//    correct even before config.js runs (or if JS fails).
for (const f of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const urls = html.match(/https:\/\/ma\.valetax[a-z]*\.com/g) || [];
  const wrong = [...new Set(urls)].filter(u => u !== DOMAIN);
  check(`${f}: static hrefs match configured domain`, wrong.length === 0, wrong.join(', '));
}

console.log(failures ? `\n${failures} failure(s)` : '\nVALETAX LINK CHECKS PASSED');
process.exit(failures ? 1 : 0);
