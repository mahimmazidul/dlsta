import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function setup({hostname = 'app.example', clipboard = true, photo = false} = {}) {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const elements = {};
  for (const id of ['form', 'message', 'result', 'submit', 'download', 'copy', 'direct-url', 'url', 'image-wrap', 'thumbnail', 'caption', 'result-title']) {
    elements[id] = {value: '', textContent: '', hidden: false, dataset: {}, events: {}, firstElementChild: {textContent: ''}, firstChild: {textContent: ''},
      addEventListener(type, fn) { this.events[type] = fn; }, focus() { this.focused = true; }, select() { this.selected = true; }};
  }
  elements.url.value = 'https://www.instagram.com/reel/example/';
  let copied = '';
  const doc = {events: {}, activeElement: null, querySelector: selector => elements[selector.slice(1)], addEventListener(type, fn) { this.events[type] = fn; }};
  const context = {URL, window: {location: {hostname}}, document: doc,
    navigator: clipboard ? {clipboard: {writeText: async value => { copied = value; }}} : {},
    fetch: async () => new Response(JSON.stringify(photo ? {success:true, mediaType:'photo', mediaUrl:'https://media.fbcdn.net/photo.jpg', thumbnailUrl:'https://media.fbcdn.net/photo.jpg', caption:'A photo'} : {success: true, mediaType:'video', mediaUrl:'https://media.fbcdn.net/video.mp4?x=1', videoUrl: 'https://media.fbcdn.net/video.mp4?x=1', thumbnailUrl: 'https://media.fbcdn.net/thumb.jpg', caption: 'Hello'})),
    setTimeout: () => {}};
  vm.runInNewContext(source, context);
  return {elements, doc, copied: () => copied};
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

test('desktop paste routes valid Instagram links into the input without submitting', async () => {
  const {elements, doc} = await setup();
  let prevented = false;
  const url = 'https://www.instagram.com/reel/ABC_123/?utm_source=share';
  doc.events.paste({clipboardData:{getData:()=>url}, preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(elements.url.value,url);
  assert.equal(elements.url.focused,true);
  assert.equal(elements.result.hidden,false); // no network request was automatically submitted
});

test('paste does not hijack editing in other controls or unrelated text', async () => {
  const {elements, doc} = await setup();
  const initial = elements.url.value;
  let prevented = false;
  doc.activeElement = {tagName:'INPUT'};
  doc.events.paste({clipboardData:{getData:()=> 'https://instagram.com/p/abc/'}, preventDefault(){prevented=true;}});
  assert.equal(prevented,false);
  assert.equal(elements.url.value,initial);
  doc.activeElement = null;
  doc.events.paste({clipboardData:{getData:()=> 'https://example.com/p/abc/'}, preventDefault(){prevented=true;}});
  assert.equal(prevented,false);
  assert.equal(elements.url.value,initial);
});


test('photo result displays and copies the direct photo URL', async () => {
  const {elements, copied} = await setup({photo:true});
  await elements.form.events.submit({preventDefault(){}});
  assert.equal(elements.download.href, 'https://media.fbcdn.net/photo.jpg');
  assert.equal(elements['result-title'].textContent, 'Your photo is ready.');
  assert.match(elements.download.firstChild.textContent, /photo/);
  await elements.copy.events.click();
  assert.equal(copied(), 'https://media.fbcdn.net/photo.jpg');
});
