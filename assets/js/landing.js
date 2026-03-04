/* landing.js — Page-specific logic */
/* Shared utilities: ../js/glassui.js */

// ── Page Transition ──
    const veil = document.getElementById('pageVeil');

    function navigateTo(url) {
      veil.classList.add('in');
      setTimeout(() => { window.location.href = url; }, 430);
    }

    function navigateBack() {
      veil.classList.add('in');
      setTimeout(() => { window.location.href = 'blackhole-login.html?leave=1'; }, 430);
    }

    // fade in on load
    veil.classList.add('in');
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('in')));

    const root = document.documentElement;
    let dark = root.getAttribute('data-theme') !== 'light';

    // theme toggle
    document.getElementById('themeBtn').addEventListener('click', () => {
      const cur = root.getAttribute('data-theme') || 'dark';
      dark = cur === 'dark' ? false : true;
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
    });

    // ── Grid Background Animation ──
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
    // ── 3D Carousel ──
    const stage    = document.getElementById('carouselStage');
    const cards    = Array.from(stage.querySelectorAll('.c-card'));
    const dotsEl   = Array.from(document.querySelectorAll('.feat-dot'));
    const N        = cards.length;
    let current    = 0;
    let busy       = false;

    // layout config
    const CARD_W   = 340;
    const POSITIONS = [
      // offset-x,  scale, rotateY, opacity, z
      { x: -680, s: 0.62, ry: 28,  o: 0.25, z: 0 },   // far left
      { x: -380, s: 0.78, ry: 18,  o: 0.55, z: 1 },   // left
      { x: 0,    s: 1.00, ry: 0,   o: 1.00, z: 3 },   // center (active)
      { x:  380, s: 0.78, ry: -18, o: 0.55, z: 1 },   // right
      { x:  680, s: 0.62, ry: -28, o: 0.25, z: 0 },   // far right
    ];

    function applyLayout(animate) {
      cards.forEach((card, i) => {
        // distance from current, wrap-around
        let d = i - current;
        if (d >  N/2) d -= N;
        if (d < -N/2) d += N;

        const posIdx = d + 2; // map -2..+2 → 0..4
        const hidden = posIdx < 0 || posIdx > 4;

        card.style.transition = animate
          ? 'transform 550ms cubic-bezier(0.22,1,0.36,1), opacity 550ms cubic-bezier(0.22,1,0.36,1), box-shadow 400ms'
          : 'none';

        if (hidden) {
          card.style.opacity = '0';
          card.style.pointerEvents = 'none';
          card.style.zIndex = '0';
          return;
        }

        const p = POSITIONS[posIdx];
        const isCenter = posIdx === 2;
        card.style.transform = `translate(-50%, -50%) translateX(${p.x}px) scale(${p.s}) perspective(1000px) rotateY(${p.ry}deg)`;
        card.style.opacity       = p.o;
        card.style.zIndex        = p.z;
        card.style.pointerEvents = isCenter ? 'all' : 'auto';
        card.style.boxShadow     = isCenter
          ? '0 32px 80px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.06) inset'
          : '0 12px 40px rgba(0,0,0,.4)';
        card.classList.toggle('c-active', isCenter);
      });

      dotsEl.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    applyLayout(false);

    function goTo(next) {
      if (busy) return;
      busy = true;
      current = ((next % N) + N) % N;
      applyLayout(true);
      setTimeout(() => busy = false, 560);
    }

    // click side cards to focus them
    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        if (i !== current) goTo(i);
      });
    });

    document.getElementById('featNext').addEventListener('click', () => goTo(current + 1));
    document.getElementById('featPrev').addEventListener('click', () => goTo(current - 1));
    dotsEl.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

    // drag / swipe
    let dragStart = null;
    stage.addEventListener('pointerdown', e => { dragStart = e.clientX; });
    stage.addEventListener('pointerup',   e => {
      if (dragStart === null) return;
      const dx = e.clientX - dragStart;
      dragStart = null;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? current + 1 : current - 1);
    });