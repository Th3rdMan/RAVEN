#!/usr/bin/env node
/**
 * @fileoverview RAVEN local proxy — forwards profile-check requests from the
 * browser, bypassing CORS restrictions. Listens on http://localhost:7472.
 *
 * Usage:  node server.js   (or: npm start)
 */
const http  = require('http');
const https = require('https');
const { URL } = require('url');

const PORT       = 7472;
const TIMEOUT_MS = 8000;

/**
 * Performs an HTTP HEAD request against `target`, falling back to GET on 405.
 * Calls `cb(error, statusCode)` when done.
 * @param {URL}              target
 * @param {'HEAD'|'GET'}     method
 * @param {function}         cb
 */
function probe(target, method, cb) {
  const mod = target.protocol === 'https:' ? https : http;
  const req = mod.request({
    hostname : target.hostname,
    port     : target.port || (target.protocol === 'https:' ? 443 : 80),
    path     : target.pathname + target.search,
    method,
    headers  : {
      'User-Agent'      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language' : 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept'          : 'text/html,application/xhtml+xml,*/*;q=0.8',
    },
    timeout  : TIMEOUT_MS,
  }, res => {
    res.resume(); // drain body to free the socket
    cb(null, res.statusCode);
  });

  req.on('timeout', () => { req.destroy(); cb(new Error('timeout'), null); });
  req.on('error',   err  => cb(err, null));
  req.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  // ── /ping — health check ──────────────────────────────────────────────────
  if (reqUrl.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ── /check?url=… ──────────────────────────────────────────────────────────
  if (reqUrl.pathname !== '/check') { res.writeHead(404); res.end(); return; }

  const raw = reqUrl.searchParams.get('url');
  if (!raw) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  let target;
  try   { target = new URL(raw); }
  catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  function send(status) {
    if (res.headersSent) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status }));
  }

  probe(target, 'HEAD', (err, status) => {
    if (err)          return send(-1);
    if (status === 405) {
      // Site rejects HEAD — retry with a full GET (headers only needed)
      probe(target, 'GET', (err2, status2) => send(err2 ? -1 : status2));
    } else {
      send(status);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nRAVEN proxy  →  http://localhost:' + PORT);
  console.log('Laisse ce terminal ouvert pendant que tu utilises RAVEN.');
  console.log('Ctrl+C pour arrêter.\n');
});
