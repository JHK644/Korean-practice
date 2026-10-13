async function correctTranslationLanguages(data){
 const response=await fetch('./data/translation-corrections.json?v=1.4.34',{cache:'no-store'});
 if(!response.ok)throw new Error(UI.t("번역 수정 자료를 불러오지 못했습니다. 다시 접속해 주세요."));
 const patch=await response.json();
 for(const correction of patch.corrections){
  let item=data;
  for(const part of correction.path)item=item?.[part];
  if(item?.translations?.[correction.language]===correction.before){
   item.translations[correction.language]=correction.after;
  }
 }
}
const $=id=>document.getElementById(id), qs=new URLSearchParams(location.search);

let db,cfg,lesson,pairs=[],pool=[],order=[],pos=0,mode='ko-target',speechRun=0,known=new Set(),review=new Set(),storeKey='',isReview=false,reviewType='',levelId='';

const synth=window.speechSynthesis,pinned={};let timer=null,voiceStartTimer=null,activeUtterance=null;

let revealTimer=null,revealRun=0;

const mixedReview=qs.get('mixed')==='1'&&!!qs.get('review');



function readStore(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}

function writeStore(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}

const voiceID=v=>JSON.stringify([v.voiceURI,v.lang,v.localService]);

function sample(arr,n){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,Math.min(n,a.length))}

function makePair(item,lessonId,index,key){return {baseId:`${lessonId}:${index}`,id:`${lessonId}:${index}`,ko:item.ko,pronunciation:item.pronunciation||null,target:key==='ko'?item.ko:(item.translations[key]||''),sentence:item.sentence||null,sentenceTarget:key==='ko'?(item.sentence?.ko||''):(item.sentence?.translations?.[key]||'')}}



