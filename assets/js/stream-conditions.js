/* ═══ CAMERAS ═══ */
const MEDIAMTX_HOST = '172.16.1.31';
const CAMERAS = [
  { id:'camA_hls', name:'CAM-A', location:'Entrance', hls:`http://${MEDIAMTX_HOST}:18888/camA_hls/index.m3u8` },
  { id:'camB_hls', name:'CAM-B', location:'Parking',  hls:`http://${MEDIAMTX_HOST}:18888/camB_hls/index.m3u8` },
  { id:'camC_hls', name:'CAM-C', location:'Corridor', hls:`http://${MEDIAMTX_HOST}:18888/camC_hls/index.m3u8` },
];
let activeCam = -1;
let hlsInst = null;

/* render camera cards */
function renderCamCards() {
  const c = document.getElementById('camCards');
  c.innerHTML = CAMERAS.map((cam, i) => `
    <div class="cam-card ${i===activeCam?'active':''}" id="camcard-${i}" onclick="selectCam(${i})">
      <div class="cam-card-thumb">
        <canvas id="thumb-${i}" width="128" height="72"></canvas>
        <div class="cam-card-live"></div>
      </div>
      <div class="cam-card-body">
        <div class="cam-card-name">${cam.name} — ${cam.location}</div>
        <div class="cam-card-url">${cam.hls}</div>
      </div>
      <div class="cam-card-badge">${i===activeCam?'LIVE':'READY'}</div>
    </div>`).join('');
  animateThumbs();
}

/* thumbnail simulation */
let thumbTimer = null;
function animateThumbs() {
  if (thumbTimer) clearInterval(thumbTimer);
  thumbTimer = setInterval(() => {
    CAMERAS.forEach((_, i) => {
      const c = document.getElementById(`thumb-${i}`);
      if (!c) return;
      const ctx = c.getContext('2d');
      const W = c.width, H = c.height;
      ctx.fillStyle = i===activeCam ? '#0a1a0a' : '#050504';
      ctx.fillRect(0, 0, W, H);
      // scan line
      const y = (Date.now() / 8 + i * 33) % H;
      ctx.fillStyle = 'rgba(212,196,160,.06)';
      ctx.fillRect(0, y, W, 1);
      // noise dots
      for (let n = 0; n < 30; n++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random()*.04})`;
        ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1);
      }
      // "REC" indicator
      ctx.fillStyle = i===activeCam ? '#4ade80' : 'rgba(248,113,113,.7)';
      ctx.beginPath();
      ctx.arc(W-7, 7, 3, 0, Math.PI*2);
      ctx.fill();
    });
  }, 100);
}

/* select camera */
function selectCam(i) {
  activeCam = i;
  renderCamCards();
  const cam = CAMERAS[i];
  document.getElementById('camNameHud').textContent = `${cam.name} — ${cam.location}`;
  document.getElementById('hudClock').style.display = 'flex';
  connectHLS(cam.hls);
}

/* HLS player */
function connectHLS(url) {
  const video = document.getElementById('videoEl');
  const ph = document.getElementById('vidPlaceholder');
  const stEl = document.getElementById('hlsState');
  const liveEl = document.getElementById('liveIndicator');

  if (hlsInst) { hlsInst.destroy(); hlsInst = null; }
  video.src = '';
  ph.style.display = 'none';
  stEl.textContent = 'Connecting…';
  stEl.style.color = 'var(--amber)';
  liveEl.style.background = 'var(--amber)';
  liveEl.style.animation = 'none';

  function onConnected() {
    stEl.textContent = '● HLS live';
    stEl.style.color = 'var(--green)';
    liveEl.style.background = 'var(--green)';
    liveEl.style.animation = 'pulse 2s infinite';
  }
  function onError(msg) {
    stEl.textContent = msg;
    stEl.style.color = 'var(--red)';
    liveEl.style.background = 'var(--red)';
    liveEl.style.animation = 'none';
    ph.style.display = 'flex';
    ph.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23,7 16,12 23,17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      <div class="vid-placeholder-title" style="color:var(--red)">Connection failed</div>
      <div class="vid-placeholder-sub">${msg}</div>`;
  }

  if (Hls.isSupported()) {
    hlsInst = new Hls({ enableWorker:true, lowLatencyMode:true, backBufferLength:0 });
    hlsInst.loadSource(url);
    hlsInst.attachMedia(video);
    hlsInst.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(()=>{}); onConnected(); });
    hlsInst.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) onError(d.details); });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => { video.play().catch(()=>{}); onConnected(); }, {once:true});
    video.addEventListener('error', () => onError('Native HLS error'), {once:true});
  } else {
    onError('HLS not supported');
  }
}

