/* ai-search.js — Page-specific logic */
/* Shared utilities: ../js/glassui.js */

/* ── MOCK DATA ── */
const MOCK={
  "Best street food near Chatuchak":{
    answer:`Chatuchak Weekend Market เป็น street food ระดับ top ของกรุงเทพเลย ไป <strong>Section 26</strong> ได้เลย Pad Thai ทำบนเตาถ่าน อร่อยมาก — ควรไปก่อนเที่ยงนะ เพราะขายหมดเร็วมาก แถวทางเข้าเหนือ Section 4 จะมีแผง <strong>Mango Sticky Rice</strong> ใช้มะม่วงน้ำดอกไม้ตามฤดูกาล อย่าลืมชิม <strong>น้ำอ้อยคั้นสด</strong> กับ <strong>ไอศกรีมกะทิ</strong> เสิร์ฟในลูกมะพร้าวแท้ๆ แถวประตู 1 ด้วยนะ`,
    sources:["Chatuchak Guide","TAT Thailand","Local Foodies","Google Maps"],
    concepts:["Street Food","Market Sections","Opening Hours","Seasonal Menu","Cash Only"],
    cards:[{e:"🍜",t:"Pad Thai · Section 26",d:"ทำบนเตาถ่าน ขายหมดก่อน 13:00 ราคา 80 บาท",tag:"Food"},{e:"🥭",t:"Mango Sticky Rice",d:"มะม่วงน้ำดอกไม้ + กะทิ ตามฤดูกาล",tag:"Dessert"},{e:"🥥",t:"ไอศกรีมกะทิ",d:"เสิร์ฟในลูกมะพร้าว ประตู 1 ราคา 45 บาท",tag:"Drink"}]
  },
  "Events at Wat Phra Kaew this month":{
    answer:`วัดพระแก้วมีกิจกรรมน่าสนใจใน <strong>มีนาคม 2026</strong> ถึงสามอย่างเลย งาน <strong>พระราชพิธี</strong> วันเสาร์ที่ 15 (09:00–12:00) เป็นพิธีทางราชการ ต้องแต่งชุดสุภาพนะ ค่าเข้า 500 บาท ทุก <strong>วันอาทิตย์ 07:00</strong> มี Photography Walk ออกจากประตูตะวันออก รับได้ 20 คนเท่านั้น และ <strong>สาธิตการบูรณะจิตรกรรม</strong> วันที่ 22 มี.ค. ดูฟรีพร้อมบัตรเข้าชม`,
    sources:["Temple Official","Royal Household Bureau","Bangkok Tourism","Event DB"],
    concepts:["Royal Ceremony","Photography Walk","Mural Art","March 2026","Admission"],
    cards:[{e:"🏮",t:"พระราชพิธี",d:"15 มี.ค. · 09:00 · ชุดสุภาพ · 500 บาท",tag:"Official"},{e:"📸",t:"Photography Walk",d:"ทุกอาทิตย์ 07:00 · ประตูตะวันออก · 20 คน",tag:"Tour"},{e:"🎨",t:"สาธิตบูรณะจิตรกรรม",d:"22 มี.ค. · ฟรี · ช่างฝีมือดั้งเดิม",tag:"Culture"}]
  },
  "Night markets in Bangkok":{
    answer:`ตลาดกลางคืนกรุงเทพแต่ละที่มีบุคลิกต่างกันเลย <strong>Asiatique The Riverfront</strong> เปิดทุกวัน 17:00–24:00 มีร้านกว่า 1,500 ร้าน ดินเนอร์ริมแม่น้ำ และมวยไทยรอบ 20:00 กับ 21:30 ส่วน <strong>ตลาดนัดจตุจักรกลางคืน</strong> (ศุกร์–อาทิตย์ 18:00–01:00) มีร้านค้า 400+ ในซอยไฟนีออน คนรุ่นใหม่น่าจะชอบ <strong>Jodd Fairs Dan Neramit</strong> มากกว่า — neon retro, food truck fusion เกาหลี-ไทย และดนตรี indie สดถึงเที่ยงคืน`,
    sources:["Asiatique Official","Chatuchak Guide","TimeOut Bangkok","Lonely Planet"],
    concepts:["Asiatique","Chatuchak","Jodd Fairs","Shopping","Nightlife"],
    cards:[{e:"🎭",t:"Asiatique Riverfront",d:"ทุกวัน 17:00–24:00 · มวยไทยรอบ 20:00",tag:"Night Market"},{e:"👗",t:"จตุจักร Night",d:"ศุกร์–อาทิตย์ 18:00 · 400+ ร้าน · Vintage",tag:"Weekend"},{e:"🌃",t:"Jodd Fairs",d:"Neon + indie music + food trucks · ถึงเที่ยงคืน",tag:"Trendy"}]
  },
  "Activities at Lumpini Park":{
    answer:`สวนลุมพินีอัดแน่นกิจกรรมใน <strong>57 เฮกตาร์</strong> กลางกรุงเทพ ช่วงเช้าตรู่ (05:00–07:00) จะเจอกลุ่มซ้อมมวยไทย ไทเก๊ก และแอโรบิคฟรี <strong>Bangkok Symphony Orchestra</strong> แสดงกลางแจ้งทุกวันศุกร์ 18:30 งานถัดไปคือ <strong>14 มีนาคม</strong> เข้าฟรีเลย เรือถีบในทะเลสาบกลาง <strong>40 บาท / 30 นาที</strong> และมีตะกวดขนาด 2 เมตรเดินเพ่นพ่านอยู่ด้วย ถือเป็นสัตว์มงคลตามความเชื่อท้องถิ่น`,
    sources:["Bangkok Parks Dept","BSO Schedule","TripAdvisor","Wildlife BKK"],
    concepts:["Morning Exercise","Symphony","Paddle Boats","Monitor Lizards","Free Entry"],
    cards:[{e:"🎵",t:"Bangkok Symphony",d:"14 มี.ค. · 18:30 · ฟรี · กลางแจ้ง",tag:"Music"},{e:"🚣",t:"เรือถีบ",d:"40 บาท/30 นาที · ทุกวัน 06:00–18:00",tag:"Activity"},{e:"🦎",t:"ตะกวด",d:"ยาวถึง 2ม. · อย่าให้อาหาร",tag:"Wildlife"}]
  }
};
function getMock(q){
  const lq=q.toLowerCase();
  const key=Object.keys(MOCK).find(k=>k.toLowerCase().split(' ').some(w=>w.length>3&&lq.includes(w)));
  if(key)return{...MOCK[key],_key:key};
  return{answer:`โอเค เกี่ยวกับ <strong>"${q}"</strong> — จาก Glass UI มี 6 สถานที่และ 18 อีเวนต์เดือนนี้ ลองเปิด Map View ดูนะ หรือลองถามจาก suggestion chips ด้านล่างเพื่อดูข้อมูลแบบละเอียดกว่านี้`,sources:["Glass UI Map","Event Database","Bangkok Guide","TAT"],concepts:["Bangkok","Culture","Events","Venues","Tourism"],cards:[{e:"🗺️",t:"Explore the Map",d:"6 สถานที่ · 18 อีเวนต์",tag:"Map"},{e:"📅",t:"ปฏิทินอีเวนต์",d:"มีนาคม 2026 · ครบทุกรูปแบบ",tag:"Events"},{e:"🏙️",t:"City Guide",d:"ย่านสำคัญกรุงเทพ",tag:"Guide"}],_key:null};
}

