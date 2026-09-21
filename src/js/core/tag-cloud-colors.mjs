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

export function tagCloudColors(index) {
  const [light, dark] = palette[index % palette.length];
  return {light, dark};
}
