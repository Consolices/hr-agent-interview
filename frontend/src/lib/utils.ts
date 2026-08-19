/**
 * Convert a label string to a snake_case key.
 * e.g. "Introduction & Motivation" -> "introduction_motivation"
 */
export function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Ensure a key is unique among existing keys by appending _2, _3, etc.
 */
export function ensureUniqueKey(key: string, existingKeys: string[]): string {
  if (!existingKeys.includes(key)) return key;
  let i = 2;
  while (existingKeys.includes(`${key}_${i}`)) i++;
  return `${key}_${i}`;
}
