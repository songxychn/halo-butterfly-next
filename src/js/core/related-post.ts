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
  return Math.max(1, Math.floor(n));
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
    const seen = new Set<string>();
    for (const post of posts || []) {
      if (!post || !post.path || post.path === currentPath || seen.has(post.path)) continue;
      seen.add(post.path);
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

/** Rank the complete per-tag candidates emitted by Halo, then mount only the winners.
 * Inert templates keep discarded covers out of the resource/lazy-loading pipeline.
 */
export function renderRelatedPosts(root: Element | null, limit: unknown, random = Math.random) {
  if (!root) return 0;
  if (root.getAttribute('data-related-rendered') === 'true') return root.querySelectorAll(':scope > a[data-post-name]').length;
  const groups = new Map<string, {path: string; node: HTMLAnchorElement}[]>();
  for (const template of root.querySelectorAll<HTMLTemplateElement>(':scope > template[data-related-tag]')) {
    const tag = template.getAttribute('data-related-tag');
    if (!tag) continue;
    const posts = groups.get(tag) || [];
    for (const node of template.content.querySelectorAll<HTMLAnchorElement>('a[data-post-name]')) {
      const path = node.getAttribute('data-post-name');
      if (path) posts.push({path, node});
    }
    groups.set(tag, posts);
  }
  const ranked = rankRelatedPosts(root.getAttribute('data-current-post') || '', [...groups.values()], {limit, random});
  root.replaceChildren(...ranked.map(post => post.node));
  root.setAttribute('data-related-rendered', 'true');
  const widget = root.closest<HTMLElement>('.relatedPosts');
  if (!ranked.length) widget?.remove();
  else if (widget) widget.hidden = false;
  return ranked.length;
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
