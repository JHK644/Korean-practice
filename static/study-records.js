/* Browser-local records are shared across UI languages. A complete 3-play run = one study. */
window.Studies=(()=>{
 const key='kiip-korean-study-records-v1';
 function load(){try{const d=JSON.parse(localStorage.getItem(key));return {counts:d?.counts||{},favorites:d?.favorites||{}}}catch{return {counts:{},favorites:{}}}}
 function save(d){try{localStorage.setItem(key,JSON.stringify(d))}catch{}}
 function id(kind,text){return JSON.stringify([kind,text])}
 function count(kind,text){return Number(load().counts[id(kind,text)])||0}
 function complete(kind,text){const d=load(),k=id(kind,text);d.counts[k]=(Number(d.counts[k])||0)+1;save(d);return d.counts[k]}
 function favorites(){return load().favorites}
 function has(wordId){return Object.hasOwn(favorites(),wordId)}
 function toggle(pair){const d=load(),wordId=pair.baseId||pair.id;if(Object.hasOwn(d.favorites,wordId))delete d.favorites[wordId];else d.favorites[wordId]={ko:pair.ko};save(d);return Object.hasOwn(d.favorites,wordId)}
 return {count,complete,favorites,has,toggle};
})();
