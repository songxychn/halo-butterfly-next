/** Use Halo's JSON encoder, then protect the serialized output from HTML script tokenization.
 * Escaping after JSON encoding preserves strings, arrays, objects, booleans and null.
 * Source templates retain normal Thymeleaf natural-template syntax; only built scripts change.
 */
export function safeInlineData(html) {
  return html.replace(/(<script\b(?:"[^"]*"|'[^']*'|[^'">])*>)([\s\S]*?)(<\/script\s*>)/gi, (_, open, body, close) => {
    if (!/\bth:inline=(["'])javascript\1/i.test(open)) return open + body + close;
    if (/\bscriptJsonMapper\s*=/.test(open)) throw new Error('Reserved scriptJsonMapper template binding');
    const binding = 'scriptJsonMapper=${T(run.halo.app.infra.utils.JsonUtils).mapper()}';
    open = /\bth:with=(["'])/.test(open) ? open.replace(/\bth:with=(["'])([\s\S]*?)\1/, (_, quote, value) => 'th:with=' + quote + value + ', ' + binding + quote) : open.replace(/>$/, ' th:with="' + binding + '">');
    const safe = body.replace(/\/\*\[\[([\$#])\{([\s\S]*?)\}\]\]\*\//g, (_, kind, value) => {
      if (kind === '#') {
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) throw new Error('Use an explicit #messages.msg expression for parameterized script messages');
        value = `#messages.msg('${value}')`;
      }
      // An encoded JSON string envelope keeps own __proto__ keys as data; a JS
      // object literal would treat them as prototype setters before normalization.
      let json = `scriptJsonMapper.writeValueAsString(scriptJsonMapper.writeValueAsString((${value})))`;
      for (const [character, escaped] of [['<', '\\u003C'], ['>', '\\u003E'], ['\u2028', '\\u2028'], ['\u2029', '\\u2029']]) {
        json = `#strings.replace(${json}, '${character}', '${escaped}')`;
      }
      return "/*[(${'JSON.parse(' + " + json + " + ')'})]*/";
    });
    if (/\[\[|\[\(/.test(body.replace(/\/\*\[\[([\$#])\{([\s\S]*?)\}\]\]\*\//g, ''))) throw new Error('Unsupported raw inline script data expression');
    return open + safe + close;
  });
}
