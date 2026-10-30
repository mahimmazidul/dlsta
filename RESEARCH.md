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

The nonexistent shortcode was not independently confirmed to be a previously existing deleted post; **no verified private or deleted post was supplied, so those cases were not tested**. Error bodies in these observed tests were messages rather than stack traces; David and TTTT55 can nevertheless expose unexpected error messages on some paths. The current Worker returns direct Instagram CDN links and no longer has a media proxy. The new Worker deliberately distinguishes confirmed invalid input from ambiguous upstream failure and cannot always distinguish private, deleted, restricted, blocked or markup-changed posts. Its four Node unit tests pass, including host spoofing, 10-request behavior in a deterministic KV mock, and removal of the proxy endpoint; the mock does not prove a global KV limit. Local tests do not establish behavior from Cloudflare's production network.

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
├── README.md / RESEARCH.md
└── LICENSE / NOTICE
```

Sequence: browser submit → `POST /api/scrape` → CORS / KV check → Instagram URL validation → `scrapeInstagram` → optional official oEmbed → public embed/page HTML → anonymous GraphQL → verified CDN URL → JSON → UI → direct Instagram CDN video URL (no Cloudflare video streaming). Static assets are served through the Workers assets binding. KV is approximate, not an exact 10/min global limit. Earlier proxy-related research results above are historical, from before the proxy was removed.


The current project is published under the Apache License 2.0; see `LICENSE` and `NOTICE`. Third-party upstream projects retain their own licenses.


## Subsequent project review

The current version adds direct links for public photos as well as videos. A NASA photo (`https://www.instagram.com/p/9w42bQoaI1/`) and reel (`https://www.instagram.com/reel/Dbn-XJhk0_-/`) were tested locally: both resolved to allowlisted HTTPS CDN URLs and those URLs returned HTTP 200 to HEAD at the time of testing. Links expire, and upstream or production network behavior may differ. For carousels, only one media item is returned; the UI does not support full-album download.

Responsive layouts were checked in headless Chromium at widths 320, 375, 700, 768, 1024 and 1440 px, including long captions and the result panel. The mobile footer was centered and the paste handler was exercised. The audit also added bounded request/upstream reads and a 503 response when KV fails. `insta-dl` remains the Cloudflare Worker service name for compatibility while the public app and package are named `dlsta`. See the README for one-click deployment instructions and the KV consistency limitations.


A subsequent SEO and branding update introduced the project icon, social preview, canonical URL, sitemap, crawler guidance, and structured data. The default canonical site is the owner's GitHub Pages subdirectory; forks and other primary domains must update the absolute URLs as described in the README. GitHub Pages still requires a configured Worker URL for lookups.

# Phase 4 — Full code

The repository also contains tests, npm lockfile, raw results, branding files and the Apache license.

## `worker/index.js`

````js
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
// Bound the body while reading, rather than checking after allocating it.
async function readUpstreamText(response, limit = 3_000_000) {
  if (Number(response.headers.get('content-length')) > limit) throw new Error('UPSTREAM');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder(); let text = '', size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('UPSTREAM'); }
    text += decoder.decode(value, {stream: true});
  }
  return text + decoder.decode();
}
async function upstream(url, accept = 'text/html') {
  const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(4500), headers: {accept, 'user-agent': 'Mozilla/5.0 (compatible; public-media-fetcher/1.0)'}});
  // Do not follow redirects (including login redirects) or misclassify them as deleted.
  if (response.status === 404) return {status: 404, body: ''};
  if (!response.ok) return {status: response.status, body: ''};
  return {status: response.status, body: await readUpstreamText(response)};
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
        if (validMediaUrl(data.video_url)) return {mediaType: 'video', mediaUrl: data.video_url, videoUrl: data.video_url, thumbnailUrl, caption};
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
      if (validMediaUrl(videoUrl)) return {mediaType: 'video', mediaUrl: videoUrl, videoUrl, thumbnailUrl, caption};
    } catch { /* try next representation */ }
  }
  // Unauthenticated web GraphQL is an additional fallback, not oEmbed. Its
  // undocumented doc ID can change; only fresh anonymous CSRF cookies are used (no login).
  try {
    const shortcode = url.split('/')[4];
    const home = await fetch("https://www.instagram.com/", {redirect:"manual", signal:AbortSignal.timeout(3000), headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"}});
    const homeText = await readUpstreamText(home);
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
      const data = JSON.parse(await readUpstreamText(response));
      const root = data?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0] || data?.data?.xdt_shortcode_media;
      // Return the first carousel item only; never mistake a video's cover for a photo.
      const item = root?.carousel_media?.[0] || root?.edge_sidecar_to_children?.edges?.[0]?.node || root;
      const videoUrl = item?.video_versions?.find(x => validMediaUrl(x.url))?.url || item?.video_url;
      const image = item?.image_versions2?.candidates?.find(x => validMediaUrl(x.url))?.url || item?.display_url;
      if (validMediaUrl(image)) thumbnailUrl = image;
      const text = root?.caption?.text || root?.edge_media_to_caption?.edges?.[0]?.node?.text || caption;
      caption = typeof text === 'string' ? text.slice(0, 2000) : '';
      if (validMediaUrl(videoUrl)) return {mediaType: 'video', mediaUrl: videoUrl, videoUrl, thumbnailUrl, caption};
      const isPhoto = item?.media_type === 1 || item?.is_video === false || item?.__typename === 'GraphImage';
      if (isPhoto && validMediaUrl(image)) return {mediaType: 'photo', mediaUrl: image, photoUrl: image, thumbnailUrl: image, caption};
    }
  } catch { /* upstream changed or is unavailable */ }
  // A 404 can be a misleading login/anti-bot response: do not claim deletion.
  throw new Error(saw404 ? 'UNAVAILABLE' : 'UPSTREAM');
}

