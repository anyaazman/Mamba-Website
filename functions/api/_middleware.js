import { isMalaySite } from './_helpers.js';
import { translateBody } from './_i18n-ms.js';

const ALLOWED_ORIGINS = [
  'https://www.mambaapp.online',
  'https://mambaapp.online',
  'https://my.mambaapp.online'
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Cloudflare Pages preview deployments. The project's pages.dev host is
  // mamba-website-8iv, not mamba-website (checked in the Pages API 2026-11-06).
  if (/^https:\/\/([a-z0-9-]+\.)?mamba-website-8iv\.pages\.dev$/.test(origin)) return true;
  // Local development
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

// Requests from the Malay site get their member-facing messages in Malay.
// Admin routes are skipped: the admin workspace is English-only, and its large
// list responses are not worth parsing. Anything that is not a JSON object, or
// carries no known message, is passed through byte for byte.
async function localise(request, response) {
  const path = new URL(request.url).pathname;
  const type = response.headers.get('Content-Type') || '';
  if (!response.body || path.startsWith('/api/admin/') || !type.includes('application/json') || !isMalaySite(request)) {
    return new Response(response.body, response);
  }
  const text = await response.text();
  let translated = null;
  try { translated = translateBody(JSON.parse(text)); } catch (e) { /* not JSON: pass through */ }
  const out = new Response(translated ? JSON.stringify(translated) : text, response);
  out.headers.delete('Content-Length');
  return out;
}

export async function onRequest(context) {
  const origin = context.request.headers.get('Origin');
  const corsHeaders = {};

  // Same-origin requests send no Origin (or a matching one) and need no CORS.
  // Only reflect origins we trust — never "*" — so third-party sites cannot
  // script against the API from a browser.
  if (isAllowedOrigin(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    corsHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Admin-Key';
    corsHeaders['Vary'] = 'Origin';
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const response = await context.next();
  const newResponse = await localise(context.request, response);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  if (!newResponse.headers.get('Content-Type')) {
    newResponse.headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('Cache-Control', 'no-store');

  return newResponse;
}
