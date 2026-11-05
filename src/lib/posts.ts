import { getCollection, type CollectionEntry } from 'astro:content';

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

export type MapPoint = { title: string; url: string; date: string; location: string; lat: number; lng: number };

/** Posts with coordinates, oldest first, i.e. the order of the route. */
export function routePoints(posts: Post[]): MapPoint[] {
  return posts
    .filter((p) => typeof p.data.lat === 'number' && typeof p.data.lng === 'number')
    .sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf())
    .map((p) => ({
      title: p.data.title,
      url: postUrl(p),
      date: formatDate(p.data.date),
      location: p.data.location,
      lat: p.data.lat as number,
      lng: p.data.lng as number,
    }));
}
