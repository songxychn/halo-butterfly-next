/** Synthetic, public gallery data only; no accounts, personal content or remote SDKs. */
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function images(base, count = 9) {
  return Array.from({length:count},(_,i)=>({url:`${base}/gallery-${i % 3}.svg?image=${i}`,alt:`合成图片 ${i}`,title:`标题 ${i}`}));
}
export function gallery(id, data, {button=true,first=2,limit=3,type='data'}={}) {
  return `<div id="${id}" class="gallery-container" data-type="${type}" data-button="${button}" data-first="${first}" data-limit="${limit}"><div class="gallery-items">${escape(type==='data'?JSON.stringify(data):data)}</div></div>`;
}
export function galleryBody(base) {
  return `<h2 id="gallery-heading">正文图库合成样例</h2>
  ${gallery('button-gallery',images(base))}
  <div class="gallery-group-main"><figure class="gallery-group"><img class="gallery-group-img no-lightbox" src="${base}/gallery-0.svg" alt="旅行相册"><figcaption><div class="gallery-group-name">旅行相册</div><p>合成图库分组</p><a href="#gallery-heading" aria-label="旅行相册"></a></figcaption></figure></div>
  ${gallery('remote-gallery',base+'/gallery-data.json',{type:'url'})}
  ${gallery('retry-gallery',base+'/retry.json',{type:'url'})}
  ${gallery('bad-gallery',[{url:base+'/missing.jpg',alt:'坏图'}])}
  ${gallery('empty-gallery',[])}
  ${gallery('invalid-gallery','not an array')}
  <div id="hidden-wrapper" style="display:none">${gallery('hidden-gallery',images(base,4))}</div>
  ${gallery('auto-gallery',images(base,18),{button:false})}
  <p id="after-gallery">图库后的普通正文。</p>`;
}