````

## `public/index.html`

````html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>dlsta — Instagram Photo, Reel &amp; Video Downloader</title>
  <meta name="description" content="Find direct links to public Instagram photos, Reels and videos with dlsta. No Instagram login required; save media from its original CDN.">
  <meta name="author" content="Md. Mazidul Islam Mahim">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#10120f">
  <link rel="canonical" href="https://mahimmazidul.github.io/dlsta/">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="96x96" href="favicon-96.png">
  <link rel="icon" type="image/svg+xml" href="icon.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="dlsta">
  <meta property="og:title" content="dlsta — Instagram Photo, Reel &amp; Video Downloader">
  <meta property="og:description" content="Get direct links to public Instagram photos, Reels and videos. No Instagram login required.">
  <meta property="og:url" content="https://mahimmazidul.github.io/dlsta/">
  <meta property="og:image" content="https://mahimmazidul.github.io/dlsta/images/social-card.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="dlsta: keep the moments worth saving, with direct links for public Instagram photos, Reels and videos.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="dlsta — Instagram Photo, Reel &amp; Video Downloader">
  <meta name="twitter:description" content="Get direct links to public Instagram photos, Reels and videos. No Instagram login required.">
  <meta name="twitter:image" content="https://mahimmazidul.github.io/dlsta/images/social-card.png">
  <meta name="twitter:image:alt" content="dlsta: direct links for public Instagram photos, Reels and videos.">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebApplication","name":"dlsta","url":"https://mahimmazidul.github.io/dlsta/","description":"Find direct links to public Instagram photos, Reels and videos without an Instagram login.","applicationCategory":"MultimediaApplication","operatingSystem":"Any","browserRequirements":"Requires JavaScript","image":"https://mahimmazidul.github.io/dlsta/images/social-card.png","author":{"@type":"Person","name":"Md. Mazidul Islam Mahim","url":"https://github.com/mahimmazidul"}}
  </script>
  <link rel="stylesheet" href="style.css">
  <script src="app.js" defer></script>
