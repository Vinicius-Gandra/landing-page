/* Interface do laboratório térmico · área mínima do trocador ar–água (IC81). */
(() => {
  'use strict';
  const engine = window.VGThermal;
  const figs = window.VGThermalFigures;
  const $ = id => document.getElementById(id);
  const form = $('t-form'), output = $('t-output'), errorBox = $('t-error'), workspace = $('t-workspace');
  if (!engine || !figs || !form || !output) return;

  const CASE_KEY = 'vg-thermal-cooler-v1';
  const VIEW_KEY = 'vg-thermal-view';
  const SEC_KEY = 'vg-thermal-sections';
  const controls = new Map(), helps = new Map(), readouts = new Map();
  const { fx, f0 } = engine;
  let timer = null, last = null, lastTitle = '', spy = null;
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
      g.open = !group.premise;
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
          control.inputMode = f.type === 'int' ? 'numeric' : 'decimal';
          control.autocomplete = 'off';
          control.spellcheck = false;
          control.enterKeyHint = 'next';
          control.placeholder = f.req ? 'Obrigatório' : `padrão ${toInput(f.def)}`;
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
        control.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(recalculate, 200); });
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
      const f = engine.FIELD[key];
      const v = values[key];
      if (f.type === 'select') control.value = f.options.some(o => o[0] === v) ? v : f.def;
      else control.value = toInput(v);
    }
  }
  function collect() {
    const values = {};
    for (const [key, control] of controls) values[key] = control.dataset.type === 'select' ? control.value : parseNumber(control.value);
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
      wrap.classList.toggle('is-empty', empty && f.type !== 'select');
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
    const set = (key, v, n) => { const o = readouts.get(key); o.value.textContent = v; o.note.textContent = n; };
    if (!r) {
      for (const key of readouts.keys()) set(key, '—', 'Complete ou revise os dados.');
      return;
    }
    const d = r.d, cntp = d.flowRef !== 'real';
    setHelp('altitude', `p = ${fx(r.p / 1000, 3)} kPa${d.altitude === 0 ? ' (CNTP)' : ''}`);
    setHelp('ambT', d.rh > 0 ? `w = ${fx(r.w * 1000, 1)} g/kg · orvalho ${fx(r.dew, 1)} °C` : 'Só usada com UR > 0.');
    setHelp('waterQuality', `Rf = ${fx(r.foul.rf * 1e4, 2)}·10⁻⁴ m²K/W = ${fx(r.foul.rf * 1.163, 5)} h·m²·°C/kcal (TEMA).`);
    setHelp('ventLoss', finite(r.fanPower) ? `Ventiladores LA/LOA ≈ ${fx(r.fanPower, 1)} kW pelo Δp (grupo 07). Mancais não entram.` : 'Ventiladores e atrito do rotor com o ar.');
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
    const PF = figs.PF;
    const show = e => {
      const rect = svg.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / rect.width * PF.W;
      const x = Math.min(1, Math.max(0, (sx - PF.x0) / (PF.x1 - PF.x0)));
      const p = pf.pts[Math.round(x * (pf.pts.length - 1))];
      const cx = pf.X(p.x);
      for (const [n, a] of [[cross, { x1: cx, x2: cx }], [da, { cx, cy: pf.Y(p.ta) }], [dw, { cx, cy: pf.Y(p.tw) }]]) {
        for (const [k, v] of Object.entries(a)) n.setAttribute(k, v);
        n.setAttribute('visibility', 'visible');
      }
      fillTip([`${f0(p.x * 100)} % do caminho do ar`, `Ar ${fx(p.ta)} °C`, `Água ${fx(p.tw)} °C`, `Diferença ${fx(p.ta - p.tw)} K`]);
      placeTip(rect.left + cx / PF.W * rect.width, rect.top + pf.Y(p.ta) / PF.H * rect.height);
    };
    const hide = () => { for (const n of [cross, da, dw]) n.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
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
  function circuitSection(r) {
    const d = r.d;
    const fig = add(output, 'figure', 'fig');
    const head = add(fig, 'div', 'fig-head');
    add(head, 'h3', '', 'Circuito de ventilação IC81');
    add(head, 'span', '', 'esquema fora de escala');
    const sc = add(fig, 'div', 'fig-scroll');
    sc.innerHTML = figs.circuitSVG(r);
    requestAnimationFrame(() => { if (sc.scrollWidth > sc.clientWidth) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; });
    const lg = add(fig, 'div', 'legend-row');
    for (const [c, t] of [['--air-cold', 'Ar frio'], ['--air-hot', 'Ar quente'], ['--water', 'Água']]) { const s = add(lg, 'span'); add(s, 'i').style.background = `var(${c})`; s.append(t); }
    const extra = r.fans > 2 ? ` Mais ${r.fans - 2} ramo(s) além de LA e LOA entram na soma.` : '';
    const cap = add(fig, 'figcaption', '', `Vazão total = ${r.fans} × ${fx(r.flowPerFan)} = ${fx(r.flowTotal)} m³/s${d.flowRef === 'cntp' ? ' na CNTP' : ' reais'} → ${fx(r.mMoist)} kg/s de ar. Com ${fx(r.qDesign, 1)} kW no ar, ele esquenta ${fx(r.dTair, 1)} K: entra na máquina a ${fx(r.Tc, 1)} °C e volta ao trocador a ${fx(r.Th, 1)} °C. A água entra a ${fx(d.waterIn, 1)} °C e sai a ${fx(r.waterOut, 1)} °C. As perdas de mancal (${fx(r.qBearing, 1)} kW) saem pelo óleo.${extra}`);
    add(cap, 'span', 'only-mobile', ' Arraste o desenho para o lado para ver tudo.');
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
    ['refs', 'Referências de projeto', 'Brown Boveri Review 1972, IEC 60034-1 e as correlações usadas.']
  ];
  const SEC_DEFAULT_CLOSED = new Set(['refs']);
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
      refs: ['Fonte', 'BBC 1972']
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
    budgetsSection(r);
    circuitSection(r);
    const nav = add(output, 'nav', 'stepnav');
    nav.setAttribute('aria-label', 'Passos do cálculo');
    SECTIONS.forEach(([id, t], i) => {
      const a = add(nav, 'a');
      a.href = '#passo-' + id;
      add(a, 'span', 'stepnav-n', i + 1);
      a.append(t);
    });
    SECTIONS.forEach(([id, t, intro], i) => {
      const sec = add(output, 'section', 'sec');
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
      if (id === 'area') areaExtras(det, r);
      if (id === 'folha') folhaExtras(det, r);
      if (id === 'checks') checksExtras(det, r);
      if (id === 'refs') refsExtras(det);
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
  function recalculate() {
    const values = collect();
    try { localStorage.setItem(CASE_KEY, JSON.stringify(values)); } catch (_) {}
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
    const d = r.d;
    return ['FOLHA DE DADOS DE PROCESSO — TROCADOR AR–ÁGUA (IC81)',
      `Carga no trocador: ${fx(r.qDesign)} kW (${f0(r.qDesign * engine.KW_TO_KCALH)} kcal/h) · mancais (${fx(r.qBearing, 1)} kW) fora`,
      `Ar: ${r.fans} × ${fx(r.flowPerFan)} = ${fx(r.flowTotal)} m³/s ${d.flowRef === 'cntp' ? 'CNTP' : 'reais'} · ${fx(r.mMoist)} kg/s · ${fx(r.Th, 1)} → ${fx(r.Tc, 1)} °C`,
      `Água: ${fx(r.qvWh, 2)} m³/h · ${fx(d.waterIn, 1)} → ${fx(r.waterOut, 1)} °C`,
      `ε = ${fx(r.eps, 3)} · NTU = ${fx(r.NTU, 3)} · UA = ${fx(r.UA)} kW/K · U ≈ ${fx(r.U, 1)} W/m²K`,
      `ÁREA MÍNIMA = ${f0(r.areaMin)} m² (${r.modules} × ${f0(r.areaMinUnit)} m²) · face mínima ${r.modules} × ${fx(r.frontalArea)} m²`,
      '',
      'Dados de projeto\tUnid.\tLado externo (ar)\tLado interno (água)']
      .concat(r.rfq.rows.map(x => x.c.join('\t')))
      .concat(['', 'Exigências:'], r.rfq.req.map(([b, t], i) => `${i + 1}. ${b}${t}`)).join('\n');
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
    recalculate();
    if (!errorBox.hidden) return;
    for (const d of output.querySelectorAll('.sec > details')) d.open = true;
    window.print();
  }

  $('t-reset').addEventListener('click', () => { apply(engine.EXAMPLE); recalculate(); toast('Exemplo carregado'); });
  $('t-clear').addEventListener('click', () => {
    const current = collect();
    const next = { ...current };
    for (const f of engine.FIELDS) {
      if (f.type === 'calc' || f.type === 'select') continue;
      const grp = engine.GROUPS.find(g => g.id === f.group);
      if (!grp.premise && !grp.keep) next[f.key] = null;
    }
    apply(next);
    recalculate();
    setView('dados');
    for (const d of form.querySelectorAll('.g:not(.g-premise)')) d.open = true;
    controls.get('elecLoss').focus();
  });
  $('t-copy').addEventListener('click', copySheet);
  $('t-print').addEventListener('click', printPage);
  window.addEventListener('beforeprint', () => { for (const d of output.querySelectorAll('.sec > details')) d.open = true; });
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
