/** Public API used by the theme; the vendored implementation remains unchanged. */
export interface LazyLoadOptions {
  elements_selector?: string;
  threshold?: number;
  data_src?: string;
}
export default class LazyLoad {
  constructor(options?: LazyLoadOptions, elements?: NodeListOf<Element>);
  update(elements?: NodeListOf<Element>): void;
  destroy(): void;
  loadAll(elements?: NodeListOf<Element>): void;
}
