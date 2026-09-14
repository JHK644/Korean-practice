async function loadPublicData(){
 if(location.protocol==='file:')throw new Error('인터넷 사이트 주소로 접속해 주세요. 로컬 확인 방법은 사용 안내를 참고하세요.');
 const response=await fetch('data/lessons.json',{cache:'no-store'});
 if(!response.ok)throw new Error('교재를 불러오지 못했습니다. 잠시 후 다시 접속해 주세요.');
 const db=await response.json();
 if(!db.languages||!Array.isArray(db.levels)||!Array.isArray(db.lessons))throw new Error('교재 자료를 확인해 주세요.');
 const unitNumber=l=>{const m=String(l.unit||'').match(/\d+/);return m?Number(m[0]):Number.MAX_SAFE_INTEGER};
 db.levels.forEach(l=>l.id=String(l.id));db.lessons.forEach(l=>l.level=String(l.level));
 db.lessons.sort((a,b)=>unitNumber(a)-unitNumber(b)||String(a.unit||'').localeCompare(String(b.unit||''),'ko',{numeric:true}));
 return db;
}
function showPublicError(error){
 const el=document.getElementById('loadStatus');el.hidden=false;el.textContent=error.message||'화면을 불러오지 못했습니다. 다시 접속해 주세요.';
}
