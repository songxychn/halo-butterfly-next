/** Resolve the assets that actually exist in Next; never point Halo bundles at Hexo npm files. */
export function configureResourceTags(html) {
  return html.replace(/<(script|link)\b[^>]*\bth:(src|href)="\$\{assets_link \+ ([^"\n]+)\}"[^>]*>/g, (tag, element, attr, tail) => {
    const match = tail.match(/^'([^']+)'/);
    if (!match) return tag;
    const path = match[1];
    const key = path.startsWith('css/') ? 'main_css' : path.startsWith('js/integrations') ? 'integrations' : path.startsWith('js/masonry') ? 'masonry'
      : path.startsWith('js/') ? 'main' : path.startsWith('plugins/loading/') ? 'loading'
      : path === 'plugins/fontawesome/css/all.min.css' ? 'fontawesome'
      : path === 'plugins/prism/prism.min.css' ? 'prismjs_css'
      : path.startsWith('plugins/prism/themes/prism-') ? (tag.includes('codeLight') ? 'code_light' : 'code_dark') : null;
    if (!key) return tag;
    const isFont = key === 'fontawesome';
    const provider = isFont ? 'third_party_provider' : 'internal_provider';
    const file = isFont ? 'css/all.min.css' : path;
    const ver = isFont ? "'6.7.2'" : 'theme.spec.version';
    const withoutQuery = value => `(#strings.contains(${value}, '?') ? #strings.substringBefore(${value}, '?') : ${value})`;
    const customFile = isFont ? `'${file}'` : withoutQuery(tail);
    const custom = `(cdn?.custom_format ?: '').replaceAll('[$]\\x7bversion\\x7d', ${ver}).replaceAll('[$]\\x7bfile\\x7d', ${customFile}).replaceAll('[$]\\x7bname\\x7d', '${isFont ? '@fortawesome/fontawesome-free' : 'halo-butterfly-next'}')`;
    const cdn = isFont ? `(cdn?.third_party_provider == 'jsdelivr' ? 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free' + (cdn?.version == false ? '' : '@6.7.2') + '/css/all.min.css' : (cdn?.third_party_provider == 'unpkg' ? 'https://unpkg.com/@fortawesome/fontawesome-free' + (cdn?.version == false ? '' : '@6.7.2') + '/css/all.min.css' : (cdn?.third_party_provider == 'cdnjs' ? 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css' : '')))` : "''";
    const local = `cdn?.version == false ? ${withoutQuery(`assets_link + ${tail}`)} : assets_link + ${tail}`;
    const withAttr = `th:with="cdn=\${theme.config.CDN},localResource=\${${local}},overrideResource=\${${custom.replace("cdn?.custom_format", `cdn?.option?.${key}`)}},customResource=\${${custom}},providerResource=\${cdn?.${provider} == 'custom' ? customResource : ${cdn}},candidateResource=\${not #strings.isEmpty(overrideResource) ? overrideResource : providerResource},resourceUrl=\${not #strings.isEmpty(candidateResource) and not #strings.startsWith(candidateResource, '//') and candidateResource.matches('https://[a-zA-Z0-9.-]+(?::[0-9]+)?(?:/[a-zA-Z0-9._~:/?#%&amp;=,+!()$-]*)?|/[a-zA-Z0-9._~/?#%&amp;=,+!()$-]*') and not #strings.contains(candidateResource, '$') ? candidateResource : localResource}"`;
    // A prepared parser-inserted script does not execute again when its src changes.
    const fallback = element === 'script'
      ? "var s=document.createElement('script');s.async=false;for(var a of this.attributes){if(a.name!=='src' &amp;&amp; a.name!=='onerror')s.setAttribute(a.name,a.value)}s.src=this.dataset.localResource;this.replaceWith(s)"
      : 'this.href=this.dataset.localResource';
    return tag.replace(`th:${attr}="\${assets_link + ${tail}}"`, () => `th:${attr}="\${resourceUrl}" ${withAttr} th:attr="data-local-resource=\${localResource},data-resource-key='${key}'" onerror="this.onerror=null;${fallback}"`);
  });
}
