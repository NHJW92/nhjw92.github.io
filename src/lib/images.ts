import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { SITE } from '../site.config';

// A photo in a post is one of two kinds:
//   /uploads/<file>        older photos, stored in the repo (src/assets/uploads) and
//                          optimised by Astro at build time.
//   cf:<id>@<width>x<height>  photos added with the upload page (comments-worker /upload),
//                          stored in Cloudflare Images and resized by Cloudflare on request.

const files = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/uploads/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);

export type Photo =
  | { kind: 'local'; meta: ImageMetadata; width: number; height: number }
  | { kind: 'cloud'; id: string; width: number; height: number };

const CLOUD_REF = /^cf:([A-Za-z0-9_-]+)@(\d+)x(\d+)$/;

export const isPhotoRef = (p?: string | null) =>
  Boolean(p && (p.trim().startsWith('/uploads/') || CLOUD_REF.test(p.trim())));

export function resolvePhoto(p?: string | null): Photo | undefined {
  if (!p) return undefined;
  const raw = p.trim();
  const cloud = raw.match(CLOUD_REF);
  if (cloud) {
    if (!SITE.photos.accountHash) {
      throw new Error(`Photo "${raw}" is in Cloudflare Images, but SITE.photos.accountHash is empty in src/site.config.ts.`);
    }
    return { kind: 'cloud', id: cloud[1], width: Number(cloud[2]), height: Number(cloud[3]) };
  }
  const meta = resolveLocal(raw);
  return { kind: 'local', meta, width: meta.width, height: meta.height };
}

function resolveLocal(p: string): ImageMetadata {
  const clean = decodeURIComponent(p);
  const key = clean.startsWith('/uploads/')
    ? '/src/assets/uploads/' + clean.slice('/uploads/'.length)
    : clean.startsWith('/src/')
      ? clean
      : '/src/assets/uploads/' + clean.replace(/^\.?\/?/, '');
  const mod = files[key];
  if (!mod) throw new Error(`Image "${p}" not found. Expected it at ${key}.`);
  return mod.default;
}

/** Cloudflare Images URL at a given width. Format is picked per browser (AVIF/WebP/JPEG) unless set. */
export function cloudUrl(id: string, width: number, format?: 'jpeg' | 'webp'): string {
  const opts = [`w=${Math.round(width)}`, 'q=82', 'metadata=none', format && `f=${format}`].filter(Boolean).join(',');
  return `https://imagedelivery.net/${SITE.photos.accountHash}/${id}/${opts}`;
}

/** A single URL for the photo, e.g. for the lightbox or og:image. */
export async function photoUrl(photo: Photo, width: number, format: 'jpeg' | 'webp' = 'webp'): Promise<string> {
  const w = Math.min(photo.width, width);
  if (photo.kind === 'cloud') return cloudUrl(photo.id, w, format === 'jpeg' ? 'jpeg' : undefined);
  const img = await getImage({ src: photo.meta, width: w, format: format === 'jpeg' ? 'jpg' : 'webp', quality: 80 });
  return img.src;
}
