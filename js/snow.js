/* Seasonal snowfall */
(() => {
  const forced = /[?&]snow(=1|=true|&|$)/.test(location.search);
  if (new Date().getMonth() !== 11 && !forced) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.className = 'snow';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');

  const MARGIN_SHARE = 0.8;      /* ratio of flakes that start inside the margins */
  const MAX_FLAKES = 75, MIN_FLAKES = 25, PX_PER_FLAKE = 18;
  const RMIN = 0.9, RMAX = 2.6;  /* flake radius */
  const BUCKETS = 8;             /* number of pre-rendered flake sizes */
  const DEPTH_MIN = 0.35;        /* scroll-follow factor of the smallest flake (largest = 1) */
  const IDLE_FRAME_MS = 30;      /* ~30 fps while the page is not scrolling */
  const SCROLL_IDLE_MS = 250;    /* full frame rate for this long after a scroll */
  const PAD = 12;                /* off-screen margin used when wrapping */
  const MAX_DPR = 1.5;

  let W = 0, H = 0, dpr = 1, left = 0, right = 0;
  let flakes = [], sprites = [];
  let sy = window.scrollY, appliedSy = sy, lastScroll = -1e9;

  const rnd = (a, b) => a + Math.random() * (b - a);

  /* pre-rendered snowflake */
  function buildSprites() {
    const light = document.documentElement.dataset.theme === 'light';
    const col = light ? 'rgb(120,150,185)' : 'rgb(255,255,255)';
    sprites = [];
    for (let k = 0; k < BUCKETS; k++) {
      const r = RMIN + (k + 0.5) * (RMAX - RMIN) / BUCKETS;
      const crystal = r >= 1.5;
      const R = crystal ? r * 3.2 : r;
      const size = Math.ceil(R * 2 + 4);
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(size * dpr);
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.translate(size / 2, size / 2);
      g.strokeStyle = g.fillStyle = col;
      if (crystal) {
        g.lineWidth = Math.max(0.7, R * 0.11);
        g.lineCap = 'round';
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          g.save();
          g.rotate(i * Math.PI / 3);
          g.moveTo(0, 0); g.lineTo(R, 0);
          const bx = R * 0.58, bl = R * 0.34;
          g.moveTo(bx, 0); g.lineTo(bx + bl * 0.6, bl * 0.8);
          g.moveTo(bx, 0); g.lineTo(bx + bl * 0.6, -bl * 0.8);
          g.restore();
        }
        g.stroke();
      } else {
        g.beginPath();
        g.arc(0, 0, R, 0, 6.2832);
        g.fill();
      }
      sprites.push({ c, size, half: size / 2, crystal });
    }
  }

  /* layout */
  function bounds() {
    const m = document.querySelector('main');
    const r = m ? m.getBoundingClientRect() : null;
    left = r ? Math.max(0, r.left) : 0;
    right = r ? Math.min(W, r.right) : W;
  }
  function pickX() {
    const lw = left, rw = W - right;
    if (lw + rw > 24 && Math.random() < MARGIN_SHARE) {
      const t = Math.random() * (lw + rw);
      return t < lw ? t : right + (t - lw);
    }
    return rnd(0, W);
  }
  function make(y) {
    const r = rnd(RMIN, RMAX);
    const k = Math.min(BUCKETS - 1, ((r - RMIN) / (RMAX - RMIN) * BUCKETS) | 0);
    return {
      x: pickX(), y: y !== undefined ? y : rnd(-PAD, -2), r, k,
      vy: 14 + r * 11 + rnd(0, 10),                       /* bigger flakes fall faster */
      depth: DEPTH_MIN + (1 - DEPTH_MIN) * (r - RMIN) / (RMAX - RMIN), /* bigger flakes follow scroll more */
      sway: rnd(6, 22), freq: rnd(0.4, 1.1), ph: rnd(0, 6.28),
      a: rnd(0.25, 0.65),
      rot: rnd(0, 6.28), spin: rnd(-0.6, 0.6)
    };
  }
  function resize() {
    const newDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * newDpr); cv.height = Math.round(H * newDpr);
    if (newDpr !== dpr || !sprites.length) { dpr = newDpr; buildSprites(); }
    bounds();
    const n = Math.round(Math.min(MAX_FLAKES, Math.max(MIN_FLAKES, W / PX_PER_FLAKE)));
    while (flakes.length < n) flakes.push(make(rnd(0, H)));
    flakes.length = n;
  }

  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });
  addEventListener('scroll', () => { sy = window.scrollY; lastScroll = performance.now(); }, { passive: true });
  const main = document.querySelector('main');
  if (main && window.ResizeObserver) new ResizeObserver(bounds).observe(main);
  else addEventListener('load', bounds);
  new MutationObserver(buildSprites).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();

  /* animation loop */
  let last = performance.now(), raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    /* throttle to 30 fps unless the page is being scrolled */
    if (now - lastScroll > SCROLL_IDLE_MS && now - last < IDLE_FRAME_MS) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const ds = sy - appliedSy; appliedSy = sy;           /* scroll distance since the last drawn frame */
    const span = H + PAD * 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);

    for (const f of flakes) {
      /* move up/down with the page */
      f.y += f.vy * dt - ds * f.depth;
      f.ph += f.freq * dt;
      if (f.y > H + PAD || f.y < -PAD) {
        f.y = ((f.y + PAD) % span + span) % span - PAD;
        f.x = pickX();
      }
      const x = f.x + Math.sin(f.ph) * f.sway;
      const s = sprites[f.k];
      ctx.globalAlpha = (x > left + 4 && x < right - 4) ? f.a * 0.6 : f.a;
      if (s.crystal) {
        f.rot += f.spin * dt;
        const c = Math.cos(f.rot) * dpr, n = Math.sin(f.rot) * dpr;
        ctx.setTransform(c, n, -n, c, x * dpr, f.y * dpr);
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, x * dpr, f.y * dpr);
      }
      ctx.drawImage(s.c, -s.half, -s.half, s.size, s.size);
    }
  }
  raf = requestAnimationFrame(frame);

  /* stop while tab is hidden */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now(); appliedSy = sy = window.scrollY; raf = requestAnimationFrame(frame); }
  });
})();