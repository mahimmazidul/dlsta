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

The nonexistent shortcode was not independently confirmed to be a previously existing deleted post; **no verified private or deleted post was supplied, so those cases were not tested**. Error bodies in these observed tests were messages rather than stack traces; David and TTTT55 can nevertheless expose unexpected error messages on some paths. The current Worker returns direct Instagram CDN links and no longer has a media proxy. The new Worker deliberately distinguishes confirmed invalid input from ambiguous upstream failure and cannot always distinguish private, deleted, restricted, blocked or markup-changed posts. The initial Node unit tests passed, including host spoofing, 10-request behavior in a deterministic KV mock, and removal of the proxy endpoint; the mock does not prove a global KV limit. Local tests do not establish behavior from Cloudflare's production network.

# Phase 3 — Merge plan

- **BRAIN:** TTTT55, reference only: independent implementation of public GraphQL and HTML fallback, no source copied because no license file was found.
- **STRUCTURE:** Alim, reference only: KV and CDN/redirect safety principles, independently implemented. Alim's external provider was not adopted.
- **UI:** original vanilla UI, since Alaa's repo contains no UI source to merge.
- **REFERENCE:** David's API was investigated but not integrated due to external providers and proxy risk.

```text
dlsta/
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

The current version adds direct links for public photos as well as videos. A NASA photo (`https://www.instagram.com/p/9w42bQoaI1/`) and reel (`https://www.instagram.com/reel/Dbn-XJhk0_-/`) were tested locally: both resolved to allowlisted HTTPS CDN URLs and those URLs returned HTTP 200 to HEAD at the time of testing. Links expire, and upstream or production network behavior may differ. At that earlier point only one carousel item was returned; the later carousel update adds individual links for available items.

Responsive layouts were checked in headless Chromium at widths 320, 375, 700, 768, 1024 and 1440 px, including long captions and the result panel. The mobile footer was centered and the paste handler was exercised. The audit also added bounded request/upstream reads and a 503 response when KV fails. The configured Cloudflare Worker service name was subsequently changed from `insta-dl` to `dlsta`; see the later host-aware deployment update and README for migration details. See the README for one-click deployment instructions and the KV consistency limitations.


A subsequent SEO and branding update introduced the project icon, social preview, canonical URL, sitemap, crawler guidance, and structured data. The static default canonical site is the owner's GitHub Pages subdirectory; separate static deployments must update the absolute URLs as described in the README. Combined Worker deployments generate URLs from the active host. GitHub Pages still requires a configured Worker URL for lookups.


The combined Worker configuration now defaults to the service name `dlsta` and generates server-rendered canonical, social-image, structured-data, sitemap and robots URLs from the request host. The separately hosted GitHub Pages copy retains its static default URLs. HTML and crawler-file requests invoke the Worker and count toward Worker usage; media downloads remain direct from Instagram.


Cloudflare Workers Builds can override the configured name with the connected dashboard Worker name; changing the configuration does not rename the existing service. The source repository, any Deploy-button-created copy, and the deployed Cloudflare configuration should be checked separately.


A GitHub Actions deployment workflow now tests and deploys the configured `dlsta` Worker using repository secrets for the Cloudflare API token and account ID. This is distinct from Cloudflare Workers Builds and from the separate GitHub Pages static-site workflow. The actual Cloudflare deployment requires user-supplied credentials and must be verified from the GitHub Actions logs.


Lookup failures now produce a sanitized stage/status diagnostic in Worker logs to help distinguish regional upstream failures. It contains no post URLs, tokens, cookies, captions, response bodies or media links. A real failure from the affected Cloudflare region is still needed to determine its cause.


A later regional failure returned HTTP 200 for the embed, page, homepage and GraphQL, but GraphQL contained no item. The resolver now parses matching structured `contextJSON` media from public embeds before GraphQL, with safe photo/video checks; a subsequent update added all available carousel items. Local tests on the reported post and a public reel returned photo and video CDN URLs whose HEAD requests were HTTP 200; results in the affected Cloudflare region still require an on-site test.


Carousel support now returns and displays each available item individually and marks missing items; no Cloudflare media proxy is used. For the reported three-photo post, local Worker tests retrieved all three media URLs, and each downloaded image measured 1440 × 1440 pixels. A public reel URL returned HTTP 200 to HEAD. The resolver chooses the largest dimensions among exposed image/video renditions, but a single supplied video URL or original upload quality cannot be independently guaranteed. Browser interaction was tested at 320, 375, 768 and 1440 CSS pixels.


The interface now offers a user-initiated paste-and-lookup action with manual-paste fallback and a more compact mobile layout. Reel extraction also tries the alternative public /p/ embed if the /reel/ embed contains no usable media; failure diagnostics now identify broad embed parsing categories without logging the post, media, cookies or tokens. Three representative public reels returned video links with HTTP 200 CDN HEAD responses from the local test environment. The reel reported in the user log was not supplied, so its exact failure and DAC behavior remain unverified.


The frontend was subsequently redesigned as a more spacious, flat layout without boxed tool or step cards, while retaining the original mark, direct-CDN delivery, carousel selection and user-initiated paste. Browser tests covered widths 320, 375, 768 and 1440 pixels and verified clipboard lookup, carousel selection and no horizontal overflow.

A Dhaka-region failure showed HTTP 200 from the embed/page/home/GraphQL but no parseable context or post item. Additional fallbacks now check the alternate public post/reel embed, the non-captioned embed, and bounded JSON scripts with an exact matching shortcode. Null context is diagnosed separately. All five user-supplied URLs resolved in local tests; the new behavior has not yet been verified from Dhaka, and may not work if Instagram omits media across all public responses.

The Dhaka production trace subsequently confirmed null `contextJSON` in all three public embeds, no page context and no GraphQL item, despite HTTP 200 responses. A temporary, access-controlled Cloudflare test Worker using this resolver was placed near AWS `us-east-1`; its outgoing Cloudflare trace reported IAD and all five supplied sample URLs resolved (two photo carousels with 10 and 3 items, and three videos). The test Worker was deleted afterward. Production configuration now requests the same region as a best-effort mitigation; this may increase latency, Cloudflare can change placement, and success from Dhaka has not yet been verified. Direct media downloads do not go through the Worker. The interface now omits horizontal dividers; Chromium tests at 320, 375, 768 and 1440 pixels found no horizontal overflow and confirmed FAQ toggling.

A subsequent interface polish adds self-hosted, separately licensed DM Sans and Instrument Serif, styled paste and direct-link fields, an announced loading state, subtle motion and reduced-motion support while keeping the overall layout free of section cards and dividers. Chromium tests at 320, 375, 768 and 1440 pixels verified one-tap paste, a single API request, the loading state, carousel selection, copying, FAQ interaction, font loading and no horizontal overflow. A live CDN inspection of a 10-item photo carousel returned 1440 × 1921 WebP for each item; three example reels returned 720 × 1280 H.264. These are measured returned files, not claims about original quality or unavailable renditions.

The interface now supports device-aware light and dark modes with a locally saved manual choice, a vertically stacked media result on mobile, font credits, a shorter HTML/social title, and an indeterminate loader with rotating tips and reduced-motion support. The repeated “no login needed” page copy was removed. Offline tests cover the theme preference, blocked storage, loader state and timer cleanup; browser checks exercised both modes and widths 320, 375, 430, 768 and 1440 pixels.

The result preview is centered above the result details on mobile and desktop. After a successful lookup or an invalid Instagram URL, the input resets to the one-tap paste state; unsupported inputs are rejected before the API request, while other failures retain the link for retry. Input entered during a pending lookup is preserved. Mocked Chromium interaction tests covered dark/light modes and widths 320, 375, 430, 768 and 1440, including two successive lookups, carousel selection, link copying and horizontal overflow.

The preview now supports previous/next buttons, touch swipes, focused keyboard arrows, a position counter and the existing thumbnail selectors. Navigation skips unavailable items, and a placeholder retains controls when a thumbnail is missing. Tests cover both themes, mobile/desktop sizes, vertical scrolling gestures, unavailable media, keyboard use, and direct-link synchronization. The live project website is `https://d.byaislop.cv/`. Repository topics were reviewed against [GitHub Instagram downloader topics](https://github.com/topics/instagram-downloader), [photo downloader topics](https://github.com/topics/instagram-photo-downloader), and [Instagram carousel topics](https://github.com/topics/instagram-carousel) to emphasize the actual public-media and carousel capabilities.

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
      const result = await scrapeInstagram(raw, {
        oembedToken: env.INSTAGRAM_OEMBED_TOKEN,
        onDiagnostic: stages => console.warn('Instagram lookup failed:', JSON.stringify(stages))
      });
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
  const match = u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{1,32})\/?$/);
  if (!match) throw new Error('INVALID_URL');
  return `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/`;
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
// Prefer the largest explicitly sized allowlisted rendition, not array order.
function bestVariant(variants) {
  if (!Array.isArray(variants)) return '';
  const valid = variants.filter(v => validMediaUrl(v?.url || v?.src));
  valid.sort((a, b) => {
    const area = v => (Number(v.width ?? v.config_width) || 0) * (Number(v.height ?? v.config_height) || 0);
    return area(b) - area(a) || (Number(b.bitrate || b.bandwidth) || 0) - (Number(a.bitrate || a.bandwidth) || 0);
  });
  return valid[0]?.url || valid[0]?.src || '';
}
function structuredMedia(root) {
  const edges = root?.edge_sidecar_to_children?.edges;
  const carousel = Array.isArray(root?.carousel_media) || Array.isArray(edges) || root?.__typename === 'GraphSidecar';
  const nodes = Array.isArray(root?.carousel_media) ? root.carousel_media : Array.isArray(edges) ? edges.map(e => e?.node) : carousel ? [] : [root];
  if (!nodes.length) return null;
  const reported = Number(root?.carousel_media_count ?? root?.edge_sidecar_to_children?.count) || 0;
  const totalItems = Math.max(nodes.length, reported);
  const hasMore = root?.edge_sidecar_to_children?.page_info?.has_next_page === true;
  const items = nodes.slice(0, 50).map((item, index) => {
    const isVideo = item?.media_type === 2 || item?.is_video === true || item?.__typename === 'GraphVideo';
    const isPhoto = item?.media_type === 1 || item?.is_video === false || item?.__typename === 'GraphImage';
    const image = bestVariant([...(Array.isArray(item?.image_versions2?.candidates) ? item.image_versions2.candidates : []), ...(Array.isArray(item?.display_resources) ? item.display_resources : [])]) || (validMediaUrl(item?.display_url) ? item.display_url : '');
    const video = bestVariant(item?.video_versions) || (validMediaUrl(item?.video_url) ? item.video_url : '');
    const mediaType = isVideo ? 'video' : isPhoto ? 'photo' : 'unknown';
    const mediaUrl = isVideo ? video : isPhoto ? image : '';
    if (!mediaUrl) return {position:index + 1, mediaType, available:false};
    return {position:index + 1, mediaType, mediaUrl, thumbnailUrl:image, available:true};
  });
  const first = items.find(item => item.available);
  if (!first) return null;
  const text = root?.caption?.text || root?.edge_media_to_caption?.edges?.[0]?.node?.text;
  const caption = typeof text === 'string' ? text.slice(0, 2000) : '';
  const result = {mediaType:first.mediaType, mediaUrl:first.mediaUrl, [first.mediaType === 'photo' ? 'photoUrl' : 'videoUrl']:first.mediaUrl, thumbnailUrl:first.thumbnailUrl, caption};
  if (carousel) Object.assign(result, {items, totalItems, partial:hasMore || items.length < totalItems || items.some(item => !item.available)});
  return result;
}

