import { scrapeInstagram, normalizeInstagramUrl } from './scraper.js';

const LIMIT = 10;
function cors(request, env) {
  const origin = request.headers.get('Origin');
  const configured = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
  const headers = new Headers({ 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
  if (configured.includes('*')) headers.set('Access-Control-Allow-Origin', '*');
  else if (origin && configured.includes(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}
function json(request, env, status, payload, extra = {}) {
  const headers = cors(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(JSON.stringify(payload), { status, headers });
}
async function rateLimit(request, env) {
  if (!env.RATE_LIMIT) throw new Error('LIMIT_UNAVAILABLE');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  const prefix = `${Math.floor(Date.now() / 60000)}:${hash}:`;
  try {
    const entries = await env.RATE_LIMIT.list({ prefix, limit: LIMIT });
    if (entries.keys.length >= LIMIT) return false;
    // Unique keys avoid KV's one-write-per-second-per-key limit. This remains approximate.
    await env.RATE_LIMIT.put(prefix + crypto.randomUUID(), '1', {expirationTtl: 120});
    return true;
  } catch { throw new Error('LIMIT_UNAVAILABLE'); }
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', {status: 404});
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors(request, env)});
    if (path !== '/api/scrape') return json(request, env, 404, {success: false, error: 'Not found.'});
    try {
      if (!await rateLimit(request, env)) return json(request, env, 429, {success: false, error: 'Too many requests. Try again shortly.'}, {'Retry-After': '60'});
      let raw;
      if (request.method === 'GET') raw = new URL(request.url).searchParams.get('url');
      else if (request.method === 'POST') {
        if (Number(request.headers.get('content-length')) > 4096) return json(request, env, 413, {success: false, error: 'Request too large.'});
        const reader = request.body?.getReader();
        const chunks = []; let size = 0;
        if (reader) {
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4096) { await reader.cancel(); return json(request, env, 413, {success: false, error: 'Request too large.'}); }
            chunks.push(value);
          }
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        try { raw = JSON.parse(new TextDecoder().decode(bytes))?.url; } catch { return json(request, env, 400, {success: false, error: 'Invalid JSON.'}); }
      } else return json(request, env, 405, {success: false, error: 'Method not allowed.'});
      normalizeInstagramUrl(raw);
      const result = await scrapeInstagram(raw, {oembedToken: env.INSTAGRAM_OEMBED_TOKEN});
      return json(request, env, 200, {success: true, ...result});
    } catch (error) {
      if (error.message === 'INVALID_URL') return json(request, env, 400, {success: false, error: 'Enter a valid public Instagram post or reel URL.'});
      if (error.message === 'LIMIT_UNAVAILABLE') return json(request, env, 503, {success: false, error: 'Rate limiting is unavailable.'});
      if (error.message === 'UNAVAILABLE') return json(request, env, 404, {success: false, error: 'The post is unavailable; it may be private or deleted.'});
      return json(request, env, 502, {success: false, error: 'Could not retrieve public media. It may be private, deleted, restricted, or temporarily blocked.'});
    }
  }
};
