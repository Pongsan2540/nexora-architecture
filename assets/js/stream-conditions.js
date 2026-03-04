/* stream-conditions.js — Page-specific logic */
/* Shared utilities: ../assets/js/glassui.js  */

GlassUI.nav.init();
GlassUI.theme.init('themeBtn');
GlassUI.grid.init('bgCanvas');

/* ═══════════════════════════════════════
   DATA MODEL
═══════════════════════════════════════ */
let ruleId = 0;
const rules = [];

const TYPE_META = {
  match:     { label:'Match',     cls:'rule-match',     tag:'tag-match'     },
  block:     { label:'Block',     cls:'rule-block',     tag:'tag-block'     },
  flag:      { label:'Flag',      cls:'rule-flag',      tag:'tag-flag'      },
  transform: { label:'Transform', cls:'rule-transform', tag:'tag-transform' },
  route:     { label:'Route',     cls:'rule-route',     tag:'tag-route'     },
};

const FIELDS = ['token_text','chunk_text','sentiment_score','topic_score',
  'confidence','category','lang','token_count','latency_ms','model_id','session_id','role'];
const NUMBER_FIELDS = ['sentiment_score','topic_score','confidence','token_count','latency_ms'];
const OPS_TEXT = ['contains','not_contains','equals','not_equals','regex','starts_with','ends_with'];
const OPS_NUM  = ['gt','gte','lt','lte','equals','not_equals'];
const getOps   = f => NUMBER_FIELDS.includes(f) ? OPS_NUM : OPS_TEXT;

const TEMPLATES = {
  match: {
    name:'Sentiment Detector',
    conditions:[{field:'token_text',op:'contains',value:'bad'},{field:'sentiment_score',op:'lt',value:'0.3'}],
    logic:'OR', action:{type:'match',label:'negative_sentiment',threshold:0.6},
    model_params:{temperature:0.2,top_p:0.9,max_tokens:512},
  },
  block: {
    name:'PII Blocker',
    conditions:[{field:'token_text',op:'regex',value:'\\b\\d{3}-\\d{2}-\\d{4}\\b'},{field:'category',op:'equals',value:'personal_data'}],
    logic:'OR', action:{type:'block',replacement:'[REDACTED]',notify:true},
    model_params:{temperature:0,top_p:1,max_tokens:256},
  },
  flag: {
    name:'Topic Tagger',
    conditions:[{field:'topic_score',op:'gt',value:'0.7'}],
    logic:'AND', action:{type:'flag',tag:'off_topic',severity:'medium'},
    model_params:{temperature:0.1,top_p:0.95,max_tokens:512},
  },
  transform: {
    name:'Language Normaliser',
    conditions:[{field:'lang',op:'not_equals',value:'en'}],
    logic:'AND', action:{type:'transform',prompt:'Translate to English. Keep technical terms.',inject_before:''},
    model_params:{temperature:0.3,top_p:0.9,max_tokens:1024},
  },
  route: {
    name:'Code Router',
    conditions:[{field:'category',op:'equals',value:'code'},{field:'confidence',op:'gt',value:'0.8'}],
    logic:'AND', action:{type:'route',target_agent:'code-assistant',priority:'high'},
    model_params:{temperature:0.1,top_p:0.95,max_tokens:2048},
  },
};

/* ═══════════════════════════════════════
   RENDER — RULE CARDS
═══════════════════════════════════════ */
function renderRules() {
  const c = document.getElementById('rulesContainer');
  c.innerHTML = '';
  rules.forEach(r => c.appendChild(buildCard(r)));
  document.getElementById('ruleCountBadge').textContent = rules.length;
  renderJSON();
  renderStats();
}

