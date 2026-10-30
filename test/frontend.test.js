import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function setup({hostname = 'app.example', clipboard = true} = {}) {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const elements = {};
  for (const id of ['form', 'message', 'result', 'submit', 'download', 'copy', 'direct-url', 'url', 'image-wrap', 'thumbnail', 'caption']) {
    elements[id] = {value: '', textContent: '', hidden: false, dataset: {}, events: {}, firstElementChild: {textContent: ''},
      addEventListener(type, fn) { this.events[type] = fn; }, focus() { this.focused = true; }, select() { this.selected = true; }};
  }
  elements.url.value = 'https://www.instagram.com/reel/example/';
  let copied = '';
  const context = {URL, window: {location: {hostname}}, document: {querySelector: selector => elements[selector.slice(1)]},
    navigator: clipboard ? {clipboard: {writeText: async value => { copied = value; }}} : {},
    fetch: async () => new Response(JSON.stringify({success: true, videoUrl: 'https://media.fbcdn.net/video.mp4?x=1', thumbnailUrl: 'https://media.fbcdn.net/thumb.jpg', caption: 'Hello'})),
    setTimeout: () => {}};
  vm.runInNewContext(source, context);
  return {elements, copied: () => copied};
}

test('result presents and copies a direct CDN link', async () => {
  const {elements, copied} = await setup();
  await elements.form.events.submit({preventDefault() {}});
  assert.equal(elements.result.hidden, false);
  assert.equal(elements.download.href, 'https://media.fbcdn.net/video.mp4?x=1');
  assert.equal(elements['direct-url'].value, elements.download.href);
  await elements.copy.events.click();
  assert.equal(copied(), elements.download.href);
  assert.equal(elements.copy.textContent, 'Copied!');
});

test('copy fallback selects the URL when clipboard access is unavailable', async () => {
  const {elements} = await setup({clipboard: false});
  await elements.form.events.submit({preventDefault() {}});
  await elements.copy.events.click();
  assert.equal(elements['direct-url'].selected, true);
  assert.match(elements.message.textContent, /Link selected/);
});

test('GitHub Pages reports an unconfigured Worker without contacting an API', async () => {
  const {elements} = await setup({hostname: 'mahimmazidul.github.io'});
  await elements.form.events.submit({preventDefault() {}});
  assert.equal(elements.result.hidden, true);
  assert.match(elements.message.textContent, /not configured/);
});
