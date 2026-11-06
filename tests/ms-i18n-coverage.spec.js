#!/usr/bin/env node
/*
 * Malay text coverage for everything that is not static HTML.
 *
 * Run:  node tests/ms-i18n-coverage.spec.js
 *
 * 1. Every t('…') key in the shared scripts has an entry in i18n-ms.js, with
 *    the same {placeholders}, and i18n-ms.js holds no stale keys.
 * 2. i18n.js returns Malay on lang="ms" pages and the English text elsewhere.
 * 3. Every message a member-facing endpoint passes to json() has a Malay
 *    entry in functions/api/_i18n-ms.js.
 * 4. The API middleware translates for the Malay site only, never for admin
 *    routes, and passes everything else through unchanged.
 *
 * No browser or server needed: the Functions modules are imported directly.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); failures++; }
};

const SHARED = ['dashboard.js', 'login.js', 'reset-password.js', 'support.js', 'account-deletion.js', 'hero-trade.js', 'config.js'];
const KEY_RE = /\b(?:t|MAMBA_T)\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g;
const unescape = s => s.replace(/\\(.)/g, '$1');
const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

function loadDict(file, globalName) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox);
  return sandbox.window[globalName];
}

(async () => {
  // ---- 1. script keys -----------------------------------------------------
  console.log('\n  [shared script text]');
  const keys = new Map();
  for (const f of SHARED) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    // A key passed as a variable cannot be checked, so it is not allowed.
    // The fallback helper itself is `function t(s, v)` / `const t = (s, v)`.
    const dynamic = [...src.matchAll(/\b(?:t|MAMBA_T)\(\s*(?!['"])([^)\s][^)]{0,40})/g)]
      .map(m => m[1]).filter(a => !/^(s, v|s,v|text, vars)\)?$/.test(a.trim()) && !/^s\b/.test(a.trim()));
    check(`${f}: every t() key is a string literal`, dynamic.length === 0, dynamic.join(' | '));
    for (const m of src.matchAll(KEY_RE)) {
      const key = unescape(m[1] ?? m[2]);
      if (!keys.has(key)) keys.set(key, f);
    }
  }
  check('found the expected volume of script text', keys.size >= 90, `${keys.size} keys`);

  const ms = loadDict('i18n-ms.js', 'MAMBA_MS');
  check('i18n-ms.js defines window.MAMBA_MS', ms && typeof ms === 'object');
  const missing = [...keys.keys()].filter(k => !Object.prototype.hasOwnProperty.call(ms, k));
  check('every t() key has a Malay entry', missing.length === 0, missing.map(k => `${keys.get(k)}: ${k}`).join(' | '));
  const stale = Object.keys(ms).filter(k => !keys.has(k));
  check('no stale entries in i18n-ms.js', stale.length === 0, stale.join(' | '));
  const badVars = [...keys.keys()].filter(k => ms[k] !== undefined && placeholders(k) !== placeholders(ms[k]));
  check('placeholders survive translation', badVars.length === 0, badVars.join(' | '));
  const empty = Object.entries(ms).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k);
  check('no empty translations', empty.length === 0, empty.join(' | '));

  // ---- 2. i18n.js lookup --------------------------------------------------
  console.log('\n  [i18n.js]');
  const runI18n = (lang, dict) => {
    const sandbox = { window: dict ? { MAMBA_MS: dict } : {}, document: { documentElement: { getAttribute: () => lang } } };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8'), sandbox);
    return sandbox.window;
  };
  const wMs = runI18n('ms', ms);
  check('Malay page: MAMBA_LANG is ms', wMs.MAMBA_LANG === 'ms');
  check('Malay page: known text is translated', wMs.MAMBA_T('Network error. Please try again.') === ms['Network error. Please try again.']);
  check('Malay page: placeholders are filled', wMs.MAMBA_T('Welcome, {name}', { name: 'Aina' }) === 'Selamat datang, Aina');
  check('Malay page: unknown text falls back to English', wMs.MAMBA_T('Not in the dictionary') === 'Not in the dictionary');
  const wEn = runI18n('en', ms);
  check('English page: text is returned unchanged', wEn.MAMBA_LANG === 'en' && wEn.MAMBA_T('Network error. Please try again.') === 'Network error. Please try again.');
  check('English page: placeholders are filled', wEn.MAMBA_T('Welcome, {name}', { name: 'Aina' }) === 'Welcome, Aina');
  const wNoDict = runI18n('ms', null);
  check('Malay page without the dictionary still shows English', wNoDict.MAMBA_T('Add') === 'Add');

  // ---- 3. API messages ----------------------------------------------------
  console.log('\n  [API messages]');
  const { MS_API_MESSAGES, translateBody } = await import(pathToFileURL(path.join(ROOT, 'functions/api/_i18n-ms.js')).href);
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const endpoints = walk(path.join(ROOT, 'functions/api'))
    // admin/ is English by decision; backend/ answers the trading backend, not a member.
    .filter(f => f.endsWith('.js') && !/[\\/](admin|backend)[\\/]/.test(f) && !path.basename(f).startsWith('_'));
  const sentences = new Map();
  for (const f of endpoints) {
    const src = fs.readFileSync(f, 'utf8');
    for (let i = src.indexOf('json('); i !== -1; i = src.indexOf('json(', i + 1)) {
      let depth = 0, j = i + 4;
      for (; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')' && --depth === 0) break; }
      for (const m of src.slice(i, j).matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`|"((?:[^"\\]|\\.)*)"/g)) {
        const s = unescape(m[1] ?? m[2] ?? m[3]);
        if (/^[A-Za-z_][\s\S]*[.!?]$/.test(s) && / /.test(s) && !s.includes('${')) sentences.set(s, path.relative(ROOT, f));
      }
    }
  }
  check('found the expected volume of API messages', sentences.size >= 50, `${sentences.size} messages`);
  const apiMissing = [...sentences.keys()].filter(s => !Object.prototype.hasOwnProperty.call(MS_API_MESSAGES, s));
  check('every member-facing API message has a Malay entry', apiMissing.length === 0, apiMissing.map(s => `${sentences.get(s)}: ${s}`).join(' | '));
  const apiStale = Object.keys(MS_API_MESSAGES).filter(s => !sentences.has(s));
  check('no stale entries in _i18n-ms.js', apiStale.length === 0, apiStale.join(' | '));
  check('translateBody: error translated', translateBody({ error: 'Invalid email or password.' })?.error === MS_API_MESSAGES['Invalid email or password.']);
  check('translateBody: other fields untouched', JSON.stringify(translateBody({ success: true, message: 'Profile updated.', token: 'abc' }))
        === JSON.stringify({ success: true, message: MS_API_MESSAGES['Profile updated.'], token: 'abc' }));
  check('translateBody: nothing to translate returns null', translateBody({ token: 'x' }) === null && translateBody([1]) === null && translateBody(null) === null);

  // ---- 4. middleware ------------------------------------------------------
  console.log('\n  [API middleware]');
  const { onRequest } = await import(pathToFileURL(path.join(ROOT, 'functions/api/_middleware.js')).href);
  const { isMalaySite, siteMeta, siteFields } = await import(pathToFileURL(path.join(ROOT, 'functions/api/_helpers.js')).href);
  const call = async (url, { referer, origin, method = 'POST', body = { error: 'Invalid email or password.' }, type = 'application/json; charset=utf-8' } = {}) => {
    const headers = {};
    if (referer) headers.Referer = referer;
    if (origin) headers.Origin = origin;
    const request = new Request(url, { method, headers });
    const res = await onRequest({ request, next: async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 401, headers: { 'Content-Type': type } }) });
    const text = await res.text();
    return { res, text, json: (() => { try { return JSON.parse(text); } catch (e) { return null; } })() };
  };
  const ERR_MS = MS_API_MESSAGES['Invalid email or password.'];
  let r = await call('https://my.mambaapp.online/api/auth/login');
  check('my.mambaapp.online: message translated', r.json?.error === ERR_MS, r.text);
  check('my.mambaapp.online: status kept', r.res.status === 401);
  check('my.mambaapp.online: security headers kept', r.res.headers.get('X-Content-Type-Options') === 'nosniff' && r.res.headers.get('Cache-Control') === 'no-store');
  r = await call('https://www.mambaapp.online/api/auth/login');
  check('www.mambaapp.online: message stays English', r.json?.error === 'Invalid email or password.', r.text);
  r = await call('http://localhost:8789/api/auth/login', { referer: 'http://localhost:8789/ms/login' });
  check('preview/localhost /ms/ page: message translated', r.json?.error === ERR_MS, r.text);
  r = await call('http://localhost:8789/api/auth/login', { referer: 'https://evil.example/ms/login' });
  check('cross-site /ms/ referer is ignored', r.json?.error === 'Invalid email or password.', r.text);
  r = await call('https://my.mambaapp.online/api/admin/users', { body: { error: 'Unauthorized.' } });
  check('admin routes are never translated', r.json?.error === 'Unauthorized.');
  r = await call('https://my.mambaapp.online/api/auth/login', { body: 'not json', type: 'text/plain' });
  check('non-JSON responses pass through', r.text === 'not json');
  r = await call('https://my.mambaapp.online/api/auth/login', { body: { token: 'abc', user: { name: 'Invalid email or password.' } } });
  check('only error/message/warning are touched', r.json?.user?.name === 'Invalid email or password.' && r.json?.token === 'abc');
  r = await call('https://my.mambaapp.online/api/auth/login', { method: 'OPTIONS', origin: 'https://my.mambaapp.online' });
  check('CORS preflight allows my.mambaapp.online', r.res.status === 204 && r.res.headers.get('Access-Control-Allow-Origin') === 'https://my.mambaapp.online');
  r = await call('https://www.mambaapp.online/api/auth/login', { method: 'OPTIONS', origin: 'https://abc123.mamba-website-8iv.pages.dev' });
  check('CORS preflight allows the real preview host', r.res.headers.get('Access-Control-Allow-Origin') === 'https://abc123.mamba-website-8iv.pages.dev');
  r = await call('https://www.mambaapp.online/api/auth/login', { method: 'OPTIONS', origin: 'https://my.mambaapp.online.evil.example' });
  check('CORS preflight rejects look-alike hosts', !r.res.headers.get('Access-Control-Allow-Origin'));

  const req = (url, referer) => new Request(url, { headers: referer ? { Referer: referer } : {} });
  check('siteMeta tags Malay-site events', JSON.stringify(siteMeta(req('https://my.mambaapp.online/api/x'))) === '{"site":"ms"}');
  check('siteMeta leaves English events unchanged', JSON.stringify(siteMeta(req('https://www.mambaapp.online/api/x'))) === '{}');
  check('siteFields labels Telegram alerts from the Malay site', siteFields(req('https://my.mambaapp.online/api/x')).Site === 'my.mambaapp.online (BM)');
  check('/msx is not the Malay site', !isMalaySite(req('http://localhost:8789/api/x', 'http://localhost:8789/msx/login')));

  console.log(failures ? `\n${failures} failure(s)` : '\nMALAY TEXT COVERAGE PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
