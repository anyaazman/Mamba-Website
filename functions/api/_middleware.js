const ALLOWED_ORIGINS = [
  'https://www.mambaapp.online',
  'https://mambaapp.online'
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Cloudflare Pages preview deployments
  if (/^https:\/\/([a-z0-9-]+\.)?mamba-website\.pages\.dev$/.test(origin)) return true;
  // Local development
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
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
  const newResponse = new Response(response.body, response);

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
