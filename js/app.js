/* Static gallery. Works on index.html and game.html. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Text with links. [label](https://…) and bare https://… addresses become links */
const rich = t => esc(t).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<)]+)/g, (m, label, url, bare) => {
  if (url) return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  const clean = bare.replace(/[.,;:!?]+$/, '');   /* keep trailing punctuation outside the link */
  return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${bare.slice(clean.length)}`;
});
const plain = t => (t || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const loadingHTML = t => `<div class="loading" role="status" aria-live="polite"><span class="spinner"></span><span class="ltext">${t}</span></div>`;
const list = v => (v || '').split('|').map(s => s.trim()).filter(Boolean);

/* Map language name to flagcdn country code. */
const FLAGS = { english:'gb', en:'gb', japanese:'jp', ja:'jp', chinese:'cn', zh:'cn', 'simplified chinese':'cn', 'traditional chinese':'tw',
  spanish:'es', es:'es', french:'fr', fr:'fr', german:'de', de:'de', italian:'it', it:'it', portuguese:'pt', pt:'pt', 'brazilian portuguese':'br',
  russian:'ru', ru:'ru', korean:'kr', ko:'kr', dutch:'nl', nl:'nl', polish:'pl', pl:'pl', turkish:'tr', tr:'tr', arabic:'sa', ar:'sa',
  ukrainian:'ua', uk:'ua', swedish:'se', sv:'se', norwegian:'no', danish:'dk', finnish:'fi', czech:'cz', hungarian:'hu', greek:'gr',
  romanian:'ro', hebrew:'il', vietnamese:'vn', thai:'th', indonesian:'id', hindi:'in' };
const flags = v => `<span class="flags">${list(v).map(l => {
  const code = FLAGS[l.toLowerCase().replace(/\s*\(.*\)\s*$/, '')] || FLAGS[l.toLowerCase()];
  return code ? `<img src="https://flagcdn.com/w40/${code}.png" width="20" height="15" alt="${esc(l)}" title="${esc(l)}" loading="lazy">` : `<span class="chip">${esc(l)}</span>`;
}).join('')}</span>`;
const yes = v => /^(1|true|yes|x)$/i.test((v || '').trim());
const num = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
let WEIGHTS = [];
const sameVal = (a, b) => a.toLowerCase() === b.toLowerCase() || (a !== '' && b !== '' && isFinite(a) && isFinite(b) && +a === +b);
const score = g => {
  if (g._sc !== undefined) return g._sc;
  let total = 0;
  for (const w of WEIGHTS) {
    const vals = w.field === 'contains_ai' ? [yes(g.contains_ai) ? 'yes' : 'no'] : list(g[w.field]);
    if (vals.some(v => sameVal(v, w.value))) total += w.weight;
  }
  return g._sc = total;
};

/* Cookies */
const ck = {
  get(n, d) {
    try { const v = localStorage.getItem('gs:' + n); if (v !== null) return JSON.parse(v); } catch {}
    const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    if (m) {
      try {
        const val = JSON.parse(decodeURIComponent(m[1]));
        ck.set(n, val);
        document.cookie = n + '=;max-age=0;path=/';
        return val;
      } catch {}
    }
    return d;
  },
  set(n, v) { try { localStorage.setItem('gs:' + n, JSON.stringify(v)); } catch {} }
};

/* GitHub source */
const CFG = Object.assign({ owner: '', repo: '', branch: 'main', path: 'games' , submitForm: ''}, window.GAME_REPO);
const base = CFG.path ? CFG.path.replace(/^\/+|\/+$/g, '') + '/' : '';
const gameUrl = (id, f) => encodeURI(`https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/${base}${id}/${f}`);
const blobUrl = (id, f) => encodeURI(`https://github.com/${CFG.owner}/${CFG.repo}/blob/${CFG.branch}/${base}${id}/${f}`);

/* One GitHub API call lists every game folder and its files; cached for 10 minutes per tab. */
async function repoFiles() {
  if (!CFG.owner || !CFG.repo) throw new Error('Set your GitHub repository in js/config.js.');
  const key = 'gs-tree:' + CFG.owner + '/' + CFG.repo + '@' + CFG.branch;
  try { const o = JSON.parse(sessionStorage.getItem(key)); if (o && Date.now() - o.t < 6e5) return o.d; } catch {}
  const res = await fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/git/trees/${encodeURIComponent(CFG.branch)}?recursive=1`);
  if (!res.ok) throw new Error(res.status === 403 ? 'GitHub’s request limit was reached. Try again in a few minutes.' : `Could not read the repository (error ${res.status}). Check js/config.js and that the repository is public.`);
  const d = {};
  (await res.json()).tree.forEach(n => {
    if (n.type !== 'blob' || !n.path.startsWith(base)) return;
    const p = n.path.slice(base.length).split('/');
    if (p.length === 2) (d[p[0]] = d[p[0]] || []).push(p[1]);
  });
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch {}
  return d;
}
/* CSV: two columns per row -> field,value (quoted values may contain commas/newlines) */
function parseCSV(t) {
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); rows.push(r); r = []; f = ''; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}

const withFiles = g => { const f = g.files || []; delete g.files; Object.defineProperty(g, '_files', { value: f }); return g; };
async function loadIndex() {
  const key = 'gs-index:' + CFG.owner + '/' + CFG.repo + '@' + CFG.branch;
  try { const o = JSON.parse(sessionStorage.getItem(key)); if (o && Date.now() - o.t < 6e5) return o.d.map(withFiles); } catch {}
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/${base}index.json`);
    if (!res.ok) return null;
    const d = await res.json();
    if (!Array.isArray(d)) return null;
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch {}
    return d.map(withFiles);
  } catch { return null; }
}

