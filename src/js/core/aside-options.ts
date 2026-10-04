/** Progressive enhancement for Halo sidebar options. No network requests or HTML injection. */
export function limitItems<T>(items: T[], limit: unknown) {
  const count = Number(limit);
  return Number.isInteger(count) && count > 0 ? items.slice(0, count) : items;
}

export function sortTags<T extends {dataset: {name?: string; count?: string}}>(items: T[], field = 'random', direction: unknown = 1, random = Math.random) {
  const result = [...items];
  if (field === 'random') {
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const sign = Number(direction) === -1 ? -1 : 1;
  return result.sort((a, b) => {
    const byName = String(a.dataset.name).localeCompare(String(b.dataset.name), 'zh-CN');
    return sign * (field === 'length' ? Number(a.dataset.count) - Number(b.dataset.count) || byName : byName);
  });
}

// A documented calendar-only subset of Moment tokens; never interprets markup.
export function formatArchiveDate(year: unknown, month: unknown, pattern: unknown, locale = 'zh-CN') {
  const y = Number(year), m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return `${year}-${month}`;
  const date = new Date(Date.UTC(y, m - 1, 1));
  const tokens: Record<string, string> = {
    YYYY: String(y), YY: String(y).slice(-2), M: String(m), MM: String(m).padStart(2, '0'),
    MMM: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(date),
    MMMM: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date),
  };
  return String(pattern || 'YYYY年MM月').replace(/\[[^\]]*\]|YYYY|MMMM|MMM|YY|MM|M/g, token => token.startsWith('[') ? token.slice(1, -1) : tokens[token]);
}

export function initializeAsideOptions(root = document) {
  for (const aside of root.querySelectorAll<HTMLElement>('[data-aside-sort]')) {
    const cards = (Array.from(aside.children) as HTMLElement[]).filter(node => node.hasAttribute('data-card-order'));
    cards.sort((a, b) => Number(a.dataset.cardOrder) - Number(b.dataset.cardOrder)).forEach(card => aside.append(card));
  }
  for (const container of root.querySelectorAll<HTMLElement>('[data-aside-tags]')) {
    const template = container.querySelector<HTMLTemplateElement>('template[data-tag-list]');
    if (!template) continue;
    const tags = [...template.content.querySelectorAll('a')].map(node => node.cloneNode(true) as HTMLAnchorElement);
    if (tags.length) container.replaceChildren(...limitItems(sortTags(tags, container.dataset.orderby, container.dataset.order), container.dataset.limit));
  }
  for (const container of root.querySelectorAll<HTMLElement>('[data-aside-categories]')) {
    const template = container.querySelector<HTMLTemplateElement>('template[data-category-tree]');
    if (!template) continue;
    const tree = template.content.cloneNode(true) as DocumentFragment;
    if (!tree.querySelector('.category-entry')) continue;
    const sortLevel = (parent: ParentNode) => {
      const entries = (Array.from(parent.children) as HTMLElement[]).filter(node => node.classList.contains('category-entry'));
      entries.sort((a, b) => (a.dataset.name || '').localeCompare(b.dataset.name || '', 'zh-CN'));
      for (const entry of entries) {
        parent.append(entry);
        const children = entry.querySelector(':scope > .category-children');
        if (children) sortLevel(children);
      }
    };
    sortLevel(tree);
    for (const entry of [...tree.querySelectorAll<HTMLElement>('.category-entry')].reverse()) {
      if (Number(entry.dataset.count) <= 0 && !entry.querySelector('.category-entry')) entry.remove();
    }
    const entries = [...tree.querySelectorAll<HTMLElement>('.category-entry')];
    if (!entries.length) continue;
    const included = new Set(limitItems(entries, container.dataset.limit));
    for (const entry of entries) if (!included.has(entry)) entry.remove();
    // Native details preserve keyboard behavior without coupling links to expand buttons.
    if (container.dataset.expand !== 'none') {
      for (const entry of (Array.from(tree.children) as HTMLElement[])) {
        const children = entry.querySelector(':scope > .category-children');
        if (!children?.children.length) continue;
        const details = container.ownerDocument.createElement('details');
        const summary = container.ownerDocument.createElement('summary');
        summary.textContent = '子分类';
        summary.setAttribute('aria-label', `${entry.dataset.name}的子分类`);
        details.open = container.dataset.expand === 'true';
        details.append(summary, children);
        entry.append(details);
      }
    }
    container.replaceChildren(tree);
  }
  for (const list of root.querySelectorAll<HTMLElement>('[data-aside-archives]')) {
    const rows = (Array.from(list.children) as HTMLElement[]);
    const sign = Number(list.dataset.order) === 1 ? 1 : -1;
    rows.sort((a, b) => sign * ((Number(a.dataset.year) * 12 + Number(a.dataset.month)) - (Number(b.dataset.year) * 12 + Number(b.dataset.month))));
    for (const row of rows) {
      const label = row.querySelector('.card-archive-list-date');
      if (label) label.textContent = formatArchiveDate(row.dataset.year, row.dataset.month, list.dataset.format, root.documentElement?.lang || 'zh-CN');
      list.append(row);
    }
  }
}
