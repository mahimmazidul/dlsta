// Leave empty on Cloudflare: /api/scrape automatically uses the current Worker or custom domain.
// Only set a Worker origin here when the frontend is hosted separately (for example, GitHub Pages).
const WORKER_URL = '';
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const loading = document.querySelector('#loading');
const loadingHint = document.querySelector('#loading-hint');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
const download = document.querySelector('#download');
const saveMedia = document.querySelector('#save-media');
const saveAll = document.querySelector('#save-all');
const downloadStatus = document.querySelector('#download-status');
const copy = document.querySelector('#copy');
const directInput = document.querySelector('#direct-url');
const urlInput = document.querySelector('#url');
const mediaList = document.querySelector('#media-list');
const mediaCount = document.querySelector('#media-count');
const imageWrap = document.querySelector('#image-wrap');
const image = document.querySelector('#thumbnail');
const previewEmpty = document.querySelector('#preview-empty');
const previousMedia = document.querySelector('#preview-prev');
const nextMedia = document.querySelector('#preview-next');
const previewCounter = document.querySelector('#preview-counter');
let directUrl = '';
let selectedFilename = '';
let selectedType = 'media';
let carouselDownloads = [];
let carouselUnavailable = 0;
let activeBatch = null;
let lookupGeneration = 0;
let moveMedia = () => {};
let touchStart = null;

// Drag the single-line field to pan long URLs. Keyboard and Copy remain available.
let linkDrag = null;
directInput.addEventListener('pointerdown', event => {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) ||
      event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.detail > 1) return;
  linkDrag = {id:event.pointerId, x:event.clientX, scroll:directInput.scrollLeft, moved:false};
  directInput.setPointerCapture(event.pointerId);
  event.preventDefault();
});
directInput.addEventListener('pointermove', event => {
  if (!linkDrag || linkDrag.id !== event.pointerId) return;
  const delta = event.clientX - linkDrag.x;
  if (Math.abs(delta) > 3) linkDrag.moved = true;
  if (linkDrag.moved) directInput.scrollLeft = linkDrag.scroll - delta;
});
directInput.addEventListener('pointerup', event => {
  if (!linkDrag || linkDrag.id !== event.pointerId) return;
  const moved = linkDrag.moved;
  linkDrag = null;
  if (!moved) directInput.focus({preventScroll:true});
});
directInput.addEventListener('pointercancel', () => { linkDrag = null; });

previousMedia.addEventListener('click', () => moveMedia(-1));
nextMedia.addEventListener('click', () => moveMedia(1));
imageWrap.addEventListener('keydown', event => {
  if (event.target !== imageWrap || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  moveMedia(event.key === 'ArrowLeft' ? -1 : 1);
});
// Preserve vertical page scrolling; only a clear horizontal swipe changes media.
imageWrap.addEventListener('touchstart', event => {
  const touch = event.touches.length === 1 ? event.touches[0] : null;
  touchStart = touch ? {x:touch.clientX, y:touch.clientY} : null;
}, {passive:true});
imageWrap.addEventListener('touchend', event => {
  const touch = event.changedTouches[0];
  if (touchStart && touch) {
    const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) moveMedia(dx < 0 ? 1 : -1);
  }
  touchStart = null;
}, {passive:true});
imageWrap.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});

function updateSubmitLabel() {
  if (submit.disabled) return;
  submit.firstElementChild.textContent = urlInput.value.trim() ? 'Get media link' : 'Paste & get link';
}
urlInput.addEventListener('input', updateSubmitLabel);

function isInstagramPostUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase()) &&
      /^\/(p|reel|tv)\/[A-Za-z0-9_-]{1,32}\/?$/.test(url.pathname);
  } catch { return false; }
}

function isAllowedCdnUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['cdninstagram.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  lookupGeneration++;
  if (activeBatch) activeBatch.abort();
  activeBatch = null;
  carouselDownloads = [];
  carouselUnavailable = 0;
  saveAll.hidden = true;
  saveAll.disabled = false;
  saveMedia.disabled = false;
  result.hidden = true;
  moveMedia = () => {};
  touchStart = null;
  directUrl = '';
  selectedFilename = '';
  selectedType = 'media';
  downloadStatus.textContent = '';
  directInput.value = '';
  message.textContent = '';
  message.dataset.kind = '';
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  const hints = ['Looking for available media.', 'Carousels can contain multiple items.', 'Still working — some posts take a little longer.', 'Your media opens directly from Instagram.'];
  let hintIndex = 0;
  loadingHint.textContent = hints[0];
  loading.hidden = false;
  const hintTimer = setInterval(() => { hintIndex = (hintIndex + 1) % hints.length; loadingHint.textContent = hints[hintIndex]; }, 3500);
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
      if (!urlInput.value) throw new Error('Your clipboard is empty. Copy an Instagram link first.');
    }
    const submittedUrl = urlInput.value.trim();
    if (!isInstagramPostUrl(submittedUrl)) {
      urlInput.value = '';
      throw new Error('Copy a valid public Instagram post or reel link first.');
    }
    if (!WORKER_URL && window.location.hostname.endsWith('.github.io')) {
      throw new Error('The Cloudflare Worker URL is not configured yet. Set WORKER_URL in public/app.js and redeploy.');
    }
    const response = await fetch(`${WORKER_URL}/api/scrape`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: submittedUrl})
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      if (response.status === 400 && urlInput.value.trim() === submittedUrl) urlInput.value = '';
      throw new Error(data.error || 'Unable to find media. Please try again.');
    }
    const mediaUrl = data.mediaUrl || data.videoUrl;
    if (!isAllowedCdnUrl(mediaUrl)) throw new Error('The returned link was not a supported Instagram CDN URL.');
    const rawItems = Array.isArray(data.items) && data.items.length ? data.items : [{position:1, mediaType:data.mediaType, mediaUrl, thumbnailUrl:data.thumbnailUrl, available:true}];
    const items = rawItems.map((item, index) => ({...item, position:Number.isSafeInteger(item.position) && item.position > 0 ? item.position : index + 1,
      available:item.available !== false && isAllowedCdnUrl(item.mediaUrl),
      mediaType:item.mediaType === 'photo' ? 'photo' : item.mediaType === 'video' ? 'video' : 'unknown'}));
    mediaList.replaceChildren();
    mediaList.hidden = items.length <= 1;
    mediaCount.hidden = items.length <= 1 && !data.partial;
    const available = items.filter(item => item.available).length;
    mediaCount.textContent = data.partial ? `${available} items available; some could not be retrieved.` : `${items.length} items · Select one to open or copy`;
    const buttons = [];
    let selectedIndex = -1;
    const total = Math.max(items.length, Number(data.totalItems) || 0);
    const shortcode = new URL(submittedUrl).pathname.split('/')[2];
    carouselDownloads = items.filter(item => item.available).map(item => ({url:item.mediaUrl, filename:`instagram_${shortcode}_${item.position}`}));
    carouselUnavailable = Math.max(0, total - carouselDownloads.length);
    saveAll.hidden = total <= 1;
    const neighbor = (index, direction) => {
      for (let i = index + direction; i >= 0 && i < items.length; i += direction) if (items[i].available) return i;
      return -1;
    };
    function selectItem(item, index) {
      if (!item.available) return;
      selectedIndex = index;
      directUrl = item.mediaUrl;
      selectedType = item.mediaType;
      selectedFilename = `instagram_${shortcode}${items.length > 1 ? `_${item.position}` : ''}`;
      if (!activeBatch) downloadStatus.textContent = '';
      if (!saveMedia.disabled) saveMedia.firstChild.textContent = `Download ${item.mediaType} `;
      document.querySelector('#result-title').textContent = items.length > 1 ? `Item ${item.position} · ${item.mediaType}` : `Your ${item.mediaType} is ready.`;
      download.firstChild.textContent = `Open direct ${item.mediaType} `;
      download.href = directUrl; // Direct to Instagram's CDN; no media proxy.
      directInput.value = directUrl;
      directInput.scrollLeft = 0;
      const hasPreview = isAllowedCdnUrl(item.thumbnailUrl);
      image.hidden = !hasPreview;
      previewEmpty.hidden = hasPreview;
      imageWrap.hidden = !hasPreview && items.length <= 1;
      if (hasPreview) image.src = item.thumbnailUrl;
      else image.removeAttribute('src');
      const multiple = items.length > 1;
      imageWrap.setAttribute('tabindex', multiple ? '0' : '-1');
      previousMedia.hidden = nextMedia.hidden = previewCounter.hidden = !multiple;
      previousMedia.disabled = neighbor(index, -1) < 0;
      nextMedia.disabled = neighbor(index, 1) < 0;
      previewCounter.textContent = `${item.position} / ${total}`;
      buttons.forEach((button, buttonIndex) => button.setAttribute('aria-pressed', String(buttonIndex === index)));
    }
    moveMedia = direction => {
      const index = neighbor(selectedIndex, direction);
      if (index >= 0) selectItem(items[index], index);
    };
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
    // Keep a new link typed while this request was in flight.
    if (urlInput.value.trim() === submittedUrl) urlInput.value = '';
    message.textContent = '';
    message.dataset.kind = '';
  } catch (error) { message.dataset.kind = ''; message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { clearInterval(hintTimer); loading.hidden = true; submit.disabled = false; form.setAttribute('aria-busy', 'false'); updateSubmitLabel(); }
});