</head>
<body>
  <div class="page-shell">
    <header class="header wrap">
      <a class="brand" href="./" aria-label="dlsta home"><span class="brand-mark" aria-hidden="true">↘</span><span>dlsta<span class="brand-dot">.</span></span></a>
      <nav class="header-nav" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="https://github.com/mahimmazidul/dlsta" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </nav>
      <span class="header-pill"><span class="status-dot"></span> FOR PUBLIC CONTENT</span>
    </header>

    <main>
      <section class="hero wrap" aria-labelledby="hero-title">
        <div class="eyebrow"><span class="sparkle" aria-hidden="true">✳</span> YOUR LITTLE CORNER OF THE INTERNET</div>
        <h1 id="hero-title">Good moments<br><em>are worth keeping.</em></h1>
        <p class="hero-copy">dlsta helps you find direct links to public Instagram photos, Reels and videos in just a few clicks.</p>

        <div class="tool-card">
          <div class="tool-top"><div><span class="tool-label">THE MEDIA TOOL</span><h2>Let’s find your media.</h2></div><span class="step-indicator">01 / 01</span></div>
          <form id="form">
            <label for="url">Instagram link</label>
            <div class="input-row">
              <span class="link-icon" aria-hidden="true">↗</span>
              <input id="url" name="url" type="url" placeholder="Paste an Instagram reel or post link..." autocomplete="url" required>
              <button id="submit" type="submit"><span>Get media link</span><span aria-hidden="true">↗</span></button>
            </div>
            <div class="form-note"><span><span aria-hidden="true">◉</span> Public posts and reels only</span><span>No login needed</span></div>
          </form>
          <div id="message" class="message" role="status" aria-live="polite"></div>
          <article id="result" class="result" hidden aria-label="Media result">
            <div class="result-image" id="image-wrap" hidden><img id="thumbnail" alt="Preview of the Instagram post" referrerpolicy="no-referrer"></div>
            <div class="result-body">
              <span class="result-kicker"><span class="status-dot"></span> DIRECT LINK READY</span>
              <h3 id="result-title">Your media is ready.</h3>
              <p id="caption" class="caption"></p>
              <div class="result-actions">
                <a id="download" class="primary-action" target="_blank" rel="noopener noreferrer">Open direct media <span aria-hidden="true">↗</span></a>
              </div>
              <label class="direct-label" for="direct-url">Direct media link</label>
              <div class="direct-link-field">
                <input id="direct-url" type="url" readonly spellcheck="false" aria-label="Direct media link">
                <button id="copy" type="button" class="copy-action">Copy</button>
              </div>
              <p class="download-note">Media opens directly from Instagram’s CDN. Use your browser’s save or download option. Links may expire.</p>
            </div>
          </article>
        </div>
        <div class="hero-footnote"><span class="footnote-line"></span> A LITTLE LESS SCROLLING, A LITTLE MORE KEEPING <span class="footnote-line"></span></div>
      </section>

      <section id="how-it-works" class="how-section">
        <div class="wrap">
          <div class="section-heading"><div><div class="eyebrow">THE SIMPLE STUFF</div><h2>Three steps. <em>That’s it.</em></h2></div><p>No accounts, no complicated setup.<br>Just a link and a little magic.</p></div>
          <div class="steps">
            <article><div class="step-top"><span class="step-icon" aria-hidden="true">⌁</span><span>01</span></div><h3>Copy the link</h3><p>Find a public Instagram reel, video, or photo post and copy its link.</p></article>
            <article><div class="step-top"><span class="step-icon" aria-hidden="true">↗</span><span>02</span></div><h3>Paste it here</h3><p>Drop the link in the box above and let us find the media.</p></article>
            <article><div class="step-top"><span class="step-icon" aria-hidden="true">↓</span><span>03</span></div><h3>Save your find</h3><p>Open the direct link and save it, with the creator’s permission.</p></article>
          </div>
        </div>
      </section>
      <section class="about-section" aria-labelledby="about-title">
        <div class="wrap about-grid">
          <div class="about-copy">
            <div class="eyebrow">GOOD TO KNOW</div>
            <h2 id="about-title">A simpler way to save<br><em>public Instagram media.</em></h2>
            <p>dlsta helps you find a direct link to a public Instagram photo, Reel or video. The file comes from Instagram’s CDN—not through our server—and you don’t need to sign in to Instagram.</p>
            <p>Only save content you have permission to use. dlsta is an independent project and isn’t affiliated with Instagram or Meta.</p>
          </div>
          <div class="faq" aria-label="Frequently asked questions">
            <details><summary>Can I save Instagram photos and Reels?</summary><p>dlsta supports public photo posts, Reels and videos when Instagram makes the media available. For a carousel, it returns one item rather than the whole album.</p></details>
            <details><summary>Why won’t a link work?</summary><p>Private, deleted, restricted or temporarily blocked posts can’t be resolved. Instagram can also change how public media is served. Direct links can expire, so try finding the post again.</p></details>
            <details><summary>How do I save the media?</summary><p>Open or copy the direct link. If your browser displays the photo or plays the video, use its save or download option. The file is served by Instagram’s CDN.</p></details>
          </div>
        </div>
      </section>
    </main>
    <footer class="footer wrap"><div class="footer-brand"><a class="brand" href="./"><span class="brand-mark" aria-hidden="true">↘</span><span>dlsta<span class="brand-dot">.</span></span></a><p>For the moments you want to keep.</p></div><div class="footer-right"><p>Built by <a href="https://github.com/mahimmazidul" target="_blank" rel="noopener noreferrer">Md. Mazidul Islam Mahim ↗</a></p><p>Not affiliated with Instagram or Meta. · <a href="https://github.com/mahimmazidul/dlsta/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Apache 2.0 license ↗</a></p></div></footer>
  </div>
</body>
</html>

````

## `public/style.css`

