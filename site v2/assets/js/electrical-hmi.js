/* Laboratório elétrico · "Tela da máquina".
   Mostra a bobina como na tela de ajuste de parâmetros da máquina que a fabrica:
   1) laço enrolado nos pinos (violino), 2) bobina aberta e conformada (vista superior),
   3) caimento das cabeças (vista lateral) e 4) abertura dos braços (vista frontal).
   Comprimentos horizontais na mesma escala nas vistas 1 a 3; espessuras e alturas ampliadas
   para ficarem visíveis. Todos os números vêm do cálculo (VGElectrical). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VGCoilHMI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PI = Math.PI;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const nf = (x, d = 1) => Number.isFinite(x)
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }).format(x) : '—';
  const deg = x => x * 180 / PI;
  const q = x => Math.round(x * 10) / 10;
  const P = (x, y) => `${q(x)} ${q(y)}`;
  const VW = 720;                       // largura do viewBox das vistas 1 a 3
  const TAG = 22, CAP = 15;             // tamanhos de fonte (unidades do viewBox)

  /* ---- Primitivas SVG --------------------------------------------------------- */
  function Svg() {
    const out = [];
    const S = {
      out,
      raw: s => out.push(s),
      arrow(x, y, ang, size = 9) {
        const a = [[x, y], [x - size * Math.cos(ang - 0.38), y - size * Math.sin(ang - 0.38)], [x - size * Math.cos(ang + 0.38), y - size * Math.sin(ang + 0.38)]];
        out.push(`<path class="h-arrow" d="M${a.map(p => P(...p)).join(' L')} Z"/>`);
      },
      cap(x, y, t, o = {}) {
        out.push(`<text class="h-cap" x="${q(x)}" y="${q(y)}" text-anchor="${o.anchor || 'middle'}"${o.rot ? ` transform="rotate(${o.rot} ${q(x)} ${q(y)})"` : ''}>${esc(t)}</text>`);
      },
      // Caixa amarela de valor centrada em (x, y).
      tag(x, y, value, key) {
        const w = Math.max(54, String(value).length * TAG * 0.6 + 16), h = TAG + 10;
        out.push(`<g class="h-tag" data-k="${key}"><rect x="${q(x - w / 2)}" y="${q(y - h / 2)}" width="${q(w)}" height="${h}" rx="3"/>` +
          `<text x="${q(x)}" y="${q(y + TAG * 0.36)}" text-anchor="middle">${esc(value)}</text></g>`);
        return w;
      },
      // Cota horizontal: linha em y, chamadas a partir de y0/y1, valor no meio, legenda acima/abaixo.
      dimH(x1, x2, y, value, key, o = {}) {
        out.push(`<g class="h-dim" data-k="${key}">`);
        if (o.from1 !== undefined) out.push(`<line class="h-ext" x1="${q(x1)}" y1="${q(o.from1)}" x2="${q(x1)}" y2="${q(y + Math.sign(y - o.from1) * 6)}"/>`);
        if (o.from2 !== undefined) out.push(`<line class="h-ext" x1="${q(x2)}" y1="${q(o.from2)}" x2="${q(x2)}" y2="${q(y + Math.sign(y - o.from2) * 6)}"/>`);
        out.push(`<line class="h-dl" x1="${q(x1)}" y1="${q(y)}" x2="${q(x2)}" y2="${q(y)}"/>`);
        S.arrow(x1, y, PI); S.arrow(x2, y, 0);
        out.push('</g>');
        const xm = o.at ?? (x1 + x2) / 2;
        if (o.caption) S.cap(xm, o.capBelow ? y + 32 : y - 21, o.caption);
        S.tag(xm, y, value, key);
      },
      dimV(x, y1, y2, value, key, o = {}) {
        out.push(`<g class="h-dim" data-k="${key}">`);
        if (o.from1 !== undefined) out.push(`<line class="h-ext" x1="${q(o.from1)}" y1="${q(y1)}" x2="${q(x + Math.sign(x - o.from1) * 6)}" y2="${q(y1)}"/>`);
        if (o.from2 !== undefined) out.push(`<line class="h-ext" x1="${q(o.from2)}" y1="${q(y2)}" x2="${q(x + Math.sign(x - o.from2) * 6)}" y2="${q(y2)}"/>`);
        out.push(`<line class="h-dl" x1="${q(x)}" y1="${q(y1)}" x2="${q(x)}" y2="${q(y2)}"/>`);
        if (Math.abs(y2 - y1) > 20) { S.arrow(x, y1, -PI / 2); S.arrow(x, y2, PI / 2); }
        else { S.arrow(x, y1, PI / 2, 8); S.arrow(x, y2, -PI / 2, 8); }   // cota curta: setas por fora
        out.push('</g>');
        const tx = o.tagX ?? x, ty = o.tagY ?? (y1 + y2) / 2;
        if (o.caption) S.cap(o.capX ?? tx, o.capY ?? ty - 23, o.caption, { anchor: o.capAnchor });
        S.tag(tx, ty, value, key);
      },
      // Arco angular com valor.
      arc(cx, cy, r, a0, a1, value, key, o = {}) {
        const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        const sweep = a1 > a0 ? 1 : 0, large = Math.abs(a1 - a0) > PI ? 1 : 0;
        out.push(`<g class="h-dim" data-k="${key}"><path class="h-dl" d="M${P(...p0)} A${q(r)} ${q(r)} 0 ${large} ${sweep} ${P(...p1)}"/>`);
        S.arrow(...p1, a1 + (sweep ? PI / 2 : -PI / 2), 8); S.arrow(...p0, a0 + (sweep ? -PI / 2 : PI / 2), 8);
        out.push('</g>');
        const am = (a0 + a1) / 2, rr = r + (o.push ?? 34);
        S.tag(cx + rr * Math.cos(am), cy + rr * Math.sin(am), value, key);
      },
      end: (vb, label) => `<svg class="hmi-svg" viewBox="${vb}" role="img" aria-label="${esc(label)}" focusable="false">${out.join('')}</svg>`
    };
    return S;
  }
  // Faixa da bobina: contorno escuro + miolo claro (aparência da tela da máquina).
  const band = (S, d, t, cls = '') => S.raw(`<path class="h-band-o ${cls}" d="${d}" style="stroke-width:${q(t + 4)}"/><path class="h-band ${cls}" d="${d}" style="stroke-width:${q(t)}"/>`);
  const stadium = (xa, xb, cy, R) => `M${P(xa, cy - R)} L${P(xb, cy - R)} A${q(R)} ${q(R)} 0 0 1 ${P(xb, cy + R)} L${P(xa, cy + R)} A${q(R)} ${q(R)} 0 0 1 ${P(xa, cy - R)} Z`;

  /* ---- Geometria comum ----------------------------------------------------------- */
  function geometry(r) {
    const v = r.input, h = r.head, k = r.coil;
    const extLOL = v.retaLOL + h.LOL.ExPc, extLL = v.retaLL + h.LL.ExPc;
    const total = v.pacote + extLOL + extLL;
    const halfP = h.rMid * h.Abb;                          // meio passo desenvolvido (arco)
    const loopOut = h.Cv + 2 * k.Aib;                      // comprimento externo do laço
    let s = (VW - 120) / Math.max(loopOut, total);
    const sOpen = Math.min(s, 230 / Math.max(1, 2 * halfP));   // abertura muito grande: comprime só a vertical
    return { v, h, k, extLOL, extLL, total, halfP, loopOut, s, sOpen };
  }

  /* ---- 1. Laço / violino ----------------------------------------------------------- */
  function figLoop(r, G) {
    const { v, h, k, s } = G;
    const S = Svg();
    const cy = 112, xc = VW / 2;
    const d = (h.Cv - h.phiC) * s;
    const xa = xc - d / 2, xb = xc + d / 2;
    const ri = Math.max(h.phiC / 2 * s, 8);
    const ro = Math.max((h.phiC / 2 + k.Aib) * s, ri + 18);
    const Ne = v.espBob;
    // fios de saída (lado da ligação, à direita)
    S.raw(`<path class="h-lead" d="M${P(xb - 30, cy + ro - 2)} C${P(xb + 10, cy + ro + 18)} ${P(xb + 40, cy + ro + 22)} ${P(xb + 70, cy + ro + 26)}"/>`);
    S.raw(`<path class="h-lead" d="M${P(xb - 46, cy + ri + 2)} C${P(xb - 6, cy + ro + 26)} ${P(xb + 30, cy + ro + 36)} ${P(xb + 62, cy + ro + 40)}"/>`);
    S.raw(`<path class="h-loop" d="${stadium(xa, xb, cy, ro)} ${stadium(xa, xb, cy, ri)}" fill-rule="evenodd"/>`);
    const lines = Math.min(Ne, 24);
    for (let i = 1; i < lines; i++) S.raw(`<path class="h-turn" d="${stadium(xa, xb, cy, ri + (ro - ri) * i / lines)}"/>`);
    for (const x of [xa, xb]) S.raw(`<g class="h-pin"><circle cx="${q(x)}" cy="${cy}" r="${q(ri * 0.94)}"/><circle class="h-pin-hi" cx="${q(x - ri * 0.3)}" cy="${q(cy - ri * 0.3)}" r="${q(ri * 0.28)}"/></g>`);
    // cotas
    S.dimH(xa - ri, xb + ri, cy - ro - 34, nf(h.Cv), 'cv', { from1: cy, from2: cy, caption: 'COMPRIMENTO DO VIOLINO · Cv' });
    S.dimH(xa - ro, xb + ro, cy + ro + 40, nf(G.loopOut), 'laco', { from1: cy + 4, from2: cy + 4, caption: 'COMPRIMENTO EXTERNO DO LAÇO', capBelow: true, at: xc - 60 });
    S.cap(xa + ro + 26, cy + 6, `PINO Φ${nf(h.phiC, 0)}`, { anchor: 'start' });
    S.cap(xc, cy + 6, `${Ne} ESPIRAS`, {});
    return S.end(`0 0 ${VW} ${cy + ro + 84}`, `Laço enrolado entre dois pinos: comprimento do violino ${nf(h.Cv)} mm, externo ${nf(G.loopOut)} mm, pinos de ${nf(h.phiC)} mm.`);
  }

  /* ---- 2. Aberta e conformada (vista superior) ------------------------------------- */
  function figTop(r, G) {
    const { v, h, k, s, sOpen, total, halfP, extLOL, extLL } = G;
    const S = Svg();
    const L = total * s, x0 = (VW - L) / 2 - 14;
    const open = Math.max(2 * halfP * sOpen, 130);           // abertura pequena: ampliada para caber as cotas
    const top = 150, cy = top + open / 2, bot = cy + open / 2;
    const X = mm => x0 + mm * s;
    const xs0 = X(h.LOL.ExPc), xs1 = X(total - h.LL.ExPc);
    const c0 = X(extLOL), c1 = X(total - extLL);
    const nose = Math.max(h.phiC / 2 * sOpen, 4);
    const t = Math.max(k.Lb * s, 10);
    // núcleo
    S.raw(`<rect class="h-core" x="${q(c0)}" y="${q(top - 26)}" width="${q(c1 - c0)}" height="${q(open + 52)}" rx="3"/>`);
    S.raw(`<rect class="h-core-hatch" x="${q(c0)}" y="${q(top - 26)}" width="${q(c1 - c0)}" height="${q(open + 52)}" rx="3"/>`);
    // pontas de ligação (LL, à direita)
    const xe = X(total);
    for (const dy of [-9, 9]) S.raw(`<rect class="h-leadbar" x="${q(xe - 6)}" y="${q(cy + dy - 4)}" width="${q(Math.max(v.distLig * s, 8) + 26)}" height="8" rx="2"/>`);
    const hex = `M${P(xs0, top)} L${P(xs1, top)} L${P(xe, cy - nose)} L${P(xe, cy + nose)} L${P(xs1, bot)} L${P(xs0, bot)} L${P(X(0), cy + nose)} L${P(X(0), cy - nose)} Z`;
    band(S, hex, t);
    S.cap(c1 - 10, top - 8 - t / 2, 'NÚCLEO', { anchor: 'end' });
    // cotas
    S.dimH(X(0), xe, 44, nf(total), 'total', { from1: cy - nose - 4, from2: cy - nose - 4, caption: 'COMPRIMENTO TOTAL' });
    S.dimH(xs0, xs1, top - 50, nf(h.Pr), 'pr', { from1: top - t / 2 - 2, from2: top - t / 2 - 2, caption: 'PARTE RETA' });
    S.dimV((c0 + c1) / 2, top + t / 2 + 2, bot - t / 2 - 2, nf(2 * halfP), 'abertura', { tagX: (c0 + c1) / 2 + 2, caption: `ABERTURA · PASSO 1–${h.Pb}`, capY: cy - 26, capX: (c0 + c1) / 2 + 2 });
    const yb = bot + 44;
    S.dimH(X(0), c0, yb, nf(extLOL), 'extlol', { from1: cy + nose + 4, from2: bot + 26 });
    S.dimH(c0, c1, yb, nf(v.pacote), 'nucleo', {});
    S.dimH(c1, xe, yb, nf(extLL), 'extll', { from1: bot + 26, from2: cy + nose + 4 });
    S.cap((X(0) + c0) / 2, yb + 34, 'L.O.L.');
    S.cap((c0 + c1) / 2, yb + 34, 'NÚCLEO');
    S.cap((c1 + xe) / 2, yb + 34, 'L.L.');
    // ângulo do nariz (2·Âsc), lado L.O.L.
    const ax = X(0) + 6, aUp = Math.atan2(top - cy, xs0 - ax), aDn = Math.atan2(bot - cy, xs0 - ax);
    S.arc(ax, cy, Math.min(60, (xs0 - ax) * 0.55), aUp, aDn, `${nf(2 * deg(h.LOL.Asc))}°`, 'asc', { push: 38 });
    if (Math.abs(h.LL.Asc - h.LOL.Asc) > 1e-6) {
      const bx = xe - 6, bUp = Math.atan2(top - cy, xs1 - bx), bDn = Math.atan2(bot - cy, xs1 - bx);
      S.arc(bx, cy, Math.min(60, (bx - xs1) * 0.55), bDn, bUp + 2 * PI, `${nf(2 * deg(h.LL.Asc))}°`, 'ascll', { push: 38 });
    }
    return S.end(`0 0 ${VW} ${q(yb + 50)}`, `Bobina aberta e conformada vista de cima: comprimento total ${nf(total)} mm, parte reta ${nf(h.Pr)} mm, abertura ${nf(2 * halfP)} mm.`);
  }

  /* ---- 3. Caimento (vista lateral) ------------------------------------------------- */
  function figSide(r, G) {
    const { v, h, k, s, total, extLOL, extLL } = G;
    const S = Svg();
    const L = total * s, x0 = (VW - L) / 2 - 14;
    const X = mm => x0 + mm * s;
    const yBore = 120, coreTop = 58;
    const c0 = X(extLOL), c1 = X(total - extLL);
    const ex = 3;                                             // ampliação vertical
    const zL = Math.max(v.caimLOL * s * ex, 12), zR = Math.max(v.caimLL * s * ex, 12);
    const t = Math.max(k.Ab * s, 10);
    const yLeg = yBore - t / 2 - 4;
    // núcleo e dedos de aperto
    S.raw(`<rect class="h-core" x="${q(c0)}" y="${coreTop}" width="${q(c1 - c0)}" height="${yBore - coreTop}"/>`);
    S.raw(`<rect class="h-core-hatch" x="${q(c0)}" y="${coreTop}" width="${q(c1 - c0)}" height="${yBore - coreTop}"/>`);
    const dW = Math.max(v.dedo * s, 5);
    S.raw(`<rect class="h-finger" x="${q(c0 - dW)}" y="${coreTop + 10}" width="${q(dW)}" height="${yBore - coreTop - 10}"/><rect class="h-finger" x="${q(c1)}" y="${coreTop + 10}" width="${q(dW)}" height="${yBore - coreTop - 10}"/>`);
    S.raw(`<line class="h-bore" x1="${q(X(0) - 30)}" y1="${yBore}" x2="${q(X(total) + 60)}" y2="${yBore}"/>`);
    const xs0 = X(h.LOL.ExPc), xs1 = X(total - h.LL.ExPc), xe = X(total);
    const yNL = yBore + zL - t / 2, yNR = yBore + zR - t / 2;
    const d = `M${P(X(0), yNL)} C${P(X(0) + (xs0 - X(0)) * 0.55, yNL)} ${P(xs0 - (xs0 - X(0)) * 0.4, yLeg)} ${P(xs0, yLeg)} L${P(xs1, yLeg)} ` +
      `C${P(xs1 + (xe - xs1) * 0.4, yLeg)} ${P(xe - (xe - xs1) * 0.55, yNR)} ${P(xe, yNR)}`;
    for (const dy of [-7, 7]) S.raw(`<rect class="h-leadbar" x="${q(xe - 4)}" y="${q(yNR + dy - 4)}" width="${q(Math.max(v.distLig * s, 8) + 26)}" height="8" rx="2"/>`);
    band(S, d, t);
    S.raw(`<circle class="h-nose" cx="${q(X(0))}" cy="${q(yNL)}" r="${q(t / 2 + 2)}"/><circle class="h-nose" cx="${q(xe)}" cy="${q(yNR)}" r="${q(t / 2 + 2)}"/>`);
    S.cap((c0 + c1) / 2, coreTop + 30, 'NÚCLEO', {});
    // cotas: caimento LOL e LL
    const yTopNoseL = yNL + t / 2, yTopNoseR = yNR + t / 2;
    S.dimV(X(0) - 26, yBore, yTopNoseL, nf(v.caimLOL), 'caimlol', { from1: X(0) - 4, from2: X(0) - t / 2, tagX: X(0) - 26, tagY: yBore + 70, caption: 'CAIMENTO L.O.L.', capY: yBore + 100, capX: X(0) - 10, capAnchor: 'start' });
    S.dimV(xe + 26, yBore, yTopNoseR, nf(v.caimLL), 'caimll', { from1: xe + 4, from2: xe + t / 2, tagX: xe + 26, tagY: yBore + 70, caption: 'CAIMENTO L.L.', capY: yBore + 100, capX: xe + 10, capAnchor: 'end' });
    // parte curva projetada
    const yd = 30;
    S.dimH(X(0), xs0, yd, nf(h.LOL.ExPc), 'expclol', { from1: yNL - t / 2 - 4, from2: yLeg - t / 2 - 2 });
    S.dimH(xs1, xe, yd, nf(h.LL.ExPc), 'expcll', { from1: yLeg - t / 2 - 2, from2: yNR - t / 2 - 4 });
    S.cap((X(0) + xs0) / 2, yd + 34, 'PARTE CURVA', {});
    S.cap((xs1 + xe) / 2, yd + 34, 'PARTE CURVA', {});
    return S.end(`0 0 ${VW} ${yBore + 112}`, `Vista lateral: caimento da cabeça ${nf(v.caimLOL)} mm no lado oposto e ${nf(v.caimLL)} mm no lado da ligação; parte curva projetada ${nf(h.LOL.ExPc)} e ${nf(h.LL.ExPc)} mm.`);
  }

  /* ---- 4. Abertura dos braços (vista frontal L.O.L.) ------------------------------- */
  function figFront(r, G) {
    const { v, h } = G;
    const S = Svg();
    const half = Math.max(h.Abb, 18 * PI / 180), mirror = v.braco === 'esquerda' ? -1 : 1;   // ângulo pequeno: desenhado com 18°
    const Hv = 330, ox = 34, oy = Hv / 2;
    const r1 = Math.min(230, 118 / Math.max(0.3, Math.sin(half)));   // raio das ranhuras (esquemático)
    const r0 = r1 * 0.42;                                            // nariz da cabeça
    const ra = r1 + 42;                                              // cotas angulares por fora do núcleo
    const Wv = Math.ceil(ox + (ra + 36) * Math.cos(half / 2) + 62);
    const pt = (rr, a) => [ox + rr * Math.cos(a), oy + mirror * rr * Math.sin(a)];
    // núcleo (faixa) e linhas de centro
    const aSpan = Math.min(PI / 2.3, half + 0.32);
    const b0 = pt(r1 + 14, -aSpan), b1 = pt(r1 + 14, aSpan);
    S.raw(`<path class="h-corearc" d="M${P(...b0)} A${q(r1 + 14)} ${q(r1 + 14)} 0 0 ${mirror > 0 ? 1 : 0} ${P(...b1)}"/>`);
    for (const a of [-half, half, 0]) S.raw(`<line class="h-ray" x1="${q(ox)}" y1="${q(oy)}" x2="${q(pt(ra + 10, a)[0])}" y2="${q(pt(ra + 10, a)[1])}"/>`);
    S.raw(`<circle class="h-axis" cx="${ox}" cy="${oy}" r="5"/>`);
    S.cap(ox - 4, oy + 26, 'EIXO', { anchor: 'start' });
    // braços em V até o nariz, inclinado de Âcc
    const ccw = h.Acc * PI / 180;
    const nose = pt(r0, 0), nx = Math.cos(ccw) * 12, ny = -mirror * Math.sin(ccw) * 12;
    const up = pt(r1, -half), dn = pt(r1, half);
    band(S, `M${P(...up)} L${P(nose[0] + nx, nose[1] + ny)} L${P(nose[0] - nx, nose[1] - ny)} L${P(...dn)}`, 13);
    for (const [p0, a] of [[up, -half], [dn, half]])
      S.raw(`<rect class="h-slot" x="${q(p0[0] - 9)}" y="${q(p0[1] - 9)}" width="18" height="18" transform="rotate(${q(deg(a * mirror))} ${q(p0[0])} ${q(p0[1])})"/>`);
    const mid = (p, a) => [(p[0] + nose[0]) / 2, (p[1] + nose[1]) / 2];
    const mu = mid(up), md = mid(dn);
    S.cap(mu[0] - 14, mu[1] - 6 * mirror, 'SUPERIOR', { anchor: 'end' });
    S.cap(md[0] - 14, md[1] + 16 * mirror, 'INFERIOR', { anchor: 'end' });
    // ângulos de cada braço em relação à linha de centro
    S.arc(ox, oy, ra, Math.min(0, -half * mirror), Math.max(0, -half * mirror), `${nf(deg(h.Abb))}°`, 'abb1', { push: 36 });
    S.arc(ox, oy, ra, Math.min(0, half * mirror), Math.max(0, half * mirror), `${nf(deg(h.Abb))}°`, 'abb2', { push: 36 });
    // ângulo frontal da cabeça (Âcc), no nariz
    const a1 = -mirror * ccw;
    S.raw(`<line class="h-ray" x1="${q(nose[0])}" y1="${q(nose[1])}" x2="${q(nose[0] + 64)}" y2="${q(nose[1])}"/>`);
    S.arc(nose[0], nose[1], 46, Math.min(0, a1), Math.max(0, a1), `Âcc ${nf(h.Acc, 0)}°`, 'acc', { push: 58 });
    S.cap(Wv - 8, Hv - 8, `braço superior à ${v.braco}`, { anchor: 'end' });
    return S.end(`0 0 ${Wv} ${Hv}`, `Vista frontal: braços abertos ${nf(deg(h.Abb))}° para cada lado da linha de centro; ângulo frontal da cabeça ${nf(h.Acc, 0)}°.`);
  }

  /* ---- Painel --------------------------------------------------------------------- */
  // célula: [rótulo, valor, unidade, chave, fórmula, ruim]
  const cell = ([label, value, unit, key, help, bad]) =>
    `<div class="hmi-cell${bad ? ' is-bad' : ''}"${key ? ` data-k="${key}"` : ''}${help ? ` title="${esc(help)}"` : ''} tabindex="0">` +
    `<span class="hmi-lab">${esc(label)}</span><span class="hmi-val">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</span></div>`;
  const stage = (n, title, sub, fig, cells, cls = '') =>
    `<section class="hmi-stage ${cls}" aria-label="${esc(title)}"><header class="hmi-stage-head"><span class="hmi-step">${n}</span><h3>${esc(title)}<small>${esc(sub)}</small></h3></header>` +
    `<div class="hmi-stage-body"><div class="hmi-fig">${fig}</div><div class="hmi-params">${cells.map(cell).join('')}</div></div></section>`;
  const flow = t => `<div class="hmi-flow" aria-hidden="true"><span>${esc(t)}</span></div>`;

  function html(r) {
    const G = geometry(r);
    const { v, h, k, total, halfP, extLOL, extLL } = G;
    const w = r.wire, res = r.res;
    const name = v.equipamento || [v.os && 'OS ' + v.os, v.cliente].filter(Boolean).join(' · ') || 'BOBINA';
    const sameSides = Math.abs(h.LL.ExPc - h.LOL.ExPc) < 1e-6 && v.caimLL === v.caimLOL && v.retaLL === v.retaLOL;
    const lr = (a, b, d = 1) => sameSides ? nf(a, d) : `${nf(a, d)} / ${nf(b, d)}`;
    const top = [
      ['Nome dos dados', name, '', '', 'Equipamento ou OS (grupo 01)'],
      ['Espiras por bobina', String(v.espBob), '', '', 'Esp/Bob da FTD'],
      ['Condutor', `${w.Fl}×${w.Fa} · ${nf(w.Lf, 2)}×${nf(w.Af, 2)}`, 'mm', '', 'Fios na largura × na altura · largura Lf × altura Af do fio nu'],
      ['Passo', `1–${h.Pb}`, '', '', `${h.span} ranhuras de abertura · PB% ${nf(v.pbPct, 1)}`]
    ];
    const s1 = [
      ['Comprimento do violino Cv', nf(h.Cv), 'mm', 'cv', 'Cv = (Pr + Pc LL + Pc LOL + Φc)·1,00591 · item 3.7. Medido entre as extremidades dos pinos.'],
      ['Comprimento externo do laço', nf(G.loopOut), 'mm', 'laco', 'Cv + 2·Aib (altura da bobina sem isolamento externo).'],
      ['Diâmetro do pino Φc', nf(h.phiC), 'mm', '', `Diâmetro interno da cabeça · mínimo ${nf(h.phiMin, 0)} mm (item 3.10).`],
      ['Distância entre pinos', nf(h.Cv - h.phiC), 'mm', '', 'Cv − Φc, de centro a centro.']
    ];
    const s2 = [
      ['Comprimento total', nf(total), 'mm', 'total', 'Núcleo + extensões L.L. e L.O.L. (parte reta + parte curva).'],
      ['Parte reta Pr', nf(h.Pr), 'mm', 'pr', 'Pr = Cn + reta L.L. + reta L.O.L. · item 3.7'],
      ['Abertura total', nf(2 * halfP), 'mm', 'abertura', `Passo desenvolvido no meio da ranhura: 2·(Φin/2 + R/2)·Âbb. Corda: ${nf(2 * h.rMid * Math.sin(h.Abb))} mm.`],
      ['Ângulo do nariz 2·Âsc', sameSides ? `${nf(2 * deg(h.LOL.Asc))}°` : `${nf(2 * deg(h.LL.Asc))}° / ${nf(2 * deg(h.LOL.Asc))}°`, '', 'asc', 'Âsc = atan[Xr/(ExPc − Aib)] · item 3.9'],
      [sameSides ? 'Extensão L.L. = L.O.L.' : 'Extensão L.L. / L.O.L.', lr(extLL, extLOL), 'mm', 'extll', 'Parte reta fora do núcleo + extensão da parte curva.'],
      ['Comprimento do núcleo', nf(v.pacote), 'mm', 'nucleo', 'Pacote da FTD.']
    ];
    const s3 = [
      [sameSides ? 'Caimento L.L. = L.O.L.' : 'Caimento L.L. / L.O.L.', lr(v.caimLL, v.caimLOL), 'mm', 'caimll', 'Medido acima da cunha (POP-MTR-02003). Caimento real Z = caimento − cunha.'],
      [sameSides ? 'Parte curva L.L. = L.O.L.' : 'Parte curva L.L. / L.O.L.', lr(h.LL.ExPc, h.LOL.ExPc), 'mm', 'expcll', h.fitted ? 'Extensão da parte curva ajustada para reproduzir o CME da FTD.' : 'Extensão da parte curva informada.'],
      [sameSides ? 'Parte reta fora L.L. = L.O.L.' : 'Parte reta fora L.L. / L.O.L.', lr(v.retaLL, v.retaLOL), 'mm', '', 'Trecho reto entre o núcleo e o início da parte curva.'],
      ['Comprimento da parte curva', lr(h.LL.Pc, h.LOL.Pc), 'mm', '', 'Pc = √(X² + Y² + Z²) · item 3.7']
    ];
    const s4 = [
      ['Ângulo do braço superior', `${nf(deg(h.Abb))}°`, '', 'abb1', 'Âbb = [(passo − 1)/Nr·360°]/2 · item 3.8'],
      ['Ângulo do braço inferior', `${nf(deg(h.Abb))}°`, '', 'abb2', `Simétrico. Abertura entre os braços 2·Âbb = ${nf(2 * deg(h.Abb))}°.`],
      ['Ângulo frontal Âcc', `${nf(h.Acc, 0)}°`, '', 'acc', 'Regressão do item 3.11, arredondada para baixo (mínimo 10°).'],
      ['Ranhuras', String(v.ranhuras), '', '', 'Do estator (FTD).']
    ];
    const data = [
      ['Bobina isolada Lb × Ab', `${nf(k.Lb, 2)} × ${nf(k.Ab, 2)}`, 'mm', '', 'Largura e altura da bobina com isolamento (itens 3.4 e 3.5).'],
      ['Sobra lateral', nf(k.sobraL, 2), 'mm', '', 'W12 − Lb', k.sobraL < 0],
      ['Sobra na altura', nf(k.sobraA, 2), 'mm', '', 'DS − 2·Ab − calços', k.sobraA < 0],
      ['Seção S', nf(k.Se, 2), 'mm²', '', 'Seção de cobre da espira (item 3.3).'],
      ['Densidade J', nf(k.J, 2), 'A/mm²', '', 'Corrente na espira / S.'],
      ['Cme', nf(r.lengths.Cme), 'mm', '', 'Comprimento médio da espira · item 3.12'],
      ['R por fase 25 °C', nf(res.Rf / 1000, 4), 'Ω', '', `FTD: ${nf(v.rFase, 4)} Ω · item 3.13`],
      ['Cobre por bobina', nf(r.copper.Mcb, 2), 'kg', '', 'Item 3.15']
    ];
    return `<div class="hmi-bezel">` +
      `<div class="hmi-topbar"><span class="hmi-led" aria-hidden="true"></span><strong>Tela de ajuste de parâmetros</strong><span class="hmi-topbar-sub">bobina pré-formada · valores calculados a partir da FTD</span></div>` +
      `<div class="hmi-screen">` +
      `<div class="hmi-head">${top.map(cell).join('')}</div>` +
      stage(1, 'Enrolamento do laço', 'violino nos dois pinos', figLoop(r, G), s1) +
      flow('abrir e conformar') +
      stage(2, 'Bobina aberta e conformada', 'vista superior', figTop(r, G), s2) +
      stage(3, 'Caimento das cabeças', 'vista lateral', figSide(r, G), s3, 'hmi-stage-side') +
      stage(4, 'Abertura dos braços', 'vista frontal L.O.L.', figFront(r, G), s4, 'hmi-stage-front') +
      `<div class="hmi-data"><h3>Dados calculados</h3><div class="hmi-data-grid">${data.map(cell).join('')}</div></div>` +
      `<p class="hmi-foot">Comprimentos na mesma escala nas vistas 1 a 3 (o violino é mais longo que a bobina pronta: a cabeça sobe em diagonal ao conformar). Espessuras, caimentos e ângulos desenhados ampliados para leitura; os números são os do cálculo. Toque num valor para ver a fórmula.</p>` +
      `</div></div>`;
  }

  // Liga valor ↔ cota: passar o mouse (ou focar) num valor destaca a cota correspondente e vice-versa.
  function wire(rootEl) {
    const hot = (key, on) => { for (const n of rootEl.querySelectorAll(`[data-k="${key}"]`)) n.classList.toggle('is-hot', on); };
    for (const n of rootEl.querySelectorAll('[data-k]')) {
      const key = n.getAttribute('data-k');
      n.addEventListener('pointerenter', () => hot(key, true));
      n.addEventListener('pointerleave', () => hot(key, false));
      n.addEventListener('focus', () => hot(key, true));
      n.addEventListener('blur', () => hot(key, false));
    }
  }

  function render(r) {
    const sec = document.createElement('section');
    sec.className = 'hmi';
    sec.id = 'tela-maquina';
    sec.setAttribute('aria-label', 'Tela da máquina: parâmetros da bobina');
    sec.innerHTML = html(r);
    wire(sec);
    return sec;
  }

  return { render, html };
});