/* PAGE TRANSITION */
const veil=document.getElementById('pageVeil');
function navigateTo(u){veil.classList.add('in');setTimeout(()=>location.href=u,430);}
window.navigateTo=navigateTo;
veil.classList.add('in');
requestAnimationFrame(()=>requestAnimationFrame(()=>veil.classList.remove('in')));

/* THEME */
const root=document.documentElement;
let dark=root.getAttribute('data-theme')!=='light';
document.getElementById('themeBtn').addEventListener('click',()=>{dark=!dark;root.setAttribute('data-theme',dark?'dark':'light');});

/* BG GRID */
const bgC=document.getElementById('bgCanvas'),bgX=bgC.getContext('2d');
const DPR=Math.min(window.devicePixelRatio||1,2),T0=Date.now(),GS=64;
let bW,bH,CELLS,bgM=1;
function bgR(){bW=window.innerWidth;bH=window.innerHeight;bgC.width=bW*DPR;bgC.height=bH*DPR;bgX.setTransform(DPR,0,0,DPR,0,0);const gc=Math.ceil(bW/GS)+1,gr=Math.ceil(bH/GS)+1;CELLS=[];for(let r=0;r<gr;r++)for(let c=0;c<gc;c++)CELLS.push({row:r,col:c,delay:Math.random()*3000,boost:0});}
bgR();window.addEventListener('resize',bgR);
(function bgLoop(){bgX.clearRect(0,0,bW,bH);const a=(dark?0.045:0.06)*bgM;bgX.save();bgX.strokeStyle=dark?`rgba(200,196,188,${a})`:`rgba(30,28,22,${a})`;bgX.lineWidth=0.4;for(let x=0;x<=bW;x+=GS){bgX.beginPath();bgX.moveTo(x,0);bgX.lineTo(x,bH);bgX.stroke();}for(let y=0;y<=bH;y+=GS){bgX.beginPath();bgX.moveTo(0,y);bgX.lineTo(bW,y);bgX.stroke();}bgX.restore();const now=Date.now()-T0;bgX.save();CELLS.forEach(cell=>{const age=now-cell.delay;if(age<0)return;const c=(age%4200)/4200;let f=c<0.05?c/0.05:c<0.18?1-(c-0.05)/0.13:0;if(cell.boost>0){f=Math.max(f,cell.boost);cell.boost*=0.96;}f*=bgM;if(f<0.01)return;const x=cell.col*GS,y=cell.row*GS;bgX.fillStyle=dark?`rgba(210,205,195,${f*0.025})`:`rgba(30,28,24,${f*0.02})`;bgX.fillRect(x,y,GS,GS);const da=f*0.12;bgX.fillStyle=dark?`rgba(210,205,195,${da})`:`rgba(30,28,24,${da})`;[[x,y],[x+GS,y],[x,y+GS],[x+GS,y+GS]].forEach(([cx,cy])=>{bgX.beginPath();bgX.arc(cx,cy,1.1,0,Math.PI*2);bgX.fill();});});bgX.restore();requestAnimationFrame(bgLoop);})();
function ripple(ox,oy){bgM=3;setTimeout(()=>bgM=2.2,300);setTimeout(()=>bgM=1.6,750);setTimeout(()=>bgM=1,1600);CELLS.forEach(cell=>{const d=Math.hypot(cell.col*GS-ox,cell.row*GS-oy);setTimeout(()=>{cell.boost=Math.max(0,1-d/580)*1.1;},d*0.55);});}

