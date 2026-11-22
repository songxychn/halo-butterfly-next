/**
 * Pagination bar rendered from Halo template paging config.
 */
export default class Pagination {
  name = 'Pagination';

  #conf = MainApp.conf as import('../types.ts').PaginationConfig;

  constructor() {
    if (!MainApp.conf.total) return;
    if (this.#conf.page > this.#conf.totalPages) return;
    this.#createPage();
  }

  #getPrevUrl() {
    return this.#conf.hasPrevious
      ? `<a class="page prev" rel="prev" aria-label="prev" href="${this.#conf.prevUrl}"><i class="fas fa-chevron-left fa-fw"></i></a>`
      : '';
  }

  #getNextUrl() {
    return this.#conf.hasNext
      ? `<a class="page next" aria-label="next" href="${this.#conf.nextUrl}"><i class="fas fa-chevron-right fa-fw"></i></a>`
      : '';
  }

  #getPath() {
    const regex = /.*?(?=\/\d+)\//;
    if (this.#conf.nextUrl.includes('/page/')) return this.#conf.nextUrl.match(regex)?.[0] ?? '/';
    if (this.#conf.prevUrl.includes('/page/')) return this.#conf.prevUrl.match(regex)?.[0] ?? '/';
    return '/';
  }

  #getPage() {
    const { totalPages, page } = this.#conf;
    const path = this.#getPath();
    const maxPagesToShow = 5;
    const halfMaxPagesToShow = Math.floor(maxPagesToShow / 2);
    let startPage: number;
    let endPage: number;

    if (totalPages <= maxPagesToShow) {
      startPage = 1;
      endPage = totalPages;
    } else if (page <= halfMaxPagesToShow + 1) {
      startPage = 1;
      endPage = maxPagesToShow;
    } else if (page >= totalPages - halfMaxPagesToShow) {
      startPage = totalPages - maxPagesToShow + 1;
      endPage = totalPages;
    } else {
      startPage = page - halfMaxPagesToShow;
      endPage = page + halfMaxPagesToShow;
    }

    let html = '';
    for (let i = startPage; i <= endPage; i++) {
      html += `<a class="page${i === page ? ' current' : ''}" href="${path}${i}">${i}</a>`;
    }
    return html;
  }

  #createPage() {
    const content = document.querySelector('main.main section.content');
    if (!content) return;
    content.insertAdjacentHTML(
      'beforeend',
      `<div class="pagination">${this.#getPrevUrl()}${this.#getPage()}${this.#getNextUrl()}</div>`,
    );
  }
}