setInterval(() => {
  const el = document.getElementById('hudClock');
  if (el && el.style.display !== 'none') el.textContent = new Date().toLocaleTimeString();
}, 1000);

/* ═══ DATA MODEL (stream-conditions เดิม) ═══ */
let ruleId = 0;
const rules = [];
const TYPE_META = {
  match:     {label:'Match',     cls:'rule-match',     tag:'tag-match'    },
  block:     {label:'Block',     cls:'rule-block',     tag:'tag-block'    },
  flag:      {label:'Flag',      cls:'rule-flag',      tag:'tag-flag'     },
  transform: {label:'Transform', cls:'rule-transform', tag:'tag-transform'},
  route:     {label:'Route',     cls:'rule-route',     tag:'tag-route'    },
};
const FIELDS = ['token_text','chunk_text','sentiment_score','topic_score','confidence','category','lang','token_count','latency_ms','model_id','session_id','role'];
const NUMBER_FIELDS = ['sentiment_score','topic_score','confidence','token_count','latency_ms'];
const OPS_TEXT = ['contains','not_contains','equals','not_equals','regex','starts_with','ends_with'];
const OPS_NUM  = ['gt','gte','lt','lte','equals','not_equals'];
const getOps = f => NUMBER_FIELDS.includes(f) ? OPS_NUM : OPS_TEXT;
//const TEMPLATES = {
//  match:     {name:'Sentiment Detector',  conditions:[{field:'token_text',op:'contains',value:'bad'},{field:'sentiment_score',op:'lt',value:'0.3'}],logic:'OR', action:{type:'match',label:'negative_sentiment',threshold:0.6},model_params:{temperature:0.2,top_p:0.9,max_tokens:512}},
//  block:     {name:'PII Blocker',         conditions:[{field:'token_text',op:'regex',value:'\\b\\d{3}-\\d{2}-\\d{4}\\b'},{field:'category',op:'equals',value:'personal_data'}],logic:'OR',action:{type:'block',replacement:'[REDACTED]',notify:true},model_params:{temperature:0,top_p:1,max_tokens:256}},
//  flag:      {name:'Topic Tagger',        conditions:[{field:'topic_score',op:'gt',value:'0.7'}],logic:'AND',action:{type:'flag',tag:'off_topic',severity:'medium'},model_params:{temperature:0.1,top_p:0.95,max_tokens:512}},
//  transform: {name:'Language Normaliser', conditions:[{field:'lang',op:'not_equals',value:'en'}],logic:'AND',action:{type:'transform',prompt:'Translate to English.',inject_before:''},model_params:{temperature:0.3,top_p:0.9,max_tokens:1024}},
//  route:     {name:'Code Router',         conditions:[{field:'category',op:'equals',value:'code'},{field:'confidence',op:'gt',value:'0.8'}],logic:'AND',action:{type:'route',target_agent:'code-assistant',priority:'high'},model_params:{temperature:0.1,top_p:0.95,max_tokens:2048}},
//};