/* NODE GRAPH */
const gC=document.getElementById('gCanvas'),gX=gC.getContext('2d');
let GN=[],GE=[],gRAF=null,gDrag=null,gDx=0,gDy=0;
const NC={query:'#8a7e6e',concept:'#6a7a68',source:'rgba(138,126,110,.6)',answer:'#c0b890'};
const NR={query:24,concept:17,source:12,answer:20};
function gResize(){gC.width=gC.offsetWidth*DPR;gC.height=gC.offsetHeight*DPR;gX.setTransform(DPR,0,0,DPR,0,0);}
function mkN(id,lb,type,x,y){return{id,lb,type,x,y,r:NR[type]||14,color:NC[type]||'#8a7e6e',alpha:0,ta:1};}
function initGraph(){GN=[];GE=[];const W=gC.offsetWidth,H=gC.offsetHeight;GN.push(mkN('idle','Ask anything…','query',W/2,H/2));startGDraw();}
function buildGraph(q,concepts,sources){if(gRAF){cancelAnimationFrame(gRAF);gRAF=null;}GN=[];GE=[];const W=gC.offsetWidth,H=gC.offsetHeight,cx=W/2,cy=H*0.38;GN.push(mkN('q',q.length>22?q.slice(0,20)+'…':q,'query',cx,cy));concepts.forEach((c,i)=>{const ang=(i/concepts.length)*Math.PI*2-Math.PI/2,r=92+Math.random()*14;GN.push(mkN('c'+i,c,'concept',cx+Math.cos(ang)*r,cy+Math.sin(ang)*r));GE.push({a:'q',b:'c'+i,alpha:0,ta:.36,delay:i*105+160});});sources.forEach((s,i)=>{const ang=(i/sources.length)*Math.PI*2+0.3,r=160+Math.random()*18;GN.push(mkN('s'+i,s.length>11?s.slice(0,10)+'…':s,'source',cx+Math.cos(ang)*r,cy+Math.sin(ang)*r));GE.push({a:'c'+(i%concepts.length),b:'s'+i,alpha:0,ta:.2,delay:i*85+420});});setTimeout(()=>{GN.push(mkN('ans','Answer','answer',cx,cy+138));GE.push({a:'q',b:'ans',alpha:0,ta:.62,delay:0});},1250);startGDraw();}
function startGDraw(){if(gRAF)cancelAnimationFrame(gRAF);function loop(){if(!gC.offsetWidth){gRAF=requestAnimationFrame(loop);return;}gResize();const W=gC.offsetWidth,H=gC.offsetHeight;gX.clearRect(0,0,W,H);GE.forEach(e=>{e.alpha+=(e.ta-e.alpha)*0.055;const fn=GN.find(n=>n.id===e.a),tn=GN.find(n=>n.id===e.b);if(!fn||!tn||e.alpha<0.01)return;gX.save();gX.strokeStyle=dark?`rgba(138,126,110,${e.alpha})`:`rgba(90,82,74,${e.alpha})`;gX.lineWidth=1;gX.setLineDash([3,5]);gX.beginPath();gX.moveTo(fn.x,fn.y);gX.lineTo(tn.x,tn.y);gX.stroke();gX.restore();});GN.forEach(n=>{n.alpha+=(n.ta-n.alpha)*0.065;if(n.alpha<0.01)return;gX.save();gX.globalAlpha=n.alpha;const g=gX.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r*2.6);g.addColorStop(0,dark?`rgba(138,126,110,${n.alpha*.2})`:`rgba(138,126,110,${n.alpha*.14})`);g.addColorStop(1,'rgba(0,0,0,0)');gX.fillStyle=g;gX.beginPath();gX.arc(n.x,n.y,n.r*2.6,0,Math.PI*2);gX.fill();gX.fillStyle=dark?'rgba(18,16,14,.92)':'rgba(238,236,232,.92)';gX.beginPath();gX.arc(n.x,n.y,n.r,0,Math.PI*2);gX.fill();gX.strokeStyle=n.color;gX.lineWidth=1.8;gX.setLineDash([]);gX.stroke();gX.fillStyle=dark?`rgba(226,221,214,${n.alpha})`:`rgba(26,24,22,${n.alpha})`;const fs=n.type==='query'?11:9;gX.font=`${n.type==='query'?700:600} ${fs}px Inter,sans-serif`;gX.textAlign='center';if(n.type==='query'||n.type==='answer'){gX.textBaseline='middle';gX.fillText(n.lb,n.x,n.y);}else{gX.textBaseline='top';gX.fillText(n.lb,n.x,n.y+n.r+5);}gX.restore();});gRAF=requestAnimationFrame(loop);}gRAF=requestAnimationFrame(loop);}
gC.addEventListener('mousedown',e=>{const r=gC.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;gDrag=GN.find(n=>Math.hypot(n.x-mx,n.y-my)<n.r+10)||null;if(gDrag){gDx=mx-gDrag.x;gDy=my-gDrag.y;}});
gC.addEventListener('mousemove',e=>{if(!gDrag)return;const r=gC.getBoundingClientRect();gDrag.x=e.clientX-r.left-gDx;gDrag.y=e.clientY-r.top-gDy;});
gC.addEventListener('mouseup',()=>gDrag=null);

