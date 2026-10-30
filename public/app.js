// Leave empty for a combined Worker deployment; for Pages set the full Worker origin.
const WORKER_URL = '';
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
const download = document.querySelector('#download');
const copy = document.querySelector('#copy');
const directInput = document.querySelector('#direct-url');
const urlInput = document.querySelector('#url');
let directUrl = '';

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
  submit.firstElementChild.textContent = 'Finding your media…';
  try {
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
    const mediaType = data.mediaType === 'photo' ? 'photo' : 'video';
    directUrl = mediaUrl;
    document.querySelector('#result-title').textContent = `Your ${mediaType} is ready.`;
    download.firstChild.textContent = `Open direct ${mediaType} `;
    download.href = directUrl; // Direct to Instagram's CDN; the Worker does not proxy video bytes.
    directInput.value = directUrl;
    const imageWrap = document.querySelector('#image-wrap');
    const image = document.querySelector('#thumbnail');
    imageWrap.hidden = !isAllowedCdnUrl(data.thumbnailUrl);
    if (!imageWrap.hidden) image.src = data.thumbnailUrl;
    document.querySelector('#caption').textContent = data.caption || 'Your direct media link is ready to open or copy.';
    result.hidden = false;
  } catch (error) { message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { submit.disabled = false; submit.firstElementChild.textContent = 'Get media link'; }
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
    urlInput.focus();
  } catch { /* unrelated text is left alone */ }
});
