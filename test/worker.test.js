import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {validMediaUrl, normalizeInstagramUrl, scrapeInstagram, parseEmbedMedia, parsePublicJsonMedia} from '../worker/scraper.js';

const kv = () => { const keys = new Map(); return {list: async ({prefix}) => ({keys:[...keys.keys()].filter(k => k.startsWith(prefix)).map(name=>({name}))}), put: async (k,v) => keys.set(k,v)}; };
const env = () => ({RATE_LIMIT: kv()});
const req = (url, method='POST') => new Request('https://app.example/api/scrape', {method, headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify({url})});
test('input validation prevents host and credential bypass', () => {
  assert.equal(normalizeInstagramUrl('https://www.instagram.com/reel/abc_123/?x=1'),'https://www.instagram.com/reel/abc_123/');
  assert.equal(normalizeInstagramUrl('https://www.instagram.com/reels/De3hNM7x4jE/?s=1'),'https://www.instagram.com/reel/De3hNM7x4jE/');
  for (const s of ['', 'https://youtube.com/reel/abc/', 'https://instagram.com.evil.com/reel/abc/', 'https://instagram.com@evil.com/reel/abc/', 'http://instagram.com/reel/abc/', 'https://instagram.com/stories/foo/1']) assert.throws(() => normalizeInstagramUrl(s));
});
test('CDN validation rejects lookalikes, credentials, ports', () => {
  assert.equal(validMediaUrl('https://scontent.cdninstagram.com/a.mp4'),true);
  for (const s of ['http://cdninstagram.com/a', 'https://cdninstagram.com.evil.org/a','https://evil.org/?cdninstagram.com','https://x.fbcdn.net:444/a','https://u@x.fbcdn.net/a']) assert.equal(validMediaUrl(s),false);
});
test('bad input, rate limit, and missing KV do not expose details', async () => {
  const e = env();
  let r = await worker.fetch(req('https://youtube.com/watch?v=test'),e); assert.equal(r.status,400);
  assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  for(let i=0;i<9;i++) await worker.fetch(req(''),e);
  r=await worker.fetch(req(''),e); assert.equal(r.status,429);
  r=await worker.fetch(req(''),{}); assert.equal(r.status,503);
  assert.doesNotMatch(await r.text(), /stack|worker\/index/);
});
test('html scraping returns direct CDN links and the proxy endpoint is removed', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async () => new Response('<meta property="og:video" content="https://a.fbcdn.net/v.mp4"><meta name="og:description" content="Hello &amp; bye">',{status:200});
    assert.deepEqual(await scrapeInstagram('https://instagram.com/reel/abc/'), {mediaType:'video', mediaUrl:'https://a.fbcdn.net/v.mp4', videoUrl:'https://a.fbcdn.net/v.mp4', thumbnailUrl:'', caption:'Hello & bye'});
    const response = await worker.fetch(req('https://instagram.com/reel/abc/'),env());
    const payload = await response.json();
    assert.equal(payload.success,true);
    assert.equal(payload.videoUrl,'https://a.fbcdn.net/v.mp4');
    const removed = await worker.fetch(new Request('https://app.example/api/proxy?url=https%3A%2F%2Fa.fbcdn.net%2Fa'),env());
    assert.equal(removed.status,404);
  } finally {globalThis.fetch=original;}
});

test('photo extraction returns the first actual photo, not a video cover', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (target) => {
      if (String(target).includes('/graphql/query')) return new Response(JSON.stringify({data:{xdt_api__v1__media__shortcode__web_info:{items:[{media_type: 1, image_versions2:{candidates:[{url:'https://x.fbcdn.net/photo.jpg'}]}, caption:{text:'Photo caption'}}]}}}));
      return new Response('<html></html>');
    };
    const result = await scrapeInstagram('https://instagram.com/p/abc/');
    assert.deepEqual(result, {mediaType:'photo', mediaUrl:'https://x.fbcdn.net/photo.jpg', photoUrl:'https://x.fbcdn.net/photo.jpg', thumbnailUrl:'https://x.fbcdn.net/photo.jpg', caption:'Photo caption'});
    globalThis.fetch = async (target) => String(target).includes('/graphql/query')
      ? new Response(JSON.stringify({data:{xdt_api__v1__media__shortcode__web_info:{items:[{media_type:2,image_versions2:{candidates:[{url:'https://x.fbcdn.net/cover.jpg'}]}}]}}}))
      : new Response('<html></html>');
    await assert.rejects(scrapeInstagram('https://instagram.com/p/abc/'), /UPSTREAM/);
  } finally { globalThis.fetch = original; }
});

