/**
 * 相关文章。对齐 Butterfly 5.7.0
 * _config.yml related_post + scripts/helpers/related_post.js
 * + layout/post.pug（f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认：enable true、limit 6、date_type created。
 * 上游 helper 按标签交集加权，同权重再 random；limit || 6（0 视为默认）。
 * date_type === 'created' 用发布日期，否则用更新日期。
 * enable 关闭或无标签时不渲染。仅文章页；单页 page.html 不插入。
 * 不做 footer / reward / 逐页覆盖；不把 helper:related_posts 标 verified。
 */

const DEFAULTS = {
  enable: true,
  limit: 6,
  date_type: 'created',
};

export { DEFAULTS };

function isExplicitFalse(value: unknown) {
  return value === false || value === 'false';
}

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveEnable(value: unknown) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return DEFAULTS.enable;
}

/** 对齐 `config.related_post.limit || 6`：非正数回退 6。 */
export function resolveLimit(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULTS.limit;
  return Math.floor(n);
}

/** 仅 created 用发布日期；其余用更新日期。对齐 helper 的 === 'created' / else。 */
export function resolveDateType(value: unknown) {
  if (value === 'created') return 'created';
  if (value == null || value === '') return DEFAULTS.date_type;
  return 'updated';
}

export function rankRelatedPosts<T extends {path: string}>(currentPath: string, tagPostLists: (T[] | null | undefined)[], options: {random?: () => number; limit?: unknown} = {}) {
  const related = new Map<string, T & {weight: number; random: number}>();
  const rng = typeof options.random === 'function' ? options.random : Math.random;
  for (const posts of tagPostLists || []) {
    for (const post of posts || []) {
      if (!post || post.path === currentPath) continue;
      if (related.has(post.path)) {
        related.get(post.path)!.weight += 1;
      } else {
        related.set(post.path, {
          ...post,
          weight: 1,
          random: rng(),
        });
      }
    }
  }
  if (related.size === 0) return [];
  const cap = resolveLimit(options.limit);
  return [...related.values()].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.random - a.random;
  }).slice(0, cap);
}

/**
 * 模板按标签顺序输出候选后：去掉当前文、去重，截断到 limit。
 * 无剩余项时移除整个 .relatedPosts。
 */
export function capRelatedPosts(root: Element | null, limit: unknown, currentId?: string | null) {
  if (!root || !root.querySelectorAll) return 0;
  const cap = resolveLimit(limit);
  const seen = new Set();
  if (currentId != null && currentId !== '') seen.add(String(currentId));
  let kept = 0;
  for (const node of [...root.querySelectorAll(':scope > a[data-post-name]')]) {
    const id = node.getAttribute('data-post-name') || '';
    if (!id || seen.has(id) || kept >= cap) {
      node.remove();
      continue;
    }
    seen.add(id);
    kept += 1;
  }
  if (kept === 0) root.closest('.relatedPosts')?.remove();
  return kept;
}
