/**
 * glassui.js — Glass UI Shared Utilities
 *
 * Provides:
 *   - Page transitions  → GlassUI.nav
 *   - Theme toggle      → GlassUI.theme
 *   - Grid background   → GlassUI.grid
 *   - Ripple effect     → GlassUI.grid.ripple()
 *
 * Usage in every page:
 *   <script src="../js/glassui.js"></script>
 *   <script>
 *     GlassUI.nav.init();
 *     GlassUI.theme.init('themeBtn');
 *     GlassUI.grid.init('bgCanvas');
 *   </script>
 */

const GlassUI = (() => {

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE NAVIGATION + TRANSITIONS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const nav = {
    _veil: null,

    init() {
      this._veil = document.getElementById('pageVeil');
      // fade in on load
      this._veil.classList.add('in');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => this._veil.classList.remove('in'))
      );
    },

    /** Navigate to a URL with fade transition */
    go(url) {
      this._veil.classList.add('in');
      setTimeout(() => { window.location.href = url; }, 430);
    },

    /** Go back with fade (default: blackhole-login.html) */
    back(url = 'blackhole-login.html') {
      this._veil.classList.add('in');
      setTimeout(() => { window.location.href = url; }, 430);
    },
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     THEME TOGGLE
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const theme = {
    dark: true,

    init(btnId = 'themeBtn') {
      const root = document.documentElement;
      this.dark = root.getAttribute('data-theme') !== 'light';

      const btn = document.getElementById(btnId);
      if (!btn) return;

      btn.addEventListener('click', () => {
        this.dark = !this.dark;
        root.setAttribute('data-theme', this.dark ? 'dark' : 'light');
        // notify subscribers
        this._callbacks.forEach(cb => cb(this.dark));
      });
    },

    _callbacks: [],

    /** Subscribe to theme changes: theme.onChange(dark => ...) */
    onChange(cb) { this._callbacks.push(cb); },
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ANIMATED GRID BACKGROUND
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const grid = {
    _ctx: null,
    _cells: [],
    _W: 0, _H: 0,
    _intensity: 1,   // multiplier — raise via ripple()
    _T0: Date.now(),
    _GS: 64,         // grid cell size in px
    _DPR: Math.min(window.devicePixelRatio || 1, 2),

    init(canvasId = 'bgCanvas') {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      this._ctx = canvas.getContext('2d');
      this._resize(canvas);
      window.addEventListener('resize', () => this._resize(canvas));

      // re-draw when theme changes
      theme.onChange(() => {});   // already reads theme.dark at render time

      this._loop();
    },

    _resize(canvas) {
      this._W = window.innerWidth;
      this._H = window.innerHeight;
      canvas.width  = this._W * this._DPR;
      canvas.height = this._H * this._DPR;
      this._ctx.setTransform(this._DPR, 0, 0, this._DPR, 0, 0);

      const cols = Math.ceil(this._W / this._GS) + 1;
      const rows = Math.ceil(this._H / this._GS) + 1;
      this._cells = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          this._cells.push({ row: r, col: c, delay: Math.random() * 3000, boost: 0 });
    },

    _loop() {
      const { _ctx: ctx, _W: W, _H: H, _GS: GS, _T0: T0 } = this;
      const dark = theme.dark;

      ctx.clearRect(0, 0, W, H);

      // grid lines
      const lineA = (dark ? 0.045 : 0.06) * this._intensity;
      ctx.save();
      ctx.strokeStyle = dark ? `rgba(200,196,188,${lineA})` : `rgba(30,28,22,${lineA})`;
      ctx.lineWidth = 0.4;
      for (let x = 0; x <= W; x += GS) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += GS) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      // flashing cells
      const now = Date.now() - T0;
      ctx.save();
      this._cells.forEach(cell => {
        const age = now - cell.delay;
        if (age < 0) return;
        const cycle = (age % 4200) / 4200;
        let flash = cycle < 0.05
          ? cycle / 0.05
          : cycle < 0.18
            ? 1 - (cycle - 0.05) / 0.13
            : 0;
        if (cell.boost > 0) { flash = Math.max(flash, cell.boost); cell.boost *= 0.96; }
        flash *= this._intensity;
        if (flash < 0.01) return;

        const x = cell.col * GS, y = cell.row * GS;
        ctx.fillStyle = dark ? `rgba(210,205,195,${flash * 0.025})` : `rgba(30,28,24,${flash * 0.02})`;
        ctx.fillRect(x, y, GS, GS);

        const da = flash * 0.12;
        ctx.fillStyle = dark ? `rgba(210,205,195,${da})` : `rgba(30,28,24,${da})`;
        [[x, y], [x + GS, y], [x, y + GS], [x + GS, y + GS]].forEach(([cx, cy]) => {
          ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, Math.PI * 2); ctx.fill();
        });
      });
      ctx.restore();

      requestAnimationFrame(() => this._loop());
    },

    /**
     * Trigger a ripple burst from a screen coordinate.
     * @param {number} ox - origin X in px
     * @param {number} oy - origin Y in px
     */
    ripple(ox, oy) {
      this._intensity = 3;
      setTimeout(() => this._intensity = 2.2, 300);
      setTimeout(() => this._intensity = 1.6, 750);
      setTimeout(() => this._intensity = 1.0, 1600);

      this._cells.forEach(cell => {
        const dist = Math.hypot(cell.col * this._GS - ox, cell.row * this._GS - oy);
        setTimeout(() => {
          cell.boost = Math.max(0, 1 - dist / 580) * 1.1;
        }, dist * 0.55);
      });
    },
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     HELPERS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const utils = {
    /** ms delay as promise */
    delay: ms => new Promise(r => setTimeout(r, ms)),

    /** Format Date as HH:MM (Thai locale) */
    timeStr: (d = new Date()) =>
      d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),

    /** Stream plain text into an element char-by-char */
    async streamText(html, target, msPerChunk = 13, chunkSize = 4) {
      const plain = html.replace(/<[^>]+>/g, '');
      const cur = document.createElement('span');
      cur.style.cssText = 'display:inline-block;width:2px;height:.92em;background:var(--c0a);vertical-align:text-bottom;margin-left:1px;animation:blink .65s step-end infinite;';
      target.appendChild(cur);
      let i = 0;
      while (i < plain.length) {
        cur.insertAdjacentText('beforebegin', plain.slice(i, i + chunkSize));
        i += chunkSize;
        await this.delay(msPerChunk);
      }
      target.innerHTML = html;  // swap in rich HTML at end
    },
  };

  return { nav, theme, grid, utils };
})();
