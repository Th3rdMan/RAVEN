/**
 * RAVEN — Deno Deploy proxy
 *
 * Déploiement (gratuit, ~2 minutes) :
 *  1. Va sur https://dash.deno.com/new_playground
 *  2. Remplace tout le code par le contenu de ce fichier
 *  3. Clique "Save & Deploy"
 *  4. Copie l'URL affichée (ex: https://xxx-yyy.deno.dev)
 *  5. Mets à jour DEFAULT_PROXY dans js/checker.js avec cette URL
 *
 * Endpoints :
 *   GET /ping          → { ok: true }
 *   GET /check?url=…   → { status: <code HTTP> }   (-1 si erreur)
 */

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Content-Type'                : 'application/json',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function probe(url: string): Promise<number> {
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);

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
});
