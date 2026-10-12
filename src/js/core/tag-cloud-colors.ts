// Paired hues keep the tag cloud colorful with at least 4.5:1 contrast against
// the default white/light and #121212/dark cards, including the smaller counts.
const palette = [
  ['#1d4ed8', '#93c5fd'],
  ['#047857', '#6ee7b7'],
  ['#b45309', '#fcd34d'],
  ['#be123c', '#fda4af'],
  ['#7e22ce', '#d8b4fe'],
  ['#0e7490', '#67e8f9'],
];

export function tagCloudColors(index: number) {
  const [light, dark] = palette[index % palette.length];
  return {light, dark};
}

/** A single color or an ordered list; blank and invalid values do not enter CSS. */
export function normalizeTagColors(input: unknown, supports = CSS.supports): {light: string; dark: string}[] {
  const values = Array.isArray(input) ? input : [input];
  return values.flatMap(value => {
    const pair = value && typeof value === 'object' ? value as Record<string, unknown> : {light: value, dark: value};
    const valid = (v: unknown) => typeof v === 'string' && !/[;{}<>]|url\(|var\(/i.test(v) && supports('color', v.trim()) ? v.trim() : '';
    const light = valid(pair.light);
    return light ? [{light, dark: valid(pair.dark) || light}] : [];
  });
}
export function tagFontSize(count: number, counts: number[], min = 12, max = 21) {
  const sizes = [...new Set(counts)].sort((a,b) => a-b);
  const rank = sizes.indexOf(count);
  return min + (sizes.length > 1 ? Math.max(0,rank)/(sizes.length-1) * (max-min) : 0);
}
export function applyTagColors(items: HTMLElement[], input: unknown, colorful = true, scale = false) {
  const custom = normalizeTagColors(input);
  const counts = items.map(item=>Number(item.dataset.count || item.getAttribute('data-postCount') || 0));
  items.forEach((item,index) => {
    if (colorful) {
      const colors = custom.length ? custom[index % custom.length] : tagCloudColors(index);
      item.style.setProperty('--tag-color-light',colors.light);
      item.style.setProperty('--tag-color-dark',colors.dark);
    }
    if (scale) item.style.fontSize = tagFontSize(counts[index],counts) + 'px';
  });
}
