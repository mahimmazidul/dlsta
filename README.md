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
