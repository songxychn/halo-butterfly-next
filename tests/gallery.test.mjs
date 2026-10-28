import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { convertGallery } from '../scripts/gallery/convert.mjs';

test('gallery conversion emits readable images and preserves surrounding content', () => {
  const input = '# Title\n{% gallery true,2,1 %}\n![A <tag>](/a.jpg "Title")\n![B](/b.jpg)\n{% endgallery %}\n{% note %}untouched{% endnote %}';
  const html = convertGallery(input);
  assert.match(html,/^# Title/);
  assert.match(html,/<img src="\/a.jpg" alt="A &lt;tag&gt;" title="Title" loading="lazy" decoding="async">/);
  assert.match(html,/<img src="\/b.jpg"/);
  assert.doesNotMatch(html,/data-type|data-button|data-limit|data-first|\{% (?:end)?gallery/);
  assert.match(html,/{% note %}untouched{% endnote %}/);
});
test('conversion supports group cards and consecutive local galleries', () => {
  const input = '{% galleryGroup "旅行相册" "海边 与 山" /album/ /cover.jpg %}\n{% gallery %}![a](/a.jpg){% endgallery %}\n{% gallery false %}![b](photo.jpg){% endgallery %}';
  const html=convertGallery(input);
  assert.match(html,/class="gallery-group"/);assert.match(html,/海边 与 山/);assert.match(html,/aria-label="旅行相册"/);
  assert.match(html,/src="photo.jpg"/);
  assert.equal((html.match(/class="gallery-container"/g)||[]).length,2);
});
test('remote data, malformed arguments and unsafe image/group URLs fail instead of silently losing content', () => {
  for (const input of ['{% gallery true %}![x](/a.jpg)', '{% gallery true,0 %}{% endgallery %}', '{% gallery url,/data.json %}{% endgallery %}', '{% galleryGroup x y javascript:bad /x %}', '{% gallery %}![x](javascript:bad){% endgallery %}', '{% gallery %}![x](https://u:p@example.test/a){% endgallery %}']) assert.throws(()=>convertGallery(input));
  assert.throws(()=>convertGallery('{% gallery url,https://example.test/data.json %}{% endgallery %}'),/Remote gallery JSON/);
});
test('conversion escapes attribute data and preserves fenced source examples', () => {
  const code='```text\n{% gallery true %}![a](/a.jpg){% endgallery %}\n```\n';
  assert.equal(convertGallery(code),code);
  assert.match(convertGallery(code+'{% gallery false %}![a](/a.jpg){% endgallery %}'),/```text[^]*?```[^]*class="gallery-container"/);
  assert.match(convertGallery('{% gallery %}![a "quote"](/a.jpg?x=1&y=2){% endgallery %}'),/src="\/a.jpg\?x=1&amp;y=2" alt="a &quot;quote&quot;"/);
});
