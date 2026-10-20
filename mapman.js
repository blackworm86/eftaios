'use strict';
/* Map manager: browse every map, create, copy, edit, delete, import and share.  Official maps are read-only. */
const MM = { ed: null };
const isCustom = m => (S.customMaps || []).some(c => c.id === m.id);
const emptyRows = () => Array.from({ length: 14 }, () => '.'.repeat(23));
const mmClose = () => { const o = $('#mapman'); if (o) o.remove(); };
function mmShell(title, body, backAct) {
  mmClose();
  const g = document.createElement('div'); g.id = 'mapman'; g.className = 'gallery'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', title);
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
  mmShell(m.name, `<div class="mmbig">${mapPreview(m)}</div><p class="dim">${esc(mapInfo(m))}${mine ? '' : ' · ' + t('Official map (read-only)')}</p>
    <div class="mmacts">${mine ? `<button class="btn primary" data-act="mmedit" data-id="${esc(m.id)}">${t('Edit')}</button>` : ''}
    <button class="btn ${mine ? '' : 'primary'}" data-act="mmcopy" data-id="${esc(m.id)}">${t('Make a copy to edit')}</button>
    <button class="btn" data-act="mmexport" data-id="${esc(m.id)}">${t('Export / share')}</button>
    ${mine ? `<button class="btn danger" data-act="mmdel" data-id="${esc(m.id)}">${t('Delete')}</button>` : ''}
    <button class="btn" data-act="mmlist">${t('Back')}</button></div>`, 'mmlist');
}
const mmJson = m => JSON.stringify({ id: m.id, name: m.name, oddColumnsLower: m.odd, rows_data: m.grid.map(r => r.join('')) }, null, 1);
function mapExport(id) {
  const m = T.maps.find(x => x.id === id); if (!m) return;
  const json = mmJson(m);
  dlg.innerHTML = `<h2>${t('Export map')}</h2><textarea readonly id="exp">${esc(json)}</textarea>
    <div class="row mmexp"><button class="btn" id="d-no">${t('Close')}</button><button class="btn" id="d-dl">${t('Download')}</button><button class="btn primary" id="d-copy">${t('Copy')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  $('#d-copy').onclick = () => copyText(json, t('Copied'));
  $('#d-dl').onclick = () => {
    const f = new File([json], (m.name.replace(/[^\w-]+/g, '_') || 'map') + '.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: m.name }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
}

/* ---- editor ---- */
const MM_TOOLS = [['.', 'Dangerous', '#59627a'], ['s', 'Secure', '#ece6d3'], ['x', 'Empty', '#0b1222'], ['H', 'Human', '#1c5d93'], ['A', 'Alien', '#a53312'], ['1', 'Hatch 1', '#1e8a4f'], ['2', 'Hatch 2', '#1e8a4f'], ['3', 'Hatch 3', '#1e8a4f'], ['4', 'Hatch 4', '#1e8a4f']];
const MM_COL = { '.': '#59627a', s: '#ece6d3', x: '#0b1222', H: '#1c5d93', A: '#a53312' };
function startEdit(grid, name, odd, id) {
  MM.ed = { tool: '.', name, odd, grid: grid.map(r => r.slice()), id: id || null };
  editorScreen();
}
function edMap() { const e = MM.ed; return { cols: e.grid[0].length, rows: e.grid.length, odd: e.odd }; }
function edCellHtml(c, r) {
  const e = MM.ed, ty = e.grid[r][c], { x, y } = hexPos(edMap(), c, r);
  return `<polygon data-c="${c}" data-r="${r}" points="${hexPts(x, y, HEX - 1)}" fill="${MM_COL[ty] || '#1e8a4f'}"${ty === 'x' ? ' stroke="#2a3552" stroke-width="1"' : ''}/>${'1234'.includes(ty) ? `<text x="${x}" y="${y}" class="pvn">${ty}</text>` : ''}`;
}
function edSvg() {
  const e = MM.ed, m = edMap(), W = HEX * 2 + 1.5 * HEX * (m.cols - 1), H = Math.sqrt(3) * HEX * (m.rows + 0.5);
  let g = ''; for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) g += edCellHtml(c, r);
  return `<svg id="ed-svg" class="mmsvg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${t('Map')}">${g}</svg>`;
}
function editorScreen() {
  const e = MM.ed;
  const g = mmShell(e.id ? t('Edit map') : t('New map'), `<p class="dim">${t('Pick a tool, then tap or drag over the sectors. Start sectors and hatches are unique.')}</p>
    <div class="tools" role="group">${MM_TOOLS.map(([k, n, c]) => `<button data-act="mmtool" data-t="${k}" aria-pressed="${e.tool === k}"><i style="background:${c};outline:1px solid #fff3"></i>${t(n)}</button>`).join('')}</div>
    <div class="mmedit">${edSvg()}</div>
    <label class="field" style="margin-top:14px"><span>${t('Map name')}</span><input id="ed-name" type="text" maxlength="40" value="${esc(e.name)}"></label>
    <label class="check"><input id="ed-odd" type="checkbox" ${e.odd ? 'checked' : ''}> ${t('Odd columns lower')}</label>
    <div class="row"><button class="btn" data-act="mmcancel">${t('Cancel')}</button><button class="btn primary" data-act="mmsave">${t('Save map')}</button></div>`, 'mmcancel');
  const svg = g.querySelector('#ed-svg'); let down = false;
  const paintAt = ev => {
    const el = document.elementFromPoint(ev.clientX, ev.clientY); if (!el || !el.dataset || el.dataset.c === undefined) return;
    const c = +el.dataset.c, r = +el.dataset.r, tool = MM.ed.tool, gr = MM.ed.grid;
    if (gr[r][c] === tool) return;
    const dirty = [[c, r]];
    if ('HA1234'.includes(tool)) for (let rr = 0; rr < gr.length; rr++) for (let cc = 0; cc < gr[rr].length; cc++) if (gr[rr][cc] === tool) { gr[rr][cc] = '.'; dirty.push([cc, rr]); }
    gr[r][c] = tool; if (dirty.length > 1) svg.innerHTML = Array.from({ length: gr.length }, (_, rr) => gr[rr].map((_, cc) => edCellHtml(cc, rr)).join('')).join(''); else { const p = svg.querySelector(`polygon[data-c="${c}"][data-r="${r}"]`), nx = p.nextElementSibling; if (nx && nx.tagName === 'text') nx.remove(); p.outerHTML = edCellHtml(c, r); }
  };
  svg.addEventListener('pointerdown', ev => { down = true; svg.setPointerCapture && svg.setPointerCapture(ev.pointerId); paintAt(ev); ev.preventDefault(); });
  svg.addEventListener('pointermove', ev => { if (down) paintAt(ev); });
  const up = () => { down = false; }; svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  g.querySelector('#ed-odd').onchange = ev => { MM.ed.odd = ev.target.checked; MM.ed.name = $('#ed-name').value; editorScreen(); };
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
  mmtool(b) { MM.ed.tool = b.dataset.t; b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); },
  mmcancel() { const e = MM.ed; MM.ed = null; if (e && e.id) mapDetail(e.id); else mapManager(); },
  mmsave() { saveEdit(); },
  eimport() { importDlg(); }
});
