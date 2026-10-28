/** Resolve the assets that actually exist in Next; never point Halo bundles at Hexo npm files. */
export function configureResourceTags(html) {
  const images = configureResourceImages(html);
  return images.replace(/<(script|link)\b[^>]*\bth:(src|href)="\$\{assets_link \+ ([^"\n]+)\}"[^>]*>/g, (tag, element, attr, tail) => {
    const match = tail.match(/^'([^']+)'/);
    if (!match) return tag;
    const path = match[1];
    const key = path.startsWith('css/') ? 'main_css' : path.startsWith('js/masonry') ? 'masonry'
      : path.startsWith('js/') ? 'main' : path.startsWith('plugins/loading/') ? 'loading'
      : path === 'plugins/fontawesome/css/all.min.css' ? 'fontawesome'
      : path === 'plugins/prism/prism.min.css' ? 'prismjs_css'
      : path.startsWith('plugins/prism/themes/prism-') ? (tag.includes('codeLight') ? 'code_light' : 'code_dark') : null;
    if (!key) return tag;
    const withoutQuery = value => `(#strings.contains(${value}, '?') ? #strings.substringBefore(${value}, '?') : ${value})`;
    const local = `cdn?.version == false ? ${withoutQuery(`assets_link + ${tail}`)} : assets_link + ${tail}`;
    const expand = field => `(cdn?.${field} ?: '').replaceAll('[$]\\x7bversion\\x7d', theme.spec.version).replaceAll('[$]\\x7bfile\\x7d', ${withoutQuery(tail)}).replaceAll('[$]\\x7bname\\x7d', 'halo-butterfly-next')`;
    const root = `(cdn?.asset_base ?: '').replaceAll('[$]\\x7bversion\\x7d', theme.spec.version).replaceAll('[$]\\x7bname\\x7d', 'halo-butterfly-next')`;
    const unified = `(not #strings.isEmpty(themeRoot) and not #strings.contains(themeRoot, '?') and not #strings.contains(themeRoot, '#') and not #strings.contains(themeRoot, '$') ? themeRoot.replaceAll('/+$', '') + '/' + ${withoutQuery(tail)} : '')`;
    const valid = value => `not #strings.isEmpty(${value}) and not #strings.startsWith(${value}, '//') and ${value}.matches('https://[a-zA-Z0-9.-]+(?::[0-9]+)?(?:/[a-zA-Z0-9._~:/?#%&amp;=,+!()@$-]*)?|/[a-zA-Z0-9._~/?#%&amp;=,+!()@$-]*') and not #strings.contains(${value}, '$')`;
    const withAttr = `th:with="cdn=\${theme.config.CDN},localResource=\${${local}},overrideResource=\${${expand(`option?.${key}`)}},themeRoot=\${${root}},unifiedResource=\${${unified}},resourceUrl=\${${valid('overrideResource')} ? overrideResource : (${valid('unifiedResource')} ? unifiedResource : localResource)}"`;
    // A prepared parser-inserted script does not execute again when its src changes.
    const fallback = element === 'script'
      ? "var s=document.createElement('script');s.async=false;for(var a of this.attributes){if(a.name!=='src' &amp;&amp; a.name!=='onerror')s.setAttribute(a.name,a.value)}s.src=this.dataset.localResource;this.replaceWith(s)"
      : 'this.href=this.dataset.localResource';
    return tag.replace(`th:${attr}="\${assets_link + ${tail}}"`, () => `th:${attr}="\${resourceUrl}" ${withAttr} th:attr="data-local-resource=\${localResource},data-resource-key='${key}',data-resource-file=\${${withoutQuery(tail)}}" onerror="this.onerror=null;${fallback}"`);
  });
}

/** The default illustration belongs to the theme; author images and local error fallback do not move. */
export function configureResourceImages(html) {
  const expand = field => `(theme.config.CDN?.${field} ?: '').replaceAll('[$]\\x7bversion\\x7d', theme.spec.version).replaceAll('[$]\\x7bname\\x7d', 'halo-butterfly-next')`;
  const base = expand('asset_base');
  const candidate = `(not #strings.isEmpty(${base}) ? (not #strings.contains(${base}, '?') and not #strings.contains(${base}, '#') ? ${base}.replaceAll('/+$', '') + '/images/above.svg' : '') : '')`;
  const expression = `(not #strings.isEmpty(${base}) and ${candidate}.matches('https://[a-zA-Z0-9.-]+(?::[0-9]+)?/[a-zA-Z0-9._~:/?#%&amp;=,+!()@$-]*|/(?!/)[a-zA-Z0-9._~/?#%&amp;=,+!()@$-]*') and not #strings.contains(${candidate}, '$') ? ${candidate} : #theme.assets('/images/above.svg'))`;
  return html.split('\n').map(line => /th:data-(?:fallback|local-theme-image)=/.test(line) ? line : line.replaceAll("#theme.assets('/images/above.svg')", () => expression)).join('\n');
}
