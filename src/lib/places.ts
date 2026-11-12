// Which island (or region) a point is on, for the statistics page.
// Worked out from coordinates; a post or route stop can override it with `island`.
// Boxes are checked in order, so small islands come before the big ones around them.
const BOXES: { name: string; lat: [number, number]; lng: [number, number] }[] = [
  { name: 'Nusa Penida', lat: [-8.86, -8.64], lng: [115.42, 115.63] },
  { name: 'Gili', lat: [-8.38, -8.33], lng: [116.01, 116.1] },
  { name: 'Komodo', lat: [-8.85, -8.4], lng: [119.3, 119.75] },
  { name: 'Bali', lat: [-8.86, -8.05], lng: [114.42, 115.72] },
  { name: 'Lombok', lat: [-9.0, -8.18], lng: [115.8, 116.75] },
  { name: 'Sumbawa', lat: [-9.15, -8.05], lng: [116.75, 119.3] },
  { name: 'Flores', lat: [-8.95, -8.05], lng: [119.75, 123.05] },
  { name: 'Java', lat: [-8.85, -5.85], lng: [105.1, 114.45] },
  { name: 'Sulawesi', lat: [-6.0, 2.0], lng: [118.7, 125.3] },
  { name: 'Kalimantan', lat: [-4.2, 4.5], lng: [108.5, 118.7] },
  { name: 'Sumatra', lat: [-6.0, 6.0], lng: [95.0, 106.2] },
  { name: 'Papua', lat: [-9.2, -0.5], lng: [130.8, 141.1] },
];

/** Island name, or undefined when the point is outside Indonesia (home, transfers). */
export function islandFor(lat: number, lng: number, override?: string | null): string | undefined {
  if (override?.trim()) return override.trim();
  return BOXES.find((b) => lat >= b.lat[0] && lat <= b.lat[1] && lng >= b.lng[0] && lng <= b.lng[1])?.name;
}
