/* Laboratório de eixos · modelo de elementos finitos de viga (versão 2).
   Eixo: viga de Timoshenko (interpolação interdependente) ou Euler–Bernoulli, com inércia de rotação.
   Pacote montado em assentos: o cubo/aranha vira uma segunda viga, ligada ao eixo por contato elástico distribuído
   só ao longo dos assentos (fundação de Winkler entre as duas vigas, na flexão e na torção). Peso, força magnética e
   torque do pacote entram no cubo; o que chega ao eixo, e por qual assento, sai da solução — não de uma hipótese.
   Flexão (v, θ por nó) e torção (φ por nó) em sistemas separados. Nós do eixo e do cubo intercalados por posição:
   as matrizes ficam em banda estreita (meia-largura até 7), Cholesky em banda e iteração em subespaço.
   Malha conforme (nós em toda mudança de seção, carga, mancal e assento) ou uniforme (didática).
   Unidades SI internas: m, N, kg, Pa. Sem dependências; funciona no navegador e no Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VGShaftFEM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---- Matriz simétrica em banda: guarda A[i][i−j], j = 0..hb ------------------------------------ */
  const band = (n, hb) => ({ n, hb, w: hb + 1, a: new Float64Array(Math.max(1, n) * (hb + 1)) });
  function badd(B, i, k, v) {           // soma em (i,k) e (k,i) — um só valor guardado
    if (i < 0 || k < 0 || !v) return;
    const r = i >= k ? i : k, d = r - (i >= k ? k : i);
    if (d > B.hb) throw new Error('acoplamento fora da banda');
    B.a[r * B.w + d] += v;
  }
  function bmul(B, x, y) {              // y += B·x
    const { n, hb, w, a } = B;
    for (let i = 0; i < n; i++) {
      let s = a[i * w] * x[i];
      for (let j = 1; j <= hb && i - j >= 0; j++) { const v = a[i * w + j]; s += v * x[i - j]; y[i - j] += v * x[i]; }
      y[i] += s;
    }
    return y;
  }
  function bchol(B) {                   // L·Lᵀ em banda; null se não for positiva definida
    const { n, hb, w, a } = B, L = new Float64Array(n * w);
    for (let i = 0; i < n; i++) {
      const k0 = Math.max(0, i - hb);
      for (let k = k0; k <= i; k++) {
        let s = a[i * w + (i - k)];
        for (let m = k0; m < k; m++) s -= L[i * w + (i - m)] * L[k * w + (k - m)];
        if (i === k) { if (!(s > 0)) return null; L[i * w] = Math.sqrt(s); }
        else L[i * w + (i - k)] = s / L[k * w];
      }
    }
    return { n, hb, w, a: L };
  }
  function bsolve(L, b, x) {            // resolve L·Lᵀ·x = b
    const { n, hb, w, a } = L;
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let j = 1; j <= hb && i - j >= 0; j++) s -= a[i * w + j] * x[i - j];
      x[i] = s / a[i * w];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      for (let j = 1; j <= hb && i + j < n; j++) s -= a[(i + j) * w + j] * x[i + j];
      x[i] = s / a[i * w];
    }
    return x;
  }

  /* ---- Autovalores de matriz pequena simétrica (Jacobi cíclico) e problema reduzido ------------------ */
  function jacobi(A, p) {
    const a = A.map(r => r.slice()), V = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => +(i === j)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0, tot = 0;
      for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) { tot += a[i][j] * a[i][j]; if (i !== j) off += a[i][j] * a[i][j]; }
      if (off <= 1e-26 * tot) break;
      for (let i = 0; i < p - 1; i++) for (let j = i + 1; j < p; j++) {
        if (Math.abs(a[i][j]) < 1e-300) continue;
        const th = (a[j][j] - a[i][i]) / (2 * a[i][j]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < p; k++) { const x = a[k][i], y = a[k][j]; a[k][i] = c * x - s * y; a[k][j] = s * x + c * y; }
        for (let k = 0; k < p; k++) { const x = a[i][k], y = a[j][k]; a[i][k] = c * x - s * y; a[j][k] = s * x + c * y; }
        for (let k = 0; k < p; k++) { const x = V[k][i], y = V[k][j]; V[k][i] = c * x - s * y; V[k][j] = s * x + c * y; }
      }
    }
    return { vals: a.map((r, i) => r[i]), vecs: V };
  }
  function geneig(Kr, Mr, p) {          // Kr·q = λ·Mr·q via Cholesky de Mr
    const R = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) {
      let s = Mr[i][j];
      for (let k = 0; k < j; k++) s -= R[i][k] * R[j][k];
      if (i === j) { if (!(s > 0)) return null; R[i][i] = Math.sqrt(s); } else R[i][j] = s / R[j][j];
    }
    const Ri = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let j = 0; j < p; j++) for (let i = j; i < p; i++) {
      let s = i === j ? 1 : 0;
      for (let k = j; k < i; k++) s -= R[i][k] * Ri[k][j];
      Ri[i][j] = s / R[i][i];
    }
    const T = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) { let s = 0; for (let k = 0; k <= i; k++) s += Ri[i][k] * Kr[k][j]; T[i][j] = s; }
    const C = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) { let s = 0; for (let k = 0; k <= j; k++) s += T[i][k] * Ri[j][k]; C[i][j] = s; }
    for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) { const m = (C[i][j] + C[j][i]) / 2; C[i][j] = C[j][i] = m; }
    const { vals, vecs } = jacobi(C, p);
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    const Q = Array.from({ length: p }, () => new Array(p).fill(0));
    order.forEach((o, c) => { for (let i = 0; i < p; i++) { let s = 0; for (let k = i; k < p; k++) s += Ri[k][i] * vecs[k][o]; Q[i][c] = s; } });
    return { vals: order.map(o => vals[o]), Q };
  }

  /* ---- Matrizes de elemento ------------------------------------------------------------------------- */
  // rigidez de Timoshenko (interdependente): EI/((1+Φ)L³)·[…], Φ = 12EI/(κGAL²); Φ = 0 → Euler–Bernoulli
  const keTim = (L, phi) => { const L2 = L * L; return [12, 6 * L, -12, 6 * L, 6 * L, (4 + phi) * L2, -6 * L, (2 - phi) * L2, -12, -6 * L, 12, -6 * L, 6 * L, (2 - phi) * L2, -6 * L, (4 + phi) * L2]; };
  // massa consistente (Hermite) ×(m'L/420) — também é a matriz da fundação de Winkler ×(kL/420)
  const cHerm = L => { const L2 = L * L; return [156, 22 * L, 54, -13 * L, 22 * L, 4 * L2, 13 * L, -3 * L2, 54, 13 * L, 156, -22 * L, -13 * L, -3 * L2, -22 * L, 4 * L2]; };
  // inércia de rotação ×(ρI/(30L))
  const rRot = L => { const L2 = L * L; return [36, 3 * L, -36, 3 * L, 3 * L, 4 * L2, -3 * L, -L2, -36, -3 * L, 36, -3 * L, 3 * L, -L2, -3 * L, 4 * L2]; };
  // massa consistente do elemento de Timoshenko (Przemieniecki; Friedman & Kosmatka): translação ×(m'L/(210(1+Φ)²)),
  // rotação ×(ρI/(30(1+Φ)²L)). Com Φ = 0 viram as de Hermite acima.
  const mTim = (L, p) => {
    const p2 = p * p, L2 = L * L, a = 70 * p2 + 147 * p + 78, b = (35 * p2 + 77 * p + 44) * L / 4, c = 35 * p2 + 63 * p + 27,
      e = (35 * p2 + 63 * p + 26) * L / 4, f = (7 * p2 + 14 * p + 8) * L2 / 4, g = (7 * p2 + 14 * p + 6) * L2 / 4;
    return [a, b, c, -e, b, f, e, -g, c, e, a, -b, -e, -g, -b, f];
  };
  const rTim = (L, p) => {
    const L2 = L * L, h = (3 - 15 * p) * L, f = (10 * p * p + 5 * p + 4) * L2, g = (5 * p * p - 5 * p - 1) * L2;
    return [36, h, -36, h, h, f, -h, g, -36, -h, 36, -h, h, g, -h, f];
  };
  function shapeV(xi, L, phi) {        // funções de forma de v (Φ = 0: Hermite)
    const c = 1 / (1 + phi), x2 = xi * xi, x3 = x2 * xi;
    return [c * (2 * x3 - 3 * x2 - phi * xi + 1 + phi), c * L * (x3 - (2 + phi / 2) * x2 + (1 + phi / 2) * xi),
      c * (-2 * x3 + 3 * x2 + phi * xi), c * L * (x3 - (1 - phi / 2) * x2 - (phi / 2) * xi)];
  }
  function shapeT(xi, L, phi) {
    const c = 1 / (1 + phi), x2 = xi * xi;
    return [c * 6 / L * (x2 - xi), c * (3 * x2 - (4 + phi) * xi + 1 + phi), c * 6 / L * (xi - x2), c * (3 * x2 - (2 - phi) * xi)];
  }
  // coeficientes da cúbica v(ξ) = a0 + a1ξ + a2ξ² + a3ξ³ no elemento
  function vCoef(ue, L, phi) {
    const c = 1 / (1 + phi);
    return [ue[0],
      c * (-phi * ue[0] + (1 + phi / 2) * L * ue[1] + phi * ue[2] - (phi / 2) * L * ue[3]),
      c * (-3 * ue[0] - (2 + phi / 2) * L * ue[1] + 3 * ue[2] - (1 - phi / 2) * L * ue[3]),
      c * (2 * ue[0] + L * ue[1] - 2 * ue[2] + L * ue[3])];
  }
  // extremos internos de v: dv/dξ = 0 tem até duas raízes em (0, 1)
  function vStationary(ue, L, phi) {
    const [, a1, a2, a3] = vCoef(ue, L, phi);
    const A = 3 * a3, B = 2 * a2, C = a1, out = [], scale = Math.abs(A) + Math.abs(B) + Math.abs(C);
    if (!(scale > 0)) return out;
    const roots = [];
    if (Math.abs(A) <= 1e-12 * scale) { if (Math.abs(B) > 1e-12 * scale) roots.push(-C / B); }
    else {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) { const q = -0.5 * (B + (B >= 0 ? 1 : -1) * Math.sqrt(disc)); roots.push(q / A); if (q !== 0) roots.push(C / q); }
    }
    for (const z of roots) if (z > 1e-9 && z < 1 - 1e-9) out.push(z);
    return out.sort((a, b) => a - b);
  }

  /* ---- Montagem do modelo --------------------------------------------------------------------------- */
  // geo: { L (mm), secs: [{a,b,A,I,J,di,d}] (mm), E (MPa), nu, rho (kg/m³), bearings: [xA,xB] (mm),
  //        addMass: [{a,b,kgPerMm}], addRot: [{a,b,Jpm (kg·m²/m)}] e foundation: [{a,b,kPerMm}] no eixo (pacote distribuído),
  //        points: [x...], breaks: [x...], mesh: 'conforme' | 'uniforme', n (alvo), hmax, nodes: [x...], refine: [{a,b,h}], snap,
  //        hub: { a, b, seats: [{a, b, d, Dh, name}], c (fração da rigidez do cubo), kr, kt (fatores do contato),
  //               mass: [{a,b,kgPerMm}], rot: [{a,b,Jpm (kg·m²/m)}], foundation: [{a,b,kPerMm}] } (pacote nos assentos) }
  function buildModel(geo) {
    const E = geo.E * 1e6, nu = geo.nu ?? 0.3, G = E / (2 * (1 + nu)), rho = geo.rho, Lt = geo.L;
    const type = geo.mesh === 'uniforme' ? 'uniforme' : 'conforme';
    const clean = arr => [...new Set(arr)].filter(x => x >= 0 && x <= Lt).sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-6);
    const snap = geo.snap ?? 1;
    const close = (list, x, tol = snap) => list.some(v => Math.abs(v - x) < tol);
    const zones = (geo.refine || []).map(z => ({ a: Math.max(0, z.a), b: Math.min(Lt, z.b), h: z.h })).filter(z => z.b > z.a && z.h > 0);
    const hZone = (a, b) => { const m = (a + b) / 2; let h = Infinity; for (const z of zones) if (m >= z.a && m <= z.b && z.h < h) h = z.h; return h; };
    const H = geo.hub && geo.hub.seats && geo.hub.seats.length ? geo.hub : null;
    const base = clean([0, Lt, ...geo.bearings, ...(geo.points || [])]);
    const forced = clean(base.concat((geo.nodes || []).filter(x => x > 0 && x < Lt && !close(base, x))));
    let xs;
    if (type === 'uniforme') {
      const n = Math.max(2, Math.round(geo.n || 100)), h = Lt / n;
      xs = Array.from({ length: n + 1 }, (_, k) => k === n ? Lt : k * h);
      // pontos obrigatórios (mancais, cargas, nós pedidos e, com o pacote nos assentos, as pontas do cubo e dos assentos):
      // o nó da grade mais próximo vai até o ponto se estiver a até h/4; senão entra um nó a mais
      const must = H ? clean(forced.concat([H.a, H.b], ...H.seats.map(s => [s.a, s.b]))) : forced;
      for (const f of must) {
        const k = Math.round(f / h);
        if (f === 0 || f === Lt) continue;
        if (k > 0 && k < n && Math.abs(xs[k] - f) <= 0.25 * h && !must.includes(xs[k])) xs[k] = f; else xs.push(f);
      }
      xs = clean(xs);
      if (zones.length) {
        const out = [xs[0]];
        for (let i = 1; i < xs.length; i++) {
          const a = xs[i - 1], b = xs[i], hz = hZone(a, b), k = hz < Infinity ? Math.max(1, Math.ceil((b - a) / hz - 1e-9)) : 1;
          for (let j = 1; j <= k; j++) out.push(j === k ? b : a + (b - a) * j / k);
        }
        xs = out;
      }
    } else {
      const set = [...forced, ...(geo.breaks || [])];
      for (const s of geo.secs) set.push(s.a, s.b);
      for (const m of geo.addMass || []) set.push(m.a, m.b);
      for (const m of geo.addRot || []) set.push(m.a, m.b);
      for (const f of geo.foundation || []) set.push(f.a, f.b);
      if (H) { set.push(H.a, H.b); for (const s of H.seats) set.push(s.a, s.b); for (const m of H.mass || []) set.push(m.a, m.b); }
      let bp = clean(set);
      const zb = [];
      for (const z of zones) for (const x of [z.a, z.b]) if (x > 0 && x < Lt && !close(bp, x, Math.max(snap, z.h / 2))) zb.push(x);
      if (zb.length) bp = clean(bp.concat(zb));
      xs = [bp[0]];
      for (let i = 1; i < bp.length; i++) {
        const len = bp[i] - bp[i - 1], hz = hZone(bp[i - 1], bp[i]);
        let n = geo.n ? Math.max(1, Math.round(len * geo.n / Lt)) : Math.max(1, Math.ceil(len / (geo.hmax || 50) - 1e-9));
        if (hz < Infinity) n = Math.max(n, Math.ceil(len / hz - 1e-9));
        for (let k = 1; k <= n; k++) xs.push(k === n ? bp[i] : bp[i - 1] + len * k / n);
      }
    }
    const near = x => {
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
      return Math.abs(xs[hi] - x) < Math.abs(xs[lo] - x) ? hi : lo;
    };
    const overlap = (x0, x1, a, b) => Math.max(0, Math.min(x1, b) - Math.max(x0, a));
    // elementos do eixo: rigidez à flexão, ao cisalhamento e à torção pela média harmônica; massa pela média simples
    const elems = [];
    let si = 0, hmin = Infinity, hmx = 0;
    const kapOf = (d, di) => { const m = di > 0 ? di / d : 0; return 6 * (1 + nu) * (1 + m * m) ** 2 / ((7 + 6 * nu) * (1 + m * m) ** 2 + (20 + 12 * nu) * m * m); };
    for (let e = 0; e < xs.length - 1; e++) {
      const x0 = xs[e], x1 = xs[e + 1], h = x1 - x0, xm = (x0 + x1) / 2;
      while (si < geo.secs.length - 1 && x0 >= geo.secs[si].b) si++;
      let fEI = 0, fGA = 0, fGJ = 0, mA = 0, mI = 0, kap = 1, sm = si;
      for (let j = si; j < geo.secs.length && geo.secs[j].a < x1; j++) {
        const s = geo.secs[j], len = Math.min(x1, s.b) - Math.max(x0, s.a);
        if (!(len > 0)) continue;
        const A = s.A * 1e-6, I = s.I * 1e-12, J = (s.J || 2 * s.I) * 1e-12, k = kapOf(s.d, s.di);
        fEI += len / (E * I); fGA += len / (k * G * A); fGJ += len / (G * J); mA += rho * A * len; mI += rho * I * len;
        if (xm >= s.a && xm <= s.b) { kap = k; sm = j; }
      }
      let mAdd = 0, kf = 0;
      for (const a of geo.addMass || []) { const ov = overlap(x0, x1, a.a, a.b); if (ov > 0) mAdd += a.kgPerMm * 1000 * ov / h; }
      for (const a of geo.addRot || []) { const ov = overlap(x0, x1, a.a, a.b); if (ov > 0) mI += a.Jpm * ov; }   // inércia de rotação do pacote (kg·m²/m)
      for (const f of geo.foundation || []) { const ov = overlap(x0, x1, f.a, f.b); if (ov > 0) kf += f.kPerMm * 1e6 * ov / h; }
      elems.push({ x0, x1, L: h / 1000, EI: h / fEI, kGA: h / fGA, GJ: h / fGJ, rhoA: mA / h, rhoI: mI / h, mAdd, kf, kappa: kap, sec: sm });
      hmin = Math.min(hmin, h); hmx = Math.max(hmx, h);
    }
    // cubo: nós nas mesmas posições do eixo dentro do vão do cubo; contato só onde o meio do elemento cai num assento
    const nn = xs.length, hubAt = new Uint8Array(nn), hubElems = new Array(elems.length).fill(null), contact = new Array(elems.length).fill(null);
    let hub = null;
    if (H) {
      const c = Math.max(1e-3, H.c ?? 1), kr = (H.kr ?? 1) * Math.PI * E;
      for (let i = 0; i < nn; i++) if (xs[i] >= H.a - 1e-6 && xs[i] <= H.b + 1e-6) hubAt[i] = 1;
      const seatOf = xm => { let best = null, bd = Infinity; for (const s of H.seats) { const dd = xm < s.a ? s.a - xm : xm > s.b ? xm - s.b : 0; if (dd < bd) { bd = dd; best = s; } } return { s: best, inside: bd === 0 }; };
      for (let e = 0; e < elems.length; e++) {
        if (!hubAt[e] || !hubAt[e + 1]) continue;
        const el = elems[e], x0 = el.x0, x1 = el.x1, h = x1 - x0, xm = (x0 + x1) / 2, { s, inside } = seatOf(xm);
        const d = s.d / 1000, Dh = Math.max(s.Dh || 1.6 * s.d, s.d * 1.01) / 1000;
        const Ih = Math.PI * (Dh ** 4 - d ** 4) / 64, Ah = Math.PI * (Dh * Dh - d * d) / 4, Jh = 2 * Ih;
        let m = 0, jr = 0, kf = 0;
        for (const q of H.mass || []) { const ov = overlap(x0, x1, q.a, q.b); if (ov > 0) m += q.kgPerMm * 1000 * ov / h; }
        for (const q of H.rot || []) { const ov = overlap(x0, x1, q.a, q.b); if (ov > 0) jr += q.Jpm * ov / h; }
        for (const q of H.foundation || []) { const ov = overlap(x0, x1, q.a, q.b); if (ov > 0) kf += q.kPerMm * 1e6 * ov / h; }
        hubElems[e] = { x0, x1, L: h / 1000, EI: c * E * Ih, kGA: c * kapOf(Dh, d) * G * Ah, GJ: c * G * Jh, m, jr, kf, seat: s.name };
        if (inside) contact[e] = { kr, kt: (H.kt ?? 1) * Math.PI / 8 * G * d * d, seat: H.seats.indexOf(s) };
      }
      hub = { a: H.a, b: H.b, seats: H.seats.map(s => ({ ...s })), c, kr };
    }
    const userNodes = (geo.nodes || []).map(x => near(x));
    const info = { type, target: geo.n || null, ne: elems.length, nn, ndof: 2 * nn + 2 * hubAt.reduce((a, b) => a + b, 0), hmin, hmax: hmx, zones: zones.length, user: new Set(userNodes).size, hub: !!hub };
    return { xs, elems, bearingNodes: geo.bearings.map(near), nNodes: nn, info, zones, userNodes, near, hub, hubAt, hubElems, contact, E, G };
  }

  // GDL da flexão: v e θ por nó do eixo, e do cubo onde ele existe, intercalados por posição; apoio rígido tira o v
  function dofMap(model, rigid) {
    const nn = model.nNodes, S = new Int32Array(nn * 2).fill(-1), Hd = new Int32Array(nn * 2).fill(-1);
    let n = 0;
    for (let i = 0; i < nn; i++) {
      if (!(rigid && model.bearingNodes.includes(i))) S[2 * i] = n++;
      S[2 * i + 1] = n++;
      if (model.hubAt[i]) { Hd[2 * i] = n++; Hd[2 * i + 1] = n++; }
    }
    return { S, H: Hd, n };
  }
  const span = ids => { let lo = Infinity, hi = -Infinity; for (const k of ids) if (k >= 0) { if (k < lo) lo = k; if (k > hi) hi = k; } return hi > lo ? hi - lo : 0; };
  const gS = (dm, e) => [dm.S[2 * e], dm.S[2 * e + 1], dm.S[2 * e + 2], dm.S[2 * e + 3]];
  const gH = (dm, e) => [dm.H[2 * e], dm.H[2 * e + 1], dm.H[2 * e + 2], dm.H[2 * e + 3]];
  function bandOf(model, dm) {
    let hb = 1;
    for (let e = 0; e < model.elems.length; e++) {
      const s = gS(dm, e);
      hb = Math.max(hb, span(s));
      if (model.hubElems[e]) { const h = gH(dm, e); hb = Math.max(hb, span(h)); if (model.contact[e]) hb = Math.max(hb, span(s.concat(h))); }
    }
    return hb;
  }
  const putSym = (B, g, mat, s) => { for (let a = 0; a < 4; a++) for (let b = 0; b <= a; b++) { const i = g[a], j = g[b]; if (i < 0 || j < 0) continue; badd(B, i, j, s * mat[4 * a + b]); } };
  const putCross = (B, g1, g2, mat, s) => { for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const i = g1[a], j = g2[b]; if (i < 0 || j < 0) continue; badd(B, i, j, s * mat[4 * a + b]); } };
  function assemble(model, dm, opt = {}) {
    const n = dm.n, hb = bandOf(model, dm), K = band(n, hb), M = band(n, hb);
    const shear = opt.shear !== false, rotary = opt.rotary !== false, found = opt.foundation !== false;
    model.elems.forEach((el, e) => {
      const L = el.L, phi = shear ? 12 * el.EI / (el.kGA * L * L) : 0, k = el.EI / ((1 + phi) * L ** 3), g = gS(dm, e), C = cHerm(L), c2 = (1 + phi) ** 2;
      putSym(K, g, keTim(L, phi), k);
      if (found && el.kf) putSym(K, g, C, el.kf * L / 420);
      putSym(M, g, mTim(L, phi), (el.rhoA + el.mAdd) * L / (210 * c2));
      if (rotary) putSym(M, g, rTim(L, phi), el.rhoI / (30 * c2 * L));
    });
    model.hubElems.forEach((h, e) => {
      if (!h) return;
      const L = h.L, phi = shear ? 12 * h.EI / (h.kGA * L * L) : 0, k = h.EI / ((1 + phi) * L ** 3), g = gH(dm, e), C = cHerm(L), c2 = (1 + phi) ** 2;
      putSym(K, g, keTim(L, phi), k);
      if (found && h.kf) putSym(K, g, C, h.kf * L / 420);
      if (h.m) putSym(M, g, mTim(L, phi), h.m * L / (210 * c2));
      if (rotary && h.jr) putSym(M, g, rTim(L, phi), h.jr / (30 * c2 * L));
    });
    model.contact.forEach((c, e) => {
      if (!c) return;
      const L = model.elems[e].L, C = cHerm(L), s = c.kr * L / 420, g1 = gS(dm, e), g2 = gH(dm, e);
      putSym(K, g1, C, s); putSym(K, g2, C, s); putCross(K, g1, g2, C, -s);
    });
    return { K, M, n };
  }
  const bcopy = B => ({ n: B.n, hb: B.hb, w: B.w, a: B.a.slice() });
  function baseSystem(model, rigid, o) {
    const key = [rigid ? 'r' : 'f', o.foundation !== false ? 1 : 0, o.shear !== false ? 1 : 0, o.rotary !== false ? 1 : 0].join('');
    model._cache = model._cache || {};
    if (!model._cache[key]) { const dm = dofMap(model, rigid); model._cache[key] = { dm, sys: assemble(model, dm, { foundation: o.foundation, shear: o.shear, rotary: o.rotary }) }; }
    return model._cache[key];
  }
  function withSprings(model, base, springs) {
    if (!springs) return base.sys;
    const K = bcopy(base.sys.K);
    springs.forEach((kb, s) => { const i = base.dm.S[2 * model.bearingNodes[s]]; if (i >= 0 && kb > 0) badd(K, i, i, kb); });
    return { K, M: base.sys.M, n: base.sys.n };
  }

  /* ---- Iteração em subespaço (q modos mais baixos) ---------------------------------------------------- */
  // A cada passo: X̄ = K⁻¹·M·X, M-ortonormaliza X̄ (Gram–Schmidt modificado; vetor que degenera é trocado por um
  // pseudoaleatório), resolve o problema de Ritz padrão Qᵀ·K·Q·z = λ·z por Jacobi e atualiza X = Q·Z.
  // Robusto também com massas muito desiguais (disco pesado num eixo leve), onde os vetores tendem a colapsar.
  function lowestModes(sys, q, start, model, dm) {
    const { K, M, n } = sys;
    const L = bchol(K);
    if (!L) return { ok: false, reason: 'singular' };
    const p = Math.min(n, Math.max(q + 5, 2 * q));
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
    let X;
    if (start && start.length === p && start[0].length === n) X = start.map(c => Float64Array.from(c));
    else {
      X = [];
      const x0 = model.xs[0], x1 = model.xs[model.xs.length - 1];
      for (let c = 0; c < p; c++) {
        const v = new Float64Array(n);
        for (let i = 0; i < model.nNodes; i++) {
          const xi = (model.xs[i] - x0) / (x1 - x0), sv = c === 0 ? 1 : Math.sin((c + (c >= p - 2 ? 0.5 : 0)) * Math.PI * xi), st = 1e-3 * Math.cos(c * Math.PI * xi);
          for (const map of [dm.S, dm.H]) { const iv = map[2 * i], it = map[2 * i + 1]; if (iv >= 0) v[iv] = sv; if (it >= 0) v[it] = st; }
        }
        X.push(v);
      }
    }
    const dot = (a, b) => { let s = 0; for (let k = 0; k < n; k++) s += a[k] * b[k]; return s; };
    const Y = new Float64Array(n), Q = Array.from({ length: p }, () => new Float64Array(n)), MQ = Array.from({ length: p }, () => new Float64Array(n)), KQ = Array.from({ length: p }, () => new Float64Array(n));
    let prev = null, vals = null, it = 0, Z = null;
    for (; it < 80; it++) {
      // X̄ = K⁻¹·M·X, depois M-ortonormalização
      for (let c = 0; c < p; c++) {
        Y.fill(0); bmul(M, X[c], Y); bsolve(L, Y, Q[c]);
        for (let tries = 0; tries < 3; tries++) {
          const v = Q[c];
          for (let pass = 0; pass < 2; pass++) for (let j = 0; j < c; j++) { const h = dot(MQ[j], v); if (h) for (let k = 0; k < n; k++) v[k] -= h * Q[j][k]; }
          MQ[c].fill(0); bmul(M, v, MQ[c]);
          const nrm = Math.sqrt(Math.max(0, dot(v, MQ[c])));
          let big = 0; for (let k = 0; k < n; k++) big = Math.max(big, Math.abs(v[k]));
          if (nrm > 1e-12 * (big || 1) * Math.sqrt(Math.max(1e-300, M.a[0])) && nrm > 0) { for (let k = 0; k < n; k++) { v[k] /= nrm; MQ[c][k] /= nrm; } break; }
          for (let k = 0; k < n; k++) Y[k] = rnd();                      // vetor degenerou: recomeça de um pseudoaleatório
          const tmp = new Float64Array(n); bmul(M, Y, tmp); bsolve(L, tmp, v);
        }
      }
      for (let c = 0; c < p; c++) { KQ[c].fill(0); bmul(K, Q[c], KQ[c]); }
      const Kr = Array.from({ length: p }, () => new Array(p).fill(0));
      for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) { const v = (dot(Q[i], KQ[j]) + dot(Q[j], KQ[i])) / 2; Kr[i][j] = Kr[j][i] = v; }
      const { vals: ev, vecs } = jacobi(Kr, p);
      const order = ev.map((v, i) => i).sort((a, b) => ev[a] - ev[b]);
      vals = order.map(o => ev[o]);
      Z = order.map(o => vecs.map(r => r[o]));                             // Z[c][j]: coluna c
      const Xn = Array.from({ length: p }, () => new Float64Array(n));
      for (let c = 0; c < p; c++) for (let j = 0; j < p; j++) { const z = Z[c][j]; if (z) { const qj = Q[j], xn = Xn[c]; for (let k = 0; k < n; k++) xn[k] += qj[k] * z; } }
      X = Xn;
      if (prev && vals.slice(0, q).every((v, i) => Math.abs(v - prev[i]) <= 1e-11 * Math.abs(v))) break;
      prev = vals.slice(0, q);
    }
    if (!vals.slice(0, q).every(v => Number.isFinite(v))) return { ok: false, reason: 'subspace' };
    return { ok: true, vals: vals.slice(0, q), X, iterations: it + 1 };
  }
  function shapeOf(model, dm, vec) {    // v do eixo nos nós, normalizado; sinal: positivo no maior deslocamento do vão
    const v = new Array(model.nNodes).fill(0);
    for (let i = 0; i < model.nNodes; i++) { const k = dm.S[2 * i]; v[i] = k >= 0 ? vec[k] : 0; }
    const [ia, ib] = [Math.min(...model.bearingNodes), Math.max(...model.bearingNodes)];
    let big = 0, spanBig = 0, sgn = 1;
    v.forEach((a, i) => { if (Math.abs(a) > big) big = Math.abs(a); if (i >= ia && i <= ib && Math.abs(a) > spanBig) { spanBig = Math.abs(a); sgn = Math.sign(a) || 1; } });
    return v.map(a => big > 0 ? a / big * sgn : 0);
  }
  const rpmOf = lam => lam > 0 ? Math.sqrt(lam) * 60 / (2 * Math.PI) : NaN;
  function criticals(model, o = {}) {
    const rigid = !(o.springs && o.springs.every(k => k > 0));
    const base = baseSystem(model, rigid, o);
    const sys = withSprings(model, base, rigid ? null : o.springs);
    const res = lowestModes(sys, o.q || 3, o.start, model, base.dm);
    if (!res.ok) return { ok: false, reason: res.reason };
    return { ok: true, rigid, rpm: res.vals.map(rpmOf), w: res.vals.map(l => Math.sqrt(Math.max(0, l))), shapes: res.vals.map((_, i) => shapeOf(model, base.dm, res.X[i])), X: res.X, iterations: res.iterations };
  }
  function criticalMap(model, o = {}) {
    const ks = o.ks || Array.from({ length: 33 }, (_, i) => Math.pow(10, 7 + 4 * i / 32));
    const out = [];
    let start = null;
    for (const k of ks) {
      const c = criticals(model, { springs: [k, k], q: o.q || 3, start, foundation: o.foundation, shear: o.shear });
      if (!c.ok) { out.push({ k, rpm: [NaN, NaN, NaN] }); start = null; continue; }
      out.push({ k, rpm: c.rpm });
      start = c.X;
    }
    return out;
  }

  /* ---- Estática da flexão ------------------------------------------------------------------------------- */
  // o: { q(xm, el) carga distribuída no eixo (N/m), qh(xm, hubEl) no cubo, points: [{x, F, on: 'hub'|'shaft'}], springs, shear }
  // Devolve deslocamentos, reações, esforços nas pontas (f = Ke·ue − feq + contato), diagramas de V e M do eixo
  // (com a pressão de contato integrada dentro dos elementos de assento), a carga que cada assento passa ao eixo
  // e a curva deformada interpolada.
  function staticSolve(model, o = {}) {
    const rigid = !(o.springs && o.springs.every(k => k > 0)), shear = o.shear !== false;
    const base = baseSystem(model, rigid, { foundation: false, shear, rotary: o.rotary });
    const dm = base.dm, sys = withSprings(model, base, rigid ? null : o.springs);
    const Lc = bchol(sys.K);
    if (!Lc) return null;
    const ne = model.elems.length, nn = model.nNodes;
    const f = new Float64Array(sys.n), qe = new Float64Array(ne), qh = new Float64Array(ne), P = new Float64Array(nn), Ph = new Float64Array(nn);
    const add = (map, node, dof, val) => { const k = map[2 * node + dof]; if (k >= 0) f[k] += val; };
    const consistent = (map, e, q, L) => { add(map, e, 0, q * L / 2); add(map, e, 1, q * L * L / 12); add(map, e + 1, 0, q * L / 2); add(map, e + 1, 1, -q * L * L / 12); };
    model.elems.forEach((el, e) => { const q = o.q ? o.q((el.x0 + el.x1) / 2, el) : 0; qe[e] = q; if (q) consistent(dm.S, e, q, el.L); });
    model.hubElems.forEach((h, e) => { if (!h) return; const q = o.qh ? o.qh((h.x0 + h.x1) / 2, h) : 0; qh[e] = q; if (q) consistent(dm.H, e, q, h.L); });
    for (const p of o.points || []) {
      const i = model.near(p.x);
      if (p.on === 'hub' && model.hubAt[i]) { Ph[i] += p.F; add(dm.H, i, 0, p.F); } else { P[i] += p.F; add(dm.S, i, 0, p.F); }
    }
    const u = bsolve(Lc, f, new Float64Array(sys.n));
    const val = (map, i, dof) => { const k = map[2 * i + dof]; return k >= 0 ? u[k] : 0; };
    const v = new Array(nn), th = new Array(nn), vh = new Array(nn).fill(NaN), thh = new Array(nn).fill(NaN);
    for (let i = 0; i < nn; i++) { v[i] = val(dm.S, i, 0); th[i] = val(dm.S, i, 1); if (model.hubAt[i]) { vh[i] = val(dm.H, i, 0); thh[i] = val(dm.H, i, 1); } }
    const ue = e => [v[e], th[e], v[e + 1], th[e + 1]], uh = e => [vh[e], thh[e], vh[e + 1], thh[e + 1]];
    const mulAdd = (out, mat, s, x, sign = 1) => { for (let a = 0; a < 4; a++) { let sum = 0; for (let b = 0; b < 4; b++) sum += mat[4 * a + b] * x[b]; out[a] += sign * s * sum; } };
    // esforços nas pontas dos elementos do eixo e do cubo: forças que os nós aplicam no elemento [V1, M1, V2, M2]
    const ends = new Float64Array(ne * 4), phis = new Float64Array(ne), hubEnds = new Float64Array(ne * 4);
    model.elems.forEach((el, e) => {
      const L = el.L, phi = shear ? 12 * el.EI / (el.kGA * L * L) : 0, k = el.EI / ((1 + phi) * L ** 3), q = qe[e];
      phis[e] = phi;
      const out = [-q * L / 2, -q * L * L / 12, -q * L / 2, q * L * L / 12];
      mulAdd(out, keTim(L, phi), k, ue(e));
      const c = model.contact[e];
      if (c) { const d = ue(e).map((x, j) => x - uh(e)[j]); mulAdd(out, cHerm(L), c.kr * L / 420, d); }
      for (let a = 0; a < 4; a++) ends[4 * e + a] = out[a];
    });
    model.hubElems.forEach((h, e) => {
      if (!h) return;
      const L = h.L, phi = shear ? 12 * h.EI / (h.kGA * L * L) : 0, k = h.EI / ((1 + phi) * L ** 3), q = qh[e];
      const out = [-q * L / 2, -q * L * L / 12, -q * L / 2, q * L * L / 12];
      mulAdd(out, keTim(L, phi), k, uh(e));
      const c = model.contact[e];
      if (c) { const d = uh(e).map((x, j) => x - ue(e)[j]); mulAdd(out, cHerm(L), c.kr * L / 420, d); }
      for (let a = 0; a < 4; a++) hubEnds[4 * e + a] = out[a];
    });
    // cortante e momento em cada nó do eixo
    const nM = new Float64Array(nn), nVl = new Float64Array(nn), nVr = new Float64Array(nn);
    // pressão de contato no elemento: p(ξ) = kr·(vh − vs), cúbica (Hermite) — integrada dentro do elemento
    const pCoef = e => { const c = model.contact[e]; if (!c) return null; const d = uh(e).map((x, j) => x - ue(e)[j]); return vCoef(d, model.elems[e].L, 0).map(a => a * c.kr); };
    const seatF = model.hub ? model.hub.seats.map(() => 0) : [];
    const contactP = [];                                                                   // p(ξ) de cada elemento de assento (N/m)
    model.elems.forEach((el, e) => {
      const V1 = ends[4 * e], M1 = ends[4 * e + 1], q = qe[e], L = el.L, pc = pCoef(e);
      if (pc) contactP.push({ e, seat: model.contact[e].seat, x0: el.x0, x1: el.x1, L, pc });
      const intP = pc ? L * (pc[0] + pc[1] / 2 + pc[2] / 3 + pc[3] / 4) : 0;              // ∫ p dz no elemento
      const intP2 = pc ? L * L * (pc[0] / 2 + pc[1] / 6 + pc[2] / 12 + pc[3] / 20) : 0;    // ∫∫ p
      nM[e] = -M1; nVr[e] = V1; nVl[e + 1] = V1 + q * L + intP;
      if (e === ne - 1) nM[e + 1] = -M1 + V1 * L + q * L * L / 2 + intP2;
      if (pc) seatF[model.contact[e].seat] += intP;
    });
    const R = model.bearingNodes.map(b => (b > 0 ? ends[4 * (b - 1) + 2] : 0) + (b < ne ? ends[4 * b] : 0) - P[b]);
    let Ftot = 0;
    model.elems.forEach((el, e) => { Ftot += qe[e] * el.L; });
    model.hubElems.forEach((h, e) => { if (h) Ftot += qh[e] * h.L; });
    P.forEach(p => { Ftot += p; }); Ph.forEach(p => { Ftot += p; });
    const residual = (R.reduce((a, b) => a + b, 0) + Ftot) / Math.max(1, Math.abs(Ftot));
    // diagramas: V(z) = V1 + q·z + ∫p · M(z) = −M1 + V1·z + q·z²/2 + ∫∫p (positivo tracionando embaixo)
    const big = ne > 400, dx = [], dV = [], dM = [];
    model.elems.forEach((el, e) => {
      const V1 = ends[4 * e], M1 = ends[4 * e + 1], q = qe[e], L = el.L, pc = pCoef(e);
      let pts;
      if (pc) pts = big ? [0, L / 2, L] : Array.from({ length: 9 }, (_, k) => k * L / 8);
      else { pts = big ? [0, L] : [0, L / 4, L / 2, 3 * L / 4, L]; if (q && -V1 / q > 1e-9 * L && -V1 / q < (1 - 1e-9) * L) pts.push(-V1 / q); pts.sort((a, b) => a - b); }   // vértice da parábola (V = 0)
      for (const z of pts) {
        const xi = z / L;
        let Vz = V1 + q * z, Mz = -M1 + V1 * z + q * z * z / 2;
        if (pc) { Vz += L * (pc[0] * xi + pc[1] * xi ** 2 / 2 + pc[2] * xi ** 3 / 3 + pc[3] * xi ** 4 / 4); Mz += L * L * (pc[0] * xi ** 2 / 2 + pc[1] * xi ** 3 / 6 + pc[2] * xi ** 4 / 12 + pc[3] * xi ** 5 / 20); }
        dx.push(el.x0 + z * 1000); dV.push(Vz); dM.push(Mz);
      }
    });
    // momento no cubo (o que ele carrega dentro do assento)
    const hx = [], hM = [];
    model.hubElems.forEach((h, e) => {
      if (!h) return;
      const V1 = hubEnds[4 * e], M1 = hubEnds[4 * e + 1], q = qh[e], L = h.L, c = model.contact[e];
      const pc = c ? vCoef(ue(e).map((x, j) => x - uh(e)[j]), L, 0).map(a => a * c.kr) : null;
      for (const xi of big ? [0, 1] : [0, 0.25, 0.5, 0.75, 1]) {
        const z = xi * L;
        let Mz = -M1 + V1 * z + q * z * z / 2;
        if (pc) Mz += L * L * (pc[0] * xi ** 2 / 2 + pc[1] * xi ** 3 / 6 + pc[2] * xi ** 4 / 12 + pc[3] * xi ** 5 / 20);
        hx.push(h.x0 + z * 1000); hM.push(Mz);
      }
    });
    // deformada e rotação do eixo pelas funções de forma, com os extremos internos de v
    const px = [], pv = [], pt = [];
    const sub0 = big ? [0] : [0, 1 / 3, 2 / 3];
    model.elems.forEach((el, e) => {
      const u4 = ue(e), ext = vStationary(u4, el.L, phis[e]), sub = ext.length ? sub0.concat(ext).sort((a, b) => a - b) : sub0;
      for (const xi of sub) {
        const Nv = shapeV(xi, el.L, phis[e]), Nt = shapeT(xi, el.L, phis[e]);
        px.push(el.x0 + xi * (el.x1 - el.x0));
        pv.push(Nv[0] * u4[0] + Nv[1] * u4[1] + Nv[2] * u4[2] + Nv[3] * u4[3]);
        pt.push(Nt[0] * u4[0] + Nt[1] * u4[1] + Nt[2] * u4[2] + Nt[3] * u4[3]);
      }
    });
    px.push(model.xs[nn - 1]); pv.push(v[nn - 1]); pt.push(th[nn - 1]);
    let uf = 0; for (let k = 0; k < sys.n; k++) uf += u[k] * f[k];
    const Mu = bmul(sys.M, u, new Float64Array(sys.n));
    let uMu = 0; for (let k = 0; k < sys.n; k++) uMu += u[k] * Mu[k];
    return { v, th, vh, thh, R, ends, hubEnds, qe, qh, P, Ph, phis, residual, Ftot, seatF, contactP, nodal: { M: nM, Vl: nVl, Vr: nVr },
      diag: { x: dx, V: dV, M: dM }, hubDiag: { x: hx, M: hM }, plot: { x: px, v: pv, th: pt }, rayleighW2: uMu > 0 ? uf / uMu : NaN, ndof: sys.n, hb: sys.K.hb };
  }

  /* ---- Torção ------------------------------------------------------------------------------------------- */
  // o: { nodal: [{node, T, on}] torques concentrados (N·m), dist: [{a, b, T, on: 'hub'|'shaft'}] torques distribuídos (total T),
  //      fix: nó do eixo travado (o sistema é livre; as cargas se equilibram) }
  // Devolve o giro, o torque interno do eixo e do cubo nos dois lados de cada nó e o torque que cada assento passa ao cubo.
  // Torques distribuídos entram na solução como cargas consistentes (metade em cada nó) e no torque interno de forma
  // contínua dentro do elemento: os valores nos nós saem exatos para carga uniforme.
  function torsionSolve(model, o = {}) {
    const nn = model.nNodes, ne = model.elems.length, fix = o.fix ?? 0;
    const S = new Int32Array(nn).fill(-1), Hd = new Int32Array(nn).fill(-1);
    let n = 0;
    for (let i = 0; i < nn; i++) { if (i !== fix) S[i] = n++; if (model.hubAt[i]) Hd[i] = n++; }
    let hb = 1;
    for (let e = 0; e < ne; e++) {
      hb = Math.max(hb, span([S[e], S[e + 1]]));
      if (model.hubElems[e]) { hb = Math.max(hb, span([Hd[e], Hd[e + 1]])); if (model.contact[e]) hb = Math.max(hb, span([S[e], S[e + 1], Hd[e], Hd[e + 1]])); }
    }
    const K = band(n, hb), f = new Float64Array(n);
    const put2 = (g, k11, k12, k22) => { const [i, j] = g; if (i >= 0) badd(K, i, i, k11); if (j >= 0) badd(K, j, j, k22); if (i >= 0 && j >= 0) badd(K, i, j, k12); };
    model.elems.forEach((el, e) => { const k = el.GJ / el.L; put2([S[e], S[e + 1]], k, -k, k); });
    model.hubElems.forEach((h, e) => { if (h) { const k = h.GJ / h.L; put2([Hd[e], Hd[e + 1]], k, -k, k); } });
    model.contact.forEach((c, e) => {
      if (!c) return;
      const s = c.kt * model.elems[e].L / 6, gs = [S[e], S[e + 1]], gh = [Hd[e], Hd[e + 1]];
      put2(gs, 2 * s, s, 2 * s); put2(gh, 2 * s, s, 2 * s);
      const m = [[2 * s, s], [s, 2 * s]];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const i = gs[a], j = gh[b]; if (i >= 0 && j >= 0) badd(K, i, j, -m[a][b]); }
    });
    // torques aplicados: concentrados nos nós (eixo e cubo) e distribuídos por elemento (eixo e cubo)
    const Tp = new Float64Array(nn), Thp = new Float64Array(nn), Tel = new Float64Array(ne), Thel = new Float64Array(ne);
    for (const p of o.nodal || []) { if (p.on === 'hub' && model.hubAt[p.node]) Thp[p.node] += p.T; else Tp[p.node] += p.T; }
    for (const q of o.dist || []) {
      const len = q.b - q.a;
      if (!(len > 0)) continue;
      const onHub = q.on === 'hub';
      model.elems.forEach((el, e) => {
        if (onHub && !model.hubElems[e]) return;
        const ov = Math.max(0, Math.min(el.x1, q.b) - Math.max(el.x0, q.a));
        if (ov > 0) (onHub ? Thel : Tel)[e] += q.T * ov / len;
      });
    }
    for (let i = 0; i < nn; i++) {
      const sh = Tp[i] + (i > 0 ? Tel[i - 1] / 2 : 0) + (i < ne ? Tel[i] / 2 : 0), hu = Thp[i] + (i > 0 ? Thel[i - 1] / 2 : 0) + (i < ne ? Thel[i] / 2 : 0);
      if (S[i] >= 0) f[S[i]] += sh;
      if (Hd[i] >= 0) f[Hd[i]] += hu;
    }
    const Lc = bchol(K);
    if (!Lc) return null;
    const u = bsolve(Lc, f, new Float64Array(n));
    const phi = new Array(nn), phh = new Array(nn).fill(NaN);
    for (let i = 0; i < nn; i++) { phi[i] = S[i] >= 0 ? u[S[i]] : 0; if (Hd[i] >= 0) phh[i] = u[Hd[i]]; }
    // torque que cada elemento de assento passa do cubo para o eixo: ∫ kt·(φcubo − φeixo) dx
    const tc = new Float64Array(ne);
    model.contact.forEach((c, e) => { if (c) tc[e] = c.kt * model.elems[e].L / 2 * ((phh[e] - phi[e]) + (phh[e + 1] - phi[e + 1])); });
    // convenção: torque interno = soma dos torques aplicados à esquerda do corte (positivo = o que segue para a direita);
    // a reação do nó travado entra no balanço (é zero quando os torques aplicados se equilibram)
    let sumT = 0;
    for (let i = 0; i < nn; i++) sumT += Tp[i] + Thp[i];
    for (let e = 0; e < ne; e++) sumT += Tel[e] + Thel[e];
    const Tl = new Float64Array(nn), Tr = new Float64Array(nn), hTl = new Float64Array(nn).fill(NaN), hTr = new Float64Array(nn).fill(NaN);
    const seatT = model.hub ? model.hub.seats.map(() => 0) : [];
    let acc = 0, accH = 0;
    for (let i = 0; i < nn; i++) {
      Tl[i] = acc;
      acc += Tp[i] + (i === fix ? -sumT : 0);
      Tr[i] = acc;
      if (model.hubAt[i]) { hTl[i] = accH; accH += Thp[i]; hTr[i] = accH; }
      if (i < ne) {
        acc += Tel[i] + tc[i];
        if (model.hubElems[i]) accH += Thel[i] - tc[i];
        if (model.contact[i]) seatT[model.contact[i].seat] -= tc[i];        // positivo: sai do eixo para o cubo
      }
    }
    // end: torque que sobra depois do último nó — zero a menos do arredondamento (fecha o balanço do eixo)
    return { phi, phh, Tl, Tr, hTl, hTr, seatT, tc, Tfix: -sumT, end: acc, applied: { shaftPoint: Tp, shaftElem: Tel, hubPoint: Thp, hubElem: Thel }, n, hb };
  }

  return { buildModel, criticals, staticSolve, torsionSolve, criticalMap, rpmOf, shapeV, shapeT, vStationary, vCoef,
    _internal: { band, badd, bmul, bchol, bsolve, jacobi, geneig, dofMap, assemble, lowestModes, keTim, cHerm, rRot, mTim, rTim } };
});
