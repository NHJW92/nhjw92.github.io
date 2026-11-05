export const TRAVEL_MODES = ['start', 'train', 'bus', 'car', 'scooter', 'boat', 'flight', 'walk'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const TRAVEL_LABELS: Record<TravelMode, string> = {
  start: 'Start',
  train: 'Train',
  bus: 'Bus',
  car: 'Car',
  scooter: 'Scooter',
  boat: 'Boat',
  flight: 'Flight',
  walk: 'On foot',
};
