export async function onRequest(context) {
  const response = await context.next();
  const newResponse = new Response(response.body, response);

  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  newResponse.headers.set('Content-Type', 'application/json');

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: newResponse.headers });
  }

  return newResponse;
}