async function init(){

 db=await (await fetch('./data/lessons.json?v=1.4.34')).json();UI.prepareData(db);
 const requestedLevel=qs.get('level')||(qs.get('lesson')||'').split('-')[1];
 if(requestedLevel==='3'||requestedLevel==='4'){
   const files=requestedLevel==='4'?[1,2,3,4].map(n=>`level4-sentences-${n}.json`):['level3-sentences.json'];
   for(const file of files){
     const sentenceResponse=await fetch(`./data/${file}?v=1.4.34`);
     if(!sentenceResponse.ok)throw new Error(UI.t("문장 자료를 불러오지 못했습니다."));
     const sentenceData=await sentenceResponse.json();
     for(const unit of db.lessons){
       const sentences=sentenceData.lessons[unit.id];
       if(sentences){for(const [index,sentence] of Object.entries(sentences)){
         if(!unit.items[index])throw new Error(UI.t("문장 자료 위치가 맞지 않습니다."));
         unit.items[index].sentence=sentence;
         if(sentence.wordCorrection)unit.items[index].ko=sentence.wordCorrection;
       }}
     }
   }
 }
 if(['1','2','3','4'].includes(requestedLevel)){
  const response=await fetch(`./data/level${requestedLevel}-pronunciations.json?v=1.4.34`);
  if(!response.ok)throw new Error(UI.t("발음 자료를 불러오지 못했습니다. 다시 접속해 주세요."));
  const data=await response.json();
  for(const unit of db.lessons){if(unit.level===requestedLevel){
   for(const item of unit.items)item.pronunciation=data.words[item.ko]||null;
  }}
 }
 await correctTranslationLanguages(db);
 const translationFiles={"4": ["level4-translations-1.json", "level4-translations-2.json", "level4-translations-3.json"], "3": ["level3-translations-1.json", "level3-translations-2.json", "level3-translations-3.json"]}[requestedLevel]||[];
 for(const file of translationFiles){
  const response=await fetch(`./data/${file}?v=1.4.34`);
  if(!response.ok)throw new Error(UI.t("문장 번역을 불러오지 못했습니다. 다시 접속해 주세요."));
  const translated=await response.json();
  for(const unit of db.lessons){
   if(unit.level!==requestedLevel)continue;
   for(const item of unit.items){
    const sentence=item.sentence,translations=sentence&&translated.sentences[sentence.ko];
    if(!translations)continue;
    for(const [language,text] of Object.entries(translations)){
     if(!sentence.translations?.[language]){
      sentence.translations??={};sentence.translations[language]=text;
      sentence.translationStatus??={};sentence.translationStatus[language]='translated';
      sentence.translationMetadata={provider:'Google Translate',arabicVariety:'Modern Standard Arabic'};
     }
    }
   }
  }
 }

 const key=qs.get('language'), lessonId=qs.get('lesson');reviewType=qs.get('review')||'';levelId=qs.get('level')||'';

 cfg=db.languages[key];isReview=!!reviewType;

 let mixedLanguageKeys=Object.keys(db.languages).filter(k=>k!=='ko');

 if(mixedReview&&qs.has('languages')){

   try{const selected=JSON.parse(qs.get('languages'));

     mixedLanguageKeys=Array.isArray(selected)?[...new Set(selected.filter(k=>Object.hasOwn(db.languages,k)))]:[];

   }catch{mixedLanguageKeys=[]}

 }

 if(mixedReview&&!mixedLanguageKeys.length){$('title').textContent=UI.t("복습 언어를 선택해 주세요.");$('koSpeak').disabled=true;return}

 if(!cfg){location.href='./index.html';return}



 if(qs.get('favorites')==='1'){
   const selected=Studies.favorites();const units=db.lessons.filter(x=>x.level===qs.get('level'));pairs=[];
   for(const unit of units)unit.items.forEach((item,index)=>{if(Object.hasOwn(selected,unit.id+':'+index))pairs.push(makePair(item,unit.id,index,key))});
   if(!pairs.length){$('title').textContent=UI.t('즐겨찾기');$('subtitle').textContent=UI.t('즐겨찾기한 단어가 없습니다. 단어 학습 화면에서 별표를 눌러 추가하세요.');document.querySelector('main').hidden=true;return}
   order=[...pairs.keys()];$('title').textContent=UI.t('즐겨찾기');$('subtitle').textContent=UI.t('즐겨찾기 단어 {p0}개',{p0:pairs.length});storeKey='kiip-korean-favorites-'+qs.get('level')+'-'+key;
 }else if(isReview){

   mode=mixedReview||qs.get('direction')==='reverse'?'target-ko':'ko-target';

   $('forward').classList.toggle('active',mode==='ko-target');

   $('reverse').classList.toggle('active',mode==='target-ko');

   document.querySelector('.modes').hidden=true;

   const lessons=db.lessons.filter(x=>x.level===levelId).sort((a,b)=>parseInt(a.unit,10)-parseInt(b.unit,10));

   if(!lessons.length){location.href='./index.html';return}

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

   if(!pool.length){$('title').textContent=UI.t("복습할 번역어가 없습니다.");$('koSpeak').disabled=true;return}

   drawReview();

   const rangeText=reviewType==='mid'?UI.t("앞 {p0}개 단원", {p0:(sourceLessons.length)}):UI.t("전체 {p0}개 단원", {p0:(sourceLessons.length)});

   $('title').textContent=UI.t("{p0} · {p1} 복습", {p0:(mixedReview?UI.t("전체 외국어 랜덤"):cfg.name),p1:(reviewType==='mid'?UI.t("중간"):UI.t("최종"))});

   $('subtitle').textContent=UI.t("18개 언어판 V1.5.0 · {p0}단계 · {p1} · 랜덤 {p2}개", {p0:(levelId),p1:(rangeText),p2:(pairs.length)});

   $('newReview').hidden=false;

   if(mixedReview)$('subtitle').textContent+=UI.t(" · 선택 언어: ")+mixedLanguageKeys.map(k=>db.languages[k].name).join(', ');

   storeKey=`koreanQuiz-review-${levelId}-${reviewType}-${mixedReview?'mixed-'+JSON.stringify([...mixedLanguageKeys].sort()):key}`;

 }else{

   lesson=db.lessons.find(x=>x.id===lessonId);

   if(!lesson){location.href='./index.html';return}

   const pilotUnit=Number.parseInt(lesson.unit,10);

   const pilotItems=lesson.items;

   pairs=pilotItems.map((item,i)=>makePair(item,lesson.id,i,key));order=[...pairs.keys()];

   $('title').textContent=key==='ko'?UI.t('한국어 발음연습'):UI.t("한국어 ↔ {p0}", {p0:(cfg.name)});

   $('subtitle').textContent=UI.t("18개 언어판 V1.5.0 · {p0}단계 · {p1} · {p2} · {p3}개", {p0:(lesson.level),p1:(lesson.unit),p2:(lesson.title),p3:(pairs.length)});

   storeKey=`koreanQuiz-${lesson.id}-${key}`;

 }

 const saved=readStore(storeKey,{known:[],review:[]});known=new Set(saved.known);review=new Set(saved.review);

 $('forward').textContent=UI.t("한국어 → {p0}", {p0:(cfg.name)});$('reverse').textContent=UI.t("{p0} → 한국어", {p0:(cfg.name)});

 $('langNote').textContent='';

 if(key==='ko')document.querySelector('.modes').hidden=true;
 if(!window.kiipPracticeBound){bind();window.kiipPracticeBound=true}refreshVoices();render();

}