// Public embeds include a JSON-encoded contextJSON string; verify the shortcode.
export function parseEmbedMedia(html, shortcode, onInspect) {
  let detail = /"contextJSON"\s*:\s*null/.test(html) ? 'context_null' : 'no_context';
  const contexts = html.matchAll(/"contextJSON"\s*:\s*("(?:\\.|[^"\\])*")/g);
  for (const match of contexts) {
    detail = 'invalid_context';
    try {
      const data = JSON.parse(JSON.parse(match[1]));
      const root = data?.gql_data?.shortcode_media || data?.graphql?.shortcode_media || data?.context?.media;
      if (!root) { detail = 'no_media_object'; continue; }
      if (root.shortcode !== shortcode || (data.context?.shortcode && data.context.shortcode !== shortcode)) { detail = 'shortcode_mismatch'; continue; }
      const hasVideo = root.media_type === 2 || root.is_video === true || root.__typename === 'GraphVideo';
      detail = hasVideo && !root.video_url && !root.video_versions?.length ? 'video_url_missing' : 'media_unavailable';
      const result = structuredMedia(root);
      if (result) return result;
    } catch { /* malformed or unrelated embed context: try another */ }
  }
  try { onInspect?.(detail); } catch { /* diagnostics are optional */ }
  return null;
}