function renderRules() {
  const c = document.getElementById('rulesContainer');
  c.innerHTML = '';
  rules.forEach(r => c.appendChild(buildCard(r)));
  document.getElementById('ruleCountBadge').textContent = rules.length;
  renderJSON(); renderStats();
}
function buildCard(rule) {
  const meta = TYPE_META[rule.type];
  const card = document.createElement('div');
  card.className = `rule-card ${rule.enabled?meta.cls:''}`;
  card.id = `card-${rule.id}`;
  card.innerHTML = `
    <div class="rc-head" onclick="toggleCard(${rule.id})">
      <div class="rc-dot tc-${rule.type}"></div>
      <div class="rc-name">${rule.name}</div>
      <span class="rc-type-badge ${meta.tag}">${meta.label}</span>
      <button class="rc-toggle ${rule.enabled?'on':''}" id="tog-${rule.id}" onclick="event.stopPropagation();toggleEnable(${rule.id})"></button>
      <div class="rc-chevron ${rule._open?'open':''}" id="chev-${rule.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg></div>
      <button class="rc-del" onclick="event.stopPropagation();deleteRule(${rule.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4h8v2"/></svg></button>
    </div>
    <div class="rc-body ${rule._open?'open':''}" id="body-${rule.id}">${buildBody(rule)}</div>`;
  return card;
}
function buildBody(rule) {
  const a=rule.action,p=rule.model_params;
  const condRows=rule.conditions.map((c,ci)=>buildCondRow(rule.id,ci,c,rule.conditions.length)).join('');
  let aHtml='';
  if(rule.type==='match')  aHtml=`<div class="action-block"><div class="action-row"><span class="action-key">Label</span><input class="inp" value="${a.label||''}" oninput="setAction(${rule.id},'label',this.value)"></div><div class="action-row"><span class="action-key">Threshold</span><div class="slider-row" style="flex:1"><input type="range" class="slider" min="0" max="1" step="0.05" value="${a.threshold||0.5}" oninput="setAction(${rule.id},'threshold',parseFloat(this.value));this.nextElementSibling.textContent=parseFloat(this.value).toFixed(2)"><span class="slider-val">${(a.threshold||0.5).toFixed(2)}</span></div></div></div>`;
  else if(rule.type==='block') aHtml=`<div class="action-block"><div class="action-row"><span class="action-key">Replace</span><input class="inp" value="${a.replacement||''}" oninput="setAction(${rule.id},'replacement',this.value)"></div><div class="action-row"><span class="action-key">Notify</span><select class="sel w-sm" onchange="setAction(${rule.id},'notify',this.value==='true')"><option value="true" ${a.notify?'selected':''}>Yes</option><option value="false" ${!a.notify?'selected':''}>No</option></select></div></div>`;
  else if(rule.type==='flag')  aHtml=`<div class="action-block"><div class="action-row"><span class="action-key">Tag</span><input class="inp" value="${a.tag||''}" oninput="setAction(${rule.id},'tag',this.value)"></div><div class="action-row"><span class="action-key">Severity</span><select class="sel w-md" onchange="setAction(${rule.id},'severity',this.value)">${['low','medium','high','critical'].map(s=>`<option value="${s}" ${s===a.severity?'selected':''}>${s}</option>`).join('')}</select></div></div>`;
  else if(rule.type==='transform') aHtml=`<div class="action-block"><div class="action-row" style="align-items:flex-start"><span class="action-key" style="padding-top:3px">Prompt</span><textarea class="ta" oninput="setAction(${rule.id},'prompt',this.value)">${a.prompt||''}</textarea></div><div class="action-row"><span class="action-key">Inject</span><input class="inp" value="${a.inject_before||''}" oninput="setAction(${rule.id},'inject_before',this.value)"></div></div>`;
  else if(rule.type==='route')  aHtml=`<div class="action-block"><div class="action-row"><span class="action-key">Target</span><input class="inp" value="${a.target_agent||''}" oninput="setAction(${rule.id},'target_agent',this.value)"></div><div class="action-row"><span class="action-key">Priority</span><select class="sel w-md" onchange="setAction(${rule.id},'priority',this.value)">${['low','normal','high','critical'].map(pr=>`<option value="${pr}" ${pr===a.priority?'selected':''}>${pr}</option>`).join('')}</select></div></div>`;
  return `
    <div class="cond-block">
      <div class="cond-label">Conditions <select class="sel w-sm" style="font-size:9px;padding:2px 18px 2px 6px" onchange="setLogic(${rule.id},this.value)"><option value="AND" ${rule.logic==='AND'?'selected':''}>ALL (AND)</option><option value="OR" ${rule.logic==='OR'?'selected':''}>ANY (OR)</option></select></div>
      <div id="conds-${rule.id}">${condRows}</div>
      <button class="add-cond" onclick="addCond(${rule.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add condition</button>
    </div>
    <div class="cond-block"><div class="cond-label">Action</div>${aHtml}</div>
    <div class="cond-block" style="margin-bottom:0">
      <div class="cond-label">Model Parameters</div>
      <div class="param-grid">
        <div class="param-item"><div class="param-name">Temperature</div><div class="slider-row"><input type="range" class="slider" min="0" max="2" step="0.05" value="${p.temperature}" oninput="setParam(${rule.id},'temperature',parseFloat(this.value));this.nextElementSibling.textContent=this.value"><span class="slider-val">${p.temperature}</span></div></div>
        <div class="param-item"><div class="param-name">Top-P</div><div class="slider-row"><input type="range" class="slider" min="0.01" max="1" step="0.01" value="${p.top_p}" oninput="setParam(${rule.id},'top_p',parseFloat(this.value));this.nextElementSibling.textContent=this.value"><span class="slider-val">${p.top_p}</span></div></div>
        <div class="param-item" style="grid-column:span 2"><div class="param-name">Max Tokens</div><div class="slider-row"><input type="range" class="slider" min="64" max="4096" step="64" value="${p.max_tokens}" oninput="setParam(${rule.id},'max_tokens',parseInt(this.value));this.nextElementSibling.textContent=this.value"><span class="slider-val">${p.max_tokens}</span></div></div>
      </div>
    </div>`;
}
function buildCondRow(rid,ci,cond,total){
  const ops=getOps(cond.field);
  return `<div class="cond-row" id="cr-${rid}-${ci}">
    <span class="cond-logic">${ci===0?'IF':'AND'}</span>
    <select class="sel w-md" onchange="updateCond(${rid},${ci},'field',this.value);rerenderOps(${rid},${ci})">${FIELDS.map(f=>`<option value="${f}" ${f===cond.field?'selected':''}>${f}</option>`).join('')}</select>
    <select class="sel w-sm" id="opsel-${rid}-${ci}">${ops.map(op=>`<option value="${op}" ${op===cond.op?'selected':''}>${op}</option>`).join('')}</select>
    <input class="inp" placeholder="value…" value="${cond.value||''}" oninput="updateCond(${rid},${ci},'value',this.value)">
    ${total>1?`<button style="width:19px;height:19px;display:flex;align-items:center;justify-content:center;border-radius:4px;background:none;border:none;color:var(--t2);cursor:pointer;flex-shrink:0" onmouseenter="this.style.background='var(--red-b)';this.style.color='var(--red)'" onmouseleave="this.style.background='none';this.style.color='var(--t2)'" onclick="removeCond(${rid},${ci})"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`:''}
  </div>`;
}
// function addRule(type){hideAddMenu();const tpl=JSON.parse(JSON.stringify(TEMPLATES[type]));rules.push({id:++ruleId,type,name:tpl.name,enabled:true,_open:true,conditions:tpl.conditions,logic:tpl.logic,action:tpl.action,model_params:tpl.model_params,stats:{hits:0,total:0}});renderRules();setTimeout(()=>document.getElementById(`card-${ruleId}`)?.scrollIntoView({behavior:'smooth',block:'nearest'}),60);}
function deleteRule(id){rules.splice(rules.findIndex(r=>r.id===id),1);renderRules();}
function toggleEnable(id){const r=rules.find(r=>r.id===id);r.enabled=!r.enabled;document.getElementById(`card-${r.id}`).className=`rule-card ${r.enabled?TYPE_META[r.type].cls:''}`;document.getElementById(`tog-${id}`).classList.toggle('on',r.enabled);renderJSON();}
function toggleCard(id){const r=rules.find(r=>r.id===id);r._open=!r._open;document.getElementById(`body-${id}`).classList.toggle('open',r._open);document.getElementById(`chev-${id}`).classList.toggle('open',r._open);}
function setLogic(id,v){rules.find(r=>r.id===id).logic=v;}
function addCond(id){const r=rules.find(r=>r.id===id);r.conditions.push({field:'token_text',op:'contains',value:''});document.getElementById(`conds-${id}`).innerHTML=r.conditions.map((c,ci)=>buildCondRow(id,ci,c,r.conditions.length)).join('');renderJSON();}
function removeCond(id,ci){const r=rules.find(r=>r.id===id);r.conditions.splice(ci,1);document.getElementById(`conds-${id}`).innerHTML=r.conditions.map((c,ci)=>buildCondRow(id,ci,c,r.conditions.length)).join('');renderJSON();}
function updateCond(id,ci,k,v){rules.find(r=>r.id===id).conditions[ci][k]=v;renderJSON();}
function rerenderOps(id,ci){const r=rules.find(r=>r.id===id);const el=document.getElementById(`opsel-${id}-${ci}`);if(el)el.innerHTML=getOps(r.conditions[ci].field).map(op=>`<option value="${op}">${op}</option>`).join('');}
function setAction(id,k,v){rules.find(r=>r.id===id).action[k]=v;renderJSON();}
function setParam(id,k,v){rules.find(r=>r.id===id).model_params[k]=v;renderJSON();}
function showAddMenu(){document.getElementById('addMenu').style.display='flex';}
function hideAddMenu(e){if(!e||e.target===document.getElementById('addMenu'))document.getElementById('addMenu').style.display='none';}
function importRules(){const inp=document.createElement('input');inp.type='file';inp.accept='.json';inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const rdr=new FileReader();rdr.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.rules)d.rules.forEach(rule=>{rule.id=++ruleId;rule._open=false;rule.stats={hits:0,total:0};rules.push(rule);});renderRules();}catch{alert('Invalid JSON');}};rdr.readAsText(f);};inp.click();}

