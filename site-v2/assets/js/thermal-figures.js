/* Laboratório térmico · gráficos: perfil de temperaturas no trocador e vazão de água × área mínima.
   Marcas finas (linha de 2 px, pontos com anel na cor do fundo), grade discreta, rótulos em tinta de texto. */
(() => {
  'use strict';
  const fx = (v, d = 1) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  function niceStep(range, target = 5) {
    const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }

  /* ---- Perfil de temperaturas (contracorrente equivalente) ------------------------- */
  const PF = { W: 440, H: 238, x0: 40, x1: 402, y0: 14, y1: 194 };
  function profilePoints(r) {
    const Th = r.Th, Tc = r.Tc, Two = r.waterOut;
    const th0 = Th - Two, th1 = Tc - r.d.waterIn;
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const x = i / 60;
      let th, ta;
      if (Math.abs(th0 - th1) < 1e-6 || th0 <= 0 || th1 <= 0) { th = th0 + (th1 - th0) * x; ta = Th + (Tc - Th) * x; }
      else { th = th0 * Math.pow(th1 / th0, x); ta = Th - (Th - Tc) * (th0 - th) / (th0 - th1); }
      pts.push({ x, ta, tw: ta - th });
    }
    return pts;
  }
  function profileSVG(r) {
    if (!(Number.isFinite(r.Th) && Number.isFinite(r.waterOut) && r.Th > r.Tc)) return null;
    const pts = profilePoints(r);
    const lo = Math.min(r.d.waterIn, r.Tc) - 1, hi = Math.max(r.Th, r.waterOut) + 1;
    const step = niceStep(hi - lo);
    const yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step;
    const X = x => PF.x0 + x * (PF.x1 - PF.x0);
    const Y = t => PF.y1 - (t - yMin) / (yMax - yMin) * (PF.y1 - PF.y0);
    let s = '';
    for (let t = yMin; t <= yMax + 1e-9; t += step) {
      s += `<line class="pf-grid" x1="${PF.x0}" x2="${PF.x1}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>`;
      s += `<text class="pf-axis" x="${PF.x0 - 6}" y="${(Y(t) + 3).toFixed(1)}" text-anchor="end">${fx(t, step < 1 ? 1 : 0)}</text>`;
    }
    const air = pts.map(p => P(X(p.x), Y(p.ta))).join(' ');
    const water = pts.map(p => P(X(p.x), Y(p.tw))).join(' ');
    const band = air + ' ' + pts.slice().reverse().map(p => P(X(p.x), Y(p.tw))).join(' ');
    s += `<polygon class="pf-band" points="${band}"/>`;
    s += `<polyline class="pf-air" points="${air}"/>`;
    s += `<polyline class="pf-water" points="${water}"/>`;
    const a0 = pts[0], a1 = pts[pts.length - 1];
    for (const [cx, cy, cls] of [[X(0), Y(a0.ta), 'pf-end-air'], [X(1), Y(a1.ta), 'pf-end-air'], [X(0), Y(a0.tw), 'pf-end-water'], [X(1), Y(a1.tw), 'pf-end-water']])
      s += `<circle class="${cls}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5"/>`;
    s += `<text class="pf-lab" x="${X(0) + 8}" y="${(Y(a0.ta) - 8).toFixed(1)}">ar ${fx(a0.ta)} °C</text>`;
    s += `<text class="pf-lab" x="${X(1) + 7}" y="${(Y(a1.ta) + 4).toFixed(1)}">${fx(a1.ta)}</text>`;
    s += `<text class="pf-lab" x="${X(0) + 8}" y="${(Y(a0.tw) + 16).toFixed(1)}">água ${fx(a0.tw)} °C</text>`;
    s += `<text class="pf-lab" x="${X(1) + 7}" y="${(Y(a1.tw) + 4).toFixed(1)}">${fx(a1.tw)}</text>`;
    s += `<text class="pf-axis" x="${PF.x0}" y="${PF.y1 + 16}">entrada do ar</text>`;
    s += `<text class="pf-axis" x="${PF.x1}" y="${PF.y1 + 16}" text-anchor="end">saída do ar →</text>`;
    s += `<text class="pf-axis" x="${(PF.x0 + PF.x1) / 2}" y="${PF.y1 + 32}" text-anchor="middle">posição no sentido do ar · água em contracorrente</text>`;
    s += `<line class="pf-cross" x1="0" x2="0" y1="${PF.y0}" y2="${PF.y1}" visibility="hidden"/>`;
    s += `<circle class="pf-dot-air" r="4.5" cx="0" cy="0" visibility="hidden"/>`;
    s += `<circle class="pf-dot-water" r="4.5" cx="0" cy="0" visibility="hidden"/>`;
    const label = `Perfil de temperaturas: ar de ${fx(r.Th)} a ${fx(r.Tc)} °C, água de ${fx(r.d.waterIn)} a ${fx(r.waterOut)} °C.`;
    return { svg: `<svg class="pf" viewBox="0 0 ${PF.W} ${PF.H}" role="img" aria-label="${esc(label)}">${s}</svg>`, pts, X, Y };
  }

  /* ---- Vazão de água × área mínima --------------------------------------------------- */
  const FC = { W: 640, H: 270, x0: 54, x1: 618, y0: 26, y1: 222 };
  function flowSVG(pts, o) {
    if (!pts || pts.length < 3) return null;
    const qMax = Math.max(o.qMax, ...pts.map(p => p.q));
    const xStep = niceStep(qMax, 6), xMax = Math.ceil(qMax / xStep) * xStep;
    const yCap = Math.max(o.A0 * 2.2, Math.min(...pts.map(p => p.A)) * 1.4);
    const yStep = niceStep(yCap, 5), yMax = Math.ceil(yCap / yStep) * yStep;
    const X = q => FC.x0 + q / xMax * (FC.x1 - FC.x0);
    const Xinv = x => (x - FC.x0) / (FC.x1 - FC.x0) * xMax;
    const Y = A => FC.y1 - A / yMax * (FC.y1 - FC.y0);
    let s = '';
    for (let a = 0; a <= yMax + 1e-9; a += yStep) {
      s += `<line class="pf-grid" x1="${FC.x0}" x2="${FC.x1}" y1="${Y(a).toFixed(1)}" y2="${Y(a).toFixed(1)}"/>`;
      s += `<text class="pf-axis" x="${FC.x0 - 6}" y="${(Y(a) + 3).toFixed(1)}" text-anchor="end">${fx(a, 0)}</text>`;
    }
    for (let q = 0; q <= xMax + 1e-9; q += xStep) s += `<text class="pf-axis" x="${X(q).toFixed(1)}" y="${FC.y1 + 15}" text-anchor="middle">${fx(q, xStep < 1 ? 1 : 0)}</text>`;
    s += `<line class="fc-base" x1="${FC.x0}" x2="${FC.x1}" y1="${FC.y1}" y2="${FC.y1}"/>`;
    // região sem solução
    const xm = X(o.qMin);
    s += `<rect class="fc-void" x="${FC.x0}" y="${FC.y0}" width="${(xm - FC.x0).toFixed(1)}" height="${FC.y1 - FC.y0}"/>`;
    s += `<line class="fc-limit" x1="${xm.toFixed(1)}" x2="${xm.toFixed(1)}" y1="${FC.y0}" y2="${FC.y1}"/>`;
    if (xm - FC.x0 > 70) s += `<text class="pf-axis fc-void-t" x="${((FC.x0 + xm) / 2).toFixed(1)}" y="${(FC.y0 + 14).toFixed(1)}" text-anchor="middle">sem solução</text>`;
    s += `<text class="pf-axis" x="${(xm + 5).toFixed(1)}" y="${(FC.y1 - 6).toFixed(1)}">mín. ${fx(o.qMin, 1)}</text>`;
    // curva (recortada no topo)
    const id = 'fc' + Math.random().toString(36).slice(2, 8);
    s += `<defs><clipPath id="${id}"><rect x="${FC.x0}" y="${FC.y0 - 2}" width="${FC.x1 - FC.x0}" height="${FC.y1 - FC.y0 + 4}"/></clipPath></defs>`;
    s += `<polyline class="fc-line" clip-path="url(#${id})" points="${pts.map(p => P(X(p.q), Y(p.A))).join(' ')}"/>`;
    const cur = pts.find(p => p.cur);
    if (cur) {
      const cx = X(cur.q), cy = Y(cur.A);
      s += `<line class="fc-guide" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" y2="${FC.y1}"/>`;
      s += `<circle class="fc-cur" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5"/>`;
      const right = cx < FC.x1 - 170;
      s += `<text class="pf-lab" x="${(cx + (right ? 10 : -10)).toFixed(1)}" y="${(cy - 10).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">seu caso: ${fx(cur.q, 2)} m³/h → ${fx(cur.A, 0)} m²</text>`;
    }
    s += `<text class="pf-axis" x="${FC.x0}" y="${FC.y0 - 12}">área mínima (m²)</text>`;
    s += `<text class="pf-axis" x="${FC.x1}" y="${FC.y1 + 34}" text-anchor="end">vazão de água (m³/h)</text>`;
    s += `<line class="pf-cross" x1="0" x2="0" y1="${FC.y0}" y2="${FC.y1}" visibility="hidden"/>`;
    s += `<circle class="fc-hover" r="4.5" cx="0" cy="0" visibility="hidden"/>`;
    const label = `Área mínima em função da vazão de água. Seu caso: ${fx(o.q0, 2)} m³/h e ${fx(o.A0, 0)} m². Mínimo viável ${fx(o.qMin, 1)} m³/h.`;
    return { svg: `<svg class="pf fc" viewBox="0 0 ${FC.W} ${FC.H}" role="img" aria-label="${esc(label)}">${s}</svg>`, pts, X, Xinv, Y, yMax, W: FC.W, H: FC.H };
  }

  window.VGThermalFigures = { profileSVG, profilePoints, flowSVG, PF, FC };
})();
