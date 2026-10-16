/* Laboratório de eixos · modelo de elementos finitos de viga (Timoshenko ou Euler–Bernoulli + inércia de rotação).
   Estática completa (deslocamentos, reações, esforços recuperados em cada elemento) e velocidades críticas
   não amortecidas, sem efeito giroscópico, com mancais rígidos ou molas. Malha conforme (nós em toda mudança
   de seção, carga e mancal) ou uniforme (didática: os degraus caem dentro dos elementos, com propriedades médias).
   Matrizes em banda (meia-largura 3): Cholesky em banda e iteração em subespaço, frações de milissegundo por
   solução, o que permite o mapa de críticas × rigidez e o estudo de convergência de malha.
   Unidades SI internas: m, N, kg, Pa. Sem dependências; funciona no navegador e no Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VGShaftFEM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HB = 3;                       // meia-largura de banda (2 GDL por nó, elementos de 2 nós)
  const W = HB + 1;

  /* ---- Matriz simétrica em banda: guarda A[i][i-j], j = 0..HB ---------------------------- */
  const band = n => new Float64Array(n * W);
  function badd(B, i, k, v) {           // soma em (i,k) e (k,i)
    if (i < 0 || k < 0) return;
    if (i >= k) B[i * W + (i - k)] += v; else B[k * W + (k - i)] += v;
  }
  function bmul(B, n, x, y) {           // y = B·x
    for (let i = 0; i < n; i++) {
      let s = B[i * W] * x[i];
      for (let j = 1; j <= HB && i - j >= 0; j++) { const a = B[i * W + j]; s += a * x[i - j]; y[i - j] += a * x[i]; }
      y[i] += s;
    }
    return y;
  }
  function bchol(B, n) {                // L·Lᵀ em banda; devolve null se não for positiva definida
    const L = new Float64Array(n * W);
    for (let i = 0; i < n; i++) {
      for (let k = Math.max(0, i - HB); k <= i; k++) {
        let s = B[i * W + (i - k)];
        for (let m = Math.max(0, i - HB); m < k; m++) s -= L[i * W + (i - m)] * L[k * W + (k - m)];
        if (i === k) { if (!(s > 0)) return null; L[i * W] = Math.sqrt(s); }
        else L[i * W + (i - k)] = s / L[k * W];
      }
    }
    return L;
  }
  function bsolve(L, n, b, x) {         // resolve L·Lᵀ·x = b
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let j = 1; j <= HB && i - j >= 0; j++) s -= L[i * W + j] * x[i - j];
      x[i] = s / L[i * W];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      for (let j = 1; j <= HB && i + j < n; j++) s -= L[(i + j) * W + j] * x[i + j];
      x[i] = s / L[i * W];
    }
    return x;
  }

  /* ---- Autovalores de matriz pequena simétrica (Jacobi cíclico) --------------------------- */
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
  // Kr·q = λ·Mr·q (p×p) via Cholesky de Mr
  function geneig(Kr, Mr, p) {
    const R = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) {
      let s = Mr[i][j];
      for (let k = 0; k < j; k++) s -= R[i][k] * R[j][k];
      if (i === j) { if (!(s > 0)) return null; R[i][i] = Math.sqrt(s); } else R[i][j] = s / R[j][j];
    }
    const Ri = Array.from({ length: p }, () => new Array(p).fill(0));     // R⁻¹ (triangular inferior)
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
    const Q = Array.from({ length: p }, () => new Array(p).fill(0));        // Q = R⁻ᵀ·Z
    order.forEach((o, c) => { for (let i = 0; i < p; i++) { let s = 0; for (let k = i; k < p; k++) s += Ri[k][i] * vecs[k][o]; Q[i][c] = s; } });
    return { vals: order.map(o => vals[o]), Q };
  }

  /* ---- Montagem do modelo ------------------------------------------------------------------ */
  // geo: { L (mm), secs: [{a,b,A,I,di,d}] (mm), E (MPa), nu, rho (kg/m³), bearings: [xA,xB] (mm),
  //        addMass: [{a,b,kgPerMm}], foundation: [{a,b,kPerMm (N/mm por mm)}], points: [x...] (forças),
  //        breaks: [x...], mesh: 'conforme' | 'uniforme', n: elementos (alvo), hmax (mm, sem n),
  //        nodes: [x...] (nós pedidos), refine: [{a, b, h}] (regiões com elemento de no máximo h mm), snap (mm) }
  function buildModel(geo) {
    const E = geo.E * 1e6, nu = geo.nu ?? 0.3, G = E / (2 * (1 + nu)), rho = geo.rho, Lt = geo.L;
    const type = geo.mesh === 'uniforme' ? 'uniforme' : 'conforme';
    const clean = arr => [...new Set(arr)].filter(x => x >= 0 && x <= Lt).sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-6);
    const snap = geo.snap ?? 1;                                                    // nós pedidos a menos disso de um obrigatório juntam-se a ele
    const close = (list, x, tol = snap) => list.some(v => Math.abs(v - x) < tol);
    const zones = (geo.refine || []).map(z => ({ a: Math.max(0, z.a), b: Math.min(Lt, z.b), h: z.h })).filter(z => z.b > z.a && z.h > 0);
    const hZone = (a, b) => { const m = (a + b) / 2; let h = Infinity; for (const z of zones) if (m >= z.a && m <= z.b && z.h < h) h = z.h; return h; };
    const base = clean([0, Lt, ...geo.bearings, ...(geo.points || [])]);          // mancais e forças sempre em nós
    const forced = clean(base.concat((geo.nodes || []).filter(x => x > 0 && x < Lt && !close(base, x))));
    let xs;
    if (type === 'uniforme') {
      const n = Math.max(2, Math.round(geo.n || 100)), h = Lt / n;
      xs = Array.from({ length: n + 1 }, (_, k) => k === n ? Lt : k * h);          // a ponta exata: n·h pode passar de L por arredondamento
      for (const f of forced) {
        const k = Math.round(f / h);
        if (f === 0 || f === Lt) continue;
        if (k > 0 && k < n && Math.abs(xs[k] - f) <= 0.25 * h && !forced.includes(xs[k])) xs[k] = f; else xs.push(f);
      }
      xs = clean(xs);
      // refino: cada elemento da grade com o meio numa região é dividido até ficar com no máximo h
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
      for (const f of geo.foundation || []) set.push(f.a, f.b);
      let bp = clean(set);
      // as pontas de cada região de refino também viram nós, salvo se um nó já existe a menos de h/2 (evita lascas)
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
    const near = x => {                                                            // nó mais próximo (busca binária)
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
      return Math.abs(xs[hi] - x) < Math.abs(xs[lo] - x) ? hi : lo;
    };
    // propriedades de cada elemento integradas sobre os trechos que ele cobre: rigidez à flexão e ao cisalhamento
    // pela média harmônica (flexibilidades somam em série), massa, inércia de rotação e peso pela média simples.
    // Na malha conforme cada elemento fica dentro de um só trecho e as médias são os valores exatos do trecho.
    const elems = [];
    let si = 0, hmin = Infinity, hmx = 0;
    const kapOf = s => { const m = s.di > 0 ? s.di / s.d : 0; return 6 * (1 + nu) * (1 + m * m) ** 2 / ((7 + 6 * nu) * (1 + m * m) ** 2 + (20 + 12 * nu) * m * m); };
    for (let e = 0; e < xs.length - 1; e++) {
      const x0 = xs[e], x1 = xs[e + 1], h = x1 - x0, xm = (x0 + x1) / 2;
      while (si < geo.secs.length - 1 && x0 >= geo.secs[si].b) si++;
      let fEI = 0, fGA = 0, mA = 0, mI = 0, kap = 1, sm = si;
      for (let j = si; j < geo.secs.length && geo.secs[j].a < x1; j++) {
        const s = geo.secs[j], len = Math.min(x1, s.b) - Math.max(x0, s.a);
        if (!(len > 0)) continue;
        const A = s.A * 1e-6, I = s.I * 1e-12, k = kapOf(s);
        fEI += len / (E * I); fGA += len / (k * G * A); mA += rho * A * len; mI += rho * I * len;
        if (xm >= s.a && xm <= s.b) { kap = k; sm = j; }
      }
      let mAdd = 0, kf = 0;
      for (const a of geo.addMass || []) { const ov = Math.min(x1, a.b) - Math.max(x0, a.a); if (ov > 0) mAdd += a.kgPerMm * 1000 * ov / h; }      // kg/m
      for (const f of geo.foundation || []) { const ov = Math.min(x1, f.b) - Math.max(x0, f.a); if (ov > 0) kf += f.kPerMm * 1e6 * ov / h; }     // N/m por m
      elems.push({ x0, x1, L: h / 1000, EI: h / fEI, kGA: h / fGA, rhoA: mA / h, rhoI: mI / h, mAdd, kf, kappa: kap, sec: sm });
      hmin = Math.min(hmin, h); hmx = Math.max(hmx, h);
    }
    const userNodes = (geo.nodes || []).map(x => near(x));                         // onde cada nó pedido ficou na malha
    const info = { type, target: geo.n || null, ne: elems.length, nn: xs.length, ndof: 2 * xs.length, hmin, hmax: hmx, zones: zones.length, user: new Set(userNodes).size };
    return { xs, elems, bearingNodes: geo.bearings.map(near), nNodes: xs.length, info, zones, userNodes, near };
  }
  // GDL livres: v (transversal) e θ por nó; apoio rígido remove v do nó do mancal
  function dofMap(model, rigid) {
    const map = new Int32Array(model.nNodes * 2).fill(-1);
    let n = 0;
    for (let i = 0; i < model.nNodes; i++) {
      if (!(rigid && model.bearingNodes.includes(i))) map[2 * i] = n++;
      map[2 * i + 1] = n++;
    }
    return { map, n };
  }
  function assemble(model, dm, opt = {}) {
    const n = dm.n, K = band(n), M = band(n);
    const shear = opt.shear !== false, rotary = opt.rotary !== false, found = opt.foundation !== false;
    for (let e = 0; e < model.elems.length; e++) {
      const el = model.elems[e], L = el.L, L2 = L * L;
      const phi = shear ? 12 * el.EI / (el.kGA * L2) : 0;
      const k = el.EI / ((1 + phi) * L2 * L);
      const Ke = [12, 6 * L, -12, 6 * L, 6 * L, (4 + phi) * L2, -6 * L, (2 - phi) * L2, -12, -6 * L, 12, -6 * L, 6 * L, (2 - phi) * L2, -6 * L, (4 + phi) * L2];
      const C = [156, 22 * L, 54, -13 * L, 22 * L, 4 * L2, 13 * L, -3 * L2, 54, 13 * L, 156, -22 * L, -13 * L, -3 * L2, -22 * L, 4 * L2];
      const Rr = [36, 3 * L, -36, 3 * L, 3 * L, 4 * L2, -3 * L, -L2, -36, -3 * L, 36, -3 * L, 3 * L, -L2, -3 * L, 4 * L2];
      const mt = (el.rhoA + el.mAdd) * L / 420, mr = rotary ? el.rhoI / (30 * L) : 0, kf = found ? el.kf * L / 420 : 0;
      const g = [dm.map[2 * e], dm.map[2 * e + 1], dm.map[2 * e + 2], dm.map[2 * e + 3]];
      for (let a = 0; a < 4; a++) for (let b = 0; b <= a; b++) {
        const i = g[a], j = g[b];
        if (i < 0 || j < 0) continue;
        const q = 4 * a + b;
        badd(K, i, j, k * Ke[q] + kf * C[q]);
        badd(M, i, j, mt * C[q] + mr * Rr[q]);
      }
    }
    return { K, M, n };
  }

  /* ---- Iteração em subespaço (q modos mais baixos) ------------------------------------------- */
  function lowestModes(sys, q = 3, start = null, model = null, dm = null) {
    const { K, M, n } = sys;
    const L = bchol(K, n);
    if (!L) return { ok: false, reason: 'singular' };
    const p = Math.min(n, Math.max(q + 5, 2 * q));
    let X;
    if (start && start.length === p && start[0].length === n) X = start.map(c => Float64Array.from(c));
    else {
      X = [];
      const x0 = model.xs[0], x1 = model.xs[model.xs.length - 1];
      for (let c = 0; c < p; c++) {
        const v = new Float64Array(n);
        for (let i = 0; i < model.nNodes; i++) {
          const xi = (model.xs[i] - x0) / (x1 - x0);
          const iv = dm.map[2 * i], it = dm.map[2 * i + 1];
          if (iv >= 0) v[iv] = c === 0 ? 1 : Math.sin((c + (c >= p - 2 ? 0.5 : 0)) * Math.PI * xi);
          if (it >= 0) v[it] = 1e-3 * Math.cos(c * Math.PI * xi);
        }
        X.push(v);
      }
    }
    let prev = null, vals = null;
    const Y = Array.from({ length: p }, () => new Float64Array(n)), Xb = Array.from({ length: p }, () => new Float64Array(n)), MX = Array.from({ length: p }, () => new Float64Array(n));
    let it = 0;
    for (; it < 80; it++) {
      for (let c = 0; c < p; c++) { Y[c].fill(0); bmul(M, n, X[c], Y[c]); bsolve(L, n, Y[c], Xb[c]); MX[c].fill(0); bmul(M, n, Xb[c], MX[c]); }
      const Kr = Array.from({ length: p }, () => new Array(p).fill(0)), Mr = Array.from({ length: p }, () => new Array(p).fill(0));
      for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) {
        let sk = 0, sm = 0;
        const xi = Xb[i], yj = Y[j], mj = MX[j];
        for (let k = 0; k < n; k++) { sk += xi[k] * yj[k]; sm += xi[k] * mj[k]; }
        Kr[i][j] = Kr[j][i] = sk; Mr[i][j] = Mr[j][i] = sm;
      }
      const ge = geneig(Kr, Mr, p);
      if (!ge) return { ok: false, reason: 'subspace' };
      vals = ge.vals;
      const Xn = Array.from({ length: p }, () => new Float64Array(n));
      for (let c = 0; c < p; c++) for (let j = 0; j < p; j++) { const qv = ge.Q[j][c]; if (qv) { const xb = Xb[j], xn = Xn[c]; for (let k = 0; k < n; k++) xn[k] += xb[k] * qv; } }
      X = Xn;
      if (prev && vals.slice(0, q).every((v, i) => Math.abs(v - prev[i]) <= 1e-11 * Math.abs(v))) break;
      prev = vals.slice(0, q);
    }
    return { ok: true, vals: vals.slice(0, q), X, iterations: it + 1 };
  }
  // forma modal nos nós (v), normalizada pelo maior módulo
  function shapeOf(model, dm, vec) {
    const v = new Array(model.nNodes).fill(0);
    for (let i = 0; i < model.nNodes; i++) { const k = dm.map[2 * i]; v[i] = k >= 0 ? vec[k] : 0; }
    // normaliza pelo maior módulo; o sinal deixa positivo o maior deslocamento entre os mancais
    const [ia, ib] = [Math.min(...model.bearingNodes), Math.max(...model.bearingNodes)];
    let big = 0, spanBig = 0, sgn = 1;
    v.forEach((a, i) => { if (Math.abs(a) > big) big = Math.abs(a); if (i >= ia && i <= ib && Math.abs(a) > spanBig) { spanBig = Math.abs(a); sgn = Math.sign(a) || 1; } });
    return v.map(a => big > 0 ? a / big * sgn : 0);
  }
  const rpmOf = lam => lam > 0 ? Math.sqrt(lam) * 60 / (2 * Math.PI) : NaN;

  /* ---- Análises -------------------------------------------------------------------------------- */
  // sistema base (sem molas) guardado no modelo: o mapa só soma as molas e refatora
  function baseSystem(model, rigid, o) {
    const key = [rigid ? 'r' : 'f', o.foundation !== false ? 1 : 0, o.shear !== false ? 1 : 0, o.rotary !== false ? 1 : 0].join('');
    model._cache = model._cache || {};
    if (!model._cache[key]) { const dm = dofMap(model, rigid); model._cache[key] = { dm, sys: assemble(model, dm, { foundation: o.foundation, shear: o.shear, rotary: o.rotary }) }; }
    return model._cache[key];
  }
  function withSprings(model, base, springs) {
    if (!springs) return base.sys;
    const K = base.sys.K.slice();
    springs.forEach((kb, s) => { const i = base.dm.map[2 * model.bearingNodes[s]]; if (i >= 0 && kb > 0) badd(K, i, i, kb); });
    return { K, M: base.sys.M, n: base.sys.n };
  }
  // críticas com apoios rígidos ou molas (N/m); q modos
  function criticals(model, o = {}) {
    const rigid = !(o.springs && o.springs.every(k => k > 0));
    const base = baseSystem(model, rigid, o);
    const sys = withSprings(model, base, rigid ? null : o.springs);
    const res = lowestModes(sys, o.q || 3, o.start, model, base.dm);
    if (!res.ok) return { ok: false, reason: res.reason };
    return { ok: true, rigid, rpm: res.vals.map(rpmOf), w: res.vals.map(l => Math.sqrt(Math.max(0, l))), shapes: res.vals.map((_, i) => shapeOf(model, base.dm, res.X[i])), X: res.X, iterations: res.iterations };
  }
  // funções de forma da viga de Timoshenko com interpolação interdependente (Φ = 0: Hermite de Euler–Bernoulli)
  function shapeV(xi, L, phi) {
    const c = 1 / (1 + phi), x2 = xi * xi, x3 = x2 * xi;
    return [c * (2 * x3 - 3 * x2 - phi * xi + 1 + phi), c * L * (x3 - (2 + phi / 2) * x2 + (1 + phi / 2) * xi),
      c * (-2 * x3 + 3 * x2 + phi * xi), c * L * (x3 - (1 - phi / 2) * x2 - (phi / 2) * xi)];
  }
  function shapeT(xi, L, phi) {
    const c = 1 / (1 + phi), x2 = xi * xi;
    return [c * 6 / L * (x2 - xi), c * (3 * x2 - (4 + phi) * xi + 1 + phi), c * 6 / L * (xi - x2), c * (3 * x2 - (2 - phi) * xi)];
  }
  // extremos internos do deslocamento interpolado: v(ξ) é cúbico no elemento, dv/dξ = 0 tem até duas raízes em (0, 1)
  function vStationary(ue, L, phi) {
    const c = 1 / (1 + phi);
    const a3 = c * (2 * ue[0] + L * ue[1] - 2 * ue[2] + L * ue[3]);
    const a2 = c * (-3 * ue[0] - (2 + phi / 2) * L * ue[1] + 3 * ue[2] - (1 - phi / 2) * L * ue[3]);
    const a1 = c * (-phi * ue[0] + (1 + phi / 2) * L * ue[1] + phi * ue[2] - (phi / 2) * L * ue[3]);
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
  function elemK(el, shear) {
    const L = el.L, L2 = L * L;
    const phi = shear ? 12 * el.EI / (el.kGA * L2) : 0;
    const k = el.EI / ((1 + phi) * L2 * L);
    return { phi, K: [12, 6 * L, -12, 6 * L, 6 * L, (4 + phi) * L2, -6 * L, (2 - phi) * L2, -12, -6 * L, 12, -6 * L, 6 * L, (2 - phi) * L2, -6 * L, (4 + phi) * L2].map(v => v * k) };
  }
  // estática por MEF: cargas nodais consistentes (qL/2, qL²/12), forças nos nós, apoios rígidos ou molas.
  // Devolve deslocamentos nodais, reações, esforços nas pontas de cada elemento (f = Ke·ue − feq),
  // diagramas de V e M recuperados por equilíbrio dentro de cada elemento e a curva interpolada.
  function staticSolve(model, o = {}) {
    const rigid = !(o.springs && o.springs.every(k => k > 0));
    const shear = o.shear !== false;
    const base = baseSystem(model, rigid, { foundation: false, shear, rotary: o.rotary });
    const dm = base.dm, sys = withSprings(model, base, rigid ? null : o.springs);
    const Lc = bchol(sys.K, sys.n);
    if (!Lc) return null;
    const ne = model.elems.length, nn = model.nNodes;
    const f = new Float64Array(sys.n), qe = new Float64Array(ne), P = new Float64Array(nn);
    const addAt = (node, dof, val) => { const k = dm.map[2 * node + dof]; if (k >= 0) f[k] += val; };
    model.elems.forEach((el, e) => {
      const q = o.q ? o.q((el.x0 + el.x1) / 2, el) : 0;
      qe[e] = q;
      if (!q) return;
      addAt(e, 0, q * el.L / 2); addAt(e, 1, q * el.L * el.L / 12); addAt(e + 1, 0, q * el.L / 2); addAt(e + 1, 1, -q * el.L * el.L / 12);
    });
    for (const p of o.points || []) {
      let best = 0, bd = Infinity;
      model.xs.forEach((x, i) => { const d = Math.abs(x - p.x); if (d < bd) { bd = d; best = i; } });
      P[best] += p.F;
      addAt(best, 0, p.F);
    }
    const u = bsolve(Lc, sys.n, f, new Float64Array(sys.n));
    const v = new Array(nn).fill(0), th = new Array(nn).fill(0);
    for (let i = 0; i < nn; i++) { const a = dm.map[2 * i], b = dm.map[2 * i + 1]; v[i] = a >= 0 ? u[a] : 0; th[i] = b >= 0 ? u[b] : 0; }
    // esforços nas pontas: forças que os nós aplicam no elemento [V1, M1, V2, M2] (N, N·m; anti-horário +)
    const ends = new Float64Array(ne * 4), phis = new Float64Array(ne);
    model.elems.forEach((el, e) => {
      const { phi, K } = elemK(el, shear);
      phis[e] = phi;
      const ue = [v[e], th[e], v[e + 1], th[e + 1]], q = qe[e], L = el.L;
      const feq = [q * L / 2, q * L * L / 12, q * L / 2, -q * L * L / 12];
      for (let a = 0; a < 4; a++) { let sum = 0; for (let b = 0; b < 4; b++) sum += K[4 * a + b] * ue[b]; ends[4 * e + a] = sum - feq[a]; }
    });
    // esforços em cada nó: momento (contínuo) e cortante dos dois lados (salta onde há força)
    const nM = new Float64Array(nn), nVl = new Float64Array(nn), nVr = new Float64Array(nn);
    model.elems.forEach((el, e) => {
      const V1 = ends[4 * e], M1 = ends[4 * e + 1], q = qe[e], L = el.L;
      nM[e] = -M1; nVr[e] = V1; nVl[e + 1] = V1 + q * L;
      if (e === ne - 1) nM[e + 1] = -M1 + V1 * L + q * L * L / 2;
    });
    // reações: equilíbrio de cada nó de mancal, R = Σ esforços dos elementos − força aplicada no nó
    const R = model.bearingNodes.map(b => (b > 0 ? ends[4 * (b - 1) + 2] : 0) + (b < ne ? ends[4 * b] : 0) - P[b]);
    let Ftot = 0; model.elems.forEach((el, e) => { Ftot += qe[e] * el.L; }); P.forEach(p => { Ftot += p; });
    const residual = (R.reduce((a, b) => a + b, 0) + Ftot) / Math.max(1, Math.abs(Ftot));
    // diagramas por equilíbrio dentro do elemento: V(ξ) = V1 + q·ξ · M(ξ) = −M1 + V1·ξ + q·ξ²/2 (positivo tracionando embaixo)
    const big = ne > 400, dx = [], dV = [], dM = [];
    model.elems.forEach((el, e) => {
      const V1 = ends[4 * e], M1 = ends[4 * e + 1], q = qe[e], L = el.L;
      const pts = big ? [0, L] : [0, L / 4, L / 2, 3 * L / 4, L];
      if (q && -V1 / q > 0 && -V1 / q < L) pts.push(-V1 / q);                // vértice da parábola (V = 0)
      pts.sort((a, b) => a - b);
      for (const z of pts) { dx.push(el.x0 + z * 1000); dV.push(V1 + q * z); dM.push(-M1 + V1 * z + q * z * z / 2); }
    });
    // curva deformada e rotação interpoladas com as funções de forma do próprio elemento,
    // com os extremos internos de v: a flecha máxima sai do campo do MEF, não só dos nós
    const px = [], pv = [], pt = [];
    const sub0 = big ? [0] : [0, 1 / 3, 2 / 3];
    model.elems.forEach((el, e) => {
      const ue = [v[e], th[e], v[e + 1], th[e + 1]];
      const ext = vStationary(ue, el.L, phis[e]);
      const sub = ext.length ? sub0.concat(ext).sort((a, b) => a - b) : sub0;
      for (const xi of sub) {
        const Nv = shapeV(xi, el.L, phis[e]), Nt = shapeT(xi, el.L, phis[e]);
        px.push(el.x0 + xi * (el.x1 - el.x0));
        pv.push(Nv[0] * ue[0] + Nv[1] * ue[1] + Nv[2] * ue[2] + Nv[3] * ue[3]);
        pt.push(Nt[0] * ue[0] + Nt[1] * ue[1] + Nt[2] * ue[2] + Nt[3] * ue[3]);
      }
    });
    px.push(model.xs[nn - 1]); pv.push(v[nn - 1]); pt.push(th[nn - 1]);
    let uf = 0; for (let k = 0; k < sys.n; k++) uf += u[k] * f[k];
    const Mu = bmul(sys.M, sys.n, u, new Float64Array(sys.n));
    let uMu = 0; for (let k = 0; k < sys.n; k++) uMu += u[k] * Mu[k];
    return { v, th, R, ends, qe, P, phis, residual, Ftot, nodal: { M: nM, Vl: nVl, Vr: nVr }, diag: { x: dx, V: dV, M: dM }, plot: { x: px, v: pv, th: pt }, rayleighW2: uMu > 0 ? uf / uMu : NaN, ndof: sys.n };
  }
  // mapa de críticas × rigidez dos mancais (mesma rigidez nos dois)
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

  return { buildModel, criticals, staticSolve, criticalMap, rpmOf, shapeV, shapeT, vStationary, _internal: { band, badd, bmul, bchol, bsolve, jacobi, geneig, dofMap, assemble, lowestModes, elemK } };
});