/* ═══ STREAM SIM ═══ */
const STREAM_SAMPLES=['Stream event: frame received','Session: sess_cam01  |  Latency: 42ms','Token count: 128  |  Model: claude-sonnet','────','[chunk_1]  Motion detected in zone A.','[chunk_2]  SSN 123-45-6789 flagged in metadata.','[chunk_3]  Confidence: 0.94  |  Category: surveillance','────','Sentiment: neutral (score: 0.58)  |  Lang: en','[chunk_4]  Object class: person  |  Conf: 0.87','[chunk_5]  Route to: security-agent','Latency: 89ms  |  Topic: security (score: 0.91)'];
let simTimer=null,simIdx=0,tokenCount=0,hitCount=0,simOn=true;
function startSim(){
  if(simTimer)return;
  const feed=document.getElementById('streamFeed');
  const hitMap={};
  function next(){
    if(!simOn)return;
    const raw=STREAM_SAMPLES[simIdx%STREAM_SAMPLES.length];
    const lower=raw.toLowerCase();
    const div=document.createElement('div');div.className='stream-line';
    let hitRule=null;
    for(const rule of rules){
      if(!rule.enabled)continue;
      const res=rule.conditions.map(c=>{
        if(c.op==='contains')return lower.includes(c.value.toLowerCase());
        if(c.op==='not_contains')return !lower.includes(c.value.toLowerCase());
        if(c.op==='regex'){try{return new RegExp(c.value,'i').test(raw);}catch{return false;}}
        if(c.op==='equals')return lower.includes(c.value.toLowerCase());
        return Math.random()>.5;
      });
      const hit=rule.logic==='AND'?res.every(Boolean):res.some(Boolean);
      if(hit){hitRule=rule;break;}
    }
    if(raw.startsWith('────')){div.innerHTML=`<span style="color:var(--t2);letter-spacing:.15em;user-select:none;">────────────────</span>`;}
    else if(hitRule){const meta=TYPE_META[hitRule.type];div.classList.add(`hit-${hitRule.type}`);div.innerHTML=`<span class="chunk-idx">${String(tokenCount).padStart(2,'0')}</span><span>${raw}</span><span class="hit-tag ${meta.tag}">${meta.label}</span>`;hitMap[tokenCount]=hitRule;hitCount++;document.getElementById('hitCount').textContent=hitCount;}
    else{div.innerHTML=`<span class="chunk-idx" style="opacity:.3">${String(tokenCount).padStart(2,'0')}</span><span>${raw}</span>`;}
    feed.querySelectorAll('.stream-cursor').forEach(c=>c.remove());
    feed.appendChild(div);
    const cur=document.createElement('span');cur.className='stream-cursor';div.appendChild(cur);
    feed.scrollTop=feed.scrollHeight;
    while(feed.children.length>120)feed.removeChild(feed.firstChild);
    tokenCount++;simIdx++;
    document.getElementById('tokenCount').textContent=tokenCount;
    if(simIdx%STREAM_SAMPLES.length===0)runDetection(hitMap);
    simTimer=setTimeout(next,280+Math.random()*180);
  }
  next();
}
function clearFeed(){document.getElementById('streamFeed').innerHTML='';document.getElementById('detResults').innerHTML='<div class="det-empty">Run stream to see results…</div>';tokenCount=0;hitCount=0;document.getElementById('tokenCount').textContent='0';document.getElementById('hitCount').textContent='0';}
function runDetection(hitMap){
  const dr=document.getElementById('detResults');dr.innerHTML='';
  rules.forEach((rule,idx)=>{
    if(!rule.enabled)return;rule.stats.total++;
    const hit=Object.values(hitMap).some(r=>r.id===rule.id);if(hit)rule.stats.hits++;renderStats();
    const meta=TYPE_META[rule.type];const item=document.createElement('div');
    item.className=`det-item ${hit?(rule.type==='block'?'blocked':'hit'):'miss'}`;item.style.animationDelay=`${idx*55}ms`;
    item.innerHTML=`<div class="det-icon" style="background:${hit?`var(--${rule.type}-b)`:'rgba(255,255,255,.04)'};border:1px solid ${hit?`var(--${rule.type}-bd)`:'var(--bd)'}"><svg viewBox="0 0 24 24" fill="none" stroke="${hit?`var(--${rule.type})`:'var(--t2)'}" stroke-width="2.5">${hit?'<polyline points="20,6 9,17 4,12"/>':'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}</svg></div><div class="det-name">${rule.name}</div><span class="det-badge ${meta.tag}">${meta.label}</span>`;
    dr.appendChild(item);
  });
  if(!rules.length)dr.innerHTML='<div class="det-empty">No rules configured.</div>';
}