function clearRevealCountdown(){

 revealRun++;clearTimeout(revealTimer);revealTimer=null;

 const el=$('revealCountdown');if(el){el.hidden=true;el.textContent=''}

}

function startRevealCountdown(){

 const el=$('revealCountdown');

 if(!isReview||mode!=='ko-target'){return}

 const run=revealRun;let seconds=5;el.hidden=false;el.textContent=seconds+UI.t("초");

 const tick=()=>{

   if(run!==revealRun)return;

   seconds--;el.textContent=seconds+UI.t("초");

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

 const w=current();if(!w)return;updateStudyRecords();

 clearRevealCountdown();

 $('card').classList.remove('revealed');

 $('prompt').lang=mode==='ko-target'?'ko':cfg.lang;$('answer').lang=mode==='ko-target'?cfg.lang:'ko';
 $('prompt').textContent=mode==='ko-target'?w.ko:w.target;$('answer').textContent=mode==='ko-target'?w.target:w.ko;

 renderPronunciation($('promptPronunciation'),mode==='ko-target'?w.pronunciation:null);
 renderPronunciation($('answerPronunciation'),mode==='target-ko'?w.pronunciation:null);
 $('tag').textContent=mode==='ko-target'?UI.t("한국어"):(mixedReview?(w.languageName+' · '+(w.languageNative||'')):cfg.native);

 $('card').setAttribute('aria-pressed','false');
 requestAnimationFrame(fitMobileCard);
 $('count').textContent=`${pos+1} / ${pairs.length}`;

 const selectedIds=new Set(pairs.map(x=>x.id));

 $('doneText').textContent='';

 $('bar').style.width=`${(pos+1)/pairs.length*100}%`;

 const panel=$('examplePanel');

 if(!isReview&&w.sentence?.ko){

   panel.hidden=false;$('exampleKo').replaceChildren();

   const text=w.sentence.ko,highlight=w.sentence.highlight||'';const at=highlight?text.indexOf(highlight):-1;

   if(at>=0){$('exampleKo').append(document.createTextNode(text.slice(0,at)));const mark=document.createElement('mark');mark.textContent=highlight;$('exampleKo').append(mark,document.createTextNode(text.slice(at+highlight.length)))}else $('exampleKo').textContent=text;

   $('exampleKo').classList.toggle('long',text.length>54);
   const generated=w.sentence.kind==='generated'||w.sentence.generated===true;
   $('exampleLabel').textContent=generated?UI.t("AI 생성 문장"):w.sentence.kind==='guide_original'?UI.t("● 지도서 원문장"):UI.t("● 교재 원문장");



   const tr=$('exampleTranslation');tr.hidden=qs.get('language')==='ko';tr.textContent=w.sentenceTarget||UI.t("문장 번역 준비 중 · 한국어 문장을 먼저 연습하세요.");tr.lang=cfg.lang||'';tr.dir=cfg.rtl?'rtl':'auto';

   const translationNote=$('exampleTranslationNote');
   if(translationNote){translationNote.hidden=!(w.sentence.translationMetadata&&qs.get('language')==='lebanese');translationNote.textContent=UI.t("표준 아랍어 번역");}

   document.querySelector('main').classList.toggle('long-example',text.length+w.sentenceTarget.length>280);
   requestAnimationFrame(fitMobileExample);
   $('sentenceSpeak').disabled=false;

 }else{panel.hidden=true;$('exampleKo').textContent='';$('sentenceSpeak').disabled=true}

 startRevealCountdown();

}

function move(n){stopAudio();pos=(pos+n+order.length)%order.length;render()}

function mark(type){const id=current().id;if(type==='known'){known.add(id);review.delete(id)}else{review.add(id);known.delete(id)}save();move(1)}

function setMode(m){stopAudio();mode=m;$('forward').classList.toggle('active',m==='ko-target');$('reverse').classList.toggle('active',m==='target-ko');render()}

function stopAudio(){speechRun++;clearTimeout(timer);clearTimeout(voiceStartTimer);const wasActive=!!activeUtterance;activeUtterance=null;if(synth&&(wasActive||synth.speaking||synth.pending))synth.cancel();$('koSpeak').textContent=UI.t("🔊 단어 3번 듣기");$('sentenceSpeak').textContent=UI.t("🔊 문장 3번 듣기")}

function availableKorean(){return (synth?synth.getVoices():[]).filter(v=>/^ko(?:[-_]|$)/i.test(v.lang))}

function refreshVoices(){

 if(!synth){$('voiceStatus').textContent=UI.t("이 브라우저는 음성 재생을 지원하지 않습니다.");$('koSpeak').disabled=true;return}

 const list=availableKorean(),lang='ko-KR',store='quiz-v19-voice-'+lang;
 if(pinned[lang]===undefined)pinned[lang]=KoreanVoicePreference.get();

 const select=$('koVoice');select.replaceChildren();
 const o=document.createElement('option');o.value='';o.textContent=UI.t("기기 기본 한국어 음성 (자동)");select.appendChild(o);
 for(const v of list){const o=document.createElement('option');o.value=voiceID(v);o.textContent=v.name+' · '+v.lang;select.appendChild(o)}

 if(pinned[lang]&&!list.some(v=>voiceID(v)===pinned[lang]))select.add(new Option(KoreanVoicePreference.label(pinned[lang]),pinned[lang]));
 select.value=pinned[lang]||'';

 $('koSpeak').disabled=false;

 select.onchange=()=>{stopAudio();pinned[lang]=select.value;KoreanVoicePreference.set(select.value);refreshVoices()};

 $('voiceStatus').textContent=list.length?UI.t("한국어 음성 준비 완료 · 속도 0.80"):UI.t("음성 목록을 기다리는 중입니다. 듣기를 누르면 기본 한국어 음성으로 재생합니다.");

}

function speak3(text,button,label){

 if(!synth)return;

 stopAudio();refreshVoices();const run=speechRun;

 let n=0,recorded=false;const kind=button.id==='koSpeak'?'word':'sentence';

 const play=()=>{

   if(run!==speechRun)return;n++;button.textContent='🔊 '+label+' '+n+'/3';

   const voice=availableKorean().find(v=>voiceID(v)===pinned['ko-KR']);

   const u=new SpeechSynthesisUtterance(text);activeUtterance=u;

   if(voice)u.voice=voice;

   u.lang='ko-KR';u.rate=.80;u.pitch=1;u.volume=1;

   $('voiceStatus').textContent=UI.t("한국어: ")+(voice?voice.name:UI.t("기기 기본 음성"))+' · '+n+'/3';

   u.onstart=()=>{if(run===speechRun)clearTimeout(voiceStartTimer)};
   u.onend=()=>{if(run!==speechRun)return;clearTimeout(voiceStartTimer);activeUtterance=null;if(n<3)timer=setTimeout(play,250);else {button.textContent=UI.t("🔊 {p0} 3번 듣기", {p0:(label)});if(!recorded){recorded=true;Studies.complete(kind,text);updateStudyRecords()}}};

   const fail=code=>{
     if(run!==speechRun)return;stopAudio();
     if(voice&&['synthesis-failed','voice-unavailable','language-unavailable','start-timeout'].includes(code)){
       pinned['ko-KR']='';refreshVoices();
       $('voiceStatus').textContent=UI.t("선택한 음성 재생 실패 (")+code+UI.t("). 기기 기본 음성으로 바꿨습니다. 듣기를 다시 눌러 주세요.");
     }else $('voiceStatus').textContent=UI.t("음성 재생 실패 (")+code+UI.t("). 휴대폰 설정에서 텍스트 음성 변환 → 한국어 → 재생을 확인해 주세요.");
   };
   u.onerror=e=>fail(e.error||'unknown');
   voiceStartTimer=setTimeout(()=>fail('start-timeout'),8000);
   // First playback stays in the tap handler; resume only an actually paused engine.
   try{if(synth.paused)synth.resume();synth.speak(u)}catch(e){fail('synthesis-failed')}


 };

 play();

}

function shuffleOrder(){stopAudio();for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}pos=0;render()}

