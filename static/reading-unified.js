async function correctTranslationLanguages(data){
 const response=await fetch('./data/translation-corrections.json?v=1.4.27',{cache:'no-store'});
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
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),synth=window.speechSynthesis;

let sentenceIndex=0;let db,row,voiceKey=KoreanVoicePreference.get(),audioRun=0,timer=null,voiceStartTimer=null,activeUtterance=null;

const voiceID=v=>JSON.stringify([v.voiceURI,v.lang,v.localService]);

function koreanVoices(){return (synth?synth.getVoices():[]).filter(v=>/^ko(?:[-_]|$)/i.test(v.lang))}

function refreshVoices(){

 const select=$('koVoice');select.replaceChildren();if(!synth){$('voiceStatus').textContent=UI.t("이 브라우저는 음성 재생을 지원하지 않습니다. Chrome 또는 Safari에서 열어 주세요.");return}

 const voices=koreanVoices();

 select.add(new Option(UI.t("기기 기본 한국어 음성 (자동)"),''));

 for(const v of voices)select.add(new Option(v.name+' · '+v.lang,voiceID(v)));if(voiceKey&&!voices.some(v=>voiceID(v)===voiceKey))select.add(new Option(KoreanVoicePreference.label(voiceKey),voiceKey));select.value=voiceKey||'';

 select.onchange=()=>{voiceKey=select.value;KoreanVoicePreference.set(voiceKey);stopAudio();refreshVoices()};$('voiceStatus').textContent=voices.length?UI.t("한국어 음성 준비 완료 · 속도 0.80"):UI.t("음성 목록을 기다리는 중입니다. 듣기를 누르면 기본 한국어 음성을 사용합니다.");

}

function clearReadingHighlight(){document.querySelectorAll('.reading-active').forEach(el=>el.classList.remove('reading-active'))}

function highlightReadingSentence(index){
 clearReadingHighlight();sentenceIndex=index;showSentence();
 const card=$('sentences').children[index],line=$('fullText').children[index];
 card?.querySelector('.ko').classList.add('reading-active');line?.classList.add('reading-active');
 if(!$('fullText').hidden&&line){
  const box=$('fullText');
  if(box.scrollHeight>box.clientHeight){
   const top=line.getBoundingClientRect().top-box.getBoundingClientRect().top+box.scrollTop;
   if(top<box.scrollTop||top+line.offsetHeight>box.scrollTop+box.clientHeight)box.scrollTop=top;
  }else line.scrollIntoView({block:'nearest'});
 }
}

function stopAudio(){clearReadingHighlight();audioRun++;clearTimeout(timer);clearTimeout(voiceStartTimer);const wasActive=!!activeUtterance;activeUtterance=null;if(synth&&(wasActive||synth.speaking||synth.pending))synth.cancel();document.querySelectorAll('[data-speak]').forEach(b=>{b.disabled=false;b.textContent=UI.t("🔊 한국어 3번 듣기")});$('fullSpeak').disabled=false}

function utter(text,onend,onstart){

 const run=audioRun,u=new SpeechSynthesisUtterance(text),voice=koreanVoices().find(v=>voiceID(v)===voiceKey);
 activeUtterance=u;if(voice)u.voice=voice;u.lang='ko-KR';u.rate=.80;u.pitch=1;u.volume=1;
 u.onstart=()=>{if(run===audioRun){clearTimeout(voiceStartTimer);if(onstart)onstart()}};
 u.onend=()=>{if(run!==audioRun)return;clearTimeout(voiceStartTimer);activeUtterance=null;onend()};
 const fail=code=>{
   if(run!==audioRun)return;stopAudio();
   if(voice&&['synthesis-failed','voice-unavailable','language-unavailable','start-timeout'].includes(code)){
     voiceKey=null;refreshVoices();$('voiceStatus').textContent=UI.t("선택한 음성 재생 실패 (")+code+UI.t("). 기기 기본 음성으로 바꿨습니다. 듣기를 다시 눌러 주세요.");
   }else $('voiceStatus').textContent=UI.t("음성 재생 실패 (")+code+UI.t("). 휴대폰 설정에서 텍스트 음성 변환 → 한국어 → 재생을 확인해 주세요.");
 };
 u.onerror=e=>fail(e.error||'unknown');voiceStartTimer=setTimeout(()=>fail('start-timeout'),8000);
 try{if(synth.paused)synth.resume();synth.speak(u)}catch(e){fail('synthesis-failed')}

}

function speakWhole(lines){if(!synth)return;stopAudio();const run=audioRun;$('fullSpeak').disabled=true;let i=0;const play=()=>{
 if(run!==audioRun)return;
 if(i>=lines.length){clearReadingHighlight();$('fullSpeak').disabled=false;$('voiceStatus').textContent=UI.t("전체 읽기 완료");return}
 const index=i++;
 $('voiceStatus').textContent=UI.t("전체 읽기 재생 중 · {p0}/{p1}", {p0:(index+1),p1:(lines.length)});
 utter(lines[index],()=>{if(run===audioRun){clearReadingHighlight();timer=setTimeout(play,180)}},()=>highlightReadingSentence(index));
};play()}