test('unavailable KV returns 503 and oversized request body returns 413', async () => {
  const broken = {RATE_LIMIT:{list: async () => {throw new Error('KV unavailable');}}};
  assert.equal((await worker.fetch(req('https://instagram.com/p/abc/'), broken)).status, 503);
  const huge = new Request('https://app.example/api/scrape', {method:'POST', body:'x'.repeat(5000)});
  assert.equal((await worker.fetch(huge, env())).status, 413);
});


test('failed upstream lookup produces sanitized stage diagnostics without leaking URL or response body', async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let record;
  try {
    console.warn = (...args) => { record = args; };
    globalThis.fetch = async target => {
      if (String(target).includes('/graphql/query')) return new Response('private response detail', {status: 429});
      if (String(target) === 'https://www.instagram.com/') return new Response('visitor page', {status: 200});
      return new Response('private response detail', {status: 403});
    };
    const response = await worker.fetch(req('https://instagram.com/p/secretpost/?personal=secret'), env());
    assert.equal(response.status, 502);
    assert.deepEqual(record, ['Instagram lookup failed:', '{"embed":403,"alternateEmbed":403,"plainEmbed":403,"page":403,"home":200,"graphql":429}']);
    assert.doesNotMatch(JSON.stringify(record), /secretpost|personal|private response|cookie|csrftoken/);
    assert.doesNotMatch(await response.text(), /stack|graphql|429/);
  } finally {globalThis.fetch = originalFetch; console.warn = originalWarn;}
});


test('embed structured context recovers first carousel photo when GraphQL has no item', async () => {
  const originalFetch = globalThis.fetch;
  const root = {shortcode:'DfGUZ1GjB-A', __typename:'GraphSidecar', is_video:false,
    edge_media_to_caption:{edges:[{node:{text:'Example caption'}}]},
    edge_sidecar_to_children:{edges:[{node:{shortcode:'child', is_video:false, display_url:'https://x.cdninstagram.com/first.jpg'}},
      {node:{is_video:true, display_url:'https://x.cdninstagram.com/cover.jpg'}}]}};
  const context = JSON.stringify({context:{shortcode:root.shortcode},gql_data:{shortcode_media:root}});
  const embed = `<script>{"contextJSON":${JSON.stringify(context)}}</script>`;
  try {
    let graphqlCalls = 0;
    globalThis.fetch = async target => {
      if (String(target).includes('/graphql/query')) { graphqlCalls++; return new Response('{"data":null}'); }
      if (String(target).includes('/embed/captioned/')) return new Response(embed);
      return new Response('<html></html>');
    };
    const result = await scrapeInstagram('https://www.instagram.com/p/DfGUZ1GjB-A/?cplk=test');
    assert.equal(result.mediaUrl,'https://x.cdninstagram.com/first.jpg');
    assert.equal(result.caption,'Example caption');
    assert.equal(result.items.length,2);
    assert.equal(result.items[1].available,false);
    assert.equal(result.partial,true);
    assert.equal(graphqlCalls,0);
  } finally {globalThis.fetch = originalFetch;}
});

