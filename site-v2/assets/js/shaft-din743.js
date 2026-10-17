/* Laboratório de eixos · resistência de eixos pela DIN 743:2012 (partes 1 a 3).
   Funções puras, sem DOM: fatores de material (K1), tamanho (K2, K3), rugosidade (KF), entalhe (α, G′, n, β)
   para ombros, rasgos de chaveta, ajustes prensados e entalhes informados; limites com entalhe (σWK, σFK),
   influência da tensão média (ψ, casos 1 e 2) e coeficientes de segurança à fadiga (S_D) e ao escoamento (S_F).
   Tensões em MPa, diâmetros e raios em mm, momento em N·mm, torque em N·m, força em N.
   No navegador: window.VGDIN743. No Node: require('./shaft-din743.js'). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VGDIN743 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const lg = Math.log10, SQ3 = Math.sqrt(3), PI = Math.PI;

  /* ---- Parte 3: fator tecnológico de tamanho K1(deff) ------------------------------------------- */
  // grupos de material e a curva de K1 para a ruptura (B) e o escoamento (S); dB = Ø de referência dos valores de norma
  const GROUPS = {
    beneficiado: { label: 'Aço beneficiado (C45, 42CrMo4, 34CrNiMo6)', dB: 16, B: 'qtB', S: 'qtS' },
    estrutural: { label: 'Aço estrutural (S235 a S355)', dB: 16, B: 'stB', S: 'stS' },
    cementado: { label: 'Aço de cementação (16MnCr5, 20MnCr5)', dB: 16, B: 'ch', S: 'ch' },
    cementadoCrNiMo: { label: 'Aço de cementação CrNiMo (18CrNiMo7-6)', dB: 16, B: 'qtB', S: 'qtB' },
    nitretado: { label: 'Aço de nitretação (31CrMoV9)', dB: 100, B: 'nit', S: 'nit' }
  };
  // curvas: [d0 (K1 = 1 até aqui), fórmula até d1, valor constante de d1 a 500 mm]
  const CURVES = {
    qtB: { d0: 16, d1: 300, f: d => 1 - 0.26 * lg(d / 16), c: 0.67, txt: 'K1 = 1 − 0,26·lg(deff/16)' },
    qtS: { d0: 16, d1: 300, f: d => 1 - 0.34 * lg(d / 16), c: 0.57, txt: 'K1 = 1 − 0,34·lg(deff/16)' },
    stB: { d0: 100, d1: 300, f: d => 1 - 0.23 * lg(d / 100), c: 0.89, txt: 'K1 = 1 − 0,23·lg(deff/100)' },
    stS: { d0: 32, d1: 300, f: d => 1 - 0.26 * lg(d / 32), c: 0.75, txt: 'K1 = 1 − 0,26·lg(deff/32)' },
    ch: { d0: 16, d1: 150, f: d => 1 - 0.41 * lg(d / 16), c: 0.60, txt: 'K1 = 1 − 0,41·lg(deff/16)' },
    nit: { d0: 100, d1: 300, f: d => 1 - 0.23 * lg(d / 100), c: 0.89, txt: 'K1 = 1 − 0,23·lg(deff/100)' }
  };
  function K1(group, deff, which) {
    const g = GROUPS[group] || GROUPS.beneficiado, c = CURVES[which === 'S' ? g.S : g.B];
    if (!(deff > c.d0)) return { k: 1, txt: `deff ≤ ${c.d0} mm → K1 = 1`, over: false };
    if (deff <= c.d1) return { k: c.f(deff), txt: c.txt, over: false };
    return { k: c.c, txt: `${c.d1} < deff ≤ 500 mm → K1 = ${String(c.c).replace('.', ',')}`, over: deff > 500 };
  }

  /* ---- Parte 2: fatores de tamanho geométrico e de rugosidade ------------------------------------ */
  // K2(d): tração/compressão 1; flexão e torção caem até 0,8 a partir de 150 mm
  function K2(d, load) {
    if (load === 'zd' || !(d > 7.5)) return 1;
    return d >= 150 ? 0.8 : 1 - 0.2 * lg(d / 7.5) / lg(20);
  }
  // K3(d) com α (ou β no Ø de referência, para rasgos e ajustes): leva β do Ø de ensaio para o Ø da peça
  function K3(d, a) {
    if (!(d > 7.5)) return 1;
    return d >= 150 ? 1 - 0.2 * lg(a) : 1 - 0.2 * lg(a) * lg(d / 7.5) / lg(20);
  }
  // rugosidade: KFσ = 1 − 0,22·lg(Rz/µm)·(lg(σB(d)/20 MPa) − 1); KFτ = 0,575·KFσ + 0,425
  function KF(Rz, sB) {
    const s = Rz > 1 ? 1 - 0.22 * lg(Rz) * (lg(sB / 20) - 1) : 1;
    return { s, t: 0.575 * s + 0.425 };
  }

  /* ---- Entalhes ----------------------------------------------------------------------------------- */
  // ombro (Absatz): α = 1 + 1/√(A·r/t + 2B·(r/d)·(1 + 2r/d)² + C·(r/t)^z·d/D)
  const SHOULDER = { zd: { A: 0.22, B: 1.37, C: 0, z: 1 }, b: { A: 0.62, B: 5.8, C: 0.2, z: 3 }, t: { A: 3.4, B: 19, C: 1, z: 2 } };
  function alphaShoulder(d, D, r) {
    const t = (D - d) / 2, out = { t, valid: true, notes: [] };
    for (const k of ['zd', 'b', 't']) {
      const c = SHOULDER[k];
      out[k] = Math.min(6, 1 + 1 / Math.sqrt(c.A * r / t + 2 * c.B * (r / d) * (1 + 2 * r / d) ** 2 + c.C * (r / t) ** c.z * d / D));
    }
    if (r / t < 0.03) { out.valid = false; out.notes.push('r/t < 0,03: fora da faixa da fórmula'); }
    if (d / D > 0.98) { out.valid = false; out.notes.push('d/D > 0,98: degrau pequeno demais para a fórmula'); }
    return out;
  }
  // gradiente relativo de tensão G′ (mm⁻¹) no ombro: flexão e tração 2,3·(1+φ)/r, torção 1,15/r; φ = 1/(4√(t/r) + 2) se d/D > 0,67
  function gradShoulder(d, D, r) {
    const t = (D - d) / 2, phi = d / D > 0.67 ? 1 / (4 * Math.sqrt(t / r) + 2) : 0;
    return { phi, zd: 2.3 * (1 + phi) / r, b: 2.3 * (1 + phi) / r, t: 1.15 / r };
  }
  // número de apoio n(G′): 1 + √G′·10^−(0,33 + σS(d)/712) até 1 mm⁻¹; 1 + G′^(1/4)·10^−(…) de 1 a 100 mm⁻¹
  function nOf(G, sS) {
    if (!(G > 0)) return 1;
    const e = Math.pow(10, -(0.33 + sS / 712));
    return 1 + (G <= 1 ? Math.sqrt(G) : Math.pow(Math.min(G, 100), 0.25)) * e;
  }
  // rasgo de chaveta (Passfeder) e ajuste prensado (Pressverband): β no Ø de ensaio dBK = 40 mm, levado ao Ø d por K3
  const DBK = 40;
  function betaKey(sB, d, nk = 1) {
    const b0 = 3.0 * Math.pow(sB / 1000, 0.38), t0 = 0.56 * b0 + 0.1, f2 = nk >= 2 ? 1.15 : 1;
    const b = b0 * K3(DBK, b0) / K3(d, b0) * f2, t = t0 * K3(DBK, t0) / K3(d, t0) * f2;
    return { b0, t0, b, t, zd: b, f2 };
  }
  function betaFit(sB, d) {
    const b0 = 2.7 * Math.pow(sB / 1000, 0.43), t0 = 0.65 * b0;
    const b = b0 * K3(DBK, b0) / K3(d, b0), t = t0 * K3(DBK, t0) / K3(d, t0);
    return { b0, t0, b, t, zd: b };
  }
  // aumento estático por entalhe γF (só entalhes circunferenciais, flexão e tração; torção 1)
  const gammaF = a => !(a >= 1.5) ? 1 : a < 2 ? 1.05 : a < 3 ? 1.1 : 1.15;

  /* ---- Ponto de verificação ------------------------------------------------------------------------- */
  // p: { kind: 'ombro'|'chaveta'|'ajuste'|'manual'|'liso', d, di, D, r, nk, bs, bt, Wb, Wt, A (mm³, mm³, mm²), M (N·mm), T (N·m), F (N) }
  // mat: { sB, sS (MPa no Ø de referência ou do certificado), basis: 'peca'|'norma', group, deff, K1B, K1S (opcional, força) }
  // o: { Rz, KV, lc: 1|2, ripple (τa/τm), peak (Tmáx/T), Smin }
  function evaluate(p, mat, o) {
    const out = { kind: p.kind, d: p.d, notes: [] };
    // material no Ø da peça
    let k1B = 1, k1S = 1, k1info = null;
    if (mat.basis === 'norma') {
      const a = K1(mat.group, mat.deff, 'B'), b = K1(mat.group, mat.deff, 'S');
      k1B = mat.K1B ?? a.k; k1S = mat.K1S ?? b.k; k1info = { B: a, S: b };
      if (a.over) out.notes.push('deff acima de 500 mm: K1 a combinar com o fornecedor');
    }
    const sB = k1B * mat.sB, sS = k1S * mat.sS;
    out.mat = { k1B, k1S, sB, sS, k1info };
    // tensões nominais (eixo girando: flexão alternada; torque e força axial constantes)
    const sba = Math.abs(p.M) / p.Wb, tm = Math.abs(p.T) * 1000 / p.Wt, sm = p.F / p.A;
    const ta = (o.ripple || 0) * tm;
    out.s = { sba, sbm: 0, szda: 0, szdm: sm, tta: ta, ttm: tm, sbmax: sba, szdmax: Math.abs(sm), ttmax: (o.peak || 1) * tm };
    // entalhe
    let a = { zd: 1, b: 1, t: 1 }, beta = { zd: 1, b: 1, t: 1 }, G = null, n = null, extra = {};
    if (p.kind === 'ombro') {
      const al = alphaShoulder(p.d, p.D, p.r);
      if (!al.valid && p.d / p.D > 0.98) { out.notes.push('degrau com d/D > 0,98: tratado como seção lisa'); }
      else {
        if (!al.valid) out.notes.push(...al.notes);
        a = { zd: al.zd, b: al.b, t: al.t };
        G = gradShoulder(p.d, p.D, p.r);
        n = { zd: nOf(G.zd, sS), b: nOf(G.b, sS), t: nOf(G.t, sS) };
        beta = { zd: Math.max(1, a.zd / n.zd), b: Math.max(1, a.b / n.b), t: Math.max(1, a.t / n.t) };
        extra.tShoulder = al.t;
      }
    } else if (p.kind === 'chaveta') { const k = betaKey(sB, p.d, p.nk || 1); beta = { zd: k.zd, b: k.b, t: k.t }; extra.key = k; }
    else if (p.kind === 'ajuste') { const k = betaFit(sB, p.d); beta = { zd: k.zd, b: k.b, t: k.t }; extra.fit = k; }
    else if (p.kind === 'manual') beta = { zd: p.bs, b: p.bs, t: p.bt };
    out.alpha = a; out.G = G; out.n = n; out.beta = beta; out.extra = extra;
    // tamanho, rugosidade e superfície
    const k2 = { zd: K2(p.d, 'zd'), b: K2(p.d, 'b'), t: K2(p.d, 't') }, kf = KF(o.Rz, sB), KV = o.KV || 1;
    const K = {
      zd: (beta.zd / k2.zd + 1 / kf.s - 1) / KV,
      b: (beta.b / k2.b + 1 / kf.s - 1) / KV,
      t: (beta.t / k2.t + 1 / kf.t - 1) / KV
    };
    out.k2 = k2; out.kf = kf; out.KV = KV; out.K = K;
    // limites de fadiga do material no Ø d e da peça com entalhe
    const W = { zd: 0.4 * sB, b: 0.5 * sB, t: 0.3 * sB };
    const WK = { zd: W.zd / K.zd, b: W.b / K.b, t: W.t / K.t };
    const psi = { zd: WK.zd / (2 * sB - WK.zd), b: WK.b / (2 * sB - WK.b), t: WK.t / (2 * sB - WK.t) };
    out.W = W; out.WK = WK; out.psi = psi;
    // escoamento com apoio: σFK = K2F·γF·σS(d)
    const hollow = p.di > 0, hard = KV > 1;
    const k2F = { zd: 1, b: hard ? 1 : hollow ? 1.1 : 1.2, t: hard ? 1 : hollow ? 1 : 1.2 };
    const circ = p.kind === 'ombro' || p.kind === 'liso';
    const gF = { zd: circ ? gammaF(a.zd) : 1, b: circ ? gammaF(a.b) : 1, t: 1 };
    const FK = { zd: k2F.zd * gF.zd * sS, b: k2F.b * gF.b * sS, t: k2F.t * gF.t * sS / SQ3 };
    out.k2F = k2F; out.gF = gF; out.FK = FK;
    // tensão média equivalente e amplitude admissível (caso 1: σm constante; caso 2: σm/σa constante)
    const smv = Math.sqrt((out.s.szdm + out.s.sbm) ** 2 + 3 * tm * tm), tmv = smv / SQ3;
    out.mv = { s: smv, t: tmv };
    const adk = (WKk, psik, FKk, mv, amp) => {
      if (o.lc === 1) {
        if (mv <= (FKk - WKk) / (1 - psik)) return { v: Math.max(0, WKk - psik * mv), branch: 'fadiga' };
        return { v: Math.max(0, FKk - mv), branch: 'escoamento' };
      }
      if (!(amp > 0)) return { v: NaN, branch: 'sem amplitude' };
      const ratio = mv / amp;
      if (ratio <= (FKk - WKk) / (WKk - psik * FKk)) return { v: WKk / (1 + psik * ratio), branch: 'fadiga', ratio };
      return { v: FKk / (1 + ratio), branch: 'escoamento', ratio };
    };
    const ADK = { zd: adk(WK.zd, psi.zd, FK.zd, smv, out.s.szda), b: adk(WK.b, psi.b, FK.b, smv, sba), t: adk(WK.t, psi.t, FK.t, tmv, ta) };
    out.ADK = ADK;
    const term = (amp, lim) => amp > 0 ? amp / lim.v : 0;
    const qD = Math.hypot(term(out.s.szda, ADK.zd) + term(sba, ADK.b), term(ta, ADK.t));
    const qF = Math.hypot(out.s.szdmax / FK.zd + out.s.sbmax / FK.b, out.s.ttmax / FK.t);
    out.SD = qD > 0 ? 1 / qD : Infinity;
    out.SF = qF > 0 ? 1 / qF : Infinity;
    const Smin = o.Smin || 1.2;
    out.uD = Smin / out.SD; out.uF = Smin / out.SF;
    out.util = Math.max(out.uD, out.uF);
    out.gov = out.uD >= out.uF ? 'D' : 'F';
    out.ok = out.util <= 1;
    // fator de pico admissível: o maior Tmáx/T com S_F ≥ S mín.
    const sTerm = out.s.szdmax / FK.zd + out.s.sbmax / FK.b, lim = 1 / (Smin * Smin) - sTerm * sTerm;
    out.peakAdm = tm > 0 ? (lim > 0 ? Math.sqrt(lim) * FK.t / tm : 0) : Infinity;
    // Ø estimado para S = S mín. (tensões ∝ 1/d³; os fatores mudam pouco com d)
    const S = Math.min(out.SD, out.SF);
    out.dReq = isFinite(S) && S > 0 ? p.d * Math.cbrt(Smin / S) : 0;
    return out;
  }

  // propriedades de resistência da seção (módulos de flexão e torção, área), maciça ou vazada
  function moduli(d, di = 0) {
    return { Wb: PI * (d ** 4 - di ** 4) / (32 * d), Wt: PI * (d ** 4 - di ** 4) / (16 * d), A: PI * (d * d - di * di) / 4 };
  }

  return { GROUPS, CURVES, K1, K2, K3, KF, alphaShoulder, gradShoulder, nOf, betaKey, betaFit, gammaF, evaluate, moduli, DBK, SHOULDER };
});
