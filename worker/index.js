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
// On Workers, emit canonical and social URLs for the host that served the page.
// Static GitHub Pages keeps the default URLs already present in index.html.
export function renderSeoHtml(html, requestUrl) {
  const siteUrl = new URL('/', requestUrl).href;
  const imageUrl = new URL('images/social-card.png', siteUrl).href;
  const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  html = html.replace(/<link\b[^>]*>/gi, tag => {
    if (!/\brel=["']canonical["']/i.test(tag)) return tag;
    return tag.replace(/(\bhref=)(["'])[^"']*\2/i, (_, key, quote) => `${key}${quote}${escapeAttribute(siteUrl)}${quote}`);
  });
  const metadata = {'og:url': siteUrl, 'og:image': imageUrl, 'twitter:image': imageUrl};
  html = html.replace(/<meta\b[^>]*>/gi, tag => {
    const name = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (!Object.hasOwn(metadata, name)) return tag;
    return tag.replace(/(\bcontent=)(["'])[^"']*\2/i, (_, key, quote) => `${key}${quote}${escapeAttribute(metadata[name])}${quote}`);
  });
  return html.replace(/(<script\s+type=["']application\/ld\+json["']\s*>)([\s\S]*?)(<\/script>)/i, (match, open, body, close) => {
    try {
      const schema = JSON.parse(body);
      schema.url = siteUrl;
      schema.image = imageUrl;
      // Avoid closing the JSON-LD script if any future value contains '<'.
      return open + JSON.stringify(schema).replace(/</g, '\\u003c') + close;
    } catch { return match; }
  });
}

async function renderHome(request, env) {
  if (!env.ASSETS) return new Response('Not found', {status: 404});
  // Fetch the full source asset before transforming it. Static-asset ETags and
  // range responses describe the untransformed file, not our host-aware HTML.
  const sourceHeaders = new Headers(request.headers);
  for (const name of ['if-none-match', 'if-modified-since', 'range', 'if-range']) sourceHeaders.delete(name);
  const sourceRequest = new Request(request, {method: 'GET', headers: sourceHeaders});
  const response = await env.ASSETS.fetch(sourceRequest);
  if (!response.ok) return response;
  const html = renderSeoHtml(await response.text(), request.url);
  const headers = new Headers(response.headers);
  // The transformed representation has a different body and depends on the host.
  for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(request.method === 'HEAD' ? null : html, {status: response.status, headers});
}

function seoFile(request, path) {
  const siteUrl = new URL('/', request.url).href;
  const body = path === '/robots.txt'
    ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteUrl}sitemap.xml\n`
    : `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl.replace(/&/g, '&amp;')}</loc></url></urlset>\n`;
  return new Response(request.method === 'HEAD' ? null : body, {headers: {
    'Content-Type': path === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8',
    'Cache-Control': 'no-store'
  }});
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if ((request.method === 'GET' || request.method === 'HEAD') && (path === '/' || path === '/index.html')) return renderHome(request, env);
    if ((request.method === 'GET' || request.method === 'HEAD') && (path === '/robots.txt' || path === '/sitemap.xml')) return seoFile(request, path);
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
