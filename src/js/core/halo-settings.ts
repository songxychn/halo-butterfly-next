/** Halo's template serializer wraps ConfigMap objects (including repeater rows). */
export function haloSetting(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(haloSetting);
  if (!value || typeof value !== 'object') return value;
  const fields = Object.entries(value);
  if (fields.length === 1 && fields[0][0] === 'realNode') return haloSetting(fields[0][1]);
  return Object.fromEntries(fields.map(([key, entry]) => [key, haloSetting(entry)]));
}