async function loadAllGames(onProgress) {
  const idx = await loadIndex();
  if (idx) return idx;
  const files = await repoFiles(), ids = Object.keys(files); let n = 0;
  return (await Promise.all(ids.map(async id => {
    const g = await loadGame(id, files[id]);
    if (onProgress) onProgress(++n, ids.length);
    return g;
  }))).filter(Boolean);
}
/* One game: from the index; if it is not there yet (index still rebuilding), read its own CSV */
async function loadOneGame(id) {
  const idx = await loadIndex();
  const hit = idx && idx.find(g => g.id === id);
  if (hit) return hit;
  const files = await repoFiles();
  return loadGame(id, files[id]);
}

async function loadGame(id, files) {
  if (!files || !files.includes('game.csv')) return null;
  try {
    const res = await fetch(gameUrl(id, 'game.csv')); if (!res.ok) return null;
    const g = { id };
    Object.defineProperty(g, '_files', { value: files });
    parseCSV((await res.text()).replace(/^\uFEFF/, '')).forEach(r => { if (r[0] && r[0].trim()) g[r[0].trim().toLowerCase()] = (r[1] || '').trim(); });
    return g;
  } catch { return null; }
}
function thumbs(g, onlyFirst) {
  const names = g.thumbnails ? list(g.thumbnails) : g._files.filter(n => /^thumb[1-5]\.(jpe?g|png|webp|gif|svg)$/i.test(n)).sort();
  return names.slice(0, onlyFirst ? 1 : 5).map(n => gameUrl(g.id, n));
}
const bar = n => `<span class="chain" role="img" aria-label="${n} of 5">${[1,2,3,4,5].map(i => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</span>`;
const ring = n => {
  const C = 2 * Math.PI * 14, seg = C / 3;
  return `<svg class="ring" width="34" height="34" viewBox="0 0 34 34" role="img" aria-label="${n} of 3">${[0,1,2].map(i =>
    `<circle class="${i < n ? 'f' : ''}" cx="17" cy="17" r="14" stroke-dasharray="${seg - 5} ${C - seg + 5}" stroke-dashoffset="${-i * seg}" transform="rotate(-90 17 17)"/>`).join('')}</svg>`;
};
const ratings = g => `<div class="rate">
  <span>Art ${bar(num(g.art_rating, 5))}</span><span>Mechanics ${bar(num(g.mechanic_rating, 5))}</span>
  <span>Animation ${bar(num(g.animation_rating, 5))}</span><span>Size focus ${ring(num(g.size_focus, 3))}</span></div>`;
