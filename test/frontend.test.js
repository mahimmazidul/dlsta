import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function setup({hostname = 'app.example', clipboard = true, photo = false, payload = null, clipText = '', readFails = false} = {}) {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const elements = {};
  for (const id of ['form', 'message', 'result', 'submit', 'download', 'copy', 'direct-url', 'url', 'image-wrap', 'thumbnail', 'caption', 'result-title', 'media-list', 'media-count']) {
    elements[id] = {value: '', textContent: '', hidden: false, dataset: {}, events: {}, firstElementChild: {textContent: ''}, firstChild: {textContent: ''},
      addEventListener(type, fn) { this.events[type] = fn; }, focus() { this.focused = true; }, select() { this.selected = true; }};
  }
  elements.url.value = 'https://www.instagram.com/reel/example/';
  let copied = '';
  const requests = [];
  elements['media-list'].children = [];
  elements['media-list'].replaceChildren = function() { this.children = []; };
  elements['media-list'].appendChild = function(child) { this.children.push(child); };
  const createElement = () => ({children:[], attributes:{}, events:{}, appendChild(child){this.children.push(child);}, setAttribute(k,v){this.attributes[k]=v;}, addEventListener(k,v){this.events[k]=v;}});
  const doc = {createElement, events: {}, activeElement: null, querySelector: selector => elements[selector.slice(1)], addEventListener(type, fn) { this.events[type] = fn; }};
  const context = {URL, window: {location: {hostname}}, document: doc,
    navigator: clipboard ? {clipboard: {writeText: async value => { copied = value; }, readText: async () => { if (readFails) throw new Error('denied'); return clipText; }}} : {},
    fetch: async url => { requests.push(String(url)); return new Response(JSON.stringify(payload || (photo ? {success:true, mediaType:'photo', mediaUrl:'https://media.fbcdn.net/photo.jpg', thumbnailUrl:'https://media.fbcdn.net/photo.jpg', caption:'A photo'} : {success: true, mediaType:'video', mediaUrl:'https://media.fbcdn.net/video.mp4?x=1', videoUrl: 'https://media.fbcdn.net/video.mp4?x=1', thumbnailUrl: 'https://media.fbcdn.net/thumb.jpg', caption: 'Hello'}))); },
    setTimeout: () => {}};
  vm.runInNewContext(source, context);
  return {elements, doc, requests, copied: () => copied};
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


test('Worker and custom domains call the same-origin API automatically', async () => {
  for (const hostname of ['dlsta.example.workers.dev', 'save.example.com']) {
    const {elements, requests} = await setup({hostname});
    await elements.form.events.submit({preventDefault(){}});
    assert.equal(requests.length, 1);
    assert.equal(requests[0], '/api/scrape');
  }
});


test('carousel shows all items and updates direct link when selected', async () => {
  const payload={success:true, mediaType:'photo',mediaUrl:'https://x.fbcdn.net/1.jpg',thumbnailUrl:'https://x.fbcdn.net/1.jpg',caption:'',totalItems:3,partial:false,items:[1,2,3].map(i=>({position:i,mediaType:'photo',available:true,mediaUrl:`https://x.fbcdn.net/${i}.jpg`,thumbnailUrl:`https://x.fbcdn.net/${i}.jpg`}))};
  const {elements,copied}=await setup({payload});
  await elements.form.events.submit({preventDefault(){}});
  assert.equal(elements['media-list'].children.length,3); assert.equal(elements['media-list'].hidden,false);
  elements['media-list'].children[2].events.click();
  assert.equal(elements.download.href,'https://x.fbcdn.net/3.jpg');
  assert.equal(elements['direct-url'].value,'https://x.fbcdn.net/3.jpg');
  await elements.copy.events.click(); assert.equal(copied(),'https://x.fbcdn.net/3.jpg');
});


test('one-tap paste reads clipboard only on submit and automatically fetches', async () => {
  const url='https://www.instagram.com/reel/ABC_123/?share=1';
  const {elements,requests} = await setup({clipText:url});
  elements.url.value='';
  await elements.form.events.submit({preventDefault(){}});
  assert.equal(elements.url.value,url); assert.equal(requests.length,1);
  assert.equal(elements.result.hidden,false);
});

test('clipboard denial or invalid clipboard leaves input usable and does not fetch', async () => {
  for (const opts of [{readFails:true},{clipText:'https://evil.test/reel/example/'}]) {
    const {elements,requests} = await setup(opts); elements.url.value='';
    await elements.form.events.submit({preventDefault(){}});
    assert.equal(requests.length,0); assert.equal(elements.url.focused,true);
    assert.match(elements.message.textContent,/Clipboard access|valid public Instagram/);
    assert.equal(elements.submit.disabled,false);
  }
});