function buildCard(rule) {
  const meta = TYPE_META[rule.type];
  const card = document.createElement('div');
  card.className = `rule-card ${rule.enabled ? meta.cls : ''}`;
  card.id = `card-${rule.id}`;
  const fc = rule.conditions[0];
  const summary = fc ? `${fc.field} ${fc.op} "${fc.value}"` : 'no conditions';
  card.innerHTML = `
    <div class="rc-head" onclick="toggleCard(${rule.id})">
      <div class="rc-drag" onclick="event.stopPropagation()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </div>
      <div class="rc-dot tc-${rule.type}"></div>
      <div class="rc-name">${rule.name}</div>
      <span class="rc-type-badge ${meta.tag}">${meta.label}</span>
      <button class="rc-toggle ${rule.enabled?'on':''}" id="tog-${rule.id}"
        onclick="event.stopPropagation();toggleEnable(${rule.id})"></button>
      <div class="rc-chevron ${rule._open?'open':''}" id="chev-${rule.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>
      </div>
      <button class="rc-del" onclick="event.stopPropagation();deleteRule(${rule.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4h8v2"/>
        </svg>
      </button>
    </div>
    <div class="rc-body ${rule._open?'open':''}" id="body-${rule.id}">
      ${buildBody(rule)}
    </div>`;
  return card;
}

