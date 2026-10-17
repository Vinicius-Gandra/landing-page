/* Laboratório elétrico · desenho da bobina do estator (Design de Bobinas rev. 00, item 5.2).
   Gera uma folha A3 em SVG (texto puro, sem dependências): vistas superior, lateral, frontal LOL e das
   ligações, detalhe da ranhura, supressão de corona, figuras A a D, quadro de dados e carimbo.
   Desenho esquemático: as cotas trazem os valores calculados. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VGCoilDrawing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PI = Math.PI;
  const W = 1260, H = 891;                     // A3 paisagem, 3 unidades por mm
  const INK = '#111', THIN = 0.7, MID = 1.1, THICK = 1.6, FONT = 'Arial, Helvetica, sans-serif';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const nf = (x, d = 2) => Number.isFinite(x) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(x) : '—';
  const f1 = x => nf(x, 1), f2 = x => nf(x, 2);
  const r2 = x => Math.round(x * 100) / 100;

  function Sheet() {
    const out = [];
    const a = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => `${k}="${typeof v === 'number' ? r2(v) : esc(v)}"`).join(' ');
    const S = {
      out,
      raw: s => out.push(s),
      line: (x1, y1, x2, y2, o = {}) => out.push(`<line ${a({ x1, y1, x2, y2, stroke: INK, 'stroke-width': o.w ?? THIN, 'stroke-dasharray': o.dash, 'stroke-linecap': 'round' })}/>`),
      rect: (x, y, w, h, o = {}) => out.push(`<rect ${a({ x, y, width: w, height: h, rx: o.rx, fill: o.fill ?? 'none', stroke: o.stroke ?? INK, 'stroke-width': o.w ?? THIN, 'stroke-dasharray': o.dash })}/>`),
      path: (d, o = {}) => out.push(`<path ${a({ d, fill: o.fill ?? 'none', stroke: o.stroke ?? INK, 'stroke-width': o.w ?? THIN, 'stroke-dasharray': o.dash, 'stroke-linejoin': o.join ?? 'round', 'stroke-linecap': 'round' })}/>`),
      circle: (cx, cy, r, o = {}) => out.push(`<circle ${a({ cx, cy, r, fill: o.fill ?? 'none', stroke: o.stroke ?? INK, 'stroke-width': o.w ?? THIN, 'stroke-dasharray': o.dash })}/>`),
      text: (x, y, t, o = {}) => out.push(`<text ${a({ x, y, 'font-family': FONT, 'font-size': o.size ?? 8.5, 'font-weight': o.bold ? 700 : 400, 'text-anchor': o.anchor ?? 'start', fill: INK, transform: o.rot ? `rotate(${o.rot} ${r2(x)} ${r2(y)})` : undefined, 'text-decoration': o.underline ? 'underline' : undefined, 'letter-spacing': o.ls })}>${esc(t)}</text>`),
      arrow(x, y, ang, size = 6) {
        const p = [[x, y], [x - size * Math.cos(ang - 0.28), y - size * Math.sin(ang - 0.28)], [x - size * Math.cos(ang + 0.28), y - size * Math.sin(ang + 0.28)]];
        out.push(`<path d="M${p.map(q => q.map(r2).join(' ')).join(' L')} Z" fill="${INK}"/>`);
      },
      // Cota alinhada entre dois pontos, deslocada "off" na normal; texto centrado.
      dim(x1, y1, x2, y2, label, off = 12, o = {}) {
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L;
        const ax = x1 + nx * off, ay = y1 + ny * off, bx = x2 + nx * off, by = y2 + ny * off;
        const ext = off === 0 ? 0 : Math.sign(off) * 3;
        if (off !== 0) { S.line(x1, y1, ax + nx * ext, ay + ny * ext, { w: 0.5 }); S.line(x2, y2, bx + nx * ext, by + ny * ext, { w: 0.5 }); }
        S.line(ax, ay, bx, by, { w: 0.5 });
        const ang = Math.atan2(by - ay, bx - ax);
        S.arrow(bx, by, ang); S.arrow(ax, ay, ang + PI);
        let rot = ang * 180 / PI; if (rot > 90 || rot <= -90) rot += 180; if (rot > 90) rot -= 360;
        const sg = Math.sign(off) || 1, ux = nx * sg, uy = ny * sg;            // lado do texto
        const t = rot * PI / 180, gx = Math.sin(t), gy = -Math.cos(t);       // "para cima" do texto girado
        const size = o.size ?? 8.5;
        const d = (gx * ux + gy * uy) > 0 ? 2 : size + 1.5;
        S.text((ax + bx) / 2 + ux * d, (ay + by) / 2 + uy * d, label, { anchor: 'middle', rot: Math.abs(rot) > 0.5 ? rot : undefined, size });
      },
      // Arco de cota angular centrado em (cx, cy) entre os ângulos a0 e a1 (rad, sentido do SVG).
      angle(cx, cy, r, a0, a1, label) {
        const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        const large = Math.abs(a1 - a0) > PI ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
        S.path(`M${r2(p0[0])} ${r2(p0[1])} A${r2(r)} ${r2(r)} 0 ${large} ${sweep} ${r2(p1[0])} ${r2(p1[1])}`, { w: 0.5 });
        S.arrow(p1[0], p1[1], a1 + (sweep ? PI / 2 : -PI / 2));
        S.arrow(p0[0], p0[1], a0 + (sweep ? -PI / 2 : PI / 2));
        const am = (a0 + a1) / 2;
        S.text(cx + (r + 9) * Math.cos(am), cy + (r + 9) * Math.sin(am) + 3, label, { anchor: 'middle' });
      },
      leader(x1, y1, x2, y2, lines, o = {}) {
        S.line(x1, y1, x2, y2, { w: 0.5 });
        const len = Math.max(...lines.map(l => l.length)) * 4.6 + 4;
        const dir = o.left ? -1 : 1;
        S.line(x2, y2, x2 + dir * len, y2, { w: 0.5 });
        S.arrow(x1, y1, Math.atan2(y1 - y2, x1 - x2), 5);
        lines.forEach((l, i) => S.text(o.left ? x2 - len : x2 + 2, y2 - 3 + i * 10 + (i ? 3 : 0), l, { bold: i === 0 && o.boldFirst }));
      },
      title(x, y, t) { S.text(x, y, t, { anchor: 'middle', size: 9.5, underline: true, ls: 0.6 }); }
    };
    return S;
  }

  // Faixa com contorno (bobina vista de cima/frente): traço preto largo + traço branco interno.
  function band(S, d, width, o = {}) {
    S.raw(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${r2(width + 2 * THIN)}" stroke-linejoin="round" stroke-linecap="${o.cap ?? 'butt'}"/>`);
    S.raw(`<path d="${d}" fill="none" stroke="#fff" stroke-width="${r2(Math.max(0.5, width - THIN))}" stroke-linejoin="round" stroke-linecap="${o.cap ?? 'butt'}"/>`);
    if (o.center) S.raw(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="0.35" stroke-dasharray="6 2 1 2" stroke-linejoin="round"/>`);
  }
  const P = (x, y) => `${r2(x)} ${r2(y)}`;

  function render(r) {
    const v = r.input, w = r.wire, k = r.coil, h = r.head, sl = r.slot;
    const S = Sheet();
    const deg = x => x * 180 / PI;
    S.raw(`<defs><pattern id="vgHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${INK}" stroke-width="0.45"/></pattern>` +
      `<pattern id="vgDots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.55" fill="${INK}"/><circle cx="4.5" cy="4.5" r="0.4" fill="${INK}"/></pattern></defs>`);
    S.rect(0, 0, W, H, { fill: '#fff', stroke: 'none' });
    S.rect(12, 12, W - 24, H - 24, { w: THICK });

    /* ---- Vista superior ------------------------------------------------------ */
    {
      const bx = 34, by = 46, bw = 440, bh = 262;
      const extL = v.retaLOL + h.LOL.ExPc, extR = v.retaLL + h.LL.ExPc;
      const total = v.pacote + extL + extR;
      const halfP = h.rMid * h.Abb;
      const sc = Math.min((bw - 60) / total, (bh - 70) / (2 * halfP + k.Lb));
      const cx = bx + bw / 2 - (total / 2) * sc, cy = by + bh / 2 + 4;
      const X = mm => cx + mm * sc, Y = mm => cy + mm * sc;
      const xs0 = h.LOL.ExPc, xs1 = total - h.LL.ExPc;     // início e fim das partes retas
      const nose = 0.5 * (h.phiC / 2 + k.Ab);              // arredondamento esquemático do nariz
      const outline = `M${P(X(xs0), Y(-halfP))} L${P(X(xs1), Y(-halfP))} L${P(X(total - nose), Y(-4))} L${P(X(total - nose), Y(4))} L${P(X(xs1), Y(halfP))} L${P(X(xs0), Y(halfP))} L${P(X(nose), Y(4))} L${P(X(nose), Y(-4))} Z`;
      band(S, outline, Math.max(3, k.Lb * sc * 1.6), { center: true });
      // pontas (lado das ligações, à direita)
      for (const s of [-1, 1]) {
        const yy = Y(s * (k.Lb * 1.4 + 8 / sc));
        S.rect(X(total) - 4, yy - 2.6, (v.distLig + 40) * sc + 16, 5.2, { w: THIN });
      }
      // núcleo
      const c0 = X(xs0 + v.retaLOL), c1 = X(xs1 - v.retaLL);
      S.line(c0, Y(-halfP) - 18, c0, Y(halfP) + 18, { dash: '8 3 2 3', w: 0.5 });
      S.line(c1, Y(-halfP) - 18, c1, Y(halfP) + 18, { dash: '8 3 2 3', w: 0.5 });
      S.text(X(total / 2) + 4, cy, `PASSO 1-${h.Pb}`, { anchor: 'middle', rot: -90, size: 9, bold: true });
      S.line(X(total / 2) - 4, Y(-halfP) + 6, X(total / 2) - 4, Y(halfP) - 6, { w: 0.5 });
      S.arrow(X(total / 2) - 4, Y(-halfP) + 4, -PI / 2); S.arrow(X(total / 2) - 4, Y(halfP) - 4, PI / 2);
      // cotas
      const top = Y(-halfP) - k.Lb * sc;
      S.dim(X(0), top, X(total), top, f1(total), -40);
      S.dim(X(xs0), top, c0, top, f1(v.retaLOL), -16);
      S.dim(c1, top, X(xs1), top, f1(v.retaLL), -16);
      const bot = Y(halfP) + k.Lb * sc;
      S.dim(X(0), bot, c0, bot, f1(extL), 18);
      S.dim(c0, bot, c1, bot, f1(v.pacote), 18);
      S.dim(c1, bot, X(total), bot, f1(extR), 18);
      // ângulo da cabeça (LOL): 2·Âsc entre os braços
      const ax = X(nose) + 4, ay = cy;
      const aUp = Math.atan2(Y(-halfP) - ay, X(xs0) - ax), aDn = Math.atan2(Y(halfP) - ay, X(xs0) - ax);
      S.angle(ax, ay, 34, aUp, aDn, `${f1(2 * deg(h.LOL.Asc))}°`);
      S.text(X(0) - 4, Y(-halfP) - 6, 'L.O.L.', { anchor: 'start', size: 7.5 });
      S.text(X(total) + 4, Y(-halfP) - 6, 'L.L.', { anchor: 'end', size: 7.5 });
      S.title(bx + bw / 2, by + bh + 18, 'VISTA SUPERIOR');
    }

    /* ---- Vista lateral --------------------------------------------------------- */
    {
      const bx = 34, by = 352, bw = 440, bh = 210;
      const extL = v.retaLOL + h.LOL.ExPc, extR = v.retaLL + h.LL.ExPc;
      const total = v.pacote + extL + extR;
      const sc = (bw - 120) / total;
      const x0 = bx + 70;
      const X = mm => x0 + mm * sc;
      const yBore = by + 128;                             // superfície do furo (núcleo acima)
      const coreTop = yBore - 30;
      const c0 = X(extL), c1 = X(extL + v.pacote);
      S.rect(c0, coreTop, c1 - c0, yBore - coreTop, { fill: 'url(#vgDots)', w: MID });
      // dedos de aperto
      const dW = Math.max(4, v.dedo * sc);
      S.rect(c0 - dW, coreTop + 6, dW, yBore - coreTop - 6, { w: THIN });
      S.rect(c1, coreTop + 6, dW, yBore - coreTop - 6, { w: THIN });
      // bobina: dois braços (topo e fundo da ranhura) e cabeças caídas em direção ao eixo
      const yA = coreTop + 8, yB = yBore - 8;             // braços dentro do núcleo
      const zL = Math.max(6, h.LOL.Z * sc * 3), zR = Math.max(6, h.LL.Z * sc * 3);
      const rHead = Math.max(10, (h.phiC / 2 + k.Ab) * sc * 1.2);
      const nL = X(0) + rHead, nR = X(total) - rHead;
      const sL = X(extL - h.LOL.ExPc * 0.15), sR = X(total - extR + h.LL.ExPc * 0.15);
      const loop = (yTop, yBot) => `M${P(sL, yTop)} L${P(sR, yTop)} C${P(sR + (nR - sR) * 0.6, yTop)} ${P(nR - 4, yTop + zR)} ${P(nR, yTop + zR)} ` +
        `A${r2((yBot - yTop) / 2)} ${r2((yBot - yTop) / 2)} 0 0 1 ${P(nR, yBot + zR)} C${P(nR - 4, yBot + zR)} ${P(sR + (nR - sR) * 0.6, yBot)} ${P(sR, yBot)} L${P(sL, yBot)} ` +
        `C${P(sL - (sL - nL) * 0.6, yBot)} ${P(nL + 4, yBot + zL)} ${P(nL, yBot + zL)} A${r2((yBot - yTop) / 2)} ${r2((yBot - yTop) / 2)} 0 0 1 ${P(nL, yTop + zL)} C${P(nL + 4, yTop + zL)} ${P(sL - (sL - nL) * 0.6, yTop)} ${P(sL, yTop)} Z`;
      band(S, loop(yA - 12, yB + 4), 8);
      // ligações (LL)
      S.rect(X(total) - 2, yA - 12 + zR - 3, (v.distLig) * sc + 30, 6, { w: THIN });
      S.rect(X(total) - 2, yA - 12 + zR + 9, (v.distLig) * sc + 30, 6, { w: THIN });
      S.dim(X(total), yA - 12 + zR - 3, X(total) + v.distLig * sc + 28, yA - 12 + zR - 3, f1(v.distLig), -14);
      S.dim(c1, coreTop + 6, c1 + dW, coreTop + 6, f1(v.dedo), -48);
      S.dim(nL - rHead - 6, yBore, nL - rHead - 6, yBore + zL, f1(v.caimLOL), 10);
      S.dim(nR + rHead + 6, yBore, nR + rHead + 6, yBore + zR, f1(v.caimLL), -10);
      S.line(nL - rHead - 12, yBore, c0, yBore, { w: 0.5, dash: '4 3' });
      S.line(c1, yBore, nR + rHead + 12, yBore, { w: 0.5, dash: '4 3' });
      // diâmetros (esquemático, fora de escala)
      const yLow = by + bh - 10;
      S.path(`M${P(c0 - 20, yLow)} L${P(c1 + 20, yLow)}`, { w: MID });
      S.rect(c0 + 20, yLow - 9, c1 - c0 - 40, 9, { fill: 'url(#vgDots)', w: THIN });
      S.dim(bx + 26, coreTop, bx + 26, yLow, `Φ${f1(v.dExt)}`, 0);
      S.dim(bx + 52, yBore, bx + 52, yLow - 9, `Φ${f1(v.dInt)}`, 0);
      S.line(bx + 20, coreTop, c0, coreTop, { w: 0.4, dash: '2 2' });
      S.line(bx + 46, yBore, c0, yBore, { w: 0.4, dash: '2 2' });
      S.line(bx + 20, yLow, c0 - 20, yLow, { w: 0.4, dash: '2 2' });
      S.line(bx + 46, yLow - 9, c0 + 20, yLow - 9, { w: 0.4, dash: '2 2' });
      S.title(bx + bw / 2, by + bh + 22, 'VISTA LATERAL');
    }

    /* ---- Vista frontal LOL --------------------------------------------------- */
    {
      const bx = 498, by = 46, bw = 270, bh = 238;
      const mirror = v.braco === 'esquerda' ? -1 : 1;
      const ox = bx - 30, oy = by + bh / 2;             // centro (eixo da máquina), à esquerda
      const half = h.Abb;                               // meio ângulo de abertura
      const r1 = Math.min(270, (bh / 2 - 12) / Math.max(0.3, Math.sin(h.Abb))), r0 = Math.max(90, r1 * 0.6);
      const pt = (rr, a) => [ox + rr * Math.cos(a), oy + mirror * rr * Math.sin(a)];
      const up = [pt(r1, -half), pt(r0 + 14, -half)], dn = [pt(r1, half), pt(r0 + 14, half)];
      const nose = pt(r0 - 4, 0);
      const ccw = h.Acc * PI / 180;
      const nx = Math.cos(ccw), ny = -mirror * Math.sin(ccw);
      const n1 = [nose[0] + nx * 10, nose[1] + ny * 10], n2 = [nose[0] - nx * 10, nose[1] - ny * 10];
      band(S, `M${P(...up[0])} L${P(...up[1])} L${P(...n1)} L${P(...n2)} L${P(...dn[1])} L${P(...dn[0])}`, 9);
      // linhas radiais e ângulo de abertura
      S.line(...pt(34, -half), ...pt(r1 + 8, -half), { w: 0.4, dash: '10 3 2 3' });
      S.line(...pt(34, half), ...pt(r1 + 8, half), { w: 0.4, dash: '10 3 2 3' });
      S.angle(ox, oy, 58, -half, half, `${f1(2 * deg(half))}°`);
      // ângulo frontal da cabeça
      S.line(nose[0] - 18, nose[1], nose[0] + 46, nose[1], { w: 0.4, dash: '3 2' });
      S.line(nose[0] - nx * 46, nose[1] - ny * 46, nose[0] + nx * 46, nose[1] + ny * 46, { w: 0.5 });
      const a0 = 0, a1 = Math.atan2(ny, nx);
      S.angle(nose[0], nose[1], 30, Math.min(a0, a1), Math.max(a0, a1), `${h.Acc}°`);
      S.leader(...pt(r1 - 16, -half * mirror), pt(r1 - 16, -half * mirror)[0] + 26, pt(r1 - 16, -half * mirror)[1] + 22, [`${v.ranhuras}`, 'ranhuras'], {});
      S.text(bx + bw - 6, by + 10, `braço superior à ${v.braco}`, { anchor: 'end', size: 7.5 });
      S.title(bx + bw / 2, by + bh + 18, 'VISTA FRONTAL L.O.L.');
    }

    /* ---- Vista das ligações -------------------------------------------------- */
    {
      const bx = 498, by = 316, bw = 270, bh = 170;
      const m = v.braco === 'esquerda' ? -1 : 1;
      const cx = bx + bw / 2;
      S.path(`M${P(bx + 6, by + 40)} Q${P(cx, by + 26)} ${P(bx + bw - 6, by + 40)} L${P(bx + bw - 6, by + 132)} Q${P(cx, by + 118)} ${P(bx + 6, by + 132)} Z`, { fill: 'url(#vgDots)', w: 0.6 });
      const sup = [cx + m * 30, by + 58], inf = [cx - m * 30, by + 96];
      S.rect(sup[0] - (m > 0 ? 0 : 92), sup[1], 92, 18, { rx: 6, fill: '#fff', w: MID });
      S.text(sup[0] + m * 46, sup[1] + 12.5, 'SUPERIOR', { anchor: 'middle', size: 8 });
      S.rect(inf[0] - (m > 0 ? 92 : 0), inf[1], 92, 18, { rx: 6, fill: '#fff', w: MID });
      S.text(inf[0] - m * 46, inf[1] + 12.5, 'INFERIOR', { anchor: 'middle', size: 8 });
      S.rect(cx - 5, by + 46, 10, 74, { fill: '#fff', w: MID });
      S.rect(cx - 5, by + 40, 10, 8, { fill: INK });
      S.rect(cx - 5, by + 118, 10, 8, { fill: INK });
      S.text(cx + 30, by + 22, String(r.pontas.invertidas), { anchor: 'middle', size: 9, bold: true });
      S.circle(cx + 30, by + 19, 10, { w: 0.6 });
      S.line(cx + 4, by + 40, cx + 22, by + 25, { w: 0.5 });
      S.text(cx + 44, by + 150, String(r.pontas.normais), { anchor: 'middle', size: 9, bold: true });
      S.circle(cx + 44, by + 147, 10, { w: 0.6 });
      S.line(cx + 4, by + 126, cx + 35, by + 142, { w: 0.5 });
      S.text(bx + 4, by + 162, 'Balões: bobinas com pontas invertidas (topo) e normais (base)', { size: 6.5 });
      S.dim(bx + 18, by + 32, bx + 18, by + 44, f1(v.caimLL), 8);
      S.title(bx + bw / 2, by + bh + 16, 'VISTA DAS LIGAÇÕES');
    }

    /* ---- Detalhe da ranhura -------------------------------------------------- */
    {
      const bx = 792, by = 46, bw = 180, bh = 420;
      const sc = Math.min((bh - 50) / v.d12, (bw - 110) / v.w12 * 3);   // altura em escala
      const scw = Math.min(sc, 70 / v.w12 * 1.0) * 1;                  // largura também em escala
      const s = Math.min(sc, scw * 1.0);
      const W12 = v.w12 * s, D12 = v.d12 * s;
      const x0 = bx + 46, y0 = by + 22;
      const cun = sl.cunha * s;
      S.path(`M${P(x0 - 6, y0)} L${P(x0 + W12 + 6, y0)} L${P(x0 + W12, y0 + cun)} L${P(x0, y0 + cun)} Z`, { fill: '#fff', w: MID });
      S.line(x0, y0 + cun, x0, y0 + D12, { w: THICK });
      S.line(x0 + W12, y0 + cun, x0 + W12, y0 + D12, { w: THICK });
      S.line(x0, y0 + D12, x0 + W12, y0 + D12, { w: THICK });
      let y = y0 + cun;
      const coilH = k.Ab * s, coilW = k.Lb * s, cxs = x0 + (W12 - coilW) / 2;
      const tags = [];
      const layer = (thk, label) => {
        S.rect(x0, y, W12, thk, { w: 0.6, fill: '#fff' });
        tags.push({ x: x0 + W12, y: y + thk / 2, lines: [`${f2(thk / s)} mm`, label] });
        y += thk;
      };
      const coil = (n) => {
        S.rect(cxs, y, coilW, coilH, { w: MID });
        const ins = sl.Aim / 2 * s;
        S.rect(cxs + ins, y + ins, coilW - 2 * ins, coilH - 2 * ins, { fill: 'url(#vgHatch)', w: 0.5 });
        tags.push({ x: x0 + W12 - 2, y: y + coilH / 2, lines: [`Bobina ${n}`] });
        S.dim(x0, y, x0, y + coilH, f2(k.Ab), 14);
        y += coilH;
      };
      layer(v.calcoTopo * s, 'Calço de topo');
      coil(1);
      layer(v.calcoMeio * s, 'Calço intermediário');
      coil(2);
      layer(v.calcoFundo * s, 'Calço de fundo');
      tags.unshift({ x: x0 + W12 + 3, y: y0 + cun / 2, lines: [`${f2(sl.cunha)} mm`, 'Cunha de fixação'] });
      let lastY = -1e9;
      for (const t of tags) {
        const ty = Math.max(t.y - 4, lastY + 24);
        S.leader(t.x, t.y, x0 + W12 + 24, ty, t.lines, {});
        lastY = ty;
      }
      S.dim(x0, y0 + cun, x0, y0 + D12, f2(v.ds), 34);
      S.dim(x0, y0 + D12, x0 + W12, y0 + D12, f2(v.w12), 14);
      S.text(bx + bw / 2 - 20, by + bh - 6, `sobras: lateral ${f2(k.sobraL)} · altura ${f2(k.sobraA)} mm`, { anchor: 'middle', size: 7 });
      S.title(bx + bw / 2 - 20, by + bh + 12, 'DETALHE DA RANHURA');
    }

    /* ---- Supressão de corona ------------------------------------------------- */
    if (r.ins.corona) {
      const c = r.ins.corona;
      const bx = 1000, by = 46, bw = 230, bh = 250;
      const xa = bx + 50, xb = bx + 170, yBase = by + 196, yKnee = by + 110;
      band(S, `M${P(xa, yBase + 20)} L${P(xa, yKnee)} L${P(xa + 120, yKnee - 92)}`, 12);
      band(S, `M${P(xb, yBase + 20)} L${P(xb, yKnee)} L${P(xb - 120, yKnee - 92)}`, 12);
      S.line(bx + 10, yBase, bx + bw - 10, yBase, { w: 0.5, dash: '6 3' });
      // fita grading na dobra e fita condutiva no trecho reto
      S.path(`M${P(xa - 6, yKnee + 8)} L${P(xa - 6, yKnee)} L${P(xa + 36, yKnee - 32)}`, { w: 2.2 });
      S.rect(xa - 6, yKnee + 8, 12, yBase - yKnee - 8, { fill: 'url(#vgHatch)', w: 0.5 });
      S.rect(xb - 6, yKnee + 8, 12, yBase - yKnee - 8, { fill: 'url(#vgHatch)', w: 0.5 });
      const xd = (xa + xb) / 2 + 22;
      S.rect(xd, yBase - 30, 12, 30, { w: 0.6 });
      S.leader(xa + 10, yKnee - 22, xa - 4, yKnee - 62, ['FITA', 'GRADING'], { left: true });
      S.text(xa + 34, yKnee - 4, `${c.grading} mm`, { rot: -45, size: 8 });
      S.leader(xb + 6, yKnee + 20, xb + 18, yKnee - 26, ['FITA', 'CONDUTIVA'], {});
      S.dim(xb + 6, yKnee + 8, xb + 6, yBase, `${f1(c.conductive)} mm`, -18);
      S.leader(xd + 2, yBase - 22, xd - 14, yBase - 50, [`${f1(v.dedo)} mm`, 'Dedo de aperto'], { left: true });
      S.leader(bx + 110, yBase + 2, bx + 110, yBase + 22, [`${f1(v.pacote)} mm`, 'Comprimento do núcleo'], {});
      S.text(bx + 4, by + bh - 8, `sobreposição da grading ${c.overlap} mm`, { size: 7 });
      S.title(bx + bw / 2, by + bh + 14, 'SUPRESSÃO DE CORONA');
    }

    /* ---- Figura A · violino -------------------------------------------------- */
    {
      const bx = 498, by = 528, bw = 470, bh = 120;
      const loops = Math.min(v.espBob, 8);
      const step = 4.2;
      const inner = Math.max(5, h.phiC / 2 * 0.35 + 3);
      const xL = bx + 40 + inner + loops * step, xR = bx + bw - 90 - inner - loops * step;
      const yc = by + 64;
      for (let i = 0; i < loops; i++) {
        const rr = inner + i * step;
        S.path(`M${P(xL, yc - rr)} L${P(xR, yc - rr)} A${r2(rr)} ${r2(rr)} 0 0 1 ${P(xR, yc + rr)} L${P(xL, yc + rr)} A${r2(rr)} ${r2(rr)} 0 0 1 ${P(xL, yc - rr)} Z`, { w: 0.55 });
      }
      S.circle(xL, yc, inner - 1.5, { w: 0.7 }); S.circle(xR, yc, inner - 1.5, { w: 0.7 });
      S.line(xL - inner - loops * step - 6, yc, xR + inner + loops * step + 6, yc, { w: 0.35, dash: '10 3 2 3' });
      for (const t of [0.22, 0.5, 0.78]) {
        const xx = xL + (xR - xL) * t;
        for (const s2 of [-1, 1]) S.rect(xx - 9, yc + s2 * (inner + (loops - 1) * step / 2) - (loops * step) / 2 - 2, 18, loops * step + 4, { fill: '#fff', w: 0.7 });
      }
      const outR = inner + (loops - 1) * step;
      S.line(xR, yc - outR, xR + outR + 70, yc - outR, { w: 0.6 });
      S.line(xR, yc - outR + 7, xR + outR + 70, yc - outR + 7, { w: 0.6 });
      S.dim(xL - inner + 1.5, yc, xR + inner - 1.5, yc, f1(h.Cv), -(outR + 22));
      S.leader(xL - 2, yc - 2, xL + 40, yc - outR - 10, [`Φ${f1(h.phiC)} mm`], {});
      S.title(bx + bw / 2, by + bh + 12, 'FIGURA A · VIOLINO');
    }

    /* ---- Figuras B, C e D ---------------------------------------------------- */
    {
      const by = 610, bh = 210;
      // B · fio nu
      {
        const bx = 34;
        const s = Math.min(70 / w.Lf, 40 / w.Af);
        const x0 = bx + 26, y0 = by + 70;
        S.rect(x0, y0, w.Lf * s, w.Af * s, { rx: Math.min(4, w.r * s), w: MID });
        S.dim(x0, y0, x0 + w.Lf * s, y0, f2(w.Lf), -12);
        S.dim(x0, y0, x0, y0 + w.Af * s, f2(w.Af), 12);
        S.text(x0 + w.Lf * s / 2, y0 + w.Af * s + 16, `r = ${f2(w.r)} mm`, { anchor: 'middle', size: 7.5 });
        S.text(x0 + w.Lf * s / 2, by + bh - 24, 'FIGURA B', { anchor: 'middle', size: 7.5, underline: true });
        S.title(x0 + w.Lf * s / 2, by + bh - 10, 'FIO DE COBRE NU');
      }
      const grid = (bx, final) => {
        const rows = w.Fa * v.espBob, cols = w.Fl;
        const Wt = final ? k.Lb : k.Lbi, Ht = final ? k.Ab : k.Aib;
        const s = Math.min(128 / Ht, 90 / Wt);
        const x0 = bx + 34, y0 = by + 22;
        const off = final ? (sl.Aim + sl.Aa + sl.Afc) / 2 : 0;
        if (final) S.rect(x0, y0, Wt * s, Ht * s, { w: MID });
        const gx = x0 + off * s, gy = y0 + off * s;
        const aie = sl.Aie;
        // altura útil de cada fio isolado e pequeno passo para o isolamento entre espiras (traço-ponto)
        const cellH = (w.Af + sl.Aif) * s, cellW = (w.Lf + sl.Aif) * s;
        const gap = aie * s;
        S.rect(gx, gy, cols * cellW + gap, rows * cellH + gap, { w: 0.6 });
        let yy = gy + gap / 2;
        for (let t = 0; t < v.espBob; t++) {
          for (let j = 0; j < w.Fa; j++) {
            for (let i = 0; i < cols; i++) {
              const xx = gx + gap / 2 + i * cellW;
              S.rect(xx, yy, cellW, cellH, { w: 0.35 });
              S.rect(xx + sl.Aif / 2 * s, yy + sl.Aif / 2 * s, w.Lf * s, w.Af * s, { w: 0.5 });
            }
            yy += cellH;
          }
          if (aie > 0 && t < v.espBob - 1) S.line(gx, yy, gx + cols * cellW + gap, yy, { w: 0.4, dash: '6 2 1 2' });
        }
        S.dim(x0, y0, x0 + Wt * s, y0, f2(Wt), -10);
        S.dim(x0 + Wt * s, y0, x0 + Wt * s, y0 + Ht * s, f2(Ht), -12);
        const thick = final ? (sl.Aim + sl.Aa + sl.Afc) / 2 : sl.Aif / 2;
        S.text(x0 - 4, y0 + Ht * s + 12, f2(thick), { size: 8 });
        S.line(x0, y0 + Ht * s + 2, x0, y0 + Ht * s + 6, { w: 0.4 });
        const lab = final ? (v.isoMassa ? `Instrução de isolamento ${v.isoMassa}` : `Isolamento para a massa ${f2(sl.Aim)} mm`) : (v.isoFio ? `Fio ${v.isoFio}` : `Isolamento do fio ${f2(sl.Aif)} mm`);
        S.text(x0 + Wt * s / 2, y0 + Ht * s + 22, lab, { anchor: 'middle', size: 7 });
        S.text(x0 + Wt * s / 2, by + bh - 24, final ? 'FIGURA D' : 'FIGURA C', { anchor: 'middle', size: 7.5, underline: true });
        S.title(x0 + Wt * s / 2, by + bh - 10, final ? 'ISOLAMENTO TERRA' : 'ISOLAMENTO CONDUTORES');
      };
      S.line(150, by + 4, 150, by + bh - 4, { w: 0.4 });
      grid(160, false);
      S.line(320, by + 4, 320, by + bh - 4, { w: 0.4 });
      grid(330, true);
    }

    /* ---- Quadro de dados ------------------------------------------------------ */
    {
      const bx = 1012, by = 344, cw = [134, 92], rh = 15.5;
      const rows = [
        ['RESISTÊNCIA ÔHMICA', `${f1(r.res.Rb)} mΩ`],
        ['TENSÃO DE SURGE TEST', `${nf(r.ins.Vsb, 0)} V`],
        ['PESO DO COBRE DA BOBINA', `${f2(r.copper.Mcb)} kg`],
        ['COMPRIMENTO MÉDIO ESPIRA', `${f1(r.lengths.Cme)} mm`],
        ['NÚMERO ESPIRAS BOBINA', String(v.espBob)],
        ['NÚMERO DE FIOS POR ESPIRA', `${w.n} (${w.Fl} na larg. / ${w.Fa} na alt.)`],
        ['FIO NU (LARG. × ALT.)', `${f2(w.Lf)} × ${f2(w.Af)} mm`],
        ['ISOLAMENTO ENTRE ESPIRAS', sl.Aie > 0 ? `${f2(sl.Aie)} mm` : 'Nenhum'],
        ['BOBINA TEM TRANSPOSIÇÃO?', 'Não'],
        ['RANHURA TEM SKEW?', v.skew > 0 ? 'Sim' : 'Não'],
        ['QUANTIDADE DE BOBINAS', `${v.ranhuras} + ${r.copper.reel ? r.copper.reel.coils - v.ranhuras : v.reserva || 0} reserva`],
        ['PONTAS NORMAIS / INVERTIDAS', `${r.pontas.normais} / ${r.pontas.invertidas}`]
      ];
      S.rect(bx, by, cw[0] + cw[1], rh * (rows.length + 1), { w: MID });
      S.text(bx + (cw[0] + cw[1]) / 2, by + 11, 'DADOS DA BOBINA', { anchor: 'middle', size: 8.5, bold: true });
      rows.forEach(([a2, b2], i) => {
        const y = by + rh * (i + 1);
        S.line(bx, y, bx + cw[0] + cw[1], y, { w: 0.5 });
        S.text(bx + 4, y + 11, a2, { size: 7.2 });
        S.text(bx + cw[0] + 4, y + 11, b2, { size: 7.2 });
      });
      S.line(bx + cw[0], by + rh, bx + cw[0], by + rh * (rows.length + 1), { w: 0.5 });
      const ny = by + rh * (rows.length + 1) + 16;
      S.text(bx, ny, 'NOTAS:', { size: 7.5, bold: true });
      ['1. Desenho esquemático. Cotas em mm.', '2. Cálculo conforme Design de Bobinas rev. 00.', `3. Passo da bobina 1-${h.Pb}; ${v.ranhuras} ranhuras; ${v.polos} polos.`,
        `4. Bobina isolada ${f2(k.Lb)} × ${f2(k.Ab)} mm.`].forEach((t, i) => S.text(bx, ny + 11 * (i + 1), t, { size: 7.2 }));
    }

    /* ---- Carimbo ------------------------------------------------------------- */
    {
      const x0 = 790, y0 = 780, x1 = W - 12, y1 = H - 12;
      const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
      const equip = v.equipamento || `${r.current.isGen ? 'GERADOR' : 'MOTOR'} ${nf(r.current.isGen ? r.current.S : v.potencia, 0)} ${r.current.isGen ? 'kVA' : 'kW'} ${nf(v.tensao, 0)} V ${v.polos}P`;
      S.rect(x0, y0, x1 - x0, y1 - y0, { w: MID });
      const col = [x0, x0 + 96, x0 + 300, x1 - 64, x1];
      const rows = [y0, y0 + 20, y0 + 40, y0 + 58, y0 + 79, y1];
      rows.slice(1, -1).forEach(y => S.line(x0 + (y === rows[1] || y === rows[2] ? 96 : 0), y, x1, y, { w: 0.5 }));
      S.line(col[1], y0, col[1], rows[3], { w: 0.5 });
      S.text(x0 + 48, y0 + 22, 'VG.', { anchor: 'middle', size: 18, bold: true });
      S.text(x0 + 48, y0 + 33, 'Laboratório elétrico', { anchor: 'middle', size: 6 });
      const cell = (x, y, label, value, o = {}) => { S.text(x + 3, y + 7, label, { size: 5.6 }); S.text(o.center ? x + (o.w || 0) / 2 : x + 8, y + 16.5, value, { size: o.size ?? 8.5, bold: o.bold, anchor: o.center ? 'middle' : 'start' }); };
      cell(col[1], y0, 'CLIENTE :', v.cliente || '—');
      S.line(col[3], y0 + 20, col[3], y0 + 40, { w: 0.5 });
      cell(col[1], y0 + 20, 'EQUIPAMENTO :', equip);
      cell(col[3], y0 + 20, 'O.S. :', v.os || '—');
      cell(x0, y0 + 40, 'TÍTULO :', 'DESENHO DA BOBINA DO ESTATOR', { center: true, w: x1 - x0, bold: true, size: 9 });
      const c4 = [x0, x0 + 110, x0 + 220, x0 + 330, x1];
      c4.slice(1, -1).forEach(x => S.line(x, rows[3], x, rows[4], { w: 0.5 }));
      cell(c4[0], rows[3], 'ELABORADO :', v.elaborado || '—', { size: 7.5 });
      cell(c4[1], rows[3], 'MÉTODO :', 'Design de Bobinas r00', { size: 7.5 });
      cell(c4[2], rows[3], 'TIPO DE DESENHO :', 'FABRICAÇÃO', { size: 7.5 });
      cell(c4[3], rows[3], 'DATA :', today, { size: 7.5 });
      const c5 = [x0, x0 + 60, x1 - 120, x1 - 60, x1];
      c5.slice(1, -1).forEach(x => S.line(x, rows[4], x, y1, { w: 0.5 }));
      cell(c5[0], rows[4], 'ESCALA / FORMATO :', 'S/E · A3', { size: 8 });
      cell(c5[1], rows[4], 'DESENHO Nº :', `DM-${v.os || 'XXXXX'}-BOB-001`, { size: 9, bold: true });
      cell(c5[2], rows[4], 'REVISÃO :', '00', { size: 8 });
      cell(c5[3], rows[4], 'FOLHA :', '1/1', { size: 8 });
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">${S.out.join('')}</svg>`;
  }

  return { render, WIDTH: W, HEIGHT: H };
});
