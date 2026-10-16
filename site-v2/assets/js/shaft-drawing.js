/* Laboratório de eixos · folha A3 de triagem (SVG em texto puro, tinta preta).
   Eixo em proporção real com balões dos trechos, cotas principais, diagramas de momento e flecha alinhados,
   tabela dos trechos, quadro de resultados, notas e o mesmo carimbo dos outros laboratórios. */
(() => {
  'use strict';
  const figs = window.VGShaftFigures;
  const isNum = Number.isFinite;
  const nfc = new Map();
  const fmt = (v, d = 1) => {
    if (!isNum(v)) return v === Infinity ? '∞' : '—';
    if (!nfc.has(d)) nfc.set(d, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
    return nfc.get(d).format(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v);
  };
  const f0 = v => fmt(v, 0);
  const fsf = v => v === Infinity || v > 999 ? '>999' : fmt(v, 2);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const r2 = x => Math.round(x * 100) / 100;

  const PAPER_CSS = `
.sxs text{font-family:Arial,Helvetica,sans-serif;fill:#111}
.sxs .sx-t{font-size:7.4px}.sxs .sx-t2{font-size:6.8px;fill:#333}.sxs .sx-strong{font-weight:700}
.sxs .sx-sec{fill:#ececec;stroke:none}.sxs .sx-sec.is-warn{fill:#dcdcdc}.sxs .sx-sec.is-fail{fill:#bdbdbd}
.sxs .sx-outline{fill:none;stroke:#111;stroke-width:.9;stroke-linejoin:round}.sxs .sx-joint{stroke:#111;stroke-width:.4}
.sxs .sx-center{stroke:#111;stroke-width:.35;stroke-dasharray:10 2 2 2}.sxs .sx-hidden{stroke:#111;stroke-width:.4;stroke-dasharray:3 2}
.sxs .sx-flat{fill:none;stroke:#111;stroke-width:.35}
.sxs .sx-core{fill:none;stroke:#111;stroke-width:.5;stroke-dasharray:5 2}
.sxs .sx-brg-shell{fill:#fff;stroke:#111;stroke-width:.5}.sxs .sx-hatch{stroke:#111;stroke-width:.3}.sxs .sx-axisline{stroke:#111;stroke-width:.35;stroke-dasharray:6 2 1.5 2}
.sxs .sx-force,.sxs .sx-mag,.sxs .sx-react{stroke:#111;stroke-width:.8}.sxs .sx-force-h,.sxs .sx-mag-h,.sxs .sx-react-h{fill:#111}
.sxs .sx-force.sx-mag-h,.sxs .sx-force.sx-react-h{fill:#111}
.sxs .sx-torque{fill:none;stroke:#111;stroke-width:.7}.sxs .sx-torque-h{fill:#111}
.sxs .sx-dmin{fill:none;stroke:#111;stroke-width:.55;stroke-dasharray:3 2}.sxs .sx-dmin.is-over{stroke-width:1.3;stroke-dasharray:none}
.sxs .sx-brg-mark{fill:#111}`;

  // espalha balões numa linha sem sobreposição, perto do x ideal
  function spread(ideal, lo, hi, gap) {
    const n = ideal.length, x = ideal.slice();
    for (let it = 0; it < 200; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) x[i] = Math.min(hi, Math.max(lo, x[i]));
      for (let i = 1; i < n; i++) {
        const ov = gap - (x[i] - x[i - 1]);
        if (ov > 0.01) { x[i - 1] -= ov / 2; x[i] += ov / 2; moved = true; }
      }
      if (!moved) break;
    }
    // garante a ordem e os limites
    for (let i = 1; i < n; i++) x[i] = Math.max(x[i], x[i - 1] + gap);
    const over = x[n - 1] - hi;
    if (over > 0) for (let i = n - 1; i >= 0; i--) { x[i] -= over; if (i && x[i] - x[i - 1] >= gap) break; }
    return x;
  }

  function sheet(r, info = {}) {
    const W = 1260, H = 891, d = r.d, R = r.res, out = [];
    const raw = s => out.push(s);
    const L = (x1, y1, x2, y2, w = 0.6, dash) => raw(`<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="#111" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
    const Rc = (x, y, w, h, sw = 0.6, fill = 'none') => raw(`<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${fill}" stroke="#111" stroke-width="${sw}"/>`);
    const Tx = (x, y, t, o = {}) => raw(`<text x="${r2(x)}" y="${r2(y)}" font-family="Arial, Helvetica, sans-serif" font-size="${o.size ?? 7.4}" font-weight="${o.bold ? 700 : 400}" text-anchor="${o.anchor || 'start'}"${o.rot ? ` transform="rotate(${o.rot} ${r2(x)} ${r2(y)})"` : ''} fill="#111">${esc(t)}</text>`);
    const head = (x, y, ang, s = 5.5) => { const a = 0.4; raw(`<path d="M${r2(x)} ${r2(y)} L${r2(x - s * Math.cos(ang - a))} ${r2(y - s * Math.sin(ang - a))} L${r2(x - s * Math.cos(ang + a))} ${r2(y - s * Math.sin(ang + a))} Z" fill="#111"/>`); };
    const dimH = (x1, x2, y, label, from) => {
      if (isNum(from)) { L(x1, from + 2, x1, y + 3, 0.4); L(x2, from + 2, x2, y + 3, 0.4); }
      L(x1, y, x2, y, 0.4); head(x1, y, Math.PI); head(x2, y, 0);
      const w = label.length * 4.3;
      if (x2 - x1 > w + 12) Tx((x1 + x2) / 2, y - 3, label, { anchor: 'middle', size: 7.2 });
      else Tx(x2 + 4, y + 2.5, label, { size: 7.2 });
    };
    const fit = (t, w, size, upper = false) => { const n = Math.floor(w / (size * (upper ? 0.66 : 0.52))); t = String(t); return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t; };
    raw(`<rect width="${W}" height="${H}" fill="#fff"/>`);
    Rc(12, 12, W - 24, H - 24, 1.6);

    /* eixo em proporção real */
    const x0 = 70, x1 = 1200, k = (x1 - x0) / d.L, X = x => x0 + x * k;
    const rmax = Math.max(...R.map(s => s.d)) / 2;
    const cy = 112 + rmax * k;
    raw(`<g class="sxs-shaft">${figs.profile(r, { X, cy, k, paper: true, loads: true, dmin: true, labels: true })}</g>`);
    Tx(x0 - 46, 30, 'EIXO — VISTA LATERAL (PROPORÇÃO REAL)', { bold: true, size: 8.6 });
    // balões dos trechos
    const by = 56, br = 8.2;
    const ideal = R.map(s => X((s.a + s.b) / 2));
    const bx = spread(ideal, x0 - 30, x1 + 20, 2 * br + 3.5);
    R.forEach((s, i) => {
      const tx = ideal[i], ty = cy - s.d / 2 * k - 1.5;
      const dx = bx[i] - tx, dy = by - ty, len = Math.hypot(dx, dy) || 1;
      L(tx, ty, bx[i] - dx / len * br, by - dy / len * br, 0.35);
      raw(`<circle cx="${r2(tx)}" cy="${r2(ty)}" r="1.3" fill="#111"/>`);
      raw(`<circle cx="${r2(bx[i])}" cy="${by}" r="${br}" fill="#fff" stroke="#111" stroke-width="${s.ok ? 0.6 : 1.4}"/>`);
      Tx(bx[i], by + 2.6, s.code.replace(/^S/, ''), { anchor: 'middle', size: 6.8, bold: true });
    });
    // cotas: mancais, rotor e total
    const yb = cy + rmax * k + 62;
    const ext = cy + 6;
    dimH(X(0), X(d.xA), yb, fmt(d.xA, 1), ext);
    dimH(X(d.xA), X(d.xB), yb, `${fmt(d.xB - d.xA, 1)} (VÃO)`, ext);
    dimH(X(d.xB), X(d.L), yb, fmt(d.L - d.xB, 1), ext);
    if (d.rotorMass > 0) dimH(X(d.rotorFrom), X(d.rotorTo), yb + 20, `${fmt(d.rotorTo - d.rotorFrom, 1)} (ROTOR, DE ${fmt(d.rotorFrom, 1)})`, ext);
    dimH(X(0), X(d.L), yb + 40, fmt(d.L, 1), ext);

    /* diagramas alinhados */
    const S = figs.series(r);
    const plot = (arr, top, h, title, unit, dec, opt = {}) => {
      let lo = 0, hi = 0;
      for (const [, v] of arr) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (hi - lo < 1e-12) hi = lo + 1;
      const Y = v => top + h - (v - lo) / (hi - lo) * h;
      Tx(x0 - 46, top - 15, `${title} (${unit})`, { bold: true, size: 7.6 });
      L(x0, Y(0), x1, Y(0), 0.5);
      for (const b of r.bearings) L(X(b.x), top - 2, X(b.x), top + h + 2, 0.3, '4 2');
      const pts = arr.map(([x, v]) => `${r2(X(x))},${r2(Y(v))}`).join(' ');
      if (opt.fill) raw(`<polygon points="${r2(X(arr[0][0]))},${r2(Y(0))} ${pts} ${r2(X(arr[arr.length - 1][0]))},${r2(Y(0))}" fill="#e6e6e6" stroke="none"/>`);
      raw(`<polyline points="${pts}" fill="none" stroke="#111" stroke-width="0.9" stroke-linejoin="round"/>`);
      const marks = opt.marks || [];
      if (!marks.length) { let ib = 0; arr.forEach(([, v], i) => { if (Math.abs(v) > Math.abs(arr[ib][1])) ib = i; }); marks.push(arr[ib]); }
      for (const [x, v] of marks) {
        raw(`<circle cx="${r2(X(x))}" cy="${r2(Y(v))}" r="1.8" fill="#111"/>`);
        Tx(X(x) + (X(x) > x1 - 90 ? -4 : 4), Y(v) + (v >= 0 ? -4 : 9), fmt(v, dec), { size: 7, bold: true, anchor: X(x) > x1 - 90 ? 'end' : 'start' });
      }
      Tx(x0 - 6, Y(hi) + 3, fmt(hi, dec), { anchor: 'end', size: 6.2 });
      Tx(x0 - 6, Y(lo) + 3, fmt(lo, dec), { anchor: 'end', size: 6.2 });
    };
    const dTop = yb + 74;
    plot(S.m, dTop, 66, 'MOMENTO FLETOR', 'kN·m', 2, { fill: true });
    const iy = r.mesh.indexOf(r.defl.xspan);
    plot(S.y, dTop + 100, 58, 'FLECHA', 'mm', 3, { marks: [[r.defl.xspan, r.y[iy >= 0 ? iy : 0]], [r.defl.xmax, r.defl.ymax]] });

    /* tabela dos trechos */
    const ty0 = 548, tx0 = 18, rh = 11.4;
    const cols = [['ITEM', 30], ['DESCRIÇÃO', 132], ['x (mm)', 78], ['Ø EXT.', 44], ['Ø INT.', 36], ['Kt / Kf', 46], ['M (kN·m)', 48], ['T (kN·m)', 46], ['SF ESC.', 40], ['SF FAD.', 40], ['Ø MÍN.', 44], ['SITUAÇÃO', 56]];
    const tw = cols.reduce((a, c) => a + c[1], 0);
    const nR = R.length, th = rh * (nR + 2);
    Rc(tx0, ty0, tw, th, 1.1);
    Tx(tx0 + tw / 2, ty0 + 8.6, 'TRECHOS DO EIXO · COEFICIENTES PELA FÓRMULA SIMPLIFICADA', { anchor: 'middle', bold: true, size: 7.8 });
    L(tx0, ty0 + rh, tx0 + tw, ty0 + rh, 0.6);
    let cx = tx0;
    const cxs = cols.map(([, w]) => { const a = cx; cx += w; return a; });
    cols.forEach(([t], j) => Tx(cxs[j] + 3, ty0 + rh + 8.2, t, { bold: true, size: 6 }));
    L(tx0, ty0 + 2 * rh, tx0 + tw, ty0 + 2 * rh, 0.5);
    R.forEach((s, i) => {
      const y = ty0 + rh * (i + 2);
      if (i) L(tx0, y, tx0 + tw, y, 0.25);
      const cells = [s.code, s.name.replace(s.code, '').trim().toUpperCase(), `${fmt(s.a, 1)}–${fmt(s.b, 1)}`, fmt(s.d, 2), s.di ? fmt(s.di, 1) : '—', `${fmt(s.kt, 1)} / ${fmt(s.kf, 1)}`, fmt(s.m / 1e6, 2), fmt(s.torque / 1000, 2), fsf(s.sfy), fsf(s.sff), fmt(s.dmin, 1), s.ok ? 'ATINGE' : 'ABAIXO'];
      cells.forEach((c, j) => Tx(cxs[j] + 3, y + 8.3, fit(c, cols[j][1] - 5, 6.1, j === 1), { size: 6.1, bold: j === 0 || (!s.ok && (j === 11 || (j === 8 && s.sfy < d.sfY) || (j === 9 && s.sff < d.sfF))) }));
    });
    cxs.slice(1).forEach(x => L(x, ty0 + rh, x, ty0 + th, 0.3));

    /* quadro de resultados */
    const qx = tx0 + tw + 12, qw = W - 12 - 10 - qx, qy = 548, qh = 12;
    const D = r.dyn && r.dyn.design && r.dyn.design.ok ? r.dyn.design : null;
    const rows = [
      ['POTÊNCIA NO EIXO · ROTAÇÃO', `${fmt(r.Pshaft, 1)} kW · ${f0(d.speed)} rpm`],
      ['TORQUE NOMINAL · PICO', `${fmt(r.T / 1000, 2)} · ${fmt(r.Tpk / 1000, 2)} kN·m (${fmt(d.peak, 1)} ×)`],
      ['MATERIAL', `${d.material === 'custom' ? 'personalizado' : d.material} · Su ${f0(d.su)} · Sy ${f0(d.sy)} MPa`],
      ['FADIGA · MÍNIMOS', `${({ goodman: 'Goodman', gerber: 'Gerber', asme: 'ASME elíptico', soderberg: 'Soderberg' })[d.fatigue]} · Se ${d.seMode === 'marin' ? 'Marin' : f0(d.se) + ' MPa'} · SF ${fmt(d.sfY, 1)} / ${fmt(d.sfF, 1)}`],
      ['REAÇÕES A · B', `${fmt(r.RA / 1000, 2)} · ${fmt(r.RB / 1000, 2)} kN`],
      ['MASSA EIXO + ROTOR', `${f0(r.mass.shaft)} + ${f0(r.mass.rotor)} = ${f0(r.mass.total)} kg · CG ${f0(r.mass.cg)} mm`],
      ['MOMENTO MÁXIMO', `${fmt(Math.abs(r.Mmax.v) / 1e6, 2)} kN·m em x = ${fmt(r.Mmax.x, 1)} mm`],
      ['FLECHA VÃO · PONTA', `${fmt(r.defl.span, 3)} · ${fmt(r.defl.max, 3)} mm`],
      ['INCLINAÇÃO A · B', `${fmt(Math.abs(r.defl.thA) * 1000, 3)} · ${fmt(Math.abs(r.defl.thB) * 1000, 3)} mrad`],
      ['CRÍTICAS 1ª · 2ª', D ? `${f0(D.rpm[0])} · ${f0(D.rpm[1])} rpm (${fmt(D.rpm[0] / d.speed, 2)} × n)` : '—'],
      ['BALANCEAMENTO', r.bal ? `G ${fmt(r.bal.G, 1)} · Uper ${f0(r.bal.U)} g·mm` : '—'],
      ['TRECHOS ABAIXO', r.fails.length ? r.fails.map(s => s.code).join(', ') : 'NENHUM']
    ];
    Rc(qx, qy, qw, qh * (rows.length + 1), 1.1);
    Tx(qx + qw / 2, qy + 8.8, 'DADOS E RESULTADOS', { anchor: 'middle', bold: true, size: 7.6 });
    const kc = qx + 128;
    rows.forEach(([a, b], i) => {
      const y = qy + qh * (i + 1);
      L(qx, y, qx + qw, y, i ? 0.25 : 0.6);
      Tx(qx + 4, y + 8.5, a, { size: 5.8 });
      Tx(kc + 4, y + 8.6, fit(b, qx + qw - kc - 8, 6.4), { size: 6.4, bold: i === rows.length - 1 || i === 1 });
    });
    L(kc, qy + qh, kc, qy + qh * (rows.length + 1), 0.3);
    // notas
    const ny = qy + qh * (rows.length + 1) + 12;
    Tx(qx, ny, 'NOTAS:', { bold: true, size: 7.4 });
    const notes = [
      '1. Triagem pela fórmula simplificada (Kt e Kf estimados): não libera o eixo.',
      `2. Cotas em mm; Ø e posições na tabela. Tracejado = Ø mínimo; balão grosso = trecho abaixo.`,
      `3. Torque ${d.torqueMode === 'linear' ? 'pelo caminho acoplamento → pacote' : 'integral em todos os trechos'}; força magnética para baixo.`,
      `4. Críticas não amortecidas, sem giroscópico; ${r.dyn ? r.dyn.designLabel : '—'}.`
    ].concat(r.notes.slice(0, 2).map((t, i) => `${i + 5}. ${t}`));
    notes.forEach((t, i) => { const y = ny + 9.4 * (i + 1); if (y < 778) Tx(qx, y, fit(t, qw, 6.1), { size: 6.1 }); });

    /* carimbo (mesmo dos outros laboratórios) */
    {
      const bx0 = 790, by0 = 780, bx1 = W - 12, by1 = H - 12;
      const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
      raw(`<rect x="${bx0}" y="${by0}" width="${bx1 - bx0}" height="${by1 - by0}" fill="#fff" stroke="#111" stroke-width="1.1"/>`);
      const col = [bx0, bx0 + 96, bx0 + 300, bx1 - 64, bx1];
      const rws = [by0, by0 + 20, by0 + 40, by0 + 58, by0 + 79, by1];
      rws.slice(1, -1).forEach(y => L(bx0 + (y === rws[1] || y === rws[2] ? 96 : 0), y, bx1, y, 0.5));
      L(col[1], by0, col[1], rws[3], 0.5);
      Tx(bx0 + 48, by0 + 22, 'VG.', { anchor: 'middle', size: 18, bold: true });
      Tx(bx0 + 48, by0 + 33, 'Laboratório de eixos', { anchor: 'middle', size: 6 });
      const cell = (x, y, label, value, o = {}) => { Tx(x + 3, y + 7, label, { size: 5.6 }); Tx(o.center ? x + (o.w || 0) / 2 : x + 8, y + 16.5, value, { size: o.size ?? 8.5, bold: o.bold, anchor: o.center ? 'middle' : 'start' }); };
      cell(col[1], by0, 'CLIENTE :', info.cliente || '—');
      L(col[3], by0 + 20, col[3], by0 + 40, 0.5);
      cell(col[1], by0 + 20, 'EQUIPAMENTO :', fit(info.equipamento || '—', col[3] - col[1] - 12, 8.5));
      cell(col[3], by0 + 20, 'O.S. :', info.os || '—');
      cell(bx0, by0 + 40, 'TÍTULO :', 'TRIAGEM DO EIXO DO ROTOR · TENSÕES, FLECHA E CRÍTICAS', { center: true, w: bx1 - bx0, bold: true, size: 9 });
      const c4 = [bx0, bx0 + 110, bx0 + 220, bx0 + 330, bx1];
      c4.slice(1, -1).forEach(x => L(x, rws[3], x, rws[4], 0.5));
      cell(c4[0], rws[3], 'ELABORADO :', info.elaborado || '—', { size: 7.5 });
      cell(c4[1], rws[3], 'MÉTODO :', 'Shigley · MEF', { size: 7.5 });
      cell(c4[2], rws[3], 'TIPO DE DESENHO :', 'TRIAGEM', { size: 7.5 });
      cell(c4[3], rws[3], 'DATA :', today, { size: 7.5 });
      const c5 = [bx0, bx0 + 60, bx1 - 120, bx1 - 60, bx1];
      c5.slice(1, -1).forEach(x => L(x, rws[4], x, by1, 0.5));
      cell(c5[0], rws[4], 'ESCALA / FORMATO :', 'S/E · A3', { size: 8 });
      cell(c5[1], rws[4], 'DESENHO Nº :', `DM-${info.os || 'XXXXX'}-EIX-001`, { size: 9, bold: true });
      cell(c5[2], rws[4], 'REVISÃO :', '00', { size: 8 });
      cell(c5[3], rws[4], 'FOLHA :', '1/1', { size: 8 });
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" class="sxs" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><style>${PAPER_CSS}</style>${out.join('')}</svg>`;
  }

  window.VGShaftDrawing = { sheet };
})();
