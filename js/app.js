/* Static gallery. Works on index.html and game.html. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list = v => (v || '').split('|').map(s => s.trim()).filter(Boolean);
/* Language name (or 2-letter code) -> flagcdn country code. */
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
const score = g => Math.round(((num(g.art_rating, 5) + num(g.mechanic_rating, 5))*2 + num(g.animation_rating, 5)) * num(g.size_focus, 3) / 75 * 100);

/* cookies */
const ck = {
  get(n, d) { const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); try { return m ? JSON.parse(decodeURIComponent(m[1])) : d; } catch { return d; } },
  set(n, v) { document.cookie = n + '=' + encodeURIComponent(JSON.stringify(v)) + ';max-age=31536000;path=/;SameSite=Lax'; }
};

/* ---------- GitHub source ---------- */
const CFG = Object.assign({ owner: '', repo: '', branch: 'main', path: 'games' }, window.GAME_REPO);
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
const bar = n => `<span class="bar" role="img" aria-label="${n} of 5">${[1,2,3,4,5].map(i => `<i class="${i <= n ? 'f' : ''}"></i>`).join('')}</span>`;
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

/* ---------- HOME ---------- */
async function home() {
  const gal = $('#gallery');
  let files;
  try { files = await repoFiles(); } catch (e) { $('#empty').textContent = e.message; $('#empty').hidden = false; return; }
  const games = (await Promise.all(Object.keys(files).map(id => loadGame(id, files[id])))).filter(Boolean);
  const covers = {};
  games.forEach(g => covers[g.id] = thumbs(g, true)[0]);
  const SECTIONS = [  /* filter sections; any:true = a game matches if it has ANY required value */
    { key: 'tags', label: 'Tags', field: 'tags', any: false },
    { key: 'interactions', label: 'Interactions', field: 'interactions', any: false },
    { key: 'pricing', label: 'Pricing model', field: 'pricing_model', any: true },
    { key: 'languages', label: 'Languages', field: 'languages', any: true }
  ];
  games.forEach(g => {
    g._hay = Object.values(g).join(' ').toLowerCase();
    g._tags = list(g.tags);
    g._v = {}; SECTIONS.forEach(x => g._v[x.key] = list(g[x.field]));   /* exact, case-sensitive values */
  });

  const dt = v => Date.parse(v) || 0;
  const SORTS = {
    'Latest content updates': (a, b) => dt(b.last_updated) - dt(a.last_updated),
    'Newest added': (a, b) => dt(b.creation_time) - dt(a.creation_time),
    'Newest release': (a, b) => dt(b.release_date) - dt(a.release_date),
    'Great art': (a, b) => num(b.art_rating, 5) - num(a.art_rating, 5),
    'Great mechanics': (a, b) => num(b.mechanic_rating, 5) - num(a.mechanic_rating, 5),
    'A–Z': (a, b) => (a.title || '').localeCompare(b.title || ''),
    'Recommended': (a, b) => score(b) - score(a)
  };

  /* Extra info shown on each card depends on the active sorting tab */
  const line = (label, v, boxed) => v ? `<div class="meta"><span class="${boxed ? 'boxed' : ''}">${label}</span> ${esc(v)}</div>` : '';
  const langs = g => g.languages ? `<div class="meta">${flags(g.languages)}</div>` : '';
  const basic = g => (g.game_engine || g.languages) ? `<div class="meta split">${g.game_engine ? `<span class="engine">${esc(g.game_engine)}</span>` : '<span></span>'}${flags(g.languages)}</div>` : '';
  const stat = (label, n) => `<div class="rate"><span>${label} ${bar(n)}</span></div>`;
  const META = {
    'Latest content updates': g => line('Update', g.latest_content_update, true) + line('Updated', g.last_updated, true) + langs(g),
    'Newest release': g => line('By', g.authors) + line('Released', g.release_date) + langs(g),
    'Great art': g => stat('Art', num(g.art_rating, 5)) + basic(g),
    'Great mechanics': g => stat('Mechanics', num(g.mechanic_rating, 5)) + basic(g)
  };
  let sort = Object.keys(SORTS)[0];
  const saved = ck.get('filters', {});
  const flt = Object.assign({ showFiltered: false, hideAI: false, hidePlayed: false }, saved);
  SECTIONS.forEach(x => flt[x.key] = Object.assign({ inc: [], exc: [] }, flt[x.key]));
  if (saved.inc) { flt.tags.inc = saved.inc; flt.tags.exc = saved.exc || []; delete flt.inc; delete flt.exc; }  /* old cookie format */
  const activeCount = () => SECTIONS.reduce((n, x) => n + flt[x.key].inc.length + flt[x.key].exc.length, 0) + flt.hideAI + flt.hidePlayed;
  const q0 = new URLSearchParams(location.search).get('q'); if (q0) $('#search').value = q0;

  const tabs = $('#tabs'), panel = $('#filterPanel');
  const drawTabs = () => {
    tabs.innerHTML = Object.keys(SORTS).map(k => `<button data-s="${esc(k)}" class="${k === sort ? 'on' : ''}">${esc(k)}</button>`).join('') +
      `<button class="filters ${panel.hidden ? '' : 'on'}" data-f="1">Filters${activeCount() ? ' (' + activeCount() + ')' : ''}</button>`;
  };
  const options = SECTIONS.map(x => ({ ...x, all: [...new Set(games.flatMap(g => g._v[x.key]))].sort((a, b) => a.localeCompare(b)) }));
  const drawPanel = () => {
    const box = (id, on, label) => `<label class="check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
    panel.innerHTML = `<small>Click a value once to require it, twice to hide games that have it, a third time to clear. For Pricing model and Languages, requiring several values shows games matching any of them. Saved in a cookie on this browser.</small>` +
      options.map(x => `<div class="fsec"><h3>${x.label}</h3><div class="chips">${x.all.map(t =>
        `<button class="chip ${flt[x.key].inc.includes(t) ? 'inc' : flt[x.key].exc.includes(t) ? 'exc' : ''}" data-k="${x.key}" data-t="${esc(t)}">${esc(t)}</button>`).join('') || '<span class="chip">None yet</span>'}</div></div>`).join('') +
      `<div class="fsec"><h3>Other</h3><div class="checks">${box('hideAI', flt.hideAI, 'Hide games that contain AI')}${box('hidePlayed', flt.hidePlayed, 'Hide games I’ve already played')}${box('showFiltered', flt.showFiltered, 'Show “hidden” games')}</div></div>
      <div class="filter-actions"><button id="clearF">Clear all</button></div>`;
  };
  const save = () => { ck.set('filters', flt); drawTabs(); drawPanel(); render(); };

  tabs.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.f) { panel.hidden = !panel.hidden; } else sort = b.dataset.s;
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

  function render() {
    const terms = $('#search').value.toLowerCase().split(/\s+/).filter(Boolean);
    const done = new Set(played());
    const shown = games.filter(g =>
      (flt.showFiltered || !yes(g.filtered)) &&
      !(flt.hideAI && yes(g.contains_ai)) && !(flt.hidePlayed && done.has(g.id)) &&
      SECTIONS.every(x => {
        const f = flt[x.key], v = g._v[x.key];
        return (!f.inc.length || (x.any ? f.inc.some(t => v.includes(t)) : f.inc.every(t => v.includes(t)))) && !f.exc.some(t => v.includes(t));
      }) &&
      terms.every(t => g._hay.includes(t))
    ).sort(SORTS[sort]);
    gal.innerHTML = shown.map(g => `<a class="card" href="game.html?g=${encodeURIComponent(g.id)}">
      <div class="thumb ${covers[g.id] ? '' : 'none'}" ${covers[g.id] ? `style="background-image:url('${esc(covers[g.id])}')"` : ''}>
        ${score(g) > 60 ? `<span class="flag score">★ Recommended` : ''}${done.has(g.id) ? '<span class="played" title="Played before">✓</span>' : ''}</div>
      <div class="body"><h3>${esc(g.title || g.id)}</h3>${chips(g._tags.slice(0, 4))}<p class="sum">${esc(g.summary)}</p>${(META[sort] || basic)(g)}</div></a>`).join('');
    $('#empty').hidden = shown.length > 0;
  }
  drawTabs(); drawPanel(); panel.hidden = true; drawTabs(); render();
}

/* ---------- GAME PAGE ---------- */
async function gamePage() {
  const el = $('#game'), id = new URLSearchParams(location.search).get('g');
  let g = null;
  try { const files = await repoFiles(); g = id && await loadGame(id, files[id]); } catch (e) { el.innerHTML = `<a class="back" href="index.html">← Back to gallery</a><p class="empty">${esc(e.message)}</p>`; return; }
  if (!g) { el.innerHTML = '<a class="back" href="index.html">← Back to gallery</a><p class="empty">That game could not be found.</p>'; return; }
  document.title = `${g.title || id} – Size Game Index`;
  const imgs = thumbs(g);
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const one = v => v ? `<span class="chip">${esc(v)}</span>` : '';
  const many = v => list(v).map(one).join(' ');
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const block = (h, t) => t ? `<section class="panel"><h2>${h}</h2><p>${esc(t)}</p></section>` : '';
  const links = list(g.game_links).map(u => `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener">Play / get on ${esc(host(u))}</a>`).join('') +
    (g.walkthrough ? `<a class="btn alt" href="${esc(blobUrl(id, g.walkthrough))}" target="_blank" rel="noopener">Walkthrough</a>` : '') +
    (g.creator_link ? `<a class="btn alt" href="${esc(g.creator_link)}" target="_blank" rel="noopener">Creator</a>` : '') +
    (g.forum_link ? `<a class="btn alt" href="${esc(g.forum_link)}" target="_blank" rel="noopener">Forum thread</a>` : '');
  el.innerHTML = `<a class="back" href="index.html">← Back to gallery</a>
    <div class="top"><h1>${esc(g.title || id)}</h1>${g.original_title ? `<span class="orig">${esc(g.original_title)}</span>` : ''}</div>
    <div class="layout"><div>
      ${imgs.length ? `<div class="stage" id="stage" style="background-image:url('${esc(imgs[0])}')"></div>
      <div class="strip">${imgs.map((u, i) => `<button class="${i ? '' : 'on'}" data-u="${esc(u)}" style="background-image:url('${esc(u)}')" aria-label="Image ${i + 1}"></button>`).join('')}</div>` : '<div class="stage"></div>'}
      ${block('Summary', g.summary)}${block('Narrative', g.narrative)}${block('Mechanics', g.mechanics_description)}
    </div><aside>
      <section class="panel"><label class="check"><input type="checkbox" id="playedBox"> I've played this</label></section>
      <section class="panel">${ratings(g)}</section>
      <section class="panel"><dl>
        ${row('Time to complete', one(g.time_to_complete))}${row('Tags', many(g.tags))}${row('Interactions', many(g.interactions))}${row('Status', one(g.development_status))}
        ${row('Pricing', one(g.pricing_model))}${row('Engine', one(g.game_engine))}${row('Art style', one(g.main_art_style))}
        ${row('Languages', many(g.languages))}${row('Authors', esc(g.authors))}
        ${row('Release date', esc(g.release_date))}${row('Last updated', esc(g.last_updated))}${row('Latest update', esc(g.latest_content_update))}
        ${row('Contains AI', yes(g.contains_ai) ? 'Yes' : 'No')}
        ${row('Entry updated', esc(g.entry_last_updated))}${row('Entry created', esc(g.creation_time))}
      </dl></section>
      ${links ? `<section class="panel links">${links}</section>` : ''}
    </aside></div>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('.strip button'); if (!b) return;
    $('#stage').style.backgroundImage = `url('${b.dataset.u}')`;
    el.querySelectorAll('.strip button').forEach(x => x.classList.toggle('on', x === b));
  });
  const box = $('#playedBox'); box.checked = played().includes(id);
  box.onchange = () => { const s = new Set(played()); box.checked ? s.add(id) : s.delete(id); ck.set('played', [...s]); };
}

$('#game') ? gamePage() : home();