// Fetch directly from Instagram's CDN in the browser, preserving the original bytes.
// Each call requests one browser download; browsers may block multiple downloads.
async function requestMediaDownload(url, filename, signal) {
  const response = await fetch(url, {mode:'cors', credentials:'omit', referrerPolicy:'no-referrer', signal});
  if (!response.ok) throw new Error('Download unavailable');
  const blob = await response.blob();
  if (signal?.aborted) throw new Error('Cancelled');
  const types = new Map([['image/jpeg','jpg'], ['image/png','png'], ['image/webp','webp'], ['image/avif','avif'], ['image/gif','gif'], ['video/mp4','mp4'], ['video/webm','webm'], ['video/quicktime','mov']]);
  const extension = types.get(blob.type.toLowerCase().split(';')[0].trim());
  if (!extension || !blob.size) throw new Error('Unsupported media type');
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  try { link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000); }
}

saveMedia.addEventListener('click', async () => {
  if (!directUrl || !selectedFilename || saveMedia.disabled) return;
  const url = directUrl, filename = selectedFilename, generation = lookupGeneration;
  saveMedia.disabled = true;
  saveAll.disabled = true;
  saveMedia.firstChild.textContent = 'Preparing download ';
  downloadStatus.textContent = 'Downloading directly from Instagram’s CDN…';
  try {
    await requestMediaDownload(url, filename);
    if (generation === lookupGeneration) downloadStatus.textContent = 'Download started in your browser.';
  } catch {
    if (generation === lookupGeneration) downloadStatus.textContent = 'Could not download directly. Use Open direct media and your browser’s save option instead.';
  } finally {
    if (generation !== lookupGeneration) return;
    saveMedia.disabled = false;
    saveAll.disabled = false;
    // The selection may have changed while the download was in progress.
    saveMedia.firstChild.textContent = `Download ${selectedType === 'unknown' ? 'media' : selectedType} `;
  }
});

// Space browser download requests so a fast CDN cannot emit a burst of clicks.
// Cancellation stops the wait promptly when a new lookup starts.
function pauseBetweenDownloads(signal) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(finish, 250);
    function finish() { signal.removeEventListener('abort', cancel); resolve(); }
    function cancel() { clearTimeout(timer); finish(); }
    signal.addEventListener('abort', cancel, {once:true});
  });
}

saveAll.addEventListener('click', async () => {
  if (saveAll.disabled || carouselDownloads.length === 0) return;
  const batch = carouselDownloads.slice();
  const unavailable = carouselUnavailable;
  const controller = new AbortController();
  activeBatch = controller;
  saveAll.disabled = true;
  saveMedia.disabled = true;
  let requested = 0, failed = 0;
  try {
    for (const [index, item] of batch.entries()) {
      if (controller.signal.aborted) return;
      downloadStatus.textContent = `Preparing ${index + 1} of ${batch.length}. Allow multiple downloads if your browser asks.`;
      try {
        await requestMediaDownload(item.url, item.filename, controller.signal);
        requested++;
        if (index < batch.length - 1) await pauseBetweenDownloads(controller.signal);
      }
      catch { if (controller.signal.aborted) return; failed++; }
    }
    if (activeBatch !== controller) return;
    const problems = [unavailable ? `${unavailable} unavailable` : '', failed ? `${failed} could not be fetched; try them individually` : ''].filter(Boolean);
    downloadStatus.textContent = `Requested ${requested} of ${batch.length} downloads. Allow multiple downloads if your browser asks.${problems.length ? ' ' + problems.join('; ') + '.' : ''}`;
  } finally {
    if (activeBatch === controller) {
      activeBatch = null;
      saveAll.disabled = false;
      saveMedia.disabled = false;
      saveMedia.firstChild.textContent = `Download ${selectedType === 'unknown' ? 'media' : selectedType} `;
    }
  }
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
  if (!isInstagramPostUrl(text)) return;
  event.preventDefault();
  urlInput.value = text;
  updateSubmitLabel();
  urlInput.focus();
});
