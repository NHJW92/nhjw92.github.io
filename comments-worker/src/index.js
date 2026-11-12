// Comment backend for the travel blog: a Cloudflare Worker with a D1 (SQLite) database.
//
//   GET  /comments?post=<id>   approved comments for one story (public)
//   POST /comments             add a comment {post, name, body, lang, kind?, website, elapsed}
//   POST /vote                 up/down vote on a feedback item {id, value: -1|0|1, voter}
//   GET  /admin                approval page (HTTP basic auth: admin / ADMIN_PASSWORD)
//   POST /admin/approve|delete|done|reopen   moderation actions from that page
//
// The feedback page uses the same comments, with post = "feedback" and a kind (bug/idea).

const LIMITS = { name: 60, body: 2000, perWindow: 4, windowMs: 10 * 60 * 1000, minFillMs: 3000 };
const POST_ID = /^[a-z0-9][a-z0-9._-]{0,200}$/i;
const FEEDBACK = 'feedback';
const KINDS = ['bug', 'idea'];
const VOTES = { perWindow: 60, windowMs: 10 * 60 * 1000 };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS comments (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     post TEXT NOT NULL,
     name TEXT NOT NULL,
     body TEXT NOT NULL,
     lang TEXT,
     created_at INTEGER NOT NULL,
     approved INTEGER NOT NULL DEFAULT 0,
     ip_hash TEXT,
     kind TEXT,
     done INTEGER NOT NULL DEFAULT 0,
     score INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS votes (
     comment_id INTEGER NOT NULL,
     voter TEXT NOT NULL,
     value INTEGER NOT NULL,
     ip_hash TEXT,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (comment_id, voter)
   )`,
  `CREATE INDEX IF NOT EXISTS votes_ip ON votes (ip_hash, created_at)`,
  `CREATE INDEX IF NOT EXISTS comments_post ON comments (post, approved, created_at)`,
  `CREATE INDEX IF NOT EXISTS comments_ip ON comments (ip_hash, created_at)`,
];
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaReady = true;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      await ensureSchema(env.DB);
      if (url.pathname === '/comments') return await commentsRoute(req, env, ctx, url);
      if (url.pathname === '/vote') return await voteRoute(req, env);
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return await adminRoute(req, env, url);
      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error(err);
      return new Response('Server error', { status: 500 });
    }
  },
};

// ---------- Public API ----------

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const list = allowedOrigins(env);
  return {
    'Access-Control-Allow-Origin': list.includes(origin) ? origin : list[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

async function commentsRoute(req, env, ctx, url) {
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

  if (req.method === 'GET') {
    const post = url.searchParams.get('post') || '';
    if (!POST_ID.test(post)) return json({ error: 'bad_post' }, 400, h);
    const { results } = await env.DB.prepare(
      'SELECT id, name, body, created_at, kind, done, score FROM comments WHERE post = ? AND approved = 1 ORDER BY created_at ASC LIMIT 500',
    ).bind(post).all();
    return json({ comments: results }, 200, { ...h, 'Cache-Control': 'public, max-age=15' });
  }

  if (req.method === 'POST') {
    const origin = req.headers.get('Origin') || '';
    if (!allowedOrigins(env).includes(origin)) return json({ error: 'forbidden' }, 403, h);

    let data;
    try { data = await req.json(); } catch { return json({ error: 'bad_request' }, 400, h); }

    // Bots: a hidden field people never see, and forms filled in faster than a human can type.
    // Pretend it worked so they don't adapt.
    if (data.website || Number(data.elapsed) < LIMITS.minFillMs) return json({ status: 'pending' }, 200, h);

    const post = String(data.post || '');
    const name = clean(data.name).slice(0, LIMITS.name);
    const body = clean(data.body, true).slice(0, LIMITS.body);
    const lang = ['nl', 'en', 'de'].includes(data.lang) ? data.lang : null;
    const kind = post === FEEDBACK ? (KINDS.includes(data.kind) ? data.kind : 'idea') : null;
    if (!POST_ID.test(post) || !name || body.length < 2) return json({ error: 'invalid' }, 400, h);

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await sha256(`${ip}|${env.ADMIN_PASSWORD || ''}`);
    const now = Date.now();
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?')
      .bind(ipHash, now - LIMITS.windowMs).first('n');
    if (recent >= LIMITS.perWindow) return json({ error: 'rate_limited' }, 429, h);

    const approved = env.AUTO_APPROVE === 'true' ? 1 : 0;
    const row = await env.DB.prepare(
      'INSERT INTO comments (post, name, body, lang, created_at, approved, ip_hash, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, name, body, created_at, kind, done, score',
    ).bind(post, name, body, lang, now, approved, ipHash, kind).first();

    if (env.NTFY_TOPIC) ctx.waitUntil(notify(env, url, post, name, body, approved));
    return json({ status: approved ? 'published' : 'pending', comment: approved ? row : undefined }, 201, h);
  }

  return json({ error: 'method_not_allowed' }, 405, h);
}

async function voteRoute(req, env) {
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, h);
  if (!allowedOrigins(env).includes(req.headers.get('Origin') || '')) return json({ error: 'forbidden' }, 403, h);

  let data;
  try { data = await req.json(); } catch { return json({ error: 'bad_request' }, 400, h); }
  const id = Number(data.id);
  const value = Number(data.value);
  const voter = String(data.voter || '');
  if (!Number.isInteger(id) || ![-1, 0, 1].includes(value) || !/^[a-z0-9-]{16,64}$/i.test(voter)) {
    return json({ error: 'invalid' }, 400, h);
  }

  // Only approved feedback items can be voted on.
  const item = await env.DB.prepare('SELECT id FROM comments WHERE id = ? AND post = ? AND approved = 1').bind(id, FEEDBACK).first();
  if (!item) return json({ error: 'not_found' }, 404, h);

  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(`${ip}|${env.ADMIN_PASSWORD || ''}`);
  const now = Date.now();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - VOTES.windowMs).first('n');
  if (recent >= VOTES.perWindow) return json({ error: 'rate_limited' }, 429, h);

  // The voter id is a random token kept in the visitor's browser: one vote per item per browser.
  const voterHash = await sha256(`vote|${voter}`);
  const write = value === 0
    ? env.DB.prepare('DELETE FROM votes WHERE comment_id = ? AND voter = ?').bind(id, voterHash)
    : env.DB.prepare(
      'INSERT INTO votes (comment_id, voter, value, ip_hash, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (comment_id, voter) DO UPDATE SET value = excluded.value, created_at = excluded.created_at',
    ).bind(id, voterHash, value, ipHash, now);
  const [, , scoreRow] = await env.DB.batch([
    write,
    env.DB.prepare('UPDATE comments SET score = (SELECT COALESCE(SUM(value), 0) FROM votes WHERE comment_id = ?) WHERE id = ?').bind(id, id),
    env.DB.prepare('SELECT score FROM comments WHERE id = ?').bind(id),
  ]);
  return json({ id, score: scoreRow.results[0]?.score ?? 0, value }, 200, h);
}

function clean(v, multiline = false) {
  let s = String(v ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim();
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function notify(env, url, post, name, body, approved) {
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
      method: 'POST',
      headers: {
        Title: `${approved ? 'New comment' : 'Comment to approve'} from ${name}`.replace(/[^\x20-\x7E]/g, '?'),
        Click: `${url.origin}/admin`,
        Tags: 'speech_balloon',
      },
      body: `${post}\n\n${body.slice(0, 300)}`,
    });
  } catch (err) {
    console.error('ntfy failed', err);
  }
}

// ---------- Admin ----------

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function authorized(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (req.headers.get('Authorization') || '').match(/^Basic (.+)$/i);
  if (!m) return false;
  let decoded = '';
  try { decoded = atob(m[1]); } catch { return false; }
  const i = decoded.indexOf(':');
  return timingSafeEqual(decoded.slice(0, i), 'admin') & timingSafeEqual(decoded.slice(i + 1), env.ADMIN_PASSWORD);
}

async function adminRoute(req, env, url) {
  if (!env.ADMIN_PASSWORD) return new Response('Set the ADMIN_PASSWORD secret first.', { status: 503 });
  if (!authorized(req, env)) {
    return new Response('Login required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Comments", charset="UTF-8"' } });
  }
  const sec = { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' };

  if (req.method === 'POST') {
    // Only accept actions from this page itself (stops other sites from submitting the form).
    const origin = req.headers.get('Origin');
    let sameSite = !origin;
    try { sameSite ||= new URL(origin).host === req.headers.get('Host'); } catch {}
    if (!sameSite) return new Response('Forbidden', { status: 403 });
    const form = await req.formData();
    const id = Number(form.get('id'));
    if (Number.isInteger(id) && id > 0) {
      if (url.pathname === '/admin/approve') await env.DB.prepare('UPDATE comments SET approved = 1 WHERE id = ?').bind(id).run();
      if (url.pathname === '/admin/delete') {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM votes WHERE comment_id = ?').bind(id),
          env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id),
        ]);
      }
      if (url.pathname === '/admin/done') await env.DB.prepare('UPDATE comments SET done = 1 WHERE id = ?').bind(id).run();
      if (url.pathname === '/admin/reopen') await env.DB.prepare('UPDATE comments SET done = 0 WHERE id = ?').bind(id).run();
    }
    return new Response(null, { status: 303, headers: { Location: '/admin', ...sec } });
  }

  const pending = (await env.DB.prepare('SELECT * FROM comments WHERE approved = 0 ORDER BY created_at DESC LIMIT 200').all()).results;
  const feedback = (await env.DB.prepare('SELECT * FROM comments WHERE approved = 1 AND post = ? ORDER BY done ASC, score DESC, created_at DESC LIMIT 200').bind(FEEDBACK).all()).results;
  const recent = (await env.DB.prepare('SELECT * FROM comments WHERE approved = 1 AND post != ? ORDER BY created_at DESC LIMIT 50').bind(FEEDBACK).all()).results;
  const site = allowedOrigins(env)[0] || '';
  return new Response(adminPage(pending, feedback, recent, site), { headers: { 'Content-Type': 'text/html; charset=utf-8', ...sec } });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const when = (ms) => new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam' });

function card(c, site, approved) {
  const isFeedback = c.post === FEEDBACK;
  const link = isFeedback ? `${site}/feedback/` : `${site}/posts/${encodeURIComponent(c.post)}/#comments`;
  const badge = isFeedback ? `<span class="tag ${esc(c.kind)}">${c.kind === 'bug' ? 'Bug' : 'Idea'}</span>${c.done ? '<span class="tag done">Done</span>' : ''} ` : '';
  const score = isFeedback && approved ? ` · score ${c.score > 0 ? '+' : ''}${c.score}` : '';
  const doneBtn = isFeedback && approved
    ? `<form method="post" action="/admin/${c.done ? 'reopen' : 'done'}"><input type="hidden" name="id" value="${c.id}"><button>${c.done ? 'Reopen' : 'Mark done'}</button></form>`
    : '';
  return `<li>
    <p class="meta">${badge}<strong>${esc(c.name)}</strong> · ${when(c.created_at)} · <a href="${esc(link)}" target="_blank" rel="noopener">${esc(isFeedback ? 'feedback' : c.post)}</a>${c.lang ? ` · ${esc(c.lang)}` : ''}${score}</p>
    <p class="body">${esc(c.body)}</p>
    <div class="actions">
      ${approved ? '' : `<form method="post" action="/admin/approve"><input type="hidden" name="id" value="${c.id}"><button class="ok">Approve</button></form>`}
      ${doneBtn}
      <form method="post" action="/admin/delete" onsubmit="return confirm('Delete this comment?')"><input type="hidden" name="id" value="${c.id}"><button class="del">Delete</button></form>
    </div>
  </li>`;
}