// Some public pages contain structured post data in application/json scripts
// instead of contextJSON. Search only bounded JSON objects and require the exact
// target shortcode before accepting any media URL.
export function parsePublicJsonMedia(html, shortcode) {
  if (!html.includes('"shortcode"') || !/("video_url"|"video_versions"|"display_url"|"image_versions2")/.test(html)) return null;
  const scripts = html.matchAll(/<script\b(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/gi);
  let examined = 0, count = 0;
  for (const script of scripts) {
    if (++count > 40) break;
    let data;
    try { data = JSON.parse(script[1]); } catch { continue; }
    const queue = [data];
    while (queue.length && examined++ < 5000) {
      const value = queue.pop();
      if (!value || typeof value !== 'object') continue;
      if (value.shortcode === shortcode) {
        const result = structuredMedia(value);
        if (result) return result;
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') queue.push(child);
    }
    if (examined >= 5000) break;
  }
  return null;
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
  // Only fixed stage names, HTTP statuses and categories; never log URLs, tokens or content.
  const diagnostic = {};
  const failureKind = error => error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'request_or_parse_error';
  // Official oEmbed is not GraphQL and generally requires an app access token;
  // it normally returns embed metadata, not a direct video URL.
  if (options.oembedToken) {
    try {
      const endpoint = new URL('https://graph.facebook.com/v24.0/instagram_oembed');
      endpoint.searchParams.set('url', url);
      endpoint.searchParams.set('access_token', options.oembedToken);
      const result = await upstream(endpoint.toString(), 'application/json');
      diagnostic.oembed = result.status;
      if (result.status === 200) {
        const data = JSON.parse(result.body);
        thumbnailUrl = validMediaUrl(data.thumbnail_url) ? data.thumbnail_url : '';
        caption = typeof data.title === 'string' ? data.title.slice(0, 2000) : '';
        if (validMediaUrl(data.video_url)) return {mediaType: 'video', mediaUrl: data.video_url, videoUrl: data.video_url, thumbnailUrl, caption};
      }
    } catch (error) { diagnostic.oembed = failureKind(error); }
  }
  const candidates = [['embed', url + 'embed/captioned/']];
  // Instagram accepts both public /reel/ and /p/ embeds for many reels.
  // Try the other form only when the first representation did not provide media.
  if (url.includes('/reel/')) candidates.push(['alternateEmbed', url.replace('/reel/', '/p/') + 'embed/captioned/']);
  else if (url.includes('/p/')) candidates.push(['alternateEmbed', url.replace('/p/', '/reel/') + 'embed/captioned/']);
  candidates.push(['plainEmbed', url + 'embed/']);
  candidates.push(['page', url]);
  for (const [stage, candidate] of candidates) {
    try {
      const result = await upstream(candidate);
      diagnostic[stage] = result.status;
      if (result.status === 404) { saw404 = true; continue; }
      if (result.status !== 200) continue;
      const html = result.body;
      diagnostic[`${stage}Context`] = html.includes('\"contextJSON\"') ? 'present' : 'absent';
      const embedded = parseEmbedMedia(html, url.split('/')[4], detail => { diagnostic[`${stage}Detail`] = detail; });
      if (embedded) return embedded;
      const jsonMedia = parsePublicJsonMedia(html, url.split('/')[4]);
      if (jsonMedia) return jsonMedia;
      const videoUrl = meta(html, 'og:video:secure_url') || meta(html, 'og:video') || field(html, 'video_url');
      const image = meta(html, 'og:image') || field(html, 'display_url');
      if (validMediaUrl(image)) thumbnailUrl = image;
      caption ||= (meta(html, 'og:description') || '').slice(0, 2000);
      if (validMediaUrl(videoUrl)) return {mediaType: 'video', mediaUrl: videoUrl, videoUrl, thumbnailUrl, caption};
    } catch (error) { diagnostic[stage] = failureKind(error); }
  }
  // Unauthenticated web GraphQL is an additional fallback, not oEmbed. Its
  // undocumented doc ID can change; only fresh anonymous CSRF cookies are used (no login).
  let currentStage = 'home';
  try {
    const shortcode = url.split('/')[4];
    const home = await fetch("https://www.instagram.com/", {redirect:"manual", signal:AbortSignal.timeout(3000), headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"}});
    diagnostic.home = home.status;
    const homeText = await readUpstreamText(home);
    const csrf = home.headers.get("set-cookie")?.match(/csrftoken=([^;,\s]+)/)?.[1] || homeText.match(/"csrf_token":"([^"]+)"/)?.[1] || crypto.randomUUID().replaceAll("-", "");
    const body = new URLSearchParams({
      variables: JSON.stringify({shortcode, fetch_tagged_user_count: null, hoisted_comment_id: null, hoisted_reply_id: null, __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false}),
      doc_id: options.docId || '27128499623469141', lsd: 'AVqbxe3J_YA', fb_api_req_friendly_name: 'PolarisPostRootQuery', av:'0', __d:'www', __user:'0', __a:'1', __req:'3', __hs:'20000.HYP:instagram_web_pkg.2.1..0.0', dpr:'1', __ccg:'UNKNOWN', __comet_req:'7', jazoest:'2957', __spin_r:'1000000000', __spin_b:'trunk', fb_api_caller_class:'RelayModern', server_timestamps:'true'
    });
    currentStage = 'graphql';
    const response = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(4500),
      headers: {'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'content-type':'application/x-www-form-urlencoded', 'x-ig-app-id':'936619743392459', 'x-fb-lsd':'AVqbxe3J_YA', 'x-fb-friendly-name':'PolarisPostRootQuery', 'x-requested-with':'XMLHttpRequest', 'accept':'*/*', 'accept-language':'en-US,en;q=0.9', 'sec-fetch-site':'same-origin', 'sec-fetch-mode':'cors', 'sec-fetch-dest':'empty', 'x-asbd-id':'129477', 'x-csrftoken':csrf, 'cookie':`csrftoken=${csrf}; ig_did=${crypto.randomUUID()}; mid=${crypto.randomUUID().replaceAll('-', '')}`, 'origin':'https://www.instagram.com', 'referer':'https://www.instagram.com/'}, body: body.toString()
    });
    diagnostic.graphql = response.status;
    if (response.ok) {
      const data = JSON.parse(await readUpstreamText(response));
      const root = data?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0] || data?.data?.xdt_shortcode_media;
      diagnostic.media = root ? 'no_supported_media' : 'no_item';
      const result = structuredMedia(root);
      if (result) {
        if (!result.caption) result.caption = caption;
        if (!result.thumbnailUrl) result.thumbnailUrl = thumbnailUrl;
        return result;
      }
    }
  } catch (error) { diagnostic[`${currentStage}Error`] = failureKind(error); }
  // Emit only the sanitized stages when the entire lookup fails.
  try { options.onDiagnostic?.(diagnostic); } catch { /* diagnostics must not change the response */ }
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
  <meta name="color-scheme" content="dark light">
  <title>dlsta — Instagram Downloader</title>
  <meta name="description" content="Find direct links to public Instagram photos, Reels and videos with dlsta. Open media from Instagram’s CDN.">
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
  <meta property="og:title" content="dlsta — Instagram Downloader">
  <meta property="og:description" content="Get direct links to public Instagram photos, Reels and videos.">
  <meta property="og:url" content="https://mahimmazidul.github.io/dlsta/">
  <meta property="og:image" content="https://mahimmazidul.github.io/dlsta/images/social-card.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="dlsta: keep the moments worth saving, with direct links for public Instagram photos, Reels and videos.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="dlsta — Instagram Downloader">
  <meta name="twitter:description" content="Get direct links to public Instagram photos, Reels and videos.">
  <meta name="twitter:image" content="https://mahimmazidul.github.io/dlsta/images/social-card.png">
  <meta name="twitter:image:alt" content="dlsta: direct links for public Instagram photos, Reels and videos.">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebApplication","name":"dlsta","url":"https://mahimmazidul.github.io/dlsta/","description":"Find direct links to public Instagram photos, Reels and videos.","applicationCategory":"MultimediaApplication","operatingSystem":"Any","browserRequirements":"Requires JavaScript","image":"https://mahimmazidul.github.io/dlsta/images/social-card.png","author":{"@type":"Person","name":"Md. Mazidul Islam Mahim","url":"https://github.com/mahimmazidul"}}
  </script>
  <script src="theme.js"></script>
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
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Switch theme" title="Switch theme">
        <svg class="theme-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.7"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>
        <svg class="theme-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.6 8.6 0 1 0 20.2 15.4Z"/></svg>
        <span class="theme-label">Light</span>
      </button>
    </header>

    <main>
      <section class="hero wrap" aria-labelledby="hero-title">
        <p class="hero-overline">INSTAGRAM DOWNLOADER</p>
        <h1 id="hero-title">Save photos<br><em>and reels.</em></h1>
        <p class="hero-copy">Paste a public Instagram link to find its media.</p>

        <div class="tool-card">
          <form id="form" novalidate>
            <label for="url">Instagram link</label>
            <div class="input-row">
              <div class="link-entry">
                <span class="link-icon" aria-hidden="true">↗</span>
                <input id="url" name="url" type="url" placeholder="instagram.com/p/…" autocomplete="url" spellcheck="false">
              </div>
              <button id="submit" type="submit"><span>Paste &amp; get link</span><span aria-hidden="true">↗</span></button>
            </div>
          </form>
          <div id="loading" class="loading" role="status" aria-live="polite" hidden>
            <span class="sr-only">Finding your media. This can take a moment.</span>
            <div class="loading-inner" aria-hidden="true">
              <span class="loading-orbit"><span class="loading-orbit-dot"></span><span class="loading-orbit-core">↗</span></span>
              <div class="loading-copy"><strong>Finding your media<span class="loading-dots"><i></i><i></i><i></i></span></strong><span id="loading-hint">Looking for available media.</span></div>
            </div>
            <span class="loading-track" aria-hidden="true"><span></span></span>
          </div>
          <div id="message" class="message" role="status" aria-live="polite"></div>
          <article id="result" class="result" hidden aria-label="Media result">
            <div class="result-image" id="image-wrap" role="group" aria-roledescription="carousel" aria-label="Media preview" tabindex="-1" hidden>
              <img id="thumbnail" alt="Preview of the Instagram post" referrerpolicy="no-referrer">
              <span class="preview-empty" id="preview-empty" hidden>Preview unavailable</span>
              <button type="button" class="preview-nav preview-prev" id="preview-prev" aria-label="Previous available item" hidden><span aria-hidden="true">‹</span></button>
              <button type="button" class="preview-nav preview-next" id="preview-next" aria-label="Next available item" hidden><span aria-hidden="true">›</span></button>
              <span class="preview-counter" id="preview-counter" aria-live="polite" aria-atomic="true" hidden></span>
            </div>
            <div class="result-body">
              <span class="result-kicker"><span class="status-dot"></span> DIRECT LINK READY</span>
              <h3 id="result-title">Your media is ready.</h3>
              <p id="caption" class="caption"></p>
              <div id="media-list" class="media-list" aria-label="Select a carousel item" hidden></div>
              <p id="media-count" class="media-count" role="status" hidden></p>
              <div class="result-actions">
                <button id="save-media" type="button" class="primary-action">Download media <span aria-hidden="true">↓</span></button>
                <button id="save-all" type="button" class="secondary-action" hidden>Download all <span aria-hidden="true">↓</span></button>
                <a id="download" class="secondary-action" target="_blank" rel="noopener noreferrer">Open direct media <span aria-hidden="true">↗</span></a>
              </div>
              <p id="download-status" class="download-status" role="status" aria-live="polite"></p>
              <label class="direct-label" for="direct-url">Direct media link · drag to scroll</label>
              <div class="direct-link-field">
                <input id="direct-url" type="url" readonly spellcheck="false" aria-label="Direct media link" aria-describedby="direct-help">
                <button id="copy" type="button" class="copy-action">Copy</button>
              </div>
              <span id="direct-help" class="sr-only">Drag left or right to scroll the link. You can also focus it and use the arrow keys.</span>
              <p class="download-note">Downloads go directly from Instagram’s CDN without conversion. Links may expire.</p>
            </div>
          </article>
        </div>
      </section>

      <section id="how-it-works" class="how-section">
        <div class="wrap">
          <div class="section-heading"><div><div class="eyebrow">GET STARTED</div><h2>How it works.</h2></div></div>
          <div class="steps">
            <article><div class="step-top">01</div><h3>Copy the link</h3><p>Find a public Instagram reel, video, or photo post and copy its link.</p></article>
            <article><div class="step-top">02</div><h3>Paste it here</h3><p>Paste the link above, or tap Paste &amp; get link.</p></article>
            <article><div class="step-top">03</div><h3>Open the media</h3><p>Open the direct link and save it, with the creator’s permission.</p></article>
          </div>
        </div>
      </section>
      <section class="about-section" aria-labelledby="about-title">
        <div class="wrap about-grid">
          <div class="about-copy">
            <div class="eyebrow">GOOD TO KNOW</div>
            <h2 id="about-title">A few things<br><em>to know.</em></h2>
            <p>dlsta helps you find a direct link to a public Instagram photo, Reel or video. The file comes from Instagram’s CDN—not through our server.</p>
            <p>Only save content you have permission to use.</p>
          </div>
          <div class="faq" aria-label="Frequently asked questions">
            <details><summary>Can I save Instagram photos and Reels?</summary><p>dlsta supports public photo posts, Reels and videos when Instagram makes the media available. For a carousel, select each available photo or video. Some items may be unavailable.</p></details>
            <details><summary>Why won’t a link work?</summary><p>Private, deleted, restricted or temporarily blocked posts can’t be resolved. Instagram can also change how public media is served. Direct links can expire, so try finding the post again.</p></details>
            <details><summary>How do I save the media?</summary><p>Open or copy the direct link. If your browser displays the photo or plays the video, use its save or download option. The file is served by Instagram’s CDN.</p></details>
          </div>
        </div>
      </section>
    </main>
    <footer class="footer wrap"><div class="footer-brand"><a class="brand" href="./"><span class="brand-mark" aria-hidden="true">↘</span><span>dlsta<span class="brand-dot">.</span></span></a><p>For the moments you want to keep.</p><p class="font-credit">Type: <a href="https://github.com/googlefonts/dm-fonts" target="_blank" rel="noopener noreferrer">DM Sans</a> &amp; <a href="https://github.com/Instrument/instrument-serif" target="_blank" rel="noopener noreferrer">Instrument Serif</a></p></div><div class="footer-right"><p>Built by <a href="https://github.com/mahimmazidul" target="_blank" rel="noopener noreferrer">Md. Mazidul Islam Mahim ↗</a></p><p>Not affiliated with Instagram or Meta. · <a href="https://github.com/mahimmazidul/dlsta/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Apache 2.0 license ↗</a></p></div></footer>
  </div>
</body>
</html>
````

## `public/style.css`

````css
@font-face{font-family:'DM Sans';src:url('fonts/dm-sans-latin.woff2') format('woff2');font-style:normal;font-weight:400 700;font-display:swap}
@font-face{font-family:'Instrument Serif';src:url('fonts/instrument-serif-latin.woff2') format('woff2');font-style:normal;font-weight:400;font-display:swap}
@font-face{font-family:'Instrument Serif';src:url('fonts/instrument-serif-italic-latin.woff2') format('woff2');font-style:italic;font-weight:400;font-display:swap}
:root{color-scheme:dark;--bg:#10130f;--ink:#f2f2e9;--muted:#a5ada0;--soft:#879183;--accent:#d5e9ad;--surface:#1c211a;--glow:#242d1d;--field:rgba(238,245,224,.055);--field-hover:rgba(238,245,224,.08);--field-border:rgba(229,241,216,.085);--field-focus:rgba(213,233,173,.55);--field-shadow:rgba(213,233,173,.08);--button:#d5e9ad;--button-hover:#e5f5c6;--button-ink:#1a2116;--heading-label:#a9bb99;--label:#cbd2c5;--nav:#b8c0b4;--icon:#96a489;--choice:#b8c1b1;--result-label:#bbd2a3;--direct:#c2cbbb;--copy-bg:rgba(213,233,173,.1);--error:#efb4a7;--image-bg:#252b22;--serif:'Instrument Serif',Georgia,serif;font-family:'DM Sans',system-ui,-apple-system,sans-serif;font-synthesis:none;scroll-behavior:smooth}
:root[data-theme="light"]{color-scheme:light;--bg:#f7f8f0;--ink:#20281e;--muted:#596656;--soft:#667363;--accent:#48683c;--surface:#edf1e6;--glow:#e8eedc;--field:rgba(52,76,45,.055);--field-hover:rgba(52,76,45,.08);--field-border:rgba(52,76,45,.14);--field-focus:rgba(72,104,60,.6);--field-shadow:rgba(72,104,60,.12);--button:#d5e9ad;--button-hover:#c5df99;--button-ink:#1a2116;--heading-label:#5d7951;--label:#44513f;--nav:#556451;--icon:#62795a;--choice:#5a6855;--result-label:#53714a;--direct:#4d5c47;--copy-bg:rgba(72,104,60,.10);--error:#9e4231;--image-bg:#e3e9dc}

*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse 80% 38% at 88% 0%,var(--glow) 0%,transparent 70%),var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}a{color:inherit}.wrap{width:min(1120px,calc(100% - 80px));margin-inline:auto}
.header{height:92px;display:flex;align-items:center;gap:40px}.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-size:25px;font-weight:700;letter-spacing:-.075em;line-height:1}.brand-mark{width:33px;height:33px;border-radius:10px;display:grid;place-items:center;background:var(--button);color:var(--button-ink);font-size:22px;font-weight:700;letter-spacing:0}.brand-dot{color:var(--accent)}.header-nav{display:flex;gap:28px;margin-left:auto;font-size:12px;color:var(--nav)}.header-nav a{text-decoration:none;transition:color .2s}.header-nav a:hover,.footer a:hover{color:var(--accent)}.theme-toggle{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 11px;border:0;border-radius:8px;background:transparent;color:var(--nav);font-size:11px;font-weight:600;cursor:pointer;transition:color .2s,background .2s}.theme-toggle:hover{background:var(--field);color:var(--ink)}.theme-moon{display:none}:root[data-theme="light"] .theme-sun{display:none}:root[data-theme="light"] .theme-moon{display:block}.status-dot,.note-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:7px;vertical-align:middle}
.hero{padding:105px 0 118px;max-width:790px}.hero-overline,.eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;color:var(--heading-label);margin:0}.hero-overline::before{content:'';display:inline-block;width:19px;height:1px;background:var(--accent);vertical-align:middle;margin-right:10px;opacity:.8}.hero h1{font-size:clamp(55px,8vw,86px);font-weight:600;line-height:.99;letter-spacing:-.065em;margin:26px 0 22px}.hero h1 em,.about-copy h2 em{font-family:var(--serif);font-size:1.17em;font-weight:400;color:var(--accent);letter-spacing:-.025em}.hero-copy{color:var(--muted);font-size:15px;line-height:1.7;margin:0 0 60px}.tool-card{max-width:790px}label{display:block;font-size:11px;font-weight:700;color:var(--label);margin-bottom:11px}input,button{font:inherit}.input-row{display:flex;align-items:stretch;gap:10px}.link-entry{display:flex;align-items:center;gap:13px;min-width:0;flex:1;padding:0 17px;background:var(--field);border:1px solid var(--field-border);border-radius:9px;transition:background .2s,border-color .2s,box-shadow .2s}.link-entry:focus-within{background:var(--field-hover);border-color:var(--field-focus);box-shadow:0 0 0 3px var(--field-shadow)}.link-icon{font-size:16px;color:var(--icon);line-height:1}.input-row input{flex:1;min-width:0;width:100%;height:56px;padding:0;border:0;outline:0;background:transparent;color:var(--ink);font-size:15px}.input-row input::placeholder{color:var(--soft);opacity:1}.input-row button,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:25px;min-height:56px;padding:0 23px;border:0;border-radius:9px;background:var(--button);color:var(--button-ink);font-weight:700;font-size:12px;text-decoration:none;white-space:nowrap;cursor:pointer;transition:background .2s,transform .2s}.input-row button:hover,.primary-action:hover{background:var(--button-hover);transform:translateY(-2px)}.input-row button:active,.primary-action:active{transform:translateY(0)}.input-row button:disabled{opacity:.75;cursor:wait;transform:none}.input-row button:disabled>span:last-child{font-size:0}.input-row button:disabled>span:last-child::after{content:'';display:block;width:12px;height:12px;border:1.5px solid rgba(26,33,22,.3);border-left-color:#1a2116;border-radius:50%;animation:spin .8s linear infinite}.form-note{display:flex;justify-content:space-between;gap:12px;font-size:11px;color:var(--soft);margin-top:17px}.note-dot{width:5px;height:5px;margin-right:6px}.message{font-size:13px;line-height:1.5;color:var(--error)}.message:not(:empty){margin-top:18px}.message[data-kind=success]{color:var(--accent)}.message[data-kind=loading]{color:var(--muted)}
.result{display:flex;flex-direction:column;gap:25px;margin-top:46px;animation:rise-in .4s ease both}.result[hidden],.result-image[hidden],.media-list[hidden],.media-count[hidden]{display:none}.result-image{position:relative;touch-action:pan-y;align-self:center;width:min(100%,260px);min-width:0;height:auto;aspect-ratio:4/5;overflow:hidden;background:var(--image-bg);border-radius:8px}.result-image img{display:block;width:100%;height:100%;object-fit:cover}.result-image img[hidden],.preview-empty[hidden],.preview-nav[hidden],.preview-counter[hidden]{display:none}.preview-empty{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:12px}.preview-nav{position:absolute;top:50%;z-index:1;display:grid;place-items:center;width:42px;height:42px;padding:0;border:1px solid rgba(255,255,255,.24);border-radius:50%;background:rgba(16,20,15,.76);color:#fff;font-size:27px;line-height:1;cursor:pointer;transform:translateY(-50%);transition:background .2s,opacity .2s}.preview-nav:hover:not(:disabled){background:rgba(16,20,15,.95)}.preview-nav:disabled{opacity:.4;cursor:default}.preview-prev{left:12px}.preview-next{right:12px}.preview-counter{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);padding:5px 10px;border-radius:99px;background:rgba(16,20,15,.78);color:#fff;font-size:10px;font-weight:700;letter-spacing:.06em;white-space:nowrap}.result-body{min-width:0;width:100%}.result-kicker{font-size:10px;font-weight:700;letter-spacing:.11em;color:var(--result-label)}.result h3{font-size:23px;letter-spacing:-.045em;line-height:1.2;margin:12px 0}.caption{color:var(--muted);font-size:13px;line-height:1.65;white-space:pre-wrap;max-height:100px;overflow:auto;overflow-wrap:anywhere}.result-actions{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}.result-actions .primary-action,.result-actions .secondary-action{min-height:46px}.result-actions [hidden]{display:none}.result-actions .primary-action:disabled{opacity:.65;cursor:wait;transform:none}.secondary-action{display:inline-flex;cursor:pointer;font-family:inherit;align-items:center;justify-content:center;gap:16px;padding:0 18px;border:1px solid var(--field-border);border-radius:9px;color:var(--ink);font-size:12px;font-weight:700;text-decoration:none;transition:background .2s,border-color .2s}.secondary-action:hover:not(:disabled){background:var(--field-hover);border-color:var(--field-focus)}.secondary-action:disabled{opacity:.65;cursor:wait}.download-status{color:var(--muted);font-size:11px;line-height:1.6;margin:-10px 0 18px}.download-status:empty{display:none}.direct-label{margin:0 0 8px;color:var(--label);font-size:11px}.direct-link-field{display:flex;align-items:center;min-width:0;max-width:100%;padding:0 5px 0 14px;background:var(--field);border:1px solid var(--field-border);border-radius:8px;transition:background .2s,border-color .2s}.direct-link-field:focus-within{background:var(--field-hover);border-color:var(--field-focus)}.direct-link-field input{display:block;box-sizing:border-box;width:0;min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--direct);font:inherit;font-size:11px;line-height:1.55;padding:14px 0;text-overflow:clip;cursor:grab;touch-action:pan-y}.direct-link-field input:active{cursor:grabbing}.copy-action{border:0;border-radius:6px;background:var(--copy-bg);color:var(--accent);font-size:11px;font-weight:700;padding:9px 12px;cursor:pointer;transition:background .2s,color .2s}.copy-action:hover{background:var(--button);color:var(--button-ink)}.download-note,.media-count{color:var(--soft);font-size:11px;line-height:1.65;margin:14px 0 0}.media-list{display:flex;gap:10px;overflow-x:auto;max-width:100%;padding:7px 0 9px}.media-choice{flex:0 0 74px;min-width:0;border:0;background:transparent;color:var(--choice);opacity:.6;padding:0 0 5px;cursor:pointer;transition:opacity .2s,transform .2s}.media-choice:hover{opacity:.9;transform:translateY(-2px)}.media-choice[aria-pressed="true"]{opacity:1;color:var(--accent)}.media-choice[aria-pressed="true"] img{outline:2px solid var(--accent);outline-offset:-2px}.media-choice img{display:block;width:74px;height:70px;object-fit:cover;border-radius:5px}.media-choice span{display:block;padding:7px 2px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.media-choice:disabled{cursor:not-allowed;opacity:.35;transform:none}
.how-section,.about-section{padding:85px 0 90px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:25px}.section-heading h2,.about-copy h2{font-size:clamp(30px,4vw,43px);letter-spacing:-.05em;line-height:1.15;font-weight:600;margin:14px 0 0}.section-heading>p{font-size:12px;color:var(--soft);margin:0}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:38px;margin-top:48px}.step-top{font-family:var(--serif);font-size:27px;font-style:italic;color:var(--result-label);line-height:1}.steps h3{font-size:15px;margin:23px 0 10px}.steps p,.about-copy p,.faq p{font-size:13px;line-height:1.8;color:var(--muted);margin:0}.steps p{max-width:270px}.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:70px}.about-copy h2{margin-bottom:27px}.about-copy p{margin-bottom:14px}.faq summary{position:relative;list-style:none;cursor:pointer;padding:19px 30px 19px 0;font-size:13px;font-weight:700;line-height:1.5;transition:color .2s}.faq summary:hover{color:var(--accent)}.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:'+';position:absolute;right:2px;top:15px;color:var(--accent);font-size:20px;font-weight:400}.faq details[open] summary::after{content:'−'}.faq p{padding:0 20px 20px 0}
.footer{display:flex;justify-content:space-between;gap:25px;align-items:center;padding-top:38px;padding-bottom:40px}.footer-brand .brand{font-size:21px}.footer-brand .brand-mark{width:29px;height:29px;font-size:19px}.footer p{font-size:11px;color:var(--soft);line-height:1.7;margin:9px 0 0}.footer-brand .font-credit{margin-top:12px}.font-credit a{color:var(--soft);text-decoration:underline;text-underline-offset:3px}.font-credit a:hover{color:var(--accent)}.footer-right{text-align:right}.footer-right a{color:var(--accent);text-decoration:underline;text-underline-offset:4px;overflow-wrap:anywhere}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,.faq summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.input-row input:focus-visible,.direct-link-field input:focus-visible{outline:0}
.loading[hidden]{display:none}.loading{max-width:100%;margin-top:32px;animation:rise-in .35s ease both}.loading-inner{display:flex;align-items:center;gap:16px}.loading-orbit{position:relative;display:grid;place-items:center;flex:none;width:46px;height:46px;border:1px solid var(--field-border);border-radius:50%;color:var(--accent)}.loading-orbit-dot{position:absolute;inset:-1px;animation:orbit 2.8s linear infinite}.loading-orbit-dot::before{content:'';position:absolute;top:-3px;left:50%;width:6px;height:6px;border-radius:50%;background:var(--accent)}.loading-orbit-core{font-size:19px}.loading-copy{display:grid;gap:5px;min-width:0}.loading-copy strong{font-size:13px;font-weight:700}.loading-copy>span{font-size:12px;color:var(--muted)}.loading-dots{display:inline-flex;gap:3px;margin-left:5px;vertical-align:middle}.loading-dots i{width:3px;height:3px;background:var(--accent);border-radius:50%;animation:dot-pulse 1.2s ease-in-out infinite}.loading-dots i:nth-child(2){animation-delay:.2s}.loading-dots i:nth-child(3){animation-delay:.4s}.loading-track{display:block;height:2px;background:var(--field-border);margin-top:19px;overflow:hidden}.loading-track span{display:block;width:35%;height:100%;background:var(--accent);animation:indeterminate 2s ease-in-out infinite}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@keyframes orbit{to{transform:rotate(360deg)}}@keyframes dot-pulse{0%,70%,100%{opacity:.25;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}@keyframes indeterminate{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
@keyframes rise-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:700px){.wrap{width:calc(100% - 40px)}.header{height:76px;gap:15px}.header-nav{gap:15px}.header-nav a:first-child{display:none}.theme-toggle{min-width:38px;padding:0}.theme-label{display:none}.hero{padding:73px 0 80px}.hero h1{font-size:clamp(46px,10vw,64px);margin:22px 0 20px}.hero-copy{font-size:14px;margin-bottom:45px}.input-row{flex-direction:column;gap:10px}.link-entry{min-height:56px}.input-row button{width:100%;justify-content:space-between;padding:0 20px}.form-note{font-size:10px}.result{flex-direction:column;gap:20px}.result-image{width:min(100%,320px);min-width:0;height:auto;aspect-ratio:4/5}.result-actions .primary-action,.result-actions .secondary-action{width:100%}.how-section,.about-section{padding:65px 0}.section-heading{display:block}.section-heading>p{margin-top:12px}.steps{grid-template-columns:1fr;gap:32px;margin-top:35px}.steps h3{margin:15px 0 8px}.about-grid{grid-template-columns:1fr;gap:32px}.footer{flex-direction:column;align-items:center;text-align:center}.footer-right{text-align:center}}

@media(prefers-reduced-motion:reduce){:root{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
````

## `public/theme.js`

````js
// Apply a saved choice before the stylesheet paints; otherwise follow the device.
(() => {
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-color-scheme: light)') || {matches:false};
  let saved = null;
  try { saved = localStorage.getItem('dlsta-theme'); } catch { /* private browsing */ }
  if (saved !== 'light' && saved !== 'dark') saved = null;
  const apply = () => {
    const theme = saved || (media.matches ? 'light' : 'dark');
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f7f8f0' : '#10130f');
    const toggle = document.querySelector('#theme-toggle');
    if (!toggle) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', `Switch to ${next} mode`);
    toggle.setAttribute('title', `Switch to ${next} mode`);
    toggle.querySelector('.theme-label').textContent = next === 'light' ? 'Light' : 'Dark';
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('#theme-toggle')?.addEventListener('click', () => {
      saved = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('dlsta-theme', saved); } catch { /* use this page only */ }
      apply();
    });
  });
  media.addEventListener?.('change', () => { if (!saved) apply(); });
})();
````

