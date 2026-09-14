const $=id=>document.getElementById(id), qs=new URLSearchParams(location.search);
let db,cfg,lesson,pairs=[],pool=[],order=[],pos=0,mode='ko-target',speechRun=0,known=new Set(),review=new Set(),storeKey='',isReview=false,reviewType='',levelId='';
const synth=window.speechSynthesis,pinned={};let timer=null,activeUtterance=null;
let revealTimer=null,revealRun=0;
const mixedReview=qs.get('mixed')==='1'&&!!qs.get('review');

function readStore(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function writeStore(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
const voiceID=v=>JSON.stringify([v.voiceURI,v.lang,v.localService]);
function sample(arr,n){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,Math.min(n,a.length))}
function makePair(item,lessonId,index,key){return {id:`${lessonId}:${index}`,ko:item.ko,target:item.translations[key]||''}}

async function init(){
 db=await loadPublicData();
 const key=qs.get('language'), lessonId=qs.get('lesson');reviewType=qs.get('review')||'';levelId=qs.get('level')||'';
 cfg=db.languages[key];isReview=!!reviewType;
 let mixedLanguageKeys=Object.keys(db.languages);
 if(mixedReview&&qs.has('languages')){
   try{const selected=JSON.parse(qs.get('languages'));
     mixedLanguageKeys=Array.isArray(selected)?[...new Set(selected.filter(k=>Object.hasOwn(db.languages,k)))]:[];
   }catch{mixedLanguageKeys=[]}
 }
 if(mixedReview&&!mixedLanguageKeys.length){$('title').textContent='복습 언어를 선택해 주세요.';$('koSpeak').disabled=true;return}
 if(!cfg){location.href='index.html';return}

 if(isReview){
   mode=mixedReview||qs.get('direction')==='reverse'?'target-ko':'ko-target';
   $('forward').classList.toggle('active',mode==='ko-target');
   $('reverse').classList.toggle('active',mode==='target-ko');
   document.querySelector('.modes').hidden=true;
   const lessons=db.lessons.filter(x=>x.level===levelId);
   if(!lessons.length){location.href='index.html';return}
   const cut=Math.max(1,Math.ceil(lessons.length/2));
   const sourceLessons=reviewType==='mid'?lessons.slice(0,cut):lessons;
   pool=[];
   sourceLessons.forEach(l=>l.items.forEach((item,i)=>{
     if(mixedReview){
       for(const languageKey of mixedLanguageKeys){
         const language=db.languages[languageKey];
         const target=String(item.translations?.[languageKey]||'').trim();
         if(!target)continue;
         const pair=makePair(item,l.id,i,languageKey);
         pair.id+=':'+languageKey;pair.languageName=language.name;pair.languageNative=language.native;
         pool.push(pair);
       }
     }else pool.push(makePair(item,l.id,i,key));
   }));
   if(!pool.length){$('title').textContent='복습할 번역어가 없습니다.';$('koSpeak').disabled=true;return}
   drawReview();
   const rangeText=reviewType==='mid'?`앞 ${sourceLessons.length}개 단원`:`전체 ${sourceLessons.length}개 단원`;
   $('title').textContent=`${mixedReview?'전체 외국어 랜덤':cfg.name} · ${reviewType==='mid'?'중간':'최종'} 복습`;
   $('subtitle').textContent=`학생용 공개 V1.0 · ${levelId}단계 · ${rangeText} · 랜덤 ${pairs.length}개`;
   $('newReview').hidden=false;
   if(mixedReview)$('subtitle').textContent+=' · 선택 언어: '+mixedLanguageKeys.map(k=>db.languages[k].name).join(', ');
   storeKey=`koreanQuiz-review-${levelId}-${reviewType}-${mixedReview?'mixed-'+JSON.stringify([...mixedLanguageKeys].sort()):key}`;
 }else{
   lesson=db.lessons.find(x=>x.id===lessonId);
   if(!lesson){location.href='index.html';return}
   pairs=lesson.items.map((item,i)=>makePair(item,lesson.id,i,key));order=[...pairs.keys()];
   $('title').textContent=`한국어 ↔ ${cfg.name}`;
   $('subtitle').textContent=`학생용 공개 V1.0 · ${lesson.level}단계 · ${lesson.unit} · ${lesson.title} · ${pairs.length}개 · 한국어 3회 듣기`;
   storeKey=`koreanQuiz-${lesson.id}-${key}`;
 }
 const saved=readStore(storeKey,{known:[],review:[]});known=new Set(saved.known);review=new Set(saved.review);
 $('forward').textContent=`한국어 → ${cfg.name}`;$('reverse').textContent=`${cfg.name} → 한국어`;
 $('langNote').textContent=(cfg.note||'')+(isReview?'  복습 문제는 들어올 때마다 무작위로 다시 뽑힙니다.':'');
 bind();refreshVoices();render();
}
function clearRevealCountdown(){
 revealRun++;clearTimeout(revealTimer);revealTimer=null;
 const el=$('revealCountdown');if(el){el.hidden=true;el.textContent=''}
}
function startRevealCountdown(){
 const el=$('revealCountdown');
 if(!isReview||mode!=='ko-target'){return}
 const run=revealRun;let seconds=5;el.hidden=false;el.textContent=seconds+'초';
 const tick=()=>{
   if(run!==revealRun)return;
   seconds--;el.textContent=seconds+'초';
   if(seconds===0){$('card').classList.add('revealed');el.hidden=true;revealTimer=null;return}
   revealTimer=setTimeout(tick,1000);
 };
 revealTimer=setTimeout(tick,1000);
}
addEventListener('pagehide',clearRevealCountdown);
function drawReview(){pairs=sample(pool,20);order=[...pairs.keys()];pos=0}
function save(){writeStore(storeKey,{known:[...known],review:[...review]})}
function current(){return pairs[order[pos]]}
function render(){
 const w=current();if(!w)return;
 clearRevealCountdown();
 $('card').classList.remove('revealed');
 $('prompt').textContent=mode==='ko-target'?w.ko:w.target;$('answer').textContent=mode==='ko-target'?w.target:w.ko;
 $('tag').textContent=mode==='ko-target'?'한국어':(mixedReview?(w.languageName+' · '+(w.languageNative||'')):cfg.native);
 $('count').textContent=`${pos+1} / ${pairs.length}`;
 const selectedIds=new Set(pairs.map(x=>x.id));
 const knownHere=[...known].filter(x=>selectedIds.has(x)).length, reviewHere=[...review].filter(x=>selectedIds.has(x)).length;
 $('doneText').textContent=`학습 완료 ${knownHere}`;$('knownN').textContent=knownHere;$('reviewN').textContent=reviewHere;
 $('bar').style.width=`${(pos+1)/pairs.length*100}%`;
 startRevealCountdown();
}
function move(n){stopAudio();pos=(pos+n+order.length)%order.length;render()}
function mark(type){const id=current().id;if(type==='known'){known.add(id);review.delete(id)}else{review.add(id);known.delete(id)}save();move(1)}
function setMode(m){stopAudio();mode=m;$('forward').classList.toggle('active',m==='ko-target');$('reverse').classList.toggle('active',m==='target-ko');render()}
function stopAudio(){speechRun++;clearTimeout(timer);if(synth)synth.cancel();$('koSpeak').textContent='🔊 한국어 3번 듣기'}
function availableKorean(){return (synth?synth.getVoices():[]).filter(v=>/^ko(?:[-_]|$)/i.test(v.lang))}
function refreshVoices(){
 if(!synth){$('voiceStatus').textContent='이 브라우저는 음성 재생을 지원하지 않습니다.';$('koSpeak').disabled=true;return}
 const list=availableKorean(),lang='ko-KR',store='quiz-v13-voice-'+lang;
 if(!pinned[lang])pinned[lang]=readStore(store,null)||readStore('quiz-v12-voice-'+lang,null);
 if(list.length&&!list.some(v=>voiceID(v)===pinned[lang])){
   const voice=list.find(v=>v.default)||list[0];pinned[lang]=voiceID(voice);writeStore(store,pinned[lang]);
 }
 const select=$('koVoice');select.replaceChildren();
 if(!list.length){const o=document.createElement('option');o.value='';o.textContent='기기 기본 한국어 음성';select.appendChild(o)}
 for(const v of list){const o=document.createElement('option');o.value=voiceID(v);o.textContent=v.name+' · '+v.lang;select.appendChild(o)}
 if(list.length)select.value=pinned[lang];
 $('koSpeak').disabled=false;
 select.onchange=()=>{if(!select.value)return;stopAudio();pinned[lang]=select.value;writeStore(store,select.value);refreshVoices()};
 $('voiceStatus').textContent=list.length?'한국어 음성 준비 완료 · 속도 0.80':'음성 목록을 기다리는 중입니다. 듣기를 누르면 기본 한국어 음성으로 재생합니다.';
}
function speak3(text){
 if(!synth)return;
 stopAudio();refreshVoices();const run=speechRun;
 let n=0;
 const play=()=>{
   if(run!==speechRun)return;n++;$('koSpeak').textContent='🔊 한국어 '+n+'/3';
   const voice=availableKorean().find(v=>voiceID(v)===pinned['ko-KR']);
   const u=new SpeechSynthesisUtterance(text);activeUtterance=u;
   if(voice)u.voice=voice;
   u.lang='ko-KR';u.rate=.80;u.pitch=1;u.volume=1;
   $('voiceStatus').textContent='한국어: '+(voice?voice.name:'기기 기본 음성')+' · '+n+'/3';
   u.onend=()=>{if(run!==speechRun)return;activeUtterance=null;if(n<3)timer=setTimeout(play,250);else $('koSpeak').textContent='🔊 한국어 3번 듣기'};
   u.onerror=e=>{if(run!==speechRun)return;stopAudio();activeUtterance=null;$('voiceStatus').textContent='음성 재생 실패 ('+(e.error||'unknown')+'). Chrome에서 열고 한국어 음성을 확인해 주세요.'};
   // Keep the first speak call directly in the user's tap handler.
   synth.resume();synth.speak(u);
 };
 play();
}
function shuffleOrder(){stopAudio();for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}pos=0;render()}
function bind(){
 $('card').onclick=()=>{clearRevealCountdown();$('card').classList.toggle('revealed')};$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('again').onclick=()=>mark('review');$('know').onclick=()=>mark('known');
 $('forward').onclick=()=>setMode('ko-target');$('reverse').onclick=()=>setMode('target-ko');$('shuffle').onclick=shuffleOrder;
 $('newReview').onclick=()=>{if(!isReview)return;stopAudio();drawReview();render()};
 $('koSpeak').onclick=()=>speak3(current().ko);$('reloadVoices').onclick=refreshVoices;$('stopAudio').onclick=stopAudio;if(synth)synth.addEventListener('voiceschanged',refreshVoices);
 addEventListener('keydown',e=>{if(/SELECT|INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.key==='ArrowRight')move(1);else if(e.key==='ArrowLeft')move(-1);else if(e.code==='Space'){e.preventDefault();$('card').click()}else if(e.key.toLowerCase()==='k')mark('known');else if(e.key.toLowerCase()==='r')mark('review')});
}
init().catch(showPublicError);