/* ═══ CHAT LOGIC ═══ */
const iinput=document.getElementById('iinput'),ibtn=document.getElementById('ibtn');
const feed=document.getElementById('feed'),feedInner=document.getElementById('feedInner');
const tlWrap=document.getElementById('tlWrap'),tlEmpty=document.getElementById('tlEmpty');
const emptyState=document.getElementById('emptyState');
let hist=[],busy=false,entryCount=0,firstMsg=true;
const delay=ms=>new Promise(r=>setTimeout(r,ms));

iinput.addEventListener('input',()=>{
  iinput.style.height='auto';
  iinput.style.height=Math.min(iinput.scrollHeight,120)+'px';
  ibtn.classList.toggle('vis',iinput.value.trim().length>0);
});
iinput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSearch();}});
ibtn.addEventListener('click',doSearch);
document.querySelectorAll('.echip').forEach(c=>c.addEventListener('click',()=>{
  iinput.value=c.dataset.q;iinput.style.height='auto';iinput.style.height=Math.min(iinput.scrollHeight,120)+'px';ibtn.classList.add('vis');doSearch();
}));

function getTimeStr(){return new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});}

async function doSearch(){
  if(busy)return;
  const q=iinput.value.trim();if(!q)return;
  busy=true;
  iinput.value='';iinput.style.height='auto';ibtn.classList.remove('vis');

  if(firstMsg){
    emptyState.style.transition='opacity 280ms,transform 280ms';
    emptyState.style.opacity='0';emptyState.style.transform='translateY(-8px)';
    setTimeout(()=>emptyState.remove(),280);
    firstMsg=false;
    const sep=document.createElement('div');
    sep.className='date-sep';
    sep.textContent=new Date().toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
    feedInner.appendChild(sep);
  }

  const ib=document.getElementById('ibox').getBoundingClientRect();
  ripple(ib.left+ib.width/2,ib.top+ib.height/2);
  const resp=getMock(q);
  buildGraph(q,resp.concepts,resp.sources);
  const id=++entryCount;

  /* USER BUBBLE */
  const uGroup=document.createElement('div');
  uGroup.className='msg-group';uGroup.id='entry-'+id;
  uGroup.innerHTML=`<div class="msg-user"><div class="msg-user-bubble">${q}</div><div class="msg-user-time">${getTimeStr()}</div></div>`;
  feedInner.appendChild(uGroup);scrollFeed();

  /* THINKING BUBBLE */
  const thinkGroup=document.createElement('div');
  thinkGroup.className='msg-group';
  thinkGroup.innerHTML=`<div class="msg-thinking"><div class="msg-ai-av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg></div><div class="think-bubble"><div style="display:flex;align-items:center;gap:10px;"><div class="orbs"><div class="orb"></div><div class="orb"></div><div class="orb"></div></div><div class="thinktext" id="tt${id}">กำลังอ่านคำถาม…</div></div><div class="tsteps"><div class="tstep" id="ts${id}0">Query</div><div class="tstep" id="ts${id}1">Context</div><div class="tstep" id="ts${id}2">Reason</div><div class="tstep" id="ts${id}3">Compose</div></div></div></div>`;
  feedInner.appendChild(thinkGroup);scrollFeed();

  const phrases=['กำลังอ่านคำถาม…','โหลด context…','กำลังคิดอยู่…','เรียบเรียงคำตอบ…'];
  for(let i=0;i<4;i++){
    await delay(230+i*190);
    const ts=document.getElementById(`ts${id}${i}`);if(ts)ts.classList.add('act');
    const tt=document.getElementById(`tt${id}`);if(tt)tt.textContent=phrases[i];
    if(i>0){const prev=document.getElementById(`ts${id}${i-1}`);if(prev){prev.classList.remove('act');prev.classList.add('done');}}
  }
  await delay(220);
  thinkGroup.remove();

  /* AI ANSWER */
  const aiGroup=document.createElement('div');
  aiGroup.className='msg-group';
  const txtId=`at${id}`;
  aiGroup.innerHTML=`<div class="msg-ai"><div class="msg-ai-av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg></div><div class="msg-ai-body"><div class="msg-ai-bubble"><div class="msg-ai-name">Glass AI</div><div class="msg-ai-txt" id="${txtId}"></div></div></div></div>`;
  feedInner.appendChild(aiGroup);scrollFeed();

  await stream(resp.answer,document.getElementById(txtId));

  const body=aiGroup.querySelector('.msg-ai-body');
  const srcWrap=document.createElement('div');srcWrap.className='msg-srcs';
  resp.sources.forEach(s=>{const el=document.createElement('span');el.className='src';el.textContent=s;srcWrap.appendChild(el);});
  body.appendChild(srcWrap);

  const tsEl=document.createElement('div');tsEl.className='msg-ai-time';tsEl.textContent=getTimeStr();
  body.appendChild(tsEl);

  await delay(80);
  const cardsWrap=document.createElement('div');cardsWrap.className='msg-cards';
  const grid=document.createElement('div');grid.className='rcards';
  resp.cards.forEach((c,i)=>{
    const el=document.createElement('div');el.className='rcard';el.style.animationDelay=`${i*70}ms`;
    el.innerHTML=`<div class="rcem">${c.e}</div><div class="rctt">${c.t}</div><div class="rcds">${c.d}</div><span class="rctag">${c.tag}</span>`;
    el.addEventListener('mousemove',ev=>{const rc=el.getBoundingClientRect();const rx=((ev.clientY-rc.top)/rc.height-.5)*12,ry=-((ev.clientX-rc.left)/rc.width-.5)*12;el.style.transform=`perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(7px)`;});
    el.addEventListener('mouseleave',()=>{el.style.transform='';});
    grid.appendChild(el);
  });
  cardsWrap.appendChild(grid);body.appendChild(cardsWrap);scrollFeed();
  addTimeline(q,resp.answer,id);
  busy=false;
}