````css
:root{color-scheme:dark;--bg:#10120f;--surface:#1a1d18;--line:#32372c;--muted:#9a9f93;--text:#f3f3e9;--accent:#d8efab;--accent-dark:#bcd78d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-synthesis:none;scroll-behavior:smooth}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}a{color:inherit}.page-shell{overflow:hidden;background:radial-gradient(ellipse 66% 48% at 50% 4%,#252c1c 0,transparent 75%)}.wrap{width:min(1120px,calc(100% - 80px));margin-inline:auto}.header{height:93px;display:flex;align-items:center;gap:55px;border-bottom:1px solid #30342b}.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-size:25px;font-weight:800;letter-spacing:-.075em;line-height:1}.brand-dot{color:var(--accent)}.brand-mark{width:33px;height:33px;border-radius:10px;display:grid;place-items:center;background:var(--accent);color:#182014;font-size:22px;font-weight:800;letter-spacing:0}.header-nav{display:flex;gap:28px;color:#b3b9aa;font-size:12px;font-weight:600}.header-nav a{text-decoration:none;transition:color .2s}.header-nav a:hover,.footer a:hover{color:var(--accent)}.header-pill{margin-left:auto;font-size:9px;letter-spacing:.12em;font-weight:700;color:#c6d2b4;border:1px solid #41493b;border-radius:99px;padding:9px 13px;white-space:nowrap}.status-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#bee28b;box-shadow:0 0 9px #bce582;margin-right:7px;vertical-align:middle}.hero{text-align:center;padding-top:105px;padding-bottom:81px}.eyebrow{font-size:10px;letter-spacing:.17em;font-weight:750;color:#a7b995}.sparkle{font-size:15px;color:var(--accent);vertical-align:middle;margin-right:5px}.hero h1{font-size:clamp(48px,7.2vw,83px);line-height:1.03;letter-spacing:-.065em;font-weight:650;margin:25px 0}.hero h1 em,.section-heading h2 em{font-style:normal;color:var(--accent)}.hero-copy{font-size:15px;line-height:1.75;color:#a9b0a1;max-width:420px;margin:0 auto 43px}.tool-card{background:linear-gradient(150deg,#20241d,#191c17);border:1px solid #3b4235;border-radius:18px;text-align:left;box-shadow:0 22px 80px #0005;max-width:682px;margin:auto;padding:27px}.tool-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}.tool-label{font-size:9px;letter-spacing:.14em;font-weight:800;color:#aabe99}.tool-top h2{font-size:19px;letter-spacing:-.03em;margin:7px 0 0;font-weight:650}.step-indicator{font-size:10px;letter-spacing:.1em;color:#747f6c}label{display:block;color:#d7dacd;font-size:11px;font-weight:700;margin-bottom:10px}.input-row{display:flex;align-items:center;gap:8px;padding:6px;background:#11140f;border:1px solid #3b4236;border-radius:11px;transition:border-color .2s}.input-row:focus-within{border-color:#b4d88a;box-shadow:0 0 0 3px #c0e49618}.link-icon{padding-left:11px;color:#9fad98;font-size:20px}input{flex:1;min-width:0;outline:none;border:0;background:transparent;color:var(--text);font:inherit;font-size:13px;padding:11px 3px}input::placeholder{color:#737a6c}button{font-family:inherit}.input-row button,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:20px;border:0;border-radius:8px;padding:15px 18px;background:var(--accent);color:#182014;font-size:12px;font-weight:750;text-decoration:none;white-space:nowrap;cursor:pointer;transition:background .2s,transform .2s}.input-row button:hover,.primary-action:hover{background:#e7f8c3;transform:translateY(-1px)}button:disabled{opacity:.65;cursor:wait}.form-note{display:flex;justify-content:space-between;gap:12px;color:#838e7b;font-size:10px;margin-top:13px}.form-note span span{color:#b9d59d;margin-right:4px}.message{font-size:13px;line-height:1.5;color:#efb4a7}.message:not(:empty){margin-top:18px}.message[data-kind=success]{color:var(--accent)}.result{display:flex;gap:21px;margin-top:23px;padding-top:22px;border-top:1px solid #3b4235}.result[hidden],.result-image[hidden]{display:none}.result-image{width:130px;min-width:130px;height:160px;border-radius:10px;overflow:hidden;background:#10120f}.result-image img{display:block;width:100%;height:100%;object-fit:cover}.result-body{min-width:0}.result-kicker{font-size:9px;letter-spacing:.12em;font-weight:800;color:#bfdb9e}.result h3{font-size:19px;letter-spacing:-.03em;margin:9px 0}.caption{color:#b9c0b1;font-size:12px;line-height:1.6;white-space:pre-wrap;max-height:85px;overflow:auto}.result-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:15px}.primary-action{padding:12px 15px;gap:25px}.copy-action{border:1px solid #59654f;border-radius:8px;background:transparent;color:#e6ecdd;font-size:12px;font-weight:700;padding:11px 14px;cursor:pointer}.copy-action:hover{border-color:var(--accent);color:var(--accent)}.download-note{color:#8e9987;font-size:10px;line-height:1.6;margin:13px 0 0}.hero-footnote{display:flex;align-items:center;justify-content:center;gap:11px;margin-top:31px;color:#7d8b72;font-weight:700;font-size:9px;letter-spacing:.13em}.footnote-line{width:25px;height:1px;background:#505b49}.how-section{border-top:1px solid #2c3228;background:#171a15;padding:78px 0 85px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:25px}.section-heading h2{font-size:clamp(30px,4vw,44px);letter-spacing:-.05em;font-weight:650;margin:12px 0 0}.section-heading>p{font-size:12px;line-height:1.7;color:#929b8d;margin:0}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:35px}.steps article{border:1px solid #343a2f;border-radius:12px;background:#1b1e19;padding:22px 23px 25px}.step-top{display:flex;justify-content:space-between;align-items:start;color:#7d8877;font-size:10px;letter-spacing:.1em}.step-icon{display:grid;place-items:center;width:37px;height:37px;background:#2b3425;border:1px solid #3c4b32;border-radius:10px;color:var(--accent);font-size:20px}.steps h3{font-size:14px;margin:23px 0 9px}.steps p{font-size:12px;line-height:1.7;color:#949d8e;margin:0;max-width:230px}.footer{display:flex;justify-content:space-between;gap:25px;align-items:center;padding-top:38px;padding-bottom:40px}.footer-brand .brand{font-size:21px}.footer-brand .brand-mark{width:29px;height:29px;font-size:19px}.footer p{font-size:11px;color:#828b7d;margin:9px 0 0}.footer-right{text-align:right}.footer-right a{text-decoration:none;color:#ccd9bf}.footer a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:700px){.wrap{width:calc(100% - 40px)}.header{height:75px;gap:15px}.header-nav{margin-left:auto;gap:15px}.header-nav a:first-child{display:none}.header-pill{display:none}.hero{padding:78px 0 65px}.hero h1{font-size:clamp(45px,10vw,64px)}.hero-copy{font-size:14px}.tool-card{padding:20px}.input-row{flex-wrap:wrap}.input-row input{height:45px}.input-row button{width:100%;justify-content:space-between}.form-note{font-size:9px}.hero-footnote{font-size:8px;letter-spacing:.09em}.footnote-line{width:14px}.section-heading{display:block}.section-heading>p{margin-top:15px}.steps{grid-template-columns:1fr;gap:11px}.steps article{padding:19px}.steps h3{margin-top:15px}.how-section{padding:60px 0}.footer{align-items:flex-start;flex-direction:column}.footer-right{text-align:left}.result-image{width:92px;min-width:92px;height:130px}.result{gap:14px}.result-actions>*{width:100%}.copy-action{padding:12px}}@media(max-width:380px){.result{flex-direction:column}.result-image{width:100%;height:180px}.form-note span:last-child{display:none}}

/* Link and direct-URL presentation */
.header-nav a{display:inline-flex;align-items:center;gap:5px;border-radius:7px;padding:8px 3px;text-underline-offset:4px}.header-nav a:hover{text-decoration:underline}.header-nav a:last-child{border:1px solid #454f3e;padding:8px 12px;background:#1b2019;color:#d9e5ce}.header-nav a:last-child:hover{border-color:#b8d797;text-decoration:none}.footer-right a{color:#d8efab;text-decoration:underline;text-decoration-color:#6c8660;text-underline-offset:4px;overflow-wrap:anywhere}.caption{overflow-wrap:anywhere;word-break:break-word}.result-body{width:100%}.result-actions{margin-bottom:16px}.direct-label{margin:0 0 7px;color:#aeb9a7;font-size:10px;letter-spacing:.02em}.direct-link-field{display:flex;align-items:center;gap:0;min-width:0;max-width:100%;border:1px solid #4b5644;border-radius:9px;background:#12160f;overflow:hidden}.direct-link-field:focus-within{border-color:#b4d88a;box-shadow:0 0 0 3px #c0e49618}.direct-link-field input{width:0;min-width:0;flex:1;font-size:11px;color:#c9d7bd;padding:12px;text-overflow:ellipsis}.direct-link-field .copy-action{flex:none;border:0;border-left:1px solid #4b5644;border-radius:0;background:#262e22;color:#e8f0df;padding:12px 14px}.direct-link-field .copy-action:hover{background:#36432c;color:#effddc}@media(max-width:700px){.result-actions .primary-action{width:100%}.direct-link-field .copy-action{width:auto}}

/* Center the stacked footer on phones. */
@media(max-width:700px){.footer{align-items:center;text-align:center}.footer-right{text-align:center}.footer-brand .brand{justify-content:center}}
/* Useful, readable content for visitors and search engines. */
.about-section{border-top:1px solid #2c3228;padding:82px 0 88px}.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:70px}.about-copy h2{font-size:clamp(29px,3.6vw,41px);letter-spacing:-.05em;line-height:1.15;font-weight:650;margin:14px 0 21px}.about-copy h2 em{font-style:normal;color:var(--accent)}.about-copy p,.faq p{color:#9ba595;font-size:13px;line-height:1.75;margin:0 0 14px}.faq details{border-bottom:1px solid #343b30}.faq details:first-child{border-top:1px solid #343b30}.faq summary{position:relative;list-style:none;cursor:pointer;padding:20px 28px 20px 0;font-size:13px;font-weight:650;line-height:1.5;color:#e9eee3}.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:'+';position:absolute;right:2px;top:17px;color:var(--accent);font-size:20px;font-weight:400}.faq details[open] summary::after{content:'−'}.faq p{padding-right:20px}.faq summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:700px){.about-section{padding:60px 0}.about-grid{grid-template-columns:1fr;gap:25px}.about-copy h2{font-size:31px}}

````

## `public/app.js`

````js
// Leave empty for a combined Worker deployment; for Pages set the full Worker origin.
const WORKER_URL = '';
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
const download = document.querySelector('#download');
const copy = document.querySelector('#copy');
const directInput = document.querySelector('#direct-url');
const urlInput = document.querySelector('#url');
let directUrl = '';

function isAllowedCdnUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['cdninstagram.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  result.hidden = true;
  directUrl = '';
  directInput.value = '';
  message.textContent = '';
  message.dataset.kind = '';
  submit.disabled = true;
  submit.firstElementChild.textContent = 'Finding your media…';
  try {
    if (!WORKER_URL && window.location.hostname.endsWith('.github.io')) {
      throw new Error('The Cloudflare Worker URL is not configured yet. Set WORKER_URL in public/app.js and redeploy.');
    }
    const response = await fetch(`${WORKER_URL}/api/scrape`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: urlInput.value.trim()})
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to find media. Please try again.');
    const mediaUrl = data.mediaUrl || data.videoUrl;
    if (!isAllowedCdnUrl(mediaUrl)) throw new Error('The returned link was not a supported Instagram CDN URL.');
    const mediaType = data.mediaType === 'photo' ? 'photo' : 'video';
    directUrl = mediaUrl;
    document.querySelector('#result-title').textContent = `Your ${mediaType} is ready.`;
    download.firstChild.textContent = `Open direct ${mediaType} `;
    download.href = directUrl; // Direct to Instagram's CDN; the Worker does not proxy video bytes.
    directInput.value = directUrl;
    const imageWrap = document.querySelector('#image-wrap');
    const image = document.querySelector('#thumbnail');
    imageWrap.hidden = !isAllowedCdnUrl(data.thumbnailUrl);
    if (!imageWrap.hidden) image.src = data.thumbnailUrl;
    document.querySelector('#caption').textContent = data.caption || 'Your direct media link is ready to open or copy.';
    result.hidden = false;
  } catch (error) { message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { submit.disabled = false; submit.firstElementChild.textContent = 'Get media link'; }
});

copy.addEventListener('click', async () => {
  if (!directUrl) return;
  try {
    await navigator.clipboard.writeText(directUrl);
    copy.textContent = 'Copied!';
    setTimeout(() => { copy.textContent = 'Copy'; }, 2500);
  } catch {
    directInput.focus();
    directInput.select();
    message.dataset.kind = '';
    message.textContent = 'Link selected. Use your device’s copy command to copy it.';
  }
});

// A paste outside an editable field puts a valid Instagram post URL in the one input.
// Never intercept paste into another editable control or auto-submit a request.
document.addEventListener('paste', (event) => {
  if (event.defaultPrevented) return;
  const active = document.activeElement;
  if (active && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))) return;
  const text = event.clipboardData?.getData('text/plain')?.trim();
  if (!text || text.length > 2048) return;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase()) ||
        !/^\/(p|reel|tv)\/[A-Za-z0-9_-]{1,32}\/?$/.test(url.pathname)) return;
    event.preventDefault();
    urlInput.value = text;
    urlInput.focus();
  } catch { /* unrelated text is left alone */ }
});

