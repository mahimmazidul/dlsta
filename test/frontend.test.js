import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function setup({hostname = 'app.example', clipboard = true, photo = false, payload = null, clipText = '', readFails = false, deferred = false, responseStatus = 200, mediaType = 'image/webp', mediaFail = false, deferredMedia = false} = {}) {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const elements = {};
  for (const id of ['form', 'message', 'loading', 'loading-hint', 'result', 'submit', 'download', 'save-media', 'download-status', 'copy', 'direct-url', 'url', 'image-wrap', 'thumbnail', 'preview-empty', 'preview-prev', 'preview-next', 'preview-counter', 'caption', 'result-title', 'media-list', 'media-count']) {
    elements[id] = {value: '', textContent: '', hidden: false, dataset: {}, events: {}, firstElementChild: {textContent: ''}, firstChild: {textContent: ''},
      style: {}, scrollHeight: 120, scrollLeft: 0, setPointerCapture(id) { this.pointerCapture = id; }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this[name]; },
      addEventListener(type, fn) { this.events[type] = fn; }, focus() { this.focused = true; }, select() { this.selected = true; }};
  }
  elements.url.value = 'https://www.instagram.com/reel/example/';
  let copied = '';
  const requests = []; const requestBodies = [];
  let release; let releaseMedia;
  const mediaGate = deferredMedia ? new Promise(resolve => { releaseMedia = resolve; }) : null;
  const gate = deferred ? new Promise(resolve => { release = resolve; }) : null;
  let intervalCallback; let cleared = false;
  elements['media-list'].children = [];
  elements['media-list'].replaceChildren = function() { this.children = []; };
  elements['media-list'].appendChild = function(child) { this.children.push(child); };
  const saved = []; let savedBlob;
  class TestURL extends URL { static createObjectURL(blob) { savedBlob = blob; return 'blob:test'; } static revokeObjectURL() {} }
  const createElement = () => ({children:[], attributes:{}, events:{}, appendChild(child){this.children.push(child);}, setAttribute(k,v){this.attributes[k]=v;}, addEventListener(k,v){this.events[k]=v;}, click(){saved.push({href:this.href, name:this.download});}, remove(){}});
  const doc = {createElement, body:{appendChild(){}}, events: {}, activeElement: null, querySelector: selector => elements[selector.slice(1)], addEventListener(type, fn) { this.events[type] = fn; }};
  const context = {URL:TestURL, window: {location: {hostname}, events: {}, addEventListener(type, fn) { this.events[type] = fn; }}, document: doc,
    navigator: clipboard ? {clipboard: {writeText: async value => { copied = value; }, readText: async () => { if (readFails) throw new Error('denied'); return clipText; }}} : {},
    fetch: async (url, options) => { if (String(url) !== '/api/scrape') { if (mediaFail) throw new Error('CORS'); if (mediaGate) await mediaGate; return new Response('original bytes', {headers:{'Content-Type':mediaType}}); } requests.push(String(url)); requestBodies.push(JSON.parse(options.body)); if (gate) await gate; return new Response(JSON.stringify(payload || (photo ? {success:true, mediaType:'photo', mediaUrl:'https://media.fbcdn.net/photo.jpg', thumbnailUrl:'https://media.fbcdn.net/photo.jpg', caption:'A photo'} : {success: true, mediaType:'video', mediaUrl:'https://media.fbcdn.net/video.mp4?x=1', videoUrl: 'https://media.fbcdn.net/video.mp4?x=1', thumbnailUrl: 'https://media.fbcdn.net/thumb.jpg', caption: 'Hello'})), {status:responseStatus}); },
    setTimeout: () => {}, setInterval: callback => { intervalCallback = callback; return 1; }, clearInterval: () => { cleared = true; }};
  vm.runInNewContext(source, context);
  return {elements, doc, requests, requestBodies, setClipboard: text => { clipText = text; }, copied: () => copied, saved, savedBlob: () => savedBlob, release, releaseMedia, tick: () => intervalCallback(), cleared: () => cleared};
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
  assert.equal(elements.url.value,''); assert.equal(requests.length,1);
  assert.equal(elements.submit.firstElementChild.textContent,'Paste & get link');
  assert.equal(elements.result.hidden,false);
});

test('clipboard denial or invalid clipboard leaves input usable and does not fetch', async () => {
  for (const opts of [{readFails:true},{clipText:'https://evil.test/reel/example/'}]) {
    const {elements,requests} = await setup(opts); elements.url.value='';
    await elements.form.events.submit({preventDefault(){}});
    assert.equal(requests.length,0); assert.equal(elements.url.value,'');
    if (opts.readFails) assert.equal(elements.url.focused,true);
    else assert.notEqual(elements.url.focused,true);
    assert.equal(elements.submit.firstElementChild.textContent,'Paste & get link');
    assert.match(elements.message.textContent,/Clipboard access|valid public Instagram/);
    assert.equal(elements.submit.disabled,false);
  }
});


test('the flat interface has no horizontal divider borders and retains keyboard focus indicators', async () => {
  const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /border-(?:top|bottom)\s*:/);
  assert.match(css, /input:focus-visible/);
});