function adminPage(pending, feedback, recent, site) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comments${pending.length ? ` (${pending.length})` : ''}</title><meta name="robots" content="noindex">
<style>
  body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#eceee8;color:#121a22}
  main{max-width:46rem;margin:0 auto;padding:1.5rem 1rem 4rem}
  h1{font-size:1.6rem;margin:.5rem 0 1.5rem} h2{font-size:1.1rem;margin:2rem 0 .75rem}
  ul{list-style:none;margin:0;padding:0;display:grid;gap:.75rem}
  li{background:#fff;border:1px solid #cfd5cc;border-radius:6px;padding:1rem}
  .meta{margin:0 0 .4rem;font-size:.85rem;color:#566270} .meta a{color:inherit}
  .body{margin:0 0 .8rem;white-space:pre-wrap;overflow-wrap:anywhere}
  .actions{display:flex;gap:.5rem} form{margin:0}
  button{font:600 .9rem system-ui,sans-serif;padding:.5rem 1rem;border-radius:999px;border:1px solid #7d8893;background:#fff;cursor:pointer}
  .ok{background:#e2a11b;border-color:#e2a11b} .del{color:#9b1c1c}
  .empty{color:#566270;font-style:italic}
  .tag{display:inline-block;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:.1rem .45rem;border-radius:3px;margin-right:.3rem;background:#e1e5de;color:#121a22}
  .tag.bug{background:#f6d5d5;color:#7a1414} .tag.idea{background:#d9e8f0;color:#1d4b63} .tag.done{background:#d6ecd2;color:#1f5a17}
</style></head><body><main>
<h1>Comments</h1>
<h2>Waiting for approval (${pending.length})</h2>
${pending.length ? `<ul>${pending.map((c) => card(c, site, false)).join('')}</ul>` : '<p class="empty">Nothing to approve.</p>'}
<h2>Feedback (bugs and ideas)</h2>
${feedback.length ? `<ul>${feedback.map((c) => card(c, site, true)).join('')}</ul>` : '<p class="empty">No feedback yet.</p>'}
<h2>Recent comments on stories</h2>
${recent.length ? `<ul>${recent.map((c) => card(c, site, true)).join('')}</ul>` : '<p class="empty">No comments yet.</p>'}
</main></body></html>`;
}
