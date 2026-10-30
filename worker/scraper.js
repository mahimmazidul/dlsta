// Only public posts; upstream availability and markup are outside our control.
export function validMediaUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      ['cdninstagram.com', 'fbcdn.net'].some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}

export function normalizeInstagramUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('INVALID_URL');
  let u;
  try { u = new URL(raw.trim()); } catch { throw new Error('INVALID_URL'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port ||
      !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(u.hostname.toLowerCase())) throw new Error('INVALID_URL');
  const match = u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{1,32})\/?$/);
  if (!match) throw new Error('INVALID_URL');
  return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}

function decode(value) {
  if (!value) return '';
  return value.replace(/\\u0026/gi, '&').replace(/\\u003d/gi, '=').replace(/\\\//g, '/')
    .replace(/&amp;/g, '&').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function meta(html, name) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = (key) => tag.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
    if ((attr('property') || attr('name') || '').toLowerCase() === name) return decode(attr('content'));
  }
  return '';
}
function field(html, name) {
  const m = html.match(new RegExp('"' + name + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'i'));
  if (!m) return '';
  try { return decode(JSON.parse('"' + m[1] + '"')); } catch { return decode(m[1]); }
}
