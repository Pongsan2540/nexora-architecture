/* blackhole-login.js — Page-specific logic */
/* Shared utilities: ../js/glassui.js */

(function () {

  /* ━━━ THEME ━━━ */
  const root = document.documentElement;
  let dark = true;
  const DARK_BG  = [15, 14, 12];
  const LIGHT_BG = [247, 247, 245];
  let bgT = 0, bgTgt = 0;

  document.getElementById('themeBtn').addEventListener('click', () => {
    dark = !dark;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    bgTgt = dark ? 0 : 1;
    setTimeout(() => render(false), 16);
  });

  /* ━━━ CANVAS SETUP ━━━ */
  const container = document.getElementById('blackhole');
  const W = container.offsetWidth, H = container.offsetHeight;
  const CX = W / 2, CY = H / 2, MAX_ORB = 180;

  const canvas = document.createElement('canvas');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.cssText = `position:absolute;inset:0;width:${W}px;height:${H}px`;
  container.insertBefore(canvas, container.firstChild);
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  /* ━━━ STATE ━━━ */
  const T0 = Date.now();
  let bCol = false, bExp = false, bRet = false;

  // AI animation state
  let aiPhase = 0;      // 0=idle, 1=activating, 2=running, 3=fading
  let aiT = 0;          // time since activation
  let aiAlpha = 0;      // overall AI layer opacity (0–1)

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     BLACKHOLE STARS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const STARS = [];
  class Star {
    constructor() {
      const r1 = Math.random() * (MAX_ORB / 2) + 1;
      const r2 = Math.random() * (MAX_ORB / 2) + MAX_ORB;
      this.orb = (r1 + r2) / 2;
      this.x = CX; this.y = CY + this.orb; this.yo = this.y;
      this.spd = (Math.random() * 2 + 1) * Math.PI / 180;
      this.sr = Math.random() * Math.PI * 2; this.rot = 0;
      this.cb = Math.max(0, this.orb - MAX_ORB * 0.7);
      this.hp = CY + MAX_ORB / 2 + this.cb;
      this.ep = CY + (STARS.length % 100) * -8 + Math.random() * 20;
      this.al = parseFloat((1 - this.orb / 255).toFixed(2));
      this.pr = this.sr; this.px = CX; this.py = this.y;
    }
    draw(t) {
      if (!bExp && !bRet) {
        this.rot = this.sr + t * this.spd;
        this.y += bCol ? (this.hp - this.y) * 0.05 : (this.yo - this.y) * 0.08;
      } else if (bExp) {
        this.rot = this.sr + t * this.spd * 0.5;
        this.y += (this.ep - this.y) * 0.012;
      } else {
        this.rot = this.sr + t * this.spd;
        this.y += (this.yo - this.y) * 0.018;
      }
      const c = Math.cos(-this.pr), s = Math.sin(-this.pr);
      const ox = this.px - CX, oy = this.py - CY;
      ctx.save();
      ctx.strokeStyle = dark
        ? `rgba(220,210,196,${this.al})`
        : `rgba(28,22,14,${this.al})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(c * ox - s * oy + CX, s * ox + c * oy + CY);
      ctx.translate(CX, CY); ctx.rotate(this.rot); ctx.translate(-CX, -CY);
      ctx.lineTo(this.x, this.y); ctx.stroke(); ctx.restore();
      this.pr = this.rot; this.px = this.x; this.py = this.y;
    }
  }
  for (let i = 0; i < 1600; i++) STARS.push(new Star());

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     AI BACKGROUND ELEMENTS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  // Neural nodes — scattered across screen
  const NODES = Array.from({ length: 28 }, (_, i) => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.8 + 0.6,
    phase: Math.random() * Math.PI * 2,
    spd: Math.random() * 0.3 + 0.1,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.12,
  }));

  // Data stream particles — flow from left to right, slightly diagonal
  const STREAMS = Array.from({ length: 40 }, (_, i) => newStream(i));
  function newStream(i) {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      len: Math.random() * 80 + 40,
      spd: Math.random() * 1.2 + 0.5,
      angle: (Math.random() - 0.5) * 0.3 + Math.PI * 0.04, // mostly rightward
      al: Math.random() * 0.5 + 0.1,
      delay: Math.random() * 3000,
    };
  }

  // Grid cells that "activate" briefly
  const GRID_SIZE = 60;
  const GCOLS = Math.ceil(W / GRID_SIZE) + 1;
  const GROWS = Math.ceil(H / GRID_SIZE) + 1;
  const CELLS = [];
  for (let row = 0; row < GROWS; row++)
    for (let col = 0; col < GCOLS; col++)
      CELLS.push({ row, col, flash: 0, delay: Math.random() * 2000 });

  // Connection lines between nearby nodes
  function drawConnections(alpha) {
    const MAX_DIST = 200;
    ctx.save();
    for (let i = 0; i < NODES.length; i++) {
      for (let j = i + 1; j < NODES.length; j++) {
        const dx = NODES[i].x - NODES[j].x;
        const dy = NODES[i].y - NODES[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          const strength = (1 - dist / MAX_DIST) * 0.35 * alpha;
          const col = dark ? `rgba(200,200,190,${strength})` : `rgba(30,28,24,${strength})`;
          ctx.strokeStyle = col;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(NODES[i].x, NODES[i].y);
          ctx.lineTo(NODES[j].x, NODES[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawNodes(t, alpha) {
    NODES.forEach(n => {
      // drift
      n.x += n.vx; n.y += n.vy;
      if (n.x < -20) n.x = W + 20;
      if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20;
      if (n.y > H + 20) n.y = -20;

      const pulse = Math.sin(t * 0.02 + n.phase) * 0.5 + 0.5;
      const a = pulse * 0.7 * alpha;
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + pulse * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = dark ? `rgba(210,205,195,${a})` : `rgba(40,38,30,${a})`;
      ctx.fill();

      // halo
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = dark ? `rgba(210,205,195,${a * 0.15})` : `rgba(40,38,30,${a * 0.15})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawStreams(t, alpha) {
    ctx.save();
    const now = Date.now() - T0;
    STREAMS.forEach(s => {
      if (now < s.delay) return;
      const age = (now - s.delay) * 0.001;
      const dist = (age * s.spd * 80) % (W + 200);
      const sx = s.x + Math.cos(s.angle) * dist;
      const sy = s.y + Math.sin(s.angle) * dist;
      const ex = sx - Math.cos(s.angle) * s.len;
      const ey = sy - Math.sin(s.angle) * s.len;

      const a = s.al * alpha * 0.7;
      const grad = ctx.createLinearGradient(ex, ey, sx, sy);
      const col = dark ? `rgba(200,198,192,` : `rgba(28,26,22,`;
      grad.addColorStop(0, col + '0)');
      grad.addColorStop(0.7, col + a + ')');
      grad.addColorStop(1,   col + '0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      // leading dot
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fillStyle = dark ? `rgba(220,218,210,${a * 1.5})` : `rgba(20,18,14,${a * 1.5})`;
      ctx.fill();
    });
    ctx.restore();
  }

  function drawGridCells(t, alpha) {
    const now = Date.now() - T0;
    ctx.save();
    CELLS.forEach(cell => {
      const age = now - cell.delay;
      if (age < 0) return;
      // pulse every ~4s with random phase
      const cycle = (age % 4000) / 4000;
      const flash = cycle < 0.05 ? (cycle / 0.05) : cycle < 0.15 ? (1 - (cycle - 0.05) / 0.1) : 0;
      if (flash < 0.01) return;
      const x = cell.col * GRID_SIZE;
      const y = cell.row * GRID_SIZE;
      const a = flash * 0.06 * alpha;
      ctx.fillStyle = dark ? `rgba(210,205,195,${a})` : `rgba(30,28,24,${a})`;
      ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
      // corner dots
      const da = flash * 0.25 * alpha;
      const dc = dark ? `rgba(210,205,195,${da})` : `rgba(30,28,24,${da})`;
      ctx.fillStyle = dc;
      [[x,y],[x+GRID_SIZE,y],[x,y+GRID_SIZE],[x+GRID_SIZE,y+GRID_SIZE]].forEach(([cx,cy]) => {
        ctx.beginPath(); ctx.arc(cx, cy, 1, 0, Math.PI * 2); ctx.fill();
      });
    });
    ctx.restore();
  }

  function drawGridLines(alpha) {
    const a = 0.04 * alpha;
    const col = dark ? `rgba(200,198,190,${a})` : `rgba(30,28,22,${a})`;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 0.4;
    // vertical
    for (let x = 0; x <= W; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    // horizontal
    for (let y = 0; y <= H; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MAIN LOOP
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  ctx.fillStyle = `rgb(${DARK_BG[0]},${DARK_BG[1]},${DARK_BG[2]})`;
  ctx.fillRect(0, 0, W, H);

  (function loop() {
    bgT += (bgTgt - bgT) * 0.04;
    const r = Math.round(DARK_BG[0] + (LIGHT_BG[0] - DARK_BG[0]) * bgT);
    const g = Math.round(DARK_BG[1] + (LIGHT_BG[1] - DARK_BG[1]) * bgT);
    const b = Math.round(DARK_BG[2] + (LIGHT_BG[2] - DARK_BG[2]) * bgT);
    ctx.fillStyle = `rgba(${r},${g},${b},0.2)`;
    ctx.fillRect(0, 0, W, H);

    const t = (Date.now() - T0) / 50;

    // Draw blackhole stars
    STARS.forEach(s => s.draw(t));

    // AI animation — lerp alpha
    if (aiPhase === 1) {
      aiAlpha = Math.min(1, aiAlpha + 0.012);
      if (aiAlpha >= 1) aiPhase = 2;
    } else if (aiPhase === 3) {
      aiAlpha = Math.max(0, aiAlpha - 0.008);
      if (aiAlpha <= 0) aiPhase = 0;
    }

    if (aiAlpha > 0.001) {
      drawGridLines(aiAlpha);
      drawGridCells(t, aiAlpha);
      drawConnections(aiAlpha);
      drawStreams(t, aiAlpha);
      drawNodes(t, aiAlpha);
    }

    requestAnimationFrame(loop);
  })();

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     WAVE CANVAS — overlay background
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const waveCanvas = document.getElementById('waveCanvas');
  const wctx = waveCanvas.getContext('2d');
  let wW, wH, waveActive = false, waveRAF = null;

  function resizeWave() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    wW = window.innerWidth;
    wH = window.innerHeight;
    waveCanvas.width  = wW * dpr;
    waveCanvas.height = wH * dpr;
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Nodes for overlay ──
  const WV_NODES = Array.from({ length: 24 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.6 + 0.5,
    phase: Math.random() * Math.PI * 2,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.10,
  }));

  // ── Data streams for overlay ──
  const WV_STREAMS = Array.from({ length: 35 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    len: Math.random() * 90 + 35,
    spd: Math.random() * 1.1 + 0.4,
    angle: (Math.random() - 0.5) * 0.28 + Math.PI * 0.04,
    al: Math.random() * 0.4 + 0.08,
    delay: Math.random() * 2500,
    born: 0,
  }));

  let wvAlpha = 0;
  const WV_GRID = 64;
  let WV_CELLS = [];

  function wvDrawGrid(a, elapsed) {
    // grid lines
    const col = dark ? `rgba(200,196,188,${a * 0.07})` : `rgba(28,24,18,${a * 0.07})`;
    wctx.save(); wctx.strokeStyle = col; wctx.lineWidth = 0.35;
    for (let x = 0; x <= wW; x += WV_GRID) { wctx.beginPath(); wctx.moveTo(x,0); wctx.lineTo(x,wH); wctx.stroke(); }
    for (let y = 0; y <= wH; y += WV_GRID) { wctx.beginPath(); wctx.moveTo(0,y); wctx.lineTo(wW,y); wctx.stroke(); }
    // cell flash
    WV_CELLS.forEach(cell => {
      const age = elapsed - cell.delay;
      if (age < 0) return;
      const cycle = (age % 3800) / 3800;
      const flash = cycle < 0.04 ? cycle / 0.04 : cycle < 0.14 ? 1 - (cycle - 0.04) / 0.10 : 0;
      if (flash < 0.01) return;
      const x = cell.col * WV_GRID, y = cell.row * WV_GRID;
      const fa = flash * 0.055 * a;
      wctx.fillStyle = dark ? `rgba(205,200,190,${fa})` : `rgba(28,24,18,${fa})`;
      wctx.fillRect(x, y, WV_GRID, WV_GRID);
      const da = flash * 0.22 * a;
      wctx.fillStyle = dark ? `rgba(205,200,190,${da})` : `rgba(28,24,18,${da})`;
      [[x,y],[x+WV_GRID,y],[x,y+WV_GRID],[x+WV_GRID,y+WV_GRID]].forEach(([cx,cy]) => {
        wctx.beginPath(); wctx.arc(cx, cy, 0.9, 0, Math.PI*2); wctx.fill();
      });
    });
    wctx.restore();
  }

  function wvDrawNodes(t, a) {
    const MAX_D = 180;
    // connections
    wctx.save();
    for (let i = 0; i < WV_NODES.length; i++) {
      for (let j = i+1; j < WV_NODES.length; j++) {
        const dx = WV_NODES[i].x - WV_NODES[j].x, dy = WV_NODES[i].y - WV_NODES[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < MAX_D) {
          const s = (1 - d/MAX_D) * 0.3 * a;
          wctx.strokeStyle = dark ? `rgba(200,196,188,${s})` : `rgba(28,24,18,${s})`;
          wctx.lineWidth = 0.4;
          wctx.beginPath(); wctx.moveTo(WV_NODES[i].x, WV_NODES[i].y); wctx.lineTo(WV_NODES[j].x, WV_NODES[j].y); wctx.stroke();
        }
      }
    }
    wctx.restore();
    // dots
    WV_NODES.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < -10) n.x = wW+10; if (n.x > wW+10) n.x = -10;
      if (n.y < -10) n.y = wH+10; if (n.y > wH+10) n.y = -10;
      const pulse = Math.sin(t * 0.025 + n.phase) * 0.5 + 0.5;
      const fa = pulse * 0.65 * a;
      wctx.save();
      wctx.beginPath(); wctx.arc(n.x, n.y, n.r + pulse * 0.7, 0, Math.PI*2);
      wctx.fillStyle = dark ? `rgba(210,204,194,${fa})` : `rgba(32,28,20,${fa})`;
      wctx.fill(); wctx.restore();
    });
  }

  function wvDrawStreams(elapsed, a) {
    wctx.save();
    WV_STREAMS.forEach(s => {
      if (elapsed < s.delay) return;
      const age = (elapsed - s.delay) * 0.001;
      const dist = (age * s.spd * 75) % (wW + 200);
      const sx = s.x + Math.cos(s.angle) * dist;
      const sy = s.y + Math.sin(s.angle) * dist;
      const ex = sx - Math.cos(s.angle) * s.len;
      const ey = sy - Math.sin(s.angle) * s.len;
      const fa = s.al * a * 0.75;
      const col = dark ? `rgba(200,196,188,` : `rgba(28,24,18,`;
      const g = wctx.createLinearGradient(ex, ey, sx, sy);
      g.addColorStop(0, col+'0)'); g.addColorStop(0.6, col+fa+')'); g.addColorStop(1, col+'0)');
      wctx.strokeStyle = g; wctx.lineWidth = 0.55;
      wctx.beginPath(); wctx.moveTo(ex, ey); wctx.lineTo(sx, sy); wctx.stroke();
      wctx.beginPath(); wctx.arc(sx, sy, 0.9, 0, Math.PI*2);
      wctx.fillStyle = dark ? `rgba(215,210,200,${fa*1.4})` : `rgba(22,18,12,${fa*1.4})`; wctx.fill();
    });
    wctx.restore();
  }

  function startWave() {
    if (waveActive) return;
    waveActive = true;
    resizeWave();
    // build cells now that wW/wH are known and match the canvas
    WV_CELLS = [];
    for (let row = 0; row <= Math.ceil(wH / WV_GRID); row++)
      for (let col = 0; col <= Math.ceil(wW / WV_GRID); col++)
        WV_CELLS.push({ row, col, delay: Math.random() * 3000 });
    WV_STREAMS.forEach(s => { s.born = Date.now(); });
    waveCanvas.classList.add('visible');
    let wvAlpha = 0;
    const wT0 = Date.now();
    function wloop() {
      if (!waveActive) return;
      wvAlpha = Math.min(1, wvAlpha + 0.008);
      wctx.clearRect(0, 0, wW, wH);
      const t = (Date.now() - wT0) / 50;
      const elapsed = Date.now() - wT0;
      wvDrawGrid(wvAlpha, elapsed);
      wvDrawStreams(elapsed, wvAlpha);
      wvDrawNodes(t, wvAlpha);
      waveRAF = requestAnimationFrame(wloop);
    }
    wloop();
  }

  function stopWave() {
    waveActive = false;
    waveCanvas.classList.remove('visible');
    if (waveRAF) { cancelAnimationFrame(waveRAF); waveRAF = null; }
    setTimeout(() => wctx.clearRect(0, 0, wW, wH), 1200);
  }

  /* ━━━ DECK ━━━ */
  const deckEl    = document.getElementById('deck');
  const hintEl    = document.getElementById('hint');
  const cards     = Array.from(deckEl.querySelectorAll('.card'));
  const N         = cards.length;
  let order       = [0, 1];
  let busy        = false;
  let formActive  = false;

  const TILT = 6, SHFT = 8, SC = 0.032;

  function stackTr(d) {
    const sign = d % 2 === 0 ? 1 : -1;
    return `rotateZ(${sign * d * TILT}deg) translateY(${d * SHFT}px) scale(${1 - d * SC})`;
  }
  function sh0() { return dark ? '0 22px 60px rgba(0,0,0,0.72)' : '0 24px 56px rgba(0,0,0,0.32)'; }
  function sh1() { return dark ? '0 5px 16px rgba(0,0,0,0.55)'  : '0 8px 20px rgba(0,0,0,0.2)'; }

  function render(anim) {
    const ease = 'transform 420ms cubic-bezier(0.34,1.2,0.64,1), box-shadow 350ms, border-color 300ms';
    order.forEach((ci, d) => {
      const card = cards[ci], top = d === 0;
      card.style.transition  = anim ? ease : 'none';
      card.style.zIndex      = N - d;
      card.style.transform   = stackTr(d);
      card.style.cursor      = top && !formActive ? 'pointer' : 'default';
      card.classList.toggle('top', top);
      card.style.borderColor = top
        ? (card.dataset.id === '0' ? 'var(--c0b)' : 'var(--c1b)')
        : 'var(--bd)';
      card.style.boxShadow = top ? sh0() : sh1();
    });
  }
  render(false);

  function cycle() {
    if (busy || formActive) return;
    busy = true;
    const bi = order[N - 1], bc = cards[bi];
    bc.style.transition = 'transform 155ms cubic-bezier(0.4,0,1,1)';
    bc.style.zIndex = N + 10;
    bc.style.transform = 'rotateZ(0deg) translateY(-48px) translateX(10px) scale(1.04)';
    setTimeout(() => {
      order = [bi, ...order.slice(0, N - 1)];
      const e2 = 'transform 300ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms, border-color 260ms';
      bc.style.transition  = e2;
      bc.style.transform   = stackTr(0);
      bc.style.borderColor = bc.dataset.id === '0' ? 'var(--c0b)' : 'var(--c1b)';
      bc.style.boxShadow   = sh0();
      bc.classList.add('top');
      order.forEach((ci, d) => {
        if (d === 0) return;
        const c = cards[ci];
        c.style.transition  = e2;
        c.style.zIndex      = N - d;
        c.style.transform   = stackTr(d);
        c.style.borderColor = 'var(--bd)';
        c.style.boxShadow   = sh1();
        c.classList.remove('top');
      });
      setTimeout(() => { busy = false; }, 310);
    }, 165);
  }

  function openForm(card) {
    formActive = true;
    hintEl.classList.add('gone');
    card.classList.add('open');
    card.style.transition = 'transform 450ms cubic-bezier(0.34,1.2,0.64,1), box-shadow 360ms';
    card.style.transform  = 'rotateZ(0deg) translateY(-10px) scale(1.015)';
    card.style.boxShadow  = sh0();
    setTimeout(() => { const i = card.querySelector('input'); if (i) i.focus(); }, 460);
  }

  function closeForm(card) {
    formActive = false;
    card.classList.remove('open');
    card.querySelectorAll('input').forEach(i => i.value = '');
    hintEl.classList.remove('gone');
    render(true);
  }

  deckEl.addEventListener('click', e => {
    if (e.target.classList.contains('btn-back')) {
      e.stopPropagation(); closeForm(e.target.closest('.card')); return;
    }
    const card = e.target.closest('.card'); if (!card) return;
    const d = order.indexOf(parseInt(card.dataset.id));
    if (d === 0) { if (!formActive) openForm(card); } else cycle();
  });

  /* ━━━ ENTER / EXIT ━━━ */
  const enterBtn = document.getElementById('enterBtn');
  const overlay  = document.getElementById('overlay');
  const exitBtn  = document.getElementById('exitBtn');
  let timer = null;

  // If returning from landing: snap stars to expanded position before first frame
  if (new URLSearchParams(location.search).get('leave') === '1') {
    bExp = true;
    STARS.forEach(s => { s.y = s.ep; s.py = s.ep; });
    enterBtn.classList.add('hidden');
  }

  window.__triggerLeave = function() {
    // Set full post-enter state: overlay visible, wave running, aiPhase=2
    overlay.style.transition = 'none';
    overlay.classList.add('show');
    requestAnimationFrame(() => {
      overlay.style.transition = '';
      // start wave so stopWave() has something to stop
      startWave();
      aiAlpha = 1; aiPhase = 2;
      // now fire the real exitBtn click — plays full leave animation
      exitBtn.click();
    });
  };

  enterBtn.addEventListener('mouseover', () => { if (!bExp) bCol = true; });
  enterBtn.addEventListener('mouseout',  () => { if (!bExp) bCol = false; });

  enterBtn.addEventListener('click', () => {
    bCol = false; bExp = true;
    enterBtn.classList.add('hidden');

    // Trigger AI animation immediately on click
    aiPhase = 1;

    timer = setTimeout(() => {
      overlay.classList.add('show');
      startWave();
    }, 2400);
  });

  exitBtn.addEventListener('click', () => {
    overlay.classList.remove('show');
    stopWave();
    clearTimeout(timer);

    // Fade out AI animation
    aiPhase = 3;

    setTimeout(() => {
      cards.forEach(c => closeForm(c));
      order = [0, 1]; render(false);
      hintEl.classList.remove('gone'); formActive = false;
    }, 500);
    bExp = false; bRet = true;
    setTimeout(() => { bRet = false; enterBtn.classList.remove('hidden'); }, 5000);
  });

})();

// ── Page Transition ──
  const veil = document.getElementById('pageVeil');

  function navigateTo(url) {
    veil.classList.add('in');
    setTimeout(() => { window.location.href = url; }, 430);
  }

  // fade in on load
  veil.classList.add('in');
  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('in')));

  // simple navigation demo: on "continue" or "create" go to landing page
  document.querySelectorAll('.btn-go').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('landing.html');
    });
  });

  // ── Auto-trigger leave animation if coming back from landing ──
  if (new URLSearchParams(location.search).get('leave') === '1') {
    history.replaceState(null, '', location.pathname);

    // Skip veil fade-in — show blackhole immediately
    veil.style.transition = 'none';
    veil.style.opacity = '0';

    window.addEventListener('load', () => {
      setTimeout(() => {
        window.__triggerLeave && window.__triggerLeave();
      }, 150);
    });
  }