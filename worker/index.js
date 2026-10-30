import { scrapeInstagram, normalizeInstagramUrl, validMediaUrl } from './scraper.js';

const LIMIT = 10;
const MAX_BYTES = 100 * 1024 * 1024;
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
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(JSON.stringify(payload), { status, headers });
}
async function rateLimit(request, env) {
  if (!env.RATE_LIMIT) throw new Error('LIMIT_UNAVAILABLE');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  const prefix = `${Math.floor(Date.now() / 60000)}:${hash}:`;
  const entries = await env.RATE_LIMIT.list({ prefix, limit: LIMIT });
  if (entries.keys.length >= LIMIT) return false;
  // Unique keys avoid KV's one-write-per-second-per-key limit. KV is eventually
  // consistent and the list/put sequence is not atomic: this is best effort.
  await env.RATE_LIMIT.put(prefix + crypto.randomUUID(), '1', {expirationTtl: 120});
  return true;
}
