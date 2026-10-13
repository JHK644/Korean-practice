/* UI-only localization. Korean learning content is never passed through the dictionary. */
window.UI=(()=>{
 const resources=window.KIIP_UI_RESOURCES||{ko:{}};
 const codes={english:'en',thai:'th',nepali:'ne',vietnamese:'vi',filipino:'fil',khmer:'km',lebanese:'ar',urdu:'ur',uzbek:'uz',mongolian:'mn',sinhala:'si',bengali:'bn',japanese:'ja',french:'fr',spanish:'es',burmese:'my',russian:'ru',wolof:'wo'};
 let language='ko';
 if(!resources[language])language='ko';
 const nativeNames={english:'English',thai:'ภาษาไทย',nepali:'नेपाली',vietnamese:'Tiếng Việt',filipino:'Filipino',khmer:'ភាសាខ្មែរ',lebanese:'العربية',urdu:'اردو',uzbek:'O‘zbekcha',mongolian:'Монгол хэл',sinhala:'සිංහල',bengali:'বাংলা',japanese:'日本語',french:'Français',spanish:'Español',burmese:'မြန်မာဘာသာ',russian:'Русский',wolof:'Wolof'};
 const originals=new WeakMap();
 const protectedSelector='.favorite-ko,.ui-language option,#prompt,#answer,.pronunciation,#exampleKo,#exampleTranslation,.ko,.translation,#fullText,.reading-full-sentence,#mixedLanguageChoices';
 function t(key,args={}){
  if(typeof key!=='string')return key;
  let value=resources[language]?.[key]||resources.ko?.[key]||key;
  return value.replace(/\{(p\d+)\}/g,(m,k)=>Object.hasOwn(args,k)?String(t(String(args[k]))):m);
 }
 function text(value){
  if(resources.ko?.[value])return t(value);
  const trimmed=value.trim(),prefix=trimmed.startsWith('★ ')?'★ ':'';
  if(resources.ko?.[trimmed.slice(prefix.length)])return value.replace(trimmed,prefix+t(trimmed.slice(prefix.length)));
  // Compound navigation labels contain unit, title, and language metadata.
  return value.split(/( · | → | ↔ )/).map(part=>t(part)).join('');
 }
 function apply(){
  document.documentElement.lang=codes[language]||'ko';document.documentElement.dir=['lebanese','urdu'].includes(language)?'rtl':'ltr';
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){
   if(!node.parentElement||node.parentElement.closest('script,style,'+protectedSelector))continue;
   let record=originals.get(node);
   if(!record||node.nodeValue!==record.last)record={source:node.nodeValue,last:node.nodeValue};
   const value=text(record.source);if(node.nodeValue!==value)node.nodeValue=value;
   record.last=value;originals.set(node,record);
  }
  document.title='한국어 발음·읽기 연습 · 한글판 V1.4.36';
  document.querySelectorAll('[data-ui-attr]').forEach(el=>{for(const [attr,key] of Object.entries(JSON.parse(el.dataset.uiAttr)))el.setAttribute(attr,t(key))});
  document.querySelectorAll('a[href]').forEach(a=>{const url=new URL(a.href,location.href);if(url.origin===location.origin&&/\.html$/.test(url.pathname)){url.searchParams.set('uilang',language);a.href=url.href}});
 }
 function set(key){language=resources[key]?key:'ko';apply()}
 addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[aria-label],[title]').forEach(el=>{const attrs={};for(const name of ['aria-label','title'])if(el.hasAttribute(name))attrs[name]=el.getAttribute(name);el.dataset.uiAttr=JSON.stringify(attrs)});
  const select=document.getElementById('language');
  if(select){select.addEventListener('change',()=>{set(select.value)})}
  apply();const observer=new MutationObserver(()=>{observer.disconnect();apply();observer.observe(document.body,{childList:true,subtree:true,characterData:true})});observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 });
 function prepareData(data){data.languages={ko:{key:'ko',name:'한국어',native:'한국어',lang:'ko-KR',rtl:false,note:''},...data.languages};return data}
 return {t,set,apply,prepareData,get language(){return language}};
})();
