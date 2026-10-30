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
