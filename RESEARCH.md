# Phase 1 — Repository analysis

Snapshot: 2026-10-30. The checkouts are pinned below. Review is static plus the tests in Phase 2; it is not a comprehensive security audit. The upstream README, manifests, extraction and proxy paths were inspected. `test/live-results.json` contains raw comparative HTTP responses, including expiring signed media URLs.

| Repository and commit | Runtime / dependencies | Extraction | CORS, proxy, limits | Assessment |
|---|---|---|---|---|
| [Alimsv-d/insta-worker](https://github.com/Alimsv-d/insta-worker/tree/ccdb77477dbfdfd75db459eb78329188d31fe815) | JavaScript, Workers; runtime dependencies none; dev esbuild ^0.25.12, parse5 ^7.3.0; deploy Wrangler | C: `resolveContent` → `callProvider` → catplus.ir. External service, not a native scraper. | CORS `*` by default, configurable; CDN HTTPS allowlist and manual redirect validation. Approximate KV fixed-window limits: resolve 60/min/IP by default, download 20, thumbnail 60. Falls open on KV failure. | External provider; no disqualifying D/E. MIT. |
| [AlaaDigital/instagram-video-downloader](https://github.com/AlaaDigital/instagram-video-downloader/tree/4fb417c985ac66fa04b4fbfba8a7ce00a68c7bc3) | README describes JS/Workers/vanilla UI; actual repository contains only README | Claimed B, but code absent; unverified. | Cannot verify CORS, proxy or limiter; no code. ⚠️ | Not testable. README mentions MIT but linked LICENSE is absent; no code to reuse. |
| [davidfl678/insta-scraper-api](https://github.com/davidfl678/insta-scraper-api/tree/8f19aa610ca3812eb10ec7212d1b0762c0a30917) | JS Worker; no production dependencies; dev wrangler ^3.107.0 | C: Prexzy, Cobalt and other external APIs; `scrapeInstagram` combines their results. | CORS `*`; ⚠️ `isDirectMediaUrl` accepts arbitrary URLs and proxy follows redirects: open-proxy/SSRF risk. ⚠️ No rate limit. | No D/E, but external services and severe proxy risk; do not deploy as-is. MIT. |
| [TTTT55/web-instagram-downloader](https://github.com/TTTT55/web-instagram-downloader/tree/89c0ddc9c236a0b1d127b0e6f96a64d07413ee84) | TS; Next.js/OpenNext, Worker and Deno; see all dependencies below | Unauthenticated Instagram web GraphQL → embed HTML → web JSON → media-info. The web GraphQL uses an anonymous CSRF cookie, not an authenticated session. Undocumented interfaces can change. | CORS `*` on JSON/proxy, configurable origin in standalone Worker. Media suffix checks include instagram.com beyond requested CDNs, and fetch follows redirects without revalidation: ⚠️ proxy risk. In-memory 30/min per isolate, not globally enforced; proxy not covered. | Strongest tested direct extraction; no D/E observed. No license file in checkout; use only as architectural reference, not as a code source. |

**Corrections to the supplied premise:** oEmbed is not GraphQL and commonly requires a Meta app token; oEmbed ordinarily gives embed HTML/thumbnail rather than a direct video file. Direct HTML and undocumented GraphQL are not guaranteed to work merely because a post is public. HTML returned by Instagram may contain a login page with HTTP 200.

## Root and source files

**Alimsv-d/insta-worker** — root: `.dev.vars.example, .github/, .gitignore, LICENSE, README.md, SETUP-MANUAL.md, package-lock.json, package.json, scripts/, src/, test/, wrangler.toml`.

Source files: `src/lib/crypto.js`, `src/lib/http.js`, `src/lib/i18n.js`, `src/lib/normalize.js`, `src/lib/providers.js`, `src/lib/security.js`, `src/lib/storage.js`, `src/lib/ui.js`, `src/lib/urls.js`, `src/worker.js`.

**AlaaDigital/instagram-video-downloader** — root: `README.md`.

Source files: none.

**davidfl678/insta-scraper-api** — root: `LICENSE, README.md, package.json, src/, wrangler.toml`.

Source files: `src/index.js`.

**TTTT55/web-instagram-downloader** — root: `.env.example, .github/, README.md, deno/, eslint.config.mjs, next.config.ts, open-next.config.ts, package.json, postcss.config.mjs, public/, src/, tsconfig.json, workers/, wrangler.toml`.

Source files: `deno/main.ts`, `src/app/about/page.tsx`, `src/app/api/contact/route.ts`, `src/app/api/download-file/route.ts`, `src/app/api/download/route.ts`, `src/app/api/health/route.ts`, `src/app/api/proxy/route.ts`, `src/app/audio/page.tsx`, `src/app/dmca/page.tsx`, `src/app/faq/page.tsx`, `src/app/globals.css`, `src/app/guides/download-instagram-videos/page.tsx`, `src/app/guides/instagram-carousel-download/page.tsx`, `src/app/guides/instagram-download-troubleshooting/page.tsx`, `src/app/guides/page.tsx`, `src/app/layout.tsx`, `src/app/not-found.tsx`, `src/app/page.tsx`, `src/app/photo/page.tsx`, `src/app/privacy/page.tsx`, `src/app/reels/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/stories/page.tsx`, `src/app/terms/page.tsx`, `src/components/AdSlot.tsx`, `src/components/ContactForm.tsx`, `src/components/ContentLayout.tsx`, `src/components/DownloadForm.tsx`, `src/components/Footer.tsx`, `src/components/Header.tsx`, `src/components/LegalLayout.tsx`, `src/components/Logo.tsx`, `src/components/NavTabs.tsx`, `src/components/Sections.tsx`, `src/components/ThemeToggle.tsx`, `src/components/ToolPage.tsx`, `src/lib/audio.ts`, `src/lib/instagram-embed.ts`, `src/lib/instagram-html-fallback.ts`, `src/lib/instagram.ts`, `src/lib/site.ts`, `workers/instagram-worker.ts`.

## Dependency audit

Direct dependencies are all listed in Phase 1 or here. TTTT55 runtime: `next 16.3.3`, `react 19.2.6`, `react-dom 19.2.6`; dev: `@opennextjs/cloudflare 1.20.6`, `@tailwindcss/postcss 4.1.17`, `@types/node 22.19.15`, `@types/react 19.2.14`, `@types/react-dom 19.2.3`, `eslint 9.39.4`, `eslint-config-next 16.3.3`, `postcss 8.5.8`, `tailwindcss 4.1.17`, `typescript 5.9.3`, `wrangler 4.131.2`. Next/OpenNext uses the Node compatibility flag, unlike the requested native-only Worker. Build/dev tools use Node; they are not Worker runtime dependencies.

At the review date, these specified versions were released over six months earlier: Alim `esbuild 0.25.12`, `parse5 7.3.0`; David `wrangler 3.107.0`; TTTT55 `@tailwindcss/postcss 4.1.17`, `@types/node 22.19.15`, `@types/react 19.2.14`, `@types/react-dom 19.2.3`, `eslint 9.39.4`, `postcss 8.5.8`, `tailwindcss 4.1.17`, `typescript 5.9.3`. Version age is not proof of an unmaintained project. Ranges can resolve newer versions.

`npm audit --package-lock-only` on Alim's committed lock: 0 findings. For David and TTTT55, no committed lock was present; temporary dependency resolutions produced David **7 high, 1 moderate** and TTTT55 **1 critical, 5 high**. These are time-sensitive resolution results, not proof all vulnerabilities are exploitable in deployed Workers. David's findings include esbuild, miniflare, sharp, undici, ws, zod and busboy; TTTT55 includes Next, miniflare, postcss, sharp, undici and Wrangler. Example: [Next ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). The new project's fresh lock, with Wrangler 4.156.0, audited clean at creation (0 reported); repeat audits over time.

# Phase 2 — Live tests

Local `wrangler dev` (not a production deployment), tested 2026-10-30. Public sample: `https://www.instagram.com/reel/Dbn-XJhk0_-/` (NASA reel, linked as an example in David's README). Times include local request and upstream. Successful CDN URLs were HTTPS, allowlisted, and returned HTTP 200 to HEAD at test time; they expire. Raw bodies and exact timings for the original test cases are in `test/live-results.json`.

| Repo | Sample result | Empty | YouTube URL | Unverified nonexistent shortcode | Score /10 (safety/live/errors/cleanliness/activity) |
|---|---|---|---|---|---|
| Alim | 200, CDN video HEAD 200, **3.68 s** | 400 | 400 | 504 after 24.42 s | **7** (1/3/1/1/1) |
| Alaa | Not testable: no code | — | — | — | N/A |
| David | 200, CDN video HEAD 200, **9.42 s**, fails <5 s criterion | 400 | 400 | 500 after 12.01 s | **4** (0/2/1/0/1) |
| TTTT55 standalone Worker | 200, CDN video HEAD 200, **0.53 s** | 400 | 400 | 404 after 1.08 s | **8** (2/3/1/1/1) |
| New Worker, Wrangler 4.156.0 | 200, CDN video HEAD 200, **1.62 s**; proxy Range request 206 | 400 | 400 | Initial version: 502 | Not scored against source repos |

The nonexistent shortcode was not independently confirmed to be a previously existing deleted post; **no verified private or deleted post was supplied, so those cases were not tested**. Error bodies in these observed tests were messages rather than stack traces; David and TTTT55 can nevertheless expose unexpected error messages on some paths. The new Worker deliberately distinguishes confirmed invalid input from ambiguous upstream failure and cannot always distinguish private, deleted, restricted, blocked or markup-changed posts. Its four Node unit tests pass, including host spoofing, 10-request behavior in a deterministic KV mock, and proxy redirect rejection; the mock does not prove a global KV limit. Local tests do not establish behavior from Cloudflare's production network.

# Phase 3 — Merge plan

- **BRAIN:** TTTT55, reference only: independent implementation of public GraphQL and HTML fallback, no source copied because no license file was found.
- **STRUCTURE:** Alim, reference only: KV and CDN/redirect safety principles, independently implemented. Alim's external provider was not adopted.
- **UI:** original vanilla UI, since Alaa's repo contains no UI source to merge.
- **REFERENCE:** David's API was investigated but not integrated due to external providers and proxy risk.

```text
insta-dl/
├── .github/workflows/pages.yml
├── wrangler.toml
├── package.json / package-lock.json
├── worker/{index.js,scraper.js}
├── public/{index.html,style.css,app.js}
├── test/{worker.test.js,live-results.json}
├── README.md
└── RESEARCH.md
```

Sequence: browser submit → `POST /api/scrape` → CORS / KV check → Instagram URL validation → `scrapeInstagram` → optional official oEmbed → public embed/page HTML → anonymous GraphQL → verified CDN URL → JSON → UI → `/api/proxy` → KV check → CDN validation → redirect revalidation → media type/size checks → streaming response. Static assets are served through the Workers assets binding. KV is approximate, not an exact 10/min global limit.

# Phase 4 — Full code

The repository also contains tests, npm lockfile, and raw results.

## `worker/index.js`

````js
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
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', {status: 404});
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors(request, env)});
    try {
      if (!await rateLimit(request, env)) return json(request, env, 429, {success: false, error: 'Too many requests. Try again shortly.'}, {'Retry-After': '60'});
      if (path === '/api/proxy' && request.method === 'GET') return await proxy(request, env, new URL(request.url).searchParams.get('url'));
      if (path !== '/api/scrape') return json(request, env, 404, {success: false, error: 'Not found.'});
      let raw;
      if (request.method === 'GET') raw = new URL(request.url).searchParams.get('url');
      else if (request.method === 'POST') {
        if (Number(request.headers.get('content-length')) > 4096) return json(request, env, 413, {success: false, error: 'Request too large.'});
        const text = await request.text();
        if (text.length > 4096) return json(request, env, 413, {success: false, error: 'Request too large.'});
        try { raw = JSON.parse(text)?.url; } catch { return json(request, env, 400, {success: false, error: 'Invalid JSON.'}); }
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

````

## `worker/scraper.js`

````js
// Only public posts; upstream availability and markup are outside our control.
export function validMediaUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      ['cdninstagram.com', 'fbcdn.net'].some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}

export function normalizeInstagramUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('INVALID_URL');
  let u;
  try { u = new URL(raw.trim()); } catch { throw new Error('INVALID_URL'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port ||
      !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(u.hostname.toLowerCase())) throw new Error('INVALID_URL');
  const match = u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{1,32})\/?$/);
  if (!match) throw new Error('INVALID_URL');
  return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}

function decode(value) {
  if (!value) return '';
  return value.replace(/\\u0026/gi, '&').replace(/\\u003d/gi, '=').replace(/\\\//g, '/')
    .replace(/&amp;/g, '&').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function meta(html, name) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = (key) => tag.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
    if ((attr('property') || attr('name') || '').toLowerCase() === name) return decode(attr('content'));
  }
  return '';
}
function field(html, name) {
  const m = html.match(new RegExp('"' + name + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'i'));
  if (!m) return '';
  try { return decode(JSON.parse('"' + m[1] + '"')); } catch { return decode(m[1]); }
}
async function upstream(url, accept = 'text/html') {
  const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(4500), headers: {accept, 'user-agent': 'Mozilla/5.0 (compatible; public-media-fetcher/1.0)'}});
  // Do not follow redirects (including login redirects) or misclassify them as deleted.
  if (response.status === 404) return {status: 404, body: ''};
  if (!response.ok) return {status: response.status, body: ''};
  const body = await response.text();
  if (body.length > 3_000_000) throw new Error('UPSTREAM');
  return {status: response.status, body};
}

