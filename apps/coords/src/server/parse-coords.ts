// Read a latitude and longitude out of whatever was pasted.

const NUMBER = String.raw`(-?\d{1,3}\.\d+)`;
const SEPARATOR = String.raw`(?:,|%2C)(?:\s|\+|%20)*`;

// Tried in order. In a Google Maps URL `!3d…!4d…` is the pin, while `@…` is only the middle of the
// visible map, so the pin wins when both are there.
const PATTERNS = [
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
  new RegExp(`[?&](?:q|query|ll)=${NUMBER}${SEPARATOR}${NUMBER}`),
  new RegExp(`/maps/(?:search|place)/${NUMBER}${SEPARATOR}${NUMBER}`),
  new RegExp(`@${NUMBER},${NUMBER}`),
  new RegExp(String.raw`^\(?\s*${NUMBER}(?:\s*,\s*|\s+)${NUMBER}\s*\)?$`),
];

export const parseCoords = (input: string): { lat: number; lng: number } | undefined => {
  const text = input.trim();
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return undefined;
};
