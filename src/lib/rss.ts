import rss from '@astrojs/rss';
import { SITE } from '../site.config';
import { getPosts, postUrl } from './posts';
import { t, type Lang } from '../i18n/ui';

export async function feed(lang: Lang, site: URL) {
  const s = t(lang);
  const posts = (await getPosts(lang)).filter((p) => !p.data.draft);
  return rss({
    title: SITE.title,
    description: s.description,
    site,
    customData: `<language>${lang}</language>`,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary ?? s.rssItem(p.data.location),
      link: postUrl(p),
      categories: [p.data.location],
    })),
  });
}