export async function scrapeInstagram(raw, options = {}) {
  const url = normalizeInstagramUrl(raw);
  let thumbnailUrl = '', caption = '', saw404 = false;
  // Official oEmbed is not GraphQL and generally requires an app access token;
  // it normally returns embed metadata, not a direct video URL.
  if (options.oembedToken) {
    try {
      const endpoint = new URL('https://graph.facebook.com/v24.0/instagram_oembed');
      endpoint.searchParams.set('url', url);
      endpoint.searchParams.set('access_token', options.oembedToken);
      const result = await upstream(endpoint.toString(), 'application/json');
      if (result.status === 200) {
        const data = JSON.parse(result.body);
        thumbnailUrl = validMediaUrl(data.thumbnail_url) ? data.thumbnail_url : '';
        caption = typeof data.title === 'string' ? data.title.slice(0, 2000) : '';
        if (validMediaUrl(data.video_url)) return {videoUrl: data.video_url, thumbnailUrl, caption};
      }
    } catch { /* fall through to public HTML */ }
  }
  for (const candidate of [url + 'embed/captioned/', url]) {
    try {
      const result = await upstream(candidate);
      if (result.status === 404) { saw404 = true; continue; }
      if (result.status !== 200) continue;
      const html = result.body;
      const videoUrl = meta(html, 'og:video:secure_url') || meta(html, 'og:video') || field(html, 'video_url');
      const image = meta(html, 'og:image') || field(html, 'display_url');
      if (validMediaUrl(image)) thumbnailUrl = image;
      caption ||= (meta(html, 'og:description') || '').slice(0, 2000);
      if (validMediaUrl(videoUrl)) return {videoUrl, thumbnailUrl, caption};
    } catch { /* try next representation */ }
  }
  // Unauthenticated web GraphQL is an additional fallback, not oEmbed. Its
  // undocumented doc ID can change; only fresh anonymous CSRF cookies are used (no login).
  try {
    const shortcode = url.split('/')[4];
    const home = await fetch("https://www.instagram.com/", {redirect:"manual", signal:AbortSignal.timeout(3000), headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"}});
    const homeText = await home.text();
    const csrf = home.headers.get("set-cookie")?.match(/csrftoken=([^;,\s]+)/)?.[1] || homeText.match(/"csrf_token":"([^"]+)"/)?.[1] || crypto.randomUUID().replaceAll("-", "");
    const body = new URLSearchParams({
      variables: JSON.stringify({shortcode, fetch_tagged_user_count: null, hoisted_comment_id: null, hoisted_reply_id: null, __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false}),
      doc_id: options.docId || '27128499623469141', lsd: 'AVqbxe3J_YA', fb_api_req_friendly_name: 'PolarisPostRootQuery', av:'0', __d:'www', __user:'0', __a:'1', __req:'3', __hs:'20000.HYP:instagram_web_pkg.2.1..0.0', dpr:'1', __ccg:'UNKNOWN', __comet_req:'7', jazoest:'2957', __spin_r:'1000000000', __spin_b:'trunk', fb_api_caller_class:'RelayModern', server_timestamps:'true'
    });
    const response = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(4500),
      headers: {'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'content-type':'application/x-www-form-urlencoded', 'x-ig-app-id':'936619743392459', 'x-fb-lsd':'AVqbxe3J_YA', 'x-fb-friendly-name':'PolarisPostRootQuery', 'x-requested-with':'XMLHttpRequest', 'accept':'*/*', 'accept-language':'en-US,en;q=0.9', 'sec-fetch-site':'same-origin', 'sec-fetch-mode':'cors', 'sec-fetch-dest':'empty', 'x-asbd-id':'129477', 'x-csrftoken':csrf, 'cookie':`csrftoken=${csrf}; ig_did=${crypto.randomUUID()}; mid=${crypto.randomUUID().replaceAll('-', '')}`, 'origin':'https://www.instagram.com', 'referer':'https://www.instagram.com/'}, body: body.toString()
    });
    if (response.ok) {
      const data = await response.json();
      const root = data?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0] || data?.data?.xdt_shortcode_media;
      const item = root?.carousel_media?.find(x => x.video_versions?.length) || root;
      const videoUrl = item?.video_versions?.find(x => validMediaUrl(x.url))?.url || item?.video_url;
      const image = item?.image_versions2?.candidates?.find(x => validMediaUrl(x.url))?.url || item?.display_url;
      if (validMediaUrl(image)) thumbnailUrl = image;
      caption = (root?.caption?.text || root?.edge_media_to_caption?.edges?.[0]?.node?.text || caption).slice(0, 2000);
      if (validMediaUrl(videoUrl)) return {videoUrl, thumbnailUrl, caption};
    }
  } catch { /* upstream changed or is unavailable */ }
  // A 404 can be a misleading login/anti-bot response: do not claim deletion.
  throw new Error(saw404 ? 'UNAVAILABLE' : 'UPSTREAM');
}

````

## `public/index.html`

````html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>Insta DL — Save public videos</title><link rel="stylesheet" href="style.css"><script src="app.js" defer></script></head>
<body><main><header><div class="brand"><span class="logo">↓</span> INSTA DL</div><span class="badge">PUBLIC CONTENT ONLY</span></header><section class="hero"><div class="eyebrow"><span>✦</span> SIMPLE · PRIVATE · NO LOGIN</div><h1>Keep the moments<br><em>worth saving.</em></h1><p>Save public Instagram videos and reels in a few clicks. No account, no clutter—just the content you love.</p><form id="form"><label for="url">INSTAGRAM LINK</label><div class="input-wrap"><span aria-hidden="true">↗</span><input id="url" type="url" name="url" placeholder="https://www.instagram.com/reel/..." required><button id="submit" type="submit">Find video <span>→</span></button></div><small>Paste a link to a public post or reel.</small></form><div id="message" role="status" aria-live="polite"></div><article id="result" hidden><img id="thumbnail" alt="Video thumbnail" hidden><div><div class="eyebrow">YOUR VIDEO IS READY</div><p id="caption"></p><a id="download" class="download">Download video ↓</a></div></article></section><section class="steps"><div><b>01</b><h3>Copy the link</h3><p>Find a public reel or video on Instagram and copy its link.</p></div><div><b>02</b><h3>Paste it here</h3><p>Drop the link above and let us look for the video.</p></div><div><b>03</b><h3>Save your video</h3><p>Download it for personal use, with the creator’s permission.</p></div></section><footer><span>© INSTA DL</span><span>Not affiliated with Instagram or Meta.</span><span>Made for moments ✦</span></footer></main></body></html>

````

## `public/style.css`

````css
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#f3f1ed;background:#101111;font-synthesis:none}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 55% 15%,#24261f 0,transparent 48%),#101111}main{max-width:1180px;margin:auto;padding:0 44px}header{height:96px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #30312d}.brand{font-weight:800;font-size:14px;letter-spacing:.13em;display:flex;align-items:center;gap:11px}.logo{display:grid;place-items:center;width:33px;height:33px;border-radius:10px;color:#13160c;background:#d4ed96;font-size:22px}.badge,.eyebrow{font-size:10px;letter-spacing:.16em;font-weight:700;color:#b7c4a2}.badge{border:1px solid #3c4335;border-radius:99px;padding:9px 13px}.hero{max-width:800px;margin:0 auto;padding:115px 0 95px;text-align:center}.eyebrow span{color:#d5ed9b}h1{font-size:clamp(43px,6.6vw,78px);letter-spacing:-.055em;line-height:1.05;margin:24px 0}h1 em{color:#d6eea0;font-style:normal}.hero>p{color:#aaaead;line-height:1.7;max-width:520px;margin:0 auto 48px;font-size:16px}form{text-align:left;max-width:690px;margin:auto}label{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;color:#d2d4ca;margin:0 0 12px}.input-wrap{display:flex;align-items:center;background:#1d1f1c;border:1px solid #3d4138;border-radius:12px;padding:7px;gap:12px}.input-wrap>span{color:#a7b69d;padding-left:12px;font-size:20px}input{min-width:0;flex:1;color:#f8f8f3;background:transparent;border:0;outline:none;font:inherit;font-size:14px}input::placeholder{color:#71756f}button,.download{border:0;border-radius:8px;background:#d6eea0;color:#1b2112;font-weight:750;font-size:13px;padding:17px 22px;cursor:pointer;white-space:nowrap;text-decoration:none}button:hover,.download:hover{background:#e6ffc0}button:disabled{opacity:.6;cursor:wait}button span{margin-left:14px}small{display:block;color:#777d76;margin-top:12px;font-size:12px}#message{margin:20px auto 0;color:#efb3a9;max-width:690px;text-align:left}#result{margin:30px auto 0;border:1px solid #3d4138;border-radius:14px;padding:20px;max-width:690px;display:flex;gap:24px;text-align:left;align-items:center;background:#1b1d1a}#result[hidden]{display:none}#thumbnail{max-width:135px;max-height:180px;border-radius:8px}#result p{color:#c8cdc2;font-size:14px;line-height:1.5;white-space:pre-wrap}.download{display:inline-block;padding:13px 17px}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;border-top:1px solid #30312d;padding:55px 0 90px}.steps b{color:#a8c781;font-size:11px}.steps h3{font-size:15px;margin:16px 0 8px}.steps p{color:#898e87;font-size:13px;line-height:1.7;max-width:245px;margin:0}footer{border-top:1px solid #30312d;padding:25px 0 35px;display:flex;justify-content:space-between;color:#72776f;font-size:11px}@media(max-width:650px){main{padding:0 22px}header{height:76px}.badge{font-size:8px}.hero{padding:80px 0}.hero>p{font-size:14px}.input-wrap{flex-wrap:wrap}.input-wrap>span{padding-left:8px}input{height:45px}button{width:100%}.steps{grid-template-columns:1fr;gap:30px;padding:38px 0 60px}footer{gap:15px;flex-wrap:wrap}#result{align-items:flex-start;flex-direction:column}}

````

## `public/app.js`

````js
// Leave empty for a combined Worker deployment; for Pages set the full Worker origin.
const WORKER_URL = '';
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  result.hidden = true;
  message.textContent = '';
  submit.disabled = true;
  submit.textContent = 'Finding video…';
  try {
    if (!WORKER_URL && window.location.hostname.endsWith('.github.io')) {
      throw new Error('The frontend is hosted on GitHub Pages, but the Cloudflare Worker URL is not configured yet. Set WORKER_URL in public/app.js and redeploy.');
    }
    const response = await fetch(`${WORKER_URL}/api/scrape`, {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url: document.querySelector('#url').value.trim()})});
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to find a video.');
    const image = document.querySelector('#thumbnail');
    image.hidden = !data.thumbnailUrl;
    if (data.thumbnailUrl) image.src = data.thumbnailUrl;
    document.querySelector('#caption').textContent = data.caption || 'Your video is ready to save.';
    document.querySelector('#download').href = `${WORKER_URL}/api/proxy?url=${encodeURIComponent(data.videoUrl)}`;
    result.hidden = false;
  } catch (error) { message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { submit.disabled = false; submit.textContent = 'Find video →'; }
});

