// Leave empty on Cloudflare: /api/scrape automatically uses the current Worker or custom domain.
// Only set a Worker origin here when the frontend is hosted separately (for example, GitHub Pages).
const WORKER_URL = '';
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
const download = document.querySelector('#download');
const copy = document.querySelector('#copy');
const directInput = document.querySelector('#direct-url');
const urlInput = document.querySelector('#url');
const mediaList = document.querySelector('#media-list');
const mediaCount = document.querySelector('#media-count');
let directUrl = '';

function updateSubmitLabel() {
  submit.firstElementChild.textContent = urlInput.value.trim() ? 'Get media link' : 'Paste & get link';
}
urlInput.addEventListener('input', updateSubmitLabel);

function isAllowedCdnUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['cdninstagram.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  result.hidden = true;
  directUrl = '';
  directInput.value = '';
  message.textContent = '';
  message.dataset.kind = '';
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  message.textContent = 'Finding your media…';
  message.dataset.kind = 'loading';
  submit.firstElementChild.textContent = 'Finding your media…';
  try {
    if (!urlInput.value.trim()) {
      try {
        if (!navigator.clipboard?.readText) throw new Error('unavailable');
        urlInput.value = (await navigator.clipboard.readText()).trim();
      } catch {
        urlInput.focus();
        throw new Error('Clipboard access is unavailable. Paste the Instagram link into the box.');
      }
      if (!urlInput.value) { urlInput.focus(); throw new Error('Your clipboard is empty. Copy an Instagram link first.'); }
      try {
        const parsed = new URL(urlInput.value);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !['instagram.com','www.instagram.com','m.instagram.com'].includes(parsed.hostname.toLowerCase()) || !/^\/(p|reel|tv)\/[A-Za-z0-9_-]{1,32}\/?$/.test(parsed.pathname)) throw new Error('invalid');
      } catch { urlInput.focus(); throw new Error('Copy a valid public Instagram post or reel link first.'); }
    }
    if (!WORKER_URL && window.location.hostname.endsWith('.github.io')) {
      throw new Error('The Cloudflare Worker URL is not configured yet. Set WORKER_URL in public/app.js and redeploy.');
    }
    const response = await fetch(`${WORKER_URL}/api/scrape`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: urlInput.value.trim()})
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to find media. Please try again.');
    const mediaUrl = data.mediaUrl || data.videoUrl;
    if (!isAllowedCdnUrl(mediaUrl)) throw new Error('The returned link was not a supported Instagram CDN URL.');
    const rawItems = Array.isArray(data.items) && data.items.length ? data.items : [{position:1, mediaType:data.mediaType, mediaUrl, thumbnailUrl:data.thumbnailUrl, available:true}];
    const items = rawItems.map((item, index) => ({...item, position:item.position || index + 1,
      available:item.available !== false && isAllowedCdnUrl(item.mediaUrl),
      mediaType:item.mediaType === 'photo' ? 'photo' : item.mediaType === 'video' ? 'video' : 'unknown'}));
    mediaList.replaceChildren();
    mediaList.hidden = items.length <= 1;
    mediaCount.hidden = items.length <= 1 && !data.partial;
    const available = items.filter(item => item.available).length;
    mediaCount.textContent = data.partial ? `${available} items available; some could not be retrieved.` : `${items.length} items · Select one to open or copy`;
    const buttons = [];
    function selectItem(item, selectedIndex) {
      if (!item.available) return;
      directUrl = item.mediaUrl;
      document.querySelector('#result-title').textContent = items.length > 1 ? `Item ${item.position} · ${item.mediaType}` : `Your ${item.mediaType} is ready.`;
      download.firstChild.textContent = `Open direct ${item.mediaType} `;
      download.href = directUrl; // Direct to Instagram's CDN; no media proxy.
      directInput.value = directUrl;
      const imageWrap = document.querySelector('#image-wrap');
      const image = document.querySelector('#thumbnail');
      imageWrap.hidden = !isAllowedCdnUrl(item.thumbnailUrl);
      if (!imageWrap.hidden) image.src = item.thumbnailUrl;
      buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selectedIndex)));
    }
    if (items.length > 1) items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'media-choice'; button.disabled = !item.available;
      button.setAttribute('aria-label', `Item ${item.position}: ${item.available ? item.mediaType : 'unavailable'}`);
      button.setAttribute('aria-pressed', 'false');
      if (isAllowedCdnUrl(item.thumbnailUrl)) {
        const thumb = document.createElement('img'); thumb.src = item.thumbnailUrl; thumb.alt = ''; thumb.referrerPolicy = 'no-referrer';
        button.appendChild(thumb);
      }
      const label = document.createElement('span'); label.textContent = item.available ? `${item.position} · ${item.mediaType}` : `${item.position} · unavailable`;
      button.appendChild(label); button.addEventListener('click', () => selectItem(item, index));
      buttons.push(button); mediaList.appendChild(button);
    });
    const firstAvailable = items.findIndex(item => item.available);
    if (firstAvailable < 0) throw new Error('No supported media links were returned.');
    selectItem(items[firstAvailable], firstAvailable);
    document.querySelector('#caption').textContent = data.caption || 'Your direct media link is ready to open or copy.';
    result.hidden = false;
    message.textContent = '';
    message.dataset.kind = '';
  } catch (error) { message.dataset.kind = ''; message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { submit.disabled = false; form.setAttribute('aria-busy', 'false'); updateSubmitLabel(); }
});

copy.addEventListener('click', async () => {
  if (!directUrl) return;
  try {
    await navigator.clipboard.writeText(directUrl);
    copy.textContent = 'Copied!';
    setTimeout(() => { copy.textContent = 'Copy'; }, 2500);
  } catch {
    directInput.focus();
    directInput.select();
    message.dataset.kind = '';
    message.textContent = 'Link selected. Use your device’s copy command to copy it.';
  }
});

// A paste outside an editable field puts a valid Instagram post URL in the one input.
// Never intercept paste into another editable control or auto-submit a request.
document.addEventListener('paste', (event) => {
  if (event.defaultPrevented) return;
  const active = document.activeElement;
  if (active && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))) return;
  const text = event.clipboardData?.getData('text/plain')?.trim();
  if (!text || text.length > 2048) return;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase()) ||
        !/^\/(p|reel|tv)\/[A-Za-z0-9_-]{1,32}\/?$/.test(url.pathname)) return;
    event.preventDefault();
    urlInput.value = text;
    updateSubmitLabel();
    urlInput.focus();
  } catch { /* unrelated text is left alone */ }
});
