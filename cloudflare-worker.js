/**
 * RAVEN — Cloudflare Worker proxy
 *
 * Déploiement (gratuit, ~3 minutes) :
 *  1. Va sur https://dash.cloudflare.com/ → Workers & Pages → Create
 *  2. "Hello World" Worker → Create
 *  3. Remplace tout le code par le contenu de ce fichier → Save & Deploy
 *  4. Copie l'URL du Worker (ex: https://raven-proxy.TON-COMPTE.workers.dev)
 *  5. Colle cette URL dans le champ proxy de RAVEN → ✓
 *
 * Endpoints :
 *   GET /ping          → { ok: true }
 *   GET /check?url=…   → { status: <code HTTP> }   (-1 si erreur/timeout)
 */

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type'                : 'application/json',
};

/**
 * Probes a URL with HEAD, falling back to GET on 405.
 * Cloudflare Workers follow redirects natively.
 * @param {string} url
 * @returns {Promise<number>} HTTP status code, or -1 on error.
 */
async function probe(url) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA } });
    if (res.status === 405) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA } });
    }
    return res.status;
  } catch {
    return -1;
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/ping') {
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (url.pathname === '/check') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: CORS });
      }
      const status = await probe(target);
      return new Response(JSON.stringify({ status }), { headers: CORS });
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};
