import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { TRAVEL_MODES } from './lib/travel';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    location: z.string(),
    // Coordinates put the post on the route map. Optional, but recommended.
    lat: z.coerce.number().optional().nullable(),
    lng: z.coerce.number().optional().nullable(),
    // How you got here; styles the line leading to this stop on the map.
    travel: z.enum(TRAVEL_MODES).optional().nullable(),
    summary: z.string().optional().nullable(),
    cover: z.string().optional().nullable(),
    coverAlt: z.string().optional().nullable(),
    gallery: z
      .array(z.object({ image: z.string(), caption: z.string().optional().nullable() }))
      .optional()
      .nullable()
      .transform((g) => (g ?? []).filter((i) => i.image)),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { posts };