## `public/app.js`

````js
// Leave empty on Cloudflare: /api/scrape automatically uses the current Worker or custom domain.
// Only set a Worker origin here when the frontend is hosted separately (for example, GitHub Pages).
const IS_ANDROID_APP = window.location.hostname === 'appassets.androidplatform.net' && Boolean(window.dlstaNative);
const WORKER_URL = IS_ANDROID_APP ? 'https://d.byaislop.cv' : '';
const nativePending = new Map();
let nativeSequence = 0;
if (IS_ANDROID_APP) {
  window.dlstaNative.onmessage = event => {
    try {
      const reply = JSON.parse(event.data);
      const pending = nativePending.get(reply.id);
      if (!pending) return;
      nativePending.delete(reply.id);
      clearTimeout(pending.timer);
      if (reply.ok) pending.resolve(reply);
      else pending.reject(new Error(reply.error || 'Android request failed.'));
    } catch { /* Ignore malformed messages. */ }
  };
  // External links open in the device browser rather than a second WebView.
  document.querySelectorAll('a[target="_blank"]').forEach(link => link.removeAttribute('target'));
}
function androidRequest(type, payload = {}) {
  if (!IS_ANDROID_APP) return Promise.reject(new Error('Android app is unavailable.'));
  const id = ++nativeSequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { nativePending.delete(id); reject(new Error('Android request timed out.')); }, 15000);
    nativePending.set(id, {resolve, reject, timer});
    try { window.dlstaNative.postMessage(JSON.stringify({id, type, ...payload})); }
    catch { clearTimeout(timer); nativePending.delete(id); reject(new Error('Android request failed.')); }
  });
}
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const loading = document.querySelector('#loading');
const loadingHint = document.querySelector('#loading-hint');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
const download = document.querySelector('#download');
const saveMedia = document.querySelector('#save-media');
const saveAll = document.querySelector('#save-all');
const downloadStatus = document.querySelector('#download-status');
const copy = document.querySelector('#copy');
const directInput = document.querySelector('#direct-url');
const urlInput = document.querySelector('#url');
const mediaList = document.querySelector('#media-list');
const mediaCount = document.querySelector('#media-count');
const imageWrap = document.querySelector('#image-wrap');
const image = document.querySelector('#thumbnail');
const previewEmpty = document.querySelector('#preview-empty');
const previousMedia = document.querySelector('#preview-prev');
const nextMedia = document.querySelector('#preview-next');
const previewCounter = document.querySelector('#preview-counter');
let directUrl = '';
let selectedFilename = '';
let selectedType = 'media';
let carouselDownloads = [];
let carouselUnavailable = 0;
let activeBatch = null;
let lookupGeneration = 0;
let nativeTracking = null;
let moveMedia = () => {};
let touchStart = null;

