#!/usr/bin/env node
// Translates blog posts (and route-stop notes) into the other site languages with
// Claude, via the Anthropic API. Runs in GitHub Actions before each build.
//
// - Source posts:   src/content/posts/<id>.md   (frontmatter `lang` = nl | en | de, default nl)
// - Translations:   src/content/translations/<lang>/<id>.md
// - Route notes:    src/data/route.yml  ->  src/data/route-translations.json
//
// A translation stores a hash of the source text, so a post is only translated again
// when its text changes. Edits made by hand to a translation are kept until then.
//
// Env: ANTHROPIC_API_KEY (required to translate), TRANSLATE_MODEL (optional).

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';

export const LANGS = ['nl', 'en', 'de'];
const NAMES = { nl: 'Dutch', en: 'English', de: 'German' };
const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const OUT_DIR = path.join(ROOT, 'src/content/translations');
const ROUTE_FILE = path.join(ROOT, 'src/data/route.yml');
const ROUTE_OUT = path.join(ROOT, 'src/data/route-translations.json');
const MODEL = process.env.TRANSLATE_MODEL || 'claude-sonnet-5-5';

export function splitFrontmatter(text) {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  return { data: parse(m[1]) ?? {}, body: m[2] };
}

/** The translatable text of a post. */
export function sourcePayload(data, body) {
  return {
    title: data.title ?? '',
    location: data.location ?? '',
    summary: data.summary ?? '',
    coverAlt: data.coverAlt ?? '',
    captions: (data.gallery ?? []).map((g) => g?.caption ?? ''),
    body: body.replace(/\r\n/g, '\n').trim(),
  };
}

export function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

const SYSTEM = `You translate a personal travel blog written by Babet and Niels, a Dutch couple travelling through Indonesia.
Translate naturally and idiomatically, keeping their tone, humour and level of informality. Do not add or remove content.
Keep all Markdown formatting intact. Never change URLs, image paths (e.g. /uploads/...), HTML tags or code.
Keep personal names unchanged. Use the place names a native reader would expect (e.g. "Zuid-Holland", "Südholland", "South Holland"), but keep Indonesian names as they are.
You receive a JSON object and return the same JSON object with every string value translated, keys unchanged, arrays in the same order and length. Empty strings stay empty.
Respond with the JSON only: no explanation, no code fences.`;

async function callClaude(payload, from, to) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Translate from ${NAMES[from] ?? 'the source language'} into ${NAMES[to]}.\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const json = await res.json();
  const text = (json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const out = JSON.parse(cleaned);
  // Guard against shape drift.
  for (const k of Object.keys(payload)) {
    if (Array.isArray(payload[k])) {
      if (!Array.isArray(out[k]) || out[k].length !== payload[k].length) throw new Error(`Translation changed the shape of "${k}"`);
    } else if (typeof out[k] !== 'string') {
      throw new Error(`Translation is missing "${k}"`);
    }
  }
  return out;
}

async function translateWithRetry(payload, from, to, label) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await callClaude(payload, from, to);
    } catch (err) {
      console.warn(`  ! ${label} → ${to} failed (attempt ${attempt}): ${err.message}`);
      if (attempt === 2) return null;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function exists(p) {
  return fs.access(p).then(() => true, () => false);
}

async function translatePosts() {
  const files = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
  const ids = new Set(files.map((f) => f.replace(/\.md$/, '')));
  let done = 0;

  for (const file of files) {
    const id = file.replace(/\.md$/, '');
    const { data, body } = splitFrontmatter(await fs.readFile(path.join(POSTS_DIR, file), 'utf8'));
    if (data.draft) continue; // Translate once it's published.
    const from = LANGS.includes(data.lang) ? data.lang : 'nl';
    const payload = sourcePayload(data, body);
    const hash = hashPayload(payload);

    for (const to of LANGS.filter((l) => l !== from)) {
      const out = path.join(OUT_DIR, to, file);
      if (await exists(out)) {
        const current = splitFrontmatter(await fs.readFile(out, 'utf8')).data;
        if (current.sourceHash === hash && current.sourceLang === from) continue;
      }
      console.log(`  → ${id}: ${from} → ${to}`);
      const tr = await translateWithRetry(payload, from, to, id);
      if (!tr) continue;
      const fm = {
        title: tr.title,
        location: tr.location || payload.location,
        summary: tr.summary || null,
        coverAlt: tr.coverAlt || null,
        captions: tr.captions,
        sourceLang: from,
        sourceHash: hash,
        translatedBy: MODEL,
      };
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, `---\n${stringify(fm).trim()}\n---\n\n${tr.body.trim()}\n`, 'utf8');
      done++;
    }
  }

  // Remove translations whose source post was deleted.
  for (const lang of LANGS) {
    const dir = path.join(OUT_DIR, lang);
    if (!(await exists(dir))) continue;
    for (const f of await fs.readdir(dir)) {
      if (f.endsWith('.md') && !ids.has(f.replace(/\.md$/, ''))) {
        await fs.rm(path.join(dir, f));
        console.log(`  ✗ removed orphaned translation ${lang}/${f}`);
      }
    }
  }
  return done;
}

async function translateRouteNotes() {
  if (!(await exists(ROUTE_FILE))) return 0;
  const notes = [...new Set((parse(await fs.readFile(ROUTE_FILE, 'utf8'))?.stops ?? []).map((s) => s?.note).filter(Boolean))];
  const dict = (await exists(ROUTE_OUT)) ? JSON.parse(await fs.readFile(ROUTE_OUT, 'utf8')) : {};
  const missing = notes.filter((n) => LANGS.some((l) => !dict[n]?.[l]));
  if (missing.length) {
    console.log(`  → ${missing.length} route note(s)`);
    for (const to of LANGS) {
      const tr = await translateWithRetry({ notes: missing }, 'auto', to, 'route notes');
      if (!tr) continue;
      missing.forEach((n, i) => {
        dict[n] = { ...(dict[n] ?? {}), [to]: tr.notes[i] };
      });
    }
  }
  // Drop notes that are no longer in route.yml.
  const next = Object.fromEntries(notes.filter((n) => dict[n]).map((n) => [n, dict[n]]));
  if (JSON.stringify(next) !== JSON.stringify(dict) || missing.length) {
    await fs.writeFile(ROUTE_OUT, JSON.stringify(next, null, 2) + '\n', 'utf8');
  }
  return missing.length;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY is not set: skipping AI translation. Untranslated posts are shown in their original language.');
    return;
  }
  console.log(`Translating with ${MODEL}…`);
  const posts = await translatePosts();
  const notes = await translateRouteNotes();
  console.log(`Done: ${posts} post translation(s), ${notes} route note(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    // Never fail the deploy because of translation problems.
    console.error('Translation step failed:', err);
  });
}
