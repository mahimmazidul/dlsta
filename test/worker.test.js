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
  for(let i=0;i<9;i++) await worker.fetch(req(''),e);
  r=await worker.fetch(req(''),e); assert.equal(r.status,429);
  r=await worker.fetch(req(''),{}); assert.equal(r.status,503);
  assert.doesNotMatch(await r.text(), /stack|worker\/index/);
});
test('html scraping returns direct CDN links and the proxy endpoint is removed', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async () => new Response('<meta property="og:video" content="https://a.fbcdn.net/v.mp4"><meta name="og:description" content="Hello &amp; bye">',{status:200});
    assert.deepEqual(await scrapeInstagram('https://instagram.com/reel/abc/'), {videoUrl:'https://a.fbcdn.net/v.mp4', thumbnailUrl:'', caption:'Hello & bye'});
    const response = await worker.fetch(req('https://instagram.com/reel/abc/'),env());
    const payload = await response.json();
    assert.equal(payload.success,true);
    assert.equal(payload.videoUrl,'https://a.fbcdn.net/v.mp4');
    const removed = await worker.fetch(new Request('https://app.example/api/proxy?url=https%3A%2F%2Fa.fbcdn.net%2Fa'),env());
    assert.equal(removed.status,404);
  } finally {globalThis.fetch=original;}
});
