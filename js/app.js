/* Game Shelf – static gallery. Works on index.html and game.html. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list = v => (v || '').split('|').map(s => s.trim()).filter(Boolean);
const yes = v => /^(1|true|yes|x)$/i.test((v || '').trim());
const num = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));

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
  if (!res.ok) throw new Error(res.status === 403 ? 'GitHub’s request limit was reached. Try again in a few minutes.' : `Could not read the repository (error ${res.status}). Games repository could not be found.`);
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
  games.forEach(g => { g._tags = list(g.tags); g._hay = Object.values(g).join(' ').toLowerCase(); });

  const dt = v => Date.parse(v) || 0;
  const SORTS = {
    'Recommended': (a, b) => yes(b.recommended) - yes(a.recommended) || dt(b.entry_last_updated) - dt(a.entry_last_updated),
    'Newest added': (a, b) => dt(b.creation_time) - dt(a.creation_time),
    'Recently updated': (a, b) => dt(b.last_updated) - dt(a.last_updated),
    'Newest release': (a, b) => dt(b.release_date) - dt(a.release_date),
    'Best art': (a, b) => num(b.art_rating, 5) - num(a.art_rating, 5),
    'Best mechanics': (a, b) => num(b.mechanic_rating, 5) - num(a.mechanic_rating, 5),
    'A–Z': (a, b) => (a.title || '').localeCompare(b.title || '')
  };
  let sort = Object.keys(SORTS)[0];
  let flt = Object.assign({ inc: [], exc: [], showFiltered: false }, ck.get('filters', {}));
  const q0 = new URLSearchParams(location.search).get('q'); if (q0) $('#search').value = q0;

  const tabs = $('#tabs'), panel = $('#filterPanel');
  const drawTabs = () => {
    tabs.innerHTML = Object.keys(SORTS).map(k => `<button data-s="${esc(k)}" class="${k === sort ? 'on' : ''}">${esc(k)}</button>`).join('') +
      `<button class="filters ${panel.hidden ? '' : 'on'}" data-f="1">Tag filters${flt.inc.length + flt.exc.length ? ' (' + (flt.inc.length + flt.exc.length) + ')' : ''}</button>`;
  };
  const allTags = [...new Set(games.flatMap(g => g._tags))].sort((a, b) => a.localeCompare(b));
  const drawPanel = () => {
    panel.innerHTML = `<small>Click a tag once to require it, twice to hide games with it, a third time to clear. Saved in a cookie on this browser.</small>
      <div class="chips">${allTags.map(t => `<button class="chip ${flt.inc.includes(t) ? 'inc' : flt.exc.includes(t) ? 'exc' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('') || '<span class="chip">No tags yet</span>'}</div>
      <div class="filter-actions"><label class="check"><input type="checkbox" id="showF" ${flt.showFiltered ? 'checked' : ''}> Show entries marked “filtered”</label><button id="clearF">Clear all</button></div>`;
  };
  const save = () => { ck.set('filters', flt); drawTabs(); drawPanel(); render(); };

  tabs.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.f) { panel.hidden = !panel.hidden; } else sort = b.dataset.s;
    drawTabs(); render();
  };
  panel.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'clearF') { flt.inc = []; flt.exc = []; return save(); }
    const t = b.dataset.t; if (!t) return;
    if (flt.inc.includes(t)) { flt.inc = flt.inc.filter(x => x !== t); flt.exc.push(t); }
    else if (flt.exc.includes(t)) flt.exc = flt.exc.filter(x => x !== t);
    else flt.inc.push(t);
    save();
  };
  panel.onchange = e => { if (e.target.id === 'showF') { flt.showFiltered = e.target.checked; save(); } };
  $('#search').addEventListener('input', render);
  $('#brand').addEventListener('click', e => { e.preventDefault(); location.href = 'index.html'; location.reload(); });

  function render() {
    const terms = $('#search').value.toLowerCase().split(/\s+/).filter(Boolean);
    const done = new Set(played());
    const shown = games.filter(g =>
      (flt.showFiltered || !yes(g.filtered)) &&
      flt.inc.every(t => g._tags.includes(t)) && !flt.exc.some(t => g._tags.includes(t)) &&
      terms.every(t => g._hay.includes(t))
    ).sort(SORTS[sort]);
    gal.innerHTML = shown.map(g => `<a class="card" href="game.html?g=${encodeURIComponent(g.id)}">
      <div class="thumb ${covers[g.id] ? '' : 'none'}" ${covers[g.id] ? `style="background-image:url('${esc(covers[g.id])}')"` : ''}>
        ${yes(g.recommended) ? '<span class="flag">Recommended</span>' : ''}${done.has(g.id) ? '<span class="played" title="Played before">✓</span>' : ''}</div>
      <div class="body"><h3>${esc(g.title || g.id)}</h3>${chips(g._tags.slice(0, 4))}<p class="sum">${esc(g.summary)}</p>${ratings(g)}</div></a>`).join('');
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
  document.title = `${g.title || id} – Game Shelf`;
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
        ${row('Time to complete', one(g.time_to_complete))}${row('Tags', many(g.tags))}${row('Status', one(g.development_status))}
        ${row('Pricing', one(g.pricing_model))}${row('Engine', one(g.game_engine))}${row('Art style', one(g.main_art_style))}
        ${row('Languages', many(g.languages))}${row('Authors', esc(g.authors))}${row('Author tags', many(g.author_tags))}
        ${row('Release date', esc(g.release_date))}${row('Last updated', esc(g.last_updated))}${row('Latest update', esc(g.latest_content_update))}
        ${row('Contains AI', yes(g.contains_ai) ? 'Yes' : 'No')}${row('Recommended', yes(g.recommended) ? 'Yes' : '')}
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
