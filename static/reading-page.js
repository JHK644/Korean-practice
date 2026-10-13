

let db;const $=id=>document.getElementById(id);

async function init(){db=await (await fetch('./data/lessons.json?v=1.4.18')).json();UI.prepareData(db);db.levels=db.levels.filter(v=>!['0','5'].includes(String(v.id)));$('language').replaceChildren(...Object.entries(db.languages).map(([k,v])=>new Option(v.name===v.native?v.name:v.name+' · '+v.native,k)));if(db.languages[UI.language])$('language').value=UI.language;$('level').replaceChildren(...db.levels.map(v=>new Option(v.name,v.id)));$('level').value=db.readings[0]?.level||$('level').value;$('level').value=db.levels.find(v=>(db.readings||[]).some(r=>r.level===v.id))?.id||$('level').value;$('level').onchange=refresh;refresh();$('start').disabled=false}

function num(v){const m=String(v||'').match(/\d+/);return m?Number(m[0]):999999}

function refresh(){const rows=(db.readings||[]).filter(x=>String(x.level)===String($('level').value)).sort((a,b)=>num(a.unit)-num(b.unit)||String(a.kind).localeCompare(String(b.kind)));$('reading').replaceChildren(...rows.map(x=>new Option(`${UI.t(x.unit)} ${x.kind==='culture'?UI.t("문화"):UI.t("읽기")} · ${x.title}`,x.id)));if(!rows.length)$('reading').add(new Option(UI.t("등록된 읽기 자료 없음"),''))}

$('start').onclick=()=>{if(!$('reading').value)return alert(UI.t("이 단계에는 등록된 읽기 자료가 없습니다."));location.href=`./reading-view.html?language=${encodeURIComponent($('language').value)}&reading=${encodeURIComponent($('reading').value)}`};

init().catch(e=>{$('loadStatus').innerHTML=`<div class="notice error">${e.message||UI.t("자료를 불러오지 못했습니다.")}</div>`});

