

let db;

async function init(){

 db=await (await fetch('./data/lessons.json?v=1.4.34')).json();UI.prepareData(db);db.levels=db.levels.filter(v=>!['0','5'].includes(String(v.id)));

 const L=document.querySelector('#language'),V=document.querySelector('#level');

 L.innerHTML=Object.entries(db.languages).map(([k,v])=>`<option value="${k}">${v.name===v.native?v.name:v.name+' · '+v.native}</option>`).join('');

 if(db.languages[UI.language])L.value=UI.language;
 V.innerHTML=db.levels.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');

 V.value=db.lessons[0]?.level||V.value;V.value=db.levels.find(v=>db.lessons.some(l=>l.level===v.id))?.id||V.value; L.onchange=()=>{UI.set(L.value);refresh()};V.onchange=refresh;

 const choices=document.getElementById('mixedLanguageChoices');

 for(const [key,language] of Object.entries(db.languages)){if(key==='ko')continue;

   const label=document.createElement('label');label.className='voice-check';

   const input=document.createElement('input');input.type='checkbox';input.value=key;input.checked=true;

   input.onchange=updateMixedLanguageCount;

   label.append(input,document.createTextNode(language.name+' · '+(language.native||language.name)));choices.append(label);

 }

 document.getElementById('lesson').onchange=updateMixedLanguagePanel;

 document.getElementById('selectAllLanguages').onclick=()=>setAllLanguages(true);

 document.getElementById('clearLanguages').onclick=()=>setAllLanguages(false);

 refresh();

}

function selectedMixedLanguages(){return [...document.querySelectorAll('#mixedLanguageChoices input:checked')].map(el=>el.value)}

function updateMixedLanguageCount(){document.getElementById('mixedLanguageCount').textContent=selectedMixedLanguages().length+UI.t("개 언어 선택됨")}

function setAllLanguages(checked){document.querySelectorAll('#mixedLanguageChoices input').forEach(el=>el.checked=checked);updateMixedLanguageCount()}

function updateMixedLanguagePanel(){document.getElementById('mixedLanguagePanel').hidden=!document.getElementById('lesson').value.endsWith('-all');updateMixedLanguageCount()}

function refresh(){

 const level=document.querySelector('#level').value;

 const lessons=db.lessons.filter(x=>x.level===level).slice().sort((a,b)=>{

   const num=x=>{const m=String(x.unit||'').match(/\d+/);return m?parseInt(m[0],10):Number.MAX_SAFE_INTEGER};

   const d=num(a)-num(b);

   return d!==0 ? d : String(a.unit||'').localeCompare(String(b.unit||''),'ko',{numeric:true});

 });

 const regular=lessons.map(x=>`<option value="lesson:${x.id}">${x.unit} · ${x.title}</option>`).join('');

 const reviews=lessons.length

   ? `<option value="review:mid">★ 중간 복습 · 한국어 → 번역어 · 5초 자동 공개</option>

      <option value="review:final">★ 최종 복습 · 한국어 → 번역어 · 5초 자동 공개</option>

      <option value="review:mid-reverse">★ 중간 복습 · 번역어 → 한국어 · 클릭 공개</option>

      <option value="review:final-reverse">★ 최종 복습 · 번역어 → 한국어 · 클릭 공개</option>

      <option value="review:mid-all">★ 중간 복습 · 전체 외국어 랜덤 → 한국어 · 클릭 공개</option>

      <option value="review:final-all">★ 최종 복습 · 전체 외국어 랜덤 → 한국어 · 클릭 공개</option>` : '';

 document.querySelector('#lesson').innerHTML=(regular+reviews)||UI.t("<option value=\"\">등록된 단원 없음</option>");

 updateMixedLanguagePanel();

}

document.querySelector('#start').onclick=()=>{

 const language=document.querySelector('#language').value;

 const level=document.querySelector('#level').value;

 const selected=document.querySelector('#lesson').value;

 if(!selected)return alert(UI.t("이 단계에는 등록된 단원이 없습니다."));

 const [kind,value]=selected.split(':');

 if(kind==='review'){

   const selectedLanguages=selectedMixedLanguages();

   if(value.endsWith('-all')&&!selectedLanguages.length){alert(UI.t("혼합 복습에 포함할 언어를 한 개 이상 선택해 주세요."));return}

   const languageFilter=value.endsWith('-all')?'&languages='+encodeURIComponent(JSON.stringify(selectedLanguages)):'';

   location.href=`./practice.html?language=${encodeURIComponent(language)}&level=${encodeURIComponent(level)}&review=${encodeURIComponent(value.replace(/-(reverse|all)$/,''))}&direction=${(value.endsWith('-reverse')||value.endsWith('-all'))?'reverse':'forward'}&mixed=${value.endsWith('-all')?'1':'0'}${languageFilter}`;

 }else{

   location.href=`./practice.html?language=${encodeURIComponent(language)}&lesson=${encodeURIComponent(value)}`;

 }

};

init();

