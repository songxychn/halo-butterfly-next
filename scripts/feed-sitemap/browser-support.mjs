/** Keep no-JS contexts free of startup storage scripts (Firefox can hang there). */
export function contextOptions(options, base) {
  if (options.javaScriptEnabled === false) return {...options};
  return {...options, storageState: {cookies: [], origins: [{origin: base,
    localStorage: [{name: 'halo-butterfly-next.color-scheme', value: options.colorScheme || 'light'}]}]}};
}

/** One deadline wraps context creation, navigation, evaluation and assertions. */
export async function withinDeadline(operation, milliseconds, label, onTimeout = () => {}) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
      timer = setTimeout(() => {onTimeout(); reject(new Error(`${typeof label === 'function' ? label() : label} exceeded ${milliseconds}ms`));}, milliseconds);
    })]);
  } finally {clearTimeout(timer);}
}

/** The root fallback catalog is English; fallback wording need not equal en.properties. */
export function fallbackMessages(source) {
  const messages = Object.fromEntries(source.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
  }));
  for (const name of ['ui.rssSubscribe', 'ui.sitemap', 'ui.subscriptionLinks']) {
    if (!messages[name]) throw new Error('Missing fallback message: ' + name);
  }
  return messages;
}

/** Executed in the page: wait for real App reentry and finite footer transitions. */
export function footerSettled() {
  const footer = document.querySelector('.footer');
  return Boolean(window.MainApp?.useCommon && footer?.classList.contains('footer--bg')) &&
    footer.getAnimations({subtree: true}).every(animation => {
      const timing = animation.effect?.getComputedTiming();
      return timing?.iterations === Infinity || !Number.isFinite(timing?.endTime) || ['finished', 'idle'].includes(animation.playState);
    });
}
