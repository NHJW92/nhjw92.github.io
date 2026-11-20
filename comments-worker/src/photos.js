// Photo upload page for the blog: pick photos on your phone, they are shrunk in the
// browser, stored in Cloudflare Images and added to a story with a commit to GitHub.
//
//   GET  /upload          the page (HTTP basic auth: admin / ADMIN_PASSWORD)
//   GET  /upload/posts    list of stories in the repo
//   POST /upload/image    one photo (multipart: file, width, height) -> { ref }
//   POST /upload/attach   { post, mode: 'gallery' | 'cover', photos: [{ ref, caption }] }
//
// Needs: CF_ACCOUNT_ID and GITHUB_REPO (wrangler.toml), CF_IMAGES_TOKEN and GITHUB_TOKEN (secrets).

import { parseDocument } from 'yaml';

const POSTS_DIR = 'src/content/posts';
const POST_FILE = /^[\w.-]+\.md$/;
const REF = /^cf:[A-Za-z0-9_-]+@\d{1,5}x\d{1,5}$/;
const MAX_BYTES = 10 * 1024 * 1024; // Cloudflare Images limit for stored images

export async function uploadRoute(req, env, url, authorized) {
  if (!env.ADMIN_PASSWORD) return new Response('Set the ADMIN_PASSWORD secret first.', { status: 503 });
  if (!authorized(req, env)) {
    return new Response('Login required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Photos", charset="UTF-8"' } });
  }
  const missing = ['CF_ACCOUNT_ID', 'CF_IMAGES_TOKEN', 'GITHUB_REPO', 'GITHUB_TOKEN'].filter((k) => !env[k]);
  if (missing.length) return new Response(`Not set up yet. Missing: ${missing.join(', ')} (see "Photos" in the README).`, { status: 503 });

  const sec = { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' };
  if (req.method === 'GET' && url.pathname === '/upload') {
    return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...sec } });
  }
  if (req.method === 'GET' && url.pathname === '/upload/posts') return out(await listPosts(env), 200, sec);

  if (req.method === 'POST') {
    // Only this page may post here (stops other sites from using the logged-in browser).
    const origin = req.headers.get('Origin');
    let sameSite = !origin;
    try { sameSite ||= new URL(origin).host === req.headers.get('Host'); } catch {}
    if (!sameSite) return out({ error: 'forbidden' }, 403, sec);
    if (url.pathname === '/upload/image') return await uploadImage(req, env, sec);
    if (url.pathname === '/upload/attach') return await attach(req, env, sec);
  }
  return out({ error: 'not_found' }, 404, sec);
}