function buildBody(rule) {
  const a = rule.action, p = rule.model_params;
  const condRows = rule.conditions.map((c,ci) =>
    buildCondRow(rule.id, ci, c, rule.conditions.length)).join('');

  let actionHtml = '';
  if (rule.type === 'match')
    actionHtml = `<div class="action-block">
      <div class="action-row"><span class="action-key">Label</span>
        <input class="inp" placeholder="label…" value="${a.label||''}" oninput="setAction(${rule.id},'label',this.value)">
      </div>
      <div class="action-row"><span class="action-key">Threshold</span>
        <div class="slider-row" style="flex:1">
          <input type="range" class="slider" min="0" max="1" step="0.05" value="${a.threshold||0.5}"
            oninput="setAction(${rule.id},'threshold',parseFloat(this.value));this.nextElementSibling.textContent=parseFloat(this.value).toFixed(2)">
          <span class="slider-val">${(a.threshold||0.5).toFixed(2)}</span>
        </div>
      </div></div>`;
  else if (rule.type === 'block')
    actionHtml = `<div class="action-block">
      <div class="action-row"><span class="action-key">Replace</span>
        <input class="inp" placeholder="[REDACTED]" value="${a.replacement||''}" oninput="setAction(${rule.id},'replacement',this.value)">
      </div>
      <div class="action-row"><span class="action-key">Notify</span>
        <select class="sel w-sm" onchange="setAction(${rule.id},'notify',this.value==='true')">
          <option value="true"  ${a.notify ?'selected':''}>Yes</option>
          <option value="false" ${!a.notify?'selected':''}>No</option>
        </select>
      </div></div>`;
  else if (rule.type === 'flag')
    actionHtml = `<div class="action-block">
      <div class="action-row"><span class="action-key">Tag</span>
        <input class="inp" placeholder="tag_name" value="${a.tag||''}" oninput="setAction(${rule.id},'tag',this.value)">
      </div>
      <div class="action-row"><span class="action-key">Severity</span>
        <select class="sel w-md" onchange="setAction(${rule.id},'severity',this.value)">
          ${['low','medium','high','critical'].map(s =>
            `<option value="${s}" ${s===a.severity?'selected':''}>${s}</option>`).join('')}
        </select>
      </div></div>`;
  else if (rule.type === 'transform')
    actionHtml = `<div class="action-block">
      <div class="action-row" style="align-items:flex-start">
        <span class="action-key" style="padding-top:3px">Prompt</span>
        <textarea class="ta" oninput="setAction(${rule.id},'prompt',this.value)">${a.prompt||''}</textarea>
      </div>
      <div class="action-row"><span class="action-key">Inject</span>
        <input class="inp" placeholder="prefix…" value="${a.inject_before||''}" oninput="setAction(${rule.id},'inject_before',this.value)">
      </div></div>`;
  else if (rule.type === 'route')
    actionHtml = `<div class="action-block">
      <div class="action-row"><span class="action-key">Target</span>
        <input class="inp" placeholder="agent-id" value="${a.target_agent||''}" oninput="setAction(${rule.id},'target_agent',this.value)">
      </div>
      <div class="action-row"><span class="action-key">Priority</span>
        <select class="sel w-md" onchange="setAction(${rule.id},'priority',this.value)">
          ${['low','normal','high','critical'].map(pr =>
            `<option value="${pr}" ${pr===a.priority?'selected':''}>${pr}</option>`).join('')}
        </select>
      </div></div>`;

  return `
    <div class="cond-block">
      <div class="cond-label">Conditions
        <select class="sel w-sm" style="font-size:9px;padding:2px 18px 2px 6px"
          onchange="setLogic(${rule.id},this.value)">
          <option value="AND" ${rule.logic==='AND'?'selected':''}>ALL (AND)</option>
          <option value="OR"  ${rule.logic==='OR' ?'selected':''}>ANY (OR)</option>
        </select>
      </div>
      <div id="conds-${rule.id}">${condRows}</div>
      <button class="add-cond" onclick="addCond(${rule.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>Add condition
      </button>
    </div>
    <div class="cond-block"><div class="cond-label">Action</div>${actionHtml}</div>
    <div class="cond-block" style="margin-bottom:0">
      <div class="cond-label">Model Parameters</div>
      <div class="param-grid">
        <div class="param-item">
          <div class="param-name">Temperature</div>
          <div class="slider-row">
            <input type="range" class="slider" min="0" max="2" step="0.05" value="${p.temperature}"
              oninput="setParam(${rule.id},'temperature',parseFloat(this.value));this.nextElementSibling.textContent=this.value">
            <span class="slider-val">${p.temperature}</span>
          </div>
        </div>
        <div class="param-item">
          <div class="param-name">Top-P</div>
          <div class="slider-row">
            <input type="range" class="slider" min="0.01" max="1" step="0.01" value="${p.top_p}"
              oninput="setParam(${rule.id},'top_p',parseFloat(this.value));this.nextElementSibling.textContent=this.value">
            <span class="slider-val">${p.top_p}</span>
          </div>
        </div>
        <div class="param-item" style="grid-column:span 2">
          <div class="param-name">Max Tokens</div>
          <div class="slider-row">
            <input type="range" class="slider" min="64" max="4096" step="64" value="${p.max_tokens}"
              oninput="setParam(${rule.id},'max_tokens',parseInt(this.value));this.nextElementSibling.textContent=this.value">
            <span class="slider-val">${p.max_tokens}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function buildCondRow(rid, ci, cond, total) {
  const ops = getOps(cond.field);
  return `<div class="cond-row" id="cr-${rid}-${ci}">
    <span class="cond-logic">${ci===0?'IF':'AND'}</span>
    <select class="sel w-md"
      onchange="updateCond(${rid},${ci},'field',this.value);rerenderOps(${rid},${ci})">
      ${FIELDS.map(f=>`<option value="${f}" ${f===cond.field?'selected':''}>${f}</option>`).join('')}
    </select>
    <select class="sel w-sm" id="opsel-${rid}-${ci}">
      ${ops.map(op=>`<option value="${op}" ${op===cond.op?'selected':''}>${op}</option>`).join('')}
    </select>
    <input class="inp" placeholder="value…" value="${cond.value||''}"
      oninput="updateCond(${rid},${ci},'value',this.value)">
    ${total>1?`<button style="width:19px;height:19px;display:flex;align-items:center;justify-content:center;border-radius:4px;background:none;border:none;color:var(--t2);cursor:pointer;flex-shrink:0"
      onmouseenter="this.style.background='var(--red-b)';this.style.color='var(--red)'"
      onmouseleave="this.style.background='none';this.style.color='var(--t2)'"
      onclick="removeCond(${rid},${ci})">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg></button>`:''}
  </div>`;
}

/* ─── MUTATIONS ─── */
function addRule(type) {
  hideAddMenu();
  const tpl = JSON.parse(JSON.stringify(TEMPLATES[type]));
  rules.push({ id:++ruleId, type, name:tpl.name, enabled:true, _open:true,
    conditions:tpl.conditions, logic:tpl.logic,
    action:tpl.action, model_params:tpl.model_params,
    stats:{hits:0,total:0} });
  renderRules();
  setTimeout(() =>
    document.getElementById(`card-${ruleId}`)?.scrollIntoView({behavior:'smooth',block:'nearest'}), 60);
}
function deleteRule(id)   { rules.splice(rules.findIndex(r=>r.id===id),1); renderRules(); }
function toggleEnable(id) {
  const r = rules.find(r=>r.id===id); r.enabled = !r.enabled;
  document.getElementById(`card-${r.id}`).className = `rule-card ${r.enabled?TYPE_META[r.type].cls:''}`;
  document.getElementById(`tog-${id}`).classList.toggle('on', r.enabled);
  renderJSON();
}
function toggleCard(id) {
  const r = rules.find(r=>r.id===id); r._open = !r._open;
  document.getElementById(`body-${id}`).classList.toggle('open', r._open);
  document.getElementById(`chev-${id}`).classList.toggle('open', r._open);
}
function setLogic(id,v)    { rules.find(r=>r.id===id).logic = v; }
function addCond(id) {
  const r = rules.find(r=>r.id===id);
  r.conditions.push({field:'token_text',op:'contains',value:''});
  document.getElementById(`conds-${id}`).innerHTML =
    r.conditions.map((c,ci)=>buildCondRow(id,ci,c,r.conditions.length)).join('');
  renderJSON();
}
function removeCond(id,ci) {
  const r = rules.find(r=>r.id===id); r.conditions.splice(ci,1);
  document.getElementById(`conds-${id}`).innerHTML =
    r.conditions.map((c,ci)=>buildCondRow(id,ci,c,r.conditions.length)).join('');
  renderJSON();
}
function updateCond(id,ci,k,v) { rules.find(r=>r.id===id).conditions[ci][k]=v; renderJSON(); }
function rerenderOps(id,ci) {
  const r = rules.find(r=>r.id===id);
  const el = document.getElementById(`opsel-${id}-${ci}`);
  if (el) el.innerHTML = getOps(r.conditions[ci].field)
    .map(op=>`<option value="${op}">${op}</option>`).join('');
}
function setAction(id,k,v) { rules.find(r=>r.id===id).action[k]=v; renderJSON(); }
function setParam(id,k,v)  { rules.find(r=>r.id===id).model_params[k]=v; renderJSON(); }
function showAddMenu()      { document.getElementById('addMenu').style.display='flex'; }
function hideAddMenu(e)     {
  if (!e || e.target===document.getElementById('addMenu'))
    document.getElementById('addMenu').style.display='none';
}

/* ═══════════════════════════════════════
   STREAM SIMULATOR — CENTER COLUMN
═══════════════════════════════════════ */
const SAMPLES = [
  {
    label: 'PII in stream',
    lines: [
      "Processing: user message received",
      "Role: user  |  Session: sess_a1b2c3",
      "Token count: 47  |  Latency: 138ms",
      "────",
      "[chunk_1]  Sure! The deadline is set for March 15th.",
      "[chunk_2]  SSN 123-45-6789 was referenced in the ticket.",
      "[chunk_3]  Please let me know if you need more details.",
      "────",
      "Sentiment: neutral (score: 0.61)  |  Lang: en",
      "Category: task_management  |  Confidence: 0.92",
    ],
  },
  {
    label: 'Code routing',
    lines: [
      "Stream event: user query",
      "Model: claude-sonnet-4-20250514  |  Temp: 0.1",
      "────",
      "[chunk_1]  I need help with this Python code.",
      "[chunk_2]  def process_data(df):",
      "[chunk_3]      return df.dropna().reset_index()",
      "[chunk_4]  Can you review and optimise it?",
      "────",
      "Category: code  |  Confidence: 0.97",
      "Topic: programming (score: 0.95)",
    ],
  },
  {
    label: 'Neg. sentiment',
    lines: [
      "Stream event: assistant response",
      "Session: sess_xyz789  |  Token count: 62",
      "────",
      "[chunk_1]  This is really bad service.",
      "[chunk_2]  The product is terrible and disappointing.",
      "[chunk_3]  I want a full refund immediately.",
      "────",
      "Sentiment: negative (score: 0.12)",
      "Topic: customer_complaint (score: 0.88)",
      "Lang: en  |  Category: feedback",
    ],
  },
];

let currentSample = 0;
let streamTimer   = null;
let lineIndex     = 0;
let isRunning     = false;

function selectSample(idx) {
  currentSample = idx;
  document.querySelectorAll('.sample-chip').forEach((c,i) =>
    c.classList.toggle('on', i===idx));
  clearStream();
}

function startStream() {
  if (isRunning) return;
  isRunning  = true;
  lineIndex  = 0;
  const feed = document.getElementById('streamFeed');
  const btn  = document.getElementById('btnRun');
  btn.classList.add('active');
  feed.innerHTML = '';
  document.getElementById('detResults').innerHTML =
    '<div class="det-empty">Processing stream\u2026</div>';

  const sample = SAMPLES[currentSample];
  const hitMap = {};

  function nextLine() {
    if (!isRunning || lineIndex >= sample.lines.length) {
      isRunning = false;
      btn.classList.remove('active');
      feed.querySelectorAll('.stream-cursor').forEach(c => c.remove());
      runDetection(hitMap);
      return;
    }

    const raw   = sample.lines[lineIndex];
    const lower = raw.toLowerCase();
    const div   = document.createElement('div');
    div.className = 'stream-line';

    // match against rules
    let hitRule = null;
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const results = rule.conditions.map(c => {
        if (c.op==='contains')     return lower.includes(c.value.toLowerCase());
        if (c.op==='not_contains') return !lower.includes(c.value.toLowerCase());
        if (c.op==='regex')        { try { return new RegExp(c.value,'i').test(raw); } catch { return false; } }
        if (c.op==='equals')       return lower.includes(c.value.toLowerCase());
        return Math.random() > 0.45;
      });
      const hit = rule.logic==='AND' ? results.every(Boolean) : results.some(Boolean);
      if (hit) { hitRule = rule; break; }
    }

    if (raw.startsWith('\u2500\u2500\u2500\u2500')) {
      // divider line
      div.innerHTML = `<span style="color:var(--t2);user-select:none;letter-spacing:.15em;">${raw.repeat ? raw : raw}</span>`;
    } else if (hitRule) {
      const meta = TYPE_META[hitRule.type];
      div.classList.add(`hit-${hitRule.type}`);
      div.innerHTML =
        `<span class="chunk-idx">${String(lineIndex).padStart(2,'0')}</span>` +
        `<span class="chunk-text">${raw}</span>` +
        `<span class="hit-tag ${meta.tag}">${meta.label}</span>`;
      hitMap[lineIndex] = hitRule;
    } else {
      div.innerHTML =
        `<span class="chunk-idx" style="opacity:.3">${String(lineIndex).padStart(2,'0')}</span>` +
        `<span class="chunk-text">${raw}</span>`;
    }

    // move blinking cursor to latest line
    feed.querySelectorAll('.stream-cursor').forEach(c => c.remove());
    feed.appendChild(div);
    const cur = document.createElement('span');
    cur.className = 'stream-cursor';
    div.appendChild(cur);
    feed.scrollTop = feed.scrollHeight;

    lineIndex++;
    streamTimer = setTimeout(nextLine, 240 + Math.random() * 160);
  }

  nextLine();
}

function stopStream() {
  isRunning = false;
  clearTimeout(streamTimer);
  document.getElementById('btnRun').classList.remove('active');
  document.getElementById('streamFeed').querySelectorAll('.stream-cursor').forEach(c=>c.remove());
}

function clearStream() {
  stopStream();
  document.getElementById('streamFeed').innerHTML = '';
  document.getElementById('detResults').innerHTML =
    '<div class="det-empty">Run a stream to see detection results\u2026</div>';
}

function runDetection(hitMap) {
  const dr = document.getElementById('detResults');
  dr.innerHTML = '';

  rules.forEach((rule, idx) => {
    if (!rule.enabled) return;
    rule.stats.total++;
    const hit = Object.values(hitMap).some(r => r.id === rule.id);
    if (hit) rule.stats.hits++;
    renderStats();

    const meta = TYPE_META[rule.type];
    const item = document.createElement('div');
    item.className = `det-item ${hit ? (rule.type==='block' ? 'blocked' : 'hit') : 'miss'}`;
    item.style.animationDelay = `${idx * 55}ms`;
    item.innerHTML = `
      <div class="det-icon"
        style="background:${hit?`var(--${rule.type}-b)`:'rgba(255,255,255,.04)'};
               border:1px solid ${hit?`var(--${rule.type}-bd)`:'var(--bd)'}">
        <svg viewBox="0 0 24 24" fill="none"
          stroke="${hit?`var(--${rule.type})`:'var(--t2)'}" stroke-width="2.5">
          ${hit ? '<polyline points="20,6 9,17 4,12"/>'
                : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
        </svg>
      </div>
      <div class="det-name">${rule.name}</div>
      <span class="det-badge ${meta.tag}">${meta.label}</span>`;
    dr.appendChild(item);
  });

  if (!rules.length)
    dr.innerHTML = '<div class="det-empty">No rules configured.</div>';
}

/* ═══════════════════════════════════════
   JSON  /  STATS
═══════════════════════════════════════ */
function renderJSON() {
  const data = {
    version:'1.0', pipeline:'stream-conditions',
    rules: rules.filter(r=>r.enabled).map(r=>({
      id:r.id, name:r.name, type:r.type, logic:r.logic,
      conditions:r.conditions, action:r.action, model_params:r.model_params,
    })),
  };
  document.getElementById('jsonBox').innerHTML = syntaxHL(JSON.stringify(data,null,2));
}

function syntaxHL(j) {
  return j
    .replace(/("[\w_]+")\s*:/g,   '<span class="json-key">$1</span>:')
    .replace(/:\s*(".*?")/g,       ': <span class="json-str">$1</span>')
    .replace(/:\s*(true|false)/g,  ': <span class="json-bool">$1</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-num">$1</span>');
}

function copyJSON() {
  const data = { version:'1.0', pipeline:'stream-conditions',
    rules: rules.filter(r=>r.enabled).map(r=>({id:r.id,name:r.name,type:r.type,logic:r.logic,conditions:r.conditions,action:r.action,model_params:r.model_params}))};
  navigator.clipboard.writeText(JSON.stringify(data,null,2)).then(() => {
    const b = event.target; b.textContent = 'Copied!';
    setTimeout(() => b.textContent = 'Copy JSON', 1500);
  });
}

function downloadJSON() {
  const data = { version:'1.0', pipeline:'stream-conditions',
    rules: rules.filter(r=>r.enabled).map(r=>({id:r.id,name:r.name,type:r.type,logic:r.logic,conditions:r.conditions,action:r.action,model_params:r.model_params}))};
  const a = document.createElement('a');
  a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data,null,2));
  a.download = 'stream-conditions.json';
  a.click();
}

function importRules() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rdr = new FileReader();
    rdr.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.rules) d.rules.forEach(rule => {
          rule.id=++ruleId; rule._open=false; rule.stats={hits:0,total:0};
          rules.push(rule);
        });
        renderRules();
      } catch { alert('Invalid JSON'); }
    };
    rdr.readAsText(f);
  };
  inp.click();
}

function renderStats() {
  const p = document.getElementById('statsPanel');
  if (!rules.length) {
    p.innerHTML = '<div style="padding:16px;font-size:11px;font-style:italic;color:var(--t2);">No rules yet.</div>';
    return;
  }
  p.innerHTML = rules.map(r => `
    <div class="stat-card">
      <div class="stat-row">
        <span class="stat-name">${r.name}</span>
        <span class="stat-val">${r.stats.total>0 ? Math.round(r.stats.hits/r.stats.total*100)+'%' : '&mdash;'}</span>
      </div>
      <div class="stat-bar-wrap">
        <div class="stat-bar" style="width:${r.stats.total>0 ? r.stats.hits/r.stats.total*100 : 0}%"></div>
      </div>
      <div class="stat-sub">${r.stats.hits} hits / ${r.stats.total} runs &middot; ${TYPE_META[r.type].label}</div>
    </div>`).join('');
}

/* ─── TABS ─── */
function switchTab(tab) {
  document.querySelectorAll('.rp-tab').forEach(t => t.classList.toggle('on', t.dataset.tab===tab));
  document.querySelectorAll('.rp-panel').forEach(p => p.classList.toggle('on', p.id===`tab-${tab}`));
  if (tab==='json')  renderJSON();
  if (tab==='stats') renderStats();
}

/* ─── INIT ─── */
window.addEventListener('load', () => {
  ['match','block','route'].forEach(t => {
    addRule(t);
    rules[rules.length-1]._open = false;
  });
  renderRules();

  document.querySelectorAll('.sample-chip').forEach((chip,i) =>
    chip.addEventListener('click', () => selectSample(i)));
  selectSample(0);
});
