import type { ImageMetadata } from 'astro';

// Every uploaded image, keyed by its path in the repo. Pages CMS stores files in
// src/assets/uploads and writes /uploads/<file> into post frontmatter.
const files = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/uploads/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);

export function resolveImage(p?: string | null): ImageMetadata | undefined {
  if (!p) return undefined;
  const clean = decodeURIComponent(p.trim());
  const key = clean.startsWith('/uploads/')
    ? '/src/assets/uploads/' + clean.slice('/uploads/'.length)
    : clean.startsWith('/src/')
      ? clean
      : '/src/assets/uploads/' + clean.replace(/^\.?\/?/, '');
  const mod = files[key];
  if (!mod) {
    throw new Error(`Image "${p}" not found. Expected it at ${key}.`);
  }
  return mod.default;
}
