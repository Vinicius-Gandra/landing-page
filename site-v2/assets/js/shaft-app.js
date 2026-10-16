/* Interface do laboratório de eixos · triagem do eixo do rotor (tensões, Ø mínimo, flecha, críticas, interfaces). */
(() => {
  'use strict';
  const engine = window.VGShaft, figs = window.VGShaftFigures, drawing = window.VGShaftDrawing;
  const $ = id => document.getElementById(id);
  const form = $('s-form'), output = $('s-output'), errorBox = $('s-error'), workspace = $('s-workspace');
  if (!engine || !figs || !form || !output) return;

  const CASE_KEY = 'vg-shaft-case-v1', VIEW_KEY = 'vg-shaft-view', SEC_KEY = 'vg-shaft-sections', UI_KEY = 'vg-shaft-ui';
  const { fx, f0, fsf } = engine;
  const controls = new Map(), helps = new Map(), readouts = new Map();
  const ss = { get(k, d) { try { const v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  let tables = { sections: [], keys: [], fits: [] };
  let timer = null, last = null, lastErr = null, spy = null, lastTitle = '', sheetZoom = 1, mapCache = { key: '', map: null };
  let ui = Object.assign({ sel: null, lanes: ['m', 't', 'y', 'u'], dmin: true }, ss.get(UI_KEY, {}));
  let secOpen = ss.get(SEC_KEY, {}) || {};
  const ex = {};            // referências do explorador vivo

  /* ---- Utilidades ------------------------------------------------------------------------------- */
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const add = (parent, tag, cls, text) => { const n = el(tag, cls, text); parent.append(n); return n; };
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const isMobile = () => matchMedia('(max-width: 1000px)').matches;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const plural = (n, s, p) => n === 1 ? s : p;
  const nb = (v, u) => `${v} ${u}`;
  function parseNumber(text) {
    const raw = String(text ?? '').trim().replace(/\s| /g, '');
    if (!raw) return null;
    let s = raw;
    if (raw.includes(',') && raw.includes('.')) s = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else if (raw.includes(',')) s = raw.replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }
  const toInput = v => v === null || v === undefined || v === '' ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  const saveUI = () => ss.set(UI_KEY, ui);
  const clone = x => JSON.parse(JSON.stringify(x));

  /* ---- Dica flutuante e aviso ------------------------------------------------------------------- */
  const tip = add(document.body, 'div', 'tip');
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  function placeTip(x, y) {
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + 'px';
  }
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
  let toastTimer = null;
  function toast(text) {
    const t = $('s-toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
  }

  /* ---- Formulário ------------------------------------------------------------------------------- */
  let profileBox = null, profileSum = null, profileCount = null;
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
      if (group.custom === 'profile') {
        const fig = add(box, 'button', 'f-profile');
        fig.type = 'button';
        fig.setAttribute('aria-label', 'Abrir o editor do perfil do eixo');
        profileBox = add(fig, 'span', 'f-profile-fig');
        profileSum = add(fig, 'span', 'f-profile-sum', '—');
        const acts = add(box, 'div', 'f-profile-acts');
        const b1 = add(acts, 'button', 'btn-soft', '✎ Editar trechos');
        b1.type = 'button';
        profileCount = add(b1, 'span', 'btn-count', '');
        const b2 = add(acts, 'button', 'btn-soft', 'Chavetas e ajustes');
        b2.type = 'button';
        fig.addEventListener('click', () => editor.open('sections'));
        b1.addEventListener('click', () => editor.open('sections'));
        b2.addEventListener('click', () => editor.open('keys'));
        add(box, 'p', 'f-help f-wide', 'Cada trecho começa onde o anterior termina. Cole direto do Excel no editor (Ctrl+V).');
        return;
      }
      for (const f of engine.FIELDS.filter(x => x.group === group.id)) {
        if (f.type === 'calc') {
          const c = add(box, 'div', 'f-calc');
          const lab = add(c, 'span', 'f-calc-label');
          add(lab, 'span', 'f-calc-tag', 'calculado');
          add(lab, 'span', '', f.label);
          if (f.sym) add(lab, 'span', 'f-code', f.sym);
          const value = add(c, 'output', 'f-calc-value', '—');
          const note = add(c, 'span', 'f-calc-note', '');
          readouts.set(f.key, { value, note, box: c });
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
        } else if (f.type === 'textarea') {
          control = add(fbox, 'textarea');
          control.rows = 5;
          control.spellcheck = true;
          control.maxLength = 2000;
        } else {
          control = add(fbox, 'input');
          control.type = 'text';
          if (f.type !== 'text') control.inputMode = 'decimal';
          control.autocomplete = 'off';
          control.spellcheck = false;
          control.enterKeyHint = 'next';
          control.placeholder = f.type === 'text' ? (f.placeholder || 'Opcional') : f.req ? 'Obrigatório' : f.opt || f.def === null ? 'opcional' : `padrão ${toInput(f.def)}`;
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
        helps.set(f.key, { node: hp, base: f.help || '' });
        const err = add(foot, 'small', 'f-err');
        err.id = id + '-err';
        err.hidden = true;
        control.setAttribute('aria-describedby', `${hp.id} ${err.id}`);
        if (f.unit) control.setAttribute('aria-label', `${f.label} em ${f.unit}`);
        controls.set(f.key, control);
        control.addEventListener('input', () => { onFieldInput(f.key); clearTimeout(timer); timer = setTimeout(() => recalculate(), 220); });
        control.addEventListener('change', () => { onFieldInput(f.key, true); clearTimeout(timer); recalculate(); });
        if (f.type !== 'textarea') control.addEventListener('keydown', e => {
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
  // material: o preset preenche Su e Sy; editar à mão passa para "Personalizado"
  function onFieldInput(key, committed) {
    if (key === 'material') {
      const m = engine.MATERIALS.find(x => x.id === controls.get('material').value);
      if (m) { controls.get('su').value = toInput(m.su); controls.get('sy').value = toInput(m.sy); }
    } else if (key === 'su' || key === 'sy') {
      const m = engine.MATERIALS.find(x => x.id === controls.get('material').value);
      if (m && (parseNumber(controls.get('su').value) !== m.su || parseNumber(controls.get('sy').value) !== m.sy)) controls.get('material').value = 'custom';
    }
    if (committed) syncOff();
  }
  function syncOff() {
    const v = k => controls.get(k)?.value;
    const off = { se: v('seMode') === 'marin', finish: v('seMode') !== 'marin', reliab: v('seMode') !== 'marin', auxTorque: v('torqueMode') !== 'linear', umpEcc: !String(v('gap') || '').trim() };
    for (const [k, o] of Object.entries(off)) controls.get(k)?.closest('.f')?.classList.toggle('is-off', o);
  }
  function apply(values) {
    for (const [key, control] of controls) {
      const f = engine.FIELD[key], v = values[key];
      if (f.type === 'select') control.value = f.options.some(o => o[0] === v) ? v : f.def;
      else if (f.type === 'text' || f.type === 'textarea') control.value = v == null ? '' : String(v);
      else control.value = toInput(v);
    }
    tables = {
      sections: clone(Array.isArray(values.sections) ? values.sections : engine.EXAMPLE_SECTIONS),
      keys: clone(Array.isArray(values.keys) ? values.keys : engine.EXAMPLE_KEYS),
      fits: clone(Array.isArray(values.fits) ? values.fits : engine.EXAMPLE_FITS)
    };
    syncOff();
    editor.refresh();
  }
  function collect() {
    const values = {};
    for (const [key, control] of controls) {
      const t = control.dataset.type;
      values[key] = t === 'select' || t === 'text' || t === 'textarea' ? control.value.trim() : parseNumber(control.value);
    }
    values.sections = tables.sections; values.keys = tables.keys; values.fits = tables.fits;
    return values;
  }
  function setHelp(key, text) { const h = helps.get(key); if (!h) return; h.node.textContent = text || ''; h.node.hidden = !text; }
  function markFields(values, fieldErrors = {}) {
    let req = 0, filled = 0, bad = 0;
    const groups = {};
    for (const f of engine.FIELDS) {
      if (f.type === 'calc') continue;
      const control = controls.get(f.key), wrap = control.closest('.f'), err = wrap.querySelector('.f-err');
      const v = values[f.key], empty = v === null || v === '';
      const msg = fieldErrors[f.key];
      const grp = engine.GROUPS.find(g => g.id === f.group);
      wrap.classList.toggle('is-empty', empty && f.type === 'num' && !(f.opt || f.def === null));
      wrap.classList.toggle('is-bad', !!msg);
      control.setAttribute('aria-invalid', msg ? 'true' : 'false');
      err.hidden = !msg;
      err.textContent = msg ? msg.charAt(0).toUpperCase() + msg.slice(1) + '.' : '';
      const g = groups[f.group] ||= { total: 0, filled: 0, bad: 0, changed: 0, premise: !!grp.premise };
      if (grp.premise) { if (!(v === f.def || (empty && (f.def === null || f.opt)))) g.changed++; }
      else if (f.type === 'num') { g.total++; if (!empty) g.filled++; }
      if (msg) { g.bad++; bad++; }
      if (f.req) { req++; if (!empty && !msg) filled++; }
    }
    // tabelas
    const tErr = Object.keys(fieldErrors).filter(k => /^(sec|key|fit):/.test(k)).length;
    groups.perfil = { total: 1, filled: 1, bad: tErr, changed: 0, premise: false, table: true };
    bad += tErr;
    for (const det of form.querySelectorAll('.g')) {
      const g = groups[det.dataset.group];
      if (!g) continue;
      const c = det.querySelector('.g-count');
      c.className = 'g-count' + (g.bad ? ' is-bad' : !g.premise && g.filled === g.total ? ' is-done' : '');
      c.textContent = g.bad ? `${g.bad} a revisar` : g.table ? `${tables.sections.length} trechos` : g.premise ? (g.changed ? `${g.changed} ${plural(g.changed, 'alterado', 'alterados')}` : 'padrão') : g.total ? `${g.filled}/${g.total}` : 'opcional';
      if (g.bad && !g.table) det.open = true;
    }
    const p = $('s-progress');
    p.replaceChildren();
    p.classList.toggle('is-done', filled === req);
    add(p, 'span', '', filled === req ? 'Dados obrigatórios completos' : `${filled} de ${req} obrigatórios`);
    add(add(p, 'span', 's-progress-track'), 'span', 's-progress-fill').style.width = (filled / req * 100) + '%';
    const badge = $('s-mb-badge');
    badge.hidden = !bad;
    badge.textContent = bad;
  }
  function updateForm(r, values) {
    syncOff();
    const set = (key, v, n) => { const o = readouts.get(key); if (o) { o.value.textContent = v; o.note.textContent = n; } };
    // perfil no formulário
    if (r) {
      profileBox.innerHTML = figs.miniProfile(r, { W: 340, status: true });
      const dmin = Math.min(...r.res.map(s => s.d)), dmax = Math.max(...r.res.map(s => s.d));
      profileSum.textContent = `${r.res.length} trechos · ${f0(r.d.L)} mm · Ø ${fx(dmin, 0)}–${fx(dmax, 1)} mm · ${f0(r.mass.shaft)} kg`;
      profileCount.textContent = r.res.length;
    } else if (!last) { profileSum.textContent = `${tables.sections.length} trechos · revise os dados`; }
    const ump = finite(values.ump) ? values.ump : null;
    setHelp('ump', ump !== null ? `= ${fx(ump * engine.G0 / 1000, 2)} kN, para baixo (pior caso).` : helps.get('ump').base);
    setHelp('xUmp', r ? `Trecho ${r.res[figs.secAt(r, r.d.xUmp)].code}.` : '');
    if (!r) { for (const key of readouts.keys()) set(key, '—', 'Complete ou revise os dados.'); return; }
    const d = r.d, gen = d.machine !== 'motor';
    set('rdP', `${fx(r.Pshaft, 2)} kW`, d.powerBase === 'rend' ? `Pel ${gen ? '÷' : '×'} η = ${fx(d.pElec, 0)} ${gen ? '÷' : '×'} ${fx(d.eff, 3)} · pelas perdas: ${fx(r.PshaftAlt, 2)}` : `${fx(d.pElec, 0)} ${gen ? '+' : '−'} ${fx(d.lossMech, 2)} ${gen ? '+' : '−'} ${fx(d.lossElec, 2)} · por η: ${fx(r.PshaftAlt, 2)}`);
    set('rdT', `${fx(r.T / 1000, 2)} · ${fx(r.Tpk / 1000, 2)} kN·m`, `T = P·60 000/(2π·${f0(d.speed)}) · pico ${fx(d.peak, 2)} × T`);
    set('rdR', `${fx(r.RA / 1000, 2)} · ${fx(r.RB / 1000, 2)} kN`, `ΣF ${fx(-r.Fy / 1000, 2)} kN para baixo · ${f0(r.RA / engine.G0)} e ${f0(r.RB / engine.G0)} kgf`);
    setHelp('xA', `Colo ${r.bearings[0].s.code}: Ø${fx(r.bearings[0].D, 1)} × ${fx(r.bearings[0].B, 1)} mm.`);
    setHelp('xB', `Colo ${r.bearings[1].s.code}: Ø${fx(r.bearings[1].D, 1)} × ${fx(r.bearings[1].B, 1)} mm.`);
    setHelp('se', d.seMode === 'marin' ? `Marin dá ${fx(Math.min(...r.res.map(s => s.se)), 0)}–${fx(Math.max(...r.res.map(s => s.se)), 0)} MPa por trecho.` : 'Já com acabamento, tamanho e confiabilidade.');
    setHelp('kBearing', d.kBearing ? `1ª crítica ${f0(r.dyn?.flex?.rpm?.[0])} rpm (rígidos: ${f0(r.dyn?.rigid?.rpm?.[0])}).` : 'Vazio = apoios rígidos.');
    setHelp('drawingMass', d.drawingMass ? `Geometria: ${f0(r.mass.shaft)} kg (${fx((r.mass.shaft / d.drawingMass - 1) * 100, 1)} %).` : 'Opcional: confere a geometria.');
    setHelp('gap', d.gap ? `Flecha no pacote = ${fx((finite(r.defl.core) ? r.defl.core : r.defl.span) / d.gap * 100, 1)} % de g.` : 'Opcional: flecha no pacote e rigidez magnética.');
  }

  /* ---- Editor do perfil (diálogo) ------------------------------------------------------------- */
  const editor = (() => {
    const TABS = { sections: { label: 'Trechos', cols: engine.SECTION_COLS, prefix: 'sec' }, keys: { label: 'Chavetas', cols: engine.KEY_COLS, prefix: 'key' }, fits: { label: 'Ajustes', cols: engine.FIT_COLS, prefix: 'fit' } };
    let dlg = null, tab = 'sections', tbody = null, prev = null, sum = null, status = null, tabBtns = {}, pasteBox = null, focusRow = null;
    function build() {
      dlg = add(document.body, 'dialog', 'ed');
      dlg.setAttribute('aria-labelledby', 'ed-title');
      const head = add(dlg, 'div', 'ed-head');
      const ht = add(head, 'div');
      add(ht, 'p', 's-eyebrow', 'Geometria do eixo');
      add(ht, 'h2', '', 'Perfil, chavetas e ajustes').id = 'ed-title';
      const tl = add(head, 'div', 'ed-tabs');
      tl.setAttribute('role', 'tablist');
      for (const [id, t] of Object.entries(TABS)) {
        const b = add(tl, 'button', 'ed-tab');
        b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = id;
        add(b, 'span', '', t.label);
        add(b, 'span', 'ed-tab-n', '');
        b.addEventListener('click', () => show(id));
        tabBtns[id] = b;
      }
      const close = add(head, 'button', 'ed-close', '✕');
      close.type = 'button'; close.setAttribute('aria-label', 'Fechar o editor');
      close.addEventListener('click', () => dlg.close());
      const pv = add(dlg, 'div', 'ed-preview');
      prev = add(pv, 'div', 'ed-fig');
      sum = add(pv, 'p', 'ed-sum', '');
      const body = add(dlg, 'div', 'ed-body');
      const tbl = add(body, 'table', 'ed-table');
      tbl.id = 'ed-table';
      tbody = tbl;
      const foot = add(dlg, 'div', 'ed-foot');
      const mk = (t, cls, fn, title) => { const b = add(foot, 'button', 'btn-soft' + (cls ? ' ' + cls : ''), t); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', fn); return b; };
      mk('＋ Linha', '', () => insertRow(tables[tab].length - 1), 'Acrescentar uma linha no fim');
      mk('Colar do Excel', '', () => openPaste(), 'Colar várias linhas copiadas de uma planilha');
      mk('Copiar tabela', '', () => copyTable(), 'Copiar no formato de planilha (TSV)');
      mk('Restaurar exemplo', 'ed-ghost', () => { tables[tab] = clone({ sections: engine.EXAMPLE_SECTIONS, keys: engine.EXAMPLE_KEYS, fits: engine.EXAMPLE_FITS }[tab]); renderTable(); changed(); toast('Tabela do exemplo restaurada'); });
      add(foot, 'span', 'ed-spacer');
      status = add(foot, 'span', 'ed-status', '');
      mk('Concluir', 'btn-primary', () => dlg.close());
      pasteBox = add(dlg, 'div', 'ed-paste');
      pasteBox.hidden = true;
      add(pasteBox, 'p', '', 'Cole as linhas da planilha (colunas na mesma ordem da tabela). Vírgula ou ponto decimal. A primeira linha pode ser o cabeçalho.');
      const ta = add(pasteBox, 'textarea');
      ta.rows = 7; ta.setAttribute('aria-label', 'Linhas coladas da planilha');
      const pa = add(pasteBox, 'div', 'ed-paste-acts');
      const ok = add(pa, 'button', 'btn-soft btn-primary', 'Substituir a tabela');
      ok.type = 'button';
      const cancel = add(pa, 'button', 'btn-soft', 'Cancelar');
      cancel.type = 'button';
      ok.addEventListener('click', () => { const n = pasteRows(ta.value, 0, 0, true); pasteBox.hidden = true; ta.value = ''; if (n) toast(`${n} ${plural(n, 'linha colada', 'linhas coladas')}`); });
      cancel.addEventListener('click', () => { pasteBox.hidden = true; });
      dlg.addEventListener('close', () => { recalculate(true); });
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    }
    function show(id) {
      tab = id;
      for (const [k, b] of Object.entries(tabBtns)) { b.setAttribute('aria-selected', String(k === id)); b.tabIndex = k === id ? 0 : -1; }
      pasteBox.hidden = true;
      renderTable();
    }
    function cellVal(v, c) { return c.type === 'text' ? (v ?? '') : toInput(v); }
    function renderTable() {
      const cols = TABS[tab].cols, rows = tables[tab];
      tbody.replaceChildren();
      const thead = add(tbody, 'thead'), hr = add(thead, 'tr');
      add(hr, 'th', 'ed-n', '#');
      if (tab === 'sections') add(hr, 'th', 'ed-ro', 'Início');
      for (const c of cols) { const th = add(hr, 'th', c.type === 'text' ? 'ed-name' : '', c.label); if (c.unit) add(th, 'small', '', c.unit); if (c.help) th.title = c.help; }
      add(hr, 'th', 'ed-acts').append(el('span', 'sr-only', 'Ações'));
      const tb = add(tbody, 'tbody');
      let start = 0;
      rows.forEach((row, i) => {
        const tr = add(tb, 'tr');
        tr.dataset.row = i;
        add(tr, 'td', 'ed-n', i + 1);
        if (tab === 'sections') { add(tr, 'td', 'ed-ro', fx(start, 1)); const e = parseNumber(row.end); if (finite(e) && e > start) start = e; }
        cols.forEach(c => {
          const td = add(tr, 'td', c.type === 'text' ? 'ed-name' : '');
          const inp = add(td, 'input', 'ed-in');
          inp.type = 'text';
          inp.value = cellVal(row[c.key], c);
          inp.dataset.row = i; inp.dataset.col = c.key;
          if (c.type !== 'text') inp.inputMode = 'decimal';
          inp.autocomplete = 'off'; inp.spellcheck = false;
          inp.placeholder = c.opt ? '—' : '';
          inp.setAttribute('aria-label', `${c.label}${c.unit ? ' (' + c.unit + ')' : ''}, linha ${i + 1}`);
        });
        const acts = add(tr, 'td', 'ed-acts');
        const ins = add(acts, 'button', 'ed-act', '＋'); ins.type = 'button'; ins.title = 'Inserir linha abaixo'; ins.setAttribute('aria-label', `Inserir linha abaixo da ${i + 1}`); ins.dataset.act = 'ins';
        const del = add(acts, 'button', 'ed-act', '✕'); del.type = 'button'; del.title = 'Remover linha'; del.setAttribute('aria-label', `Remover a linha ${i + 1}`); del.dataset.act = 'del';
      });
      markErrors(lastErr);
      updateTabs();
    }
    function updateTabs() { for (const [k, b] of Object.entries(tabBtns)) b.querySelector('.ed-tab-n').textContent = tables[k].length; }
    function onInput(e) {
      const inp = e.target.closest('.ed-in');
      if (!inp) return;
      const i = +inp.dataset.row, key = inp.dataset.col, c = TABS[tab].cols.find(x => x.key === key);
      tables[tab][i][key] = c.type === 'text' ? inp.value : parseNumber(inp.value);
      if (tab === 'sections' && key === 'end') refreshStarts();
      changed();
    }
    function refreshStarts() {
      let start = 0;
      tbody.querySelectorAll('tbody tr').forEach((tr, i) => { const ro = tr.querySelector('.ed-ro'); if (ro) ro.textContent = fx(start, 1); const e = parseNumber(tables.sections[i].end); if (finite(e) && e > start) start = e; });
    }
    function changed() { clearTimeout(timer); timer = setTimeout(() => recalculate(), 160); }
    function insertRow(i) {
      const rows = tables[tab];
      let row;
      if (tab === 'sections') {
        const cur = rows[i] || { end: 0, d: 200, kt: 2, kf: 1.5 }, nx = rows[i + 1];
        const e0 = parseNumber(cur.end) || 0, e1 = nx ? parseNumber(nx.end) : e0 + 100;
        const src = nx || cur;
        row = { name: `S${String(i + 2).padStart(2, '0')} novo`, end: Math.round(((e0 + (finite(e1) ? e1 : e0 + 100)) / 2) * 100) / 100, d: src.d, di: null, flats: null, kt: src.kt, kf: src.kf, tpct: null };
        if (!nx) row.end = Math.round((e0 + 100) * 100) / 100;
      } else if (tab === 'keys') row = { name: 'nova', d: 200, b: 45, t: 15, h: null, L: 100, share: 100 };
      else row = { name: 'novo', d: 300, L: 200, hub: null, share: 100 };
      rows.splice(i + 1, 0, row);
      renderTable();
      changed();
      const inp = tbody.querySelector(`.ed-in[data-row="${i + 1}"][data-col="${tab === 'sections' ? 'end' : 'name'}"]`);
      if (inp) { inp.focus(); inp.select(); }
    }
    function removeRow(i) {
      if (tab === 'sections' && tables.sections.length <= 1) { toast('O eixo precisa de pelo menos um trecho'); return; }
      tables[tab].splice(i, 1);
      renderTable();
      changed();
    }
    // colar várias linhas/colunas a partir da célula (ou substituir tudo pelo diálogo)
    function pasteRows(text, r0, c0, replace) {
      const lines = String(text).replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
      if (!lines.length) return 0;
      const cols = TABS[tab].cols;
      let grid = lines.map(l => l.split('\t'));
      if (grid.length && grid[0].length === 1 && lines[0].includes(';')) grid = lines.map(l => l.split(';'));
      if (replace && grid.length > 1 && grid[0].slice(1).every(c => !finite(parseNumber(c)))) grid.shift();     // cabeçalho
      if (replace) tables[tab] = [];
      const rows = tables[tab];
      grid.forEach((cells, k) => {
        const ri = r0 + k;
        if (!rows[ri]) rows[ri] = Object.fromEntries(cols.map(c => [c.key, c.type === 'text' ? '' : null]));
        cells.forEach((v, j) => { const c = cols[c0 + j]; if (c) rows[ri][c.key] = c.type === 'text' ? v.trim() : parseNumber(v); });
      });
      renderTable();
      changed();
      return grid.length;
    }
    function openPaste() { pasteBox.hidden = false; pasteBox.querySelector('textarea').focus(); }
    function copyTable() {
      const cols = TABS[tab].cols;
      const lines = [cols.map(c => c.label + (c.unit ? ` (${c.unit})` : '')).join('\t')].concat(tables[tab].map(r => cols.map(c => c.type === 'text' ? (r[c.key] ?? '') : toInput(r[c.key])).join('\t')));
      copyText(lines.join('\n'), 'Tabela copiada: cole na planilha');
    }
    function markErrors(err) {
      if (!tbody) return;
      const fields = err?.fields || {};
      tbody.querySelectorAll('.ed-in').forEach(inp => {
        const k = `${TABS[tab].prefix}:${inp.dataset.row}:${inp.dataset.col}`, msg = fields[k];
        inp.classList.toggle('is-bad', !!msg);
        inp.title = msg ? msg.charAt(0).toUpperCase() + msg.slice(1) : '';
        inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
      });
      const n = Object.keys(fields).filter(k => /^(sec|key|fit):/.test(k)).length;
      if (status) { status.textContent = n ? `${n} ${plural(n, 'célula', 'células')} a revisar` : 'Tudo certo'; status.classList.toggle('is-bad', n > 0); }
    }
    function preview(r) {
      if (!dlg || !dlg.open) return;
      if (r) {
        prev.innerHTML = figs.miniProfile(r, { W: 900, status: true, sel: focusRow !== null && tab === 'sections' ? focusRow : undefined, label: 'Prévia do perfil' });
        sum.textContent = `${r.res.length} trechos · L ${f0(r.d.L)} mm · ${f0(r.mass.shaft)} kg · ${r.fails.length ? `${r.fails.length} ${plural(r.fails.length, 'trecho abaixo', 'trechos abaixo')} dos mínimos` : 'todos atingem os mínimos'}`;
      } else sum.textContent = 'Revise as células marcadas: a prévia volta quando a tabela fechar.';
    }
    function attach() {
      tbody.addEventListener('input', onInput);
      tbody.addEventListener('focusin', e => {
        const inp = e.target.closest('.ed-in');
        if (!inp) return;
        focusRow = +inp.dataset.row;
        tbody.querySelectorAll('tr.is-focus').forEach(t => t.classList.remove('is-focus'));
        inp.closest('tr').classList.add('is-focus');
        if (last) preview(last);
      });
      tbody.addEventListener('click', e => {
        const b = e.target.closest('.ed-act');
        if (!b) return;
        const i = +b.closest('tr').dataset.row;
        if (b.dataset.act === 'ins') insertRow(i); else removeRow(i);
      });
      tbody.addEventListener('keydown', e => {
        const inp = e.target.closest('.ed-in');
        if (!inp || e.key !== 'Enter') return;
        e.preventDefault();
        const nx = tbody.querySelector(`.ed-in[data-row="${+inp.dataset.row + (e.shiftKey ? -1 : 1)}"][data-col="${inp.dataset.col}"]`);
        if (nx) { nx.focus(); nx.select(); }
      });
      tbody.addEventListener('paste', e => {
        const inp = e.target.closest('.ed-in');
        const text = e.clipboardData?.getData('text/plain') || '';
        if (!inp || !/[\t\n]/.test(text.trim())) return;          // valor simples: colagem normal
        e.preventDefault();
        const cols = TABS[tab].cols;
        const n = pasteRows(text, +inp.dataset.row, cols.findIndex(c => c.key === inp.dataset.col), false);
        toast(`${n} ${plural(n, 'linha colada', 'linhas coladas')}`);
      });
    }
    return {
      open(t = 'sections') {
        if (!dlg) { build(); attach(); }
        show(t);
        if (!dlg.open) dlg.showModal();
        preview(last);
        tbody.querySelector('.ed-in')?.focus({ preventScroll: true });
      },
      refresh() { if (dlg && dlg.open) renderTable(); },
      update(r, err) { if (!dlg || !dlg.open) return; markErrors(err); preview(r); updateTabs(); },
      paste: pasteRows
    };
  })();

  /* ---- Destaque ---------------------------------------------------------------------------------- */
  function heroSection(r) {
    const d = r.d, N = r.res.length, nF = r.fails.length, c = r.crit;
    const hero = add(output, 'section', 'hero');
    hero.setAttribute('aria-label', 'Resultado da triagem');
    const main = add(hero, 'div', 'hero-main');
    add(main, 'p', 's-eyebrow', 'Triagem do eixo · fórmula simplificada');
    const h = add(main, 'h2', 'hero-title');
    h.append(nF ? `${nF} de ${N} ` : `${N} de ${N} `);
    add(h, 'small', '', nF ? plural(nF, 'trecho abaixo', 'trechos abaixo') : 'trechos atingem');
    if (lastTitle && h.textContent !== lastTitle) h.classList.add('is-updated');
    lastTitle = h.textContent;
    const split = add(main, 'p', 'hero-split');
    split.append(`${nF ? 'Pior' : 'Mais carregado'}: `);
    add(split, 'b', '', `${c.name}`);
    split.append(` · ${c.gov === 'esc' ? `SF escoamento ${fsf(c.sfy)} (mín. ${fx(d.sfY, 1)})` : `SF fadiga ${fsf(c.sff)} (mín. ${fx(d.sfF, 1)})`}`);
    const sub = add(main, 'p', 'hero-sub');
    const dyn = r.dyn && r.dyn.design && r.dyn.design.ok ? r.dyn.design : null;
    sub.append('Torque ');
    add(sub, 'b', '', nb(fx(r.T / 1000, 2), 'kN·m'));
    sub.append(` (pico ${fx(d.peak, 1)} ×). Reações `);
    add(sub, 'b', '', `${fx(r.RA / 1000, 1)} e ${nb(fx(r.RB / 1000, 1), 'kN')}`);
    sub.append('. Flecha ');
    add(sub, 'b', '', nb(fx(r.defl.span, 3), 'mm'));
    sub.append(` no vão${r.defl.max > r.defl.span + 1e-6 ? ` e ${fx(r.defl.max, 3)} mm na ponta` : ''}.`);
    if (dyn) { sub.append(' 1ª crítica '); add(sub, 'b', '', nb(f0(dyn.rpm[0]), 'rpm')); sub.append(` = ${fx(dyn.rpm[0] / d.speed, 2)} × n.`); }
    const chips = add(main, 'div', 'hero-chips');
    const chip = (cls, t) => add(chips, 'span', 'chip ' + cls, t);
    chip(nF ? 'chip-fail' : 'chip-ok', nF ? `✗ ${r.fails.map(s => s.code).join(', ')}` : '✓ Trechos atingem');
    const keysBad = r.keyRes.filter(k => !k.ok);
    if (keysBad.length) chip('chip-warn', `△ ${plural(keysBad.length, 'Chaveta', 'Chavetas')} ${keysBad.map(k => k.name.replace(/\s*\(.*\)/, '')).join(', ')}`);
    if (dyn) { const ok = dyn.rpm[0] >= d.speed * (1 + d.margin / 100); chip(ok ? 'chip-ok' : 'chip-fail', `${ok ? '✓' : '✗'} 1ª crítica ${fx(dyn.rpm[0] / d.speed, 2)} × n`); }
    const ch = add(chips, 'span', 'chip', 'kpico adm. ');
    add(ch, 'b', '', `${fx(r.fpkAdm.v, 2)} ×`);
    // figura: perfil colorido pela utilização
    const fig = add(hero, 'figure', 'hero-figure');
    const btn = add(fig, 'button', 'hero-shaft');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ir para o explorador do eixo');
    btn.innerHTML = figs.heroFigure(r, { sel: ui.sel });
    btn.addEventListener('click', () => $('explorador')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }));
    const lg = add(fig, 'div', 'hero-legend');
    for (const [cls, t] of [['', 'atinge'], ['is-warn', 'perto do limite'], ['is-fail', 'abaixo'], ['is-dmin', 'Ø mínimo da fórmula']]) { const s = add(lg, 'span'); add(s, 'i', 'sw ' + cls); s.append(t); }
    add(fig, 'figcaption', '', `Escala real: ${f0(d.L)} mm entre pontas, mancais em ${fx(d.xA, 1)} e ${fx(d.xB, 1)} mm. O tracejado é o Ø mínimo de cada trecho; onde ele passa do contorno, falta material.`);
    const kpis = add(hero, 'dl', 'hero-kpis');
    const B = r.bal;
    for (const [label, tag, val, u, note, cls] of [
      ['Torque nominal', 'calc', fx(r.T / 1000, 2), 'kN·m', `${fx(r.Pshaft, 1)} kW a ${f0(d.speed)} rpm · pico ${fx(r.Tpk / 1000, 1)}`],
      ['Reações A · B', 'calc', `${fx(r.RA / 1000, 1)} · ${fx(r.RB / 1000, 1)}`, 'kN', `p̄ ${fx(r.bearings[0].p, 2)} e ${fx(r.bearings[1].p, 2)} MPa nos colos`],
      ['Momento máximo', 'calc', fx(Math.abs(r.Mmax.v) / 1e6, 1), 'kN·m', `x = ${f0(r.Mmax.x)} mm · ${r.Mmax.sec ? r.Mmax.sec.code : ''}`],
      ['Flecha no vão', 'calc', fx(r.defl.span, 3), 'mm', d.gap ? `${fx(r.defl.span / d.gap * 100, 1)} % do entreferro` : `ponta: ${fx(r.defl.max, 3)} mm`, d.gap && r.defl.span > 0.1 * d.gap ? 'kpi-bad' : ''],
      ['Inclinação nos mancais', 'calc', fx(Math.max(Math.abs(r.defl.thA), Math.abs(r.defl.thB)) * 1000, 3), 'mrad', `admissível ${fx(d.slopeMax, 2)} mrad`, r.bearings.some(b => !b.ok) ? 'kpi-bad' : ''],
      ['1ª crítica', 'calc', dyn ? f0(dyn.rpm[0]) : '—', 'rpm', dyn ? `${fx(dyn.rpm[0] / d.speed, 2)} × n · 2ª ${f0(dyn.rpm[1])} rpm` : 'modelo indisponível', dyn && dyn.rpm[0] < d.speed * (1 + d.margin / 100) ? 'kpi-bad' : ''],
      ['Massa girante', 'calc', f0(r.mass.total), 'kg', `eixo ${f0(r.mass.shaft)} + rotor ${f0(r.mass.rotor)} · CG ${f0(r.mass.cg)} mm`],
      ['Desbalanceamento adm.', 'calc', B ? f0(B.U / 1000) : '—', 'kg·mm', B ? `G ${fx(B.G, 1)} · ${fx(B.eper, 1)} µm · ${fx((B.FA + B.FB) / 1000, 2)} kN girantes` : '']
    ]) {
      const k = add(kpis, 'div', 'kpi' + (cls ? ' ' + cls : ''));
      const dt = add(k, 'dt', '', label);
      add(dt, 'span', 'kpi-tag ' + (tag === 'calc' ? 'is-calc' : 'is-def'), tag === 'calc' ? 'calc.' : 'dado');
      const dd = add(k, 'dd', '', val);
      add(dd, 'small', '', u);
      add(k, 'p', '', note);
    }
  }
  function alertsSection(r) {
    const list = r.checks.filter(x => x.sev === 'fail' || x.sev === 'warn');
    const box = add(output, 'div', 'alerts');
    for (const c of list.slice(0, 6)) {
      const a = add(box, 'div', 's-alert s-alert-' + c.sev);
      add(a, 'span', 's-alert-mark', c.sev === 'fail' ? '!' : '△').setAttribute('aria-hidden', 'true');
      const t = add(a, 'div');
      add(t, 'strong', '', c.title);
      add(t, 'p', '', c.detail);
    }
    if (list.length > 6) { const p = add(box, 'p', 'alerts-more'); const a = add(p, 'a', '', `+ ${list.length - 6} avisos nas verificações`); a.href = '#passo-checks'; }
  }
  function chainSection(r) {
    const d = r.d, dyn = r.dyn && r.dyn.design && r.dyn.design.ok ? r.dyn.design : null;
    const box = add(output, 'section', 'seqflow');
    box.setAttribute('aria-label', 'Cadeia de cálculo');
    const head = add(box, 'div', 'seqflow-head');
    add(head, 'h3', '', 'Cadeia de cálculo');
    const p = add(head, 'p');
    for (const [cls, t] of [['', 'dado definido'], ['is-calc', 'calculado']]) { const s = add(p, 'span'); add(s, 'i', 'seq-key ' + cls); s.append(t); }
    const ol = add(box, 'ol', 'seq');
    const stages = [
      ['Torque', [['def', 'Pel', `${f0(d.pElec)} kW`, `FTD · n = ${f0(d.speed)} rpm`], ['calc', 'Peixo', `${fx(r.Pshaft, 2)} kW`, d.powerBase === 'rend' ? 'pelo rendimento' : 'potência + perdas'], ['calc', 'T', `${fx(r.T / 1000, 2)} kN·m`, `pico ${fx(r.Tpk / 1000, 1)} kN·m (${fx(d.peak, 1)} ×)`]]],
      ['Cargas e apoios', [['def', 'mrot', `${f0(d.rotorMass)} kg`, `Fmag ${fx(d.ump * engine.G0 / 1000, 1)} kN · eixo ${f0(r.mass.shaft)} kg`], ['calc', 'RA · RB', `${fx(r.RA / 1000, 1)} · ${fx(r.RB / 1000, 1)} kN`, 'estática, apoios simples'], ['calc', 'Mmáx', `${fx(Math.abs(r.Mmax.v) / 1e6, 1)} kN·m`, `em x = ${f0(r.Mmax.x)} mm`]]],
      ['Trechos', [['def', 'Kt · Kf', `${r.res.length} trechos`, `${engine.CRITERIA[d.fatigue]} · Se ${d.seMode === 'marin' ? 'Marin' : fx(d.se, 0) + ' MPa'}`], ['calc', 'SF mín.', `${fsf(Math.min(...r.res.map(s => s.sfy)))} · ${fsf(Math.min(...r.res.map(s => s.sff)))}`, 'escoamento · fadiga'], ['final', 'Situação', r.fails.length ? `${r.fails.length} abaixo` : 'todos atingem', r.fails.length ? r.fails.map(s => s.code).join(', ') : `pior ${r.crit.code}`]]],
      ['Rigidez e dinâmica', [['def', 'E', `${f0(d.E / 1000)} GPa`, d.kBearing ? `mancais ${f0(d.kBearing)} kN/mm` : 'mancais rígidos'], ['calc', 'y vão', `${fx(r.defl.span, 3)} mm`, `θ nos mancais ${fx(Math.max(Math.abs(r.defl.thA), Math.abs(r.defl.thB)) * 1000, 2)} mrad`], ['final', 'nc1', dyn ? `${f0(dyn.rpm[0])} rpm` : '—', dyn ? `${fx(dyn.rpm[0] / d.speed, 2)} × n` : '']]]
    ];
    stages.forEach(([title, rows], i) => {
      const li = add(ol, 'li', 'seq-stage');
      const st = add(li, 'strong');
      add(st, 'span', 'seq-n', i + 1);
      st.append(title);
      const dl = add(li, 'dl', 'seq-dl');
      for (const [kind, sym, val, note] of rows) {
        const row = add(dl, 'div', 'seq-row' + (kind === 'calc' ? ' is-calc' : kind === 'final' ? ' is-calc is-final' : ''));
        if (kind === 'final' && r.fails.length && sym === 'Situação') row.classList.add('is-bad');
        add(row, 'dt', '', sym);
        add(row, 'dd', '', val);
        add(row, 'small', '', note);
      }
    });
  }

  /* ---- Explorador: eixo + diagramas sincronizados ----------------------------------------------- */
  const LANE_ORDER = ['v', 'm', 't', 'y', 'th', 'u', 'modes'];
  const LANE_KEY = { v: 'var(--c-ink-2)', m: 'var(--c-em)', t: 'var(--c-s1)', y: 'var(--c-s3)', th: 'var(--c-s3)' };
  function explorerSection(r) {
    const d = r.d;
    if (ui.sel === null || !r.res[ui.sel]) ui.sel = r.crit.i;
    const box = add(output, 'section', 'sx');
    box.id = 'explorador';
    box.setAttribute('aria-label', 'Explorador do eixo');
    const head = add(box, 'div', 'sx-head');
    const ht = add(head, 'div');
    add(ht, 'h3', '', 'O eixo e seus esforços');
    add(ht, 'p', '', 'Mesma escala de x em todas as pistas. Passe o mouse para ler os valores; clique (ou toque) num trecho para examiná-lo. Setas ← → percorrem os trechos.');
    const tools = add(head, 'div', 'sx-tools');
    const chips = add(tools, 'div', 'sx-lanes');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Pistas visíveis');
    for (const id of LANE_ORDER) {
      if (id === 'modes' && !(r.dyn && r.dyn.design && r.dyn.design.ok)) continue;
      const b = add(chips, 'button', 'sx-chip', { v: 'Cortante', m: 'Momento', t: 'Torque', y: 'Flecha', th: 'Inclinação', u: 'Utilização', modes: 'Modos' }[id]);
      b.type = 'button';
      b.dataset.lane = id;
      b.setAttribute('aria-pressed', String(ui.lanes.includes(id)));
      if (LANE_KEY[id]) b.style.setProperty('--k', LANE_KEY[id]);
      b.addEventListener('click', () => {
        const on = ui.lanes.includes(id);
        ui.lanes = on ? ui.lanes.filter(x => x !== id) : LANE_ORDER.filter(x => x === id || ui.lanes.includes(x));
        b.setAttribute('aria-pressed', String(!on));
        saveUI();
        drawExplorer();
      });
    }
    const dm = add(chips, 'button', 'sx-chip sx-chip-dmin', 'Ø mínimo');
    dm.type = 'button';
    dm.setAttribute('aria-pressed', String(ui.dmin));
    dm.addEventListener('click', () => { ui.dmin = !ui.dmin; dm.setAttribute('aria-pressed', String(ui.dmin)); saveUI(); drawExplorer(); });
    // seletor de trecho
    const nav = add(box, 'div', 'sx-nav');
    const prevB = add(nav, 'button', 'sx-step', '‹');
    prevB.type = 'button'; prevB.setAttribute('aria-label', 'Trecho anterior');
    const sel = add(nav, 'select', 'sx-select');
    sel.setAttribute('aria-label', 'Trecho selecionado');
    r.res.forEach(s => { const o = add(sel, 'option', '', `${s.name}${s.ok ? '' : '  ✗'}`); o.value = s.i; });
    const nextB = add(nav, 'button', 'sx-step', '›');
    nextB.type = 'button'; nextB.setAttribute('aria-label', 'Próximo trecho');
    const read = add(nav, 'div', 'sx-read');
    read.setAttribute('aria-hidden', 'true');
    const stage = add(box, 'div', 'sx-stage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-roledescription', 'diagramas do eixo');
    const detail = add(box, 'div', 'sx-detail');
    Object.assign(ex, { r, box, stage, detail, sel, read, w: 0 });
    sel.addEventListener('change', () => select(+sel.value, true));
    prevB.addEventListener('click', () => select(Math.max(0, ui.sel - 1), true));
    nextB.addEventListener('click', () => select(Math.min(r.res.length - 1, ui.sel + 1), true));
    stage.addEventListener('keydown', e => {
      const n = r.res.length;
      const go = { ArrowLeft: ui.sel - 1, ArrowRight: ui.sel + 1, Home: 0, End: n - 1 }[e.key];
      if (go === undefined) return;
      e.preventDefault();
      select(Math.max(0, Math.min(n - 1, go)), true);
    });
    stage.addEventListener('focus', () => showCursor(r.res[ui.sel].xm, true));
    stage.addEventListener('blur', hideCursor);
    let down = null;
    stage.addEventListener('pointermove', e => { if (!ex.lay) return; showCursor(xFromEvent(e)); });
    stage.addEventListener('pointerleave', hideCursor);
    stage.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; if (e.pointerType !== 'mouse' && ex.lay) showCursor(xFromEvent(e)); });
    stage.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || !ex.lay) { down = null; return; }
      down = null;
      const x = xFromEvent(e);
      select(figs.secAt(r, x), false, x);
    });
    ex.pendingW = ex.stageW || 0;          // largura da última medição: a montagem não força layout
    drawExplorer();
    renderDetail();
    if ('ResizeObserver' in window) {
      ex.ro?.disconnect();
      ex.ro = new ResizeObserver(entries => { const w = Math.round(entries[0].contentRect.width); if (!w) return; ex.stageW = w; if (Math.abs(w - ex.w) > 6) requestAnimationFrame(drawExplorer); });
      ex.ro.observe(stage);
    }
  }
  function xFromEvent(e) {
    const svg = ex.stage.querySelector('svg'), rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * ex.lay.W;
    return Math.max(0, Math.min(ex.r.d.L, ex.lay.Xinv(px)));
  }
  function drawExplorer() {
    if (!ex.stage || !ex.r) return;
    const w = ex.printW || ex.pendingW || ex.stageW || Math.round(ex.stage.clientWidth) || 900;
    ex.pendingW = 0;
    ex.w = w;
    const lay = figs.explorer(ex.r, { W: w, lanes: ui.lanes, sel: ui.sel, dmin: ui.dmin });
    ex.lay = lay;
    ex.stage.innerHTML = lay.svg;
    ex.sel.value = ui.sel;
    ex.stage.setAttribute('aria-label', `${lay.lanes.map(l => l.title).join(', ')}. Trecho selecionado: ${ex.r.res[ui.sel].name}. Use as setas para trocar de trecho.`);
    readout(ex.r.res[ui.sel].xm, true);
  }
  function showCursor(x, pinned) {
    const lay = ex.lay, svg = ex.stage.querySelector('svg');
    if (!lay || !svg) return;
    const px = lay.X(x);
    const cross = svg.querySelector('.lx-cross');
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    for (const lane of lay.lanes) {
      const dot = svg.querySelector(`.lx-dot[data-lane="${lane.id}"]`);
      if (!dot) continue;
      const v = lane.id === 'modes' ? null : figs.valueAt(lane.data, x);
      if (lane.id === 'modes' || !finite(v)) { dot.setAttribute('visibility', 'hidden'); continue; }
      dot.setAttribute('cx', px); dot.setAttribute('cy', lane.Y(v)); dot.setAttribute('visibility', 'visible');
    }
    // pré-seleção: contorna o trecho sob o cursor no perfil
    const i = figs.secAt(ex.r, x);
    if (ex.hover !== i) {
      svg.querySelector('.sx-sec.is-hover')?.classList.remove('is-hover');
      svg.querySelector(`.sx-sec[data-sec="${i}"]`)?.classList.add('is-hover');
      ex.hover = i;
    }
    readout(x, pinned);
  }
  function hideCursor() {
    ex.stage?.querySelector('.sx-sec.is-hover')?.classList.remove('is-hover');
    ex.hover = null;
    const svg = ex.stage?.querySelector('svg');
    if (svg) { svg.querySelector('.lx-cross')?.setAttribute('visibility', 'hidden'); svg.querySelectorAll('.lx-dot').forEach(n => n.setAttribute('visibility', 'hidden')); }
    if (ex.r) readout(ex.r.res[ui.sel].xm, true);
  }
  function readout(x, pinned) {
    const r = ex.r, S = ex.lay?.S;
    if (!r || !S || !ex.read) return;
    const s = r.res[figs.secAt(r, x)];
    ex.read.replaceChildren();
    const item = (k, label, value, key) => { const sp = add(ex.read, 'span', 'sx-ri'); if (key) add(sp, 'i', 'tip-key').style.background = key; add(sp, 'em', '', label); add(sp, 'b', '', value); return sp; };
    item('x', 'x', `${fx(x, 1)} mm`);
    add(ex.read, 'span', 'sx-ri sx-ri-sec', `${s.code} · Ø${fx(s.d, 1)} · SF ${fsf(s.sfy)} / ${fsf(s.sff)}`).classList.toggle('is-fail', !s.ok);
    item('m', 'M', `${fx(figs.valueAt(S.m, x), 2)} kN·m`, LANE_KEY.m);
    item('t', 'T', `${fx(figs.valueAt(S.t, x), 2)} kN·m`, LANE_KEY.t);
    item('v', 'V', `${fx(figs.valueAt(S.v, x), 2)} kN`, LANE_KEY.v);
    item('y', 'y', `${fx(figs.valueAt(S.y, x), 4)} mm`, LANE_KEY.y);
    item('th', 'θ', `${fx(figs.valueAt(S.th, x), 3)} mrad`, LANE_KEY.th);
    ex.read.classList.toggle('is-pinned', !!pinned);
  }
  function select(i, fromKeys, x) {
    const r = ex.r;
    if (!r || !r.res[i]) return;
    ui.sel = i;
    saveUI();
    drawExplorer();
    renderDetail();
    renderSectionMemory();
    const hs = output.querySelector('.hero-shaft');
    if (hs) hs.innerHTML = figs.heroFigure(r, { sel: ui.sel });
    output.querySelectorAll('.st-row').forEach(tr => tr.classList.toggle('sel', +tr.dataset.sec === i));
    if (fromKeys) showCursor(r.res[i].xm, true);
    else if (finite(x)) showCursor(x, true);
  }
  function sfBar(parent, label, sf, min, gov) {
    const row = add(parent, 'div', 'sfb' + (sf < min ? ' is-fail' : sf < min / 0.9 ? ' is-warn' : '') + (gov ? ' is-gov' : ''));
    const top = add(row, 'div', 'sfb-top');
    add(top, 'span', '', label);
    const v = add(top, 'b', '', fsf(sf));
    add(v, 'small', '', ` / mín. ${fx(min, 1)}`);
    const tr = add(row, 'div', 'sfb-track');
    const scale = 2.5 * min;
    add(tr, 'span', 'sfb-fill').style.width = `${Math.min(100, sf / scale * 100)}%`;
    add(tr, 'span', 'sfb-min').style.left = `${min / scale * 100}%`;
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', `${label}: ${fsf(sf)}, mínimo ${fx(min, 1)}`);
  }
  function renderDetail() {
    const r = ex.r, s = r.res[ui.sel], d = r.d, box = ex.detail;
    box.replaceChildren();
    const head = add(box, 'div', 'sxd-head');
    add(head, 'span', 'sxd-code' + (s.ok ? '' : ' is-fail'), s.code);
    const t = add(head, 'div', 'sxd-title');
    add(t, 'strong', '', s.name.replace(s.code, '').trim() || s.name);
    add(t, 'small', '', `x ${fx(s.a, 1)} → ${fx(s.b, 1)} mm · ${fx(s.len, 1)} mm · Ø${fx(s.d, 3)}${s.di ? ` × Ø${fx(s.di, 1)} furo` : ''}${s.flats ? ` · planos ${fx(s.flats, 1)}` : ''}`);
    add(head, 'span', 'chip ' + (s.ok ? (s.util > 0.9 ? 'chip-warn' : 'chip-ok') : 'chip-fail'), s.ok ? (s.util > 0.9 ? '△ perto do limite' : '✓ atinge') : '✗ abaixo');
    const grid = add(box, 'div', 'sxd-grid');
    const bars = add(grid, 'div', 'sxd-bars');
    sfBar(bars, 'Escoamento (com pico)', s.sfy, d.sfY, s.gov === 'esc');
    sfBar(bars, `Fadiga · ${engine.CRITERIA[d.fatigue]}`, s.sff, d.sfF, s.gov === 'fad');
    const dm = add(bars, 'p', 'sxd-dmin');
    dm.append('Ø mínimo da fórmula ');
    add(dm, 'b', '', nb(fx(s.dmin, 1), 'mm'));
    dm.append(s.d >= s.dmin ? ` · folga de ${fx((s.d / s.dmin - 1) * 100, 1)} %` : ` · faltam ${fx(s.dmin - s.d, 1)} mm`);
    const dl = add(grid, 'dl', 'sxd-kv');
    for (const [k, v] of [
      ['M máx.', `${fx(s.m / 1e6, 3)} kN·m`], ['T', `${fx(s.torque / 1000, 2)} kN·m`], ['σb', `${fx(s.sb, 1)} MPa`], ['τ', `${fx(s.tau, 1)} MPa`],
      ['σvm (Kt, pico)', `${fx(s.vm, 1)} MPa`], ['σa · σm', `${fx(s.sa, 1)} · ${fx(s.sm, 1)} MPa`], ['Kt · Kf', `${fx(s.kt, 2)} · ${fx(s.kf, 2)}${finite(s.q) ? ` (q ${fx(s.q, 2)})` : ''}`], ['Se', `${fx(s.se, 0)} MPa`],
      ['kpico adm.', finite(s.fpkAdm) ? `${fx(s.fpkAdm, 2)} ×` : 'sem torque'], ['I', `${fx(s.I / 1e6, 1)}·10⁶ mm⁴`]
    ]) { const it = add(dl, 'div'); add(it, 'dt', '', k); add(it, 'dd', '', v); }
    const a = add(box, 'a', 'sxd-link', 'Memória de cálculo deste trecho ↓');
    a.href = '#memoria-trecho';
    a.addEventListener('click', e => { e.preventDefault(); const det = $('passo-trechos')?.querySelector('details'); if (det) det.open = true; $('memoria-trecho')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); });
  }

  /* ---- Seções da memória ------------------------------------------------------------------------- */
  function stepRow(parent, s) {
    const row = add(parent, 'div', 'step');
    const what = add(row, 'div', 'step-what');
    add(what, 'strong', '', s.title);
    if (s.source) add(what, 'small', '', s.source);
    const math = add(row, 'div', 'step-math');
    add(math, 'code', 'step-formula', s.formula);
    const sub = add(math, 'code', 'step-subst', s.subst);
    if (finite(s.value) || s.value === Infinity) { sub.append(' = '); add(sub, 'span', 'step-res', `${s.value === Infinity ? '∞' : fx(s.value, s.d ?? 2)}${s.unit ? ' ' + s.unit : ''}`); }
    if (s.comment) add(row, 'p', 'step-note', s.comment);
  }
  function table(parent, head, rows, cls = '') {
    const wrap = add(parent, 'div', 'tbl-wrap');
    const t = add(wrap, 'table', 'tbl' + (cls ? ' ' + cls : ''));
    if (head) { const tr = add(add(t, 'thead'), 'tr'); head.forEach(h => add(tr, 'th', '', h)); }
    const tb = add(t, 'tbody');
    for (const r of rows) { const tr = add(tb, 'tr', r.sel ? 'sel' : ''); r.cells.forEach((c, i) => add(tr, 'td', r.cls?.[i] || '', c)); }
    return t;
  }
  function sectionsTable(det, r) {
    const d = r.d;
    add(det, 'p', 'sub-h', 'Todos os trechos · clique numa linha para ver no explorador');
    const wrap = add(det, 'div', 'tbl-wrap');
    const t = add(wrap, 'table', 'tbl st-table');
    const hr = add(add(t, 'thead'), 'tr');
    for (const h of ['Trecho', 'x (mm)', 'Ø (mm)', 'M (kN·m)', 'T (kN·m)', 'σvm (MPa)', 'SF esc.', 'SF fad.', 'Ø mín. (mm)', 'Utilização']) add(hr, 'th', '', h);
    const tb = add(t, 'tbody');
    for (const s of r.res) {
      const tr = add(tb, 'tr', 'st-row' + (s.i === ui.sel ? ' sel' : '') + (s.ok ? '' : ' is-fail'));
      tr.dataset.sec = s.i;
      const td0 = add(tr, 'td', 'l');
      const b = add(td0, 'button', 'st-btn');
      b.type = 'button';
      add(b, 'span', 'st-code', s.code);
      b.append(' ' + (s.name.replace(s.code, '').trim()));
      add(tr, 'td', '', `${f0(s.a)}–${f0(s.b)}`);
      add(tr, 'td', '', fx(s.d, 1));
      add(tr, 'td', '', fx(s.m / 1e6, 2));
      add(tr, 'td', '', fx(s.torque / 1000, 2));
      add(tr, 'td', '', fx(s.vm, 1));
      add(tr, 'td', s.sfy < d.sfY ? 'fail' : '', fsf(s.sfy));
      add(tr, 'td', s.sff < d.sfF ? 'fail' : '', fsf(s.sff));
      add(tr, 'td', s.dmin > s.d ? 'fail' : '', fx(s.dmin, 1));
      const tdu = add(tr, 'td', 'st-u');
      const bar = add(tdu, 'span', 'st-bars');
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', `utilização ${fx(s.uy, 2)} no escoamento e ${fx(s.uf, 2)} na fadiga`);
      for (const [cls, u] of [['is-y', s.uy], ['is-f', s.uf]]) { const ln = add(bar, 'span', 'st-bar ' + cls + (u > 1 ? ' is-over' : '')); add(ln, 'i').style.width = `${Math.min(100, u / 1.5 * 100)}%`; }
      add(tdu, 'span', 'st-uv' + (s.util > 1 ? ' fail' : ''), fx(s.util, 2));
      b.addEventListener('click', () => { select(s.i, true); $('explorador')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); });
    }
    const lg = add(det, 'p', 'st-legend');
    for (const [cls, t2] of [['is-y', 'escoamento'], ['is-f', 'fadiga']]) { const s = add(lg, 'span'); add(s, 'i', 'st-key ' + cls); s.append(t2); }
    lg.append(` · barra cheia = 1,5 × o mínimo; marca em 1,0. Torque ${d.torqueMode === 'linear' ? 'pelo caminho real' : 'integral'}${r.res.some(s => s.tpct !== null && s.tpct !== undefined) ? ' (com frações por trecho)' : ''}.`);
    const mem = add(det, 'div', 'sec-memory');
    mem.id = 'memoria-trecho';
    ex.memory = mem;
    renderSectionMemory();
  }
  function renderSectionMemory() {
    const mem = ex.memory, r = ex.r || last;
    if (!mem || !r) return;
    const s = r.res[ui.sel] || r.crit;
    mem.replaceChildren();
    const h = add(mem, 'p', 'sub-h');
    h.append(`Memória do trecho selecionado · ${s.name}`);
    const list = add(mem, 'div', 'steps');
    for (const st of engine.sectionSteps(r, s)) stepRow(list, st);
  }
  function criticalExtras(det, r) {
    const d = r.d, D = r.dyn;
    if (!D) return;
    // tabela de configurações
    const rows = [];
    const row = (lab, c, note) => { if (c && c.ok) rows.push({ cells: [lab, f0(c.rpm[0]), f0(c.rpm[1]), f0(c.rpm[2]), `${fx(c.rpm[0] / d.speed, 2)} ×`, note] }); };
    row('Mancais rígidos', D.rigid, 'referência');
    row(`Mancais de ${f0(d.kBearing)} kN/mm`, D.flex, 'grupo 06');
    row(`Com rigidez magnética (${fx(D.kMag, 0)} N/mm)`, D.mag, `e = ${fx(d.umpEcc, 0)} % de g`);
    add(det, 'p', 'sub-h', 'Críticas por configuração');
    table(det, ['Configuração', '1ª (rpm)', '2ª (rpm)', '3ª (rpm)', '1ª / n', 'Nota'], rows.map(x => ({ ...x, cls: ['l', '', '', '', '', 'l dim'] })));
    // formas modais
    const md = figs.modesSVG(r, { animate: !reduced() });
    if (md) {
      add(det, 'p', 'sub-h', 'Formas dos modos · ' + D.designLabel);
      const fig = add(det, 'figure', 'chart chart-modes');
      fig.innerHTML = md;
      add(fig, 'figcaption', '', 'Sombra: o eixo em escala; a linha é a forma de cada modo (amplitude relativa). Onde ela mais se afasta do eixo é onde o modo mais se move: no vão entre os mancais, o pacote do rotor; nas pontas, os balanços. Os triângulos marcam os mancais.');
    }
    // mapa (sob demanda, em cache pela geometria)
    add(det, 'p', 'sub-h', 'Mapa de críticas × rigidez dos mancais');
    const fig = add(det, 'figure', 'chart');
    const wrap = add(fig, 'div', 'pf-wrap chart-wrap');
    const legend = add(fig, 'div', 'pf-legend');
    for (const [c, t] of [['--c-s1', '1º modo'], ['--c-em', '2º modo'], ['--c-s3', '3º modo']]) { const s = add(legend, 'span'); add(s, 'i').style.background = `var(${c})`; s.append(t); }
    fig.prepend(legend);
    add(fig, 'figcaption', '', 'Com mancais macios, os primeiros modos são de corpo rígido (o eixo inteiro sobe e desce ou balança); com mancais rígidos, as curvas encostam nas críticas de flexão. A faixa marca a rotação ± a margem: nenhuma curva deve cruzá-la perto da rigidez real dos mancais.');
    const drawMap = () => {
      const key = engine.mapKey(d);
      if (mapCache.key !== key) { mapCache = { key, map: engine.criticalMap(r) }; }
      const ch = figs.mapSVG(r, mapCache.map);
      if (!ch) return;
      wrap.innerHTML = ch.svg;
      mapHover(wrap, ch, mapCache.map, r);
    };
    if (det.open) drawMap(); else det.addEventListener('toggle', () => { if (det.open && !wrap.firstChild) drawMap(); }, { once: false });
  }
  function mapHover(wrap, ch, map, r) {
    const svg = wrap.querySelector('svg'), cross = svg.querySelector('.pf-cross'), dots = svg.querySelectorAll('.mp-hover');
    let idx = Math.round(map.length / 2);
    const drawAt = i => {
      idx = Math.max(0, Math.min(map.length - 1, i));
      const p = map[idx], x = ch.X(p.k / 1e6);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dots.forEach((dot, j) => { const v = p.rpm[j]; if (finite(v) && v <= ch.yMax) { dot.setAttribute('cx', x); dot.setAttribute('cy', ch.Y(v)); dot.setAttribute('visibility', 'visible'); } else dot.setAttribute('visibility', 'hidden'); });
      tipRows(`k = ${f0(p.k / 1e6)} kN/mm`, p.rpm.map((v, j) => ({ key: ['var(--c-s1)', 'var(--c-em)', 'var(--c-s3)'][j], value: `${f0(v)} rpm`, label: `${j + 1}º modo · ${fx(v / r.d.speed, 2)} × n` })));
      const rect = svg.getBoundingClientRect();
      placeTip(rect.left + x / ch.MP.W * rect.width, rect.top + ch.Y(Math.min(p.rpm[0], ch.yMax)) / ch.MP.H * rect.height);
    };
    const fromEvent = e => {
      const rect = svg.getBoundingClientRect(), px = (e.clientX - rect.left) / rect.width * ch.MP.W;
      let best = 0;
      map.forEach((p, i) => { if (Math.abs(ch.X(p.k / 1e6) - px) < Math.abs(ch.X(map[best].k / 1e6) - px)) best = i; });
      drawAt(best);
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); dots.forEach(n => n.setAttribute('visibility', 'hidden')); tip.hidden = true; };
    svg.addEventListener('pointermove', fromEvent);
    svg.addEventListener('pointerdown', fromEvent);
    svg.addEventListener('pointerleave', hide);
    wrap.tabIndex = 0;
    wrap.setAttribute('aria-label', 'Mapa de críticas: use as setas para variar a rigidez');
    wrap.addEventListener('focus', () => drawAt(idx));
    wrap.addEventListener('blur', hide);
    wrap.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); drawAt(idx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); drawAt(idx - 1); } });
  }
  function balanceExtras(det, r) {
    const B = r.bal, d = r.d;
    if (!B) return;
    add(det, 'p', 'sub-h', 'Desbalanceamento residual admissível por plano (mancais)');
    table(det, ['Plano', 'Distância ao CG (mm)', 'Uper (g·mm)', 'Parcela', 'Força a n (kN)', 'Reação estática (kN)'], [
      { cells: ['Mancal A', fx(B.LA, 1), f0(B.UA), `${fx(B.UA / B.U * 100, 0)} %`, fx(B.FA / 1000, 2), fx(r.RA / 1000, 1)] },
      { cells: ['Mancal B', fx(B.LB, 1), f0(B.UB), `${fx(B.UB / B.U * 100, 0)} %`, fx(B.FB / 1000, 2), fx(r.RB / 1000, 1)] },
      { sel: true, cells: ['Total', '', f0(B.U), '100 %', fx((B.FA + B.FB) / 1000, 2), fx((r.RA + r.RB) / 1000, 1)] }
    ]);
    add(det, 'p', 'step-note', `Massa girante ${f0(B.m)} kg, G ${fx(B.G, 1)} mm/s a ${f0(d.speed)} rpm. A força girante residual é ${fx((B.FA + B.FB) / (r.RA + r.RB) * 100, 1)} % das reações estáticas. Na sobrevelocidade (${fx(d.overspeed, 2)} ×) ela cresce com o quadrado: ${fx((B.FA + B.FB) * d.overspeed ** 2 / 1000, 2)} kN.`).style.marginTop = '8px';
  }
  function interfacesExtras(det, r) {
    const d = r.d;
    add(det, 'p', 'sub-h', `Chavetas · ${fx(d.peak, 1)} × T no pico · escoamento da chaveta ${f0(d.keySy)} MPa`);
    table(det, ['Chaveta', 'Ø × b × t × L (mm)', 'Torque', 'F (kN)', 'τ nom. (MPa)', 'p eixo (MPa)', 'p cubo (MPa)', 'SF (pico)'], r.keyRes.map(k => ({
      cells: [k.name, `${fx(k.d, 1)} × ${fx(k.b, 2)} × ${fx(k.t, 2)} × ${f0(k.L)}`, `${f0(k.share)} %`, fx(k.F / 1000, 1), fx(k.tau, 1), fx(k.pS, 1), finite(k.pH) ? fx(k.pH, 1) : '—', fsf(k.sf)],
      cls: ['l', 'l', '', '', '', '', '', k.ok ? 'ok' : 'fail']
    })));
    add(det, 'p', 'step-note', 'SF = menor entre cisalhamento (Sy/√3 ÷ τ) e esmagamento (Sy ÷ p) com o torque de pico. Para a pressão no cubo, informe a altura da chaveta no editor. "Torque" é a parcela que cada chaveta leva sozinha: 100 % é o caso conservador do script.').style.marginTop = '8px';
    add(det, 'p', 'sub-h', `Ajustes por interferência · atrito ${fx(d.mu, 2)} · interferência ${fx(d.interf, 2)} ± ${fx(d.interfTol, 2)} mm`);
    table(det, ['Assento', 'Ø × L (mm)', 'Torque', 'p requerida (MPa)', 'p no pico', 'p gerada a n (MPa)', 'Transmite / T', 'Cubo σvm (MPa)'], r.fitRes.map(f => ({
      cells: [f.name, `${fx(f.d, 1)} × ${fx(f.L, 1)}`, `${f0(f.share)} %`, fx(f.pReq, 2), fx(f.pReqPk, 2), f.hub ? `${fx(f.pN, 1)} (parado ${fx(f.p0, 1)})` : 'informe o cubo', f.hub ? `${fx(f.sfN, 2)} ×` : '—', f.hub ? f0(f.hubVm) : '—'],
      cls: ['l', 'l', '', '', '', f.hub ? '' : 'dim', f.hub ? (f.ok ? 'ok' : 'fail') : '', '']
    })));
    add(det, 'p', 'step-note', `Pressão gerada por Lamé com a interferência mínima (${fx(d.interf - d.interfTol, 2)} mm) menos o alisamento (${fx(d.smooth, 3)} mm) e a perda por rotação: o cubo cresce mais que o eixo, ΔU = (3 + ν)·ρ·ω²·d·b²/(4E). Eixo maciço e cubo como disco livre; tensão no cubo com a interferência máxima.`).style.marginTop = '8px';
  }
  function bearingExtras(det, r) {
    const d = r.d;
    table(det, ['Mancal', 'Colo', 'Ø × B (mm)', 'Carga (kN)', 'p̄ (MPa)', 'v (m/s)', 'θ (mrad)', 'Borda (µm)'], r.bearings.map(b => ({
      cells: [b.name, b.s.code, `${fx(b.D, 1)} × ${fx(b.B, 1)}`, fx(Math.abs(b.F) / 1000, 2), fx(b.p, 3), fx(b.v, 1), fx(b.th * 1000, 3), fx(b.edge * 1000, 1)],
      cls: ['l', 'l', '', '', b.p > 2.5 ? 'warn' : '', '', b.ok ? '' : 'fail', '']
    })));
    const p = add(det, 'p', 'step-note');
    p.style.marginTop = '8px';
    p.append('B é o comprimento do colo, então p̄ é o limite inferior. Para o filme de óleo (Reynolds), abra o mancal no laboratório 01 já com estes dados: ');
    r.bearings.forEach((b, i) => {
      const q = new URLSearchParams({ equipamento: (r.info.equipamento || '').slice(0, 60), tipo_maquina: d.machine === 'motor' ? 'Motor' : 'Gerador', potencia: String(Math.round(r.Pshaft * 100) / 100), unidade_potencia: 'kW', modo_rotacao: 'rpm', rotacao: String(d.speed), mancal_diametro: String(b.D), mancal_largura: String(Math.round(b.B * 100) / 100), carga_modo: 'carga', mancal_carga: String(Math.round(Math.abs(b.F))), aba: 'mancal' });
      const a = add(p, 'a', 'lab-link', `mancal ${b.name} →`);
      a.href = `laboratorio.html#${q.toString()}`;
      if (i === 0) p.append(' · ');
    });
    p.append('.');
  }
  function checksExtras(det, r) {
    const box = add(det, 'div', 'checks');
    const order = { fail: 0, warn: 1, info: 2, ok: 3 };
    for (const c of [...r.checks].sort((a, b) => order[a.sev] - order[b.sev])) {
      const row = add(box, 'div', 'check');
      add(row, 'span', 'chip ' + { ok: 'chip-ok', warn: 'chip-warn', fail: 'chip-fail', info: 'chip-info' }[c.sev], { ok: '✓ ok', warn: '△ atenção', fail: '✗ falha', info: 'i nota' }[c.sev]);
      const t = add(row, 'div');
      add(t, 'strong', '', c.title);
      add(t, 'p', '', c.detail);
    }
  }
  function pendingExtras(det, r) {
    if (r.notes.length) {
      add(det, 'p', 'sub-h', 'Pendências do projeto (grupo Identificação)');
      const ul = add(det, 'ul', 'pend');
      for (const n of r.notes) add(ul, 'li', '', n);
    }
    add(det, 'p', 'sub-h', 'O que a triagem não cobre');
    const ul = add(det, 'ul', 'pend pend-scope');
    for (const t of [
      'Resistência local de raios, ombros, furos e rasgos (Kt e Kf são estimados por trecho): para liberar, DIN 743 completa ou elementos finitos 3D.',
      'Torque transitório real: curto-circuito, ressincronização e torcional do conjunto turbina–gerador–acoplamento.',
      'Críticas amortecidas e efeito giroscópico: a análise aqui é não amortecida, com mancais rígidos ou molas lineares.',
      'Pressão gerada nos ajustes sem o Ø do cubo; fixadores, furo axial e a montagem do pacote.',
      'Material: propriedades do certificado na seção e na direção reais da peça forjada.'
    ]) add(ul, 'li', '', t);
  }
  const REFS = [
    ['Projeto de eixos: tensões, Goodman, ASME e Marin', 'Fluxo de cálculo de eixos com flexão alternada e torção constante; critérios DE-Goodman, DE-Gerber, DE-ASME elíptico e DE-Soderberg; fatores de Marin e sensibilidade ao entalhe.', 'Budynas & Nisbett, Shigley’s Mechanical Engineering Design, cap. 6 e 7'],
    ['Inclinações admissíveis nos mancais', 'Faixas típicas de inclinação para rolamentos de rolos, esferas e engrenagens; base do campo "inclinação admissível".', 'Shigley, tab. 7-2'],
    ['Viga de Timoshenko e massa consistente', 'Elementos de 2 nós com deformação por cisalhamento (coeficiente de Cowper para seção vazada) e inércia de rotação.', 'Przemieniecki, Theory of Matrix Structural Analysis · Cowper (1966)'],
    ['Iteração em subespaço', 'Autovalores mais baixos do problema K·φ = ω²·M·φ com fatoração em banda; o quociente de Rayleigh com a deflexão pelo peso confere a 1ª crítica.', 'Bathe, Finite Element Procedures, cap. 11'],
    ['Qualidade de balanceamento', 'Uper = 1000·G·m/ω; G 2,5 para máquinas elétricas acima de 950 rpm; divisão nos planos dos mancais com limites de 30 % e 70 % para rotor entre mancais.', 'ISO 1940-1 / ISO 21940-11, cl. 6 e 7'],
    ['Sobrevelocidade', 'Ensaio de sobrevelocidade das máquinas girantes; 1,2 × a rotação máxima na maioria dos casos.', 'IEC 60034-1'],
    ['Ajuste por interferência', 'Pressão de Lamé entre eixo e cubo, perda por alisamento das rugosidades e perda por rotação do cubo.', 'DIN 7190 · Shigley, cap. 3'],
    ['Resistência local de eixos', 'Fatores de entalhe por forma, tamanho e acabamento para liberar o eixo; a triagem aqui não substitui essa verificação.', 'DIN 743-1 a 4']
  ];
  function refsExtras(det) {
    const box = add(det, 'div', 'refs');
    for (const [t, p, s] of REFS) { const c = add(box, 'div', 'ref'); add(c, 'strong', '', t); add(c, 'p', '', p); add(c, 'span', '', s); }
    const sc = add(det, 'p', 'scope');
    add(sc, 'b', '', 'Escopo. ');
    sc.append('Porte do calcular.py (mesmos números com as mesmas premissas) com acréscimos: caminho do torque, critérios de fadiga, Se por Marin, fator de pico admissível, flecha no vão e inclinação nos mancais, críticas por elementos finitos com mapa de rigidez e rigidez magnética, balanceamento ISO 1940, pressões nas chavetas, Lamé nos ajustes e pressão específica nos colos. Triagem: não libera o eixo.');
  }
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
    view.setAttribute('aria-label', 'Folha A3 com o eixo, os diagramas e as tabelas de resultados.');
    const paper = add(view, 'div', 'sheet-paper');
    paper.innerHTML = markup;
    const setZoom = z => { sheetZoom = Math.max(1, Math.min(4, z)); paper.style.width = (sheetZoom * 100) + '%'; zoomLabel.textContent = Math.round(sheetZoom * 100) + ' %'; };
    setZoom(sheetZoom);
    zoomIn.addEventListener('click', () => setZoom(sheetZoom * 1.4));
    zoomOut.addEventListener('click', () => setZoom(sheetZoom / 1.4));
    fit.addEventListener('click', () => setZoom(1));
    const os = (r.info?.os || '').replace(/[^\w-]/g, '');
    const fileName = `eixo${os ? '-' + os : ''}`;
    dl.addEventListener('click', () => { download(fileName + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + markup, 'image/svg+xml'); toast('Desenho baixado em SVG'); });
    pr.addEventListener('click', () => {
      const wnd = window.open('', '_blank');
      if (!wnd) { toast('Permita janelas pop-up para imprimir'); return; }
      wnd.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${fileName}</title><style>@page{size:A3 landscape;margin:0}html,body{margin:0;background:#fff}svg{display:block;width:420mm;height:297mm}</style></head><body>${markup}<script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script></body></html>`);
      wnd.document.close();
    });
    add(det, 'p', 'step-note sheet-note', 'Folha de triagem: eixo em escala com balões dos trechos, diagramas de momento e flecha, tabelas e carimbo. O SVG abre no navegador e pode ser importado em CAD; para PDF use "Imprimir A3". Cliente, O.S. e equipamento vêm do grupo Identificação.');
  }

  const SECTIONS = [
    ['torque', 'Potência e torque', 'Da FTD à potência no eixo; torque nominal, de pico e ângulo de torção.'],
    ['cargas', 'Massas e cargas', 'Peso de cada trecho, massa do rotor distribuída, força magnética e acoplamento.'],
    ['reacoes', 'Reações nos mancais', 'Equilíbrio de forças e de momentos com apoios simples em A e B.'],
    ['esforcos', 'Esforços ao longo do eixo', 'Momento fletor por superposição, cortante e momentos nos mancais.'],
    ['trechos', 'Coeficientes por trecho e Ø mínimo', 'Von Mises com pico e Kt no escoamento; flexão alternada e torque constante na fadiga.'],
    ['flecha', 'Flecha e inclinação', 'Dupla integração de M/(E·I) com flecha zero nos mancais, conferida por elementos finitos.'],
    ['criticas', 'Velocidades críticas', 'Viga de Timoshenko em elementos finitos: mancais rígidos, elásticos e rigidez magnética.'],
    ['balanceamento', 'Balanceamento', 'Desbalanceamento residual admissível (ISO 1940) e força girante nos mancais.'],
    ['interfaces', 'Chavetas e ajustes', 'Cisalhamento e esmagamento das chavetas; pressão requerida e gerada nos ajustes.'],
    ['mancais', 'Mancais', 'Pressão específica, velocidade periférica e inclinação nos colos.'],
    ['checks', 'Verificações', 'Todas as conferências automáticas, inclusive as que passaram.'],
    ['pendencias', 'Pendências e escopo', 'O que ainda falta para liberar o eixo.'],
    ['refs', 'Referências', 'Shigley, Bathe, ISO 1940, IEC 60034-1, DIN 7190 e DIN 743.'],
    ['desenho', 'Folha A3 · opcional', 'Eixo em escala, diagramas, tabelas e carimbo. Abra para gerar a folha.']
  ];
  const SEC_DEFAULT_CLOSED = new Set(['refs', 'desenho', 'pendencias']);
  function sectionKey(id, r) {
    const d = r.d, nW = r.checks.filter(c => c.sev === 'warn').length, nF = r.checks.filter(c => c.sev === 'fail').length, D = r.dyn?.design;
    return {
      torque: ['T · Tpico', `${fx(r.T / 1000, 2)} · ${fx(r.Tpk / 1000, 1)} kN·m`],
      cargas: ['Massa girante', `${f0(r.mass.total)} kg`],
      reacoes: ['RA · RB', `${fx(r.RA / 1000, 1)} · ${fx(r.RB / 1000, 1)} kN`],
      esforcos: ['Mmáx', `${fx(Math.abs(r.Mmax.v) / 1e6, 2)} kN·m`],
      trechos: ['Abaixo', r.fails.length ? r.fails.map(s => s.code).join(', ') : 'nenhum'],
      flecha: ['Vão · ponta', `${fx(r.defl.span, 3)} · ${fx(r.defl.max, 3)} mm`],
      criticas: ['1ª crítica', D && D.ok ? `${f0(D.rpm[0])} rpm` : '—'],
      balanceamento: ['Uper', r.bal ? `${f0(r.bal.U)} g·mm` : '—'],
      interfaces: ['Chavetas', `${r.keyRes.filter(k => k.ok).length}/${r.keyRes.length} ok`],
      mancais: ['p̄ máx.', `${fx(Math.max(...r.bearings.map(b => b.p)), 2)} MPa`],
      checks: ['Situação', nF ? `${nF} ${plural(nF, 'falha', 'falhas')}` : nW ? `${nW} ${plural(nW, 'aviso', 'avisos')}` : 'tudo certo'],
      pendencias: ['Itens', `${r.notes.length}`],
      refs: ['Base', 'Shigley · ISO'],
      desenho: ['Folha', 'A3 · S/E']
    }[id];
  }

  /* ---- Renderização ------------------------------------------------------------------------------ */
  function render(r) {
    last = r;
    ex.r = r;
    output.replaceChildren();
    heroSection(r);
    alertsSection(r);
    chainSection(r);
    explorerSection(r);
    const nav = add(output, 'nav', 'stepnav');
    nav.setAttribute('aria-label', 'Passos do cálculo');
    SECTIONS.forEach(([id, t], i) => { const a = add(nav, 'a'); a.href = '#passo-' + id; add(a, 'span', 'stepnav-n', i + 1); a.append(t); });
    SECTIONS.forEach(([id, t, intro], i) => {
      const sec = add(output, 'section', 'sec' + (id === 'desenho' ? ' sec-sheet' : ''));
      sec.id = 'passo-' + id;
      const det = add(sec, 'details');
      det.open = id in secOpen ? !!secOpen[id] : !SEC_DEFAULT_CLOSED.has(id);
      det.addEventListener('toggle', () => { secOpen[id] = det.open; ss.set(SEC_KEY, secOpen); });
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
      if (id === 'trechos') sectionsTable(det, r);
      if (id === 'criticas') criticalExtras(det, r);
      if (id === 'balanceamento') balanceExtras(det, r);
      if (id === 'interfaces') interfacesExtras(det, r);
      if (id === 'mancais') bearingExtras(det, r);
      if (id === 'checks') checksExtras(det, r);
      if (id === 'pendencias') pendingExtras(det, r);
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

  /* ---- Celular ----------------------------------------------------------------------------------- */
  function setView(view, scroll = true) {
    workspace.dataset.view = view;
    for (const b of document.querySelectorAll('.s-mobilebar button')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    $('s-peek').hidden = view !== 'dados';
    ss.set(VIEW_KEY, view);
    if (scroll && isMobile()) window.scrollTo({ top: 0 });
    if (view === 'resultado' && ex.stage) requestAnimationFrame(drawExplorer);
  }
  function updatePeek(r, text) {
    $('s-peek').classList.toggle('is-bad', !r || r.fails.length > 0);
    $('s-peek-value').textContent = r ? (r.fails.length ? `${r.fails.length} de ${r.res.length} abaixo · pior ${r.crit.code}` : `${r.res.length} de ${r.res.length} atingem · ${r.crit.code} ${fx(r.crit.util, 2)}`) : text;
  }
  for (const b of document.querySelectorAll('.s-mobilebar button')) b.addEventListener('click', () => setView(b.dataset.view));
  $('s-peek-btn').addEventListener('click', () => setView('resultado'));

  /* ---- Cálculo ------------------------------------------------------------------------------------ */
  let lastKey = '';
  function recalculate(force = false) {
    const values = collect();
    const key = JSON.stringify(values);
    if (!force && key === lastKey) return;
    lastKey = key;
    try { localStorage.setItem(CASE_KEY, key); } catch (_) {}
    try {
      const r = engine.calculate(values);
      lastErr = null;
      markFields(values);
      updateForm(r, values);
      render(r);
      editor.update(r, null);
      errorBox.hidden = true;
      output.classList.remove('is-stale');
      for (const id of ['s-print', 's-copy']) $(id).disabled = false;
    } catch (err) {
      const isInput = err instanceof engine.InputError;
      if (!isInput) console.error(err);
      lastErr = isInput ? err : null;
      const fields = isInput ? err.fields : {};
      const general = isInput ? err.errors : ['Não foi possível calcular. Revise os dados.'];
      markFields(values, fields);
      updateForm(null, values);
      editor.update(null, err);
      const keys = Object.keys(fields), n = keys.length;
      errorBox.replaceChildren();
      add(errorBox, 'strong', '', general.length ? 'Não fecha com esses dados' : `${n} ${plural(n, 'campo', 'campos')} a revisar`);
      const ul = add(errorBox, 'ul');
      for (const m of general) add(ul, 'li', '', m);
      for (const [k, m] of Object.entries(fields)) {
        const li = add(ul, 'li');
        const tm = /^(sec|key|fit):(\d+):(\w+)$/.exec(k);
        if (tm) {
          const tab = { sec: 'sections', key: 'keys', fit: 'fits' }[tm[1]], row = tables[tab][+tm[2]];
          const col = { sec: engine.SECTION_COLS, key: engine.KEY_COLS, fit: engine.FIT_COLS }[tm[1]].find(c => c.key === tm[3]);
          const a = add(li, 'a', '', `${{ sec: 'Trecho', key: 'Chaveta', fit: 'Ajuste' }[tm[1]]} ${row?.name || +tm[2] + 1} · ${col ? col.label : tm[3]}`);
          a.href = '#';
          a.addEventListener('click', e => { e.preventDefault(); editor.open(tab); setTimeout(() => { const inp = document.querySelector(`.ed-in[data-row="${tm[2]}"][data-col="${tm[3]}"]`); inp?.focus(); inp?.scrollIntoView({ block: 'center' }); }, 30); });
        } else {
          const a = add(li, 'a', '', engine.FIELD[k]?.label || k);
          a.href = '#f-' + k;
          a.addEventListener('click', e => { e.preventDefault(); setView('dados', false); const c = controls.get(k); if (!c) return; c.closest('details').open = true; c.focus(); c.scrollIntoView({ block: 'center' }); });
        }
        li.append(': ' + m);
      }
      errorBox.hidden = false;
      output.classList.toggle('is-stale', !!output.firstChild);
      for (const id of ['s-print', 's-copy']) $(id).disabled = true;
      updatePeek(null, general.length ? 'Não fecha · revise' : `${n} ${plural(n, 'campo', 'campos')} a revisar`);
    }
  }

  /* ---- Exportar, abrir, copiar e imprimir ------------------------------------------------------- */
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = el('a'); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function copyText(text, msg) {
    const done = () => toast(msg);
    const fallback = () => {
      const ta = add(document.body, 'textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      ta.select();
      try { document.execCommand('copy'); done(); } catch (_) { toast('Não foi possível copiar'); }
      ta.remove();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function summaryText(r) {
    const d = r.d, i = r.info || {}, D = r.dyn?.design;
    const ident = [i.cliente && `Cliente: ${i.cliente}`, i.os && `O.S.: ${i.os}`, i.equipamento && `Equipamento: ${i.equipamento}`].filter(Boolean).join(' · ');
    const head = ['TRIAGEM DO EIXO — NÃO É LIBERAÇÃO DE PROJETO', ident,
      `Potência no eixo ${fx(r.Pshaft, 2)} kW a ${f0(d.speed)} rpm · T ${fx(r.T / 1000, 2)} kN·m · pico ${fx(r.Tpk / 1000, 2)} kN·m (${fx(d.peak, 2)} ×)`,
      `Reações: A ${fx(r.RA / 1000, 2)} kN · B ${fx(r.RB / 1000, 2)} kN · massa do eixo ${f0(r.mass.shaft)} kg + rotor ${f0(d.rotorMass)} kg`,
      `Momento máximo ${fx(Math.abs(r.Mmax.v) / 1e6, 2)} kN·m em x = ${fx(r.Mmax.x, 1)} mm · flecha ${fx(r.defl.span, 3)} mm no vão, ${fx(r.defl.max, 3)} mm máx.`,
      D && D.ok ? `Críticas (${r.dyn.designLabel}): ${D.rpm.map(v => f0(v)).join(' · ')} rpm · 1ª = ${fx(D.rpm[0] / d.speed, 2)} × n` : '',
      r.bal ? `Balanceamento G ${fx(r.bal.G, 1)}: Uper ${f0(r.bal.U)} g·mm (A ${f0(r.bal.UA)} · B ${f0(r.bal.UB)})` : '',
      `Trechos abaixo dos mínimos (SF esc. ${fx(d.sfY, 1)} · fad. ${fx(d.sfF, 1)}): ${r.fails.length ? r.fails.map(s => s.code).join(', ') : 'nenhum'}`].filter(Boolean);
    const rows = [['Trecho', 'x início (mm)', 'x fim (mm)', 'Ø (mm)', 'M (kN·m)', 'T (kN·m)', 'SF esc.', 'SF fad.', 'Ø mín. (mm)', 'Situação'].join('\t')]
      .concat(r.res.map(s => [s.name, fx(s.a, 2), fx(s.b, 2), fx(s.d, 3), fx(s.m / 1e6, 3), fx(s.torque / 1000, 2), fsf(s.sfy), fsf(s.sff), fx(s.dmin, 1), s.ok ? 'atinge' : 'abaixo'].join('\t')));
    return head.concat([''], rows).join('\n');
  }
  function exportCase() {
    const values = collect();
    const name = (values.os || values.equipamento || 'eixo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'eixo';
    download(`${name}.json`, JSON.stringify({ app: 'vg-laboratorio-eixo', version: 1, saved: new Date().toISOString(), values }, null, 1), 'application/json');
    toast('Caso salvo em JSON');
  }
  function importCase(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        const v = j && j.values ? j.values : j;
        if (!v || typeof v !== 'object' || !Array.isArray(v.sections)) throw new Error('formato');
        apply({ ...engine.EXAMPLE, ...v });
        ui.sel = null;
        recalculate(true);
        toast('Caso aberto');
      } catch (_) { toast('Arquivo não reconhecido'); }
    };
    rd.readAsText(file);
  }
  function printPage() {
    clearTimeout(timer);
    recalculate(true);
    if (!errorBox.hidden) return;
    for (const d of output.querySelectorAll('.sec:not(.sec-sheet) > details')) d.open = true;
    window.print();
  }

  $('s-reset').addEventListener('click', () => { apply(engine.EXAMPLE); ui.sel = null; recalculate(true); toast('Exemplo carregado'); });
  $('s-save').addEventListener('click', exportCase);
  $('s-open').addEventListener('click', () => $('s-file').click());
  $('s-file').addEventListener('change', e => { const f = e.target.files?.[0]; if (f) importCase(f); e.target.value = ''; });
  $('s-copy').addEventListener('click', () => { if (last) copyText(summaryText(last), 'Resumo e tabela copiados'); });
  $('s-print').addEventListener('click', printPage);
  window.addEventListener('beforeprint', () => { for (const d of output.querySelectorAll('.sec:not(.sec-sheet) > details')) d.open = true; ex.printW = 700; drawExplorer(); });
  window.addEventListener('afterprint', () => { ex.printW = 0; drawExplorer(); });
  $('s-theme').addEventListener('click', () => {
    const root = document.documentElement, attr = root.getAttribute('data-theme');
    const dark = attr === 'dark' || (!attr && !matchMedia('(prefers-color-scheme: light)').matches);
    const next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('vg-theme', next); } catch (_) {}
  });

  buildForm();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(CASE_KEY) || 'null'); } catch (_) {}
  apply(saved && typeof saved === 'object' && Array.isArray(saved.sections) ? { ...engine.EXAMPLE, ...saved } : engine.EXAMPLE);
  setView(ss.get(VIEW_KEY, 'resultado'), false);
  recalculate();
})();