test('successful lookup clears the loading announcement and busy state', async () => {
  const {elements} = await setup();
  await elements.form.events.submit({preventDefault() {}});
  assert.equal(elements.form.attributes['aria-busy'], 'false');
  assert.equal(elements.loading.hidden, true);
  assert.equal(elements.message.textContent, '');
  assert.equal(elements.result.hidden, false);
});


test('loading state rotates hints while waiting and clears its timer afterwards', async () => {
  const {elements, release, tick, cleared} = await setup({deferred:true});
  const pending = elements.form.events.submit({preventDefault(){}});
  assert.equal(elements.loading.hidden, false);
  assert.equal(elements.form.attributes['aria-busy'], 'true');
  assert.match(elements['loading-hint'].textContent, /Looking/);
  tick(); assert.match(elements['loading-hint'].textContent, /Carousels/);
  release(); await pending;
  assert.equal(elements.loading.hidden, true);
  assert.equal(elements.form.attributes['aria-busy'], 'false');
  assert.equal(cleared(), true);
});


test('each successful lookup clears the input and supports another one-tap paste', async () => {
  const {elements, requests, requestBodies, setClipboard} = await setup({clipText:'https://instagram.com/p/first/'});
  elements.url.value='';
  await elements.form.events.submit({preventDefault(){}});
  assert.equal(elements.url.value, ''); assert.equal(elements.submit.firstElementChild.textContent, 'Paste & get link');
  assert.equal(elements.result.hidden, false);
  setClipboard('https://instagram.com/reel/second/');
  await elements.form.events.submit({preventDefault(){}});
  assert.equal(requests.length, 2);
  assert.deepEqual(requestBodies.map(x=>x.url), ['https://instagram.com/p/first/','https://instagram.com/reel/second/']);
  assert.equal(elements.url.value, ''); assert.equal(elements.result.hidden, false);
});

test('an invalid manually entered link is cleared without sending a request', async () => {
  for (const text of ['not a url', 'https://example.com/p/foo/', 'https://instagram.com/stories/user/', 'http://instagram.com/p/abc/']) {
    const {elements, requests} = await setup(); elements.url.value = text;
    await elements.form.events.submit({preventDefault(){}});
    assert.equal(requests.length, 0); assert.equal(elements.url.value, '');
    assert.match(elements.message.textContent, /valid public Instagram/);
    assert.equal(elements.submit.firstElementChild.textContent, 'Paste & get link');
    assert.notEqual(elements.url.focused, true);
  }
});

test('a rejected URL is cleared but an upstream failure keeps it for retry', async () => {
  for (const status of [400, 502]) {
    const {elements} = await setup({payload:{success:false,error:'Could not resolve link.'}, responseStatus:status});
    const original = elements.url.value;
    await elements.form.events.submit({preventDefault(){}});
    assert.equal(elements.url.value, status === 400 ? '' : original);
    assert.equal(elements.submit.firstElementChild.textContent, status === 400 ? 'Paste & get link' : 'Get media link');
    assert.match(elements.message.textContent, /Could not resolve/);
  }
});

test('a new link entered during a lookup is not erased by the previous result', async () => {
  const {elements, release} = await setup({deferred:true});
  const pending=elements.form.events.submit({preventDefault(){}});
  elements.url.value='https://instagram.com/p/newer/';
  elements.url.events.input();
  assert.equal(elements.submit.firstElementChild.textContent,'Finding your media…');
  release(); await pending;
  assert.equal(elements.url.value,'https://instagram.com/p/newer/');
  assert.equal(elements.submit.firstElementChild.textContent,'Get media link');
});


test('carousel arrows skip unavailable items and keep preview, direct link and count in sync', async () => {
  const payload = {success:true, mediaType:'photo',mediaUrl:'https://x.fbcdn.net/1.jpg',totalItems:3,partial:true,items:[
    {position:1,mediaType:'photo',available:true,mediaUrl:'https://x.fbcdn.net/1.jpg',thumbnailUrl:'https://x.fbcdn.net/1.jpg'},
    {position:2,mediaType:'video',available:false},
    {position:3,mediaType:'video',available:true,mediaUrl:'https://x.fbcdn.net/3.mp4',thumbnailUrl:''}]};
  const {elements,copied} = await setup({payload});
  await elements.form.events.submit({preventDefault(){}});
  assert.equal(elements['preview-prev'].disabled,true); assert.equal(elements['preview-next'].disabled,false);
  assert.equal(elements['preview-counter'].textContent,'1 / 3'); assert.equal(elements['preview-next'].hidden,false);
  elements['preview-next'].events.click();
  assert.equal(elements.download.href,'https://x.fbcdn.net/3.mp4');
  assert.equal(elements['preview-counter'].textContent,'3 / 3');
  assert.equal(elements['preview-next'].disabled,true); assert.equal(elements['preview-prev'].disabled,false);
  assert.equal(elements['preview-empty'].hidden,false); assert.equal(elements.thumbnail.hidden,true);
  assert.equal(elements['image-wrap'].hidden,false);
  await elements.copy.events.click(); assert.equal(copied(),'https://x.fbcdn.net/3.mp4');
  elements['preview-prev'].events.click(); assert.equal(elements.download.href,'https://x.fbcdn.net/1.jpg');
});

