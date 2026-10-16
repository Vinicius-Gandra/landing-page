/* Interface do laboratório elétrico · bobina pré-formada do estator (Design de Bobinas rev. 00). */
(() => {
  'use strict';
  const engine = window.VGElectrical;
  const drawing = window.VGCoilDrawing;
  const $ = id => document.getElementById(id);
  const form = $('e-form'), output = $('e-output'), errorBox = $('e-error'), workspace = $('e-workspace');
  if (!engine || !form || !output) return;

  const CASE_KEY = 'vg-electrical-coil-v5';
  const VIEW_KEY = 'vg-electrical-view';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const controls = new Map();
  let timer = null, last = null, lastTitle = '', spy = null, sheetZoom = 1;

  /* ---- Utilidades ---------------------------------------------------------- */
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const add = (parent, tag, cls, text) => { const n = el(tag, cls, text); parent.append(n); return n; };
  const svg = (parent, tag, attrs = {}, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) n.setAttribute(k, String(v));
    if (text !== undefined) n.textContent = text;
    parent.append(n);
    return n;
  };
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const nf = (min, max) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
  const num = (x, d) => {
    if (!finite(x)) return '—';
    const a = Math.abs(x);
    return nf(0, d ?? (a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 3 : 4)).format(x);
  };
  const fx = (x, d = 2) => finite(x) ? nf(d, d).format(x) : '—';
  const unit = (x, u, d) => finite(x) ? `${num(x, d)} ${u}` : '—';
  const isMobile = () => matchMedia('(max-width: 1000px)').matches;
  function parseNumber(text) {
    const raw = String(text).trim().replace(/\s| /g, '');
    if (!raw) return null;
    let s = raw;
    if (raw.includes(',') && raw.includes('.')) s = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else if (raw.includes(',')) s = raw.replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }

  /* ---- Dica e aviso -------------------------------------------------------- */
  const tip = add(document.body, 'div', 'tip');
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  function bindTip(node, lines) {
    const move = e => {
      const r = e.clientX === undefined ? node.getBoundingClientRect() : null;
      const x = r ? r.left + r.width / 2 : e.clientX, y = r ? r.top : e.clientY;
      tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + 'px';
    };
    const show = e => { tip.replaceChildren(); lines.filter(Boolean).forEach((l, i) => add(tip, i ? 'span' : 'b', '', l)); tip.hidden = false; move(e); };
    node.addEventListener('pointerenter', show);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', () => { tip.hidden = true; });
    node.addEventListener('focus', show);
    node.addEventListener('blur', () => { tip.hidden = true; });
  }
  let toastTimer = null;
  function toast(text) {
    const t = $('e-toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---- Formulário ---------------------------------------------------------- */
  function buildForm() {
    engine.GROUPS.forEach((group, gi) => {
      const g = add(form, 'details', 'g' + (group.premise ? ' g-premise' : ''));
      g.dataset.group = group.id;
      g.open = !group.premise && group.id !== 'ident';
      const s = add(g, 'summary');
      add(s, 'span', 'g-n', String(gi + 1).padStart(2, '0'));
      const t = add(s, 'span', 'g-title', group.title);
      add(t, 'small', '', group.sub);
      add(s, 'span', 'g-count');
      add(s, 'span', 'g-arrow', '⌄').setAttribute('aria-hidden', 'true');
      const box = add(g, 'div', 'g-fields');
      for (const f of engine.FIELDS.filter(x => x.group === group.id)) {
        const id = 'f-' + f.key;
        const wrap = add(box, 'div', 'f' + (f.span ? ' f-wide' : ''));
        wrap.dataset.key = f.key;
        const top = add(wrap, 'div', 'f-top');
        const lab = add(top, 'label', 'f-label', f.label);
        lab.htmlFor = id;
        const norm = t2 => t2.toLowerCase().normalize('NFD').replace(/[^a-z0-9%]/g, '');
        const redundant = f.code && (norm(f.label).startsWith(norm(f.code)) || norm(f.code).startsWith(norm(f.label).slice(0, 10)));
        if (f.code && !redundant) { const c = add(top, 'span', 'f-code' + (f.code.length <= 8 ? ' f-code-short' : ''), f.code); c.title = 'Rótulo na FTD: ' + f.code; }
        const fbox = add(wrap, 'div', 'f-box');
        let control;
        if (f.type === 'select') {
          control = add(fbox, 'select');
          for (const [value, text] of f.options) { const o = add(control, 'option', '', text); o.value = value; }
          add(fbox, 'span', 'f-chev', '⌄').setAttribute('aria-hidden', 'true');
        } else {
          control = add(fbox, 'input');
          control.type = 'text';
          if (f.type !== 'text') control.inputMode = f.type === 'int' ? 'numeric' : 'decimal';
          control.autocomplete = 'off';
          control.spellcheck = false;
          control.enterKeyHint = 'next';
          control.placeholder = f.placeholder || (f.req ? 'Obrigatório' : '');
          if (f.unit) {
            fbox.classList.add('has-unit');
            fbox.style.setProperty('--unit-w', Math.max(2, f.unit.length) + 'ch');
            add(fbox, 'span', 'f-unit', f.unit).setAttribute('aria-hidden', 'true');
          }
        }
        control.id = id;
        control.name = f.key;
        control.dataset.type = f.type;
        const described = [];
        if (f.help) { const hp = add(wrap, 'small', 'f-help', f.help); hp.id = id + '-help'; described.push(hp.id); }
        const err = add(wrap, 'small', 'f-err');
        err.id = id + '-err';
        err.hidden = true;
        described.push(err.id);
        control.setAttribute('aria-describedby', described.join(' '));
        if (f.unit) control.setAttribute('aria-label', `${f.label} em ${f.unit}`);
        controls.set(f.key, control);
        control.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(recalculate, 220); });
        control.addEventListener('change', () => { clearTimeout(timer); recalculate(); });
        control.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const list = [...controls.values()].filter(c => c.offsetParent !== null);
          const next = list[list.indexOf(control) + 1];
          if (next) next.focus(); else control.blur();
        });
      }
    });
    form.addEventListener('submit', e => e.preventDefault());
  }
  function apply(values) {
    for (const [key, control] of controls) {
      const v = values[key];
      control.value = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    }
  }
  function collect() {
    const values = {};
    for (const [key, control] of controls) {
      const t = control.dataset.type;
      values[key] = t === 'select' || t === 'text' ? control.value.trim() : parseNumber(control.value);
    }
    return values;
  }
  function markFields(values, fieldErrors = {}) {
    let req = 0, filled = 0, bad = 0;
    const groups = {};
    for (const f of engine.FIELDS) {
      const control = controls.get(f.key);
      const wrap = control.closest('.f');
      const err = wrap.querySelector('.f-err');
      const v = values[f.key];
      const empty = v === null || v === '';
      const msg = fieldErrors[f.key];
      const premise = engine.GROUPS.find(g => g.id === f.group).premise;
      wrap.classList.toggle('is-empty', empty && !premise && f.type !== 'text');
      wrap.classList.toggle('is-bad', !!msg);
      control.setAttribute('aria-invalid', msg ? 'true' : 'false');
      err.hidden = !msg;
      err.textContent = msg ? msg.charAt(0).toUpperCase() + msg.slice(1) : '';
      const g = groups[f.group] ||= { total: 0, filled: 0, bad: 0, changed: 0, premise };
      if (premise) { if (!(v === f.def || (empty && (f.def === null || f.def === '')))) g.changed++; }
      else { g.total++; if (!empty) g.filled++; }
      if (msg) { g.bad++; bad++; }
      if (f.req && !premise) { req++; if (!empty && !msg) filled++; }
    }
    for (const det of form.querySelectorAll('.g')) {
      const g = groups[det.dataset.group];
      const c = det.querySelector('.g-count');
      c.className = 'g-count' + (g.bad ? ' is-bad' : !g.premise && g.filled === g.total ? ' is-done' : '');
      c.textContent = g.bad ? `${g.bad} a revisar` : g.premise ? (g.changed ? `${g.changed} alterado${g.changed > 1 ? 's' : ''}` : 'padrão') : `${g.filled}/${g.total}`;
      if (g.bad) det.open = true;
    }
    const p = $('e-progress');
    p.replaceChildren();
    p.classList.toggle('is-done', filled === req);
    add(p, 'span', '', filled === req ? 'Dados obrigatórios completos' : `${filled} de ${req} obrigatórios`);
    const track = add(p, 'span', 'e-progress-track');
    add(track, 'span', 'e-progress-fill').style.width = (filled / req * 100) + '%';
    const badge = $('e-mb-badge');
    badge.hidden = !bad;
    badge.textContent = bad;
  }

  /* ---- Cotas para os desenhos de tela -------------------------------------- */
  function arrowHead(g, x, y, dir) {
    const s = 5;
    const pts = { l: [[x, y], [x + s, y - s / 2], [x + s, y + s / 2]], r: [[x, y], [x - s, y - s / 2], [x - s, y + s / 2]],
      u: [[x, y], [x - s / 2, y + s], [x + s / 2, y + s]], d: [[x, y], [x - s / 2, y - s], [x + s / 2, y - s]] }[dir];
    svg(g, 'path', { d: 'M' + pts.map(p => p.join(' ')).join(' L') + ' Z', class: 'd-arrow' });
  }
  function dimH(g, x1, x2, y, text, { ext1, ext2, below = false } = {}) {
    if (ext1 !== undefined) svg(g, 'line', { x1, x2: x1, y1: ext1, y2: y + (below ? 4 : -4), class: 'd-ext' });
    if (ext2 !== undefined) svg(g, 'line', { x1: x2, x2, y1: ext2, y2: y + (below ? 4 : -4), class: 'd-ext' });
    svg(g, 'line', { x1, x2, y1: y, y2: y, class: 'd-dim' });
    arrowHead(g, x1, y, 'l'); arrowHead(g, x2, y, 'r');
    svg(g, 'text', { x: (x1 + x2) / 2, y: below ? y + 14 : y - 5, class: 'd-txt', 'text-anchor': 'middle' }, text);
  }
  function dimV(g, x, y1, y2, text, { ext1, ext2, left = false } = {}) {
    if (ext1 !== undefined) svg(g, 'line', { x1: ext1, x2: x + (left ? -4 : 4), y1, y2: y1, class: 'd-ext' });
    if (ext2 !== undefined) svg(g, 'line', { x1: ext2, x2: x + (left ? -4 : 4), y1: y2, y2, class: 'd-ext' });
    svg(g, 'line', { x1: x, x2: x, y1, y2, class: 'd-dim' });
    arrowHead(g, x, y1, 'u'); arrowHead(g, x, y2, 'd');
    if (left) { const tx = x - 6, ty = (y1 + y2) / 2; svg(g, 'text', { x: tx, y: ty, class: 'd-txt', 'text-anchor': 'middle', transform: `rotate(-90 ${tx} ${ty})` }, text); }
    else svg(g, 'text', { x: x + 6, y: (y1 + y2) / 2 + 4, class: 'd-txt', 'text-anchor': 'start' }, text);
  }

  function turnFigure(parent, r) {
    const w = r.wire, sl = r.slot;
    const tW = w.Fl * (w.Lf + sl.Aif), tH = w.Fa * (w.Af + sl.Aif);
    const sc = Math.min(30, 330 / tW, 150 / tH);
    const W = tW * sc, H = tH * sc;
    const ml = 66, mt = 34, mr = 70, mb = 38;
    const fig = add(parent, 'figure');
    const g = svg(fig, 'svg', { viewBox: `0 0 ${W + ml + mr} ${H + mt + mb}`, role: 'img',
      'aria-label': `Seção de uma espira: ${w.Fl} por ${w.Fa} fios de ${fx(w.Lf)} por ${fx(w.Af)} milímetros.` });
    const x0 = ml, y0 = mt;
    let first = null;
    for (let j = 0; j < w.Fa; j++) for (let i = 0; i < w.Fl; i++) {
      const x = x0 + i * (w.Lf + sl.Aif) * sc, y = y0 + j * (w.Af + sl.Aif) * sc;
      const hit = svg(g, 'g', { class: 'd-hit', tabindex: 0 });
      svg(hit, 'rect', { x, y, width: (w.Lf + sl.Aif) * sc, height: (w.Af + sl.Aif) * sc, rx: Math.min(8, (w.r + sl.Aif / 2) * sc), class: 'd-strand-ins' });
      svg(hit, 'rect', { x: x + sl.Aif / 2 * sc, y: y + sl.Aif / 2 * sc, width: w.Lf * sc, height: w.Af * sc, rx: Math.min(7, w.r * sc), class: 'd-cu' });
      bindTip(hit, [`Fio ${j * w.Fl + i + 1} de ${w.n}`, `nu ${fx(w.Lf)} × ${fx(w.Af)} mm · r ${fx(w.r)}`, `isolado ${fx(w.Lf + sl.Aif)} × ${fx(w.Af + sl.Aif)} mm`, `secção ${num(w.Sw, 3)} mm²`]);
      if (!first) first = { x: x + sl.Aif / 2 * sc, y: y + sl.Aif / 2 * sc };
    }
    dimH(g, first.x, first.x + w.Lf * sc, 16, `Lf ${fx(w.Lf)}`, { ext1: first.y, ext2: first.y });
    dimV(g, x0 + W + 22, first.y, first.y + w.Af * sc, `Af ${fx(w.Af)}`, { ext1: x0 + W, ext2: x0 + W });
    dimH(g, x0, x0 + W, y0 + H + 20, fx(tW), { ext1: y0 + H, ext2: y0 + H, below: true });
    dimV(g, x0 - 18, y0, y0 + H, fx(tH), { ext1: x0, ext2: x0, left: true });
    add(fig, 'figcaption', '', 'Uma espira em escala (mm): cobre e isolamento de cada fio. Toque num fio para ver as dimensões.').setAttribute('aria-hidden', 'true');
  }

  function slotFigure(parent, r) {
    const v = r.input, w = r.wire, k = r.coil, sl = r.slot;
    const sc = Math.min(3.8, 380 / v.d12), zs = Math.min(8, 380 / k.Ab, 210 / k.Lb);
    const slotW = v.w12 * sc, slotH = v.d12 * sc, zoomW = k.Lb * zs, zoomH = k.Ab * zs;
    const ox = 84, oy = 34, gapX = 90;
    const zx = ox + slotW + gapX, zy = oy + Math.max(0, (slotH - zoomH) / 2);
    const W = zx + zoomW + 120, H = Math.max(slotH, zoomH) + oy + 46;
    const fig = add(parent, 'figure', 'fig');
    const scroller = add(fig, 'div', 'fig-scroll');
    const g = svg(scroller, 'svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Ranhura com duas bobinas de ${fx(k.Lb)} por ${fx(k.Ab)} milímetros.` });
    const wedge = sl.cunha * sc;
    svg(g, 'rect', { x: ox, y: oy, width: slotW, height: slotH, class: 'd-slot' });
    svg(g, 'rect', { x: ox, y: oy, width: slotW, height: wedge, class: 'd-wedge' });
    const cx = ox + (slotW - k.Lb * sc) / 2;
    const ext = (sl.Aim + sl.Aa + sl.Afc) / 2;
    let y = oy + wedge;
    const shim = h => { svg(g, 'rect', { x: ox + 1, y, width: slotW - 2, height: Math.max(1, h * sc), class: 'd-shim' }); y += h * sc; };
    const coil = n => {
      const hit = svg(g, 'g', { class: 'd-hit', tabindex: 0 });
      svg(hit, 'rect', { x: cx, y, width: k.Lb * sc, height: k.Ab * sc, rx: 2, class: 'd-ground' });
      svg(hit, 'rect', { x: cx + ext * sc, y: y + ext * sc, width: (k.Lb - 2 * ext) * sc, height: (k.Ab - 2 * ext) * sc, class: 'd-cu' });
      bindTip(hit, [`Bobina ${n}`, `${fx(k.Lb)} × ${fx(k.Ab)} mm`, `${v.espBob} espiras`]);
      const yy = y; y += k.Ab * sc; return yy;
    };
    shim(v.calcoTopo); const c1 = coil(1); shim(v.calcoMeio); coil(2); shim(v.calcoFundo);
    dimH(g, ox, ox + slotW, oy + slotH + 18, `W12 ${fx(v.w12, 3)}`, { ext1: oy + slotH, ext2: oy + slotH, below: true });
    dimV(g, ox - 20, oy, oy + slotH, `D12 ${fx(v.d12)}`, { ext1: ox, ext2: ox, left: true });
    dimV(g, ox - 54, oy + wedge, oy + slotH, `DS ${fx(v.ds)}`, { ext1: ox, ext2: ox, left: true });
    svg(g, 'text', { x: ox + slotW / 2, y: oy - 8, class: 'd-txt-muted', 'text-anchor': 'middle' }, 'cunha');
    svg(g, 'rect', { x: cx - 2, y: c1 - 2, width: k.Lb * sc + 4, height: k.Ab * sc + 4, class: 'd-zoom' });
    svg(g, 'line', { x1: cx + k.Lb * sc + 2, y1: c1 - 2, x2: zx, y2: zy, class: 'd-zoom' });
    svg(g, 'line', { x1: cx + k.Lb * sc + 2, y1: c1 + k.Ab * sc + 2, x2: zx, y2: zy + zoomH, class: 'd-zoom' });
    svg(g, 'rect', { x: zx, y: zy, width: zoomW, height: zoomH, rx: 3, class: 'd-ground' });
    const ix = zx + ext * zs, iy = zy + ext * zs;
    svg(g, 'rect', { x: ix, y: iy, width: k.Lbi * zs, height: k.Aib * zs, class: 'd-turn' });
    const gap = sl.Aie / 2 * zs;
    for (let t = 0; t < v.espBob; t++) for (let j = 0; j < w.Fa; j++) for (let i = 0; i < w.Fl; i++) {
      const x = ix + gap + i * (w.Lf + sl.Aif) * zs, yy = iy + gap + (t * w.Fa + j) * (w.Af + sl.Aif) * zs;
      svg(g, 'rect', { x, y: yy, width: (w.Lf + sl.Aif) * zs, height: (w.Af + sl.Aif) * zs, class: 'd-strand-ins' });
      svg(g, 'rect', { x: x + sl.Aif / 2 * zs, y: yy + sl.Aif / 2 * zs, width: w.Lf * zs, height: w.Af * zs, rx: 1.5, class: 'd-cu' });
    }
    dimH(g, zx, zx + zoomW, zy + zoomH + 18, `Lb ${fx(k.Lb)}`, { ext1: zy + zoomH, ext2: zy + zoomH, below: true });
    dimV(g, zx + zoomW + 18, zy, zy + zoomH, `Ab ${fx(k.Ab)}`, { ext1: zx + zoomW, ext2: zx + zoomW });
    dimH(g, zx, zx + ext * zs, zy - 12, `Aim/2 ${fx(ext)}`, { ext1: zy, ext2: zy });
    const legend = add(fig, 'div', 'legend-row');
    for (const [cls, label] of [['--mat-cu', 'Cobre'], ['--mat-strand', 'Isolamento do fio'], ['--mat-turn', 'Isolamento entre espiras'], ['--mat-ground', 'Isolamento para a massa'], ['--mat-shim', 'Calços'], ['--c-deemph-2', 'Cunha']]) {
      const sp = add(legend, 'span');
      add(sp, 'i').style.background = `var(${cls})`;
      sp.append(label);
    }
    const cap = add(fig, 'figcaption', '', `Em escala (mm). Calços: topo ${fx(v.calcoTopo)}, intermediário ${fx(v.calcoMeio)}, fundo ${fx(v.calcoFundo)}.`);
    add(cap, 'span', 'only-mobile', ' Arraste o desenho para o lado para ver a ampliação.');
  }

  /* ---- Orçamentos da ranhura ------------------------------------------------ */
  function budget(parent, title, totalLabel, total, segs) {
    const b = add(parent, 'article', 'budget');
    const h = add(b, 'div', 'budget-head');
    add(h, 'h3', '', title);
    add(h, 'span', '', `${totalLabel} = ${fx(total, 2)} mm`);
    const bar = add(b, 'div', 'budget-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', title + ': ' + segs.map(s => `${s.label} ${fx(Math.abs(s.value))} mm`).join(', '));
    const sum = segs.reduce((a, s) => a + Math.abs(s.value), 0);
    for (const s of segs) {
      if (Math.abs(s.value) < 1e-6) continue;
      const seg = add(bar, 'span', 'budget-seg ' + (s.value < 0 ? 'seg-over' : s.cls));
      seg.style.flex = `${Math.abs(s.value) / sum} 1 0`;
      seg.tabIndex = 0;
      bindTip(seg, [s.label, `${fx(s.value)} mm · ${nf(1, 1).format(Math.abs(s.value) / total * 100)} %`, s.note || '']);
    }
    const ul = add(b, 'ul', 'budget-legend');
    for (const s of segs) {
      if (Math.abs(s.value) < 1e-6 && !s.keep) continue;
      const li = add(ul, 'li');
      add(li, 'span', 'sw ' + (s.value < 0 ? 'seg-over' : s.cls));
      add(li, 'span', 'lbl', s.value < 0 ? s.label + ' · falta espaço' : s.label);
      add(li, 'span', 'val', fx(s.value) + ' mm');
      add(li, 'span', 'pct', nf(1, 1).format(Math.abs(s.value) / total * 100) + ' %');
    }
    const li = add(ul, 'li', 'is-total');
    add(li, 'span');
    add(li, 'span', 'lbl', 'Total');
    add(li, 'span', 'val', fx(total) + ' mm');
    add(li, 'span', 'pct', '100 %');
  }

  /* ---- Seções ------------------------------------------------------------------ */
  const SECTIONS = [
    ['corrente', 'Correntes e tensões', 'Itens 3.1, 3.2, 6.14 e 6.18: corrente de linha, de fase e na espira.'],
    ['condutor', 'Composição do condutor', 'A partir da FTD: a resistência por fase define a secção e a ranhura limita largura e altura. Cada arranjo de fios é testado.'],
    ['ranhura', 'Bobina na ranhura', 'Itens 3.3 a 3.5: secção da espira, largura e altura da bobina e sobras na ranhura.'],
    ['isolacao', 'Isolamento e ensaios', 'Item 3.6 (IEEE 522), item 6.12 e supressão de corona (POP-MTR-08002).'],
    ['violino', 'Violino e cabeça da bobina', 'Itens 3.7 a 3.11: parte reta, inclinação do braço, ângulos e parte curva.'],
    ['comprimento', 'Comprimento das espiras', 'Item 3.12: comprimento médio e total das espiras.'],
    ['resistencia', 'Resistências e perdas', 'Itens 3.13 e 3.14: bobina, grupo, fase com jumpers, anel e cabo, e linha.'],
    ['cobre', 'Cobre e carretéis', 'Itens 3.15 e 3.17.'],
    ['desenho', 'Desenho técnico A3 · opcional', 'Item 5.2: vistas, cortes, figuras A a D, quadro de dados e carimbo. Abra para gerar a folha.']
  ];
  function sectionKey(id, r) {
    const w = r.wire, k = r.coil;
    return {
      corrente: ['I na espira', unit(r.current.Ie, 'A', 2)],
      condutor: ['Condutor', `${w.Fl}×${w.Fa} · ${fx(w.Lf)} × ${fx(w.Af)}`],
      ranhura: ['Bobina', `${fx(k.Lb)} × ${fx(k.Ab)} mm`],
      isolacao: ['Surge test bobina', unit(r.ins.Vsb, 'V', 0)],
      violino: ['Violino Cv', unit(r.head.Cv, 'mm', 1)],
      comprimento: ['Cme', unit(r.lengths.Cme, 'mm', 1)],
      resistencia: ['R por fase', unit(r.res.Rf / 1000, 'Ω', 4)],
      cobre: ['Cobre total', unit(r.copper.Mtot, 'kg', 1)],
      desenho: ['Folha', 'A3 · S/E']
    }[id];
  }
  function stepRow(parent, s) {
    const row = add(parent, 'div', 'step');
    const what = add(row, 'div', 'step-what');
    add(what, 'strong', '', s.title);
    if (s.source) add(what, 'small', '', s.source);
    const math = add(row, 'div', 'step-math');
    add(math, 'code', 'step-formula', s.formula);
    const sub = add(math, 'code', 'step-subst', s.subst);
    const resText = finite(s.value) ? `${num(s.value)}${s.unit ? ' ' + s.unit : ''}` : (s.value === null && !s.unit && s.comment ? s.comment : null);
    if (resText) { sub.append(' = '); add(sub, 'span', 'step-res', resText); }
    if (s.comment && resText !== s.comment) add(row, 'p', 'step-note', s.comment);
  }
  function alternatives(parent, r) {
    const box = add(parent, 'div', 'alts');
    const head = add(box, 'div', 'alts-head');
    add(head, 'h4', '', `Composições avaliadas · ${r.okCount} de ${r.candidates.length} atendem`);
    const tog = add(head, 'div', 'seg-toggle');
    tog.setAttribute('role', 'group');
    tog.setAttribute('aria-label', 'Filtrar composições');
    const list = add(box, 'div');
    const initial = isMobile() ? 'atendem' : 'todas';
    const draw = mode => {
      list.replaceChildren();
      const hdr = add(list, 'div', 'alt-row is-hdr');
      for (const h of ['Fl × Fa', 'Fio Lf × Af', 'Secção', 'J', 'R fase', 'Sobra altura', 'Resultado']) add(hdr, 'span', '', h);
      for (const c of r.candidates.filter(c => mode === 'todas' || c.fits || c.chosen)) {
        const row = add(list, 'div', 'alt-row' + (c.chosen ? ' is-chosen' : c.fits ? '' : ' is-out'));
        add(row, 'span', 'alt-arr', `${c.Fl} × ${c.Fa}`);
        const fio = add(row, 'span', 'alt-fio');
        add(fio, 'span', 'alt-k', 'Fio Lf × Af');
        fio.append(finite(c.Af) && c.Af > 0 ? `${fx(c.Lf)} × ${fx(c.Af)} mm` : '—');
        for (const [k, val] of [['Secção', unit(c.Se, 'mm²', 2)], ['J', unit(c.J, 'A/mm²', 2)], ['R fase', finite(c.R) ? unit(c.R, 'Ω', 4) : '—'], ['Sobra altura', unit(c.sobraA, 'mm', 2)]]) {
          const sp = add(row, 'span');
          add(sp, 'span', 'alt-k', k);
          sp.append(val);
        }
        const st = add(row, 'span', 'alt-st');
        add(st, 'span', 'chip ' + (c.chosen ? 'chip-ok' : c.fits ? '' : 'chip-fail'), c.chosen ? '✓ Escolhido' : c.fits ? 'Atende' : 'Não atende');
        if (c.reason) add(row, 'span', 'alt-why', c.reason.charAt(0).toUpperCase() + c.reason.slice(1) + '.');
      }
    };
    for (const [mode, label] of [['atendem', 'Só as que atendem'], ['todas', 'Todas']]) {
      const b = add(tog, 'button', '', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(mode === initial));
      b.addEventListener('click', () => { for (const x of tog.children) x.setAttribute('aria-pressed', String(x === b)); draw(mode); });
    }
    draw(initial);
    add(box, 'p', 'alts-foot', 'Fl = fios na largura, Fa = fios na altura (itens 2.44 e 2.45). Sobra na altura conforme item 3.5. Para usar outro arranjo, preencha "Fixar fios" em Fabricação e limites.');
  }

  /* ---- Folha de desenho ---------------------------------------------------- */
  function sheetSection(parent, r) {
    if (!drawing) { add(parent, 'p', 'step-note', 'Módulo de desenho não carregado.'); return; }
    const markup = drawing.render(r);
    const box = add(parent, 'div', 'sheet');
    const bar = add(box, 'div', 'sheet-bar');
    const zoomOut = add(bar, 'button', 'sheet-btn', '−'); zoomOut.type = 'button'; zoomOut.setAttribute('aria-label', 'Diminuir');
    const zoomLabel = add(bar, 'span', 'sheet-zoom', '');
    const zoomIn = add(bar, 'button', 'sheet-btn', '+'); zoomIn.type = 'button'; zoomIn.setAttribute('aria-label', 'Aumentar');
    const fit = add(bar, 'button', 'sheet-btn sheet-btn-text', 'Ajustar'); fit.type = 'button';
    add(bar, 'span', 'sheet-spacer');
    const dl = add(bar, 'button', 'sheet-btn sheet-btn-text', '↓ SVG'); dl.type = 'button'; dl.title = 'Baixar o desenho em SVG (abre em CAD e no navegador)';
    const pr = add(bar, 'button', 'sheet-btn sheet-btn-text sheet-btn-primary', '▣ Imprimir A3'); pr.type = 'button';
    const view = add(box, 'div', 'sheet-view');
    view.tabIndex = 0;
    view.setAttribute('role', 'img');
    view.setAttribute('aria-label', 'Folha A3 do desenho da bobina do estator.');
    const paper = add(view, 'div', 'sheet-paper');
    paper.innerHTML = markup;
    const setZoom = z => {
      sheetZoom = Math.max(1, Math.min(4, z));
      paper.style.width = (sheetZoom * 100) + '%';
      zoomLabel.textContent = Math.round(sheetZoom * 100) + ' %';
    };
    setZoom(sheetZoom);
    zoomIn.addEventListener('click', () => setZoom(sheetZoom * 1.4));
    zoomOut.addEventListener('click', () => setZoom(sheetZoom / 1.4));
    fit.addEventListener('click', () => setZoom(1));
    const fileName = `bobina-estator${r.input.os ? '-' + r.input.os.replace(/[^\w-]/g, '') : ''}`;
    dl.addEventListener('click', () => {
      const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', markup], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = el('a'); a.href = url; a.download = fileName + '.svg';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast('Desenho baixado em SVG');
    });
    pr.addEventListener('click', () => {
      const wnd = window.open('', '_blank');
      if (!wnd) { toast('Permita janelas pop-up para imprimir'); return; }
      wnd.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${fileName}</title><style>@page{size:A3 landscape;margin:0}html,body{margin:0;background:#fff}svg{display:block;width:420mm;height:297mm}</style></head><body>${markup}<script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script></body></html>`);
      wnd.document.close();
    });
    add(parent, 'p', 'step-note sheet-note', 'Desenho esquemático, como no item 5.2: as cotas são os valores calculados. O SVG abre no navegador e pode ser importado em CAD; para PDF use "Imprimir A3".');
  }

  /* ---- Renderização -------------------------------------------------------------- */
  function render(r) {
    last = r;
    const w = r.wire, k = r.coil, v = r.input, sl = r.slot;
    output.replaceChildren();
    if (window.VGCoilHMI) output.append(window.VGCoilHMI.render(r));
    for (const n of r.notes) {
      const a = add(output, 'div', 'e-alert e-alert-' + n.severity);
      add(a, 'span', 'e-alert-mark', n.severity === 'fail' ? '!' : n.severity === 'warn' ? '△' : 'i').setAttribute('aria-hidden', 'true');
      const box = add(a, 'div');
      add(box, 'strong', '', n.title);
      add(box, 'p', '', n.detail);
    }

    // Destaque
    const fits = k.sobraL >= 0 && k.sobraA >= 0 && w.fits;
    const hero = add(output, 'section', 'hero');
    hero.setAttribute('aria-label', 'Condutor calculado');
    const main = add(hero, 'div', 'hero-main');
    add(main, 'p', 'e-eyebrow', 'Condutor de cada espira');
    const h = add(main, 'h2', 'hero-title');
    const g1 = add(h, 'span', 'hero-grp');
    g1.append(`${w.Fl}`); add(g1, 'span', 'x', ' × '); g1.append(`${w.Fa} `); add(g1, 'small', '', w.n > 1 ? 'fios' : 'fio');
    h.append(' ');
    const g2 = add(h, 'span', 'hero-grp');
    g2.append(`${fx(w.Lf)}`); add(g2, 'span', 'x', ' × '); g2.append(`${fx(w.Af)} `); add(g2, 'small', '', 'mm');
    if (lastTitle && h.textContent !== lastTitle) h.classList.add('is-updated');
    lastTitle = h.textContent;
    const sub = add(main, 'p', 'hero-sub');
    add(sub, 'b', '', `${w.Fl} ${w.Fl > 1 ? 'fios' : 'fio'} na largura × ${w.Fa} na altura`);
    sub.append(`. Fio de cobre retangular, largura Lf × altura Af (item 2.40), quinas r = ${fx(w.r)} mm; com isolamento ${fx(w.Lf + sl.Aif)} × ${fx(w.Af + sl.Aif)} mm.`);
    const chips = add(main, 'div', 'hero-chips');
    add(chips, 'span', 'chip ' + (fits ? 'chip-ok' : 'chip-fail'), fits ? '✓ Cabe na ranhura' : '✗ Não cabe na ranhura');
    for (const [lab, val] of [['S', unit(k.Se, 'mm²', 2)], ['J', unit(k.J, 'A/mm²', 2)], ['Af/Lf', num(w.ratio, 3)]]) { const ch = add(chips, 'span', 'chip', lab + ' '); add(ch, 'b', '', val); }
    turnFigure(add(hero, 'div', 'hero-figure'), r);
    const kpis = add(hero, 'dl', 'hero-kpis');
    for (const [label, val, u, note, bad] of [
      ['Bobina isolada', `${fx(k.Lb)} × ${fx(k.Ab)}`, 'mm', `${v.espBob} espiras · Lb × Ab`],
      ['Sobra lateral', fx(k.sobraL), 'mm', 'item 3.5', k.sobraL < 0],
      ['Sobra na altura', fx(k.sobraA), 'mm', 'sob a cunha', k.sobraA < 0],
      ['R por fase · 25 °C', num(r.res.Rf / 1000, 4), 'Ω', w.byR ? `FTD: ${num(v.rFase, 4)} Ω` : '']
    ]) {
      const d = add(kpis, 'div', 'kpi' + (bad ? ' kpi-bad' : ''));
      add(d, 'dt', '', label);
      const dd = add(d, 'dd', '', val);
      add(dd, 'small', '', u);
      if (note) add(d, 'p', '', note);
    }

    // Orçamentos
    const b = add(output, 'section', 'budgets');
    b.setAttribute('aria-label', 'Ocupação da ranhura');
    budget(b, 'Largura da ranhura', 'W12', v.w12, [
      { label: 'Cobre', value: w.Fl * w.Lf, cls: 'seg-cu', note: `${w.Fl} × ${fx(w.Lf)} mm` },
      { label: 'Isolamento do fio', value: w.Fl * sl.Aif, cls: 'seg-strand', note: `${w.Fl} × Aif ${fx(sl.Aif)} mm` },
      { label: 'Isolamento entre espiras', value: sl.Aie, cls: 'seg-turn' },
      { label: 'Isolamento para a massa', value: sl.Aim + sl.Aa + sl.Afc, cls: 'seg-ground', note: 'Aim + Aa + Afc' },
      { label: 'Sobra', value: k.sobraL, cls: 'seg-gap', keep: true }
    ]);
    budget(b, 'Altura sob a cunha', 'DS', v.ds, [
      { label: 'Cobre', value: 2 * v.espBob * w.Fa * w.Af, cls: 'seg-cu', note: `2 bobinas × ${v.espBob} × ${w.Fa} × ${fx(w.Af)} mm` },
      { label: 'Isolamento do fio', value: 2 * v.espBob * w.Fa * sl.Aif, cls: 'seg-strand' },
      { label: 'Isolamento entre espiras', value: 2 * sl.Aie, cls: 'seg-turn' },
      { label: 'Isolamento para a massa', value: 2 * (sl.Aim + sl.Aa + sl.Afc), cls: 'seg-ground', note: '2 bobinas' },
      { label: 'Calços', value: sl.calcos, cls: 'seg-shim', note: `fundo ${fx(v.calcoFundo)} + meio ${fx(v.calcoMeio)} + topo ${fx(v.calcoTopo)}` },
      { label: 'Sobra', value: k.sobraA, cls: 'seg-gap', keep: true }
    ]);

    // Navegação
    const nav = add(output, 'nav', 'stepnav');
    nav.setAttribute('aria-label', 'Passos do cálculo');
    SECTIONS.forEach(([id, t], i) => {
      const a = add(nav, 'a');
      a.href = '#passo-' + id;
      add(a, 'span', 'stepnav-n', id === 'desenho' ? '✎' : i + 1);
      a.append(t);
    });

    // Passos
    SECTIONS.forEach(([id, t, intro], i) => {
      const steps = r.steps.filter(x => x.section === id);
      const sec = add(output, 'section', 'sec' + (id === 'desenho' ? ' sec-sheet' : ''));
      sec.id = 'passo-' + id;
      const det = add(sec, 'details');
      det.open = id !== 'desenho';
      const sm = add(det, 'summary');
      add(sm, 'span', 'sec-n', id === 'desenho' ? '✎' : i + 1);
      add(sm, 'h3', '', t);
      add(sm, 'p', 'sec-intro', intro);
      const [kl, kv] = sectionKey(id, r);
      const key = add(sm, 'div', 'sec-key');
      add(key, 'small', '', kl);
      add(key, 'b', '', kv);
      if (steps.length) { const list = add(det, 'div', 'steps'); for (const st of steps) stepRow(list, st); }
      if (id === 'condutor') alternatives(det, r);
      if (id === 'ranhura') slotFigure(det, r);
      if (id === 'desenho') {
        const load = () => { if (det.open && !det.dataset.loaded) { det.dataset.loaded = '1'; sheetSection(det, r); } };
        det.addEventListener('toggle', load);
        load();
      }
    });
    setupSpy(nav);
    updatePeek(r, 0);
  }

  function summaryText(r) {
    const v = r.input, w = r.wire, k = r.coil;
    return ['Bobina do estator · Design de Bobinas rev. 00',
      `${v.cliente || ''} ${v.os ? 'OS ' + v.os : ''}`.trim(),
      `Condutor: ${w.Fl} × ${w.Fa} fios de ${fx(w.Lf)} × ${fx(w.Af)} mm (Lf × Af), r ${fx(w.r)} mm`,
      `Secção da espira: ${fx(k.Se)} mm² · J ${fx(k.J)} A/mm²`,
      `Bobina isolada: ${fx(k.Lb)} × ${fx(k.Ab)} mm · sobras ${fx(k.sobraL)} / ${fx(k.sobraA)} mm`,
      `Violino Cv ${fx(r.head.Cv, 1)} mm · Φc ${fx(r.head.phiC, 0)} mm · Cme ${fx(r.lengths.Cme, 1)} mm`,
      `Rb ${fx(r.res.Rb)} mΩ · R fase ${fx(r.res.Rf / 1000, 4)} Ω · R linha ${fx(r.res.RL / 1000, 4)} Ω`,
      `Surge test bobina ${num(r.ins.Vsb, 0)} V · cobre ${fx(r.copper.Mcb)} kg/bobina, ${fx(r.copper.Mtot, 1)} kg total`,
      r.copper.reel ? `Carretéis: ${r.copper.reel.count} × ${fx(r.copper.reel.each, 1)} kg (${num(r.copper.reel.length, 0)} m)` : ''].filter(Boolean).join('\n');
  }

  function setupSpy(nav) {
    if (spy) spy.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const links = new Map([...nav.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a]));
    spy = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        for (const a of links.values()) a.classList.remove('is-active');
        const a = links.get(e.target.id);
        if (a) { a.classList.add('is-active'); a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      }
    }, { rootMargin: '-35% 0px -60% 0px' });
    for (const id of links.keys()) { const s = document.getElementById(id); if (s) spy.observe(s); }
  }

  /* ---- Celular ----------------------------------------------------------------- */
  function setView(view, scroll = true) {
    workspace.dataset.view = view;
    for (const b of document.querySelectorAll('.e-mobilebar button')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    $('e-peek').hidden = view !== 'dados';
    try { sessionStorage.setItem(VIEW_KEY, view); } catch (_) {}
    if (scroll && isMobile()) window.scrollTo({ top: 0 });
  }
  function updatePeek(r, missing) {
    const peek = $('e-peek');
    peek.classList.toggle('is-bad', !r);
    $('e-peek-value').textContent = r ? `${r.wire.Fl}×${r.wire.Fa} · ${fx(r.wire.Lf)} × ${fx(r.wire.Af)} mm` : `Faltam ${missing} dado${missing > 1 ? 's' : ''}`;
  }
  for (const b of document.querySelectorAll('.e-mobilebar button')) b.addEventListener('click', () => setView(b.dataset.view));
  $('e-peek-btn').addEventListener('click', () => setView('resultado'));

  /* ---- Cálculo ------------------------------------------------------------------ */
  function recalculate() {
    const values = collect();
    try { localStorage.setItem(CASE_KEY, JSON.stringify(values)); } catch (_) {}
    try {
      const r = engine.calculate(values);
      markFields(values);
      render(r);
      errorBox.hidden = true;
      output.classList.remove('is-stale');
      $('e-print').disabled = false;
      $('e-copy').disabled = false;
    } catch (err) {
      const isInput = err instanceof engine.InputError;
      if (!isInput) console.error(err);
      const fields = isInput ? err.fields : {};
      markFields(values, fields);
      const general = isInput ? err.errors.filter(m => !engine.FIELDS.some(f => m.startsWith(f.label + ':'))) : ['Não foi possível calcular. Revise os dados.'];
      const n = Object.keys(fields).length;
      errorBox.replaceChildren();
      add(errorBox, 'strong', '', n ? `${n} campo${n > 1 ? 's' : ''} a preencher ou revisar` : 'Não foi possível compor a bobina');
      const ul = add(errorBox, 'ul');
      for (const m of general) add(ul, 'li', '', m);
      for (const [key, m] of Object.entries(fields)) {
        const li = add(ul, 'li');
        const a = add(li, 'a', '', engine.FIELD[key].label);
        a.href = '#f-' + key;
        a.addEventListener('click', e => { e.preventDefault(); setView('dados', false); const c = controls.get(key); c.closest('details').open = true; c.focus(); c.scrollIntoView({ block: 'center' }); });
        li.append(': ' + m);
      }
      errorBox.hidden = false;
      output.classList.toggle('is-stale', !!output.firstChild);
      $('e-print').disabled = true;
      $('e-copy').disabled = true;
      updatePeek(null, n || 1);
    }
  }
  function copySummary() {
    if (!last) return;
    const text = summaryText(last);
    const done = () => toast('Resumo copiado');
    const fallback = () => {
      const ta = add(document.body, 'textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      ta.select();
      try { document.execCommand('copy'); done(); } catch (_) { toast('Não foi possível copiar'); }
      ta.remove();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function printPage() {
    clearTimeout(timer);
    recalculate();
    if (!errorBox.hidden) return;
    for (const d of output.querySelectorAll('.sec:not(.sec-sheet) > details')) d.open = true;
    window.print();
  }

  $('e-reset').addEventListener('click', () => { apply(engine.EXAMPLE); recalculate(); toast('FTD de exemplo carregada'); });
  $('e-clear').addEventListener('click', () => {
    const current = collect();
    const next = { ...engine.EMPTY };
    for (const f of engine.FIELDS) if (engine.GROUPS.find(g => g.id === f.group).premise) next[f.key] = current[f.key];
    apply(next);
    recalculate();
    setView('dados');
    for (const d of form.querySelectorAll('.g:not(.g-premise)')) d.open = true;
    controls.get('cliente').focus();
  });
  $('e-copy').addEventListener('click', copySummary);
  $('e-print').addEventListener('click', printPage);
  window.addEventListener('beforeprint', () => { for (const d of output.querySelectorAll('.sec:not(.sec-sheet) > details')) d.open = true; });
  $('e-theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.getAttribute('data-theme') === 'dark' || (!root.hasAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('vg-theme', next); } catch (_) {}
  });

  buildForm();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(CASE_KEY) || 'null'); } catch (_) {}
  apply(saved && typeof saved === 'object' ? { ...engine.EXAMPLE, ...saved } : engine.EXAMPLE);
  let view = 'resultado';
  try { view = sessionStorage.getItem(VIEW_KEY) || 'resultado'; } catch (_) {}
  setView(view, false);
  recalculate();
})();