````

## `public/icon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="0" y="0" width="512" height="512" rx="155" fill="#d8efab"/>
  <path d="M158 155 L349 346 M349 216 V346 H219" fill="none" stroke="#182014" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

````

## `public/site.webmanifest`

````json
{
  "name": "dlsta — Instagram Photo, Reel & Video Downloader",
  "short_name": "dlsta",
  "description": "Find direct links to public Instagram photos, Reels and videos.",
  "start_url": "./",
  "scope": "./",
  "display": "browser",
  "background_color": "#10120f",
  "theme_color": "#10120f",
  "icons": [
    {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}

````

## `public/sitemap.xml`

````xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mahimmazidul.github.io/dlsta/</loc>
  </url>
</urlset>

````

## `public/robots.txt`

````text
User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://mahimmazidul.github.io/dlsta/sitemap.xml

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

## `package.json`

````json
{
  "name": "dlsta",
  "version": "1.0.0",
  "private": true,
  "description": "dlsta: direct links for public Instagram photos, reels, and videos with a Cloudflare Workers API.",
  "type": "module",
  "author": {
    "name": "Md. Mazidul Islam Mahim",
    "url": "https://github.com/mahimmazidul"
  },
  "homepage": "https://github.com/mahimmazidul/dlsta#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mahimmazidul/dlsta.git"
  },
  "bugs": {
    "url": "https://github.com/mahimmazidul/dlsta/issues"
  },
  "keywords": [
    "instagram",
    "instagram-downloader",
    "instagram-reels",
    "instagram-photos",
    "video-downloader",
    "cloudflare-workers",
    "javascript"
  ],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test": "node --test test/*.test.js",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.156.0"
  },
  "license": "Apache-2.0"
}

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
# dlsta — Instagram photo, reel & video downloader

A small Cloudflare Worker + static UI for resolving **public** Instagram photos, reels and videos. The resolver uses official oEmbed only if an app token is configured, then public HTML, then unauthenticated Instagram web GraphQL with an ephemeral anonymous CSRF cookie. No Instagram account login, paid APIs, subprocesses, or Node APIs are used by the Worker.

## What it does

- Resolves supported **public** Instagram photo, video and reel links without requiring an Instagram login. For carousels, only one item is returned; full-album downloading is not supported.
- Shows the caption and thumbnail when available, plus a direct, selectable media URL and copy button.
- Opens the photo or video from Instagram's CDN; Cloudflare does **not** stream or proxy the media file. On desktop, paste a supported Instagram URL anywhere outside another editable field to fill the link box.
- Runs as a single Cloudflare Worker with static assets, or with the frontend hosted separately on GitHub Pages or Cloudflare Pages.

**Availability is not guaranteed.** Instagram can change or block these unofficial public endpoints, require login, remove videos, or return ambiguous responses. oEmbed generally returns embed metadata, not a downloadable video; it is not GraphQL and usually needs a Meta app access token. Public HTML often lacks direct media URLs. GraphQL document IDs can change. Private content is not supported. Only download material you have permission to use; follow the relevant platform terms and copyright laws.

## Deploy using the Cloudflare button

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mahimmazidul/dlsta)

1. Create or sign in to your Cloudflare account and sign in to GitHub.
2. Open **[Deploy dlsta to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/mahimmazidul/dlsta)**. Connect GitHub and authorize the requested access when prompted.
3. Select the Cloudflare account and follow the prompts to create a repository and configure the Worker. The button typically creates a new repository under your GitHub account; future builds track that new repository, not necessarily this one.
4. Confirm the `RATE_LIMIT` KV namespace is provisioned and bound. If the UI cannot provision it, use the manual KV instructions below. Choose a distinct Worker name if the suggested name conflicts with an existing Worker.
5. Deploy and wait for the build to finish. Open the provided `https://<worker>.<account>.workers.dev` URL: the Worker serves both the frontend and `/api/scrape`, so no separate frontend configuration is needed there.
6. Paste a public post or reel URL, choose **Get media link**, and open or copy the direct CDN link. Use your browser’s save option if the media opens in a tab.
7. If you instead use the separately hosted GitHub Pages frontend, set `WORKER_URL` in `public/app.js` to your deployed HTTPS Worker origin and redeploy Pages, as described below. GitHub Pages cannot run the Worker.

The configured Worker service name in `wrangler.toml` is `insta-dl` for deployment compatibility. The app, repository and npm package are named **dlsta**. Changing the service name may create a new Worker or URL; update any separate frontend accordingly.

### Manual deployment (Node.js 22+)

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

- `POST /api/scrape` with JSON `{ "url": "https://www.instagram.com/reel/.../" }`, or GET with `?url=...`. Returns `{success, mediaType, mediaUrl, thumbnailUrl, caption}` on success, plus `videoUrl` or `photoUrl` for the matching media type. `mediaType` is `video` or `photo`; empty `thumbnailUrl` and `caption` mean unavailable.
- The response contains a direct Instagram CDN photo or video URL. Open or copy it from the UI; media bytes are delivered by Instagram, not proxied through this Worker. Signed CDN URLs expire and may be restricted. Some browsers play the video rather than forcing a download; use the browser’s save or download option.
- Errors return JSON without stack traces. Bad input is 400; 404 means upstream indicated unavailability, not proof of deletion; ambiguous upstream failures return 502.

The rate limiter targets **10 API requests per IP per fixed minute**, storing short-lived hashed-IP keys in KV; the Worker fails closed if the binding is missing. KV reads are eventually consistent and list/put is not atomic: concurrent or cross-region requests can exceed the target. KV is not a strict security boundary and incurs usage costs. Use a Durable Object or Cloudflare's rate-limiting product if a hard global limit is required. Set Cloudflare WAF/rate-limit rules for abuse protection, including asset routes. In local development, all clients without `CF-Connecting-IP` share one bucket.

## Cloudflare Free plan usage

Cloudflare's Free plan currently includes 100,000 Worker requests per day and 10 ms CPU per invocation. KV includes 1,000 writes and 1,000 list requests per day, shared across the account. The API's rate limiter normally makes one list and one write for each request it allows. A successful media lookup normally makes one API request; the direct CDN download makes none. In ideal conditions the KV quotas allow roughly **1,000 successful lookups per day** if nothing else uses the quota. Invalid requests, retries, rate-limited traffic, and other applications reduce that number. The exact result is not guaranteed; Instagram availability and the CPU limit also matter.

Once a KV operation quota is exhausted, the API can return errors until the quotas reset at 00:00 UTC. Static asset requests served directly by Workers are free and unlimited; a separate GitHub Pages frontend does not consume Cloudflare Worker requests for page views, but its API calls still do. On a paid plan, usage beyond included allowances can incur charges. Check the current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), and your dashboard usage before relying on these figures.

## Search visibility and branding

The default canonical address, social previews, structured data and sitemap use `https://mahimmazidul.github.io/dlsta/`. The existing dlsta mark is provided as an SVG, PNG favicons, an Apple touch icon and web manifest icons; `public/images/social-card.png` is the 1200×630 social preview. API responses send `X-Robots-Tag: noindex, nofollow`.

Before promoting the GitHub Pages URL, deploy the Worker and set `WORKER_URL` as described above; otherwise the page loads but media lookups cannot work. Search metadata cannot replace a working backend.

1. Deploy the site, then add the URL-prefix property `https://mahimmazidul.github.io/dlsta/` to [Google Search Console](https://search.google.com/search-console/). Verify ownership using an available method, such as adding the supplied HTML verification file to `public/` and redeploying.
2. Submit `https://mahimmazidul.github.io/dlsta/sitemap.xml` in Search Console and optionally request indexing of the homepage with URL Inspection. Crawling and indexing are not guaranteed and may take time.
3. The site is in a GitHub Pages **subdirectory**. Search crawlers read `robots.txt` at the **hostname root**, not `dlsta/robots.txt`; the included file applies when the site is hosted at a domain root, such as a Worker/custom domain. Submit the sitemap directly for the GitHub Pages subdirectory. Google generally chooses one search favicon per hostname, so it may not display this project's icon independently for a subdirectory.
4. If deploying a fork or a different canonical domain, replace the absolute canonical, Open Graph, Twitter and JSON-LD URLs in `public/index.html`, the `<loc>` in `public/sitemap.xml`, and the sitemap URL in `public/robots.txt`. Update the SEO test's canonical URL to match. A duplicate Worker deployment currently points search engines at the GitHub Pages URL intentionally; change these values if the Worker/custom domain should be the primary site.

## License and credit

[Apache License 2.0](LICENSE). Copyright 2026 Md. Mazidul Islam Mahim. See [NOTICE](NOTICE) for attribution. dlsta is not affiliated with Instagram or Meta.

## Verification

See `RESEARCH.md` for the repository audit, test results, limitations, and attribution. `test/live-results.json` contains time-sensitive raw responses from the initial comparative tests; signed URLs in those responses will expire. Run `npm test` for offline unit tests. Test results are snapshots, not guarantees of future Instagram behavior.

````
