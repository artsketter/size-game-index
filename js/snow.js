/* Seasonal snowfall. Runs only in December (or with ?snow in the address for previewing). */
(() => {
  const forced = /[?&]snow(=1|=true|&|$)/.test(location.search);
  if (new Date().getMonth() !== 11 && !forced) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.className = 'snow';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');

  const MARGIN_SHARE = 0.8;      /* share of flakes that start in the margins */
  let W = 0, H = 0, dpr = 1, left = 0, right = 0, flakes = [];

  const rnd = (a, b) => a + Math.random() * (b - a);

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
    const r = rnd(0.9, 2.6);
    return {
      x: pickX(), y: y !== undefined ? y : rnd(-20, -2), r,
      vy: 14 + r * 11 + rnd(0, 10), /* bigger flakes fall faster */
      sway: rnd(6, 22), freq: rnd(0.4, 1.1), ph: rnd(0, 6.28),
      a: rnd(0.25, 0.65),
      rot: rnd(0, 6.28), spin: rnd(-0.6, 0.6)
    };
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bounds();
    const n = Math.round(Math.min(110, Math.max(35, W / 14)));
    while (flakes.length < n) flakes.push(make(rnd(0, H)));
    flakes.length = n;
  }
  addEventListener('resize', resize);
  addEventListener('load', bounds);
  setTimeout(bounds, 1500);
  resize();

  function crystal(x, y, R, rot, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.7, R * 0.11);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.moveTo(0, 0); ctx.lineTo(R, 0);
      const bx = R * 0.58, bl = R * 0.34;
      ctx.moveTo(bx, 0); ctx.lineTo(bx + bl * 0.6, bl * 0.8);
      ctx.moveTo(bx, 0); ctx.lineTo(bx + bl * 0.6, -bl * 0.8);
      ctx.restore();
    }
    ctx.stroke();
    ctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const light = document.documentElement.dataset.theme === 'light';
    const rgb = light ? '120,150,185' : '255,255,255';
    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.vy * dt;
      f.ph += f.freq * dt;
      const x = f.x + Math.sin(f.ph) * f.sway;
      if (f.y > H + 6) { Object.assign(f, make()); continue; }
      const over = x > left + 4 && x < right - 4;
      const col = `rgba(${rgb},${over ? f.a * 0.6 : f.a})`;
      if (f.r < 1.5) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, 6.2832);
        ctx.fill();
        continue;
      }
      f.rot += f.spin * dt;
      crystal(x, f.y, f.r * 3.2, f.rot, col);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();