test('embed context rejects mismatched posts, unknown types, unsafe links and video covers', () => {
  const embed = root => `<script>{"contextJSON":${JSON.stringify(JSON.stringify({context:{shortcode:root.shortcode},gql_data:{shortcode_media:root}}))}}</script>`;
  assert.equal(parseEmbedMedia(embed({shortcode:'other',is_video:false,display_url:'https://x.fbcdn.net/p.jpg'}),'wanted'),null);
  assert.equal(parseEmbedMedia(embed({shortcode:'wanted',display_url:'https://x.fbcdn.net/p.jpg'}),'wanted'),null);
  assert.equal(parseEmbedMedia(embed({shortcode:'wanted',is_video:false,display_url:'https://fbcdn.net.evil.test/p.jpg'}),'wanted'),null);
  assert.equal(parseEmbedMedia(embed({shortcode:'wanted',is_video:true,display_url:'https://x.fbcdn.net/cover.jpg'}),'wanted'),null);
  assert.equal(parseEmbedMedia(embed({shortcode:'wanted',__typename:'GraphSidecar',is_video:false,display_url:'https://x.fbcdn.net/cover.jpg'}),'wanted'),null);
  const video = parseEmbedMedia(embed({shortcode:'wanted',__typename:'GraphVideo',is_video:true,display_url:'https://x.fbcdn.net/cover.jpg',video_url:'https://x.fbcdn.net/v.mp4'}),'wanted');
  assert.equal(video.mediaType,'video'); assert.equal(video.videoUrl,'https://x.fbcdn.net/v.mp4');
  assert.equal(parseEmbedMedia('<script>{"contextJSON":"broken"}</script>','wanted'),null);
});


test('carousel returns all available items and picks largest safe rendition', () => {
  const photo = (i) => ({is_video:false, display_url:`https://x.fbcdn.net/fallback${i}.jpg`, display_resources:[
    {src:`https://x.fbcdn.net/small${i}.jpg`,config_width:320,config_height:320},
    {src:`https://x.fbcdn.net/large${i}.jpg`,config_width:1440,config_height:1440},
    {src:'https://fbcdn.net.evil.test/bad.jpg',config_width:9999,config_height:9999}]});
  const root = {shortcode:'abc',__typename:'GraphSidecar',edge_sidecar_to_children:{edges:[{node:photo(1)},{node:photo(2)},{node:{media_type:2,video_versions:[{url:'https://x.fbcdn.net/low.mp4',width:320,height:480},{url:'https://x.fbcdn.net/high.mp4',width:1080,height:1920}],image_versions2:{candidates:[{url:'https://x.fbcdn.net/cover.jpg',width:320,height:320}]}}}]}};
  const html = `<script>{"contextJSON":${JSON.stringify(JSON.stringify({gql_data:{shortcode_media:root}}))}}</script>`;
  const result = parseEmbedMedia(html,'abc');
  assert.equal(result.totalItems,3); assert.equal(result.partial,false);
  assert.deepEqual(result.items.map(x=>x.mediaUrl),['https://x.fbcdn.net/large1.jpg','https://x.fbcdn.net/large2.jpg','https://x.fbcdn.net/high.mp4']);
  assert.equal(result.items[2].mediaType,'video');
});

test('GraphQL fallback returns all carousel candidates and marks unavailable items', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async target => String(target).includes('/graphql/query') ? new Response(JSON.stringify({data:{xdt_api__v1__media__shortcode__web_info:{items:[{carousel_media:[{media_type:1,image_versions2:{candidates:[{url:'https://x.fbcdn.net/low.jpg',width:100,height:100},{url:'https://x.fbcdn.net/high.jpg',width:900,height:900}]}},{media_type:2,image_versions2:{candidates:[{url:'https://x.fbcdn.net/cover.jpg',width:300,height:300}]}}]}]}}})) : new Response('<html></html>');
    const result=await scrapeInstagram('https://instagram.com/p/abc/');
    assert.equal(result.items[0].mediaUrl,'https://x.fbcdn.net/high.jpg');
    assert.equal(result.items[1].available,false); assert.equal(result.totalItems,2); assert.equal(result.partial,true);
  } finally {globalThis.fetch=original;}
});