````

## `wrangler.toml`

````toml
name = "insta-dl"
main = "worker/index.js"
compatibility_date = "2026-10-30"

[assets]
directory = "./public"
binding = "ASSETS"

[[kv_namespaces]]
binding = "RATE_LIMIT"

[vars]
ALLOWED_ORIGINS = "*"

````

## `.github/workflows/pages.yml`

````yaml
name: Deploy frontend to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: public
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

````

## `README.md`

````markdown
# Insta DL

A small Cloudflare Worker + static UI for resolving **public** Instagram videos. The resolver uses official oEmbed only if an app token is configured, then public HTML, then unauthenticated Instagram web GraphQL with an ephemeral anonymous CSRF cookie. No Instagram account login, paid APIs, subprocesses, or Node APIs are used by the Worker.

**Availability is not guaranteed.** Instagram can change or block these unofficial public endpoints, require login, remove videos, or return ambiguous responses. oEmbed generally returns embed metadata, not a downloadable video; it is not GraphQL and usually needs a Meta app access token. Public HTML often lacks video URLs. GraphQL document IDs can change. Private content is not supported. Only download material you have permission to use; follow the relevant platform terms and copyright laws.

## Deploy to Cloudflare

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mahimmazidul/dlsta)

The button works **after this code is pushed** to the repository. The deployment flow may prompt for Cloudflare account and KV provisioning. If it cannot provision the namespace, use the manual steps below.

