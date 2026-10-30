import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {validMediaUrl, normalizeInstagramUrl, scrapeInstagram} from '../worker/scraper.js';

const kv = () => { const keys = new Map(); return {list: async ({prefix}) => ({keys:[...keys.keys()].filter(k => k.startsWith(prefix)).map(name=>({name}))}), put: async (k,v) => keys.set(k,v)}; };
const env = () => ({RATE_LIMIT: kv()});
const req = (url, method='POST') => new Request('https://app.example/api/scrape', {method, headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify({url})});
test('input validation prevents host and credential bypass', () => {
  assert.equal(normalizeInstagramUrl('https://www.instagram.com/reel/abc_123/?x=1'),'https://www.instagram.com/reel/abc_123/');
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
    assert.deepEqual(record, ['Instagram lookup failed:', '{"embed":403,"page":403,"home":200,"graphql":429}']);
    assert.doesNotMatch(JSON.stringify(record), /secretpost|personal|private response|cookie|csrftoken/);
    assert.doesNotMatch(await response.text(), /stack|graphql|429/);
  } finally {globalThis.fetch = originalFetch; console.warn = originalWarn;}
});