// Drag the single-line field to pan long URLs. Keyboard and Copy remain available.
let linkDrag = null;
directInput.addEventListener('pointerdown', event => {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) ||
      event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.detail > 1) return;
  linkDrag = {id:event.pointerId, x:event.clientX, scroll:directInput.scrollLeft, moved:false};
  directInput.setPointerCapture(event.pointerId);
  event.preventDefault();
});
directInput.addEventListener('pointermove', event => {
  if (!linkDrag || linkDrag.id !== event.pointerId) return;
  const delta = event.clientX - linkDrag.x;
  if (Math.abs(delta) > 3) linkDrag.moved = true;
  if (linkDrag.moved) directInput.scrollLeft = linkDrag.scroll - delta;
});
directInput.addEventListener('pointerup', event => {
  if (!linkDrag || linkDrag.id !== event.pointerId) return;
  const moved = linkDrag.moved;
  linkDrag = null;
  if (!moved) directInput.focus({preventScroll:true});
});
directInput.addEventListener('pointercancel', () => { linkDrag = null; });

previousMedia.addEventListener('click', () => moveMedia(-1));
nextMedia.addEventListener('click', () => moveMedia(1));
imageWrap.addEventListener('keydown', event => {
  if (event.target !== imageWrap || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  moveMedia(event.key === 'ArrowLeft' ? -1 : 1);
});
// Preserve vertical page scrolling; only a clear horizontal swipe changes media.
imageWrap.addEventListener('touchstart', event => {
  const touch = event.touches.length === 1 ? event.touches[0] : null;
  touchStart = touch ? {x:touch.clientX, y:touch.clientY} : null;
}, {passive:true});
imageWrap.addEventListener('touchend', event => {
  const touch = event.changedTouches[0];
  if (touchStart && touch) {
    const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) moveMedia(dx < 0 ? 1 : -1);
  }
  touchStart = null;
}, {passive:true});
imageWrap.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});

function updateSubmitLabel() {
  if (submit.disabled) return;
  submit.firstElementChild.textContent = urlInput.value.trim() ? 'Get media link' : 'Paste & get link';
}
urlInput.addEventListener('input', updateSubmitLabel);

function isInstagramPostUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase()) &&
      /^\/(p|reel|reels|tv)\/[A-Za-z0-9_-]{1,32}\/?$/.test(url.pathname);
  } catch { return false; }
}

function isAllowedCdnUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['cdninstagram.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  lookupGeneration++;
  nativeTracking = null;
  if (activeBatch) activeBatch.abort();
  activeBatch = null;
  carouselDownloads = [];
  carouselUnavailable = 0;
  saveAll.hidden = true;
  saveAll.disabled = false;
  saveMedia.disabled = false;
  result.hidden = true;
  moveMedia = () => {};
  touchStart = null;
  directUrl = '';
  selectedFilename = '';
  selectedType = 'media';
  downloadStatus.textContent = '';
  directInput.value = '';
  message.textContent = '';
  message.dataset.kind = '';
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  const hints = ['Looking for available media.', 'Carousels can contain multiple items.', 'Still working — some posts take a little longer.', 'Your media opens directly from Instagram.'];
  let hintIndex = 0;
  loadingHint.textContent = hints[0];
  loading.hidden = false;
  const hintTimer = setInterval(() => { hintIndex = (hintIndex + 1) % hints.length; loadingHint.textContent = hints[hintIndex]; }, 3500);
  submit.firstElementChild.textContent = 'Finding your media…';
  try {
    if (!urlInput.value.trim()) {
      try {
        if (IS_ANDROID_APP) urlInput.value = String((await androidRequest('readClipboard')).text || '').trim();
        else {
          if (!navigator.clipboard?.readText) throw new Error('unavailable');
          urlInput.value = (await navigator.clipboard.readText()).trim();
        }
      } catch {
        urlInput.focus();
        throw new Error('Clipboard access is unavailable. Paste the Instagram link into the box.');
      }
      if (!urlInput.value) throw new Error('Your clipboard is empty. Copy an Instagram link first.');
    }
    const submittedUrl = urlInput.value.trim();
    if (!isInstagramPostUrl(submittedUrl)) {
      urlInput.value = '';
      throw new Error('Copy a valid public Instagram post or reel link first.');
    }
    if (!WORKER_URL && window.location.hostname.endsWith('.github.io')) {
      throw new Error('The Cloudflare Worker URL is not configured yet. Set WORKER_URL in public/app.js and redeploy.');
    }
    const response = await fetch(`${WORKER_URL}/api/scrape`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: submittedUrl})
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      if (response.status === 400 && urlInput.value.trim() === submittedUrl) urlInput.value = '';
      throw new Error(data.error || 'Unable to find media. Please try again.');
    }
    const mediaUrl = data.mediaUrl || data.videoUrl;
    if (!isAllowedCdnUrl(mediaUrl)) throw new Error('The returned link was not a supported Instagram CDN URL.');
    const rawItems = Array.isArray(data.items) && data.items.length ? data.items : [{position:1, mediaType:data.mediaType, mediaUrl, thumbnailUrl:data.thumbnailUrl, available:true}];
    const items = rawItems.map((item, index) => ({...item, position:Number.isSafeInteger(item.position) && item.position > 0 ? item.position : index + 1,
      available:item.available !== false && isAllowedCdnUrl(item.mediaUrl),
      mediaType:item.mediaType === 'photo' ? 'photo' : item.mediaType === 'video' ? 'video' : 'unknown'}));
    mediaList.replaceChildren();
    mediaList.hidden = items.length <= 1;
    mediaCount.hidden = items.length <= 1 && !data.partial;
    const available = items.filter(item => item.available).length;
    mediaCount.textContent = data.partial ? `${available} items available; some could not be retrieved.` : `${items.length} items · Select one to open or copy`;
    const buttons = [];
    let selectedIndex = -1;
    const total = Math.max(items.length, Number(data.totalItems) || 0);
    const shortcode = new URL(submittedUrl).pathname.split('/')[2];
    carouselDownloads = items.filter(item => item.available).map(item => ({url:item.mediaUrl, filename:`instagram_${shortcode}_${item.position}`}));
    carouselUnavailable = Math.max(0, total - carouselDownloads.length);
    saveAll.hidden = total <= 1;
    const neighbor = (index, direction) => {
      for (let i = index + direction; i >= 0 && i < items.length; i += direction) if (items[i].available) return i;
      return -1;
    };
    function selectItem(item, index) {
      if (!item.available) return;
      selectedIndex = index;
      directUrl = item.mediaUrl;
      selectedType = item.mediaType;
      selectedFilename = `instagram_${shortcode}${items.length > 1 ? `_${item.position}` : ''}`;
      if (!activeBatch && !nativeTracking) downloadStatus.textContent = '';
      if (!saveMedia.disabled) saveMedia.firstChild.textContent = `Download ${item.mediaType} `;
      document.querySelector('#result-title').textContent = items.length > 1 ? `Item ${item.position} · ${item.mediaType}` : `Your ${item.mediaType} is ready.`;
      download.firstChild.textContent = `Open direct ${item.mediaType} `;
      download.href = directUrl; // Direct to Instagram's CDN; no media proxy.
      directInput.value = directUrl;
      directInput.scrollLeft = 0;
      const hasPreview = isAllowedCdnUrl(item.thumbnailUrl);
      image.hidden = !hasPreview;
      previewEmpty.hidden = hasPreview;
      imageWrap.hidden = !hasPreview && items.length <= 1;
      if (hasPreview) image.src = item.thumbnailUrl;
      else image.removeAttribute('src');
      const multiple = items.length > 1;
      imageWrap.setAttribute('tabindex', multiple ? '0' : '-1');
      previousMedia.hidden = nextMedia.hidden = previewCounter.hidden = !multiple;
      previousMedia.disabled = neighbor(index, -1) < 0;
      nextMedia.disabled = neighbor(index, 1) < 0;
      previewCounter.textContent = `${item.position} / ${total}`;
      buttons.forEach((button, buttonIndex) => button.setAttribute('aria-pressed', String(buttonIndex === index)));
    }
    moveMedia = direction => {
      const index = neighbor(selectedIndex, direction);
      if (index >= 0) selectItem(items[index], index);
    };
    if (items.length > 1) items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'media-choice'; button.disabled = !item.available;
      button.setAttribute('aria-label', `Item ${item.position}: ${item.available ? item.mediaType : 'unavailable'}`);
      button.setAttribute('aria-pressed', 'false');
      if (isAllowedCdnUrl(item.thumbnailUrl)) {
        const thumb = document.createElement('img'); thumb.src = item.thumbnailUrl; thumb.alt = ''; thumb.referrerPolicy = 'no-referrer';
        button.appendChild(thumb);
      }
      const label = document.createElement('span'); label.textContent = item.available ? `${item.position} · ${item.mediaType}` : `${item.position} · unavailable`;
      button.appendChild(label); button.addEventListener('click', () => selectItem(item, index));
      buttons.push(button); mediaList.appendChild(button);
    });
    const firstAvailable = items.findIndex(item => item.available);
    if (firstAvailable < 0) throw new Error('No supported media links were returned.');
    selectItem(items[firstAvailable], firstAvailable);
    document.querySelector('#caption').textContent = data.caption || 'Your direct media link is ready to open or copy.';
    result.hidden = false;
    // Keep a new link typed while this request was in flight.
    if (urlInput.value.trim() === submittedUrl) urlInput.value = '';
    message.textContent = '';
    message.dataset.kind = '';
  } catch (error) { message.dataset.kind = ''; message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { clearInterval(hintTimer); loading.hidden = true; submit.disabled = false; form.setAttribute('aria-busy', 'false'); updateSubmitLabel(); }
});

// Android can query its persistent queue; web browsers cannot confirm saved files.
function trackAndroidBatch(batch, generation) {
  nativeTracking = batch;
  const poll = async () => {
    if (generation !== lookupGeneration || nativeTracking !== batch) return;
    try {
      const status = await androidRequest('status', {batch});
      if (generation !== lookupGeneration || nativeTracking !== batch) return;
      if (!status.total) { setTimeout(poll, 1500); return; }
      const done = status.downloaded + status.existing + status.failed;
      const detail = [status.existing ? `${status.existing} already saved` : '', status.failed ? `${status.failed} failed` : ''].filter(Boolean);
      downloadStatus.textContent = status.waiting ? `Processed ${done} of ${status.total} · ${status.waiting} queued${detail.length ? ' · ' + detail.join(' · ') : ''}.` :
        `Finished: ${status.downloaded} saved${detail.length ? ' · ' + detail.join(' · ') : ''}. Find them in Downloads / dlsta.`;
      if (status.waiting) setTimeout(poll, 1500); else nativeTracking = null;
    } catch { if (generation === lookupGeneration && nativeTracking === batch) setTimeout(poll, 5000); }
  };
  setTimeout(poll, 1000);
}

// Fetch directly from Instagram's CDN in the browser, preserving the original bytes.
// Each call requests one browser download; browsers may block multiple downloads.
async function requestMediaDownload(url, filename, signal) {
  const response = await fetch(url, {mode:'cors', credentials:'omit', referrerPolicy:'no-referrer', signal});
  if (!response.ok) throw new Error('Download unavailable');
  const blob = await response.blob();
  if (signal?.aborted) throw new Error('Cancelled');
  const types = new Map([['image/jpeg','jpg'], ['image/png','png'], ['image/webp','webp'], ['image/avif','avif'], ['image/gif','gif'], ['video/mp4','mp4'], ['video/webm','webm'], ['video/quicktime','mov']]);
  const extension = types.get(blob.type.toLowerCase().split(';')[0].trim());
  if (!extension || !blob.size) throw new Error('Unsupported media type');
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  try { link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000); }
}

saveMedia.addEventListener('click', async () => {
  if (!directUrl || !selectedFilename || saveMedia.disabled) return;
  const url = directUrl, filename = selectedFilename, generation = lookupGeneration;
  saveMedia.disabled = true;
  saveAll.disabled = true;
  saveMedia.firstChild.textContent = 'Preparing download ';
  downloadStatus.textContent = 'Downloading directly from Instagram’s CDN…';
  try {
    if (IS_ANDROID_APP) {
      const queued = await androidRequest('enqueue', {items:[{url, filename}]});
      if (generation === lookupGeneration) { downloadStatus.textContent = 'Download queued. Find it in Downloads / dlsta.'; trackAndroidBatch(queued.batch, generation); }
    } else {
      await requestMediaDownload(url, filename);
      if (generation === lookupGeneration) downloadStatus.textContent = 'Download started in your browser.';
    }
  } catch {
    if (generation === lookupGeneration) downloadStatus.textContent = 'Could not download directly. Use Open direct media and your browser’s save option instead.';
  } finally {
    if (generation !== lookupGeneration) return;
    saveMedia.disabled = false;
    saveAll.disabled = false;
    // The selection may have changed while the download was in progress.
    saveMedia.firstChild.textContent = `Download ${selectedType === 'unknown' ? 'media' : selectedType} `;
  }
});

// Space browser download requests so a fast CDN cannot emit a burst of clicks.
// Cancellation stops the wait promptly when a new lookup starts.
function pauseBetweenDownloads(signal) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(finish, 250);
    function finish() { signal.removeEventListener('abort', cancel); resolve(); }
    function cancel() { clearTimeout(timer); finish(); }
    signal.addEventListener('abort', cancel, {once:true});
  });
}

saveAll.addEventListener('click', async () => {
  if (saveAll.disabled || carouselDownloads.length === 0) return;
  const batch = carouselDownloads.slice();
  const unavailable = carouselUnavailable;
  const controller = new AbortController();
  activeBatch = controller;
  saveAll.disabled = true;
  saveMedia.disabled = true;
  let requested = 0, failed = 0;
  try {
    if (IS_ANDROID_APP) {
      downloadStatus.textContent = 'Adding files to the Android download queue…';
      try {
        const queued = await androidRequest('enqueue', {items:batch});
        if (activeBatch === controller) {
          downloadStatus.textContent = `Queued ${batch.length} files for download.${unavailable ? ` ${unavailable} unavailable.` : ''} Find them in Downloads / dlsta.`;
          trackAndroidBatch(queued.batch, lookupGeneration);
        }
      } catch {
        if (activeBatch === controller) downloadStatus.textContent = 'Could not queue the downloads. Please try again.';
      }
      return;
    }
    for (const [index, item] of batch.entries()) {
      if (controller.signal.aborted) return;
      downloadStatus.textContent = `Preparing ${index + 1} of ${batch.length}. Allow multiple downloads if your browser asks.`;
      try {
        await requestMediaDownload(item.url, item.filename, controller.signal);
        requested++;
        if (index < batch.length - 1) await pauseBetweenDownloads(controller.signal);
      }
      catch { if (controller.signal.aborted) return; failed++; }
    }
    if (activeBatch !== controller) return;
    const problems = [unavailable ? `${unavailable} unavailable` : '', failed ? `${failed} could not be fetched; try them individually` : ''].filter(Boolean);
    downloadStatus.textContent = `Requested ${requested} of ${batch.length} downloads. Allow multiple downloads if your browser asks.${problems.length ? ' ' + problems.join('; ') + '.' : ''}`;
  } finally {
    if (activeBatch === controller) {
      activeBatch = null;
      saveAll.disabled = false;
      saveMedia.disabled = false;
      saveMedia.firstChild.textContent = `Download ${selectedType === 'unknown' ? 'media' : selectedType} `;
    }
  }
});

