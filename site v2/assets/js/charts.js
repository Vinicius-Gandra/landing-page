/*!
 * VG · Gráficos de engenharia (SVG, sem dependências)
 * - responsivos (redesenham na largura real, texto sempre nítido)
 * - cores por papel a partir de variáveis CSS (tema claro/escuro)
 * - camada de interação: crosshair + tooltip em linhas, tooltip por marca em barras/pontos,
 *   navegação por teclado (← →) e tabela-gêmea para cada gráfico
 */
(function (raiz) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const E = () => raiz.VGEngine;

  // ── utilitários ──────────────────────────────────────────────────────────
  function el(tag, attrs, pai) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(n);
    return n;
  }
  function h(tag, cls, txt, pai) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    if (pai) pai.appendChild(n);
    return n;
  }
  function tema() {
    const cs = getComputedStyle(document.documentElement);
    const g = k => cs.getPropertyValue(k).trim();
    return {
      surface: g('--c-surface'), grid: g('--c-grid'), axis: g('--c-axis'), ink: g('--c-ink'), ink2: g('--c-ink-2'), ink3: g('--c-ink-3'),
      s1: g('--c-s1'), s1w: g('--c-s1-wash'), em: g('--c-em'), emw: g('--c-em-wash'), s3: g('--c-s3'), deemph: g('--c-deemph'), deemph2: g('--c-deemph-2'),
      ref: g('--c-ref'), failw: g('--c-fail-wash'), warnw: g('--c-warn-wash'), okw: g('--c-ok-wash'), fail: g('--fail'), warn: g('--warn'), ok: g('--ok'),
      seqLo: g('--seq-lo'), seqHi: g('--seq-hi'), font: g('--font-sans') || 'Inter, system-ui, sans-serif'
    };
  }
  const cor = (T, c) => (c && T[c]) ? T[c] : (c || T.s1);

  let ctxMedida = null;
  function largTexto(txt, px = 11.5, peso = 500) {
    if (!ctxMedida) ctxMedida = document.createElement('canvas').getContext('2d');
    ctxMedida.font = `${peso} ${px}px Inter, system-ui, sans-serif`;
    return ctxMedida.measureText(String(txt)).width;
  }

  // ── escalas e marcas de eixo ────────────────────────────────────────────
  function passoBonito(bruto) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1e-12))));
    const f = bruto / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function dominioBonito(min, max, n = 5, zero = false) {
    if (zero) min = Math.min(0, min);
    if (max - min < 1e-12) { max = min + (Math.abs(min) || 1); }
    const passo = passoBonito((max - min) / n);
    return [Math.floor(min / passo + 1e-9) * passo, Math.ceil(max / passo - 1e-9) * passo, passo];
  }
  function marcasLineares(d0, d1, n = 5) {
    const passo = passoBonito((d1 - d0) / n);
    const out = [];
    for (let v = Math.ceil(d0 / passo - 1e-9) * passo; v <= d1 + passo * 1e-6; v += passo) out.push(Math.abs(v) < passo * 1e-9 ? 0 : v);
    out.passo = passo;
    return out;
  }
  function marcasLog(d0, d1, largura) {
    const out = [], menores = [];
    const k0 = Math.floor(Math.log10(d0)), k1 = Math.ceil(Math.log10(d1));
    const dec = k1 - k0;
    const subs = largura / Math.max(dec, 1) > 150 ? [1, 2, 5] : largura / Math.max(dec, 1) > 70 ? [1, 3] : [1];
    for (let k = k0; k <= k1; k++) {
      for (let m = 1; m < 10; m++) {
        const v = m * 10 ** k;
        if (v < d0 * (1 - 1e-9) || v > d1 * (1 + 1e-9)) continue;
        if (subs.includes(m)) out.push(v); else menores.push(v);
      }
    }
    out.menores = menores;
    return out;
  }
  function linear(d0, d1, r0, r1) {
    const f = v => r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0);
    f.inv = px => d0 + (px - r0) / (r1 - r0 || 1) * (d1 - d0);
    f.d = [d0, d1]; f.r = [r0, r1]; f.tipo = 'linear';
    return f;
  }
  function logaritmica(d0, d1, r0, r1) {
    const l0 = Math.log10(d0), l1 = Math.log10(d1);
    const f = v => r0 + (Math.log10(Math.max(v, 1e-300)) - l0) / (l1 - l0 || 1) * (r1 - r0);
    f.inv = px => 10 ** (l0 + (px - r0) / (r1 - r0 || 1) * (l1 - l0));
    f.d = [d0, d1]; f.r = [r0, r1]; f.tipo = 'log';
    return f;
  }
  /** Número curto no padrão brasileiro conforme o passo das marcas. */
  function fmtMarca(v, passo) {
    const F = E();
    if (passo === undefined) return F.fmt_auto(v);
    const casas = passo >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(passo) - 1e-9));
    return F.fmt(v, casas);
  }

  // ── interpolação de cores (OKLab) ───────────────────────────────────────
  function hexRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const gam = c => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
  function rgbOklab([r, g, b]) {
    r = lin(r); g = lin(g); b = lin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklabRgb([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
  }
  function rampa(lo, hi) {
    const A = rgbOklab(hexRgb(lo)), B = rgbOklab(hexRgb(hi));
    return t => { t = Math.max(0, Math.min(1, t)); const [r, g, b] = oklabRgb([0, 1, 2].map(k => A[k] + (B[k] - A[k]) * t)); return `rgb(${r},${g},${b})`; };
  }
  function luminancia(rgbStr) {
    const m = rgbStr.match(/\d+/g).map(Number);
    const [r, g, b] = m.map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // ── montagem: card do gráfico, resize, tema, tooltip, tabela ─────────────
  const registrados = new Set();
  let agendado = null;
  function redesenharTodos() { for (const g of registrados) if (g.alvo.isConnected) g.desenhar(); else registrados.delete(g); }
  raiz.addEventListener && raiz.addEventListener('vg-tema', () => { cancelAnimationFrame(agendado); agendado = requestAnimationFrame(redesenharTodos); });

  /**
   * Monta um gráfico num contêiner (div). desenho(ctx) recebe {svg, w, h, T, dica, area}.
   * Retorna {atualizar(novoDesenho), desenhar()}.
   */
  function montar(alvo, desenho, opcoes = {}) {
    let g = alvo.__vgGrafico;
    if (!g) {
      alvo.classList.add('vg-chart');
      const plot = h('div', 'vg-plot', null, alvo);
      const dica = h('div', 'vg-tip', null, alvo);
      dica.setAttribute('role', 'status');
      dica.setAttribute('aria-live', 'polite');
      g = { alvo, plot, dica, desenho, opcoes, w: 0 };
      g.desenhar = () => {
        const w = Math.max(240, Math.floor(plot.clientWidth || alvo.clientWidth || 600));
        g.w = w;
        plot.textContent = '';
        esconderDica(g);
        const T = tema();
        const hFn = g.opcoes.altura;
        const altura = typeof hFn === 'function' ? hFn(w) : (hFn || Math.round(Math.min(420, Math.max(260, w * 0.5))));
        const svg = el('svg', { width: w, height: altura, viewBox: `0 0 ${w} ${altura}`, class: 'vg-svg', role: 'img',
          'aria-label': g.opcoes.rotulo || '' }, plot);
        if (g.opcoes.titulo) { const t = el('title', null, svg); t.textContent = g.opcoes.rotulo || ''; }
        try { g.desenho({ svg, w, h: altura, T, g, dica: (linhas, x, y) => mostrarDica(g, linhas, x, y), esconder: () => esconderDica(g) }); }
        catch (ex) { console.error(ex); h('p', 'vg-chart-erro', 'Não foi possível desenhar este gráfico.', plot); }
      };
      if ('ResizeObserver' in raiz) {
        let ultimo = 0, job = null;
        const ro = new ResizeObserver(ent => {
          const w = Math.floor(ent[0].contentRect.width);
          if (Math.abs(w - ultimo) < 2) return;
          ultimo = w;
          clearTimeout(job);
          job = setTimeout(() => g.desenhar(), 60);
        });
        ro.observe(plot);
        g.ro = ro;
      }
      registrados.add(g);
      alvo.__vgGrafico = g;
    } else {
      g.desenho = desenho;
      g.opcoes = opcoes;
    }
    g.desenhar();
    return g;
  }

  /** Desliga observadores dos gráficos dentro de um contêiner antes de recriá-lo. */
  function liberar(raizEl) {
    if (!raizEl) return;
    raizEl.querySelectorAll('.vg-chart').forEach(n => {
      const g = n.__vgGrafico;
      if (g) { if (g.ro) g.ro.disconnect(); registrados.delete(g); n.__vgGrafico = null; }
    });
  }

  function mostrarDica(g, linhas, x, y) {
    const d = g.dica;
    d.textContent = '';
    for (const ln of linhas) {
      if (ln.titulo) { h('div', 'vg-tip-t', ln.titulo, d); continue; }
      const row = h('div', 'vg-tip-r', null, d);
      if (ln.cor) {
        const k = h('i', 'vg-key ' + (ln.forma || 'linha'), null, row);
        k.style.setProperty('--k', ln.cor);
      }
      h('b', null, ln.valor, row);
      if (ln.rotulo) h('span', null, ln.rotulo, row);
    }
    d.classList.add('on');
    const W = g.alvo.clientWidth, dw = d.offsetWidth, dh = d.offsetHeight;
    const off = g.plot.offsetTop;
    let left = x + 14, top = y + off - dh - 10;
    if (left + dw > W - 4) left = x - dw - 14;
    if (left < 4) left = 4;
    if (top < 4) top = y + off + 16;
    d.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  function esconderDica(g) { g.dica.classList.remove('on'); }

  /** Tabela-gêmea (acessibilidade): {colunas:[...], linhas:[[...]], destacar: i => bool} */
  function tabela(alvo, dados) {
    alvo.textContent = '';
    const wrap = h('div', 'tbl-wrap', null, alvo);
    const t = h('table', 'tbl', null, wrap);
    const th = h('thead', null, null, t), tr = h('tr', null, null, th);
    dados.colunas.forEach(c => h('th', null, c, tr));
    const tb = h('tbody', null, null, t);
    dados.linhas.forEach((l, i) => {
      const r = h('tr', dados.destacar && dados.destacar(i) ? 'sel' : null, null, tb);
      l.forEach(v => h('td', null, v, r));
    });
    return t;
  }

  // ── componentes de desenho ──────────────────────────────────────────────
  function texto(pai, x, y, txt, attrs = {}) {
    const t = el('text', Object.assign({ x, y }, attrs), pai);
    t.textContent = txt;
    return t;
  }
  function caminho(pts) {
    let s = '', pen = false;
    for (const p of pts) {
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) { pen = false; continue; }
      s += (pen ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2);
      pen = true;
    }
    return s;
  }
  function caminhoDegrau(pts) {
    let s = '';
    pts.forEach((p, i) => {
      if (!i) { s += `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`; return; }
      s += `H${p[0].toFixed(2)}V${p[1].toFixed(2)}`;
    });
    return s;
  }
  /** Barra vertical: topo arredondado (4 px), base reta. */
  function barraV(pai, x, y, w, hgt, raio, attrs) {
    if (hgt <= 0) return null;
    const r = Math.min(raio, w / 2, hgt);
    const d = `M${x} ${y + hgt}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + hgt}Z`;
    return el('path', Object.assign({ d }, attrs), pai);
  }
  /** Barra horizontal: ponta direita arredondada. */
  function barraH(pai, x, y, w, hgt, raio, attrs) {
    if (w <= 0) return null;
    const r = Math.min(raio, hgt / 2, w);
    const d = `M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + hgt - r}Q${x + w} ${y + hgt} ${x + w - r} ${y + hgt}H${x}Z`;
    return el('path', Object.assign({ d }, attrs), pai);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Gráfico XY genérico
  // ════════════════════════════════════════════════════════════════════════
  /**
   * spec:
   *  x: {tipo:'linear'|'log', dominio:[a,b], rotulo, fmt(v), marcas:n|[...], bonito:true}
   *  y: {tipo:'linear'|'log', dominio:[a,b], rotulo, fmt(v), zero:true, marcas:n}
   *  series: [{id, nome, tipo:'linha'|'area'|'degrau'|'pontos', dados:[{x,y}], cor:'s1'|'em'|'deemph'|..., largura, tracejado,
   *            marcadores:bool, rotuloFim:string, dica:bool, fmtY, opacidade}]
   *  faixas: [{y0,y1}|{x0,x1}, cor, rotulo]       (sombreamentos: zona de falha etc.)
   *  refs:   [{y}|{x}, rotulo, cor, tracejado, lado:'fim'|'inicio'] (linhas de referência/limite)
   *  pontos: [{x, y, cor, r, rotulo, dx, dy, ancora, dica:[...]}]   (ponto de operação etc.)
   *  crosshair: {series:[ids], fmtX(v)}
   */
  function xy(alvo, spec, opcoes = {}) {
    return montar(alvo, ctx => desenharXY(ctx, spec), Object.assign({ rotulo: spec.rotulo }, opcoes));
  }

  function desenharXY({ svg, w, h: H, T, dica, esconder, g }, spec) {
    const sx = spec.x, sy = spec.y;
    const todos = spec.series.flatMap(s => s.dados || []);
    // domínios
    let [x0, x1] = sx.dominio || [Math.min(...todos.map(d => d.x)), Math.max(...todos.map(d => d.x))];
    let [y0, y1] = sy.dominio || [Math.min(...todos.map(d => d.y).concat(sy.extra || [])), Math.max(...todos.map(d => d.y).concat(sy.extra || []))];
    const nY = H < 280 ? 4 : 5;
    let passoY;
    if (sy.tipo !== 'log' && sy.bonito !== false) { [y0, y1, passoY] = dominioBonito(y0, y1, nY, sy.zero !== false); }
    if (sx.tipo !== 'log' && sx.bonito) { [x0, x1] = dominioBonito(x0, x1, Math.max(3, Math.round(w / 110)), sx.zero); }
    // margens
    const yMarcas = sy.tipo === 'log' ? marcasLog(y0, y1, H) : (Array.isArray(sy.marcas) ? sy.marcas : marcasLineares(y0, y1, nY));
    const fmtY = sy.fmt || (v => fmtMarca(v, yMarcas.passo || passoY));
    const larguraY = Math.max(...yMarcas.map(v => largTexto(fmtY(v))), 16);
    const M = Object.assign({ t: spec.titulo ? 30 : 16, r: spec.margemDir || 18, b: sx.rotulo ? 50 : 32, l: Math.ceil(larguraY) + (sy.rotulo ? 34 : 14) }, spec.margem || {});
    const iw = w - M.l - M.r, ih = H - M.t - M.b;
    const X = sx.tipo === 'log' ? logaritmica(x0, x1, M.l, M.l + iw) : linear(x0, x1, M.l, M.l + iw);
    const Y = sy.tipo === 'log' ? logaritmica(y0, y1, M.t + ih, M.t) : linear(y0, y1, M.t + ih, M.t);
    const clipId = 'clip' + Math.random().toString(36).slice(2, 8);
    const defs = el('defs', null, svg);
    el('rect', { x: M.l, y: M.t - 2, width: iw, height: ih + 4 }, el('clipPath', { id: clipId }, defs));
    // grade + eixos
    const gGrade = el('g', { class: 'vg-grid' }, svg);
    for (const v of yMarcas) {
      const yy = Math.round(Y(v)) + 0.5;
      el('line', { x1: M.l, x2: M.l + iw, y1: yy, y2: yy, stroke: T.grid, 'stroke-width': 1 }, gGrade);
      texto(svg, M.l - 8, yy + 4, fmtY(v), { 'text-anchor': 'end', class: 'vg-tick', fill: T.ink3 });
    }
    let xMarcas;
    if (sx.categorias) xMarcas = [];
    else if (sx.tipo === 'log') xMarcas = marcasLog(x0, x1, iw);
    else xMarcas = Array.isArray(sx.marcas) ? sx.marcas : marcasLineares(x0, x1, Math.max(3, Math.min(sx.marcas || 8, Math.round(iw / 80))));
    const fmtX = sx.fmt || (v => fmtMarca(v, xMarcas.passo));
    if (sx.tipo === 'log' && xMarcas.menores) for (const v of xMarcas.menores) {
      const xx = Math.round(X(v)) + 0.5;
      el('line', { x1: xx, x2: xx, y1: M.t, y2: M.t + ih, stroke: T.grid, 'stroke-width': 1, opacity: 0.55 }, gGrade);
    }
    for (const v of xMarcas) {
      const xx = Math.round(X(v)) + 0.5;
      if (spec.gradeX !== false) el('line', { x1: xx, x2: xx, y1: M.t, y2: M.t + ih, stroke: T.grid, 'stroke-width': 1 }, gGrade);
      texto(svg, xx, M.t + ih + 18, fmtX(v), { 'text-anchor': 'middle', class: 'vg-tick', fill: T.ink3 });
    }
    el('line', { x1: M.l, x2: M.l + iw, y1: Math.round(M.t + ih) + 0.5, y2: Math.round(M.t + ih) + 0.5, stroke: T.axis, 'stroke-width': 1 }, svg);
    if (sx.rotulo) texto(svg, M.l + iw / 2, H - 10, sx.rotulo, { 'text-anchor': 'middle', class: 'vg-axis-title', fill: T.ink2 });
    if (sy.rotulo) texto(svg, 14, M.t + ih / 2, sy.rotulo, { 'text-anchor': 'middle', class: 'vg-axis-title', fill: T.ink2, transform: `rotate(-90 14 ${M.t + ih / 2})` });
    if (spec.titulo) texto(svg, M.l, 16, spec.titulo, { class: 'vg-chart-title', fill: T.ink2 });

    const plot = el('g', { 'clip-path': `url(#${clipId})` }, svg);
    // faixas
    for (const f of spec.faixas || []) {
      const c = cor(T, f.cor || 'failw');
      if (f.y0 !== undefined) {
        const ya = Y(Math.max(f.y0, y0)), yb = Y(Math.min(f.y1, y1));
        el('rect', { x: M.l, y: Math.min(ya, yb), width: iw, height: Math.abs(ya - yb), fill: c }, plot);
        if (f.rotulo) texto(svg, M.l + 8, Math.max(ya, yb) - 6, f.rotulo, { class: 'vg-band-label', fill: T.ink2 });
      } else if (f.pontos) {
        el('path', { d: caminho(f.pontos.map(p => [X(p.x), Y(p.y)])) + 'Z', fill: c }, plot);
        if (f.rotulo && f.rotuloEm) texto(svg, X(f.rotuloEm.x), Y(f.rotuloEm.y), f.rotulo, { class: 'vg-band-label', fill: T.ink2, 'text-anchor': f.rotuloEm.ancora || 'start' });
      } else {
        const xa = X(Math.max(f.x0, x0)), xb = X(Math.min(f.x1, x1));
        el('rect', { x: Math.min(xa, xb), y: M.t, width: Math.abs(xb - xa), height: ih, fill: c }, plot);
        if (f.rotulo) texto(svg, Math.min(xa, xb) + 6, M.t + 14, f.rotulo, { class: 'vg-band-label', fill: T.ink2 });
      }
    }
    // séries
    const hover = [];
    const rotulosFim = [];
    for (const s of spec.series) {
      const c = cor(T, s.cor);
      const dados = (s.dados || []).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y) && (sx.tipo !== 'log' || d.x > 0) && (sy.tipo !== 'log' || d.y > 0));
      const pts = dados.map(d => [X(d.x), Y(d.y)]);
      if (s.tipo === 'area') {
        const base = Y(Math.max(y0, sy.tipo === 'log' ? y0 : 0));
        if (pts.length) el('path', { d: caminho(pts) + `L${pts[pts.length - 1][0]} ${base}L${pts[0][0]} ${base}Z`, fill: s.preenchimento ? cor(T, s.preenchimento) : (s.cor === 'em' ? T.emw : T.s1w) }, plot);
        el('path', { d: caminho(pts), fill: 'none', stroke: c, 'stroke-width': s.largura || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, plot);
      } else if (s.tipo === 'degrau') {
        el('path', { d: caminhoDegrau(pts), fill: 'none', stroke: c, 'stroke-width': s.largura || 1.5, 'stroke-dasharray': s.tracejado ? '5 4' : null, 'stroke-linejoin': 'round' }, plot);
      } else if (s.tipo === 'linha') {
        el('path', { d: caminho(pts), fill: 'none', stroke: c, 'stroke-width': s.largura || 2, 'stroke-dasharray': s.tracejado ? '5 4' : null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.opacidade || 1 }, plot);
      }
      if (s.marcadores || s.tipo === 'pontos') {
        for (const p of pts) el('circle', { cx: p[0], cy: p[1], r: s.raio || 4, fill: c, stroke: T.surface, 'stroke-width': 2 }, plot);
      }
      if (s.rotuloFim && pts.length) {
        const u = pts[pts.length - 1];
        rotulosFim.push({ x: u[0], y: u[1], txt: s.rotuloFim, cor: s.cor === 'deemph' ? T.ink3 : (s.cor === 'em' ? T.ink : T.ink2), forte: s.cor === 'em' });
      }
      if (s.dica !== false && dados.length) hover.push({ s, dados, pts, c });
    }
    // rótulos de fim de série: agrupados por proximidade horizontal, sem sobreposição vertical (13 px)
    if (rotulosFim.length) {
      rotulosFim.sort((a, b) => a.x - b.x);
      const grupos = [];
      for (const r of rotulosFim) { const gr = grupos.find(q => Math.abs(q[0].x - r.x) < 48); if (gr) gr.push(r); else grupos.push([r]); }
      for (const gr of grupos) {
        gr.sort((a, b) => a.y - b.y);
        for (let k = 1; k < gr.length; k++) if (gr[k].y - gr[k - 1].y < 13) gr[k].y = gr[k - 1].y + 13;
        const excesso = gr[gr.length - 1].y - (M.t + ih + 4);
        if (excesso > 0) gr.forEach(r => { r.y -= excesso; });
      }
      for (const r of rotulosFim) {
        const fora = r.x + 6 + largTexto(r.txt) > w - 2;
        texto(svg, fora ? w - 4 : r.x + 6, r.y + 4, r.txt, { class: 'vg-end-label vg-halo', fill: r.cor, 'text-anchor': fora ? 'end' : 'start', 'font-weight': r.forte ? 750 : null });
      }
    }
    // referências
    for (const r of spec.refs || []) {
      const c = cor(T, r.cor || 'ref');
      if (r.y !== undefined) {
        if (r.y < y0 || r.y > y1) continue;
        const yy = Y(r.y);
        el('line', { x1: M.l, x2: M.l + iw, y1: yy, y2: yy, stroke: c, 'stroke-width': r.largura || 1.25, 'stroke-dasharray': r.tracejado === false ? null : '5 4' }, svg);
        if (r.rotulo) {
          const tw = largTexto(r.rotulo, 11.5, 600);
          const lx = r.lado === 'inicio' ? M.l + 6 : M.l + iw - tw - 6;
          const fundo = el('rect', { x: lx - 4, y: yy - 17, width: tw + 8, height: 15, rx: 3, fill: T.surface, opacity: 0.92 }, svg);
          fundo.setAttribute('class', 'vg-ref-bg');
          texto(svg, lx, yy - 6, r.rotulo, { class: 'vg-ref-label', fill: T.ink2 });
        }
      } else if (r.x !== undefined) {
        if (r.x < x0 || r.x > x1) continue;
        const xx = X(r.x);
        el('line', { x1: xx, x2: xx, y1: M.t, y2: M.t + ih, stroke: c, 'stroke-width': r.largura || 1.25, 'stroke-dasharray': r.tracejado === false ? null : '5 4' }, svg);
        if (r.rotulo) texto(svg, xx + 5, M.t + 12, r.rotulo, { class: 'vg-ref-label', fill: T.ink2, 'text-anchor': xx + 5 + largTexto(r.rotulo) > M.l + iw ? 'end' : 'start', dx: xx + 5 + largTexto(r.rotulo) > M.l + iw ? -10 : 0 });
      }
    }
    // pontos destacados
    const alvosPontos = [];
    for (const p of spec.pontos || []) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const px = X(p.x), py = Y(p.y), c = cor(T, p.cor || 'em');
      if (p.guia) {
        el('line', { x1: px, x2: px, y1: py, y2: M.t + ih, stroke: c, 'stroke-width': 1, opacity: 0.6 }, svg);
        if (p.guia === 'xy') el('line', { x1: M.l, x2: px, y1: py, y2: py, stroke: c, 'stroke-width': 1, opacity: 0.6 }, svg);
      }
      el('circle', { cx: px, cy: py, r: p.r || 6, fill: c, stroke: T.surface, 'stroke-width': 2.5 }, svg);
      if (p.rotulo) {
        const anc = p.ancora || (px > M.l + iw * 0.7 ? 'end' : 'start');
        const dx = p.dx !== undefined ? p.dx : (anc === 'end' ? -12 : 12);
        const linhasR = String(p.rotulo).split('\n');
        linhasR.forEach((ln, k) => texto(svg, px + dx, py + (p.dy !== undefined ? p.dy : -10) + k * 14, ln, { class: k ? 'vg-point-sub' : 'vg-point-label', fill: k ? T.ink2 : T.ink, 'text-anchor': anc }));
      }
      if (p.dica) alvosPontos.push({ px, py, linhas: p.dica });
    }
    // camada de interação
    const camada = el('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent', class: 'vg-hit' }, svg);
    const guia = el('line', { y1: M.t, y2: M.t + ih, stroke: T.ink3, 'stroke-width': 1, opacity: 0, 'pointer-events': 'none' }, svg);
    const marcas = el('g', { 'pointer-events': 'none' }, svg);
    const ch = spec.crosshair;
    const base = ch ? hover.filter(o => (ch.series || []).includes(o.s.id)) : [];
    const xsBase = base.length ? base[0].dados.map(d => d.x) : [];
    let idxAtual = -1;
    function indicePorPixel(px) {
      let melhor = 0, dist = Infinity;
      base[0].pts.forEach((p, k) => { const dd = Math.abs(p[0] - px); if (dd < dist) { dist = dd; melhor = k; } });
      return melhor;
    }
    function valorEm(o, xv) {
      // ponto exato se existir; senão interpola linearmente em x
      const ds = o.dados;
      let k = ds.findIndex(d => Math.abs(d.x - xv) <= Math.abs(xv) * 1e-9 + 1e-12);
      if (k >= 0) return ds[k].y;
      for (k = 0; k < ds.length - 1; k++) if ((ds[k].x - xv) * (ds[k + 1].x - xv) <= 0) {
        if (o.s.tipo === 'degrau') return ds[k].y;
        const t = (xv - ds[k].x) / (ds[k + 1].x - ds[k].x || 1);
        return ds[k].y + t * (ds[k + 1].y - ds[k].y);
      }
      return null;
    }
    function mostrar(k) {
      if (!base.length) return;
      idxAtual = Math.max(0, Math.min(xsBase.length - 1, k));
      const xv = xsBase[idxAtual], px = X(xv);
      guia.setAttribute('x1', px); guia.setAttribute('x2', px); guia.setAttribute('opacity', 0.7);
      marcas.textContent = '';
      const linhas = [{ titulo: (ch.fmtX || fmtX)(xv) }];
      for (const o of hover) {
        if (o.s.dica === false) continue;
        const yv = valorEm(o, xv);
        if (yv === null || !Number.isFinite(yv)) continue;
        if (o.s.tipo !== 'degrau') el('circle', { cx: px, cy: Y(yv), r: 4.5, fill: o.c, stroke: T.surface, 'stroke-width': 2 }, marcas);
        linhas.push({ cor: o.c, forma: o.s.tracejado || o.s.tipo === 'degrau' ? 'tracejada' : 'linha', valor: (o.s.fmtY || (v => E().fmt(v, 2)))(yv), rotulo: o.s.nome });
      }
      if (ch.extra) for (const ln of ch.extra(xv, idxAtual)) linhas.push(ln);
      dica(linhas, px, M.t + 10);
    }
    function limpar() { guia.setAttribute('opacity', 0); marcas.textContent = ''; esconder(); idxAtual = -1; }
    if (base.length) {
      camada.addEventListener('pointermove', ev => {
        const b = svg.getBoundingClientRect();
        mostrar(indicePorPixel(ev.clientX - b.left));
      });
      camada.addEventListener('pointerleave', limpar);
      g.plot.tabIndex = 0;
      g.plot.onkeydown = ev => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          const ini = idxAtual < 0 ? (ch.inicio !== undefined ? ch.inicio : 0) : idxAtual + (ev.key === 'ArrowRight' ? 1 : -1);
          mostrar(ini);
        } else if (ev.key === 'Escape') limpar();
      };
      g.plot.onfocus = () => { if (idxAtual < 0) mostrar(ch.inicio !== undefined ? ch.inicio : 0); };
      g.plot.onblur = limpar;
    }
    // alvos de pontos (≥ 24 px)
    for (const a of alvosPontos) {
      const hit = el('circle', { cx: a.px, cy: a.py, r: 13, fill: 'transparent', class: 'vg-hit-pt' }, svg);
      hit.addEventListener('pointerenter', () => dica(a.linhas, a.px, a.py));
      hit.addEventListener('pointerleave', esconder);
    }
    return { X, Y, M, iw, ih };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Barras verticais por categoria (uma série; destaque por estado)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * spec: { categorias:[{rotulo, valor, estado:'sel'|'ok'|'deemph', dica:[...], rotuloValor:bool}],
   *         y:{rotulo, fmt, dominio}, x:{rotulo}, refs:[{y, rotulo}], rotulo }
   */
  function barras(alvo, spec, opcoes = {}) {
    return montar(alvo, ({ svg, w, h: H, T, dica, esconder }) => {
      const cats = spec.categorias;
      const vals = cats.map(c => c.valor).concat((spec.refs || []).map(r => r.y));
      let [y0, y1, passo] = dominioBonito(0, Math.max(...vals) * 1.08, H < 280 ? 4 : 5, true);
      if (spec.y.dominio) [y0, y1] = spec.y.dominio;
      const marcas = marcasLineares(y0, y1, H < 280 ? 4 : 5);
      const fmtY = spec.y.fmt || (v => fmtMarca(v, marcas.passo || passo));
      const lw = Math.max(...marcas.map(v => largTexto(fmtY(v))));
      const refFora = (spec.refs || []).filter(r => r.rotulo && r.fora);
      const M = { t: 18, r: refFora.length ? Math.ceil(Math.max(...refFora.map(r => largTexto(r.rotulo, 11.5, 650)))) + 14 : 14, b: spec.x && spec.x.rotulo ? 50 : 32, l: Math.ceil(lw) + (spec.y.rotulo ? 34 : 14) };
      const iw = w - M.l - M.r, ih = H - M.t - M.b;
      const Y = linear(y0, y1, M.t + ih, M.t);
      for (const v of marcas) {
        const yy = Math.round(Y(v)) + 0.5;
        el('line', { x1: M.l, x2: M.l + iw, y1: yy, y2: yy, stroke: T.grid }, svg);
        texto(svg, M.l - 8, yy + 4, fmtY(v), { 'text-anchor': 'end', class: 'vg-tick', fill: T.ink3 });
      }
      el('line', { x1: M.l, x2: M.l + iw, y1: Math.round(M.t + ih) + 0.5, y2: Math.round(M.t + ih) + 0.5, stroke: T.axis }, svg);
      if (spec.x && spec.x.rotulo) texto(svg, M.l + iw / 2, H - 10, spec.x.rotulo, { 'text-anchor': 'middle', class: 'vg-axis-title', fill: T.ink2 });
      if (spec.y.rotulo) texto(svg, 14, M.t + ih / 2, spec.y.rotulo, { 'text-anchor': 'middle', class: 'vg-axis-title', fill: T.ink2, transform: `rotate(-90 14 ${M.t + ih / 2})` });
      const banda = iw / cats.length;
      const bw = Math.min(24 + (banda > 70 ? 8 : 0), banda * 0.62);
      cats.forEach((c, k) => {
        const cx = M.l + banda * (k + 0.5);
        const yv = Y(Math.max(c.valor, y0));
        const fill = c.estado === 'sel' ? T.em : c.estado === 'deemph' ? T.deemph : T.s1;
        const bar = barraV(svg, cx - bw / 2, yv, bw, M.t + ih - yv, 4, { fill, class: 'vg-bar' });
        texto(svg, cx, M.t + ih + 18, c.rotulo, { 'text-anchor': 'middle', class: 'vg-tick' + (c.estado === 'sel' ? ' vg-tick-strong' : ''), fill: c.estado === 'sel' ? T.ink : T.ink3 });
        if (c.rotuloValor) texto(svg, cx, yv - 7, c.textoValor || fmtY(c.valor), { 'text-anchor': 'middle', class: 'vg-value-label' + (c.estado === 'sel' ? ' strong' : ''), fill: c.estado === 'sel' ? T.ink : T.ink2 });
        const hit = el('rect', { x: cx - banda / 2, y: M.t, width: banda, height: ih, fill: 'transparent', class: 'vg-hit-bar' }, svg);
        hit.addEventListener('pointerenter', () => { if (bar) bar.classList.add('hl'); dica(c.dica || [{ titulo: c.rotulo }, { valor: fmtY(c.valor) }], cx, yv); });
        hit.addEventListener('pointerleave', () => { if (bar) bar.classList.remove('hl'); esconder(); });
      });
      for (const r of spec.refs || []) {
        const yy = Y(r.y);
        el('line', { x1: M.l, x2: M.l + iw, y1: yy, y2: yy, stroke: cor(T, r.cor || 'ref'), 'stroke-width': 1.25, 'stroke-dasharray': '5 4', 'pointer-events': 'none' }, svg);
        if (r.rotulo && r.fora) {
          texto(svg, M.l + iw + 6, yy + 4, r.rotulo, { class: 'vg-ref-label', fill: T.ink2, 'pointer-events': 'none' });
        } else if (r.rotulo) {
          const tw = largTexto(r.rotulo, 11.5, 600);
          el('rect', { x: M.l + 4, y: yy - 18, width: tw + 8, height: 15, rx: 3, fill: T.surface, opacity: 0.92, 'pointer-events': 'none' }, svg);
          texto(svg, M.l + 8, yy - 7, r.rotulo, { class: 'vg-ref-label', fill: T.ink2, 'pointer-events': 'none' });
        }
      }
    }, Object.assign({ rotulo: spec.rotulo }, opcoes));
  }

  // ════════════════════════════════════════════════════════════════════════
  // Barras horizontais com valor na ponta (listas: óleos, materiais, critérios)
  // ════════════════════════════════════════════════════════════════════════
  function barrasH(alvo, spec, opcoes = {}) {
    const n = spec.itens.length;
    const altura = w => 18 + n * (spec.alturaLinha || 38) + (spec.refs && spec.refs.length ? 16 : 6) + 22;
    return montar(alvo, ({ svg, w, h: H, T, dica, esconder }) => {
      const it = spec.itens;
      const max = Math.max(...it.map(d => d.valor).concat((spec.refs || []).map(r => r.x))) * 1.04;
      const fmtV = spec.fmt || (v => E().fmt(v, 1));
      const lw = Math.min(Math.max(...it.map(d => largTexto(d.rotulo, 12.5, 600))) + 14, w * 0.36);
      const vw = Math.max(...it.map(d => largTexto(d.textoValor || fmtV(d.valor), 12.5, 650))) + 16;
      const M = { t: 10, r: vw, l: lw, b: 30 };
      const iw = w - M.l - M.r;
      const X = linear(0, max, M.l, M.l + iw);
      const lh = spec.alturaLinha || 38, bh = Math.min(16, lh * 0.45);
      const marcas = marcasLineares(0, max, Math.max(2, Math.round(iw / 110)));
      for (const v of marcas) {
        const xx = Math.round(X(v)) + 0.5;
        el('line', { x1: xx, x2: xx, y1: M.t, y2: M.t + n * lh, stroke: T.grid }, svg);
        texto(svg, xx, M.t + n * lh + 16, fmtMarca(v, marcas.passo), { 'text-anchor': 'middle', class: 'vg-tick', fill: T.ink3 });
      }
      it.forEach((d, k) => {
        const yc = M.t + lh * (k + 0.5);
        const fill = d.estado === 'sel' ? T.em : d.estado === 'deemph' ? T.deemph : T.s1;
        texto(svg, M.l - 12, yc + 4, d.rotulo, { 'text-anchor': 'end', class: 'vg-row-label' + (d.estado === 'sel' ? ' strong' : ''), fill: d.estado === 'deemph' ? T.ink3 : T.ink });
        if (d.sub) texto(svg, M.l - 12, yc + 17, d.sub, { 'text-anchor': 'end', class: 'vg-row-sub', fill: T.ink3 });
        const bar = barraH(svg, M.l, yc - bh / 2, Math.max(1, X(d.valor) - M.l), bh, 4, { fill, class: 'vg-bar' });
        texto(svg, X(d.valor) + 8, yc + 4.5, d.textoValor || fmtV(d.valor), { class: 'vg-value-label' + (d.estado === 'sel' ? ' strong' : ''), fill: T.ink });
        const hit = el('rect', { x: 0, y: yc - lh / 2, width: w, height: lh, fill: 'transparent', class: 'vg-hit-bar' }, svg);
        hit.addEventListener('pointerenter', () => { if (bar) bar.classList.add('hl'); if (d.dica) dica(d.dica, X(d.valor), yc - 6); });
        hit.addEventListener('pointerleave', () => { if (bar) bar.classList.remove('hl'); esconder(); });
      });
      for (const r of spec.refs || []) {
        const xx = X(r.x);
        el('line', { x1: xx, x2: xx, y1: M.t - 4, y2: M.t + n * lh + 4, stroke: cor(T, r.cor || 'ref'), 'stroke-width': 1.25, 'stroke-dasharray': '5 4', 'pointer-events': 'none' }, svg);
        if (r.rotulo) texto(svg, xx, M.t + n * lh + 30, r.rotulo, { 'text-anchor': xx > w * 0.7 ? 'end' : 'middle', class: 'vg-ref-label', fill: T.ink2 });
      }
    }, Object.assign({ rotulo: spec.rotulo, altura }, opcoes));
  }

  raiz.VGCharts = { montar, liberar, xy, barras, barrasH, tabela, tema, el, h, texto, caminho, linear, logaritmica, marcasLineares, marcasLog,
    dominioBonito, fmtMarca, largTexto, rampa, luminancia, barraV, barraH, cor };
})(typeof window !== 'undefined' ? window : globalThis);
