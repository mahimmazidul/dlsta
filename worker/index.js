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
async function proxy(request, env, raw) {
  if (!validMediaUrl(raw)) return json(request, env, 400, {success: false, error: 'Invalid media URL.'});
  let target = raw, response;
  for (let i = 0; i < 4; i++) {
    response = await fetch(target, {redirect: 'manual', signal: AbortSignal.timeout(10000), headers: {accept: 'video/*,image/*', ...(request.headers.has('range') ? {range: request.headers.get('range')} : {})}});
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location || i === 3) throw new Error('UPSTREAM');
    target = new URL(location, target).href;
    if (!validMediaUrl(target)) return json(request, env, 400, {success: false, error: 'Disallowed redirect.'});
  }
  if (!response.ok) throw new Error('UPSTREAM');
  const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!['video/mp4','video/webm','image/jpeg','image/png','image/webp'].includes(type)) return json(request, env, 502, {success: false, error: 'Unsupported media type.'});
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_BYTES) return json(request, env, 413, {success: false, error: 'Media exceeds the 100 MB limit.'});
  const headers = cors(request, env);
  headers.set('Content-Type', type);
  headers.set('Content-Disposition', `attachment; filename="instagram.${type.startsWith('video/') ? (type === 'video/webm' ? 'webm' : 'mp4') : 'jpg'}"`);
  headers.set('Cache-Control', 'private, no-store');
  for (const key of ['content-length', 'content-range', 'accept-ranges']) if (response.headers.has(key)) headers.set(key, response.headers.get(key));
  let count = 0;
  const body = response.body?.pipeThrough(new TransformStream({transform(chunk, controller) {
    count += chunk.byteLength;
    if (count > MAX_BYTES) controller.error(new Error('Media size limit exceeded'));
    else controller.enqueue(chunk);
  }}));
  return new Response(body, {status: response.status, headers});
}
