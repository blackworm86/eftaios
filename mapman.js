'use strict';
/* Map manager: browse every map, create, copy, edit, delete, import and share.  Official maps are read-only. */
const MM = { ed: null };
const isCustom = m => (S.customMaps || []).some(c => c.id === m.id);
const emptyRows = () => Array.from({ length: 14 }, () => '.'.repeat(23));
const mmClose = () => { const o = $('#mapman'); if (o) o.remove(); };
function mmShell(title, body, backAct, cls) {
  mmClose();
  const g = document.createElement('div'); g.id = 'mapman'; g.className = 'gallery' + (cls ? ' ' + cls : ''); g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', title);
  g.innerHTML = `<header><h2>${esc(title)}</h2><button class="icon-btn" data-act="${backAct}" aria-label="${t('Close')}">${ico('close')}</button></header><div class="gbody">${body}</div>`;
  document.body.appendChild(g); return g;
}
function mapManager() {
  const packs = [];
  T.maps.forEach(m => { const p = m.pack || t('My maps'); if (!packs.includes(p)) packs.push(p); });
  if (!packs.includes(t('My maps'))) packs.push(t('My maps'));
  const body = `<div class="row two mmtop"><button class="btn primary" data-act="mmnew">+ ${t('New map')}</button><button class="btn" data-act="eimport">${t('Import')}</button></div>
    ${packs.map(p => { const l = T.maps.filter(m => (m.pack || t('My maps')) === p); return `<h3>${esc(t(p))}</h3>${l.length ? `<div class="ggrid">${l.map(m => `<button class="gcard" data-act="mmopen" data-id="${esc(m.id)}">${mapPreview(m)}<b>${esc(m.name)}</b><small>${esc(mapInfo(m))}</small></button>`).join('')}</div>` : `<p class="dim">${t('No maps of your own yet. Create one, or copy an official map to change it.')}</p>`}`; }).join('')}`;
  mmShell(t('Maps'), body, 'mmclose');
}
function mapDetail(id) {
  const m = T.maps.find(x => x.id === id); if (!m) return;
  const mine = isCustom(m);
  mmShell(m.name, `<div class="mmbig">${mapPreview(m)}</div>${m.description ? `<p class="mmdesc">${t(m.description)}</p>` : ''}<p class="dim mminfo">${esc(mapInfo(m))}${mine ? '' : ' · ' + t('Official map (read-only)')}</p>
    <div class="mmacts">${mine ? `<button class="btn primary" data-act="mmedit" data-id="${esc(m.id)}">${t('Edit')}</button>` : ''}
    <button class="btn ${mine ? '' : 'primary'}" data-act="mmcopy" data-id="${esc(m.id)}">${t('Make a copy to edit')}</button>
    <button class="btn" data-act="mmexport" data-id="${esc(m.id)}">${t('Export / share')}</button>
    ${mine ? `<button class="btn danger" data-act="mmdel" data-id="${esc(m.id)}">${t('Delete')}</button>` : ''}
    <button class="btn" data-act="mmlist">${t('Back')}</button></div>`, 'mmlist', 'detail');
}
const mmJson = m => JSON.stringify({ id: m.id, name: m.name, oddColumnsLower: m.odd, rows_data: m.grid.map(r => r.join('')) }, null, 1);
function mapExport(id) {
  const m = T.maps.find(x => x.id === id); if (!m) return;
  const json = mmJson(m);
  dlg.innerHTML = `<h2>${t('Export map')}</h2><textarea readonly id="exp">${esc(json)}</textarea>
    <div class="row mmexp"><button class="btn" id="d-no">${t('Close')}</button><button class="btn" id="d-dl">${t('Download')}</button><button class="btn primary" id="d-copy">${t('Copy')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  $('#d-copy').onclick = () => copyText(json, t('Copied'));
  $('#d-dl').onclick = () => saveMapFile(m.name, json);
}

/* save a map as a .json file: the share sheet on phones, otherwise (or when it fails) a file download */
async function saveMapFile(name, json) {
  const f = new File([json], (name.replace(/[^\w-]+/g, '_') || 'map') + '.json', { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: name }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // the viewer closed the share sheet
  }
  const url = URL.createObjectURL(f), a = document.createElement('a');
  a.href = url; a.download = f.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(t('Map saved to your downloads'));
}

/* ---- editor ---- */
const MM_TOOLS = [['.', 'Dangerous', '#59627a'], ['s', 'Secure', '#ece6d3'], ['x', 'Empty', '#0b1222'], ['H', 'Human', '#1c5d93'], ['A', 'Alien', '#a53312'], ['1', 'Hatch 1', '#1e8a4f'], ['2', 'Hatch 2', '#1e8a4f'], ['3', 'Hatch 3', '#1e8a4f'], ['4', 'Hatch 4', '#1e8a4f']];
const MM_COL = { '.': '#59627a', s: '#ece6d3', x: '#0b1222', H: '#1c5d93', A: '#a53312' };
function startEdit(grid, name, odd, id) {
  MM.ed = { tool: '.', mode: 'brush', name, odd, grid: grid.map(r => r.slice()), id: id || null };
  editorScreen();
}
function edMap() { const e = MM.ed; return { cols: e.grid[0].length, rows: e.grid.length, odd: e.odd }; }
function edCellHtml(c, r) {
  const e = MM.ed, ty = e.grid[r][c], { x, y } = hexPos(edMap(), c, r);
  return `<polygon data-c="${c}" data-r="${r}" points="${hexPts(x, y, HEX - 1)}" fill="${MM_COL[ty] || '#1e8a4f'}"${ty === 'x' ? ' stroke="#2a3552" stroke-width="1"' : ''}/>${'1234'.includes(ty) ? `<text x="${x}" y="${y}" class="pvn">${ty}</text>` : ''}`;
}
const edCells = () => MM.ed.grid.map((row, r) => row.map((_, c) => edCellHtml(c, r)).join('')).join('');
const edSize = () => { const m = edMap(); return { W: HEX * 2 + 1.5 * HEX * (m.cols - 1), H: Math.sqrt(3) * HEX * (m.rows + 0.5) }; };
function editorScreen() {
  const e = MM.ed;
  const g = mmShell(e.id ? t('Edit map') : t('New map'), `<div class="tools" role="group" aria-label="${t('Tools')}">${MM_TOOLS.map(([k, n, c]) => `<button data-act="mmtool" data-t="${k}" aria-pressed="${e.tool === k}"><i style="background:${c};outline:1px solid #fff3"></i>${t(n)}</button>`).join('')}</div>
    <div class="mmedit" id="ed-box"><svg id="ed-svg" class="mmsvg" role="img" aria-label="${t('Map')}"><g id="ed-g">${edCells()}</g></svg>
      <div class="zoomctl" role="group" aria-label="${t('Zoom')}"><button class="btn" data-act="mmzin" aria-label="${t('Zoom in')}">+</button><button class="btn" data-act="mmzout" aria-label="${t('Zoom out')}">−</button><button class="btn" data-act="mmzfit" aria-label="${t('Fit to screen')}">${ico('expand', 18)}</button><button class="btn" id="ed-hand" data-act="mmhand" aria-pressed="false" aria-label="${t('Move the map')}">${ico('hand', 18)}</button></div>
      <div class="modectl" role="group" aria-label="${t('Mode')}">${[['brush', 'pencil', 'Brush'], ['bucket', 'bucket', 'Paint bucket'], ['pick', 'picker', 'Color picker']].map(([k, i, n]) => `<button class="btn" data-act="mmmode" data-m="${k}" aria-pressed="${e.mode === k}" aria-label="${t(n)}" title="${t(n)}">${ico(i, 18)}</button>`).join('')}</div>
      <p class="edhint">${t('Wheel or pinch to zoom. Drag with the hand, the right button or two fingers to move.')}</p></div>
    <div class="edfoot"><label class="field"><span>${t('Map name')}</span><input id="ed-name" type="text" maxlength="40" value="${esc(e.name)}"></label>
      <label class="check"><input id="ed-odd" type="checkbox" ${e.odd ? 'checked' : ''}> ${t('Odd columns lower')}</label>
      <div class="row"><button class="btn" data-act="mmcancel">${t('Cancel')}</button><button class="btn primary" data-act="mmsave">${t('Save map')}</button></div></div>`, 'mmcancel', 'edit');
  const box = g.querySelector('#ed-box'), svg = g.querySelector('#ed-svg'), grp = g.querySelector('#ed-g');
  const V = MM.view = { k: 1, x: 0, y: 0, fit: 1, hand: false, touched: false };
  const size = () => ({ w: box.clientWidth || 1, h: box.clientHeight || 1 });
  const apply = () => grp.setAttribute('transform', `translate(${V.x.toFixed(2)} ${V.y.toFixed(2)}) scale(${V.k.toFixed(4)})`);
  const fit = () => {
    const { w, h } = size(), { W, H } = edSize(); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const top = w < 520 ? 34 : 24; V.fit = Math.min(w / W, (h - top) / H) * 0.97; V.k = V.fit; V.x = (w - W * V.k) / 2; V.y = top + (h - top - H * V.k) / 2; V.touched = false; apply();
  };
  /* zoom by factor f keeping the screen point (px, py) still */
  const zoomAt = (f, px, py) => {
    const k = Math.max(V.fit * 0.6, Math.min(V.fit * 10, V.k * f)); f = k / V.k;
    V.x = px - (px - V.x) * f; V.y = py - (py - V.y) * f; V.k = k; V.touched = true; apply();
  };
  const rel = ev => { const r = box.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  MM.fit = fit; MM.zoomBy = f => { const { w, h } = size(); zoomAt(f, w / 2, h / 2); };
  fit(); new ResizeObserver(() => { if (document.body.contains(box) && !V.touched) fit(); }).observe(box);
  box.addEventListener('wheel', ev => { ev.preventDefault(); const p = rel(ev); zoomAt(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0016)), p.x, p.y); }, { passive: false });
  box.addEventListener('contextmenu', ev => ev.preventDefault());

  const paintCell = el => {
    if (!el || !el.dataset || el.dataset.c === undefined) return;
    const c = +el.dataset.c, r = +el.dataset.r, tool = MM.ed.tool, gr = MM.ed.grid;
    if (gr[r][c] === tool) return;
    let all = false;
    if ('HA1234'.includes(tool)) for (let rr = 0; rr < gr.length; rr++) for (let cc = 0; cc < gr[rr].length; cc++) if (gr[rr][cc] === tool) { gr[rr][cc] = '.'; all = true; }
    gr[r][c] = tool;
    if (all) grp.innerHTML = edCells(); else { const p = grp.querySelector(`polygon[data-c="${c}"][data-r="${r}"]`), nx = p.nextElementSibling; if (nx && nx.tagName === 'text') nx.remove(); p.outerHTML = edCellHtml(c, r); }
  };
  const toolBtns = () => g.querySelectorAll('[data-act=mmtool]').forEach(x => x.setAttribute('aria-pressed', x.dataset.t === MM.ed.tool));
  const bucket = el => {
    if (!el || !el.dataset || el.dataset.c === undefined) return;
    const gr = MM.ed.grid, tool = MM.ed.tool, c0 = +el.dataset.c, r0 = +el.dataset.r, from = gr[r0][c0];
    if ('HA1234'.includes(tool)) return toast(t('Start sectors and pods are single: use the brush.'));
    if (from === tool) return; if ('HA1234'.includes(from)) return toast(t('Start sectors and pods cannot be filled over.'));
    const map = edMap(), q = [[c0, r0]]; gr[r0][c0] = tool;
    while (q.length) { const [c, r] = q.pop(); for (const [a, b] of neighbors(map, c, r)) if (gr[b][a] === from) { gr[b][a] = tool; q.push([a, b]); } }
    grp.innerHTML = edCells();
  };
  const pick = el => {
    if (!el || !el.dataset || el.dataset.c === undefined) return;
    MM.ed.tool = MM.ed.grid[+el.dataset.r][+el.dataset.c]; MM.ed.mode = 'brush'; toolBtns(); setMode();
  };
  const setMode = () => { g.querySelectorAll('[data-act=mmmode]').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === MM.ed.mode)); box.dataset.mode = MM.ed.mode; };
  MM.setMode = setMode; setMode();
  const under = ev => document.elementFromPoint(ev.clientX, ev.clientY);
  /* gestures: one finger or the left button paints, the hand tool / right or middle button / two fingers move and zoom */
  const ptr = new Map(); let mode = '', pend = null, pinch = null, panFrom = null;
  const dist = () => { const [a, b] = [...ptr.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const mid = () => { const [a, b] = [...ptr.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  box.addEventListener('pointerdown', ev => {
    if (ev.target.closest('.zoomctl, .modectl')) return;
    try { box.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic or already released */ } ptr.set(ev.pointerId, rel(ev)); ev.preventDefault();
    if (ptr.size === 2) { mode = 'pinch'; pend = null; pinch = { d: dist(), c: mid(), k: V.k, x: V.x, y: V.y }; return; }
    if (ev.button === 1 || ev.button === 2 || V.hand) { mode = 'pan'; panFrom = { p: rel(ev), x: V.x, y: V.y }; return; }
    mode = MM.ed.mode === 'brush' ? 'paint' : 'tap'; pend = { ev, p: rel(ev) };
  });
  box.addEventListener('pointermove', ev => {
    if (!ptr.has(ev.pointerId)) return; ptr.set(ev.pointerId, rel(ev));
    if (mode === 'pinch' && ptr.size >= 2) {
      const k = Math.max(V.fit * 0.6, Math.min(V.fit * 10, pinch.k * dist() / pinch.d)), c = mid(), wx = (pinch.c.x - pinch.x) / pinch.k, wy = (pinch.c.y - pinch.y) / pinch.k;
      V.k = k; V.x = c.x - wx * k; V.y = c.y - wy * k; V.touched = true; apply(); return;
    }
    if (mode === 'pan') { const p = rel(ev); V.x = panFrom.x + p.x - panFrom.p.x; V.y = panFrom.y + p.y - panFrom.p.y; V.touched = true; apply(); return; }
    if (mode === 'tap') { if (pend) { const p = rel(ev); if (Math.hypot(p.x - pend.p.x, p.y - pend.p.y) > 8) pend = null; } return; }
    if (mode === 'paint') {
      if (pend) { const p = rel(ev); if (Math.hypot(p.x - pend.p.x, p.y - pend.p.y) < 5) return; paintCell(under(pend.ev)); pend = null; }
      paintCell(under(ev));
    }
  });
  const end = ev => {
    if (!ptr.has(ev.pointerId)) return; ptr.delete(ev.pointerId);
    if (mode === 'paint' && pend && ev.type === 'pointerup') paintCell(under(pend.ev));   // a tap
    if (mode === 'tap' && pend && ev.type === 'pointerup') (MM.ed.mode === 'bucket' ? bucket : pick)(under(pend.ev));
    pend = null; if (ptr.size === 0) mode = ''; else if (mode === 'pinch') { mode = 'pan'; const [p] = [...ptr.values()]; panFrom = { p, x: V.x, y: V.y }; }
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  g.querySelector('#ed-odd').onchange = ev => { MM.ed.odd = ev.target.checked; grp.innerHTML = edCells(); if (!V.touched) fit(); };
}
function saveEdit() {
  const e = MM.ed, name = ($('#ed-name').value || t('Custom map')).trim(), odd = $('#ed-odd').checked;
  if (!e.grid.some(r => r.includes('H')) || !e.grid.some(r => r.includes('A'))) return toast(t('Place the Human and Alien start sectors'));
  const id = e.id || 'custom-' + Date.now(), rec = { id, name, rows_data: e.grid.map(r => r.join('')), oddColumnsLower: odd };
  S.customMaps = (S.customMaps || []).filter(m => m.id !== id).concat(rec); MM.ed = null;
  save(); loadMaps().then(() => { mapDetail(id); toast(t('Map saved')); });
}

Object.assign(actions, {
  maps_() { mapManager(); },
  mmclose() { mmClose(); },
  mmlist() { mapManager(); },
  mmopen(b) { mapDetail(b.dataset.id); },
  mmnew() { startEdit(emptyRows().map(r => r.split('')), t('My map'), true, null); },
  mmcopy(b) { const m = T.maps.find(x => x.id === b.dataset.id); if (m) startEdit(m.grid, m.name + ' (' + t('copy') + ')', m.odd, null); },
  mmedit(b) { const m = T.maps.find(x => x.id === b.dataset.id); if (m && isCustom(m)) startEdit(m.grid, m.name, m.odd, m.id); },
  mmexport(b) { mapExport(b.dataset.id); },
  mmdel(b) { const id = b.dataset.id; confirmDlg(t('Delete this map?'), t('This cannot be undone.'), () => { S.customMaps = (S.customMaps || []).filter(m => m.id !== id); save(); loadMaps().then(() => { if (S.mapId === id) S.mapId = 'galilei'; mapManager(); }); }); },
  mmzin() { MM.zoomBy && MM.zoomBy(1.4); },
  mmzout() { MM.zoomBy && MM.zoomBy(1 / 1.4); },
  mmzfit() { MM.fit && MM.fit(); },
  mmhand(b) { MM.view.hand = !MM.view.hand; b.setAttribute('aria-pressed', MM.view.hand); },
  mmmode(b) { MM.ed.mode = b.dataset.m; MM.setMode && MM.setMode(); },
  mmtool(b) { MM.ed.tool = b.dataset.t; b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); },
  mmcancel() { const e = MM.ed; MM.ed = null; if (e && e.id) mapDetail(e.id); else mapManager(); },
  mmsave() { saveEdit(); },
  eimport() { importDlg(); }
});
