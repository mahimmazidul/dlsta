// Leave empty for a combined Worker deployment; for Pages set the full Worker origin.
const WORKER_URL = '';
const form = document.querySelector('#form');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  result.hidden = true;
  message.textContent = '';
  submit.disabled = true;
  submit.textContent = 'Finding video…';
  try {
    if (!WORKER_URL && window.location.hostname.endsWith('.github.io')) {
      throw new Error('The frontend is hosted on GitHub Pages, but the Cloudflare Worker URL is not configured yet. Set WORKER_URL in public/app.js and redeploy.');
    }
    const response = await fetch(`${WORKER_URL}/api/scrape`, {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url: document.querySelector('#url').value.trim()})});
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to find a video.');
    const image = document.querySelector('#thumbnail');
    image.hidden = !data.thumbnailUrl;
    if (data.thumbnailUrl) image.src = data.thumbnailUrl;
    document.querySelector('#caption').textContent = data.caption || 'Your video is ready to save.';
    document.querySelector('#download').href = `${WORKER_URL}/api/proxy?url=${encodeURIComponent(data.videoUrl)}`;
    result.hidden = false;
  } catch (error) { message.textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { submit.disabled = false; submit.textContent = 'Find video →'; }
});
