import type { APIContext } from 'astro';
import { feed } from '../../lib/rss';
import type { Lang } from '../../i18n/ui';

export const getStaticPaths = () => [{ params: { lang: 'en' } }, { params: { lang: 'de' } }];
export const GET = (context: APIContext) => feed(context.params.lang as Lang, context.site!);