const chips = a => `<div class="chips">${a.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>`;
const played = () => ck.get('played', []);
const favorites = () => ck.get('favorites', []);
const when = v => Date.parse(v) || 0;
const isUpdated = (g, seen) => !!seen && seen[g.id] !== undefined && when(g.last_updated) > when(seen[g.id]);
const resetUpdatedPlayed = (games, seen) => {
  if (!seen) return;
  const stale = new Set(games.filter(g => isUpdated(g, seen)).map(g => g.id));
  const before = played(), kept = before.filter(id => !stale.has(id));
  if (kept.length !== before.length) ck.set('played', kept);
};

/* HOME */
async function home() {
  const gal = $('#gallery');
  gal.innerHTML = loadingHTML('Loading games...');
  const label = $('.ltext', gal);
  const weightsReady = loadScoreWeights();
  let games;
  try { games = await loadAllGames((n, total) => { if (label) label.textContent = `Loading games... ${n}/${total}`; }); }
  catch (e) { gal.innerHTML = ''; $('#empty').textContent = e.message; $('#empty').hidden = false; return; }
  await weightsReady;
  let savedBadges = null;
  if ((performance.getEntriesByType('navigation')[0] || {}).type === 'back_forward') { try { savedBadges = JSON.parse(sessionStorage.getItem('gs-badges')); } catch {} }
  const badges = Object.assign({}, savedBadges);
  const pending = new Set(ck.get('pending', []));   /* played games that were updated: their badge stays until the game's page is visited */
  if (!savedBadges) {
    const seen = ck.get('seen', null);   /* first visit ever: no badges */
    if (seen) {
      const wasPlayed = new Set(played());
      games.forEach(g => {
        if (seen[g.id] === undefined) badges[g.id] = 'game';
        else if (isUpdated(g, seen)) { if (wasPlayed.has(g.id)) pending.add(g.id); else badges[g.id] = 'update'; }
      });
      resetUpdatedPlayed(games, seen);
      ck.set('pending', [...pending]);
    }
    const next = Object.assign({}, seen);
    games.forEach(g => next[g.id] = g.last_updated || '');
    ck.set('seen', next);
    ck.set('lastVisit', Date.now());
    try { sessionStorage.setItem('gs-badges', JSON.stringify(badges)); } catch {}
  }
  games.forEach(g => { if (pending.has(g.id)) badges[g.id] = 'update'; });
  const covers = {};
  games.forEach(g => covers[g.id] = thumbs(g, true)[0]);
  const SECTIONS = [  /* filter sections; any:true = a game matches if it has ANY required value */
    { key: 'size_types', label: 'Size Category', field: 'size_category', any: false },
    { key: 'tags', label: 'Tags', field: 'tags', any: false },
    { key: 'interactions', label: 'Interactions', field: 'interactions', any: false },
    { key: 'art_style', label: 'Art Style', field: 'main_art_style', any: false },
    { key: 'pricing', label: 'Pricing model', field: 'pricing_model', any: true },
    { key: 'languages', label: 'Languages', field: 'languages', any: true }
  ];
  games.forEach(g => {
    g._hay = Object.values(g).join(' ').toLowerCase();
    g._size_category = list(g.size_category);
    g._tags = list(g.tags);
    g._v = {}; SECTIONS.forEach(x => g._v[x.key] = list(g[x.field]));   /* exact, case-sensitive values */
  });

  const dt = v => Date.parse(v) || 0;
  const SORTS = {
    'Latest content updates': (a, b) => dt(b.last_updated) - dt(a.last_updated),
    'Newest release': (a, b) => dt(b.release_date) - dt(a.release_date),
    'Newest added': (a, b) => dt(b.creation_time) - dt(a.creation_time),
    'Great art': (a, b) => num(b.art_rating, 5) - num(a.art_rating, 5),
    'Great mechanics': (a, b) => num(b.mechanic_rating, 5) - num(a.mechanic_rating, 5),
    'A–Z': (a, b) => (a.title || '').localeCompare(b.title || ''),
    'Recommended': (a, b) => score(b) - score(a)
  };

  /* Extra info shown on each card depends on the active sorting tab */
  const line = (label, v, boxed) => v ? `<div class="meta"><span class="${boxed ? 'boxed' : ''}">${label}</span> ${esc(v)}</div>` : '';
  const langs = g => g.languages ? `<div class="meta flagrow">${flags(g.languages)}</div>` : '';
  const basic = g => (g.game_engine || g.languages) ? `<div class="meta split">${g.game_engine ? `<span class="engine">${esc(g.game_engine)}</span>` : '<span></span>'}${flags(g.languages)}</div>` : '';
  const stat = (label, n) => `<div class="rate"><span>${label} ${bar(n)}</span></div>`;
  const META = {
    'Latest content updates': g => line('Update', g.latest_content_update, true) + line('Updated', g.last_updated, true) + langs(g),
    'Newest release': g => line('By', g.authors) + line('Released', g.release_date) + langs(g),
    'Newest added': g => line('Added', g.creation_time) + basic(g),
    'Great art': g => stat('Art', num(g.art_rating, 5)) + basic(g),
    'Great mechanics': g => stat('Mechanics', num(g.mechanic_rating, 5)) + basic(g)
  };
  let sort = ck.get('sort', null);
  if (!SORTS[sort]) sort = Object.keys(SORTS)[0];
  const saved = ck.get('filters', {});
  const flt = Object.assign({ showFiltered: false, hideAI: false, hidePlayed: false, onlyFavorites: false }, saved);
  SECTIONS.forEach(x => flt[x.key] = Object.assign({ inc: [], exc: [] }, flt[x.key]));
  if (saved.inc) { flt.tags.inc = saved.inc; flt.tags.exc = saved.exc || []; delete flt.inc; delete flt.exc; }  /* old cookie format */
  const activeCount = () => SECTIONS.reduce((n, x) => n + flt[x.key].inc.length + flt[x.key].exc.length, 0) + flt.hideAI + flt.hidePlayed;
  const q0 = new URLSearchParams(location.search).get('q'); if (q0) $('#search').value = q0;

  const tabs = $('#tabs'), panel = $('#filterPanel');
  const drawTabs = () => {
  tabs.innerHTML =
    `<div class="tabs-row">` +
      Object.keys(SORTS).map(k => `<button data-s="${esc(k)}" class="${k === sort ? 'on' : ''}">${esc(k)}</button>`).join('') +
    `</div>` +
    `<div class="tabs-row">` +
      `<button class="favtab ${flt.onlyFavorites ? 'on' : ''}" data-fav="1" aria-pressed="${flt.onlyFavorites}">Favorites Only</button>` +
      `<span class="tabs-right">` +
        (CFG.submitForm ? `<a class="tablink" href="${esc(CFG.submitForm)}" target="_blank" rel="noopener">Submit a new game / update</a>` : '') +
        `<button class="filters ${panel.hidden ? '' : 'on'}" data-f="1">Filters${activeCount() ? ' (' + activeCount() + ')' : ''}</button>` +
      `</span>` +
    `</div>`;
};
  const options = SECTIONS.map(x => ({ ...x, all: [...new Set(games.flatMap(g => g._v[x.key]))].sort((a, b) => a.localeCompare(b)) }));
  const drawPanel = () => {
    const box = (id, on, label) => `<label class="check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
    panel.innerHTML = `<small>Click a value once to require it, twice to hide games that have it, a third time to clear. For Pricing model and Languages, requiring several values shows games matching any of them. Saved in a cookie on this browser.</small>` +
      options.map(x => `<div class="fsec"><h3>${x.label}</h3><div class="chips">${x.all.map(t =>
        `<button class="chip ${flt[x.key].inc.includes(t) ? 'inc' : flt[x.key].exc.includes(t) ? 'exc' : ''}" data-k="${x.key}" data-t="${esc(t)}">${esc(t)}</button>`).join('') || '<span class="chip">None yet</span>'}</div></div>`).join('') +
      `<div class="fsec"><h3>Other</h3><div class="checks">
        ${box('hideAI', flt.hideAI, 'Hide games that contain AI')}
        ${box('hidePlayed', flt.hidePlayed, 'Hide games I’ve already played')}
        ${box('showFiltered', flt.showFiltered, 'Show “hidden” games')}</div></div>
      <div class="filter-actions"><button id="clearF">Clear all</button></div>`;
  };
  const save = () => { ck.set('filters', flt); drawTabs(); drawPanel(); render(); };

  tabs.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.f) 
      { panel.hidden = !panel.hidden; } 
    else if (b.dataset.fav)
      { flt.onlyFavorites = !flt.onlyFavorites; ck.set('filters', flt); }
    else 
      { sort = b.dataset.s; ck.set('sort', sort); }
    drawTabs(); render();
  };
  panel.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'clearF') { SECTIONS.forEach(x => flt[x.key] = { inc: [], exc: [] }); flt.hideAI = flt.hidePlayed = flt.showFiltered = false; return save(); }
    const f = flt[b.dataset.k], t = b.dataset.t; if (!f || t === undefined) return;
    if (f.inc.includes(t)) { f.inc = f.inc.filter(x => x !== t); f.exc.push(t); }
    else if (f.exc.includes(t)) f.exc = f.exc.filter(x => x !== t);
    else f.inc.push(t);
    save();
  };
  panel.onchange = e => { if (['hideAI', 'hidePlayed', 'showFiltered'].includes(e.target.id)) { flt[e.target.id] = e.target.checked; save(); } };
  $('#search').addEventListener('input', render);
  $('#brand').addEventListener('click', e => { e.preventDefault(); location.href = 'index.html'; location.reload(); });

  /* Show games in chunks of CHUNK; the next chunk loads automatically when the visitor scrolls near the bottom */
  const CHUNK = 'IntersectionObserver' in window ? 64 : Infinity;   /* very old browsers get everything at once */
  const sentinel = gal.insertAdjacentElement('afterend', Object.assign(document.createElement('div'), { id: 'sentinel', style: 'height:1px' }));
  const oldBtn = $('#more'); if (oldBtn) oldBtn.remove();
  let shownList = [], shownCount = 0, done = new Set(), favs = new Set();
  const card = g => `<a class="card" href="game.html?g=${encodeURIComponent(g.id)}">
      <div class="thumb ${covers[g.id] ? '' : 'none'}" ${covers[g.id] ? `style="background-image:url('${esc(covers[g.id])}')"` : ''}>
        ${score(g) > 70 ? `<span class="flag score">★ Index Gem</span> ` : ''}
        ${done.has(g.id) ? '<span class="played" title="Played before">✓</span>' : ''}
        ${badges[g.id] ? `<span class="new-badge ${badges[g.id]}">${badges[g.id] === 'game' ? 'New Game!' : 'New Update!'}</span>` : ''}
      </div>
      <div class="body">
        <div class="title-row"><h3>${esc(g.title || g.id)}</h3>${favs.has(g.id) ? '<span class="fav-heart" title="Favorite" aria-label="Favorite">♥</span>' : ''}</div>
        ${chips([
          ...g._size_category.slice(0, 3),
          ...g._tags.slice(0, 5)
        ].filter(Boolean))}
        <p class="sum">${esc(plain(g.summary))}</p>
        ${(META[sort] || basic)(g)}
      </div>
      </a>`;
  function addChunk() {
    const next = shownList.slice(shownCount, shownCount + CHUNK);
    shownCount += next.length;
    gal.insertAdjacentHTML('beforeend', next.map(card).join(''));
    if (!io) return;
    io.unobserve(sentinel);
    if (shownCount < shownList.length) io.observe(sentinel);   /* re-check: loads again at once if the page is still too short */
  }
  const io = CHUNK === Infinity ? null : new IntersectionObserver(es => { if (es[0].isIntersecting) addChunk(); }, { rootMargin: '800px' });

    /* Remember gallery state when leaving, so the browser's Back button can restore it */
    history.scrollRestoration = 'manual';
    addEventListener('pagehide', () => { try { sessionStorage.setItem('gallery-state',
    JSON.stringify({ y: scrollY, n: shownCount, q: $('#search').value, sort })); } catch {} });
  
  function render() {
    const terms = $('#search').value.toLowerCase().split(/\s+/).filter(Boolean);
    done = new Set(played());
    favs = new Set(favorites());
    const shown = games.filter(g =>
      (flt.showFiltered || !yes(g.filtered)) &&
      (!flt.onlyFavorites || favs.has(g.id)) &&
      !(flt.hideAI && yes(g.contains_ai)) && !(flt.hidePlayed && done.has(g.id)) &&
      SECTIONS.every(x => {
        const f = flt[x.key], v = g._v[x.key];
        return (!f.inc.length || (x.any ? f.inc.some(t => v.includes(t)) : f.inc.every(t => v.includes(t)))) && !f.exc.some(t => v.includes(t));
      }) &&
      terms.every(t => g._hay.includes(t))
    ).sort(SORTS[sort]);
    /* While searching, title matches come first */
    if (terms.length) {
      const q = terms.join(' ');
      const rank = g => {
        const t = (g.title || '').toLowerCase(), o = (g.original_title || '').toLowerCase();
        /* exact title */
        if (t === q || o === q) return 0;
        
        /* title starts with the search */
        if (t.startsWith(q) || o.startsWith(q)) return 1;
        
        /* title contains every word */
        if (terms.every(w => t.includes(w)) || terms.every(w => o.includes(w))) return 2;
        
        /* matched elsewhere (tags, summary, authors…) */
        return 3;          
      };
      shown.sort((a, b) => rank(a) - rank(b));
    }
    shownList = shown;
    shownCount = 0;
    gal.innerHTML = '';
    addChunk();
    $('#empty').textContent = (flt.onlyFavorites) && !favs.size ? 'No favorites yet. Tick “Favorite” on a game’s page to add it here.' : 'No games match. Clear the search or adjust your filters.';
    $('#empty').hidden = shown.length > 0;
  }
  let st = null;
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav && nav.type === 'back_forward') { try { st = JSON.parse(sessionStorage.getItem('gallery-state')); } catch {} }
  if (st) { $('#search').value = st.q || ''; if (SORTS[st.sort]) sort = st.sort; }

  drawTabs(); drawPanel(); panel.hidden = true; drawTabs(); render();

  if (st) {
    while (shownCount < Math.min(st.n, shownList.length)) addChunk();
    window.scrollTo(0, st.y);
  }
}

/* Score weights */
const SCORE_WEIGHTS = 'score_weight.csv';
async function loadScoreWeights() {
  try {
    const res = await fetch(SCORE_WEIGHTS);
    WEIGHTS = parseCSV((await res.text()).replace(/^\uFEFF/, '')).slice(1)
      .map(r => ({ field: (r[0] || '').trim().toLowerCase(), value: (r[1] || '').trim(), weight: parseFloat(r[2]) }))
      .filter(w => w.field && w.value !== '' && !isNaN(w.weight));
  } catch (e) { console.warn('Score weights failed to load, every game will score 0.', e); }
}

/* Rating descriptions */
async function loadRatingDescriptions() {
  const root = `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/`;
  for (const url of [root + 'descriptions/rating_desc.csv', root + base + 'descriptions/rating_desc.csv']) {
    try {
      const res = await fetch(url); if (!res.ok) continue;
      const out = {};
      parseCSV((await res.text()).replace(/^\uFEFF/, '')).slice(1).forEach(r => {
        const k = (r[0] || '').trim().toLowerCase(); if (!k) return;
        out[k] = { title: (r[1] || '').trim(), levels: r.slice(2, 8).map(x => (x || '').trim()) };
      });
      return out;
    } catch (e) { console.warn('Rating descriptions failed to load:', url, e); }
  }
  return {};   /* no file found: ratings simply have no tooltip */
}
const ratingsTip = (g, D) => `<div class="rate">${[
  ['Art', 'art_rating', 5, bar], ['Mechanics', 'mechanic_rating', 5, bar], ['Animation', 'animation_rating', 5, bar], ['Size focus', 'size_focus', 3, ring]
].filter(([, key]) => !(key === 'animation_rating' && /^\s*0\s*$/.test(g[key] || ''))).map(([label, key, max, draw]) => {
  const val = (g[key] || '').trim(), has = val !== '' && !isNaN(parseInt(val, 10));   /* an empty cell is "not assessed", not 0 */
  const n = num(val, max), d = D[key];
  const tip = d ? [d.title, !has ? 'Not yet assessed' : d.levels[n] ? `${n}/${max}: ${d.levels[n]}` : `${n}/${max}`].filter(Boolean).join('\n') : '';
  return `<span${tip ? ` class="tip" tabindex="0" data-tip="${esc(tip)}"` : ''}>${label} ${has ? draw(n) : '<em class="na">Not yet assessed</em>'}</span>`;
}).join('')}</div>`;

const SCORE_INFO = [
  [,'Games are categorized by specific criteria listed below.'],
  ['Art', '0: Game has no visual content.\n1: Game uses mostly generic asset store, free or default engine assets.\n2: Game uses mostly poor quality or AI generated assets.\n3: Game has many assets of differing styles, assets and visuals may vary in quality.\n4: Game has mostly good quality assets with a uniform style. Games which use modular character software are typically capped here, as they are good quality, but not distinctive by default.\n5: Game art is of a high standard and consistent throughout.'],
  ['Mechanics', '0: Game has no player-agency or controllable elements.\n1: Game only includes features which are shipped as engine defaults.\n2: Game features custom player mechanics typically found in similar games.\n3: Game features unique custom mechanics which suit the design, not typically found in other games of its archetype.\n4: Game features an attempt at custom mechanics that relate to size-difference (changing scale dynamics/power disparity).\n5: Game features well-executed mechanic(s) which relate to size-difference. [Subjective]'],
  ['Animation', 'N/a: Game does not feature any animated visuals.\n1: Game uses mostly generic asset store, free or default animations.\n2: Game has some custom animations, but of generally poor quality.\n3: Game uses simple, consistent baked or procedural animations.\n4: Game features good quality baked or procedural animations.\n5: Game animation is of a high standard and consistent throughout.'],
  ['Size focus', '1: The game features mostly non-size-difference content with one or two scenarios dealing explicitly with size-difference content.\nOR\nThe game features many characters that are unusually bigger than the player character or vice-versa, but size-difference content is not an explicit focus.\n2: The game contains several scenes and sequences that are explicitly related to size-difference content, but the game does not center exclusively or majorly on size-difference.\nOR\nThe game centers exclusively on size-difference, but does not contain fetish content.\n3: The game centers entirely on size-fetish content.']
];

/* GAME PAGE */
async function gamePage() {
  const el = $('#game'), id = new URLSearchParams(location.search).get('g');
  el.innerHTML = loadingHTML('Loading game...');
  let g = null;
  try { g = id && await loadOneGame(id); } catch (e) { el.innerHTML = `<a class="back" href="index.html">← Back to gallery</a><p class="empty">${esc(e.message)}</p>`; return; }  if (!g) { el.innerHTML = '<a class="back" href="index.html">← Back to gallery</a><p class="empty">That game could not be found.</p>'; return; }
  document.title = `${g.title || id} – Size Game Index`;
  const go = () => window.goatcounter && window.goatcounter.count && window.goatcounter.count({ path: '/game/' + id, title: g.title || id });
  document.readyState === 'complete' ? go() : addEventListener('load', go);
  const D = await loadRatingDescriptions();
  const imgs = thumbs(g);
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const one = v => v ? `<span class="chip">${esc(v)}</span>` : '';
  const many = v => list(v).map(one).join(' ');
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const block = (h, t) => t ? `<section class="panel"><h2>${h}</h2><p>${rich(t)}</p></section>` : '';
  const links = list(g.game_links).map(u => `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener">Play / get on ${esc(host(u))}</a>`).join('') +
    (g.walkthrough ? `<a class="btn alt" href="${esc(blobUrl(id, g.walkthrough))}" target="_blank" rel="noopener">Walkthrough</a>` : '') +
    [...new Set([...list(g.creator_links), ...list(g.creator_link)])].map(u => `<a class="btn alt" href="${esc(u)}" target="_blank" rel="noopener">Creator on ${esc(host(u))}</a>`).join('') +
    (g.forum_link ? `<a class="btn alt" href="${esc(g.forum_link)}" target="_blank" rel="noopener">Forum thread</a>` : '');
  el.innerHTML = `<a class="back" href="index.html">← Back to gallery</a>
    <div class="top"><h1>${esc(g.title || id)}</h1>${g.original_title ? `<span class="orig">${esc(g.original_title)}</span>` : ''}</div>
    <div class="layout"><div>
      ${imgs.length ? `<div class="stage" id="stage" style="background-image:url('${esc(imgs[0])}')"></div>
      <div class="strip">${imgs.map((u, i) => `<button class="${i ? '' : 'on'}" data-u="${esc(u)}" style="background-image:url('${esc(u)}')" aria-label="Image ${i + 1}"></button>`).join('')}</div>` : '<div class="stage"></div>'}
      ${block('Summary', g.summary)}
      ${block('Narrative', g.narrative)}
      ${block('Mechanics', g.mechanics_description)}
    </div><aside>
      <section class="panel checks"><label class="check"><input type="checkbox" id="playedBox">Mark as played</label><label class="check"><input type="checkbox" id="favBox"> Favorite</label><small class="check-note">Played games are stored in your browser. New updates for played games toggle this box off and add a persisting “New Update!” popup until you visit the page again.</small></section>
      <section class="panel scores">${ratingsTip(g, D)}<button type="button" class="info-btn" id="scoreInfoBtn" aria-expanded="false" aria-controls="scoreInfo" title="How are games scored?">?</button></section>
      <section class="panel"><dl>
        ${row('Time to complete', one(g.time_to_complete))}
        ${row('Size Category', many(g.size_category))}
        ${row('Tags', many(g.tags))}
        ${row('Interactions', many(g.interactions))}
        ${row('Status', one(g.development_status))}
        ${row('Pricing', one(g.pricing_model))}
        ${row('Engine', one(g.game_engine))}
        ${row('Art style', one(g.main_art_style))}
        ${row('Languages', many(g.languages))}
        ${row('Authors', esc(g.authors))}
        ${row('Release date', esc(g.release_date))}
        ${row('Last updated', esc(g.last_updated))}
        ${row('Latest update', esc(g.latest_content_update))}
        ${row('Contains AI', yes(g.contains_ai) ? 'Yes' : 'No')}
        ${row('Entry updated', esc(g.entry_last_updated))}
        ${row('Entry created', esc(g.creation_time))}
      </dl></section>
      ${links ? `<section class="panel links">${links}</section>` : ''}
      ${block('Installation instructions', g.instructions)}
    </aside></div>`;
  el.insertAdjacentHTML('beforeend', `<aside id="scoreInfo" class="score-info" hidden aria-label="How are games scored?">
    <button type="button" class="close" aria-label="Close">×</button>
    <h2>How are games scored?</h2>
    ${SCORE_INFO.map(([h, t]) => `<h3>${esc(h)}</h3><p>${rich(t)}</p>`).join('')}
  </aside>`);
  const info = $('#scoreInfo'), infoBtn = $('#scoreInfoBtn');
  const setInfo = open => { info.hidden = !open; infoBtn.setAttribute('aria-expanded', open); };
  infoBtn.onclick = () => setInfo(info.hidden);
  info.querySelector('.close').onclick = () => setInfo(false);
  addEventListener('keydown', e => { if (e.key === 'Escape') setInfo(false); });
  el.addEventListener('click', e => {
    const b = e.target.closest('.strip button'); if (!b) return;
    $('#stage').style.backgroundImage = `url('${b.dataset.u}')`;
    el.querySelectorAll('.strip button').forEach(x => x.classList.toggle('on', x === b));
  });
  resetUpdatedPlayed([g], ck.get('seen', null));
  const pend = ck.get('pending', []);   /* visiting the page clears its persistent update badge */
  if (pend.includes(id)) ck.set('pending', pend.filter(x => x !== id));
  const box = $('#playedBox'); box.checked = played().includes(id);
  box.onchange = () => { const s = new Set(played()); box.checked ? s.add(id) : s.delete(id); ck.set('played', [...s]); };
  const fav = $('#favBox'); fav.checked = favorites().includes(id);
  fav.onchange = () => { const s = new Set(favorites()); fav.checked ? s.add(id) : s.delete(id); ck.set('favorites', [...s]); };
}

$('#game') ? gamePage() : home();

/* "Back to gallery" acts like the browser's back button when the visitor came from the gallery */
document.addEventListener('click', e => {
  if (!e.target.closest('a.back')) return;
  try {
    const ref = new URL(document.referrer);
    if (history.length > 1 && ref.origin === location.origin && !ref.pathname.endsWith('game.html')) {
      e.preventDefault();
      history.back();
    }
  } catch {}
});

/* Dark mode toggle */
(() => {
  const btn = $('#themeToggle'); if (!btn) return;
  const root = document.documentElement;
  const sync = () => {
    const dark = root.dataset.theme !== 'light';
    btn.textContent = dark ? '☀' : '☾';
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  };
  btn.onclick = () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
    sync();
  };
  sync();
})();
