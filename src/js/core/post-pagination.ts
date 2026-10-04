/**
 * 文章上下篇。对齐 Butterfly 5.7.0 layout/includes/pagination.pug
 *（f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * post_pagination：false 不渲染；值为 2 时
 * `{ prev: page.prev, next: page.next }`；其余真值（含默认 1）对调为
 * `{ prev: page.next, next: page.prev }`。
 *
 * Hexo 文章生成按日期降序：page.prev = 较新，page.next = 较旧。
 * Halo `postFinder.cursor`：previous = 较早发布，next = 较晚发布。
 * 因此 halo.previous ↔ Hexo page.next，halo.next ↔ Hexo page.prev。
 *
 * `_config.yml` 注释写「1 时 next 指向旧文」，同 SHA 模板在非 2 时对调后
 * 右侧「下一篇」实际为较新（page.prev）。实现以模板为准。
 */
export function resolvePostPagination(value: unknown) {
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  if (value === 2 || value === '2') return 2;
  return 1;
}

export function hexoNeighborsFromHalo<T>(haloPrevious: T, haloNext: T) {
  return { prev: haloNext ?? null, next: haloPrevious ?? null };
}

export function paginationOrder<T>(mode: unknown, pagePrev: T, pageNext: T) {
  if (mode === 2) return { prev: pagePrev ?? null, next: pageNext ?? null };
  return { prev: pageNext ?? null, next: pagePrev ?? null };
}

export function paginationOrderFromHalo<T>(mode: unknown, haloPrevious: T, haloNext: T) {
  const { prev, next } = hexoNeighborsFromHalo(haloPrevious, haloNext);
  return paginationOrder(mode, prev, next);
}

export function linkClassName({ hasOther, hasDesc }: {hasOther: boolean; hasDesc: boolean}) {
  const parts = [];
  if (!hasOther) parts.push('full-width');
  if (!hasDesc) parts.push('no-desc');
  return parts.join(' ');
}
