import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../site.config';
import { getPosts, postUrl } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).filter((p) => !p.data.draft);
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary ?? `New story from ${p.data.location}`,
      link: postUrl(p),
      categories: [p.data.location],
    })),
  });
}