function out(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

// ---------- Cloudflare Images ----------

async function uploadImage(req, env, sec) {
  const form = await req.formData();
  const file = form.get('file');
  const width = Number(form.get('width'));
  const height = Number(form.get('height'));
  if (!(file instanceof File) || !file.size) return out({ error: 'no_file' }, 400, sec);
  if (file.size > MAX_BYTES) return out({ error: 'too_large' }, 413, sec);
  if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 12000)) return out({ error: 'bad_size' }, 400, sec);

  const body = new FormData();
  body.append('file', file, file.name || 'photo.jpg');
  body.append('metadata', JSON.stringify({ post: String(form.get('post') || '').slice(0, 200) }));
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/images/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_IMAGES_TOKEN}` },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    console.error('Images upload failed', res.status, JSON.stringify(data.errors || data));
    return out({ error: 'images_failed', detail: data.errors?.[0]?.message }, 502, sec);
  }
  return out({ ref: `cf:${data.result.id}@${width}x${height}` }, 200, sec);
}

// ---------- GitHub ----------

async function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${String(env.GITHUB_TOKEN).trim()}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'travel-blog-photo-upload',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

async function listPosts(env) {
  const res = await gh(env, `contents/${POSTS_DIR}`);
  if (!res.ok) {
    // Safe hint for a rejected token: its length and whether it looks like a GitHub token (never the token itself).
    const t = String(env.GITHUB_TOKEN).trim();
    const hint = res.status === 401 ? { length: t.length, looksLikeGithub: /^(github_pat_|ghp_)/.test(t) } : undefined;
    return { error: 'github_failed', status: res.status, hint };
  }
  const files = (await res.json()).filter((f) => f.type === 'file' && POST_FILE.test(f.name));
  return { posts: files.map((f) => f.name).sort().reverse() };
}

const b64decode = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Adds the photos to a post's front matter. Exported for tests. */
export function addPhotos(markdown, mode, photos) {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) throw new Error('no_front_matter');
  const doc = parseDocument(m[1]);
  if (doc.errors.length) throw new Error('bad_front_matter');
  let list = photos;
  if (mode === 'cover') {
    doc.set('cover', photos[0].ref);
    if (photos[0].caption) doc.set('coverAlt', photos[0].caption);
    list = photos.slice(1); // any extra photos go to the gallery
  }
  if (list.length) {
    let gallery = doc.get('gallery');
    if (!gallery || !gallery.items) {
      doc.set('gallery', doc.createNode([]));
      gallery = doc.get('gallery');
    }
    for (const p of list) gallery.add(doc.createNode(p.caption ? { image: p.ref, caption: p.caption } : { image: p.ref }));
  }
  const yaml = doc.toString().replace(/\n$/, '');
  return `---\n${yaml}\n---${m[2] || '\n'}${markdown.slice(m[0].length)}`;
}

async function attach(req, env, sec) {
  let data;
  try { data = await req.json(); } catch { return out({ error: 'bad_request' }, 400, sec); }
  const post = String(data.post || '');
  const mode = data.mode === 'cover' ? 'cover' : 'gallery';
  const photos = (Array.isArray(data.photos) ? data.photos : [])
    .filter((p) => REF.test(String(p?.ref || '')))
    .map((p) => ({ ref: String(p.ref), caption: String(p.caption || '').replace(/\s+/g, ' ').trim().slice(0, 300) }));
  if (!POST_FILE.test(post) || !photos.length) return out({ error: 'invalid' }, 400, sec);

  // Read, change and write the post; if someone saved it in between, try again with the new version.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await gh(env, `contents/${POSTS_DIR}/${post}`);
    if (!res.ok) return out({ error: 'post_not_found' }, 404, sec);
    const file = await res.json();
    let updated;
    try { updated = addPhotos(b64decode(file.content), mode, photos); } catch (e) { return out({ error: e.message }, 422, sec); }
    const put = await gh(env, `contents/${POSTS_DIR}/${post}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Add ${photos.length} photo${photos.length > 1 ? 's' : ''} to ${post.replace(/\.md$/, '')} (via upload page)`,
        content: b64encode(updated),
        sha: file.sha,
      }),
    });
    if (put.ok) return out({ status: 'saved', count: photos.length }, 200, sec);
    if (put.status !== 409) {
      console.error('GitHub write failed', put.status, await put.text());
      return out({ error: 'github_failed', status: put.status }, 502, sec);
    }
  }
  return out({ error: 'conflict' }, 409, sec);
}

// ---------- The page ----------

const PAGE = `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Foto's toevoegen</title>
<style>
  body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#eceee8;color:#121a22}
  main{max-width:40rem;margin:0 auto;padding:1.25rem 1rem 5rem}
  h1{font-size:1.5rem;margin:.25rem 0 1.25rem}
  label.f{display:block;font-weight:600;margin:1rem 0 .35rem}
  select,input[type=text]{width:100%;box-sizing:border-box;font:inherit;padding:.6rem .7rem;border:1px solid #9aa3ab;border-radius:6px;background:#fff}
  .modes{display:flex;gap:1.25rem;flex-wrap:wrap} .modes label{display:flex;gap:.4rem;align-items:center}
  .pick{display:block;text-align:center;padding:1.1rem;border:2px dashed #7d8893;border-radius:8px;background:#fff;font-weight:600;cursor:pointer;margin-top:1rem}
  .pick input{display:none}
  ul{list-style:none;margin:1rem 0;padding:0;display:grid;gap:.75rem}
  li{display:grid;grid-template-columns:5.5rem 1fr auto;gap:.75rem;align-items:center;background:#fff;border:1px solid #cfd5cc;border-radius:8px;padding:.5rem}
  li img{width:5.5rem;height:5.5rem;object-fit:cover;border-radius:4px;background:#ddd}
  li .st{font-size:.85rem;color:#566270} li .st.err{color:#9b1c1c} li .st.ok{color:#1f5a17}
  li button{border:0;background:none;font-size:1.4rem;color:#7d8893;cursor:pointer}
  .go{width:100%;font:700 1.05rem system-ui,sans-serif;padding:.9rem;border-radius:999px;border:0;background:#e2a11b;color:#121a22;cursor:pointer}
  .go:disabled{opacity:.5}
  .msg{margin-top:1rem;padding:.8rem 1rem;border-radius:6px;background:#fff} .msg.err{background:#f6d5d5} .msg.ok{background:#d6ecd2}
  .hint{font-size:.85rem;color:#566270;margin:.3rem 0 0}
</style></head><body><main>
<h1>Foto's toevoegen</h1>
<label class="f" for="post">Verhaal</label>
<select id="post"><option>Laden…</option></select>
<p class="hint">Sla het verhaal eerst op in Pages CMS. Nieuw verhaal? Maak het daar aan en ververs deze pagina.</p>
<div class="f" style="font-weight:600;margin:1rem 0 .35rem">Toevoegen als</div>
<div class="modes">
  <label><input type="radio" name="mode" value="gallery" checked> Galerij</label>
  <label><input type="radio" name="mode" value="cover"> Omslagfoto (eerste foto; de rest gaat naar de galerij)</label>
</div>
<label class="pick">+ Kies foto's<input id="files" type="file" accept="image/*" multiple></label>
<ul id="list"></ul>
<button class="go" id="go" disabled>Uploaden en toevoegen</button>
<div id="msg"></div>
<script>
const MAX_EDGE = 3840, QUALITY = 0.88;
const $ = (s) => document.querySelector(s);
const items = [];

fetch('/upload/posts').then((r) => r.json()).then((d) => {
  const sel = $('#post');
  if (!d.posts) {
    sel.innerHTML = '<option>Kon verhalen niet laden</option>';
    const why = d.status === 401 ? 'GitHub accepteert de GITHUB_TOKEN niet. ' + (d.hint ? (d.hint.looksLikeGithub ? 'Hij begint wel met github_pat_ (' + d.hint.length + ' tekens); maak een nieuwe token.' : 'Wat er nu is opgeslagen is geen GitHub-token (' + d.hint.length + ' tekens); waarschijnlijk is iets anders geplakt.') : '')
      : (d.status === 403 || d.status === 404) ? 'De GITHUB_TOKEN heeft geen toegang tot de blog-repository.'
      : 'GitHub gaf fout ' + (d.status || '?') + '.';
    $('#msg').className = 'msg err'; $('#msg').textContent = why;
    return;
  }
  sel.innerHTML = d.posts.map((p) => '<option value="' + p + '">' + p.replace(/\\.md$/, '').replace(/^(\\d{4}-\\d\\d-\\d\\d)-/, '$1 · ').replace(/-/g, ' ') + '</option>').join('');
});

function refresh() {
  $('#go').disabled = !items.some((i) => !i.done);
  $('#list').innerHTML = '';
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    li.innerHTML = '<img alt=""><div><input type="text" placeholder="Bijschrift (optioneel)"><div class="st"></div></div><button aria-label="Verwijderen">×</button>';
    li.querySelector('img').src = it.thumb;
    const cap = li.querySelector('input');
    cap.value = it.caption; cap.disabled = it.done;
    cap.oninput = () => { it.caption = cap.value; };
    const st = li.querySelector('.st');
    st.textContent = it.status || ''; st.className = 'st ' + (it.cls || '');
    li.querySelector('button').onclick = () => { items.splice(idx, 1); refresh(); };
    it.el = st;
    $('#list').append(li);
  });
}

$('#files').onchange = (e) => {
  for (const file of e.target.files) items.push({ file, thumb: URL.createObjectURL(file), caption: '' });
  e.target.value = '';
  refresh();
};

function setStatus(it, text, cls) { it.status = text; it.cls = cls || ''; if (it.el) { it.el.textContent = text; it.el.className = 'st ' + it.cls; } }

// Decode (HEIC too, on iPhone), apply the photo's rotation, shrink, and save as JPEG.
async function shrink(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try { await img.decode(); } catch { throw new Error('Kan deze foto niet lezen in deze browser'); }
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', QUALITY));
  c.width = c.height = 0; // free memory on phones
  if (!blob) throw new Error('Verkleinen mislukt');
  return { blob, w, h };
}

$('#go').onclick = async () => {
  const post = $('#post').value;
  const mode = document.querySelector('input[name=mode]:checked').value;
  const todo = items.filter((i) => !i.done);
  $('#go').disabled = true; $('#msg').innerHTML = '';
  const uploaded = [];
  for (const it of todo) {
    if (it.ref) { uploaded.push(it); continue; } // already uploaded on an earlier try
    try {
      setStatus(it, 'Verkleinen…');
      const { blob, w, h } = await shrink(it.file);
      setStatus(it, 'Uploaden… (' + (blob.size / 1048576).toFixed(1) + ' MB)');
      const fd = new FormData();
      fd.append('file', blob, 'photo.jpg'); fd.append('width', w); fd.append('height', h); fd.append('post', post);
      const r = await fetch('/upload/image', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.error || ('Fout ' + r.status));
      it.ref = d.ref; uploaded.push(it);
      setStatus(it, 'Geüpload', 'ok');
    } catch (err) { setStatus(it, err.message, 'err'); }
  }
  if (!uploaded.length) { $('#go').disabled = false; return; }
  const r = await fetch('/upload/attach', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post, mode, photos: uploaded.map((i) => ({ ref: i.ref, caption: i.caption })) }) });
  const d = await r.json().catch(() => ({}));
  const msg = $('#msg');
  if (r.ok) {
    uploaded.forEach((i) => { i.done = true; setStatus(i, 'Toegevoegd aan het verhaal', 'ok'); });
    msg.className = 'msg ok';
    msg.textContent = d.count + ' foto' + (d.count > 1 ? "'s" : '') + ' toegevoegd. De site is over een paar minuten bijgewerkt. Bijschriften kun je later nog aanpassen in Pages CMS.';
  } else {
    msg.className = 'msg err';
    msg.textContent = 'Foto\\'s zijn geüpload maar niet aan het verhaal toegevoegd (' + (d.error || r.status) + '). Probeer opnieuw.';
    $('#go').disabled = false;
  }
  refresh();
};
</script>
</main></body></html>`;