test('preview supports horizontal swipes and keyboard while ignoring vertical gestures', async () => {
  const payload = {success:true,mediaType:'photo',mediaUrl:'https://x.fbcdn.net/1.jpg',totalItems:2,items:[1,2].map(i=>({position:i,mediaType:'photo',available:true,mediaUrl:`https://x.fbcdn.net/${i}.jpg`,thumbnailUrl:`https://x.fbcdn.net/${i}.jpg`}))};
  const {elements} = await setup({payload}); await elements.form.events.submit({preventDefault(){}});
  const start = (x,y) => elements['image-wrap'].events.touchstart({touches:[{clientX:x,clientY:y}]});
  const end = (x,y) => elements['image-wrap'].events.touchend({changedTouches:[{clientX:x,clientY:y}]});
  start(200,50); end(120,53); assert.equal(elements['preview-counter'].textContent,'2 / 2');
  start(100,50); end(108,150); assert.equal(elements['preview-counter'].textContent,'2 / 2');
  let prevented=false;
  elements['image-wrap'].events.keydown({target:elements['image-wrap'],key:'ArrowLeft',preventDefault(){prevented=true;}});
  assert.equal(prevented,true); assert.equal(elements['preview-counter'].textContent,'1 / 2');
  start(200,50); elements['image-wrap'].events.touchcancel(); end(100,50); assert.equal(elements['preview-counter'].textContent,'1 / 2');
});

test('single media has no carousel navigation controls', async () => {
  const {elements} = await setup({photo:true}); await elements.form.events.submit({preventDefault(){}});
  assert.equal(elements['preview-next'].hidden,true); assert.equal(elements['preview-prev'].hidden,true);
  assert.equal(elements['preview-counter'].hidden,true); assert.equal(elements['image-wrap'].attributes.tabindex,'-1');
});


test('direct URL is a single-line input with drag scrolling and copy', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(html, /<input id="direct-url"[^>]*readonly/);
  assert.match(html, /id="save-media"/);
  assert.match(css, /\.direct-link-field input\{[^}]*text-overflow:clip/);
  const {elements,copied} = await setup();
  await elements.form.events.submit({preventDefault(){}});
  const field=elements['direct-url'];
  field.events.pointerdown({isPrimary:true,pointerType:'mouse',button:0,pointerId:7,clientX:200,detail:1,preventDefault(){}});
  field.events.pointermove({pointerId:7,clientX:80});
  assert.equal(field.scrollLeft,120);
  field.events.pointerup({pointerId:7});
  await elements.copy.events.click();
  assert.equal(copied(),elements.download.href);
});

test('named download preserves WebP, JPEG and MP4 bytes and uses response MIME extension', async () => {
  for (const [mime,extension] of [['image/webp','webp'],['image/jpeg','jpg'],['video/mp4','mp4']]) {
    const {elements,saved,savedBlob} = await setup({mediaType:mime});
    await elements.form.events.submit({preventDefault(){}});
    await elements['save-media'].events.click();
    assert.equal(saved[0].name, `instagram_example.${extension}`);
    assert.equal(saved[0].href, 'blob:test');
    assert.equal(await savedBlob().text(), 'original bytes');
    assert.match(elements['download-status'].textContent, /started/);
    assert.equal(elements['save-media'].disabled, false);
  }
});

test('carousel download captures the selected slide even if selection changes mid-download', async () => {
  const payload={success:true,mediaType:'photo',mediaUrl:'https://x.fbcdn.net/1.jpg',items:[1,2].map(i=>({position:i,mediaType:'photo',available:true,mediaUrl:`https://x.fbcdn.net/${i}.jpg`}))};
  const {elements,saved,releaseMedia}=await setup({payload,mediaType:'image/jpeg',deferredMedia:true});
  elements.url.value='https://www.instagram.com/p/AbC_123/';
  await elements.form.events.submit({preventDefault(){}});
  elements['preview-next'].events.click();
  const pending=elements['save-media'].events.click();
  elements['preview-prev'].events.click();
  releaseMedia(); await pending;
  assert.equal(saved[0].name,'instagram_AbC_123_2.jpg');
  assert.equal(elements.download.href,'https://x.fbcdn.net/1.jpg');
});

test('download errors and unsupported MIME never invent a filename; direct link remains', async () => {
  for (const options of [{mediaFail:true},{mediaType:'application/octet-stream'}]) {
    const {elements,saved}=await setup(options);
    await elements.form.events.submit({preventDefault(){}});
    await elements['save-media'].events.click();
    assert.equal(saved.length,0);
    assert.match(elements['download-status'].textContent,/Open direct media/);
    assert.equal(elements.download.href,'https://media.fbcdn.net/video.mp4?x=1');
    assert.equal(elements['save-media'].disabled,false);
  }
});
