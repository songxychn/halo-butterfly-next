/** Pure browser-side parsing shared by live collection and offline raw-HTML analysis. */
export function imageSignature({html,runId,initial=false}){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const attrs=node=>Object.fromEntries(['src','srcset','loading','fetchpriority','width','height','alt','media','type'].filter(k=>node?.hasAttribute(k)).map(k=>[k,node.getAttribute(k)]));
 const matches=root=>[...root.querySelectorAll('img')].filter(i=>i.alt.includes(runId));
 const wholePageRunImageCount=matches(doc).length;
 let root=doc;
 if(initial){
  const articles=doc.querySelectorAll('article.render');
  if(articles.length!==1)throw new Error('Initial HTML must contain exactly one article.render; found '+articles.length);
  root=articles[0];
 }
 const images=matches(root).map(i=>({attrs:attrs(i),picture:i.parentElement?.tagName==='PICTURE',sources:i.parentElement?.tagName==='PICTURE'?[...i.parentElement.querySelectorAll('source')].map(attrs):[]})).sort((a,b)=>a.attrs.alt.localeCompare(b.attrs.alt));
 return {images,scope:initial?'article.render':'editor-content-fragment',wholePageRunImageCount};
}
