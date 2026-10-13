/** Butterfly 5.7.0 gallery JSON contract: {url, alt, title}[]. */
export interface GalleryImage { url: string; alt: string; title: string }
export const MAX_GALLERY_IMAGES = 5000;
export const MAX_GALLERY_BYTES = 1024 * 1024;

export function galleryUrl(value: unknown, base: string) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\\]/.test(value)) return '';
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (new URL(base).protocol === 'https:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch { return ''; }
}

export function galleryImages(value: unknown, base: string): GalleryImage[] {
  if (!Array.isArray(value) || value.length > MAX_GALLERY_IMAGES) throw new Error('图库数据必须是最多 5000 张图片的数组');
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('图库图片格式无效');
    const url = galleryUrl(item.url, base);
    if (!url) throw new Error('图库图片地址无效');
    return { url, alt: typeof item.alt === 'string' ? item.alt : '', title: typeof item.title === 'string' ? item.title : '' };
  });
}

export function galleryOptions(element: Pick<HTMLElement, 'dataset'>) {
  const count = (value: string | undefined, fallback: number) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 1 ? Math.min(200, Math.floor(number)) : fallback;
  };
  const limit = count(element.dataset.limit, 10);
  return { button: element.dataset.button === 'true', limit, first: count(element.dataset.first, limit) };
}

/** Limit decoded bytes, including chunked bodies; do not send logged-in cookies. */
export async function fetchGallery(source: string, base: string, signal: AbortSignal, request: typeof fetch = fetch) {
  const url = galleryUrl(source, base);
  if (!url) throw new Error('图库数据地址无效');
  const response = await request(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('图库数据请求失败');
  if (Number(response.headers.get('content-length')) > MAX_GALLERY_BYTES) throw new Error('图库数据过大');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('图库数据为空');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_GALLERY_BYTES) throw new Error('图库数据过大');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  // Butterfly assigns item.url to img.src: relative URLs use the article base.
  return galleryImages(JSON.parse(new TextDecoder().decode(bytes)), base);
}