/* JSON / Stats */
function renderJSON(){const data={version:'1.0',pipeline:'camera-stream',cameras:CAMERAS.map(c=>({id:c.id,name:c.name,hls:c.hls})),rules:rules.filter(r=>r.enabled).map(r=>({id:r.id,name:r.name,type:r.type,logic:r.logic,conditions:r.conditions,action:r.action,model_params:r.model_params}))};document.getElementById('jsonBox').innerHTML=syntaxHL(JSON.stringify(data,null,2));}
function syntaxHL(j){return j.replace(/("[\w_]+")\s*:/g,'<span class="json-key">$1</span>:').replace(/:\s*(".*?")/g,': <span class="json-str">$1</span>').replace(/:\s*(true|false)/g,': <span class="json-bool">$1</span>').replace(/:\s*(-?\d+\.?\d*)/g,': <span class="json-num">$1</span>');}
function copyJSON(){const data={version:'1.0',pipeline:'camera-stream',cameras:CAMERAS.map(c=>({id:c.id,name:c.name,hls:c.hls})),rules:rules.filter(r=>r.enabled).map(r=>({id:r.id,name:r.name,type:r.type,logic:r.logic,conditions:r.conditions,action:r.action,model_params:r.model_params}))};navigator.clipboard.writeText(JSON.stringify(data,null,2)).then(()=>{const b=event.target;b.textContent='Copied!';setTimeout(()=>b.textContent='Copy JSON',1500);});}
function downloadJSON(){const data={version:'1.0',pipeline:'camera-stream',cameras:CAMERAS.map(c=>({id:c.id,name:c.name,hls:c.hls})),rules:rules.filter(r=>r.enabled).map(r=>({id:r.id,name:r.name,type:r.type,logic:r.logic,conditions:r.conditions,action:r.action,model_params:r.model_params}))};const a=document.createElement('a');a.href='data:text/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(data,null,2));a.download='camera-stream.json';a.click();}
function renderStats(){const p=document.getElementById('statsPanel');if(!rules.length){p.innerHTML='<div style="padding:16px;font-size:11px;font-style:italic;color:var(--t2)">No rules yet.</div>';return;}p.innerHTML=rules.map(r=>`<div class="stat-card"><div class="stat-row"><span class="stat-name">${r.name}</span><span class="stat-val">${r.stats.total>0?Math.round(r.stats.hits/r.stats.total*100)+'%':'—'}</span></div><div class="stat-bar-wrap"><div class="stat-bar" style="width:${r.stats.total>0?r.stats.hits/r.stats.total*100:0}%"></div></div><div class="stat-sub">${r.stats.hits} hits / ${r.stats.total} runs · ${TYPE_META[r.type].label}</div></div>`).join('');}
function switchTab(tab){document.querySelectorAll('.rp-tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));document.querySelectorAll('.rp-panel').forEach(p=>p.classList.toggle('on',p.id===`tab-${tab}`));if(tab==='json')renderJSON();if(tab==='stats')renderStats();}

document.getElementById('themeBtn').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});

window.addEventListener('load',()=>{
  renderCamCards();
  ['match','block','route'].forEach(t=>{addRule(t);rules[rules.length-1]._open=false;});
  renderRules();
  startSim();
});

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  try {
    const res = await fetch("../assets/components/sidebar.html");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    container.innerHTML = html;
  } catch (err) {
    console.error("Load sidebar failed:", err);
  }
});