Manual deployment (Node.js 22+):

```sh
npm ci
npx wrangler login
# Recent Wrangler can provision the ID-less RATE_LIMIT binding on deploy.
npx wrangler deploy
```

If automatic provisioning is unavailable, run `npx wrangler kv namespace create RATE_LIMIT`, then add the returned `id` to the `[[kv_namespaces]]` section in `wrangler.toml` and deploy again. For local development, run `npm test` then `npm run dev`. The Worker serves `public/` as static assets and `/api/*` itself.

Optional oEmbed: `npx wrangler secret put INSTAGRAM_OEMBED_TOKEN`. Obtain an appropriate Meta app access token and permissions from Meta; do not commit it. It is sent only to the official Graph API. No token is needed for the other methods.

## Separate frontend

For Cloudflare Pages or GitHub Pages, publish the contents of `public/` as the site root. In `public/app.js`, set `WORKER_URL` to the **HTTPS origin** of the deployed Worker, with no trailing slash. Redeploy the site. Restrict `ALLOWED_ORIGINS` in `wrangler.toml` to a comma-separated list of exact HTTPS frontend origins and redeploy the Worker; the default `*` permits all origins. CORS is not authentication and does not stop non-browser callers. The included `.github/workflows/pages.yml` publishes `public/` to GitHub Pages on pushes to `main`. In repository Settings → Pages, set **Build and deployment → Source** to **GitHub Actions**. The site URL is `https://mahimmazidul.github.io/dlsta/` once the workflow succeeds. GitHub Pages cannot run the Worker; deploy that separately.

