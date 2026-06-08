/**
 * RAVEN — Cloudflare Worker proxy
 *
 * Déploiement (gratuit, ~3 minutes) :
 *  1. Va sur https://dash.cloudflare.com/ → Workers & Pages → ton Worker existant
 *  2. Clique "Edit Code"
 *  3. Remplace TOUT le code par le contenu de ce fichier → Save & Deploy
 *
 * Endpoints :
 *   GET /ping          → { ok: true }
 *   GET /check?url=…   → { status: <code HTTP> }   (-1 si erreur/timeout)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Content-Type'                : 'application/json',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status : status || 200,
    headers: CORS_HEADERS,
  });
}

async function probe(targetUrl) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  try {
    let res = await fetch(targetUrl, {
      method  : 'HEAD',
      redirect: 'follow',
      headers : { 'User-Agent': UA },
    });
    if (res.status === 405) {
      res = await fetch(targetUrl, {
        method  : 'GET',
        redirect: 'follow',
        headers : { 'User-Agent': UA },
      });
    }
    return res.status;
  } catch (e) {
    return -1;
  }
}

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);

  if (url.pathname === '/ping') {
    return json({ ok: true });
  }

  if (url.pathname === '/check') {
    const target = url.searchParams.get('url');
    if (!target) return json({ error: 'Missing url' }, 400);
    const status = await probe(target);
    return json({ status });
  }

  return new Response('Not found', { status: 404, headers: CORS_HEADERS });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
