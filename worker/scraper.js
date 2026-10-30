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