function speakThree(text,button){if(!synth)return;stopAudio();const run=audioRun;let n=0,recorded=false;button.disabled=true;const play=()=>{if(run!==audioRun)return;n++;button.textContent='🔊 '+n+UI.t("/3 듣는 중");$('voiceStatus').textContent=UI.t("문장 듣기 · ")+n+'/3';utter(text,()=>{if(run!==audioRun)return;if(n<3)timer=setTimeout(play,250);else{button.disabled=false;button.textContent=UI.t("🔊 한국어 3번 듣기");$('voiceStatus').textContent=UI.t("문장 듣기 완료");if(!recorded){recorded=true;Studies.complete('sentence',text);updateReadingCounts()}}})};play()}

function render(){

 const language=params.get('language'),cfg=db.languages[language];row=(db.readings||[]).find(x=>x.id===params.get('reading'));if(!cfg||!row){location.href='./reading.html';return}

 $('title').textContent=`${UI.t(row.unit)} ${row.kind==='culture'?UI.t("문화"):UI.t("읽기")}`;$('subtitle').textContent=UI.t("{p0}단계 · {p1} · {p2}", {p0:(row.level),p1:(row.title),p2:(cfg.name)});$('kind').textContent=row.kind==='culture'?UI.t("문화"):UI.t("읽기");$('readingTitle').textContent=UI.t(row.title);$('fullText').replaceChildren();row.items.forEach((item,i)=>{const line=document.createElement('span');line.className='reading-full-sentence';line.textContent=item.ko;if(i)$('fullText').append(document.createTextNode('\n'));$('fullText').append(line)});

 const box=$('sentences');box.replaceChildren();row.items.forEach((item,i)=>{const article=document.createElement('article');article.className='reading-sentence';const num=document.createElement('div');num.className='small';num.textContent=(i+1)+' / '+row.items.length;const ko=document.createElement('div');ko.className='ko';ko.textContent=item.ko;const tr=document.createElement('div');tr.className='translation';tr.dir=cfg.rtl?'rtl':'auto';tr.lang=cfg.lang||'';tr.hidden=language==='ko';tr.textContent=item.translations?.[language]||UI.t("번역 준비 중");const btn=document.createElement('button');btn.className='plain';btn.dataset.speak='1';btn.textContent=UI.t("🔊 한국어 3번 듣기");btn.onclick=()=>speakThree(item.ko,btn);const study=document.createElement('p');study.className='help reading-study-count';study.dataset.sentence=item.ko;study.textContent=UI.t('문장 공부 {p0}회',{p0:Studies.count('sentence',item.ko)});article.append(num,ko,tr,btn,study);box.append(article)});

 showSentence();$('readingPrev').onclick=()=>moveSentence(-1);$('readingNext').onclick=()=>moveSentence(1);$('toggleFull').onclick=()=>{const visible=$('fullText').hidden;$('fullText').hidden=!visible;$('sentences').hidden=visible;$('toggleFull').textContent=visible?UI.t("문장별 공부"):UI.t("전체 글 보기");$('toggleFull').setAttribute('aria-expanded',String(visible))};

 $('fullSpeak').onclick=()=>speakWhole(row.items.map(x=>x.ko));$('stopAudio').onclick=stopAudio;$('reloadVoices').onclick=refreshVoices;refreshVoices();if(synth&&!window.kiipReadingVoicesBound){synth.addEventListener('voiceschanged',refreshVoices);window.kiipReadingVoicesBound=true}

}

function showSentence(){const cards=[...$('sentences').children];cards.forEach((el,i)=>el.hidden=i!==sentenceIndex);$('sentenceCount').textContent=UI.t("{p0} / {p1} 문장", {p0:(sentenceIndex+1),p1:(cards.length)});$('readingPrev').disabled=sentenceIndex===0;$('readingNext').disabled=sentenceIndex===cards.length-1}

function moveSentence(step){stopAudio();sentenceIndex=Math.max(0,Math.min(row.items.length-1,sentenceIndex+step));$('fullText').hidden=true;$('sentences').hidden=false;$('toggleFull').textContent=UI.t("전체 글 보기");$('toggleFull').setAttribute('aria-expanded','false');document.querySelectorAll('[data-speak]').forEach(b=>b.textContent=UI.t("🔊 한국어 3번 듣기"));showSentence()}

(async()=>{try{db=await(await fetch('./data/lessons.json?v=1.4.27')).json();UI.prepareData(db);await correctTranslationLanguages(db);render()}catch(e){$('loadStatus').innerHTML=`<div class="notice error">${e.message||UI.t("자료를 불러오지 못했습니다.")}</div>`}})();addEventListener('pagehide',stopAudio);




function updateReadingCounts(){document.querySelectorAll('.reading-study-count').forEach(el=>el.textContent=UI.t('문장 공부 {p0}회',{p0:Studies.count('sentence',el.dataset.sentence)}))}
