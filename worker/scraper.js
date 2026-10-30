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
