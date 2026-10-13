/* Shared Korean voice preference for this independent edition. */
window.KoreanVoicePreference=(()=>{
 const key='kiip-korean-v1.5.0-voice-ko-KR';
 function get(){try{const saved=localStorage.getItem(key);if(saved!==null)return JSON.parse(saved)||'';return JSON.parse(localStorage.getItem('quiz-v19-voice-ko-KR'))||''}catch{return ''}}
 function set(value){try{localStorage.setItem(key,JSON.stringify(value||''))}catch{}}
 function label(value){try{const parts=JSON.parse(value);return parts[0]+' · '+parts[1]}catch{return value}}
 return {get,set,label};
})();
