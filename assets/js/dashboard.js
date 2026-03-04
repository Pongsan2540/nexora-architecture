/* dashboard.js — Page-specific logic */
/* Shared utilities: ../js/glassui.js */

(function(){
  const veil = document.getElementById('pageVeil');
  function navigateTo(url){ veil.classList.add('in'); setTimeout(()=>location.href=url,430); }
  window.navigateTo = navigateTo;
  veil.classList.add('in');
  requestAnimationFrame(()=>requestAnimationFrame(()=>veil.classList.remove('in')));

  const root = document.documentElement;
  let dark = root.getAttribute('data-theme') !== 'light';

  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = root.getAttribute('data-theme') || 'dark';
    dark = cur === 'dark' ? false : true;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  });

  // ── Grid Background Animation (exact copy from landing.html) ──
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const T0 = Date.now();
  const GRID_SIZE = 64;
  let W, H, GCOLS, GROWS, CELLS;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    GCOLS = Math.ceil(W / GRID_SIZE) + 1;
    GROWS = Math.ceil(H / GRID_SIZE) + 1;
    CELLS = [];
    for (let row = 0; row < GROWS; row++)
      for (let col = 0; col < GCOLS; col++)
        CELLS.push({ row, col, delay: Math.random() * 3000 });
  }
  resize();
  window.addEventListener('resize', resize);

  function drawGridLines() {
    const a = dark ? 0.045 : 0.06;
    ctx.save();
    ctx.strokeStyle = dark ? `rgba(200,196,188,${a})` : `rgba(30,28,22,${a})`;
    ctx.lineWidth = 0.4;
    for (let x = 0; x <= W; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawGridCells() {
    const now = Date.now() - T0;
    ctx.save();
    CELLS.forEach(cell => {
      const age = now - cell.delay;
      if (age < 0) return;
      const cycle = (age % 4200) / 4200;
      const flash = cycle < 0.05
        ? cycle / 0.05
        : cycle < 0.18
          ? 1 - (cycle - 0.05) / 0.13
          : 0;
      if (flash < 0.01) return;
      const x = cell.col * GRID_SIZE;
      const y = cell.row * GRID_SIZE;
      ctx.fillStyle = dark
        ? `rgba(210,205,195,${flash * 0.025})`
        : `rgba(30,28,24,${flash * 0.02})`;
      ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
      const da = flash * 0.12;
      ctx.fillStyle = dark
        ? `rgba(210,205,195,${da})`
        : `rgba(30,28,24,${da})`;
      [[x, y],[x + GRID_SIZE, y],[x, y + GRID_SIZE],[x + GRID_SIZE, y + GRID_SIZE]].forEach(([cx, cy]) => {
        ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, Math.PI * 2); ctx.fill();
      });
    });
    ctx.restore();
  }

  (function loop() {
    ctx.clearRect(0, 0, W, H);
    drawGridLines();
    drawGridCells();
    requestAnimationFrame(loop);
  })();

  // tab
  window.switchTab = function(el){
    el.closest('.ch-tabs').querySelectorAll('.ctab').forEach(t=>t.classList.remove('on'));
    el.classList.add('on');
  };

  // chart tooltip
  const svg = document.getElementById('cSvg');
  const tip = document.getElementById('ctip');
  document.querySelectorAll('.cd').forEach(dot => {
    dot.addEventListener('mouseenter', () => {
      const rect = svg.getBoundingClientRect();
      const cx = parseFloat(dot.getAttribute('cx'));
      const cy = parseFloat(dot.getAttribute('cy'));
      tip.textContent = dot.getAttribute('data-v') + ' visitors';
      tip.style.left = ((cx / 580) * rect.width) + 'px';
      tip.style.top  = ((cy / 200) * rect.height - 40) + 'px';
      tip.style.opacity = '1';
    });
    dot.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
  });
})();