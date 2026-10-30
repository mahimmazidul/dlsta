import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function setup({light = false, saved = null, storageFails = false} = {}) {
  const source = await readFile(new URL('../public/theme.js', import.meta.url), 'utf8');
  const root = {dataset:{}}; const listeners = {}; const attrs = {}; let stored = saved;
  const toggle = {events:{}, setAttribute(k,v){attrs[k]=v;}, querySelector(){return this.label;}, label:{textContent:''}, addEventListener(k,fn){this.events[k]=fn;}};
  const meta = {setAttribute(k,v){this[k]=v;}};
  const media = {matches:light, addEventListener(k,fn){listeners[k]=fn;}};
  const doc = {documentElement:root, querySelector(q){return q === '#theme-toggle' ? toggle : meta;}, addEventListener(k,fn){listeners[k]=fn;}};
  const localStorage = {getItem(){if (storageFails) throw new Error('blocked'); return stored;}, setItem(k,v){if (storageFails) throw new Error('blocked'); stored=v;}};
  vm.runInNewContext(source, {document:doc, window:{matchMedia:()=>media}, localStorage});
  listeners.DOMContentLoaded();
  return {root, toggle, attrs, meta, media, listeners, stored:()=>stored};
}

test('theme follows device, toggles, persists and updates browser theme color', async () => {
  const a = await setup({light:true});
  assert.equal(a.root.dataset.theme, 'light'); assert.equal(a.attrs['aria-label'], 'Switch to dark mode');
  assert.equal(a.meta.content, '#f7f8f0');
  a.toggle.events.click();
  assert.equal(a.root.dataset.theme, 'dark'); assert.equal(a.stored(), 'dark'); assert.equal(a.attrs['aria-label'], 'Switch to light mode');
  const b = await setup({light:true, saved:a.stored()});
  assert.equal(b.root.dataset.theme, 'dark'); assert.equal(b.meta.content, '#10130f');
  b.media.matches=false; b.listeners.change(); assert.equal(b.root.dataset.theme, 'dark');
});

test('theme follows device changes before choosing and handles blocked storage', async () => {
  const a = await setup({storageFails:true});
  assert.equal(a.root.dataset.theme, 'dark');
  a.media.matches=true; a.listeners.change(); assert.equal(a.root.dataset.theme, 'light');
  a.toggle.events.click(); assert.equal(a.root.dataset.theme, 'dark');
});