function bind(){
 $('favoriteWord').onclick=()=>{Studies.toggle(current());updateStudyRecords()};

 $('card').onclick=()=>{clearRevealCountdown();$('card').classList.toggle('revealed');$('card').setAttribute('aria-pressed',String($('card').classList.contains('revealed')))};$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);

 $('forward').onclick=()=>setMode('ko-target');$('reverse').onclick=()=>setMode('target-ko');$('shuffle').onclick=shuffleOrder;

 $('newReview').onclick=()=>{if(!isReview)return;stopAudio();drawReview();render()};

 $('koSpeak').textContent=UI.t("🔊 단어 3번 듣기");$('koSpeak').onclick=()=>speak3(current().ko,$('koSpeak'),UI.t("단어"));$('sentenceSpeak').onclick=()=>{const s=current().sentence?.ko;if(s)speak3(s,$('sentenceSpeak'),UI.t("문장"))};$('reloadVoices').onclick=refreshVoices;$('stopAudio').onclick=stopAudio;if(synth)synth.addEventListener('voiceschanged',refreshVoices);

 addEventListener('keydown',e=>{if(/SELECT|INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.key==='ArrowRight')move(1);else if(e.key==='ArrowLeft')move(-1);else if(e.code==='Space'){e.preventDefault();$('card').click()}else if(e.key.toLowerCase()==='k')mark('known');else if(e.key.toLowerCase()==='r')mark('review')});

}

