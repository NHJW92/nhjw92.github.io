import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/site.config.ts';
import { remarkUploads } from './src/lib/remark-uploads.mjs';

export default defineConfig({
  site: SITE.url,
  integrations: [sitemap()],
  markdown: {
    // Pages CMS writes images as /uploads/...; rewrite them so Astro optimises them.
    remarkPlugins: [remarkUploads],
  },
  image: {
    // Gives markdown images (inside stories) responsive srcsets as well.
    layout: 'constrained',
  },
});