## API

- `POST /api/scrape` with JSON `{ "url": "https://www.instagram.com/reel/.../" }`, or GET with `?url=...`. Returns `{success, videoUrl, thumbnailUrl, caption}` on success. Empty `thumbnailUrl` and `caption` mean unavailable.
- `GET /api/proxy?url=<encoded-video-url>` streams allowlisted HTTPS media with an attachment disposition. Redirects are revalidated at every hop; image/video MIME types are restricted and transfer is capped at 100 MB. Signed media URLs expire.
- Errors return JSON without stack traces. Bad input is 400; 404 means upstream indicated unavailability, not proof of deletion; ambiguous upstream failures return 502.

The rate limiter targets **10 API requests per IP per fixed minute**, storing short-lived hashed-IP keys in KV; the Worker fails closed if the binding is missing. KV reads are eventually consistent and list/put is not atomic: concurrent or cross-region requests can exceed the target. KV is not a strict security boundary and incurs usage costs. Use a Durable Object or Cloudflare's rate-limiting product if a hard global limit is required. Set Cloudflare WAF/rate-limit rules for abuse protection, including asset routes. In local development, all clients without `CF-Connecting-IP` share one bucket.

## Verification

See `RESEARCH.md` for the repository audit, test results, limitations, and attribution. `test/live-results.json` contains time-sensitive raw responses from the initial comparative tests; signed URLs in those responses will expire. Run `npm test` for offline unit tests. Test results are snapshots, not guarantees of future Instagram behavior.

````
