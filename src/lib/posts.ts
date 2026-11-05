import { getCollection, type CollectionEntry } from 'astro:content';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import routeYaml from '../data/route.yml?raw';
import { TRAVEL_MODES, type TravelMode } from './travel';

export type Post = CollectionEntry<'posts'>;

/** Published posts, newest first. Drafts are visible in `npm run dev` only. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function postUrl(post: Post) {
  return `/posts/${post.id}/`;
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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

/** All map points (stories with coordinates + route stops), oldest first. */
export function routePoints(posts: Post[]): MapPoint[] {
  const stories = posts
    .filter((p) => typeof p.data.lat === 'number' && typeof p.data.lng === 'number')
    .map((p) => ({
      at: p.data.date.valueOf(),
      point: {
        kind: 'story' as const,
        title: p.data.title,
        url: postUrl(p),
        date: formatDate(p.data.date),
        location: p.data.location,
        lat: p.data.lat as number,
        lng: p.data.lng as number,
        travel: (p.data.travel ?? 'car') as TravelMode,
      },
    }));
  const stops = routeStops().map((s) => ({
    at: s.date.valueOf(),
    point: {
      kind: 'stop' as const,
      title: s.name,
      date: formatDate(s.date),
      location: s.name,
      note: s.note ?? undefined,
      lat: s.lat,
      lng: s.lng,
      travel: (s.travel ?? 'car') as TravelMode,
    },
  }));
  return [...stories, ...stops].sort((a, b) => a.at - b.at).map((x) => x.point);
}