test('alternate public post embed recovers a reel when its reel embed is unavailable', async () => {
  const original=globalThis.fetch; const calls=[];
  const root={shortcode:'reel123',__typename:'GraphVideo',is_video:true,video_url:'https://x.fbcdn.net/video.mp4'};
  const html=`<script>{"contextJSON":${JSON.stringify(JSON.stringify({context:{shortcode:'reel123'},gql_data:{shortcode_media:root}}))}}</script>`;
  try {
    globalThis.fetch=async target => {const u=String(target);calls.push(u);return u.includes('/p/reel123/embed/captioned/') ? new Response(html) : new Response('<html></html>');};
    const r=await scrapeInstagram('https://instagram.com/reel/reel123/');
    assert.equal(r.videoUrl,'https://x.fbcdn.net/video.mp4');
    assert.ok(calls.some(u=>u.includes('/reel/reel123/embed/')));
    assert.ok(calls.some(u=>u.includes('/p/reel123/embed/')));
    assert.equal(calls.some(u=>u.includes('/graphql/query')),false);
  } finally {globalThis.fetch=original;}
});

test('embed diagnostics describe missing video safely without leaking content', () => {
  const root={shortcode:'abc',__typename:'GraphVideo',is_video:true,display_url:'https://x.fbcdn.net/cover.jpg'};
  const html=`<script>{"contextJSON":${JSON.stringify(JSON.stringify({gql_data:{shortcode_media:root}}))}}</script>`;
  let detail; assert.equal(parseEmbedMedia(html,'abc',value=>{detail=value;}),null);assert.equal(detail,'video_url_missing');
});


test('unavailable context is classified without exposing media or post URL', () => {
  let detail;
  assert.equal(parseEmbedMedia('<script>{"contextJSON":null}</script>','abc',x=>{detail=x;}), null);
  assert.equal(detail, 'context_null');
});

test('public JSON script fallback requires the target shortcode and direct allowed media', () => {
  const video={shortcode:'abc',is_video:true,video_url:'https://x.fbcdn.net/video.mp4'};
  const other={shortcode:'other',is_video:true,video_url:'https://x.fbcdn.net/wrong.mp4'};
  const page=`<script type="application/json">${JSON.stringify({data:{decoy:other,post:video}})}</script>`;
  assert.equal(parsePublicJsonMedia(page,'abc').videoUrl,'https://x.fbcdn.net/video.mp4');
  assert.equal(parsePublicJsonMedia(page,'missing'),null);
  const cover=`<script type="application/json">${JSON.stringify({shortcode:'abc',is_video:true,display_url:'https://x.fbcdn.net/cover.jpg'})}</script>`;
  assert.equal(parsePublicJsonMedia(cover,'abc'),null);
});

test('post can recover from its alternate public reel embed', async () => {
  const original=globalThis.fetch; const calls=[];
  const root={shortcode:'abc',__typename:'GraphImage',is_video:false,display_url:'https://x.fbcdn.net/photo.jpg'};
  const html=`<script>{"contextJSON":${JSON.stringify(JSON.stringify({gql_data:{shortcode_media:root}}))}}</script>`;
  try {
    globalThis.fetch=async target=>{const u=String(target);calls.push(u);return u.includes('/reel/abc/embed/captioned/')?new Response(html):new Response('<html></html>');};
    const r=await scrapeInstagram('https://instagram.com/p/abc/');
    assert.equal(r.photoUrl,'https://x.fbcdn.net/photo.jpg');assert.ok(calls.some(u=>u.includes('/reel/abc/embed/')));
  } finally {globalThis.fetch=original;}
});


test('video rendition selection uses dimensions first and bitrate as a tie breaker', () => {
  const root={shortcode:'abc',media_type:2,video_versions:[
    {url:'https://x.fbcdn.net/high-resolution.mp4',width:1080,height:1920,bitrate:500000},
    {url:'https://x.fbcdn.net/high-bitrate-small.mp4',width:720,height:1280,bitrate:5000000},
    {url:'https://x.fbcdn.net/best.mp4',width:1080,height:1920,bitrate:1500000},
    {url:'https://fbcdn.net.evil.test/unsafe.mp4',width:3000,height:5000,bitrate:9999999}]};
  const html=`<script>{"contextJSON":${JSON.stringify(JSON.stringify({gql_data:{shortcode_media:root}}))}}</script>`;
  assert.equal(parseEmbedMedia(html,'abc').videoUrl,'https://x.fbcdn.net/best.mp4');
});
