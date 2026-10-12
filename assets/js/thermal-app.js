/* Interface do laboratório térmico · área mínima do trocador ar–água (IC81). */
(() => {
  'use strict';
  const engine = window.VGThermal;
  const figs = window.VGThermalFigures;
  const drawing = window.VGThermalDrawing;
  const $ = id => document.getElementById(id);
  const form = $('t-form'), output = $('t-output'), errorBox = $('t-error'), workspace = $('t-workspace');
  if (!engine || !figs || !form || !output) return;

  const CASE_KEY = 'vg-thermal-cooler-v1';
  const VIEW_KEY = 'vg-thermal-view';
  const SEC_KEY = 'vg-thermal-sections';
  const HXVIEW_KEY = 'vg-thermal-hxview';
  const controls = new Map(), helps = new Map(), readouts = new Map();
  const { fx, f0 } = engine;
  let timer = null, last = null, lastTitle = '', spy = null, finBox = null, sheetZoom = 1, hxView = 'conjunto', hxPinned = null, viewer = null;
  try { hxView = sessionStorage.getItem(HXVIEW_KEY) || 'conjunto'; } catch (_) {}
  let secOpen = {};
  try { secOpen = JSON.parse(sessionStorage.getItem(SEC_KEY) || '{}') || {}; } catch (_) { secOpen = {}; }

  /* ---- Utilidades ---------------------------------------------------------- */
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const add = (parent, tag, cls, text) => { const n = el(tag, cls, text); parent.append(n); return n; };
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const isMobile = () => matchMedia('(max-width: 1000px)').matches;
  const plural = (n, s, p) => n === 1 ? s : p;
  function parseNumber(text) {
    const raw = String(text).trim().replace(/\s| /g, '');
    if (!raw) return null;
    let s = raw;
    if (raw.includes(',') && raw.includes('.')) s = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else if (raw.includes(',')) s = raw.replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }
  const nb = (v, u) => `${v}\u00a0${u}`;
  const toInput = v => v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);

  /* ---- Dica e aviso -------------------------------------------------------- */
  const tip = add(document.body, 'div', 'tip');
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  function placeTip(x, y) {
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + 'px';
  }
  function fillTip(lines) { tip.replaceChildren(); lines.filter(Boolean).forEach((l, i) => add(tip, i ? 'span' : 'b', '', l)); tip.hidden = false; }
  // dica de gráfico: o valor vem primeiro, a série depois, com uma chave de linha na cor da série
  function tipRows(title, rows) {
    tip.replaceChildren();
    if (title) add(tip, 'b', '', title);
    for (const row of rows) {
      const sp = add(tip, 'span', 'tip-row');
      if (row.key) add(sp, 'i', 'tip-key').style.background = row.key;
      add(sp, 'strong', '', row.value);
      if (row.label) sp.append(' ' + row.label);
    }
    tip.hidden = false;
  }
  function bindTip(node, lines) {
    const move = e => { const r = e.clientX === undefined ? node.getBoundingClientRect() : null; placeTip(r ? r.left + r.width / 2 : e.clientX, r ? r.top : e.clientY); };
    node.addEventListener('pointerenter', e => { fillTip(lines); move(e); });
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', () => { tip.hidden = true; });
    node.addEventListener('focus', e => { fillTip(lines); move(e); });
    node.addEventListener('blur', () => { tip.hidden = true; });
  }
  let toastTimer = null;
  function toast(text) {
    const t = $('t-toast');
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
      g.open = !group.premise && !group.closed;
      const s = add(g, 'summary');
      add(s, 'span', 'g-n', String(gi + 1).padStart(2, '0'));
      const t = add(s, 'span', 'g-title', group.title);
      add(t, 'small', '', group.sub);
      add(s, 'span', 'g-count');
      add(s, 'span', 'g-arrow', '⌄').setAttribute('aria-hidden', 'true');
      const box = add(g, 'div', 'g-fields');
      for (const f of engine.FIELDS.filter(x => x.group === group.id)) {
        if (f.type === 'calc') {
          const c = add(box, 'div', 'f-calc' + (f.key === 'rdArea' ? ' is-final' : ''));
          const lab = add(c, 'span', 'f-calc-label');
          add(lab, 'span', 'f-calc-tag', 'calculado');
          add(lab, 'span', '', f.label);
          if (f.sym) add(lab, 'span', 'f-code', f.sym);
          const value = add(c, 'output', 'f-calc-value', '—');
          const note = add(c, 'span', 'f-calc-note', '');
          readouts.set(f.key, { value, note });
          continue;
        }
        const id = 'f-' + f.key;
        const wrap = add(box, 'div', 'f' + (f.span ? ' f-wide' : ''));
        wrap.dataset.key = f.key;
        const top = add(wrap, 'div', 'f-top');
        const lab = add(top, 'label', 'f-label', f.label);
        lab.htmlFor = id;
        if (f.sym) { const c = add(top, 'span', 'f-code', f.sym); c.title = 'Símbolo usado na memória de cálculo'; }
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
          control.placeholder = f.type === 'text' ? (f.placeholder || 'Opcional') : f.req ? 'Obrigatório' : `padrão ${toInput(f.def)}`;
          if (f.type === 'text') control.maxLength = 80;
          if (f.unit) {
            fbox.classList.add('has-unit');
            fbox.style.setProperty('--unit-w', Math.max(2, f.unit.length) + 'ch');
            add(fbox, 'span', 'f-unit', f.unit).setAttribute('aria-hidden', 'true');
          }
        }
        control.id = id;
        control.name = f.key;
        control.dataset.type = f.type;
        const foot = add(wrap, 'div', 'f-foot');
        const hp = add(foot, 'small', 'f-help', f.help || '');
        hp.id = id + '-help';
        hp.hidden = !f.help;
        helps.set(f.key, hp);
        const err = add(foot, 'small', 'f-err');
        err.id = id + '-err';
        err.hidden = true;
        control.setAttribute('aria-describedby', `${hp.id} ${err.id}`);
        if (f.unit) control.setAttribute('aria-label', `${f.label} em ${f.unit}`);
        controls.set(f.key, control);
        control.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => recalculate(), 200); });
        control.addEventListener('change', () => { clearTimeout(timer); recalculate(); });
        control.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const list = [...controls.values()].filter(c => c.offsetParent !== null);
          const next = list[list.indexOf(control) + 1];
          if (next) next.focus(); else control.blur();
        });
      }
      if (group.id === 'superficie' && drawing) {
        finBox = el('div', 'f-figure');
        box.prepend(finBox);
        g.addEventListener('focusin', e => hotKey(e.target.name));
        g.addEventListener('focusout', () => hotKey(null));
      }
    });
    form.addEventListener('submit', e => e.preventDefault());
  }
  // figura do tubo aletado: a cota do campo em foco acende no desenho
  function hotKey(key) {
    const svg = finBox?.querySelector('svg');
    if (!svg) return;
    svg.querySelectorAll('.is-focus').forEach(n => n.classList.remove('is-focus'));
    const nodes = key ? svg.querySelectorAll(`[data-key="${key}"]`) : [];
    svg.classList.toggle('has-focus', nodes.length > 0);
    nodes.forEach(n => n.classList.add('is-focus'));
  }
  function updateFinFigure(values) {
    if (!finBox || !drawing) return;
    const svg = drawing.finFigure(values);
    if (!svg) return;
    finBox.innerHTML = svg + '<p>Toque num campo abaixo para ver onde fica a cota.</p>';
    const a = document.activeElement;
    if (a && a.name && finBox.parentElement.contains(a)) hotKey(a.name);
  }
  function apply(values) {
    for (const [key, control] of controls) {
      const f = engine.FIELD[key];
      const v = values[key];
      if (f.type === 'select') control.value = f.options.some(o => o[0] === v) ? v : f.def;
      else if (f.type === 'text') control.value = v == null ? '' : String(v);
      else control.value = toInput(v);
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
  function setHelp(key, text) { const h = helps.get(key); if (!h) return; h.textContent = text || ''; h.hidden = !text; }
  function markFields(values, fieldErrors = {}) {
    let req = 0, filled = 0, bad = 0;
    const groups = {};
    for (const f of engine.FIELDS) {
      if (f.type === 'calc') continue;
      const control = controls.get(f.key);
      const wrap = control.closest('.f');
      const err = wrap.querySelector('.f-err');
      const v = values[f.key];
      const empty = v === null || v === '';
      const msg = fieldErrors[f.key];
      const grp = engine.GROUPS.find(g => g.id === f.group);
      wrap.classList.toggle('is-empty', empty && f.type !== 'select' && f.type !== 'text');
      wrap.classList.toggle('is-bad', !!msg);
      control.setAttribute('aria-invalid', msg ? 'true' : 'false');
      err.hidden = !msg;
      err.textContent = msg ? msg.charAt(0).toUpperCase() + msg.slice(1) + '.' : '';
      const g = groups[f.group] ||= { total: 0, filled: 0, bad: 0, changed: 0, premise: !!grp.premise };
      if (grp.premise) { if (!(v === f.def || empty)) g.changed++; }
      else if (f.type !== 'select') { g.total++; if (!empty) g.filled++; }
      if (msg) { g.bad++; bad++; }
      if (f.req) { req++; if (!empty && !msg) filled++; }
    }
    for (const det of form.querySelectorAll('.g')) {
      const g = groups[det.dataset.group];
      const c = det.querySelector('.g-count');
      c.className = 'g-count' + (g.bad ? ' is-bad' : !g.premise && g.filled === g.total ? ' is-done' : '');
      c.textContent = g.bad ? `${g.bad} a revisar` : g.premise ? (g.changed ? `${g.changed} ${plural(g.changed, 'alterado', 'alterados')}` : 'padrão') : `${g.filled}/${g.total}`;
      if (g.bad) det.open = true;
    }
    const p = $('t-progress');
    p.replaceChildren();
    p.classList.toggle('is-done', filled === req);
    add(p, 'span', '', filled === req ? 'Dados obrigatórios completos' : `${filled} de ${req} obrigatórios`);
    const track = add(p, 'span', 't-progress-track');
    add(track, 'span', 't-progress-fill').style.width = (filled / req * 100) + '%';
    const badge = $('t-mb-badge');
    badge.hidden = !bad;
    badge.textContent = bad;
  }
  function updateForm(r, values) {
    const fans = finite(values.fans) ? Math.round(values.fans) : null;
    setHelp('fans', fans === 1 ? 'Só LA' : fans === 2 ? 'LA + LOA' : fans > 2 ? `LA + LOA + ${fans - 2}` : 'LA + LOA');
    for (const [key, off] of [['uOverall', values.uMode !== 'manual'], ['ambT', !(values.rh > 0)]]) controls.get(key).closest('.f').classList.toggle('is-off', off);
    updateFinFigure(values);
    const set = (key, v, n) => { const o = readouts.get(key); o.value.textContent = v; o.note.textContent = n; };
    if (!r) {
      for (const key of readouts.keys()) set(key, '—', 'Complete ou revise os dados.');
      return;
    }
    const d = r.d, cntp = d.flowRef !== 'real';
    setHelp('altitude', `p = ${fx(r.p / 1000, 3)} kPa${d.altitude === 0 ? ' (CNTP)' : ''}`);
    setHelp('ambT', d.rh > 0 ? `w = ${fx(r.w * 1000, 1)} g/kg · orvalho ${fx(r.dew, 1)} °C` : 'Só usada com UR > 0.');
    setHelp('waterQuality', `Rf = ${fx(r.foul.rf * 1e4, 2)}·10⁻⁴ m²K/W = ${fx(r.foul.rf * 1.163, 5)} h·m²·°C/kcal (TEMA).`);
    setHelp('ventLoss', finite(r.fanPower) ? `Ventiladores LA/LOA ≈ ${fx(r.fanPower, 1)} kW pelo Δp (grupo 08). Mancais não entram.` : 'Ventiladores e atrito do rotor com o ar.');
    setHelp('uOverall', d.uMode === 'manual' ? `A superfície L-fin daria ${fx(r.Ucalc, 1)} W/m²K.` : 'Só com "Informar um valor de U".');
    const adj = (r.qFrame > 0 ? ` − ${fx(r.qFrame)} carcaça` : '') + (r.qMargin > 0 ? ` + ${fx(r.qMargin)} margem` : '');
    set('rdQ', `${fx(r.qDesign)} kW`, `${fx(r.qElec)} + ${fx(r.qVent)} + ${fx(r.qExtra)}${adj} · mancais (${fx(r.qBearing, 1)} kW) fora`);
    set('rdFlow', `${fx(r.flowTotal)} m³/s`, `${r.fans} × ${fx(r.flowPerFan)} ${cntp ? 'na CNTP' : 'reais'} → ${fx(r.mMoist)} kg/s · Ċar ${fx(r.cAir)} kW/K`);
    set('rdTh', `${fx(r.Th, 1)} °C`, `Tf ${fx(r.Tc, 1)} + Q/Ċar (${fx(r.qDesign, 1)} ÷ ${fx(r.cAir)}) = +${fx(r.dTair)} K`);
    set('rdTwo', `${fx(r.waterOut, 1)} °C`, `Tw,e ${fx(d.waterIn, 1)} + Q/Ċw (${fx(r.qDesign, 1)} ÷ ${fx(r.cW)}) = +${fx(r.waterRise)} K`);
    set('rdArea', `${f0(r.areaMin)} m²`, `UA ${fx(r.UA)} kW/K ÷ U ${fx(r.U, 1)} W/m²K · ${r.modules} × ${f0(r.areaMinUnit)} m²`);
  }

  /* ---- Destaque, sequência e orçamentos -------------------------------------- */
  function heroSection(r) {
    const d = r.d;
    const hero = add(output, 'section', 'hero');
    hero.setAttribute('aria-label', 'Área mínima calculada');
    const main = add(hero, 'div', 'hero-main');
    add(main, 'p', 't-eyebrow', 'Área mínima de troca · já com incrustação');
    const h = add(main, 'h2', 'hero-title');
    h.append(`${f0(r.areaMin)} `);
    add(h, 'small', '', 'm²');
    if (lastTitle && h.textContent !== lastTitle) h.classList.add('is-updated');
    lastTitle = h.textContent;
    const split = add(main, 'p', 'hero-split');
    split.append(`${r.modules} ${plural(r.modules, 'unidade', 'unidades')} × `);
    add(split, 'b', '', nb(f0(r.areaMinUnit), 'm²'));
    split.append(` · face mínima ${r.modules}\u00a0×\u00a0${nb(fx(r.frontalArea), 'm²')}`);
    const sub = add(main, 'p', 'hero-sub');
    sub.append('Para tirar ');
    add(sub, 'b', '', nb(fx(r.qDesign, 1), 'kW'));
    sub.append(' do ar: ele volta ao trocador a ');
    add(sub, 'b', '', nb(fx(r.Th, 1), '°C'));
    sub.append(' e precisa sair a ');
    add(sub, 'b', '', nb(fx(r.Tc, 1), '°C'));
    sub.append('. A água entra a ');
    add(sub, 'b', '', nb(fx(d.waterIn, 1), '°C'));
    sub.append(' com ');
    add(sub, 'b', '', nb(fx(r.qvWh, 2), 'm³/h'));
    sub.append(' e sai a ');
    add(sub, 'b', '', nb(fx(r.waterOut, 1), '°C'));
    sub.append('.');
    const chips = add(main, 'div', 'hero-chips');
    const hard = r.eps > 0.85;
    add(chips, 'span', 'chip ' + (hard ? 'chip-warn' : 'chip-ok'), hard ? '△ Efetividade exigente' : '✓ Viável com folga');
    for (const [lab, val] of [['ε', fx(r.eps, 3)], ['NTU', fx(r.NTU, 3)], ['LMTD', nb(fx(r.LMTD), 'K')]]) { const ch = add(chips, 'span', 'chip', lab + ' '); add(ch, 'b', '', val); }

    // perfil de temperaturas
    const figBox = add(hero, 'div', 'hero-figure');
    const pf = figs.profileSVG(r);
    if (pf) {
      const fig = add(figBox, 'figure');
      const lg = add(fig, 'div', 'pf-legend');
      for (const [c, t] of [['--air-hot', 'Ar'], ['--water', 'Água']]) { const s = add(lg, 'span'); add(s, 'i').style.background = `var(${c})`; s.append(t); }
      const wrap = add(fig, 'div', 'pf-wrap');
      wrap.innerHTML = pf.svg;
      profileHover(wrap, pf);
      add(fig, 'figcaption', '', `A faixa entre as curvas é a força motriz: ${fx(r.dTh, 1)} K na entrada do ar e ${fx(r.dTc, 1)} K na saída (LMTD ${fx(r.LMTD)} K). Quanto mais estreita, mais área.`);
    }

    const kpis = add(hero, 'dl', 'hero-kpis');
    const cntp = d.flowRef !== 'real';
    for (const [label, tag, val, u, note, cls] of [
      ['Carga no trocador', 'def', fx(r.qDesign, 1), 'kW', `${f0(r.qDesign * engine.KW_TO_KCALH)} kcal/h · mancais fora`],
      ['Ar quente → trocador', 'calc', fx(r.Th, 1), '°C', `Tf ${fx(r.Tc, 1)} + ΔT ${fx(r.dTair, 1)} K`],
      ['Água sai', 'calc', fx(r.waterOut, 1), '°C', `Tw,e ${fx(d.waterIn, 1)} + ΔT ${fx(r.waterRise, 1)} K`],
      ['UA requerido', 'calc', fx(r.UA), 'kW/K', `ε ${fx(r.eps, 3)} · NTU ${fx(r.NTU, 3)}`],
      ['Vazão de ar', 'def', fx(r.flowTotal), 'm³/s', `${r.fans} × ${fx(r.flowPerFan)} ${cntp ? 'CNTP' : 'reais'} · ${fx(r.mMoist)} kg/s`],
      ['Vazão de água', 'def', fx(r.qvWh, 2), 'm³/h', `${fx(r.mdotW)} kg/s · ${fx(r.waterVel)} m/s nos tubos`, r.waterVel > r.mat.vmax ? 'kpi-bad' : ''],
      ['U de referência', r.manual ? 'def' : 'ref', fx(r.U, 1), 'W/m²K', r.manual ? `manual · L-fin daria ${fx(r.Ucalc, 1)}` : `limpo ${fx(r.UcalcClean, 1)} · incrustação TEMA`],
      ['Δp de ar no trocador', 'calc', f0(r.dpAir), 'Pa', `disponível ${f0(d.airDpAllow)} Pa · ${r.rows} ${plural(r.rows, 'fileira', 'fileiras')}`, r.dpAir > d.airDpAllow ? 'kpi-warn' : '']
    ]) {
      const k = add(kpis, 'div', 'kpi' + (cls ? ' ' + cls : ''));
      const dt = add(k, 'dt', '', label);
      add(dt, 'span', 'kpi-tag ' + (tag === 'calc' ? 'is-calc' : 'is-def'), tag === 'calc' ? 'calc.' : tag === 'ref' ? 'ref.' : 'dado');
      const dd = add(k, 'dd', '', val);
      add(dd, 'small', '', u);
      add(k, 'p', '', note);
    }
  }
  function profileHover(wrap, pf) {
    const svg = wrap.querySelector('svg');
    const cross = svg.querySelector('.pf-cross'), da = svg.querySelector('.pf-dot-air'), dw = svg.querySelector('.pf-dot-water');
    const PF = figs.PF, n = pf.pts.length;
    let idx = Math.round((n - 1) / 2);
    const draw = (i, viaKey) => {
      idx = Math.max(0, Math.min(n - 1, i));
      const p = pf.pts[idx], cx = pf.X(p.x);
      for (const [node, a] of [[cross, { x1: cx, x2: cx }], [da, { cx, cy: pf.Y(p.ta) }], [dw, { cx, cy: pf.Y(p.tw) }]]) {
        for (const [k, v] of Object.entries(a)) node.setAttribute(k, v);
        node.setAttribute('visibility', 'visible');
      }
      tipRows(`${f0(p.x * 100)} % do caminho do ar`, [
        { key: 'var(--air-hot)', value: `${fx(p.ta)} °C`, label: 'ar' },
        { key: 'var(--water)', value: `${fx(p.tw)} °C`, label: 'água' },
        { value: `${fx(p.ta - p.tw)} K`, label: 'de diferença' }
      ]);
      const rect = svg.getBoundingClientRect();
      placeTip(rect.left + cx / PF.W * rect.width, rect.top + pf.Y(p.ta) / PF.H * rect.height - (viaKey ? 4 : 0));
    };
    const fromEvent = e => {
      const rect = svg.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / rect.width * PF.W;
      draw(Math.round(Math.min(1, Math.max(0, (sx - PF.x0) / (PF.x1 - PF.x0))) * (n - 1)));
    };
    const hide = () => { for (const node of [cross, da, dw]) node.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointermove', fromEvent);
    svg.addEventListener('pointerdown', fromEvent);
    svg.addEventListener('pointerleave', hide);
    wrap.tabIndex = 0;
    wrap.setAttribute('aria-label', 'Perfil de temperaturas: use as setas para percorrer o trocador');
    wrap.addEventListener('focus', () => draw(idx, true));
    wrap.addEventListener('blur', hide);
    wrap.addEventListener('keydown', e => {
      const step = e.shiftKey ? 6 : 1;
      if (e.key === 'ArrowRight') { e.preventDefault(); draw(idx + step, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); draw(idx - step, true); }
      else if (e.key === 'Home') { e.preventDefault(); draw(0, true); }
      else if (e.key === 'End') { e.preventDefault(); draw(n - 1, true); }
    });
  }
  function alertsSection(r) {
    for (const c of r.checks.filter(x => x.sev === 'fail' || x.sev === 'warn')) {
      const a = add(output, 'div', 't-alert t-alert-' + c.sev);
      add(a, 'span', 't-alert-mark', c.sev === 'fail' ? '!' : '△').setAttribute('aria-hidden', 'true');
      const box = add(a, 'div');
      add(box, 'strong', '', c.title);
      add(box, 'p', '', c.detail);
    }
  }
  function seqSection(r) {
    const d = r.d;
    const box = add(output, 'section', 'seqflow');
    box.setAttribute('aria-label', 'Sequência do projeto');
    const head = add(box, 'div', 'seqflow-head');
    add(head, 'h3', '', 'Sequência do projeto');
    const p = add(head, 'p');
    for (const [cls, t] of [['', 'dado definido'], ['is-calc', 'calculado (consequência)']]) { const s = add(p, 'span'); add(s, 'i', 'seq-key ' + cls); s.append(t); }
    const ol = add(box, 'ol', 'seq');
    const stages = [
      ['Calor no ar', [['def', 'Q', `${fx(r.qDesign)} kW`, 'perdas elétricas + ventilação + outras'], ['ref', 'Pmanc', `${fx(r.qBearing, 1)} kW`, 'mancais: saem pelo óleo, fora da carga']]],
      ['Ar na máquina', [['def', 'V̇', `${fx(r.flowTotal)} m³/s`, `${r.fans} ${plural(r.fans, 'ramo', 'ramos')} × ${fx(r.flowPerFan)}${d.flowRef === 'real' ? ' reais' : ' CNTP'}`], ['def', 'Tf', `${fx(r.Tc, 1)} °C`, 'ar frio exigido na entrada'], ['calc', 'Tq', `${fx(r.Th, 1)} °C`, `Tf + Q/Ċar = +${fx(r.dTair)} K`]]],
      ['Água', [['def', 'Tw,e', `${fx(d.waterIn, 1)} °C`, 'água entrando'], ['def', 'V̇w', `${fx(r.qvWh, 2)} m³/h`, `${fx(r.mdotW)} kg/s no total`], ['calc', 'Tw,s', `${fx(r.waterOut, 1)} °C`, `Tw,e + Q/Ċw = +${fx(r.waterRise)} K`]]],
      ['Trocador', [['calc', 'UA', `${fx(r.UA)} kW/K`, `ε–NTU: ε ${fx(r.eps, 3)}, NTU ${fx(r.NTU, 3)}`], [r.manual ? 'def' : 'ref', 'U', `${fx(r.U, 1)} W/m²K`, r.manual ? 'informado' : 'superfície de referência L-fin'], ['final', 'A', `${f0(r.areaMin)} m²`, `UA / U · ${r.modules} × ${f0(r.areaMinUnit)} m²`]]]
    ];
    stages.forEach(([title, rows], i) => {
      const li = add(ol, 'li', 'seq-stage');
      const st = add(li, 'strong');
      add(st, 'span', 'seq-n', i + 1);
      st.append(title);
      const dl = add(li, 'dl');
      dl.style.display = 'grid'; dl.style.gap = '6px'; dl.style.margin = '0';
      for (const [kind, sym, val, note] of rows) {
        const row = add(dl, 'div', 'seq-row' + (kind === 'calc' ? ' is-calc' : kind === 'final' ? ' is-calc is-final' : kind === 'ref' ? ' is-ref' : ''));
        add(row, 'dt', '', sym);
        add(row, 'dd', '', val);
        add(row, 'small', '', note);
      }
    });
  }
  function budget(parent, title, headText, segs, opts = {}) {
    const b = add(parent, 'article', 'budget');
    const h = add(b, 'div', 'budget-head');
    add(h, 'h3', '', title);
    add(h, 'span', '', headText);
    const bar = add(b, 'div', 'budget-bar');
    bar.setAttribute('role', 'img');
    const unit = opts.unit || '';
    const dg = opts.d ?? 1;
    const sum = segs.reduce((a, s) => a + Math.max(0, s.value), 0);
    bar.setAttribute('aria-label', title + ': ' + segs.filter(s => s.value > 0).map(s => `${s.label} ${fx(s.value, dg)} ${unit}`).join(', '));
    for (const s of segs) {
      if (!(s.value > 1e-9)) continue;
      const seg = add(bar, 'span', 'budget-seg ' + s.cls);
      seg.style.flex = `${s.value / sum} 1 0`;
      seg.tabIndex = 0;
      bindTip(seg, [s.label, `${fx(s.value, dg)} ${unit} · ${fx(s.value / sum * 100, 1)} %`, s.note || '']);
    }
    const ul = add(b, 'ul', 'budget-legend');
    for (const s of segs) {
      if (!(s.value > 1e-9) && !s.keep) continue;
      const li = add(ul, 'li');
      add(li, 'span', 'sw ' + s.cls);
      const lbl = add(li, 'span', 'lbl', s.label);
      if (s.tag) add(lbl, 'em', '', s.tag);
      add(li, 'span', 'val', `${fx(s.value, dg)} ${unit}`);
      add(li, 'span', 'pct', sum > 0 ? fx(s.value / sum * 100, 1) + ' %' : '—');
    }
    for (const x of opts.extra || []) {
      const li = add(ul, 'li');
      add(li, 'span');
      add(li, 'span', 'lbl', x.label);
      add(li, 'span', 'val', x.value);
      add(li, 'span', 'pct', '');
    }
    if (opts.total) {
      const li = add(ul, 'li', 'is-total');
      add(li, 'span');
      add(li, 'span', 'lbl', opts.total.label);
      add(li, 'span', 'val', opts.total.value);
      add(li, 'span', 'pct', opts.total.pct || '');
    }
    if (opts.note) add(b, 'p', 'budget-note', opts.note);
  }
  function budgetsSection(r) {
    const box = add(output, 'section', 'budgets');
    box.setAttribute('aria-label', 'Composição do calor e das resistências térmicas');
    const totalLoss = r.qElec + r.qVent + r.qExtra + r.qBearing;
    const extra = [];
    if (r.qFrame > 0) extra.push({ label: 'Dissipado pela carcaça', value: `− ${fx(r.qFrame, 1)} kW` });
    if (r.qMargin > 0) extra.push({ label: 'Margem de projeto', value: `+ ${fx(r.qMargin, 1)} kW` });
    budget(box, 'Calor da máquina', `perdas totais ${fx(totalLoss, 1)} kW`, [
      { label: 'Perdas elétricas', value: r.qElec, cls: 'seg-air', tag: '→ trocador', keep: true },
      { label: 'Ventilação no ar', value: r.qVent, cls: 'seg-air-2', tag: '→ trocador' },
      { label: 'Outras no ar', value: r.qExtra, cls: 'seg-air-3', tag: '→ trocador' },
      { label: 'Mancais', value: r.qBearing, cls: 'seg-oil', tag: '→ óleo', note: 'Sai pelo óleo e pela caixa do mancal' }
    ], { unit: 'kW', d: 1, extra, total: { label: 'Carga no trocador', value: `${fx(r.qDesign, 1)} kW`, pct: totalLoss > 0 ? fx(r.qDesign / totalLoss * 100, 1) + ' %' : '' },
      note: 'Só o calor que fica no ar do circuito fechado passa pelo trocador.' });
    const R = r.res;
    budget(box, 'Resistências térmicas · 1/U', `1/U = ${fx(r.Rtot * 1000)} m²K/kW`, [
      { label: 'Ar e aletas', value: R.Ro * 1000, cls: 'seg-air', tag: '1/(η0·ho)', keep: true },
      { label: 'Incrustação do ar', value: R.Rfo * 1000, cls: 'seg-air-3' },
      { label: 'Contato da aleta', value: R.Rc * 1000, cls: 'seg-metal-2' },
      { label: `Parede (${r.mat.label.toLowerCase()})`, value: R.Rw * 1000, cls: 'seg-metal' },
      { label: 'Convecção da água', value: R.Ri * 1000, cls: 'seg-water', tag: '(Ao/Ai)/hi' },
      { label: 'Incrustação da água', value: R.Rf * 1000, cls: 'seg-water-2', tag: 'TEMA' }
    ], { unit: 'm²K/kW', d: 2, total: { label: 'U de referência', value: `${fx(r.Ucalc, 1)} W/m²K`, pct: '' },
      note: r.manual ? `U informado: ${fx(r.U, 1)} W/m²K. A composição acima é a da superfície de referência.` : 'Referidas à área externa aletada. O lado do ar domina: é ele que define a área.' });
  }
  /* ---- O trocador por dentro: vistas com balões e lista de itens ------------------------- */
  function viewerSection(r) {
    if (!drawing) return;
    const lay = drawing.layout(r), P = drawing.parts(r, lay), PM = new Map(P.map(p => [p.id, p]));
    const box = add(output, 'section', 'hxbox');
    box.id = 'trocador';
    box.setAttribute('aria-label', 'O trocador por dentro');
    const head = add(box, 'div', 'hxbox-head');
    const ht = add(head, 'div');
    add(ht, 'h3', '', 'O trocador por dentro');
    const p = add(ht, 'p');
    p.append('Exemplo de montagem por unidade: face de ');
    add(p, 'b', '', nb(`${fx(r.d.tubeLength, 2)} × ${fx(r.faceHeight, 2)}`, 'm'));
    p.append(`, ${r.rows} ${plural(r.rows, 'fileira', 'fileiras')} de ${r.npr} tubos e ${r.passes} ${plural(r.passes, 'passe', 'passes')} de água: `);
    add(p, 'b', '', nb(fx(r.areaGeoUnit, 0), 'm²'));
    p.append(` montados para ${f0(Math.ceil(r.areaMinUnit))} m² mínimos. Passe o mouse ou toque num item para achá-lo no desenho.`);
    const tabs = add(head, 'div', 'hx-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Vistas do trocador');
    const stage = add(box, 'div', 'hx-stage');
    const panes = new Map();
    for (const v of drawing.VIEWS) {
      const b = add(tabs, 'button', 'hx-tab');
      add(b, 'span', 'hx-tab-l', v.label);
      add(b, 'span', 'hx-tab-s', v.short || v.label).setAttribute('aria-hidden', 'true');
      b.type = 'button'; b.id = 'hxt-' + v.id; b.dataset.view = v.id;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'hxp-' + v.id);
      const pane = add(stage, 'figure', 'hx-pane');
      pane.id = 'hxp-' + v.id;
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', b.id);
      add(pane, 'p', 'hx-pane-title', v.title);
      const sc = add(pane, 'div', 'hx-scroll');
      const out = v.draw(r, { lay });
      sc.innerHTML = `<svg class="hxv" viewBox="0 0 ${out.W} ${out.H}" role="img" aria-label="${v.title}">${out.svg}</svg>`;
      const cap = add(pane, 'figcaption', 'hx-caption', v.caption(r));
      add(cap, 'span', 'only-mobile', ' Arraste o desenho para o lado; tocar num item leva até ele.');
      panes.set(v.id, { b, pane, sc, svg: sc.querySelector('svg'), start: v.start });
    }
    const lg = add(box, 'div', 'hx-legend');
    for (const [kind, val, label] of [['ln', '--air-hot', 'Ar quente'], ['ln', '--air-cold', 'Ar frio'], ['ln', '--water', 'Água'], ['sw', 'is-copper', 'Cobre'], ['sw', 'is-alu', 'Alumínio'], ['sw', 'is-steel', 'Aço'], ['tg', '', 'Valor calculado']]) {
      const sp = add(lg, 'span');
      const i = add(sp, 'i', kind + (kind === 'sw' ? ' ' + val : ''));
      if (kind === 'ln') i.style.background = `var(${val})`;
      sp.append(label);
    }
    const list = add(box, 'ol', 'hx-parts');
    list.setAttribute('aria-label', 'Itens do desenho');
    const items = new Map();
    for (const it of P) {
      const li = add(list, 'li');
      li.dataset.part = it.id;
      li.dataset.views = it.views.join(' ');
      const btn = add(li, 'button', 'hx-item');
      btn.type = 'button';
      btn.setAttribute('aria-label', `Item ${it.id}, ${it.name}: ${it.data}`);
      add(btn, 'span', 'hx-item-n', it.id).setAttribute('aria-hidden', 'true');
      const t = add(btn, 'span', 'hx-item-t');
      add(t, 'strong', '', it.name);
      add(t, 'small', '', it.data);
      items.set(it.id, li);
    }
    const clearHot = () => {
      for (const v of panes.values()) { v.svg.classList.remove('has-hot'); v.svg.querySelectorAll('.is-hot').forEach(n => n.classList.remove('is-hot')); }
      for (const li of items.values()) li.classList.remove('is-hot');
    };
    const setHot = id => {
      clearHot();
      if (!id) return;
      const cur = panes.get(hxView);
      const nodes = cur ? cur.svg.querySelectorAll(`[data-part="${id}"]`) : [];
      if (nodes.length) { cur.svg.classList.add('has-hot'); nodes.forEach(n => n.classList.add('is-hot')); }
      items.get(id)?.classList.add('is-hot');
      return nodes;
    };
    // no celular o desenho rola de lado: leva a peça destacada para o centro
    const reveal = nodes => {
      const cur = panes.get(hxView);
      if (!cur || !nodes.length || cur.sc.scrollWidth <= cur.sc.clientWidth + 2) return;
      let x0 = Infinity, x1 = -Infinity;
      for (const n of nodes) { try { const b = n.getBBox(); x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.width); } catch (_) { /* sem caixa */ } }
      if (!isFinite(x0)) return;
      const k = cur.svg.getBoundingClientRect().width / drawing.VW;
      cur.sc.scrollTo({ left: Math.max(0, (x0 + x1) / 2 * k - cur.sc.clientWidth / 2), behavior: 'smooth' });
    };
    const show = (id, focus = false) => {
      if (!panes.has(id)) id = 'conjunto';
      hxView = id;
      try { sessionStorage.setItem(HXVIEW_KEY, id); } catch (_) {}
      for (const [k, v] of panes) { const on = k === id; v.b.setAttribute('aria-selected', String(on)); v.b.tabIndex = on ? 0 : -1; v.pane.hidden = !on; }
      for (const li of items.values()) li.hidden = !li.dataset.views.split(' ').includes(id);
      hxPinned = null;
      clearHot();
      const { sc, start } = panes.get(id);
      requestAnimationFrame(() => { if (sc.scrollWidth > sc.clientWidth) sc.scrollLeft = start === 'center' ? (sc.scrollWidth - sc.clientWidth) / 2 : 0; });
      if (focus) panes.get(id).b.focus();
    };
    tabs.addEventListener('click', e => { const b = e.target.closest('.hx-tab'); if (b) show(b.dataset.view); });
    tabs.addEventListener('keydown', e => {
      const ids = drawing.VIEWS.map(v => v.id), i = ids.indexOf(hxView);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length], true); }
    });
    list.addEventListener('pointerover', e => { const li = e.target.closest('li'); if (li && !hxPinned) setHot(li.dataset.part); });
    list.addEventListener('pointerleave', () => { if (!hxPinned) clearHot(); });
    list.addEventListener('focusin', e => { const li = e.target.closest('li'); if (li) setHot(li.dataset.part); });
    list.addEventListener('focusout', () => { if (!hxPinned) clearHot(); });
    list.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      hxPinned = hxPinned === li.dataset.part ? null : li.dataset.part;
      const nodes = setHot(hxPinned);
      if (hxPinned) reveal([...nodes].filter(n => n.classList.contains('hx-part') || n.classList.contains('hx-bal')));
    });
    for (const v of panes.values()) {
      v.svg.addEventListener('pointerover', e => {
        const node = e.target.closest('[data-part]'), it = node && PM.get(node.dataset.part);
        if (!it) return;
        if (!hxPinned) setHot(it.id);
        fillTip([`${it.id} · ${it.name}`, it.data]);
        placeTip(e.clientX, e.clientY);
      });
      v.svg.addEventListener('pointermove', e => { if (!tip.hidden) placeTip(e.clientX, e.clientY); });
      v.svg.addEventListener('pointerout', e => {
        if (e.relatedTarget && v.svg.contains(e.relatedTarget) && e.relatedTarget.closest('[data-part]')) return;
        tip.hidden = true;
        if (!hxPinned) clearHot();
      });
      v.svg.addEventListener('click', e => { const node = e.target.closest('[data-part]'); hxPinned = node && hxPinned !== node.dataset.part ? node.dataset.part : null; setHot(hxPinned); });
    }
    show(hxView);
    viewer = {
      go(view, part) {
        show(view);
        hxPinned = part;
        const nodes = setHot(part);
        box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        setTimeout(() => reveal([...nodes].filter(n => n.classList.contains('hx-part') || n.classList.contains('hx-bal'))), 350);
        panes.get(hxView)?.b.focus({ preventScroll: true });
      }
    };
  }
  /* ---- Vazão de água × área mínima ------------------------------------------------------ */
  function flowExtras(det, r) {
    const values = collect();
    const q0 = r.qvWh, d = r.d;
    const qMin = r.qDesign * 1000 / (r.rhoW * 4180 * (r.Th - d.waterIn)) * 3600;
    const qa = qMin * 1.04, qb = Math.max(q0 * 2.4, qa * 3);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const q = qa * Math.pow(qb / qa, i / 40);
      try { const x = engine.calculate({ ...values, waterFlow: q }, { lite: true }); if (finite(x.areaMin)) pts.push({ q, A: x.areaMin, Two: x.waterOut, rise: x.waterRise }); } catch (_) { /* fora do domínio */ }
    }
    pts.push({ q: q0, A: r.areaMin, Two: r.waterOut, rise: r.waterRise, cur: true });
    pts.sort((a, b) => a.q - b.q);
    const ch = figs.flowSVG(pts, { q0, A0: r.areaMin, qMin, qMax: qb });
    if (!ch) return;
    add(det, 'p', 'sub-h', 'Quanto a vazão de água pesa na área');
    const fig = add(det, 'figure', 'chart');
    const wrap = add(fig, 'div', 'pf-wrap chart-wrap');
    wrap.innerHTML = ch.svg;
    const svg = wrap.querySelector('svg');
    const cross = svg.querySelector('.pf-cross'), dot = svg.querySelector('.fc-hover');
    const n = ch.pts.length;
    let idx = ch.pts.findIndex(p => p.cur);
    const drawAt = i => {
      idx = Math.max(0, Math.min(n - 1, i));
      const p = ch.pts[idx], cx = ch.X(p.q), cy = ch.Y(Math.min(p.A, ch.yMax));
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', p.A <= ch.yMax ? 'visible' : 'hidden');
      tipRows(`${fx(p.q, 2)} m³/h de água${p.cur ? ' · seu caso' : ''}`, [
        { key: 'var(--accent)', value: `${f0(p.A)} m²`, label: 'área mínima' },
        { value: `${fx(p.Two, 1)} °C`, label: `água sai (+${fx(p.rise, 1)} K)` }
      ]);
      const rect = svg.getBoundingClientRect();
      placeTip(rect.left + cx / ch.W * rect.width, rect.top + cy / ch.H * rect.height);
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    const fromEvent = e => {
      const rect = svg.getBoundingClientRect();
      const q = ch.Xinv((e.clientX - rect.left) / rect.width * ch.W);
      let best = 0;
      for (let i = 1; i < n; i++) if (Math.abs(ch.pts[i].q - q) < Math.abs(ch.pts[best].q - q)) best = i;
      drawAt(best);
    };
    svg.addEventListener('pointermove', fromEvent);
    svg.addEventListener('pointerdown', fromEvent);
    svg.addEventListener('pointerleave', hide);
    wrap.tabIndex = 0;
    wrap.setAttribute('aria-label', 'Área mínima em função da vazão de água: use as setas para percorrer');
    wrap.addEventListener('focus', () => drawAt(idx));
    wrap.addEventListener('blur', hide);
    wrap.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); drawAt(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); drawAt(idx - 1); }
    });
    const pick = [0.6, 0.8, 1, 1.25, 1.6, 2].map(k => k * q0).filter(q => q > qa);
    const rows = pick.map(q => {
      if (Math.abs(q - q0) < 1e-9) return { q, A: r.areaMin, Two: r.waterOut, cur: true };
      try { const x = engine.calculate({ ...values, waterFlow: q }, { lite: true }); return { q, A: x.areaMin, Two: x.waterOut }; } catch (_) { return null; }
    }).filter(Boolean);
    add(fig, 'figcaption', '', `Mesma carga, mesmo ar e mesma superfície; só a vazão de água muda. Abaixo de ${fx(qMin, 1)} m³/h a água sairia mais quente que o ar quente (${fx(r.Th, 1)} °C): não existe trocador. Perto desse limite a área dispara; acima de ~${fx(q0 * 1.6, 0)} m³/h ela quase não cai mais.`);
    const tdet = add(fig, 'details', 'chart-table');
    add(tdet, 'summary', '', 'Ver em tabela');
    table(tdet, ['Vazão de água (m³/h)', 'Água sai (°C)', 'Área mínima (m²)'], rows.map(x => ({ sel: x.cur, cells: [fx(x.q, 2), fx(x.Two, 1), f0(x.A)] })));
  }
  /* ---- Folha A3 ----------------------------------------------------------------------- */
  function sheetSection(det, r) {
    if (!drawing) { add(det, 'p', 'step-note', 'Módulo de desenho não carregado.'); return; }
    const markup = drawing.sheet(r, r.info || {});
    const box = add(det, 'div', 'sheet');
    const bar = add(box, 'div', 'sheet-bar');
    const mk = (text, cls, label) => { const b = add(bar, 'button', 'sheet-btn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; if (label) b.setAttribute('aria-label', label); return b; };
    const zoomOut = mk('−', '', 'Diminuir');
    const zoomLabel = add(bar, 'span', 'sheet-zoom', '');
    const zoomIn = mk('+', '', 'Aumentar');
    const fit = mk('Ajustar', 'sheet-btn-text');
    add(bar, 'span', 'sheet-spacer');
    const dl = mk('↓ SVG', 'sheet-btn-text');
    dl.title = 'Baixar o desenho em SVG (abre no navegador e em CAD)';
    const pr = mk('▣ Imprimir A3', 'sheet-btn-text sheet-btn-primary');
    const view = add(box, 'div', 'sheet-view');
    view.tabIndex = 0;
    view.setAttribute('role', 'img');
    view.setAttribute('aria-label', 'Folha A3 com o arranjo de referência do trocador ar–água.');
    const paper = add(view, 'div', 'sheet-paper');
    paper.innerHTML = markup;
    const setZoom = z => { sheetZoom = Math.max(1, Math.min(4, z)); paper.style.width = (sheetZoom * 100) + '%'; zoomLabel.textContent = Math.round(sheetZoom * 100) + ' %'; };
    setZoom(sheetZoom);
    zoomIn.addEventListener('click', () => setZoom(sheetZoom * 1.4));
    zoomOut.addEventListener('click', () => setZoom(sheetZoom / 1.4));
    fit.addEventListener('click', () => setZoom(1));
    const os = (r.info?.os || '').replace(/[^\w-]/g, '');
    const fileName = `trocador-ar-agua${os ? '-' + os : ''}`;
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
    add(det, 'p', 'step-note sheet-note', 'Arranjo de referência, como os quadros dos fornecedores: cotas calculadas e construtivas indicativas. O SVG abre no navegador e pode ser importado em CAD; para PDF use "Imprimir A3". Cliente, O.S. e equipamento vêm do grupo Identificação.');
  }

  /* ---- Seções ------------------------------------------------------------------ */
  const SECTIONS = [
    ['calor', 'Calor que fica no ar', 'Só as perdas que aquecem o ar do circuito fechado. As de mancal saem pelo óleo.'],
    ['ar', 'Ventilação e ar quente', 'Vazão dos ramos LA/LOA → massa de ar → elevação do ar na máquina. O ar quente é consequência.'],
    ['agua', 'Água de resfriamento', 'Entrada e vazão definidas pelo site; a temperatura de saída sai do balanço.'],
    ['ua', 'Efetividade e UA requerido', 'ε–NTU com as duas capacidades térmicas; o LMTD confere o resultado.'],
    ['u', 'Coeficiente global U', 'Superfície de referência L-fin: Briggs & Young no ar, Gnielinski na água, incrustação TEMA.'],
    ['area', 'Área mínima e face', 'A = UA / U, por unidade, e a face mínima pela velocidade frontal.'],
    ['hidraulica', 'Hidráulica e ventiladores', 'Δp de ar e de água no exemplo de montagem e potência dos ventiladores.'],
    ['n1', 'Unidade fora e enrolamento', 'O que acontece com a área mínima se uma unidade sair para limpeza.'],
    ['folha', 'Folha de dados para o fornecedor', 'No formato do quadro "Dados de projeto" dos fornecedores, por unidade. Copie e envie com a cotação.'],
    ['checks', 'Verificações', 'Todas as conferências automáticas, inclusive as que passaram.'],
    ['refs', 'Referências de projeto', 'Brown Boveri Review 1972, IEC 60034-1 e as correlações usadas.'],
    ['desenho', 'Desenho de referência A3 · opcional', 'Arranjo para acompanhar a cotação: vistas, lista de itens, dados de projeto e carimbo. Abra para gerar a folha.']
  ];
  const SEC_DEFAULT_CLOSED = new Set(['refs', 'desenho']);
  function sectionKey(id, r) {
    const nWarn = r.checks.filter(c => c.sev === 'warn').length, nFail = r.checks.filter(c => c.sev === 'fail').length;
    return {
      calor: ['Carga no trocador', `${fx(r.qDesign)} kW`],
      ar: ['Ar quente', `${fx(r.Th, 1)} °C`],
      agua: ['Água sai', `${fx(r.waterOut, 1)} °C`],
      ua: ['UA', `${fx(r.UA)} kW/K`],
      u: ['U', `${fx(r.U, 1)} W/m²K`],
      area: ['Área mínima', `${f0(r.areaMin)} m²`],
      hidraulica: ['Δp ar · água', `${f0(r.dpAir)} Pa · ${fx(r.tubeDp, 1)} kPa`],
      n1: r.modules >= 2 ? ['Ar quente N−1', `${fx(r.n1Th, 1)} °C`] : ['Enrolamento', `${fx(r.windN, 0)} °C`],
      folha: ['Por unidade', `${f0(r.rfq.capKcal)} kcal/h`],
      checks: ['Situação', nFail ? `${nFail} ${plural(nFail, 'falha', 'falhas')}` : nWarn ? `${nWarn} ${plural(nWarn, 'aviso', 'avisos')}` : 'tudo certo'],
      refs: ['Fonte', 'BBC 1972'],
      desenho: ['Folha', 'A3 · S/E']
    }[id];
  }
  // passos ligados a uma peça do desenho: vista e item
  const SEE = {
    'Perdas que ficam no ar': ['maquina', 'H'], 'Carga no trocador': ['maquina', 'A'],
    'Vazão total de ar': ['maquina', 'C'], 'Ar quente voltando ao trocador': ['maquina', 'F'], 'Vazão real nos ventiladores': ['maquina', 'C'],
    'Massa de água': ['passes', '5'], 'Água saindo do trocador': ['passes', '6'],
    'Área frontal mínima por unidade': ['conjunto', '8'], 'Tubos por fileira': ['conjunto', '1'], 'Velocidade mássica máxima': ['feixe', '1'],
    'Nusselt do ar · Briggs & Young': ['feixe', '1'], 'Eficiência da aleta · Schmidt': ['feixe', '12'], 'Eficiência da superfície': ['feixe', '12'],
    'Velocidade da água nos tubos': ['passes', '7'], 'h da água': ['feixe', '11'],
    'Área mínima total': ['conjunto', '1'], 'Face mínima total': ['conjunto', '8'],
    'Δp do ar no trocador · Robinson & Briggs': ['conjunto', '1'], 'Δp da água nos tubos': ['passes', '7'], 'Potência dos ventiladores': ['maquina', 'C'], 'Profundidade do feixe': ['conjunto', '1']
  };
  const VIEW_NAME = { maquina: 'na máquina', conjunto: 'conjunto', feixe: 'feixe e aleta', passes: 'passes de água' };
  function stepRow(parent, s) {
    const row = add(parent, 'div', 'step');
    const what = add(row, 'div', 'step-what');
    add(what, 'strong', '', s.title);
    if (s.source) add(what, 'small', '', s.source);
    const see = SEE[s.title];
    if (see && drawing) {
      const b = add(what, 'button', 'step-see');
      b.type = 'button';
      add(b, 'span', 'step-see-n', see[1]).setAttribute('aria-hidden', 'true');
      b.append(`ver no desenho · ${VIEW_NAME[see[0]]}`);
      b.setAttribute('aria-label', `Ver item ${see[1]} no desenho, vista ${VIEW_NAME[see[0]]}`);
      b.addEventListener('click', () => viewer?.go(see[0], see[1]));
    }
    const math = add(row, 'div', 'step-math');
    add(math, 'code', 'step-formula', s.formula);
    const sub = add(math, 'code', 'step-subst', s.subst);
    if (finite(s.value)) { sub.append(' = '); add(sub, 'span', 'step-res', `${fx(s.value, s.d ?? 2)}${s.unit ? ' ' + s.unit : ''}`); }
    if (s.comment) add(row, 'p', 'step-note', s.comment);
  }
  function table(parent, head, rows, cls = '') {
    const wrap = add(parent, 'div', 'tbl-wrap');
    const t = add(wrap, 'table', 'tbl' + (cls ? ' ' + cls : ''));
    if (head) { const tr = add(add(t, 'thead'), 'tr'); for (const h of head) add(tr, 'th', '', h); }
    const tb = add(t, 'tbody');
    for (const r of rows) {
      const tr = add(tb, 'tr', r.sel ? 'sel' : '');
      r.cells.forEach((c, i) => add(tr, 'td', r.cls?.[i] || '', c));
    }
    return t;
  }
  function areaExtras(det, r) {
    const d = r.d, g = r.g;
    add(det, 'p', 'sub-h', 'Exemplo de montagem por unidade · superfície de referência');
    table(det, null, [
      { cells: ['Tubo', `Ø ${fx(d.tubeOD)} × ${fx(d.tubeID)} mm`, `${r.mat.label} · ${fx(d.tubeLength)} m aletados`] },
      { cells: ['Aleta L-fin', `Ø ${fx(g.Df, 1)} mm · ${fx(d.fpi, 1)} FPI`, `altura ${fx(g.hf, 1)} mm · passo ${fx(g.pitchMM)} mm · e = ${fx(g.t)} mm`] },
      { cells: ['Face', `${fx(d.tubeLength)} × ${fx(r.faceHeight, 3)} m`, `${r.npr} tubos por fileira · mínima ${fx(r.frontalArea)} m² a ${fx(r.faceVel, 1)} m/s`] },
      { cells: ['Fileiras', String(r.rows), `passo ${fx(g.Pt)} × ${fx(g.Pl)} mm · profundidade ≈ ${f0(r.depth)} mm`] },
      { cells: ['Tubos', f0(r.tubes), `${r.passes} passes × ${fx(r.tpp, 1)} tubos · água a ${fx(r.waterVel)} m/s`] },
      { cells: ['Área montada', `${fx(r.areaGeoUnit, 1)} m²`, `mínima ${fx(r.areaMinUnit, 1)} m² · fileiras arredondadas para cima`] }
    ].map(x => ({ ...x, cls: ['', '', 'l dim'] })));
    add(det, 'p', 'sub-h', 'Sensibilidade ao arranjo · mesmas vazões e carga');
    table(det, ['Arranjo', 'NTU', 'UA (kW/K)', 'Área mín. (m²)'], r.arr.map(a => ({
      sel: a.t === d.hxType,
      cells: [`${engine.HX_LABEL[a.t]}${a.t === 'multipass' ? ` · N = ${r.passes}` : ''}`, fx(a.N, 3), fx(a.UA), finite(a.A) ? f0(a.A) : 'não atinge']
    })), 'arr');
  }
  function folhaExtras(det, r) {
    add(det, 'p', 'step-note', `Valores por unidade (${r.modules} ${plural(r.modules, 'unidade', 'unidades')}), nas unidades dos fornecedores. As três linhas destacadas são o que define o trocador.`).style.margin = '0 0 8px';
    table(det, ['Dados de projeto', 'Unid.', 'Lado externo · ar', 'Lado interno · água'], r.rfq.rows.map(x => ({ sel: x.key, cells: x.c })), 'rfq');
    add(det, 'p', 'sub-h', 'Exigências que acompanham a cotação');
    const ol = add(det, 'ol', 'rfq-req');
    for (const [b, t] of r.rfq.req) { const li = add(ol, 'li'); add(li, 'b', '', b); li.append(t); }
    const act = add(det, 'div', 'summary-actions');
    const btn = add(act, 'button', 'btn-soft', '⧉ Copiar folha de dados');
    btn.type = 'button';
    btn.addEventListener('click', copySheet);
  }
  function checksExtras(det, r) {
    const box = add(det, 'div', 'checks');
    const order = { fail: 0, warn: 1, info: 2, ok: 3 };
    for (const c of [...r.checks].sort((a, b) => order[a.sev] - order[b.sev])) {
      const row = add(box, 'div', 'check');
      const cls = { ok: 'chip-ok', warn: 'chip-warn', fail: 'chip-fail', info: 'chip-info' }[c.sev];
      add(row, 'span', 'chip ' + cls, { ok: '✓ ok', warn: '△ atenção', fail: '✗ falha', info: 'i nota' }[c.sev]);
      const t = add(row, 'div');
      add(t, 'strong', '', c.title);
      add(t, 'p', '', c.detail);
    }
  }
  const REFS = [
    ['IC81 = trocador sobre a máquina; IC91 = dutos', 'A faixa de síncronas de 250 a 11 200 kVA é oferecida em IP44 com trocador ar–água no topo (IC81) ou com conexão de dutos (IC91). O topo é o mais usado porque economiza piso; também é possível montar nas laterais ou dividir em quatro seções.', 'Kovacevic & van Stiphout, p. 571 · Kovacevic & Streck, p. 559'],
    ['Ventilação axial, radial ou combinada', 'Máquinas de 4 e 6 polos menores: axial. Multipolares: radial. 2 polos: combinada e simétrica, com o ar entrando pelas duas extremidades e saindo quente pelo centro, o mesmo princípio dos ramos LA e LOA.', 'Kovacevic & Streck, p. 560–563, fig. 4 e 6'],
    ['Material do tubo segue a qualidade da água', 'Água limpa e não corrosiva: tubos de aço com cabeçotes fixos (limpeza química). Água poluída ou corrosiva: cobre ou latão especial, cabeçotes removíveis para limpeza mecânica periódica.', 'Kovacevic & Streck, p. 559'],
    ['Seções superdimensionadas para limpar em operação', 'É comum pedir o trocador seccionado e superdimensionado para limpar um elemento de cada vez com a máquina em carga normal ou pouco reduzida. A seção "Unidade fora" quantifica isso.', 'Kovacevic & Streck, p. 559'],
    ['Condensado e vazamento não podem entrar na máquina', 'O trocador de topo recolhe o condensado numa bandeja que drena para fora, inclusive em caso de vazamento de tubo.', 'Kovacevic & Streck, p. 559 · Heil, p. 602–604'],
    ['A temperatura do enrolamento varia ao longo do comprimento', 'Com ventilação axial, só um trecho curto atinge a temperatura admissível e a média fica bem abaixo. A elevação média usada aqui não substitui o ponto quente.', 'Kovacevic & Streck, p. 561–563, fig. 8'],
    ['Isolação classe F, dados para classes B e F', 'As máquinas usam isolação classe F e os dados técnicos são dados tanto para as temperaturas da classe B quanto da classe F.', 'Kovacevic & van Stiphout, p. 572'],
    ['Escovas fora do circuito fechado', 'Com escovas e circuito fechado ar–água, anéis e escovas ficam separados e com exaustão própria. Essas perdas não entram na carga do trocador.', 'Kovacevic & Streck, p. 569']
  ];
  function refsExtras(det) {
    const box = add(det, 'div', 'refs');
    for (const [t, p, s] of REFS) { const c = add(box, 'div', 'ref'); add(c, 'strong', '', t); add(c, 'p', '', p); add(c, 'span', '', s); }
    const sc = add(det, 'p', 'scope');
    add(sc, 'b', '', 'Escopo do modelo. ');
    sc.append('Pré-dimensionamento 1D em regime permanente para entregar a área mínima ao fornecedor. Padrões: CNTP (0 °C, 101,325 kPa, ar seco) onde faz sentido físico; água a 25 °C e ar frio a 40 °C pela IEC 60034-1:2010, tabela 4. Propriedades reais da água e do ar nas temperaturas de operação. U estimado com tubo aletado L-fin: Briggs & Young (Re de ~1 100 a 18 000), Schmidt para a aleta, Gnielinski na água (VDI Heat Atlas), Robinson & Briggs para o Δp do ar (±25 %), incrustação TEMA, relações ε–NTU de Incropera & DeWitt. Brown Boveri Review 59 (12), dez. 1972.');
  }

  /* ---- Renderização ---------------------------------------------------------------- */
  function render(r) {
    last = r;
    output.replaceChildren();
    heroSection(r);
    alertsSection(r);
    seqSection(r);
    viewerSection(r);
    budgetsSection(r);
    const nav = add(output, 'nav', 'stepnav');
    nav.setAttribute('aria-label', 'Passos do cálculo');
    SECTIONS.forEach(([id, t], i) => {
      const a = add(nav, 'a');
      a.href = '#passo-' + id;
      add(a, 'span', 'stepnav-n', i + 1);
      a.append(t);
    });
    SECTIONS.forEach(([id, t, intro], i) => {
      const sec = add(output, 'section', 'sec' + (id === 'desenho' ? ' sec-sheet' : ''));
      sec.id = 'passo-' + id;
      const det = add(sec, 'details');
      det.open = id in secOpen ? !!secOpen[id] : !SEC_DEFAULT_CLOSED.has(id);
      det.addEventListener('toggle', () => { secOpen[id] = det.open; try { sessionStorage.setItem(SEC_KEY, JSON.stringify(secOpen)); } catch (_) {} });
      const sm = add(det, 'summary');
      add(sm, 'span', 'sec-n', i + 1);
      add(sm, 'h3', '', t);
      add(sm, 'p', 'sec-intro', intro);
      const [kl, kv] = sectionKey(id, r);
      const key = add(sm, 'div', 'sec-key');
      add(key, 'small', '', kl);
      add(key, 'b', '', kv);
      const steps = r.steps.filter(x => x.section === id);
      if (steps.length) { const list = add(det, 'div', 'steps'); for (const st of steps) stepRow(list, st); }
      if (id === 'agua') flowExtras(det, r);
      if (id === 'area') areaExtras(det, r);
      if (id === 'folha') folhaExtras(det, r);
      if (id === 'checks') checksExtras(det, r);
      if (id === 'refs') refsExtras(det);
      if (id === 'desenho') {
        const load = () => { if (det.open && !det.dataset.loaded) { det.dataset.loaded = '1'; sheetSection(det, r); } };
        det.addEventListener('toggle', load);
        load();
      }
    });
    setupSpy(nav);
    updatePeek(r);
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
    for (const b of document.querySelectorAll('.t-mobilebar button')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    $('t-peek').hidden = view !== 'dados';
    try { sessionStorage.setItem(VIEW_KEY, view); } catch (_) {}
    if (scroll && isMobile()) window.scrollTo({ top: 0 });
  }
  function updatePeek(r, text) {
    const peek = $('t-peek');
    peek.classList.toggle('is-bad', !r);
    $('t-peek-value').textContent = r ? `${f0(r.areaMin)} m² · ${r.modules} × ${f0(r.areaMinUnit)} m²` : text;
  }
  for (const b of document.querySelectorAll('.t-mobilebar button')) b.addEventListener('click', () => setView(b.dataset.view));
  $('t-peek-btn').addEventListener('click', () => setView('resultado'));

  /* ---- Cálculo ------------------------------------------------------------------ */
  let lastKey = '';
  function recalculate(force = false) {
    const values = collect();
    const key = JSON.stringify(values);
    if (!force && key === lastKey) return;          // nada mudou (ex.: o campo só perdeu o foco)
    lastKey = key;
    try { localStorage.setItem(CASE_KEY, key); } catch (_) {}
    try {
      const r = engine.calculate(values);
      markFields(values);
      updateForm(r, values);
      render(r);
      errorBox.hidden = true;
      output.classList.remove('is-stale');
      $('t-print').disabled = false;
      $('t-copy').disabled = false;
    } catch (err) {
      const isInput = err instanceof engine.InputError;
      if (!isInput) console.error(err);
      const fields = isInput ? err.fields : {};
      const general = isInput ? err.errors : ['Não foi possível calcular. Revise os dados.'];
      markFields(values, fields);
      updateForm(null, values);
      const keys = Object.keys(fields), n = keys.length;
      const missing = keys.filter(k => fields[k] === 'informe o valor').length;
      errorBox.replaceChildren();
      add(errorBox, 'strong', '', general.length ? 'Não fecha com esses dados' : missing === n && n ? `${plural(n, 'Falta', 'Faltam')} ${n} ${plural(n, 'dado', 'dados')}` : `${n} ${plural(n, 'campo', 'campos')} a revisar`);
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
      $('t-print').disabled = true;
      $('t-copy').disabled = true;
      updatePeek(null, general.length ? 'Não fecha · revise' : `${plural(n, 'Falta', 'Faltam')} ${n} ${plural(n, 'dado', 'dados')}`);
    }
  }
  function sheetText(r) {
    const d = r.d, i = r.info || {};
    const ident = [i.cliente && `Cliente: ${i.cliente}`, i.os && `O.S.: ${i.os}`, i.equipamento && `Equipamento: ${i.equipamento}`].filter(Boolean).join(' · ');
    return ['FOLHA DE DADOS DE PROCESSO — TROCADOR AR–ÁGUA (IC81)', ident,
      `Carga no trocador: ${fx(r.qDesign)} kW (${f0(r.qDesign * engine.KW_TO_KCALH)} kcal/h) · mancais (${fx(r.qBearing, 1)} kW) fora`,
      `Ar: ${r.fans} × ${fx(r.flowPerFan)} = ${fx(r.flowTotal)} m³/s ${d.flowRef === 'cntp' ? 'CNTP' : 'reais'} · ${fx(r.mMoist)} kg/s · ${fx(r.Th, 1)} → ${fx(r.Tc, 1)} °C`,
      `Água: ${fx(r.qvWh, 2)} m³/h · ${fx(d.waterIn, 1)} → ${fx(r.waterOut, 1)} °C`,
      `ε = ${fx(r.eps, 3)} · NTU = ${fx(r.NTU, 3)} · UA = ${fx(r.UA)} kW/K · U ≈ ${fx(r.U, 1)} W/m²K`,
      `ÁREA MÍNIMA = ${f0(r.areaMin)} m² (${r.modules} × ${f0(r.areaMinUnit)} m²) · face mínima ${r.modules} × ${fx(r.frontalArea)} m²`,
      '',
      'Dados de projeto\tUnid.\tLado externo (ar)\tLado interno (água)']
      .concat(r.rfq.rows.map(x => x.c.join('\t')))
      .concat(['', 'Exigências:'], r.rfq.req.map(([b, t], k) => `${k + 1}. ${b}${t}`)).filter((x, k) => k !== 1 || x).join('\n');
  }
  function copySheet() {
    if (!last) return;
    const text = sheetText(last);
    const done = () => toast('Folha de dados copiada');
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
    recalculate(true);
    if (!errorBox.hidden) return;
    for (const d of output.querySelectorAll('.sec:not(.sec-sheet) > details')) d.open = true;
    window.print();
  }

  $('t-reset').addEventListener('click', () => { apply(engine.EXAMPLE); recalculate(true); toast('Exemplo carregado'); });
  $('t-clear').addEventListener('click', () => {
    const current = collect();
    const next = { ...current };
    for (const f of engine.FIELDS) {
      if (f.type === 'calc' || f.type === 'select') continue;
      const grp = engine.GROUPS.find(g => g.id === f.group);
      if (!grp.premise && !grp.keep) next[f.key] = null;
    }
    apply(next);
    recalculate(true);
    setView('dados');
    for (const d of form.querySelectorAll('.g:not(.g-premise)')) d.open = true;
    controls.get('elecLoss').focus();
  });
  $('t-copy').addEventListener('click', copySheet);
  $('t-print').addEventListener('click', printPage);
  window.addEventListener('beforeprint', () => { for (const d of output.querySelectorAll('.sec:not(.sec-sheet) > details')) d.open = true; });
  $('t-theme').addEventListener('click', () => {
    const root = document.documentElement;
    const attr = root.getAttribute('data-theme');
    const dark = attr === 'dark' || (!attr && !matchMedia('(prefers-color-scheme: light)').matches);
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
