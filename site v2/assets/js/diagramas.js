/*!
 * VG · Diagramas técnicos em SVG (responsivos, cores do tema)
 *  - montagem: ponta de eixo + mancal com cotas
 *  - secaoMancal: corte do mancal com filme ampliado e campo de pressão (Reynolds)
 *  - lugarGeometrico: posição do centro do eixo (ε, β) para várias relações B/D
 *  - ajusteISO: zonas de tolerância furo H7 × colo do eixo
 * Convenção de geometria: rotação anti-horária, carga vertical para baixo; o centro do eixo
 * fica no ângulo (β − 90°) a partir da horizontal (quadrante inferior direito).
 */
(function (raiz) {
  'use strict';
  const C = raiz.VGCharts, E = raiz.VGEngine;
  const { el, texto } = C;
  const rad = g => g * Math.PI / 180;
  let seq = 0;

  function defsSeta(svg, cor, tam = 7) {
    const id = 'sa' + (++seq);
    let defs = svg.querySelector('defs');
    if (!defs) defs = el('defs', null, svg);
    const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: tam, markerHeight: tam, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M0 0.8L10 5L0 9.2Z', fill: cor }, m);
    return `url(#${id})`;
  }
  function hachura(svg, cor, passo = 7) {
    const id = 'hc' + (++seq);
    let defs = svg.querySelector('defs');
    if (!defs) defs = el('defs', null, svg);
    const p = el('pattern', { id, width: passo, height: passo, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: passo, stroke: cor, 'stroke-width': 1 }, p);
    return `url(#${id})`;
  }
  /** Cota linear com setas nas duas pontas e texto centralizado. */
  function cota(svg, x1, y1, x2, y2, rotulo, T, opc = {}) {
    const g = el('g', { class: 'cota' }, svg);
    const seta = defsSeta(svg, T.ink2, 6);
    el('line', { x1, y1, x2, y2, stroke: T.ink2, 'stroke-width': 1, 'marker-start': seta, 'marker-end': seta }, g);
    const xm = (x1 + x2) / 2, ym = (y1 + y2) / 2;
    const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
    if (vertical) {
      const t = texto(g, xm + (opc.lado === 'esq' ? -8 : 8), ym + 4, rotulo, { class: 'dim vg-halo', fill: T.ink, 'text-anchor': opc.lado === 'esq' ? 'end' : 'start' });
      return t;
    }
    return texto(g, xm, ym + (opc.abaixo ? 16 : -7), rotulo, { class: 'dim vg-halo', fill: T.ink, 'text-anchor': 'middle' });
  }
  function linhaChamada(svg, x1, y1, x2, y2, T) {
    el('line', { x1, y1, x2, y2, stroke: T.ink3, 'stroke-width': 1, 'stroke-dasharray': '2 3' }, svg);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Montagem: ponta de eixo + mancal
  // ════════════════════════════════════════════════════════════════════════
  function montagem(alvo, R) {
    return C.montar(alvo, ({ svg, w, h: H, T }) => {
      svg.classList.add('diag');
      const d = R.d_adotado;
      const m = R.mancal;
      const D = m ? m.d : d * 1.05;
      const B = m ? m.l : 0.8 * D;
      const Le = R.comprimento ? R.comprimento[0] : 1.75 * d;
      const g1 = 0.32 * Math.max(d, D), g2 = 0.26 * D, Dr = 1.55 * Math.max(D, d), stub = 0.28 * D;
      const tb = 0.07 * D, Ro = D / 2 + tb + 0.32 * D, abaH = 0.16 * D;
      const xb0 = Le + g1, xb1 = xb0 + B, xr = xb1 + g2, xend = xr + stub;
      // escala (mm → px) com margens fixas em px para cotas e rótulos
      const mL = 64, mR = 30, mT = 86, mB = 58;
      const s = Math.min((w - mL - mR) / (xend + abaH), (H - mT - mB) / (2 * Math.max(Ro, Dr / 2)));
      const ox = mL + Math.max(0, (w - mL - mR - (xend + abaH) * s) / 2);
      const X = x => ox + x * s, Yc = mT + (H - mT - mB) / 2, Y = y => Yc - y * s;
      const hach = hachura(svg, T.deemph, 6);
      const corEixo = T.surface === '#ffffff' ? '#e9eeec' : '#1f3547';
      // linha de centro
      el('line', { x1: X(-0.12 * d), x2: X(xend + abaH * 0.6), y1: Yc, y2: Yc, stroke: T.ink3, 'stroke-width': 1, 'stroke-dasharray': '14 4 3 4' }, svg);
      // corpo do rotor (interrompido)
      const yR = Dr / 2;
      const brk = `M${X(xend)} ${Y(yR)} q${-6} ${(Y(0) - Y(yR)) * 0.5} 0 ${(Y(0) - Y(yR))} q${6} ${(Y(0) - Y(yR)) * 0.5} 0 ${(Y(0) - Y(yR))}`;
      el('path', { d: `M${X(xr)} ${Y(yR)}H${X(xend)}` + brk.replace(/^M[^q]+/, '') + `L${X(xr)} ${Y(-yR)}Z`, fill: corEixo, stroke: T.ink2, 'stroke-width': 1.25, 'stroke-linejoin': 'round' }, svg);
      el('path', { d: brk, fill: 'none', stroke: T.ink2, 'stroke-width': 1.25 }, svg);
      texto(svg, X((xr + xend) / 2), Y(-yR) + 16, 'rotor', { class: 'dim-s', fill: T.ink3, 'text-anchor': 'middle' });
      // eixo: ponta (d) + colo (D)
      el('path', { d: `M${X(0)} ${Y(d / 2)}H${X(Le)}V${Y(D / 2)}H${X(xr)}V${Y(-D / 2)}H${X(Le)}V${Y(-d / 2)}H${X(0)}Z`, fill: corEixo, stroke: T.ink2, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, svg);
      // chanfro e rasgo de chaveta (indicativos)
      const ch = Math.min(0.02 * d, 6 / s);
      el('path', { d: `M${X(0)} ${Y(d / 2 - ch)}L${X(ch)} ${Y(d / 2)}M${X(0)} ${Y(-d / 2 + ch)}L${X(ch)} ${Y(-d / 2)}`, stroke: T.ink2, 'stroke-width': 1 }, svg);
      const kw = 0.28 * d, kx0 = 0.12 * Le, kx1 = 0.88 * Le;
      el('rect', { x: X(kx0), y: Y(d / 2), width: (kx1 - kx0) * s, height: Math.max(3, 0.1 * d * s), rx: 2, fill: 'none', stroke: T.ink3, 'stroke-width': 1, 'stroke-dasharray': '3 2' }, svg);
      void kw;
      // caixa do mancal (corte hachurado) + bucha (metal patente)
      const hx0 = xb0 - abaH * 0.5, hx1 = xb1 + abaH * 0.5;
      for (const sg of [1, -1]) {
        const y0 = sg * (D / 2 + tb), y1 = sg * Ro;
        el('rect', { x: X(hx0), y: Math.min(Y(y0), Y(y1)), width: (hx1 - hx0) * s, height: Math.abs(Y(y1) - Y(y0)), fill: hach, stroke: T.ink2, 'stroke-width': 1.25 }, svg);
        el('rect', { x: X(xb0), y: Math.min(Y(sg * D / 2), Y(y0)), width: B * s, height: Math.abs(Y(y0) - Y(sg * D / 2)), fill: T.emw, stroke: T.em, 'stroke-width': 1.5 }, svg);
      }
      // cotas
      const xCd = X(0) - 26;
      linhaChamada(svg, X(0), Y(d / 2), xCd - 4, Y(d / 2), T); linhaChamada(svg, X(0), Y(-d / 2), xCd - 4, Y(-d / 2), T);
      cota(svg, xCd, Y(d / 2), xCd, Y(-d / 2), '', T);
      texto(svg, xCd - 6, Yc + 4, `⌀${E.fmt_auto(d)}`, { class: 'dim vg-halo', fill: T.ink, 'text-anchor': 'end' });
      const yL = Y(-Math.max(d, D) / 2) + 0;
      const yCotaL = Math.max(Y(-d / 2), Y(-Ro)) + 30;
      linhaChamada(svg, X(0), Y(-d / 2), X(0), yCotaL + 4, T); linhaChamada(svg, X(Le), Y(-D / 2), X(Le), yCotaL + 4, T);
      cota(svg, X(0), yCotaL, X(Le), yCotaL, `L ${E.fmt_auto(Le)}`, T, { abaixo: true });
      void yL;
      const yCotaB = Y(Ro) - 18;
      linhaChamada(svg, X(xb0), Y(D / 2 + tb), X(xb0), yCotaB - 4, T); linhaChamada(svg, X(xb1), Y(D / 2 + tb), X(xb1), yCotaB - 4, T);
      cota(svg, X(xb0), yCotaB, X(xb1), yCotaB, `B ${E.fmt(B, 1)}`, T);
      // ⌀D: cota interna no colo, à direita do mancal
      const xCD = X(xb1) + Math.max(10, (X(xr) - X(xb1)) * 0.45);
      cota(svg, xCD, Y(D / 2), xCD, Y(-D / 2), '', T);
      texto(svg, xCD + 7, Yc - 8, `⌀${E.fmt_auto(D)}`, { class: 'dim vg-halo', fill: T.ink, 'text-anchor': 'start' });
      // rótulos de grupo
      texto(svg, X(0), 20, 'PONTA DE EIXO', { class: 'lbl', fill: T.ink3 });
      texto(svg, X(0), 36, `${R.d_adotado_origem.startsWith('normal') ? 'DIN 748-1' : 'Diâmetro ' + R.d_adotado_origem.split(' ')[0]} · ${R.tolerancia}`, { class: 'dim-s', fill: T.ink2 });
      if (m) {
        texto(svg, X(xb0 + B / 2), 20, 'MANCAL', { class: 'lbl', fill: T.ink3, 'text-anchor': 'middle' });
        texto(svg, X(xb0 + B / 2), 36, `metal patente · ISO VG ${m.vg}`, { class: 'dim-s', fill: T.ink2, 'text-anchor': 'middle' });
        // carga
        const seta = defsSeta(svg, T.em, 9);
        const xF = X(xb0 + B / 2), yF0 = Y(-Ro) + 6, yF1 = Math.min(H - 8, yF0 + 34);
        el('line', { x1: xF, x2: xF, y1: yF0, y2: yF1, stroke: T.em, 'stroke-width': 2.25, 'marker-end': seta }, svg);
        texto(svg, xF + 8, yF1 - 4, `F ${E.fmt(m.carga / 1000, 1)} kN`, { class: 'dim', fill: T.ink });
      } else {
        texto(svg, X(xb0 + B / 2), 28, 'mancal não calculado', { class: 'dim-s', fill: T.ink3, 'text-anchor': 'middle' });
      }
      // rotação (seta curva na face da ponta)
      const rx = 7, ry = Math.min(d / 2 * s * 0.8, 40);
      const seta2 = defsSeta(svg, T.s1, 8);
      const cx = X(0) + 0.5 * Math.min(Le * s * 0.18, 26) + 12;
      el('path', { d: `M${cx - rx} ${Yc + ry * 0.75}A${rx} ${ry} 0 1 1 ${cx + rx * 0.4} ${Yc + ry * 0.95}`, fill: 'none', stroke: T.s1, 'stroke-width': 1.75, 'marker-end': seta2 }, svg);
      texto(svg, cx + rx + 6, Yc + ry + 14, `n ${E.fmt(R.n_rpm, 0)} rpm · Mt ${E.fmt(R.mt / 1000, 1)} kN·m`, { class: 'dim-s', fill: T.ink2 });
    }, { altura: w => Math.round(Math.max(270, Math.min(370, w * 0.52))), rotulo: `Desenho esquemático: ponta de eixo de ${E.fmt_auto(R.d_adotado)} mm e mancal` });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Seção do mancal com filme ampliado e campo de pressão
  // ════════════════════════════════════════════════════════════════════════
  function secaoMancal(alvo, R, campo) {
    const m = R.mancal, c = m.principal;
    return C.montar(alvo, ({ svg, w, h: H, T, dica, esconder }) => {
      svg.classList.add('diag');
      const cx = w / 2, cy = H / 2 + 6;
      const Rb = Math.min(w * 0.3, H * 0.33);       // furo da bucha (px)
      const cv = Rb * 0.16;                           // folga radial ampliada
      const Rj = Rb - cv, ev = c.eps * cv;
      const psiU = rad(c.beta - 90);                  // direção da linha de centros (do centro do mancal ao do eixo)
      const P = (ang, r, ox = cx, oy = cy) => [ox + r * Math.cos(ang), oy - r * Math.sin(ang)];
      const [jx, jy] = P(psiU, ev);
      // caixa (anel) e bucha
      const Rh = Rb + Math.min(26, Rb * 0.18);
      el('circle', { cx, cy, r: Rh, fill: 'none', stroke: T.deemph, 'stroke-width': 1 }, svg);
      el('path', { d: `M${cx - Rh} ${cy}a${Rh} ${Rh} 0 1 0 ${2 * Rh} 0a${Rh} ${Rh} 0 1 0 ${-2 * Rh} 0ZM${cx - Rb} ${cy}a${Rb} ${Rb} 0 1 1 ${2 * Rb} 0a${Rb} ${Rb} 0 1 1 ${-2 * Rb} 0Z`,
        fill: T.emw, 'fill-rule': 'evenodd' }, svg);
      // campo de pressão (polar, para fora do furo) — usa o perfil do plano central
      if (campo) {
        const n = campo.n, pmx = campo.pMax || 1;
        const kp = Math.min(w * 0.16, Rb * 0.62) / pmx;
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const th = i / n * 2 * Math.PI;
          const ang = th + rad(c.beta + 90);
          const p = campo.perfil[i % n];
          pts.push(P(ang, Rb + kp * p));
        }
        const base = [];
        for (let i = n; i >= 0; i--) base.push(P(i / n * 2 * Math.PI + rad(c.beta + 90), Rb));
        el('path', { d: C.caminho(pts) + 'L' + C.caminho(base).slice(1) + 'Z', fill: T.emw, stroke: 'none' }, svg);
        el('path', { d: C.caminho(pts), fill: 'none', stroke: T.em, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
        // pico
        const aMax = rad(campo.thetaPMax + c.beta + 90);
        const [px, py] = P(aMax, Rb + kp * pmx);
        el('circle', { cx: px, cy: py, r: 5, fill: T.em, stroke: T.surface, 'stroke-width': 2 }, svg);
        const pMaxMPa = campo.pMax * c.eta * m.omega / c.psi ** 2 / 1e6;
        const dir = Math.cos(aMax) >= 0 ? 1 : -1;
        texto(svg, px + dir * 10, py + 4, `p máx ${E.fmt(pMaxMPa, 2)} MPa`, { class: 'dim vg-halo', fill: T.ink, 'text-anchor': dir > 0 ? 'start' : 'end' });
        const hit = el('circle', { cx: px, cy: py, r: 14, fill: 'transparent', class: 'vg-hit-pt' }, svg);
        hit.addEventListener('pointerenter', () => dica([{ titulo: 'Pressão máxima no filme' }, { valor: `${E.fmt(pMaxMPa, 2)} MPa`, rotulo: `${E.fmt(pMaxMPa / m.p, 2)}× p̄` }, { valor: `${E.fmt(campo.thetaPMax, 0)}°`, rotulo: 'após a folga máxima' }], px, py));
        hit.addEventListener('pointerleave', esconder);
      }
      // filme de óleo (entre furo e eixo)
      el('path', { d: `M${cx - Rb} ${cy}a${Rb} ${Rb} 0 1 0 ${2 * Rb} 0a${Rb} ${Rb} 0 1 0 ${-2 * Rb} 0ZM${jx - Rj} ${jy}a${Rj} ${Rj} 0 1 1 ${2 * Rj} 0a${Rj} ${Rj} 0 1 1 ${-2 * Rj} 0Z`,
        fill: T.s1w, 'fill-rule': 'evenodd', stroke: 'none' }, svg);
      el('circle', { cx, cy, r: Rb, fill: 'none', stroke: T.em, 'stroke-width': 1.5 }, svg);
      // eixo
      const corEixo = T.surface === '#ffffff' ? '#e9eeec' : '#1f3547';
      el('circle', { cx: jx, cy: jy, r: Rj, fill: corEixo, stroke: T.ink2, 'stroke-width': 1.5 }, svg);
      // eixos de referência
      el('line', { x1: cx, x2: cx, y1: cy - Rh - 6, y2: cy + Rh + 6, stroke: T.ink3, 'stroke-width': 1, 'stroke-dasharray': '10 3 2 3', opacity: 0.8 }, svg);
      el('line', { x1: cx - Rh - 6, x2: cx + Rh + 6, y1: cy, y2: cy, stroke: T.ink3, 'stroke-width': 1, 'stroke-dasharray': '10 3 2 3', opacity: 0.8 }, svg);
      // linha de centros até o ponto de filme mínimo
      const [mx, my] = P(psiU, Rb);
      const [ax, ay] = P(psiU + Math.PI, Rb);
      el('line', { x1: ax, y1: ay, x2: mx, y2: my, stroke: T.ink2, 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
      // ângulo β (entre a vertical para baixo e a linha de centros)
      const rArc = Math.min(Rj * 0.55, 70);
      const a0 = -Math.PI / 2, a1 = psiU;
      const [b0x, b0y] = P(a0, rArc, jx, jy), [b1x, b1y] = P(a1, rArc, jx, jy);
      el('path', { d: `M${b0x} ${b0y}A${rArc} ${rArc} 0 0 0 ${b1x} ${b1y}`, fill: 'none', stroke: T.s1, 'stroke-width': 1.5 }, svg);
      const [bl, blY] = P((a0 + a1) / 2, rArc + 14, jx, jy);
      texto(svg, bl, blY + 4, `β ${E.fmt(c.beta, 1)}°`, { class: 'dim vg-halo', fill: T.ink, 'text-anchor': 'start' });
      // carga (para baixo) a partir do centro do eixo
      const setaF = defsSeta(svg, T.ink, 9);
      el('line', { x1: jx, y1: jy, x2: jx, y2: jy + Rj * 0.72, stroke: T.ink, 'stroke-width': 2.25, 'marker-end': setaF }, svg);
      texto(svg, jx - 8, jy + Rj * 0.72 - 2, 'F', { class: 'math vg-halo', fill: T.ink, 'text-anchor': 'end' });
      // centros
      el('path', { d: `M${cx - 5} ${cy}h10M${cx} ${cy - 5}v10`, stroke: T.ink2, 'stroke-width': 1.5 }, svg);
      el('circle', { cx: jx, cy: jy, r: 3, fill: T.ink }, svg);
      // rotação (seta curva anti-horária no eixo)
      const rr = Rj * 0.78, sa = defsSeta(svg, T.s1, 8);
      const [r0x, r0y] = P(rad(150), rr, jx, jy), [r1x, r1y] = P(rad(105), rr, jx, jy);
      el('path', { d: `M${r0x} ${r0y}A${rr} ${rr} 0 0 0 ${r1x} ${r1y}`, fill: 'none', stroke: T.s1, 'stroke-width': 2, 'marker-end': sa }, svg);
      const [wx, wy] = P(rad(128), rr - 16, jx, jy);
      texto(svg, wx, wy + 5, 'ω', { class: 'math', fill: T.s1, 'text-anchor': 'middle' });
      // filme mínimo e máximo
      const [hx, hy] = P(psiU, Rb + 4);
      const dirH = Math.cos(psiU) >= 0 ? 1 : -1;
      const [hlx, hly] = P(psiU - rad(14), Rh + 26);
      el('line', { x1: hx, y1: hy, x2: hlx, y2: hly, stroke: T.ink3, 'stroke-width': 1 }, svg);
      texto(svg, hlx + dirH * 4, hly + 4, `h mín ${E.fmt(c.hmin * 1e6, 1)} µm`, { class: 'dim vg-halo', fill: T.ink, 'text-anchor': dirH > 0 ? 'start' : 'end' });
      texto(svg, hlx + dirH * 4, hly + 19, `folga média · ε ${E.fmt(c.eps, 3)}`, { class: 'dim-s vg-halo', fill: T.ink2, 'text-anchor': dirH > 0 ? 'start' : 'end' });
      const [Hx, Hy] = P(psiU + Math.PI, Rb + 4), [Hlx, Hly] = P(psiU + Math.PI + rad(10), Rh + 22);
      el('line', { x1: Hx, y1: Hy, x2: Hlx, y2: Hly, stroke: T.ink3, 'stroke-width': 1 }, svg);
      texto(svg, Hlx - dirH * 4, Hly + 4, `h máx ${E.fmt((c.psi * m.d / 2) * (1 + c.eps) * 1000, 0)} µm`, { class: 'dim-s vg-halo', fill: T.ink2, 'text-anchor': dirH > 0 ? 'end' : 'start' });
    }, { altura: w => Math.round(Math.max(300, Math.min(400, w * 0.72))), rotulo: `Corte do mancal: excentricidade ${E.fmt(c.eps, 3)}, ângulo ${E.fmt(c.beta, 1)} graus` });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Lugar geométrico do centro do eixo (ε, β)
  // ════════════════════════════════════════════════════════════════════════
  function lugarGeometrico(alvo, R) {
    const m = R.mancal;
    const refs = [0.25, 0.5, 1.0].filter(b => Math.abs(b - m.bd) > 0.04);
    const curva = bd => { const out = []; for (let k = 0; k <= 98; k++) { const e = Math.max(0.005, k / 100); out.push({ e, b: E.beta_de_eps(e, bd) }); } out.push({ e: 0.99, b: E.beta_de_eps(0.99, bd) }); return out; };
    return C.montar(alvo, ({ svg, w, h: H, T, dica, esconder }) => {
      svg.classList.add('diag');
      const pad = { l: 40, r: 64, t: 46, b: 30 };
      const Rr = Math.min(w - pad.l - pad.r, H - pad.t - pad.b);
      const ox = pad.l + (w - pad.l - pad.r - Rr) / 2, oy = pad.t;
      const P = (e, b) => { const a = rad(b - 90); return [ox + e * Rr * Math.cos(a), oy - e * Rr * Math.sin(a)]; };
      // grade: arcos de ε e raios de β
      for (const e of [0.2, 0.4, 0.6, 0.8, 1.0]) {
        const [x0, y0] = P(e, 90), [x1, y1] = P(e, 0);
        el('path', { d: `M${x0} ${y0}A${e * Rr} ${e * Rr} 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: e === 1 ? T.axis : T.grid, 'stroke-width': 1 }, svg);
        texto(svg, x0 + 3, y0 - 5, E.fmt(e, 1), { class: 'vg-tick', fill: T.ink3, 'text-anchor': 'middle' });
      }
      for (const b of [0, 15, 30, 45, 60, 75, 90]) {
        const [x1, y1] = P(1, b);
        el('line', { x1: ox, y1: oy, x2: x1, y2: y1, stroke: b % 90 === 0 ? T.axis : T.grid, 'stroke-width': 1 }, svg);
        const [tx, ty] = P(1.07, b);
        texto(svg, tx, ty + 4, `${b}°`, { class: 'vg-tick', fill: T.ink3, 'text-anchor': b > 80 ? 'start' : b < 10 ? 'middle' : 'start' });
      }
      texto(svg, ox + Rr * 0.5, oy - 26, 'excentricidade ε', { class: 'vg-axis-title', fill: T.ink2, 'text-anchor': 'middle' });
      const [lbx, lby] = P(1.12, 38);
      texto(svg, lbx + 4, lby, 'β', { class: 'math', fill: T.ink2 });
      // curvas de referência
      for (const bd of refs) {
        const pts = curva(bd).map(p => P(p.e, p.b));
        el('path', { d: C.caminho(pts), fill: 'none', stroke: T.deemph, 'stroke-width': 1.5 }, svg);
      }
      // curva do caso
      const pts = curva(m.bd).map(p => P(p.e, p.b));
      el('path', { d: C.caminho(pts), fill: 'none', stroke: T.s1, 'stroke-width': 2.25, 'stroke-linejoin': 'round' }, svg);
      const pm = pts[Math.round(pts.length * 0.62)];
      texto(svg, pm[0] + 10, pm[1] + 4, `B/D ${E.fmt(m.bd, 3)}`, { class: 'vg-end-label vg-halo', fill: T.ink });
      // pontos de operação (três folgas)
      const ordem = ['folga máxima', 'folga mínima', 'folga média'];
      for (const k of ordem) {
        const cs = m.casos[k];
        const [x, y] = P(cs.eps, cs.beta);
        const princ = k === 'folga média';
        el('circle', { cx: x, cy: y, r: princ ? 6 : 4.5, fill: princ ? T.em : T.s1, stroke: T.surface, 'stroke-width': 2 }, svg);
        if (princ) texto(svg, x + 10, y - 8, `ε ${E.fmt(cs.eps, 3)} · β ${E.fmt(cs.beta, 1)}°`, { class: 'vg-point-label', fill: T.ink });
        const hit = el('circle', { cx: x, cy: y, r: 12, fill: 'transparent', class: 'vg-hit-pt' }, svg);
        hit.addEventListener('pointerenter', () => dica([{ titulo: k.charAt(0).toUpperCase() + k.slice(1) }, { valor: E.fmt(cs.eps, 3), rotulo: 'ε' }, { valor: `${E.fmt(cs.beta, 1)}°`, rotulo: 'β' },
          { valor: E.fmt(cs.so, 3), rotulo: 'Sommerfeld' }, { valor: `${E.fmt(cs.hmin * 1e6, 1)} µm`, rotulo: 'h mín' }], x, y));
        hit.addEventListener('pointerleave', esconder);
      }
      el('path', { d: `M${ox - 5} ${oy}h10M${ox} ${oy - 5}v10`, stroke: T.ink2, 'stroke-width': 1.5 }, svg);
    }, { altura: w => Math.round(Math.max(260, Math.min(380, w * 0.78))), rotulo: 'Lugar geométrico do centro do eixo' });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Ajuste ISO: furo H7 × colo do eixo (µm em relação ao diâmetro nominal)
  // ════════════════════════════════════════════════════════════════════════
  function ajusteISO(alvo, R) {
    const m = R.mancal;
    return C.montar(alvo, ({ svg, w, h: H, T, dica, esconder }) => {
      svg.classList.add('diag');
      const um = x => x * 1000;
      const zonas = [
        { nome: 'Furo H7', a: 0, b: um(m.it7), cor: T.em, wash: T.emw },
        { nome: 'Colo do eixo', a: um(m.eixo_min - m.d), b: um(m.eixo_max - m.d), cor: T.s1, wash: T.s1w }
      ];
      const lo = Math.min(...zonas.map(z => Math.min(z.a, z.b)), 0), hi = Math.max(...zonas.map(z => Math.max(z.a, z.b)));
      const [y0, y1] = C.dominioBonito(lo * 1.1, hi * 1.15 + 1, 5, true);
      const M = { l: 58, r: 150, t: 18, b: 22 };
      const Y = C.linear(y0, y1, H - M.b, M.t);
      for (const v of C.marcasLineares(y0, y1, 5)) {
        const yy = Math.round(Y(v)) + 0.5;
        el('line', { x1: M.l, x2: w - M.r, y1: yy, y2: yy, stroke: v === 0 ? T.axis : T.grid, 'stroke-width': v === 0 ? 1.5 : 1 }, svg);
        texto(svg, M.l - 8, yy + 4, (v > 0 ? '+' : '') + E.fmt(v, 0), { class: 'vg-tick', fill: T.ink3, 'text-anchor': 'end' });
      }
      texto(svg, 14, (M.t + H - M.b) / 2, 'desvio (µm)', { class: 'vg-axis-title', fill: T.ink2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${(M.t + H - M.b) / 2})` });
      texto(svg, w - M.r + 8, Y(0) + 4, `linha zero · D ${E.fmt_auto(m.d)} mm`, { class: 'dim-s', fill: T.ink2 });
      const iw = w - M.l - M.r, bw = Math.min(70, iw * 0.24);
      const xs = [M.l + iw * 0.3 - bw / 2, M.l + iw * 0.7 - bw / 2];
      zonas.forEach((z, k) => {
        const ya = Y(Math.max(z.a, z.b)), yb = Y(Math.min(z.a, z.b));
        const hgt = Math.max(2, yb - ya);
        el('rect', { x: xs[k], y: ya, width: bw, height: hgt, rx: 3, fill: z.wash, stroke: z.cor, 'stroke-width': 1.5 }, svg);
        texto(svg, xs[k] + bw / 2, (k === 0 ? ya - 8 : yb + 15), z.nome, { class: 'dim-s', fill: T.ink2, 'text-anchor': 'middle' });
        const hit = el('rect', { x: xs[k] - 6, y: ya - 6, width: bw + 12, height: hgt + 12, fill: 'transparent', class: 'vg-hit-pt' }, svg);
        hit.addEventListener('pointerenter', () => dica([{ titulo: z.nome }, { valor: `${E.fmt(m.d + Math.min(z.a, z.b) / 1000, 3)} mm`, rotulo: 'mínimo' }, { valor: `${E.fmt(m.d + Math.max(z.a, z.b) / 1000, 3)} mm`, rotulo: 'máximo' }], xs[k] + bw, ya));
        hit.addEventListener('pointerleave', esconder);
      });
      // folgas (setas entre zonas)
      const seta = defsSeta(svg, T.ink2, 6);
      const xm1 = xs[0] + bw + (xs[1] - xs[0] - bw) * 0.35, xm2 = xs[0] + bw + (xs[1] - xs[0] - bw) * 0.7;
      el('line', { x1: xm1, x2: xm1, y1: Y(0), y2: Y(um(m.eixo_max - m.d)), stroke: T.ink2, 'stroke-width': 1, 'marker-start': seta, 'marker-end': seta }, svg);
      el('line', { x1: xm2, x2: xm2, y1: Y(um(m.it7)), y2: Y(um(m.eixo_min - m.d)), stroke: T.ink2, 'stroke-width': 1, 'marker-start': seta, 'marker-end': seta }, svg);
      texto(svg, w - M.r + 8, Y(um(m.eixo_max - m.d) / 2) + 4, `folga mín ${E.fmt(um(m.folga_min), 0)} µm`, { class: 'dim', fill: T.ink });
      texto(svg, w - M.r + 8, Y(um(m.eixo_max - m.d) / 2) + 20, `folga máx ${E.fmt(um(m.folga_max), 0)} µm`, { class: 'dim', fill: T.ink });
      el('line', { x1: xm1, x2: w - M.r + 4, y1: Y(um(m.eixo_max - m.d) / 2), y2: Y(um(m.eixo_max - m.d) / 2), stroke: T.ink3, 'stroke-width': 1, 'stroke-dasharray': '2 3' }, svg);
    }, { altura: 220, rotulo: 'Zonas de tolerância do ajuste' });
  }

  raiz.VGDiag = { montagem, secaoMancal, lugarGeometrico, ajusteISO, defsSeta, hachura, cota };
})(window);
