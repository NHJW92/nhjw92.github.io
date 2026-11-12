// Donors and fun counters, edited in Pages CMS (src/data/donors.yml, src/data/stats.yml).
import { parse } from 'yaml';
import { z } from 'astro/zod';
import donorsYaml from '../data/donors.yml?raw';
import statsYaml from '../data/stats.yml?raw';
import type { Lang } from '../i18n/ui';

const donorSchema = z.object({
  donors: z.array(z.object({ name: z.string().trim().min(1), date: z.coerce.date() })).nullable().default([]),
});

/** Donors, newest first. */
export function getDonors() {
  const parsed = donorSchema.safeParse(parse(donorsYaml) ?? {});
  if (!parsed.success) throw new Error(`src/data/donors.yml is invalid: ${parsed.error.message}`);
  return [...(parsed.data.donors ?? [])].sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

const counterSchema = z.object({
  counters: z
    .array(
      z.object({
        label: z.string(),
        label_en: z.string().optional().nullable(),
        label_de: z.string().optional().nullable(),
        value: z.coerce.number(),
        place: z.string().optional().nullable(),
        show: z.boolean().optional().nullable(),
      }),
    )
    .nullable()
    .default([]),
});

export type Counter = { label: string; value: number; place?: string };

/** Visible counters with the label in the requested language (falls back to Dutch). */
export function getCounters(lang: Lang): Counter[] {
  const parsed = counterSchema.safeParse(parse(statsYaml) ?? {});
  if (!parsed.success) throw new Error(`src/data/stats.yml is invalid: ${parsed.error.message}`);
  return (parsed.data.counters ?? [])
    .filter((c) => c.show !== false)
    .map((c) => ({
      label: (lang === 'en' ? c.label_en : lang === 'de' ? c.label_de : null) || c.label,
      value: c.value,
      place: c.place?.trim() || undefined,
    }));
}
