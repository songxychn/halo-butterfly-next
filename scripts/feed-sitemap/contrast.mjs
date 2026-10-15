/** WCAG contrast for actual opaque computed foreground and background colors. */
export function rgb(value) {
  const match = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value);
  if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) throw new Error('Opaque RGB color required: ' + value);
  const channels = match.slice(1, 4).map(Number);
  if (channels.some(channel => channel < 0 || channel > 255)) throw new Error('RGB out of range');
  return channels;
}
const luminance = channels => channels.map(channel => channel / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
export function contrastRatio(foreground, background) {
  const values = [luminance(rgb(foreground)), luminance(rgb(background))].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
