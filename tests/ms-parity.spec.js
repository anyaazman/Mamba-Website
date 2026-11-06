#!/usr/bin/env node
/*
 * Keeps the Malay site in step with the English pages it was translated from.
 *
 * Run:  node tests/ms-parity.spec.js
 *
 * ms/<page>.html is served as my.mambaapp.online/<page> by a zone rewrite (see
 * docs/plans/2026-11-06-malay-site.md). The two sites share every script and
 * stylesheet, so a Malay page that drifts structurally from its English page
 * breaks quietly: a renamed id stops dashboard.js finding a button, a missing
 * form field breaks a submit, a bumped ?v= leaves Malay visitors on stale JS.
 *
 * Each Malay page records a hash of the English page it was translated from
 * (<meta name="mamba-en-source">). Any later edit to the English page fails
 * this suite until the Malay page is brought up to date and the hash renewed.
 * No browser or server needed.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const MS = path.join(ROOT, 'ms');
const ENGLISH_ONLY = new Set(['admin.html']);
const LEGAL = ['privacy-policy.html', 'terms-of-service.html', 'risk-disclosure.html', 'account-deletion.html'];
const I18N_SCRIPTS = ['i18n-ms.js?v=1', 'i18n.js?v=1'];

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); failures++; }
};

// Must match source_hash() in the generator used to write ms/: the English
// page with asset ?v= versions removed and whitespace runs collapsed, so a
// version bump alone does not demand a re-translation.
function sourceHash(html) {
  const norm = html.replace(/\?v=\d+/g, '').replace(/[ \t\r\n]+/g, ' ').trim();
  return crypto.createHash('sha256').update(norm, 'utf8').digest('hex');
}

const withoutComments = html => html.replace(/<!--[\s\S]*?-->/g, '');
const all = (html, re, group = 1) => [...withoutComments(html).matchAll(re)].map(m => m[group]);
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
const stripSlash = v => v.replace(/^\//, '');
// Page links on the Malay site are extension-less (login, ./, ./#x); the
// English site links login.html, index.html#x. Same destination either way.
const pageLink = v => v.replace(/^\.\/(#|$)/, 'index$1').replace(/\.html(?=[?#]|$)/, '');

const TAGS = ['p', 'li', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'input', 'textarea', 'select', 'label',
              'img', 'video', 'source', 'form', 'section', 'ul', 'ol', 'dl', 'strong', 'em', 'b', 'small', 'details'];
function tagCounts(html) {
  const out = {};
  for (const t of TAGS) out[t] = (withoutComments(html).match(new RegExp(`<${t}(?=[\\s>/])`, 'gi')) || []).length;
  return out;
}

const scripts = html => all(html, /<script\b[^>]*\ssrc="([^"]+)"/g).map(stripSlash);
const stylesheets = html => all(html, /<link\b[^>]*rel="stylesheet"[^>]*>/g, 0).map(t => stripSlash(attr(t, 'href') || ''));
const ids = html => all(html, /\sid="([^"]+)"/g);
const fields = html => all(html, /<(?:input|textarea|select)\b[^>]*>/g, 0)
  .map(t => `${attr(t, 'name') || ''}:${attr(t, 'type') || ''}:${attr(t, 'id') || ''}`);
const dataAttrs = html => all(html, /\s(data-[a-z-]+)(?:="([^"]*)")?/g, 0).map(s => {
  const m = s.trim().match(/^(data-[a-z-]+)(?:="([^"]*)")?$/);
  const value = m[1] === 'data-app-fallback' ? pageLink(m[2] || '') : (m[2] ?? '');
  // The switch link names the other site, so its value necessarily differs.
  return m[1] === 'data-lang-switch' ? m[1] : `${m[1]}=${value}`;
});
const alternates = html => all(html, /<link rel="alternate" hreflang="[^"]+" href="[^"]+">/g, 0);
const switchLink = html => {
  const m = html.match(/<a href="(https:\/\/(?:www|my)\.mambaapp\.online\/[^"]*)" hreflang="(ms|en)" lang="\2" data-lang-switch[^>]*>([^<]+)<\/a>/);
  return m ? { href: m[1], lang: m[2], text: m[3] } : null;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const firstDiff = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return `#${i}: ${a[i]} vs ${b[i]}`;
  return '';
};

const enPages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !ENGLISH_ONLY.has(f)).sort();
const msPages = fs.readdirSync(MS).filter(f => f.endsWith('.html')).sort();

console.log('\n  [pages]');
check('every public English page has a Malay version', same(enPages, msPages),
      `missing: ${enPages.filter(p => !msPages.includes(p)).join(', ')}; extra: ${msPages.filter(p => !enPages.includes(p)).join(', ')}`);
check('admin stays English-only', !fs.existsSync(path.join(MS, 'admin.html')));
for (const f of ['robots.txt', 'sitemap.xml']) check(`ms/${f} exists`, fs.existsSync(path.join(MS, f)));

for (const page of enPages.filter(p => msPages.includes(p))) {
  const en = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const ms = fs.readFileSync(path.join(MS, page), 'utf8');
  console.log(`\n  [${page}]`);

  const recorded = (ms.match(/<meta name="mamba-en-source" content="([0-9a-f]{64})">/) || [])[1];
  check('translated from the current English page', recorded === sourceHash(en),
        recorded ? `${page} changed since ms/${page} was translated — update the Malay page and its mamba-en-source hash`
                 : 'no mamba-en-source meta');
  check('<html lang="ms">', /<html lang="ms">/.test(ms));

  check('same element ids', same(ids(en), ids(ms)), firstDiff(ids(en), ids(ms)));
  check('same form fields', same(fields(en), fields(ms)), firstDiff(fields(en), fields(ms)));
  check('same data-* attributes', same(dataAttrs(en), dataAttrs(ms)), firstDiff(dataAttrs(en), dataAttrs(ms)));
  check('same stylesheets and versions', same(stylesheets(en), stylesheets(ms)), firstDiff(stylesheets(en), stylesheets(ms)));
  const msScripts = scripts(ms);
  // Blocking scripts in <head> run before any deferred or body script, which
  // is what every t() lookup needs.
  const head = ms.slice(0, ms.indexOf('</head>'));
  const i18nTags = all(head, /<script\b[^>]*\ssrc="\/(i18n(?:-ms)?\.js\?v=\d+)"[^>]*>/g, 0);
  check('loads i18n-ms.js then i18n.js as blocking scripts in <head>',
        same(i18nTags.map(t => stripSlash(attr(t, 'src'))), I18N_SCRIPTS) && i18nTags.every(t => !/\s(defer|async)\b/.test(t)),
        i18nTags.join(' '));
  check('same scripts and versions otherwise', same(scripts(en), msScripts.filter(s => !I18N_SCRIPTS.includes(s))),
        firstDiff(scripts(en), msScripts.filter(s => !I18N_SCRIPTS.includes(s))));
  const ce = tagCounts(en), cm = tagCounts(ms);
  check('same markup skeleton (tag counts)', same(ce, cm),
        TAGS.filter(t => ce[t] !== cm[t]).map(t => `${t} ${ce[t]}→${cm[t]}`).join(', '));

  // Link conventions that let one file work at /ms/<page> on previews and at
  // my.mambaapp.online/<page> in production.
  const refs = all(ms, /\s(?:src|href|poster|data-app-fallback)="([^"]+)"/g)
    .filter(v => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(v));
  const htmlLinks = refs.filter(v => /\.html(?:[?#]|$)/.test(v));
  check('no *.html page links (they cost a redirect via /ms/ on my.mambaapp.online)', htmlLinks.length === 0, htmlLinks.join(', '));
  const relAssets = refs.filter(v => !v.startsWith('/') && /\.[a-z0-9]{2,5}(?:[?#]|$)/i.test(v));
  check('assets are root-absolute (shared with the English site)', relAssets.length === 0, relAssets.join(', '));

  const enCanon = (en.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
  if (enCanon) {
    const expected = enCanon.replace('https://www.mambaapp.online/', 'https://my.mambaapp.online/').replace(/\.html$/, '');
    check('canonical names the Malay page', ms.includes(`<link rel="canonical" href="${expected}">`), expected);
  }
  if (alternates(en).length) {
    check('hreflang alternates identical on both sites', same(alternates(en), alternates(ms)));
    check('hreflang covers en, ms and x-default', alternates(en).length === 3);
  }

  const se = switchLink(en), sm = switchLink(ms);
  check('English page links to Bahasa Melayu', se && se.lang === 'ms' && se.text === 'Bahasa Melayu' && se.href.startsWith('https://my.mambaapp.online/'));
  check('Malay page links back to English', sm && sm.lang === 'en' && sm.text === 'English' && sm.href.startsWith('https://www.mambaapp.online/'));
  if (se && sm) {
    check('switch links point at the same page', se.href.replace('//my.', '//') === sm.href.replace('//www.', '//'), `${se.href} / ${sm.href}`);
  }

  if (LEGAL.includes(page)) {
    check('states that the English version prevails', ms.includes('Versi Bahasa Inggeris terpakai jika terdapat sebarang percanggahan'));
  }
  // Valetax runs two entities with different regulators; neither site may
  // attribute a licence to it (see the broker-entity note in the repo history).
  check('no broker licence claim', !/\bFSC\b|dikawal selia oleh|dilesenkan oleh/i.test(ms));
}

console.log(failures ? `\n${failures} failure(s)` : '\nMALAY PARITY CHECKS PASSED');
process.exit(failures ? 1 : 0);
