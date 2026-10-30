// Leave empty for a combined Worker deployment; for Pages set the full Worker origin.
const WORKER_URL = '';
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
const download = document.querySelector('#download');
const copy = document.querySelector('#copy');
const directInput = document.querySelector('#direct-url');
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
  submit.firstElementChild.textContent = 'Finding your video…';
  try {
    if (!WORKER_URL && window.location.hostname.endsWith('.github.io')) {
      throw new Error('The Cloudflare Worker URL is not configured yet. Set WORKER_URL in public/app.js and redeploy.');
    }
    const response = await fetch(`${WORKER_URL}/api/scrape`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: document.querySelector('#url').value.trim()})
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to find a video. Please try again.');
    if (!isAllowedCdnUrl(data.videoUrl)) throw new Error('The video link returned was not a supported Instagram CDN URL.');
    directUrl = data.videoUrl;
    download.href = directUrl; // Direct to Instagram's CDN; the Worker does not proxy video bytes.
    directInput.value = directUrl;
    const imageWrap = document.querySelector('#image-wrap');
    const image = document.querySelector('#thumbnail');
    imageWrap.hidden = !isAllowedCdnUrl(data.thumbnailUrl);
    if (!imageWrap.hidden) image.src = data.thumbnailUrl;
    document.querySelector('#caption').textContent = data.caption || 'Your direct video link is ready to open or copy.';
    result.hidden = false;
  } catch (error) { message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { submit.disabled = false; submit.firstElementChild.textContent = 'Get video link'; }
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
