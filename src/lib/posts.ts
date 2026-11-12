import { getCollection, type CollectionEntry } from 'astro:content';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import routeYaml from '../data/route.yml?raw';
import routeTranslations from '../data/route-translations.json';
import { TRAVEL_MODES, type TravelMode } from './travel';
import { formatDate, localize, type Lang } from '../i18n/ui';
import { islandFor } from './places';

type SourceEntry = CollectionEntry<'posts'>;
type TranslationEntry = CollectionEntry<'translations'>;

/** A post as shown in one language: translated text where available, source data otherwise. */
export type Post = {
  id: string;
  lang: Lang;
  sourceLang: Lang;
  /** 'original' = written in this language; 'translated' = AI translation; 'missing' = no translation yet. */
  status: 'original' | 'translated' | 'missing';
  /** The entry to render (translation or source). */
  entry: SourceEntry | TranslationEntry;
  data: Omit<SourceEntry['data'], 'lang'>;
};

let cache: Promise<{ sources: SourceEntry[]; translations: Map<string, TranslationEntry> }> | undefined;
function load() {
  cache ??= (async () => {
    const sources = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
    const translations = new Map((await getCollection('translations')).map((t) => [t.id, t]));
    return { sources, translations };
  })();
  return cache;
}

/** Published posts in a language, newest first. Drafts are visible in `npm run dev` only. */
export async function getPosts(lang: Lang): Promise<Post[]> {
  const { sources, translations } = await load();
  return sources
    .map((src): Post => {
      const { lang: sourceLang, ...base } = src.data;
      if (sourceLang === lang) return { id: src.id, lang, sourceLang, status: 'original', entry: src, data: base };
      const tr = translations.get(`${lang}/${src.id}`);
      if (!tr) return { id: src.id, lang, sourceLang, status: 'missing', entry: src, data: base };
      return {
        id: src.id,
        lang,
        sourceLang,
        status: 'translated',
        entry: tr,
        data: {
          ...base,
          title: tr.data.title,
          location: tr.data.location || base.location,
          summary: tr.data.summary ?? base.summary,
          coverAlt: tr.data.coverAlt ?? base.coverAlt,
          gallery: base.gallery.map((g, i) => ({ ...g, caption: tr.data.captions?.[i] ?? g.caption })),
        },
      };
    })
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function postUrl(post: Pick<Post, 'id' | 'lang'>) {
  return localize(`/posts/${post.id}/`, post.lang);
}

export type MapPoint = {
  kind: 'story' | 'stop';
  title: string;
  url?: string;
  date: string;
  location: string;
  note?: string;
  lat: number;
  lng: number;
  /** How the traveller arrived at this point; styles the leg leading here. */
  travel: TravelMode;
  /** Arrival time (ms since epoch). */
  at: number;
  /** Island or region, undefined outside Indonesia. */
  island?: string;
};

const stopSchema = z.object({
  stops: z
    .array(
      z.object({
        name: z.string(),
        note: z.string().optional().nullable(),
        date: z.coerce.date(),
        lat: z.coerce.number(),
        lng: z.coerce.number(),
        travel: z.enum(TRAVEL_MODES).optional().nullable(),
        island: z.string().optional().nullable(),
      }),
    )
    .nullable()
    .default([]),
});

function routeStops() {
  const parsed = stopSchema.safeParse(parse(routeYaml) ?? {});
  if (!parsed.success) {
    throw new Error(`src/data/route.yml is invalid: ${parsed.error.message}`);
  }
  return parsed.data.stops ?? [];
}

const noteTranslations = routeTranslations as Record<string, Partial<Record<Lang, string>>>;

/** All map points (stories with coordinates + route stops), oldest first. */
export function routePoints(posts: Post[], lang: Lang): MapPoint[] {
  const stories = posts
    .filter((p) => typeof p.data.lat === 'number' && typeof p.data.lng === 'number')
    .map((p) => ({
      at: p.data.date.valueOf(),
      point: {
        kind: 'story' as const,
        title: p.data.title,
        url: postUrl(p),
        date: formatDate(p.data.date, lang),
        location: p.data.location,
        lat: p.data.lat as number,
        lng: p.data.lng as number,
        travel: (p.data.travel ?? 'car') as TravelMode,
        at: p.data.date.valueOf(),
        island: islandFor(p.data.lat as number, p.data.lng as number, p.data.island),
      },
    }));
  const stops = routeStops().map((s) => ({
    at: s.date.valueOf(),
    point: {
      kind: 'stop' as const,
      title: s.name,
      date: formatDate(s.date, lang),
      location: s.name,
      note: s.note ? (noteTranslations[s.note]?.[lang] ?? s.note) : undefined,
      lat: s.lat,
      lng: s.lng,
      travel: (s.travel ?? 'car') as TravelMode,
      at: s.date.valueOf(),
      island: islandFor(s.lat, s.lng, s.island),
    },
  }));
  return [...stories, ...stops].sort((a, b) => a.at - b.at).map((x) => x.point);
}