async function stream(html,target){
  const plain=html.replace(/<[^>]+>/g,'');
  const cur=document.createElement('span');cur.className='cur';target.appendChild(cur);
  let i=0;while(i<plain.length){cur.insertAdjacentText('beforebegin',plain.slice(i,i+4));i+=4;await delay(11);}
  target.innerHTML=html;
}
function scrollFeed(){setTimeout(()=>feed.scrollTo({top:feed.scrollHeight,behavior:'smooth'}),60);}

function addTimeline(q,html,entryId){
  if(tlEmpty)tlEmpty.style.display='none';
  hist.unshift({q,preview:html.replace(/<[^>]+>/g,'').slice(0,80)+'…',t:new Date(),entryId});
  tlWrap.querySelectorAll('.tlit').forEach(el=>el.remove());
  hist.forEach((item,i)=>{
    const isLast=i===hist.length-1;
    const div=document.createElement('div');
    div.className='tlit'+(i===0?' active':'');
    div.innerHTML=`<div class="tlln"><div class="tldt ${i>0?'m':''}"></div>${!isLast?'<div class="tlcn"></div>':''}</div><div class="tlbd"><div class="tlq">${item.q}</div><div class="tlmt">${item.t.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</div><div class="tlpv">${item.preview}</div></div>`;
    div.addEventListener('click',()=>{tlWrap.querySelectorAll('.tlit').forEach(el=>el.classList.remove('active'));div.classList.add('active');const target=document.getElementById('entry-'+item.entryId);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});rswitch('timeline');});
    tlWrap.appendChild(div);
  });
}
window.rswitch=function(tab){document.getElementById('tg').classList.toggle('on',tab==='graph');document.getElementById('tt').classList.toggle('on',tab==='timeline');document.getElementById('pg').classList.toggle('on',tab==='graph');document.getElementById('pt').classList.toggle('on',tab==='timeline');};
window.addEventListener('load',()=>{gResize();initGraph();startGDraw();});
window.addEventListener('resize',()=>{gResize();bgR();});