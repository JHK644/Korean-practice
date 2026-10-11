async function correctTranslationLanguages(data){
 const response=await fetch('./data/translation-corrections.json?v=1.4.27',{cache:'no-store'});
 if(!response.ok)throw new Error('번역 수정 자료를 불러오지 못했습니다. 다시 접속해 주세요.');
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

let sentenceIndex=0;let db,row,voiceKey=null,audioRun=0,timer=null,voiceStartTimer=null,activeUtterance=null;

const voiceID=v=>JSON.stringify([v.voiceURI,v.lang,v.localService]);

function koreanVoices(){return (synth?synth.getVoices():[]).filter(v=>/^ko(?:[-_]|$)/i.test(v.lang))}

function refreshVoices(){

 const select=$('koVoice');select.replaceChildren();if(!synth){$('voiceStatus').textContent='이 브라우저는 음성 재생을 지원하지 않습니다. Chrome 또는 Safari에서 열어 주세요.';return}

 const voices=koreanVoices();if(voiceKey&&!voices.some(v=>voiceID(v)===voiceKey))voiceKey=null;

 select.add(new Option('기기 기본 한국어 음성 (자동)',''));

 for(const v of voices)select.add(new Option(v.name+' · '+v.lang,voiceID(v)));select.value=voiceKey||'';

 select.onchange=()=>{voiceKey=select.value;stopAudio();refreshVoices()};$('voiceStatus').textContent=voices.length?'한국어 음성 준비 완료 · 속도 0.80':'음성 목록을 기다리는 중입니다. 듣기를 누르면 기본 한국어 음성을 사용합니다.';

}

function stopAudio(){audioRun++;clearTimeout(timer);clearTimeout(voiceStartTimer);const wasActive=!!activeUtterance;activeUtterance=null;if(synth&&(wasActive||synth.speaking||synth.pending))synth.cancel();document.querySelectorAll('[data-speak]').forEach(b=>{b.disabled=false;b.textContent='🔊 한국어 3번 듣기'});$('fullSpeak').disabled=false}

function utter(text,onend){

 const run=audioRun,u=new SpeechSynthesisUtterance(text),voice=koreanVoices().find(v=>voiceID(v)===voiceKey);
 activeUtterance=u;if(voice)u.voice=voice;u.lang='ko-KR';u.rate=.80;u.pitch=1;u.volume=1;
 u.onstart=()=>{if(run===audioRun)clearTimeout(voiceStartTimer)};
 u.onend=()=>{if(run!==audioRun)return;clearTimeout(voiceStartTimer);activeUtterance=null;onend()};
 const fail=code=>{
   if(run!==audioRun)return;stopAudio();
   if(voice&&['synthesis-failed','voice-unavailable','language-unavailable','start-timeout'].includes(code)){
     voiceKey=null;refreshVoices();$('voiceStatus').textContent='선택한 음성 재생 실패 ('+code+'). 기기 기본 음성으로 바꿨습니다. 듣기를 다시 눌러 주세요.';
   }else $('voiceStatus').textContent='음성 재생 실패 ('+code+'). 휴대폰 설정에서 텍스트 음성 변환 → 한국어 → 재생을 확인해 주세요.';
 };
 u.onerror=e=>fail(e.error||'unknown');voiceStartTimer=setTimeout(()=>fail('start-timeout'),8000);
 try{if(synth.paused)synth.resume();synth.speak(u)}catch(e){fail('synthesis-failed')}

}

function speakWhole(lines){if(!synth)return;stopAudio();const run=audioRun;$('fullSpeak').disabled=true;let i=0;const play=()=>{if(run!==audioRun)return;if(i>=lines.length){$('fullSpeak').disabled=false;$('voiceStatus').textContent='전체 읽기 완료';return}$('voiceStatus').textContent=`전체 읽기 재생 중 · ${i+1}/${lines.length}`;utter(lines[i++],()=>{if(run===audioRun)timer=setTimeout(play,180)})};play()}

function speakThree(text,button){if(!synth)return;stopAudio();const run=audioRun;let n=0;button.disabled=true;const play=()=>{if(run!==audioRun)return;n++;button.textContent='🔊 '+n+'/3 듣는 중';$('voiceStatus').textContent='문장 듣기 · '+n+'/3';utter(text,()=>{if(run!==audioRun)return;if(n<3)timer=setTimeout(play,250);else{button.disabled=false;button.textContent='🔊 한국어 3번 듣기';$('voiceStatus').textContent='문장 듣기 완료'}})};play()}

function render(){

 const language=params.get('language'),cfg=db.languages[language];row=(db.readings||[]).find(x=>x.id===params.get('reading'));if(!cfg||!row){location.href='./reading.html';return}

 $('title').textContent=`${row.unit} ${row.kind==='culture'?'문화':'읽기'}`;$('subtitle').textContent=`${row.level}단계 · ${row.title} · ${cfg.name}`;$('kind').textContent=row.kind==='culture'?'문화':'읽기';$('readingTitle').textContent=row.title;$('fullText').textContent=row.items.map(x=>x.ko).join('\n');

 const box=$('sentences');box.replaceChildren();row.items.forEach((item,i)=>{const article=document.createElement('article');article.className='reading-sentence';const num=document.createElement('div');num.className='small';num.textContent=(i+1)+' / '+row.items.length;const ko=document.createElement('div');ko.className='ko';ko.textContent=item.ko;const tr=document.createElement('div');tr.className='translation';tr.dir=cfg.rtl?'rtl':'auto';tr.lang=cfg.lang||'';tr.textContent=item.translations?.[language]||'번역 준비 중';const btn=document.createElement('button');btn.className='plain';btn.dataset.speak='1';btn.textContent='🔊 한국어 3번 듣기';btn.onclick=()=>speakThree(item.ko,btn);article.append(num,ko,tr,btn);box.append(article)});

 showSentence();$('readingPrev').onclick=()=>moveSentence(-1);$('readingNext').onclick=()=>moveSentence(1);$('toggleFull').onclick=()=>{const visible=$('fullText').hidden;$('fullText').hidden=!visible;$('sentences').hidden=visible;$('toggleFull').textContent=visible?'문장별 공부':'전체 글 보기';$('toggleFull').setAttribute('aria-expanded',String(visible))};

 $('fullSpeak').onclick=()=>speakWhole(row.items.map(x=>x.ko));$('stopAudio').onclick=stopAudio;$('reloadVoices').onclick=refreshVoices;refreshVoices();if(synth)synth.addEventListener('voiceschanged',refreshVoices)

}

function showSentence(){const cards=[...$('sentences').children];cards.forEach((el,i)=>el.hidden=i!==sentenceIndex);$('sentenceCount').textContent=`${sentenceIndex+1} / ${cards.length} 문장`;$('readingPrev').disabled=sentenceIndex===0;$('readingNext').disabled=sentenceIndex===cards.length-1}

function moveSentence(step){stopAudio();sentenceIndex=Math.max(0,Math.min(row.items.length-1,sentenceIndex+step));$('fullText').hidden=true;$('sentences').hidden=false;$('toggleFull').textContent='전체 글 보기';$('toggleFull').setAttribute('aria-expanded','false');document.querySelectorAll('[data-speak]').forEach(b=>b.textContent='🔊 한국어 3번 듣기');showSentence()}

(async()=>{try{db=await(await fetch('./data/lessons.json?v=1.4.27')).json();await correctTranslationLanguages(db);render()}catch(e){$('loadStatus').innerHTML=`<div class="notice error">${e.message||'자료를 불러오지 못했습니다.'}</div>`}})();addEventListener('pagehide',stopAudio);