init();






// Fit long words in their reserved half without changing the card geometry.
function fitMobileCard(){
 for(const id of ['prompt','answer']){
  const el=$(id);el.style.removeProperty('font-size');el.style.removeProperty('overflow');
  if(!matchMedia('(max-width:650px)').matches)continue;
  let size=parseFloat(getComputedStyle(el).fontSize);
  while((el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)&&size>14){size-=.5;el.style.fontSize=size+'px'}
  el.style.overflow=(el.scrollHeight>el.clientHeight+1)?'auto':'';
 }
}
new ResizeObserver(()=>requestAnimationFrame(fitMobileCard)).observe($('card'));

function fitMobileExample(){
 const panel=$('examplePanel'),ko=$('exampleKo'),tr=$('exampleTranslation');
 ko.style.removeProperty('font-size');tr.style.removeProperty('font-size');
 if(panel.hidden||!matchMedia('(max-width:650px)').matches)return;
 let k=parseFloat(getComputedStyle(ko).fontSize),t=parseFloat(getComputedStyle(tr).fontSize);
 while(panel.scrollHeight>panel.clientHeight+1&&(k>13||t>11)){
  k=Math.max(13,k-.5);t=Math.max(11,t-.5);ko.style.fontSize=k+'px';tr.style.fontSize=t+'px';
 }
}
new ResizeObserver(()=>requestAnimationFrame(fitMobileExample)).observe($('examplePanel'));

function renderPronunciation(element,pronunciation){
 element.replaceChildren();element.hidden=!pronunciation;
 if(!pronunciation)return;
 element.setAttribute('aria-label',UI.t("발음 ")+pronunciation.text);
 element.append(document.createTextNode('['));
 for(const segment of pronunciation.segments){
  if(segment.changed){const mark=document.createElement('mark');mark.textContent=segment.text;element.append(mark)}
  else element.append(document.createTextNode(segment.text));
 }
 element.append(document.createTextNode(']'));
}

function updateStudyRecords(){
 const w=current();if(!w)return;
 const active=Studies.has(w.baseId||w.id),button=$('favoriteWord');button.textContent=(active?'★ ':'☆ ')+UI.t(active?'즐겨찾기 해제':'즐겨찾기 추가');button.setAttribute('aria-pressed',String(active));
 $('wordStudyCount').textContent=UI.t('단어 공부 {p0}회',{p0:Studies.count('word',w.ko)});
 const line=$('sentenceStudyCount');line.hidden=!w.sentence?.ko;if(!line.hidden)line.textContent=UI.t('문장 공부 {p0}회',{p0:Studies.count('sentence',w.sentence.ko)});
}
