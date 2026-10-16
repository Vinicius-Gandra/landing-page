/* Laboratório de eixos · figuras em SVG (texto puro, sem dependências).
   - profile(): o eixo em escala real (mesma escala nas duas direções), mancais, pacote do rotor, cargas e Ø mínimo;
   - explorer(): o eixo e os diagramas alinhados no mesmo x (cortante, momento, torque, flecha, inclinação, utilização, modos);
   - mapSVG(): críticas × rigidez dos mancais; modesSVG(): formas modais animadas.
   Marcas finas: linhas de 2 px, pontos com anel na cor do fundo, grade discreta e rótulos em tinta de texto. */
(() => {
  'use strict';
  const isNum = Number.isFinite;
  const nfc = new Map();
  const fx = (v, d = 1) => {
    if (!isNum(v)) return '—';
    if (!nfc.has(d)) nfc.set(d, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
    return nfc.get(d).format(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v);
  };
  const f0 = v => fx(v, 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const r2 = x => Math.round(x * 100) / 100;
  const P = (x, y) => `${r2(x)},${r2(y)}`;
  function niceStep(range, target = 4) {
    if (!(range > 0)) return 1;
    const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  // faixa "bonita" que sempre contém o zero
  function axis(lo, hi, target = 3) {
    lo = Math.min(0, lo); hi = Math.max(0, hi);
    if (hi - lo < 1e-12) { hi = lo + 1; }
    const step = niceStep(hi - lo, target);
    const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
    const list = [];
    for (let t = a; t <= b + step * 1e-6; t += step) list.push(Math.abs(t) < step * 1e-9 ? 0 : t);
    return { lo: a, hi: b, step, list };
  }
  const decimals = step => step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  const secAt = (r, x) => { const R = r.res; let lo = 0, hi = R.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (x > R[m].b) lo = m + 1; else hi = m; } return lo; };
  const statusOf = s => s.ok ? (s.util > 0.9 ? 'is-warn' : '') : 'is-fail';

  /* ---- Perfil do eixo ------------------------------------------------------------------------------ */
  // o: { X(x)→px, cy, k (px/mm radial), sel, mini, paper, loads, dmin, status, labels, id }
  function profile(r, o) {
    const d = r.d, R = r.res, X = o.X, cy = o.cy, k = o.k, out = [];
    const rmax = Math.max(...R.map(s => s.d)) / 2;
    const rAt = x => R[secAt(r, x)].d / 2;
    const T = s => String(s);      // unidades mantêm a caixa (kN, kg) também no papel
    // pacote do rotor
    if (d.rotorMass > 0 && d.rotorTo > d.rotorFrom) {
      const pad = o.mini ? 4 : 12, h = rmax * k + pad;
      out.push(`<rect class="sx-core" x="${r2(X(d.rotorFrom))}" y="${r2(cy - h)}" width="${r2(X(d.rotorTo) - X(d.rotorFrom))}" height="${r2(2 * h)}" rx="${o.mini ? 2 : 4}"/>`);
      if (!o.mini) out.push(`<text class="sx-t2" x="${r2(X(d.rotorFrom) + 6)}" y="${r2(cy - h + 12)}">${esc(T(`rotor · ${f0(d.rotorMass)} kg`))}</text>`);
    }
    // faixa do trecho selecionado
    if (isNum(o.sel) && R[o.sel] && !o.paper) {
      const s = R[o.sel], h = rmax * k + (o.mini ? 6 : 18);
      out.push(`<rect class="sx-selband" x="${r2(X(s.a))}" y="${r2(cy - h)}" width="${r2(Math.max(1.5, X(s.b) - X(s.a)))}" height="${r2(2 * h)}"/>`);
    }
    // trechos
    for (const s of R) {
      const x0 = X(s.a), w = Math.max(0.6, X(s.b) - X(s.a)), h = s.d * k;
      const cls = 'sx-sec' + (o.status !== false ? ' ' + statusOf(s) : '') + (o.sel === s.i ? ' is-sel' : '');
      out.push(`<rect class="${cls}" data-sec="${s.i}" x="${r2(x0)}" y="${r2(cy - h / 2)}" width="${r2(w)}" height="${r2(h)}"/>`);
      if (s.di > 0) for (const sg of [-1, 1]) out.push(`<line class="sx-hidden" x1="${r2(x0)}" x2="${r2(x0 + w)}" y1="${r2(cy + sg * s.di / 2 * k)}" y2="${r2(cy + sg * s.di / 2 * k)}"/>`);
      if (s.flats && !o.mini && w > 6) {
        const yf = s.flats / 2 * k;
        out.push(`<path class="sx-flat" d="M${P(x0, cy - yf)} L${P(x0 + w, cy + yf)} M${P(x0, cy + yf)} L${P(x0 + w, cy - yf)}"/>`);
      }
    }
    // contorno contínuo e juntas
    let top = `M${P(X(0), cy)} V${r2(cy - R[0].d / 2 * k)}`, bot = `M${P(X(0), cy)} V${r2(cy + R[0].d / 2 * k)}`;
    R.forEach((s, i) => {
      top += ` H${r2(X(s.b))}`; bot += ` H${r2(X(s.b))}`;
      const nx = R[i + 1];
      top += ` V${r2(cy - (nx ? nx.d : 0) / 2 * k)}`; bot += ` V${r2(cy + (nx ? nx.d : 0) / 2 * k)}`;
    });
    out.push(`<path class="sx-outline" d="${top} ${bot}"/>`);
    if (!o.mini) R.slice(0, -1).forEach((s, i) => { if (Math.abs(s.d - R[i + 1].d) < 1e-6) out.push(`<line class="sx-joint" x1="${r2(X(s.b))}" x2="${r2(X(s.b))}" y1="${r2(cy - s.d / 2 * k)}" y2="${r2(cy + s.d / 2 * k)}"/>`); });
    // linha de centro
    out.push(`<line class="sx-center" x1="${r2(X(0) - (o.mini ? 4 : 14))}" x2="${r2(X(d.L) + (o.mini ? 4 : 14))}" y1="${r2(cy)}" y2="${r2(cy)}"/>`);
    // Ø mínimo da fórmula (envelope tracejado)
    if (o.dmin) {
      for (const sg of [-1, 1]) {
        let p = '';
        R.forEach((s, i) => { const y = cy + sg * s.dmin / 2 * k; p += (i ? ` V${r2(y)}` : `M${P(X(s.a), y)}`) + ` H${r2(X(s.b))}`; });
        out.push(`<path class="sx-dmin" d="${p}"/>`);
      }
      R.filter(s => s.dmin > s.d).forEach(s => { for (const sg of [-1, 1]) out.push(`<line class="sx-dmin is-over" x1="${r2(X(s.a))}" x2="${r2(X(s.b))}" y1="${r2(cy + sg * s.dmin / 2 * k)}" y2="${r2(cy + sg * s.dmin / 2 * k)}"/>`); });
    }
    // mancais: casquilhos sobre o colo
    r.bearings.forEach(b => {
      const s = b.s, x0 = X(s.a), w = Math.max(2, X(s.b) - X(s.a)), y = s.d / 2 * k, t = o.mini ? 3 : Math.max(5, Math.min(10, w * 0.12));
      if (o.mini) { out.push(`<path class="sx-brg-mark" d="M${P(X(b.x), cy + y + 2)} l-4 6 h8 z"/>`); return; }
      out.push(`<g class="sx-brg" data-brg="${b.name}">`);
      for (const sg of [-1, 1]) {
        const yy = sg < 0 ? cy - y - t : cy + y;
        out.push(`<rect class="sx-brg-shell" x="${r2(x0)}" y="${r2(yy)}" width="${r2(w)}" height="${r2(t)}"/>`);
        for (let c = 4; c < w + t; c += 4) {
          const u1 = Math.min(c, w), v1 = c - u1, v2 = Math.min(c, t), u2 = c - v2;
          out.push(`<line class="sx-hatch" x1="${r2(x0 + u1)}" y1="${r2(yy + v1)}" x2="${r2(x0 + u2)}" y2="${r2(yy + v2)}"/>`);
        }
      }
      out.push(`<line class="sx-axisline" x1="${r2(X(b.x))}" x2="${r2(X(b.x))}" y1="${r2(cy - y - t - 6)}" y2="${r2(cy + y + t + 6)}"/>`);
      out.push('</g>');
      if (o.labels !== false) out.push(`<text class="sx-t sx-strong" x="${r2(X(b.x))}" y="${r2(cy - y - t - 9)}" text-anchor="middle">${esc(T('Mancal ' + b.name))}</text>`);
    });
    // cargas
    if (o.loads) {
      const arrow = (x, y1, y2, cls = 'sx-force') => {
        const dir = Math.sign(y2 - y1);
        out.push(`<line class="${cls}" x1="${r2(x)}" x2="${r2(x)}" y1="${r2(y1)}" y2="${r2(y2 - dir * 6)}"/>`);
        out.push(`<path class="${cls}-h" d="M${P(x, y2)} l-4.2 ${r2(-dir * 8)} h8.4 z"/>`);
      };
      const lab = o.loadLabels !== false;
      if (d.ump > 0) {
        const x = X(d.xUmp), yb = cy - rAt(d.xUmp) * k - 2, ya = cy - rmax * k - (o.paper ? 34 : 38);
        arrow(x, ya, yb, 'sx-force sx-mag');
        if (lab) out.push(`<text class="sx-t" x="${r2(x + 7)}" y="${r2(ya + 8)}">${esc(T(`Fmag ${fx(d.ump * 9.80665 / 1000, 1)} kN`))}</text>`);
      }
      r.bearings.forEach(b => {
        const y0 = cy + b.s.d / 2 * k + 12, len = 26;
        arrow(X(b.x), y0 + len, y0, 'sx-force sx-react');
        if (lab) out.push(`<text class="sx-t" x="${r2(X(b.x))}" y="${r2(y0 + len + 13)}" text-anchor="middle">${esc(T(`R${b.name} ${fx(b.F / 1000, 1)} kN`))}</text>`);
      });
      // acoplamento e torque
      const xe = X(r.loads.xc), side = r.loads.xc > 0 ? 1 : -1, re = rAt(r.loads.xc) * k;
      const cx = xe + side * 10, rr = re * 0.72;
      out.push(`<path class="sx-torque" d="M${P(cx, cy - rr)} A ${r2(rr * 0.42)} ${r2(rr)} 0 1 ${side > 0 ? 1 : 0} ${P(cx, cy + rr)}"/>`);
      out.push(`<path class="sx-torque-h" d="M${P(cx, cy + rr)} l${r2(-side * 8)} -3.5 l1.5 8 z"/>`);
      if (lab) out.push(`<text class="sx-t" x="${r2(xe + side * 6)}" y="${r2(cy + re + 20)}" text-anchor="${side > 0 ? 'end' : 'start'}">${esc(T(`T ${fx(r.T / 1000, 1)} kN·m`))}</text>`);
      if (Math.abs(d.coupleF) > 0) {
        const up = d.coupleF > 0, y0 = up ? cy + re + 34 : cy - re - 34, y1 = up ? cy + re + 4 : cy - re - 4;
        arrow(xe - side * 4, y0, y1, 'sx-force');
        if (lab) out.push(`<text class="sx-t" x="${r2(xe - side * 10)}" y="${r2(up ? y0 + 12 : y0 - 4)}" text-anchor="${side > 0 ? 'end' : 'start'}">${esc(T(`Facop ${fx(d.coupleF, 1)} kN`))}</text>`);
      }
      if (Math.abs(d.axialF) > 0) {
        const xa = side > 0 ? X(0) - 34 : X(d.L) + 34, xb = side > 0 ? X(0) - 4 : X(d.L) + 4;
        out.push(`<line class="sx-force" x1="${r2(xa)}" x2="${r2(xb - Math.sign(xb - xa) * 6)}" y1="${r2(cy)}" y2="${r2(cy)}"/><path class="sx-force-h" d="M${P(xb, cy)} l${r2(-Math.sign(xb - xa) * 8)} -4.2 v8.4 z"/>`);
        if (lab) out.push(`<text class="sx-t" x="${r2(xa)}" y="${r2(cy - 8)}">${esc(T(`Fax ${fx(Math.abs(d.axialF), 1)} kN`))}</text>`);
      }
    }
    return out.join('');
  }

  /* ---- Explorador: perfil + diagramas alinhados ------------------------------------------------------ */
  const LANES = {
    v: { title: 'Cortante V', unit: 'kN', cls: 'is-v' },
    m: { title: 'Momento fletor M', unit: 'kN·m', cls: 'is-m' },
    t: { title: 'Torque T', unit: 'kN·m', cls: 'is-t' },
    y: { title: 'Flecha y', unit: 'mm', cls: 'is-y' },
    th: { title: 'Inclinação θ', unit: 'mrad', cls: 'is-th' },
    u: { title: 'Utilização', unit: 'limite = 1', cls: 'is-u' },
    modes: { title: 'Formas modais', unit: 'normalizadas', cls: 'is-modes' }
  };
  // séries nos pontos da malha, com degraus onde há forças concentradas
  function series(r) {
    if (r._series) return r._series;
    const d = r.d, xs = r.mesh;
    const jumpsV = new Set([d.xA, d.xB, ...r.loads.point.filter(p => p.F).map(p => p.x)]);
    const v = [];
    for (const x of xs) {
      if (jumpsV.has(x)) { v.push([x, r.V(x, false) / 1000]); v.push([x, r.V(x, true) / 1000]); }
      else v.push([x, r.V(x) / 1000]);
    }
    const tAt = (x, s) => (s.tpct !== null && s.tpct !== undefined ? r.T * s.tpct / 100 : r.Tfn(x)) / 1000;
    const t = [];
    xs.forEach(x => {
      const i = secAt(r, x), s = r.res[i];
      t.push([x, tAt(x, s)]);
      if (x === s.b && r.res[i + 1]) { const n = tAt(x, r.res[i + 1]); if (Math.abs(n - t[t.length - 1][1]) > 1e-9) t.push([x, n]); }
    });
    r._series = {
      v, t,
      m: xs.map((x, i) => [x, r.Mx[i] / 1e6]),
      y: xs.map((x, i) => [x, r.y[i]]),
      th: xs.map((x, i) => [x, r.th[i] * 1000])
    };
    return r._series;
  }
  // valor de uma série em x (interpolação; nos degraus, o lado direito)
  function valueAt(arr, x) {
    let lo = 0, hi = arr.length - 1;
    if (x <= arr[0][0]) return arr[0][1];
    if (x >= arr[hi][0]) return arr[hi][1];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m][0] <= x) lo = m; else hi = m; }
    const a = arr[lo], b = arr[hi];
    return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }
  function explorer(r, o) {
    const d = r.d, W = Math.max(320, Math.round(o.W || 1000)), compact = W < 560;
    const gl = compact ? 46 : 66, gr = compact ? 10 : 18;
    const X = x => gl + x / d.L * (W - gl - gr), Xinv = px => (px - gl) / (W - gl - gr) * d.L;
    const kx = (W - gl - gr) / d.L;
    const rmax = Math.max(...r.res.map(s => s.d)) / 2;
    const out = [];
    // perfil: altura pelo raio real + espaço para cargas e reações
    const loadTop = compact ? 34 : 44, below = compact ? 46 : 56;
    const cy = 10 + loadTop + rmax * kx + 12;
    const profH = cy + rmax * kx + below;
    const lanes = [];
    let y = profH + 6;
    const LH = compact ? 84 : 96;
    const S = series(r);
    for (const id of o.lanes) {
      const L = LANES[id];
      if (!L) continue;
      if (id === 'modes' && !(r.dyn && r.dyn.design && r.dyn.design.ok)) continue;
      const lane = { id, y0: y, y1: y + LH, title: L.title, unit: L.unit, cls: L.cls };
      lanes.push(lane);
      y += LH;
    }
    const H = y + (compact ? 22 : 26);
    // grade das seções (bem discreta) e faixa do selecionado
    out.push(`<rect class="lx-bg" x="0" y="0" width="${W}" height="${r2(H)}"/>`);
    if (isNum(o.sel) && r.res[o.sel]) {
      const s = r.res[o.sel];
      const bw = Math.max(2, X(s.b) - X(s.a));
      out.push(`<rect class="lx-band" x="${r2(X(s.a))}" y="${r2(profH)}" width="${r2(bw)}" height="${r2(y - profH)}"/>`);
      out.push(`<path class="lx-band-edge" d="M${P(X(s.a), profH)} V${r2(y)} M${P(X(s.a) + bw, profH)} V${r2(y)}"/>`);
    }
    // perfil
    out.push(`<g class="sxv-prof">${profile(r, { X, cy, k: kx, sel: o.sel, loads: true, dmin: o.dmin, loadLabels: !compact, labels: !compact })}</g>`);
    // eixo x (mm) no rodapé
    const xs = axis(0, d.L, compact ? 4 : 8);
    for (const t of xs.list) if (t <= d.L + 1e-9) {
      out.push(`<line class="lx-tick" x1="${r2(X(t))}" x2="${r2(X(t))}" y1="${r2(y)}" y2="${r2(y + 4)}"/>`);
      out.push(`<text class="lx-axis" x="${r2(X(t))}" y="${r2(y + 15)}" text-anchor="middle">${f0(t)}</text>`);
    }
    out.push(`<text class="lx-axis" x="4" y="${r2(y + 15)}">${compact ? 'mm' : 'x (mm)'}</text>`);
    // pistas
    const lineFor = (lane, arr, cls, fill, range = arr) => {
      let lo = Infinity, hi = -Infinity;
      for (const [, v] of range) { if (v < lo) lo = v; if (v > hi) hi = v; }
      const ax = axis(lo, hi, 2);
      const top = lane.y0 + 18, bot = lane.y1 - 8;
      const Y = v => bot - (v - ax.lo) / (ax.hi - ax.lo) * (bot - top);
      lane.Y = Y; lane.ax = ax;
      for (const t of ax.list) {
        out.push(`<line class="${t === 0 ? 'lx-zero' : 'lx-grid'}" x1="${gl}" x2="${W - gr}" y1="${r2(Y(t))}" y2="${r2(Y(t))}"/>`);
        out.push(`<text class="lx-axis" x="${gl - 6}" y="${r2(Y(t) + 3.5)}" text-anchor="end">${fx(t, decimals(ax.step))}</text>`);
      }
      const pts = arr.map(([x, v]) => P(X(x), Y(v))).join(' ');
      if (fill) out.push(`<polygon class="lx-area ${cls}" points="${P(X(arr[0][0]), Y(0))} ${pts} ${P(X(arr[arr.length - 1][0]), Y(0))}"/>`);
      out.push(`<polyline class="lx-line ${cls}" points="${pts}"/>`);
      // extremo com rótulo
      let ib = 0; arr.forEach(([, v], i) => { if (Math.abs(v) > Math.abs(arr[ib][1])) ib = i; });
      const [xb, vb] = arr[ib], px = X(xb), py = Y(vb), right = px < W - gr - 120;
      const txt = fx(vb, Math.abs(vb) >= 10 ? 1 : Math.abs(vb) >= 1 ? 2 : 3);
      let lx = px + (right ? 8 : -8), ly = py + (vb >= 0 ? -6 : 13);
      const titleEnd = gl + (lane.title.length + lane.unit.length + 1) * 6.3 + 10;
      if (ly < top + 4 && lx < titleEnd + 40) { lx = px + 10; ly = py + 14; }       // longe do título da pista
      out.push(`<circle class="lx-max ${cls}" cx="${r2(px)}" cy="${r2(py)}" r="4"/>`);
      out.push(`<text class="lx-lab" x="${r2(lx)}" y="${r2(ly)}" text-anchor="${right || lx > px ? 'start' : 'end'}">${txt}</text>`);
      lane.data = arr;
    };
    for (const lane of lanes) {
      out.push(`<line class="lx-sep" x1="0" x2="${W}" y1="${r2(lane.y0)}" y2="${r2(lane.y0)}"/>`);
      out.push(`<text class="lx-title" x="${gl}" y="${r2(lane.y0 + 13)}">${esc(lane.title)} <tspan class="lx-unit">${esc(lane.unit)}</tspan></text>`);
      if (lane.id === 'u') {
        const umax = Math.max(1.2, ...r.res.map(s => Math.min(s.util, 4))) * 1.05;
        const ax = axis(0, umax, 2);
        const top = lane.y0 + 18, bot = lane.y1 - 8;
        const Y = v => bot - v / ax.hi * (bot - top);
        lane.Y = Y; lane.ax = ax;
        for (const t of ax.list) {
          out.push(`<line class="${t === 0 ? 'lx-zero' : 'lx-grid'}" x1="${gl}" x2="${W - gr}" y1="${r2(Y(t))}" y2="${r2(Y(t))}"/>`);
          out.push(`<text class="lx-axis" x="${gl - 6}" y="${r2(Y(t) + 3.5)}" text-anchor="end">${fx(t, decimals(ax.step))}</text>`);
        }
        for (const s of r.res) {
          const u = Math.min(s.util, ax.hi), x0 = X(s.a), w = Math.max(1, X(s.b) - X(s.a) - (X(s.b) - X(s.a) > 4 ? 1 : 0));
          out.push(`<rect class="lx-bar ${statusOf(s)}${o.sel === s.i ? ' is-sel' : ''}" data-sec="${s.i}" x="${r2(x0)}" y="${r2(Y(u))}" width="${r2(w)}" height="${r2(Math.max(0.5, bot - Y(u)))}"/>`);
        }
        out.push(`<line class="lx-limit" x1="${gl}" x2="${W - gr}" y1="${r2(Y(1))}" y2="${r2(Y(1))}"/>`);
        out.push(`<text class="lx-lab" x="${W - gr}" y="${r2(Y(1) - 5)}" text-anchor="end">limite 1,0</text>`);
        continue;
      }
      if (lane.id === 'modes') {
        const D = r.dyn.design, m = r.dyn.model;
        const top = lane.y0 + 20, bot = lane.y1 - 10, mid = (top + bot) / 2, amp = (bot - top) / 2;
        lane.Y = v => mid - v * amp;
        out.push(`<line class="lx-zero" x1="${gl}" x2="${W - gr}" y1="${r2(mid)}" y2="${r2(mid)}"/>`);
        D.shapes.slice(0, 2).forEach((sh, i) => {
          out.push(`<polyline class="lx-line lx-mode${i + 1}" points="${sh.map((v, j) => P(X(m.xs[j]), mid - v * amp)).join(' ')}"/>`);
        });
        for (const b of r.bearings) out.push(`<path class="lx-brg" d="M${P(X(b.x), mid + 3)} l-4 7 h8 z"/>`);
        const lx = W - gr;
        out.push(`<text class="lx-lab" x="${lx}" y="${r2(lane.y0 + 13)}" text-anchor="end"><tspan class="lx-key1">━</tspan> 1ª ${f0(D.rpm[0])} rpm   <tspan class="lx-key2">━</tspan> 2ª ${f0(D.rpm[1])} rpm</text>`);
        lane.modes = D.shapes.slice(0, 2).map(sh => sh.map((v, j) => [m.xs[j], v]));
        continue;
      }
      const map = { v: S.v, m: S.m, t: S.t, y: S.y, th: S.th };
      // limites de referência dentro da pista: inclinação admissível e 10 % do entreferro no pacote
      let extra = null;
      if (lane.id === 'th' && d.slopeMax > 0) extra = { lo: -d.slopeMax, hi: d.slopeMax, x0: 0, x1: d.L, label: `±${fx(d.slopeMax, 2)} mrad adm.` };
      if (lane.id === 'y' && d.gap > 0 && d.rotorTo > d.rotorFrom) extra = { lo: -0.1 * d.gap, hi: null, x0: d.rotorFrom, x1: d.rotorTo, label: `10 % de g = ${fx(0.1 * d.gap, 2)} mm` };
      const arr = map[lane.id];
      const big = Math.max(1e-12, ...arr.map(p => Math.abs(p[1])));
      const fits = extra && Math.abs(extra.lo) <= 4 * big;          // limite muito acima dos dados achataria a curva
      const ext = fits ? arr.concat([[0, extra.lo]], extra.hi !== null ? [[0, extra.hi]] : []) : arr;
      lineFor(lane, arr, LANES[lane.id].cls, lane.id !== 'y' && lane.id !== 'th', ext);
      if (fits) {
        for (const v of [extra.lo, extra.hi]) if (v !== null) out.push(`<line class="lx-limit" x1="${r2(X(extra.x0))}" x2="${r2(X(extra.x1))}" y1="${r2(lane.Y(v))}" y2="${r2(lane.Y(v))}"/>`);
        const ly = lane.Y(extra.lo) + 13 > lane.y1 - 2 ? lane.Y(extra.lo) - 5 : lane.Y(extra.lo) + 13;
        out.push(`<text class="lx-lab" x="${r2(X(extra.x1) - 4)}" y="${r2(ly)}" text-anchor="end">${esc(extra.label)}</text>`);
      } else if (extra) out.push(`<text class="lx-lab" x="${W - gr}" y="${r2(lane.y0 + 13)}" text-anchor="end">${esc(extra.label)} · fora da escala</text>`);
    }
    // cursor
    out.push(`<line class="lx-cross" x1="0" x2="0" y1="6" y2="${r2(y)}" visibility="hidden"/>`);
    for (const lane of lanes) if (lane.id !== 'u') out.push(`<circle class="lx-dot ${LANES[lane.id].cls}" data-lane="${lane.id}" r="4.5" cx="0" cy="0" visibility="hidden"/>`);
    out.push(`<rect class="lx-hit" x="${gl}" y="0" width="${r2(W - gl - gr)}" height="${r2(y)}"/>`);
    const label = `Eixo de ${f0(d.L)} mm com ${r.res.length} trechos; momento máximo ${fx(Math.abs(r.Mmax.v) / 1e6, 2)} kN·m; flecha máxima ${fx(r.defl.max, 3)} mm.`;
    return { svg: `<svg class="sxv lx" viewBox="0 0 ${W} ${r2(H)}" width="${W}" height="${r2(H)}" role="img" aria-label="${esc(label)}">${out.join('')}</svg>`, W, H, X, Xinv, gl, gr, lanes, cy, profH, plotBottom: y, S };
  }

  /* ---- Perfil compacto (destaque, formulário e editor) --------------------------------------------- */
  function miniProfile(r, o = {}) {
    const d = r.d, W = o.W || 440, pad = o.pad ?? 10;
    const rmax = Math.max(...r.res.map(s => s.d)) / 2;
    const k = (W - 2 * pad) / d.L;
    const H = o.H || Math.max(46, 2 * rmax * k + 2 * pad + 10);
    const X = x => pad + x * k, cy = H / 2;
    const body = profile(r, { X, cy, k, mini: true, sel: o.sel, status: o.status, dmin: o.dmin });
    return `<svg class="sxv sx-mini" viewBox="0 0 ${W} ${r2(H)}" role="img" aria-label="${esc(o.label || `Perfil do eixo: ${r.res.length} trechos, ${f0(d.L)} mm`)}">${body}</svg>`;
  }

  /* ---- Figura do destaque: eixo em escala real + utilização por trecho alinhada -------------------------- */
  function heroFigure(r, o = {}) {
    const d = r.d, W = 560, pad = 14, gl = 30;
    const rmax = Math.max(...r.res.map(s => s.d)) / 2;
    const k = (W - gl - pad) / d.L, X = x => gl + x * k;
    const top = 26, cy = top + rmax * k, uTop = cy + rmax * k + 34, uH = 60, H = uTop + uH + 22;
    const umax = Math.max(1.25, ...r.res.map(s => Math.min(s.util, 3))) * 1.08;
    const Y = u => uTop + uH - Math.min(u, umax) / umax * uH;
    const s = [];
    s.push(profile(r, { X, cy, k, mini: true, status: true, dmin: o.dmin !== false, sel: o.sel }));
    for (const b of r.bearings) s.push(`<text class="sx-t2" x="${r2(X(b.x))}" y="${r2(top - 8)}" text-anchor="middle">${b.name}</text>`);
    // utilização
    s.push(`<line class="hf-base" x1="${gl}" x2="${W - pad}" y1="${r2(uTop + uH)}" y2="${r2(uTop + uH)}"/>`);
    for (const z of r.res) {
      const x0 = X(z.a), w = Math.max(1.2, X(z.b) - X(z.a) - (X(z.b) - X(z.a) > 3 ? 0.8 : 0));
      s.push(`<rect class="hf-bar ${statusOf(z)}${o.sel === z.i ? ' is-sel' : ''}" x="${r2(x0)}" y="${r2(Y(z.util))}" width="${r2(w)}" height="${r2(uTop + uH - Y(z.util))}"/>`);
    }
    s.push(`<line class="hf-limit" x1="${gl}" x2="${W - pad}" y1="${r2(Y(1))}" y2="${r2(Y(1))}"/>`);
    s.push(`<text class="hf-t" x="${gl - 4}" y="${r2(Y(1) + 3.5)}" text-anchor="end">1,0</text>`);
    s.push(`<text class="hf-t" x="${gl - 4}" y="${r2(uTop + uH + 3.5)}" text-anchor="end">0</text>`);
    // rótulos dos trechos acima do limite (até 5), numa linha logo acima da faixa, sem sobrepor
    const bad = r.res.filter(z => z.util > 1).sort((a, b) => b.util - a.util).slice(0, 5).sort((a, b) => a.a - b.a);
    let lastX = -1e9;
    for (const z of bad) {
      const xc = X((z.a + z.b) / 2), x = Math.max(xc, lastX + 28);
      s.push(`<line class="hf-lead" x1="${r2(xc)}" x2="${r2(x)}" y1="${r2(Y(z.util) - 1)}" y2="${r2(uTop - 9)}"/>`);
      s.push(`<text class="hf-t hf-bad" x="${r2(x)}" y="${r2(uTop - 12)}" text-anchor="middle">${esc(z.code)}</text>`);
      lastX = x;
    }
    s.push(`<text class="hf-t" x="${gl}" y="${r2(H - 4)}">0</text>`);
    s.push(`<text class="hf-t hf-cap" x="${r2((gl + W - pad) / 2)}" y="${r2(H - 4)}" text-anchor="middle">utilização por trecho · limite 1,0</text>`);
    s.push(`<text class="hf-t" x="${r2(W - pad)}" y="${r2(H - 4)}" text-anchor="end">${f0(d.L)} mm</text>`);
    return `<svg class="sxv hf" viewBox="0 0 ${W} ${r2(H)}" role="img" aria-label="${esc(`Eixo em escala real com a utilização de cada trecho; ${bad.length ? `${r.fails.length} acima do limite` : 'todos abaixo do limite'}.`)}">${s.join('')}</svg>`;
  }

  /* ---- Mapa de críticas × rigidez ------------------------------------------------------------------------ */
  const MP = { W: 640, H: 300, x0: 58, x1: 610, y0: 26, y1: 250 };
  function mapSVG(r, map) {
    if (!map || !map.length) return null;
    const d = r.d, n = d.speed;
    const kmin = Math.log10(map[0].k / 1e6), kmax = Math.log10(map[map.length - 1].k / 1e6);
    const X = k => MP.x0 + (Math.log10(k) - kmin) / (kmax - kmin) * (MP.x1 - MP.x0);       // k em kN/mm
    const all = map.flatMap(p => p.rpm.slice(0, 3)).filter(isNum);
    const top = Math.max(n * d.overspeed * 1.6, Math.min(Math.max(...all), n * 6));
    const step = niceStep(top, 5), yMax = Math.ceil(top / step) * step;
    const Y = v => MP.y1 - v / yMax * (MP.y1 - MP.y0);
    const s = [];
    const id = 'mp' + Math.random().toString(36).slice(2, 8);
    s.push(`<defs><clipPath id="${id}"><rect x="${MP.x0}" y="${MP.y0 - 2}" width="${MP.x1 - MP.x0}" height="${MP.y1 - MP.y0 + 4}"/></clipPath></defs>`);
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      s.push(`<line class="pf-grid" x1="${MP.x0}" x2="${MP.x1}" y1="${r2(Y(v))}" y2="${r2(Y(v))}"/>`);
      s.push(`<text class="pf-axis" x="${MP.x0 - 6}" y="${r2(Y(v) + 3)}" text-anchor="end">${f0(v)}</text>`);
    }
    for (let e = Math.ceil(kmin); e <= Math.floor(kmax); e++) {
      const x = X(Math.pow(10, e));
      s.push(`<line class="pf-grid" x1="${r2(x)}" x2="${r2(x)}" y1="${MP.y0}" y2="${MP.y1}"/>`);
      s.push(`<text class="pf-axis" x="${r2(x)}" y="${MP.y1 + 15}" text-anchor="middle">${f0(Math.pow(10, e))}</text>`);
    }
    // faixa proibida em torno da rotação e linha de sobrevelocidade
    const m = d.margin / 100;
    s.push(`<rect class="mp-band" x="${MP.x0}" y="${r2(Y(Math.min(yMax, n * (1 + m))))}" width="${MP.x1 - MP.x0}" height="${r2(Y(n * (1 - m)) - Y(Math.min(yMax, n * (1 + m))))}"/>`);
    s.push(`<line class="mp-op" x1="${MP.x0}" x2="${MP.x1}" y1="${r2(Y(n))}" y2="${r2(Y(n))}"/>`);
    s.push(`<text class="pf-lab" x="${MP.x0 + 6}" y="${r2(Y(Math.min(yMax, n * (1 + m))) - 5)}">n = ${f0(n)} rpm ± ${f0(d.margin)} %</text>`);
    if (n * d.overspeed < yMax) {
      s.push(`<line class="mp-ov" x1="${MP.x0}" x2="${MP.x1}" y1="${r2(Y(n * d.overspeed))}" y2="${r2(Y(n * d.overspeed))}"/>`);
      s.push(`<text class="pf-axis" x="${MP.x1 - 4}" y="${r2(Y(n * d.overspeed) + 12)}" text-anchor="end">sobrevelocidade ${fx(d.overspeed, 2)} ×</text>`);
    }
    // curvas e assíntotas rígidas
    const rig = r.dyn && r.dyn.rigid && r.dyn.rigid.ok ? r.dyn.rigid.rpm : [];
    for (let i = 0; i < 3; i++) {
      const pts = map.filter(p => isNum(p.rpm[i])).map(p => P(X(p.k / 1e6), Y(p.rpm[i])));
      s.push(`<polyline class="mp-line mp-${i + 1}" clip-path="url(#${id})" points="${pts.join(' ')}"/>`);
      if (isNum(rig[i]) && rig[i] < yMax) {
        s.push(`<line class="mp-rigid" x1="${MP.x0}" x2="${MP.x1}" y1="${r2(Y(rig[i]))}" y2="${r2(Y(rig[i]))}"/>`);
        s.push(`<text class="pf-lab" x="${MP.x1 - 4}" y="${r2(Y(rig[i]) - 5)}" text-anchor="end">${i + 1}ª rígida ${f0(rig[i])}</text>`);
      }
    }
    if (d.kBearing) {
      const x = X(d.kBearing);
      if (x >= MP.x0 && x <= MP.x1) {
        s.push(`<line class="mp-k" x1="${r2(x)}" x2="${r2(x)}" y1="${MP.y0}" y2="${MP.y1}"/>`);
        s.push(`<text class="pf-lab" x="${r2(x + 5)}" y="${MP.y0 + 10}">k = ${f0(d.kBearing)} kN/mm</text>`);
        const fl = r.dyn && r.dyn.flex && r.dyn.flex.ok ? r.dyn.flex.rpm : [];
        fl.forEach((v, i) => { if (v < yMax) s.push(`<circle class="mp-dot mp-${i + 1}" cx="${r2(x)}" cy="${r2(Y(v))}" r="4.5"/>`); });
      }
    }
    s.push(`<text class="pf-axis" x="${MP.x0}" y="${MP.y0 - 12}">velocidade crítica (rpm)</text>`);
    s.push(`<text class="pf-axis" x="${MP.x1}" y="${MP.y1 + 32}" text-anchor="end">rigidez radial de cada mancal (kN/mm, escala log)</text>`);
    s.push(`<line class="pf-cross" x1="0" x2="0" y1="${MP.y0}" y2="${MP.y1}" visibility="hidden"/>`);
    for (let i = 0; i < 3; i++) s.push(`<circle class="mp-hover mp-${i + 1}" r="4.5" cx="0" cy="0" visibility="hidden"/>`);
    const label = `Mapa de velocidades críticas: com mancais rígidos ${rig.map(v => f0(v)).join(', ')} rpm; rotação ${f0(n)} rpm.`;
    return { svg: `<svg class="pf mp" viewBox="0 0 ${MP.W} ${MP.H}" role="img" aria-label="${esc(label)}">${s.join('')}</svg>`, X, Y, yMax, MP, kmin, kmax };
  }

  /* ---- Formas modais (animadas) ------------------------------------------------------------------------- */
  function modesSVG(r, o = {}) {
    const D = r.dyn && r.dyn.design;
    if (!D || !D.ok) return null;
    const d = r.d, m = r.dyn.model, W = 640, gl = 20, gr = 20, rowH = 92;
    const X = x => gl + x / d.L * (W - gl - gr), k = (W - gl - gr) / d.L;
    const n = Math.min(o.modes || 2, D.shapes.length), H = n * rowH + 10;
    const s = [];
    for (let i = 0; i < n; i++) {
      const cy = 14 + i * rowH + rowH / 2 - 4, amp = rowH * 0.32;
      s.push(`<g class="md-row">`);
      s.push(`<g class="md-ghost">${profile(r, { X, cy, k, mini: true, status: false })}</g>`);
      const a = D.shapes[i].map((v, j) => P(X(m.xs[j]), cy - v * amp)).join(' ');
      const b = D.shapes[i].map((v, j) => P(X(m.xs[j]), cy + v * amp)).join(' ');
      s.push(`<polyline class="md-line md-${i + 1}" points="${a}">${o.animate === false ? '' : `<animate attributeName="points" values="${a};${b};${a}" dur="${(1.4 + i * 0.25).toFixed(2)}s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>`}</polyline>`);
      s.push(`<text class="pf-lab" x="${gl}" y="${r2(14 + i * rowH + 8)}">${i + 1}º modo · ${f0(D.rpm[i])} rpm (${fx(D.rpm[i] / d.speed, 2)} × n)</text>`);
      s.push('</g>');
    }
    return `<svg class="pf md sxv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Formas dos ${n} primeiros modos de flexão: ${D.rpm.slice(0, n).map(v => f0(v) + ' rpm').join(', ')}.`)}">${s.join('')}</svg>`;
  }

  window.VGShaftFigures = { profile, explorer, miniProfile, heroFigure, mapSVG, modesSVG, series, valueAt, secAt, LANES, MP, axis, niceStep };
})();