copy.addEventListener('click', async () => {
  if (!directUrl) return;
  try {
    if (IS_ANDROID_APP) await androidRequest('writeClipboard', {text:directUrl});
    else await navigator.clipboard.writeText(directUrl);
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
  if (!isInstagramPostUrl(text)) return;
  event.preventDefault();
  urlInput.value = text;
  updateSubmitLabel();
  urlInput.focus();
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
name = "dlsta"
main = "worker/index.js"
compatibility_date = "2026-10-30"

# Regional placement is a best-effort mitigation for empty public Instagram responses.
# It may increase latency and cannot guarantee Instagram availability.
[placement]
region = "aws:us-east-1"

[assets]
directory = "./public"
binding = "ASSETS"
# Run the Worker for HTML/SEO and the API so URLs match the current host.
run_worker_first = ["/", "/index.html", "/sitemap.xml", "/robots.txt", "/api/*"]

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
  "homepage": "https://d.byaislop.cv/",
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
    "instagram-reels-downloader",
    "instagram-photos",
    "instagram-photo-downloader",
    "instagram-video-downloader",
    "instagram-carousel",
    "media-downloader",
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

## `.github/workflows/cloudflare.yml`

````yaml
name: Deploy dlsta to Cloudflare Workers

on:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: cloudflare-dlsta-production
  cancel-in-progress: false

jobs:
  deploy:
    name: Test and deploy dlsta
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Check out repository
        uses: actions/checkout@v6
      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Check Cloudflare credentials are set
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
            echo '::error::Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as GitHub Actions repository secrets.'
            exit 1
          fi
      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
````

## `.github/workflows/pages.yml`

````yaml
name: Deploy frontend to GitHub Pages

on:
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

A small Cloudflare Worker + static UI for resolving **public** Instagram photos, reels and videos. The resolver uses official oEmbed only if an app token is configured, then public embed/page HTML (including matching structured embed or public JSON media when available), then unauthenticated Instagram web GraphQL with an ephemeral anonymous CSRF cookie. No Instagram account login, paid APIs, subprocesses, or Node APIs are used by the Worker.

**Live site:** [d.byaislop.cv](https://d.byaislop.cv/)

## What it does

- Resolves supported **public** Instagram photo, video and reel links without requiring an Instagram login. Both `/reel/` and `/reels/` share links are accepted. For carousels, use the preview arrows, swipe left or right, select thumbnails, or focus the preview and use the arrow keys. Unavailable items are indicated and skipped by the arrows. Each available item opens directly from Instagram’s CDN. For carousels, **Download all** requests the available files in order, one at a time, without a ZIP; requests are spaced by 250 ms to reduce browser throttling, and unavailable items are reported.
- Shows the caption and thumbnail when available, plus a single-line, horizontally scrollable direct media URL and a copy button. Drag the link to scroll, or focus it and use the arrow keys; copying always copies the complete URL. When Instagram exposes multiple sized renditions, it selects the largest by dimensions (and bitrate as a video tie-breaker). This does not guarantee the original upload or the best version Instagram stores.
- Downloads the selected original photo or video from Instagram's CDN directly in the browser, with a filename based on the shortcode and carousel position. The extension follows the actual response MIME type (for example, JPG, WebP or MP4); bytes are not converted. Cloudflare does **not** stream or proxy the media file. The browser loads each file into memory for a named download; if CORS, an unsupported format or the browser prevents it, use **Open direct media** and the browser’s save option instead. Multiple downloads may require browser permission or may be blocked. The app can report that downloads were requested, but cannot confirm that the browser saved every file. CDN transfers are requested sequentially; browser disk writes may overlap. Starting a new lookup cancels the remaining carousel requests. Tap **Paste & get link** to read the clipboard and start a lookup in supported browsers. If clipboard access is denied or unsupported, paste into the box manually. On desktop, paste a supported URL outside another editable field to fill the box.
- After a successful lookup, the Instagram input clears and the paste button is ready for another link; the result stays visible. Invalid post URLs are cleared with an error before contacting the API. A valid link is retained after other lookup failures for retry, and a new link entered during an in-flight request is not overwritten. The selected media preview is centered.
- Uses a spacious, card-free layout with a styled link field and vertically stacked mobile result, carousel selection, keyboard focus indicators, and reduced-motion support. The indeterminate loader cycles helpful hints while the lookup runs; it does not claim a percentage or progress stage.
- Follows your device’s light/dark preference until you choose a theme in the header. A manual choice is saved in the browser’s local storage when available. DM Sans and Instrument Serif are self-hosted and credited in the footer; there are no third-party font requests.
- Runs as a single Cloudflare Worker with static assets, or with the frontend hosted separately on GitHub Pages or Cloudflare Pages.

**Availability is not guaranteed.** Instagram can change or block these unofficial public endpoints, require login, remove videos, or return ambiguous responses. oEmbed generally returns embed metadata, not a downloadable video; it is not GraphQL and usually needs a Meta app access token. Public HTML often lacks direct media URLs. GraphQL document IDs can change. Private content is not supported. Only download material you have permission to use; follow the relevant platform terms and copyright laws.

## Media quality

For structured public responses, the resolver compares available image and video variants by pixel dimensions; video bitrate breaks ties when provided. A URL with no dimensions cannot be objectively ranked against a fully described variant, and a single URL cannot be compared to versions Instagram does not expose. dlsta does not claim original-upload quality or access to Instagram’s best stored version. Links are served directly from Instagram’s CDN and may expire. Named downloads preserve the CDN response bytes; a WebP image remains WebP rather than being renamed to JPG or recompressed.

A live check on 2026-10-30 returned all 10 items of a sample photo carousel as 1440 × 1921 WebP images. Three sample reels were 720 × 1280 H.264 video; those figures describe the returned files only, not Instagram’s source uploads or all reels. Offline tests also check selection by dimensions and bitrate and reject unsafe URLs. Availability and quality can change.

## Android app (beta)

The Android app uses native Android screens and controls, with the dlsta mark and light/dark themes. It requires Android 10 or newer and an internet connection; it does not require WebView. The phone performs its own anonymous public Instagram lookups using embed, page and unauthenticated GraphQL responses; it does not call the Cloudflare backend or any fallback service. This is experimental: Instagram may block a device or network, require a login, or change its public responses, and some media may not be available. Requests use only temporary anonymous CSRF values, not a private account session. Public embed requests use a fetcher user agent because Instagram can return an empty page to a mobile-browser user agent. An Android 15 emulator test on 2026-10-31 resolved three public reels and saved one, and separately saved a three-item carousel; repeat saves skipped existing files. These are time-sensitive checks, not a guarantee for every device or post. Android fetches media directly from Instagram’s CDN and saves it to **Downloads/dlsta**, without a ZIP or format conversion.

For Android, the app queues carousel files serially with WorkManager and checks its own Downloads entries before saving, so an already-saved item is skipped. It displays queue progress while the app is open. Android may defer background work; expired links, network failures, or removed media can still prevent a download. Clipboard access happens only after tapping Paste or Copy. No private Instagram login or broad file access permission is required: Android 10+ lets an app add its own files to shared Downloads through MediaStore without broad storage access.

To build from a phone: open **Actions → Build dlsta Android APK → Run workflow**, select `main`, and wait for the APK and emulator checks. Download the `dlsta-android-apk` artifact from the run, unzip it in your phone’s Files app, then open the APK and allow installation from that source if prompted. This workflow is manual-only and does not run on pushes. GitHub requires signing in to download artifacts, which expire after 30 days.

For update-compatible APKs, the workflow can use `ANDROID_DLSTA_KEYSTORE` (base64-encoded keystore) and `ANDROID_DLSTA_PASSWORD` repository Actions secrets. If these are missing it produces a temporary debug-signed APK; a future build with a different debug key may require uninstalling the older app. Do not commit signing keys or passwords. This is a sideloaded beta, not a Play Store release.

## Deploy with GitHub Actions (recommended)

The workflow `.github/workflows/cloudflare.yml` tests and deploys the **dlsta Worker and its assets** only when started manually using GitHub Actions. Pushes and GitHub web edits do not trigger it. It uses the checked-in `wrangler.toml`; this is a Workers deployment, not a Pages deployment.

1. In Cloudflare, create an **API token** using the **Edit Cloudflare Workers** template and scope it to the target account. For the first deployment the token needs permission to create the Worker and provision its `RATE_LIMIT` KV namespace; later, reduce the token permissions where possible. See [Cloudflare's token permission guidance](https://developers.cloudflare.com/workers/authorization/). Use an API token, **not** your global API key.
2. Find your **Account ID** in Cloudflare's account dashboard (Workers & Pages overview or an account's zone overview). Use the account ID, not a zone ID.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` with their respective values. Never commit or post the token.
4. Open **Actions → Deploy dlsta to Cloudflare Workers → Run workflow**, select `main` and run it. Run it again whenever you want to deploy newer commits. Open the run logs to confirm the deployment and its Worker URL. The workflow fails clearly if secrets are missing; adding secrets alone does not rerun a failed workflow.
5. Verify the `dlsta` Worker has a `RATE_LIMIT` KV binding, open its URL, and test a public Instagram link. Attach a custom domain through the dashboard if desired. The combined site automatically uses its current host for API and SEO.

The action deploys the name in `wrangler.toml` (`dlsta`), so an older `insta-dl` Worker is not automatically renamed or deleted. If Cloudflare Workers Builds is separately connected to this repository, disable its automatic deployments in the Cloudflare dashboard as well; GitHub workflow trigger settings do not control that separate service. Keep the separate GitHub Pages workflow only if you also want a static Pages frontend; it requires a configured Worker URL.

## Deploy using the Cloudflare button

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mahimmazidul/dlsta)

1. Create or sign in to your Cloudflare account and sign in to GitHub.
2. Open **[Deploy dlsta to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/mahimmazidul/dlsta)**. Connect GitHub and authorize the requested access when prompted.
3. Select the Cloudflare account and follow the prompts to create a repository and configure the Worker. The button typically creates a new repository under your GitHub account; future builds track that new repository, not necessarily this one.
4. Confirm the `RATE_LIMIT` KV namespace is provisioned and bound. If the UI cannot provision it, use the manual KV instructions below. Choose `dlsta` as the Worker name in the Cloudflare setup screen (or a distinct name if it conflicts with an existing Worker).
5. Deploy and wait for the build to finish. Open the provided `https://<worker>.<account>.workers.dev` URL: the Worker serves both the frontend and `/api/scrape`, so no separate frontend configuration is needed there.
6. Paste a public post or reel URL, choose **Get media link**, and open or copy the direct CDN link. Use your browser’s save option if the media opens in a tab.
7. If you instead use the separately hosted GitHub Pages frontend, set `WORKER_URL` in `public/app.js` to your deployed HTTPS Worker origin and redeploy Pages, as described below. GitHub Pages cannot run the Worker.

The default Worker name in `wrangler.toml` is **dlsta**, matching the app and package. This does not rename or delete an existing `insta-dl` Worker. In particular, Cloudflare Workers Builds can override the Wrangler name with the **existing dashboard Worker name**; an existing build connected to `insta-dl` can therefore keep deploying as `insta-dl` even after the file changes. To use `dlsta`, create a new Worker named `dlsta` in Cloudflare and connect it to the current repository (or deploy the latest code manually as described below). Reconnect any custom domain to the new Worker after testing. If you used the Deploy button earlier, it may have created a separate GitHub repository: update that repository or start a fresh deploy from the current code. See [Workers Builds name behavior](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/).

### Manual deployment (Node.js 22+)

```sh
npm ci
npx wrangler login
# Recent Wrangler provisions the ID-less RATE_LIMIT binding on first deploy.
npx wrangler deploy
```

Wrangler writes the provisioned namespace ID into the local configuration; dashboard-based provisioning keeps the resource ID in Cloudflare rather than necessarily writing it to your repository. Do not copy another account’s namespace ID. Verify the `RATE_LIMIT` binding on the deployed Worker. If automatic provisioning is unavailable, run `npx wrangler kv namespace create RATE_LIMIT`, then add the returned `id` to the `[[kv_namespaces]]` section in `wrangler.toml` and deploy again. For local development, run `npm test` then `npm run dev`. The Worker serves `public/` as static assets and `/api/*` itself.

### Add your subdomain

1. In Cloudflare, open **Workers & Pages → dlsta → Settings → Domains & Routes → Add → Custom Domain**.
2. Enter your subdomain in a zone managed by your Cloudflare account and complete the prompts. Cloudflare creates the required DNS record and certificate. If the hostname is attached to an old Worker, move it to `dlsta` when you are ready.
3. Open the new HTTPS address. The frontend uses the same-origin `/api/scrape` automatically; no Worker URL is required in `public/app.js` on this combined deployment. Canonical, social image, sitemap and robots URLs are generated from whichever host receives the request.

If both `workers.dev` and your custom subdomain remain public, both will describe themselves as canonical. For one preferred search URL, configure a redirect from the other hostname to your chosen domain. See Cloudflare's [custom domain instructions](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Optional oEmbed: `npx wrangler secret put INSTAGRAM_OEMBED_TOKEN`. Obtain an appropriate Meta app access token and permissions from Meta; do not commit it. It is sent only to the official Graph API. No token is needed for the other methods.

## Separate frontend

For a separately hosted Cloudflare Pages or GitHub Pages frontend, publish the contents of `public/` as the site root. This is a static frontend only: the root `wrangler.toml` configures a **Worker**, not a Pages Functions project. In `public/app.js`, set `WORKER_URL` to the **HTTPS origin** of the deployed Worker, with no trailing slash. Redeploy the site. Restrict `ALLOWED_ORIGINS` in `wrangler.toml` to a comma-separated list of exact HTTPS frontend origins and redeploy the Worker; the default `*` permits all origins. CORS is not authentication and does not stop non-browser callers. The included `.github/workflows/pages.yml` publishes `public/` to GitHub Pages only when manually started from Actions → Deploy frontend to GitHub Pages → Run workflow. Pushes and GitHub web edits do not trigger it. In repository Settings → Pages, set **Build and deployment → Source** to **GitHub Actions**. The site URL is `https://mahimmazidul.github.io/dlsta/` once the workflow succeeds. GitHub Pages cannot run the Worker; deploy that separately.

## API

- `POST /api/scrape` with JSON `{ "url": "https://www.instagram.com/reel/.../" }`, or GET with `?url=...`. Returns `{success, mediaType, mediaUrl, thumbnailUrl, caption}` on success, plus `videoUrl` or `photoUrl` for the matching media type. Carousels also return `items`, `totalItems`, and `partial`; each item reports its position, type, availability, and direct URL when available. `mediaType` is `video` or `photo`; empty `thumbnailUrl` and `caption` mean unavailable.
- The response contains a direct Instagram CDN photo or video URL. Open or copy it from the UI; media bytes are delivered by Instagram, not proxied through this Worker. Signed CDN URLs expire and may be restricted. Some browsers play the video rather than forcing a download; use the browser’s save or download option.
- Errors return JSON without stack traces. Bad input is 400; 404 means upstream indicated unavailability, not proof of deletion; ambiguous upstream failures return 502.

The rate limiter targets **10 API requests per IP per fixed minute**, storing short-lived hashed-IP keys in KV; the Worker fails closed if the binding is missing. KV reads are eventually consistent and list/put is not atomic: concurrent or cross-region requests can exceed the target. KV is not a strict security boundary and incurs usage costs. Use a Durable Object or Cloudflare's rate-limiting product if a hard global limit is required. Set Cloudflare WAF/rate-limit rules for abuse protection, including asset routes. In local development, all clients without `CF-Connecting-IP` share one bucket.

## Regional placement

`wrangler.toml` requests placement near AWS `us-east-1` as a best-effort mitigation for Instagram returning empty public embed data in some Cloudflare regions. The Worker remains on Cloudflare, and media downloads still go directly to Instagram’s CDN. Placement can increase latency for visitors farther away, may change during Cloudflare maintenance, and cannot guarantee that Instagram returns media. You can remove `[placement]` to restore default edge placement or change the region and redeploy. Verify from the affected location; a `cf-placement` header alone does not guarantee the subrequest egress location. See [Cloudflare placement documentation](https://developers.cloudflare.com/workers/configuration/placement/).

## Troubleshooting lookup failures

Instagram may respond differently by Cloudflare region or over time. If a public post fails, open **Workers & Pages → dlsta → Logs → Live**, then retry it. A failed lookup emits an `Instagram lookup failed:` message containing only stage names, upstream HTTP status codes and broad error categories, including whether an embed has null context or lacks a video URL (not the Instagram URL, cookies, token, caption or media URL). Share only that message when asking for help; Cloudflare's surrounding request log can contain client IP addresses and request headers. A 200 from Instagram does not by itself guarantee a usable media response. See [Cloudflare real-time logs](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/).

## Cloudflare Free plan usage

The placement hint forwards the same incoming Worker request to the chosen region; it does not itself create a second billable Worker request or proxy the media. Longer network waiting is not billed as CPU time. Upstream responses and actual CPU time can still vary, and more traffic or retries use more quota. See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Placement](https://developers.cloudflare.com/workers/configuration/placement/).

Cloudflare's Free plan currently includes 100,000 Worker requests per day and 10 ms CPU per invocation. KV includes 1,000 writes and 1,000 list requests per day, shared across the account. The API's rate limiter normally makes one list and one write for each request it allows, even if that lookup later fails or contains invalid input; a rate-limited attempt still performs a list. A successful media lookup normally makes one API request; the direct CDN download makes none. In ideal conditions the KV quotas allow roughly **1,000 successful lookups per day** if nothing else uses the quota. Invalid requests, retries, rate-limited traffic, and other applications reduce that number. The exact result is not guaranteed; Instagram availability and the CPU limit also matter.

Once a KV operation quota is exhausted, the API can return errors until the quotas reset at 00:00 UTC. Static CSS, JavaScript and image assets served directly are free and unlimited, but HTML, sitemap and robots requests invoke the Worker so they count against the Worker request limit; a separate GitHub Pages frontend does not consume Cloudflare Worker requests for page views, but its API calls still do. On a paid plan, usage beyond included allowances can incur charges. Check the current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), and your dashboard usage before relying on these figures.

## Search visibility and branding

On the combined Cloudflare Worker, the canonical address, social previews, structured data, sitemap and robots file automatically use the current request host. The static GitHub Pages copy defaults to `https://mahimmazidul.github.io/dlsta/`. The existing dlsta mark is provided as an SVG, PNG favicons, an Apple touch icon and web manifest icons; `public/images/social-card.png` is the 1200×630 social preview. API responses send `X-Robots-Tag: noindex, nofollow`.

Before promoting the GitHub Pages URL, deploy the Worker and set `WORKER_URL` as described above; otherwise the page loads but media lookups cannot work. Search metadata cannot replace a working backend.

1. Deploy the site, then add your preferred URL-prefix property to [Google Search Console](https://search.google.com/search-console/): your Worker/custom-domain URL, or `https://mahimmazidul.github.io/dlsta/` for GitHub Pages. Verify ownership using an available method, such as adding the supplied HTML verification file to `public/` and redeploying.
2. Submit the sitemap under that address (for example, `https://your-subdomain.example/sitemap.xml`) and optionally request indexing of the homepage with URL Inspection. Crawling and indexing are not guaranteed and may take time.
3. The GitHub Pages site is in a **subdirectory**. Search crawlers read `robots.txt` at the **hostname root**, not `dlsta/robots.txt`; submit its sitemap directly. A combined Worker generates its own root robots and sitemap files. Google generally chooses one search favicon per hostname, so it may not display this project's icon independently for a subdirectory.
4. For a separate static deployment or fork, replace the absolute canonical, Open Graph, Twitter and JSON-LD URLs in `public/index.html`, the `<loc>` in `public/sitemap.xml`, and the sitemap URL in `public/robots.txt`. Update the SEO test’s static canonical URL to match. A combined Worker automatically generates these URLs from its own hostname.

## License and credit

[Apache License 2.0](LICENSE). Copyright 2026 Md. Mazidul Islam Mahim. The self-hosted DM Sans and Instrument Serif font files are licensed separately under the SIL Open Font License 1.1; see `public/fonts/DM-Sans-OFL.txt` and `public/fonts/Instrument-Serif-OFL.txt`. See [NOTICE](NOTICE) for attribution. dlsta is not affiliated with Instagram or Meta.

## Verification

See `RESEARCH.md` for the repository audit, test results, limitations, and attribution. `test/live-results.json` contains time-sensitive raw responses from the initial comparative tests; signed URLs in those responses will expire. Run `npm test` for offline unit tests. Test results are snapshots, not guarantees of future Instagram behavior.
````

## Android beta implementation

The Android project is in `android/`, with manual-only build and emulator checks in `.github/workflows/android.yml`. It uses native Android views, looks up public Instagram media on the device without a Cloudflare fallback, validates direct CDN URLs, and serially persists media through WorkManager and MediaStore. See the README and the Android source for current behavior and limitations.


On 2026-10-31, Android 15 emulator tests using the public-fetcher request identity resolved three real public reels, saved the `De3hNM7x4jE` reel, saved three items of the `DfGUZ1GjB-A` carousel, and confirmed repeat saves skipped existing files. Results depend on Instagram responses and do not establish success on every device or with every reel.
