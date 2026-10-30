import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const read = file => readFile(path.join(publicDir, file), 'utf8');
const canonical = 'https://mahimmazidul.github.io/dlsta/';

test('canonical, social preview and structured data use the same site URL', async () => {
  const html = await read('index.html');
  assert.match(html, /<title>dlsta — Instagram Photo, Reel &amp; Video Downloader<\/title>/);
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
  assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
  assert.ok(html.includes(`<meta property="og:image" content="${canonical}images/social-card.png">`));
  assert.ok(html.includes(`<meta name="twitter:image" content="${canonical}images/social-card.png">`));
  const script = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(script, 'JSON-LD must be present in the server-rendered HTML');
  const schema = JSON.parse(script[1]);
  assert.equal(schema['@type'], 'WebApplication');
  assert.equal(schema.name, 'dlsta');
  assert.equal(schema.url, canonical);
  assert.match(await read('sitemap.xml'), /<loc>https:\/\/mahimmazidul\.github\.io\/dlsta\/<\/loc>/);
});

test('favicon, touch icons and social artwork have the expected dimensions', async () => {
  for (const [file, width, height] of [['favicon-96.png',96,96], ['apple-touch-icon.png',180,180], ['icon-192.png',192,192], ['icon-512.png',512,512], ['images/social-card.png',1200,630]]) {
    const png = await readFile(path.join(publicDir, file));
    assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a', file);
    assert.equal(png.readUInt32BE(16), width, file);
    assert.equal(png.readUInt32BE(20), height, file);
  }
  const manifest = JSON.parse(await read('site.webmanifest'));
  assert.equal(manifest.short_name, 'dlsta');
  assert.deepEqual(manifest.icons.map(icon => icon.src), ['icon-192.png', 'icon-512.png']);
  assert.match(await read('robots.txt'), /Disallow: \/api\//);
});
