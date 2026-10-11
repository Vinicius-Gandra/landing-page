/* Laboratório térmico · área mínima do trocador ar–água de máquinas em circuito fechado (IC81).
   Só cálculo, sem DOM. Sequência física: perdas no ar → ventilação LA/LOA → ar quente (calculado)
   → água: entrada e vazão definidas → saída (calculada) → ε–NTU → UA → U de referência → área mínima. */
(() => {
  'use strict';

  /* ---- Constantes ------------------------------------------------------------ */
  const P0 = 101325, T0 = 273.15, R_DA = 287.058, R_V = 461.495;
  const RHO_N = P0 / (R_DA * T0);            // ar seco na CNTP ≈ 1,292 kg/m³
  const CP_W = 4180;                         // J/(kg·K)
  const KW_TO_KCALH = 859.845;
  const FOULING = {
    closed: { rf: 0.00009, label: 'Circuito fechado tratado' },
    tower: { rf: 0.000176, label: 'Torre de resfriamento tratada' },
    city: { rf: 0.000176, label: 'Água de rede / poço' },
    river: { rf: 0.000352, label: 'Rio / água bruta' },
    muddy: { rf: 0.000528, label: 'Água lamacenta / poluída' },
    sea: { rf: 0.000088, label: 'Água do mar' }
  };
  const MATERIAL = {
    copper: { k: 390, vmax: 1.8, label: 'Cobre' },
    admiralty: { k: 111, vmax: 2.4, label: 'Latão almirantado' },
    cuni9010: { k: 50, vmax: 3.0, label: 'CuNi 90/10' },
    cuni7030: { k: 29, vmax: 3.6, label: 'CuNi 70/30' },
    steel: { k: 50, vmax: 2.5, label: 'Aço carbono' },
    stainless: { k: 16, vmax: 4.0, label: 'Aço inox' }
  };
  const CLASS_RISE = { B: 80, F: 105, H: 125 };
  const HX_LABEL = {
    multipass: 'Cruzado-contracorrente (N passes)',
    cross: 'Cruzado 1 passe, não misturados',
    crossWaterMixed: 'Cruzado 1 passe, água misturada',
    counter: 'Contracorrente ideal'
  };

  /* ---- Formulário ------------------------------------------------------------ */
  const GROUPS = [
    { id: 'calor', title: 'Calor que vai para o ar', sub: 'Perdas do projeto · mancais ficam de fora' },
    { id: 'ar', title: 'Ventilação LA / LOA', sub: 'Vazão por ramo × ramos · ar frio requerido' },
    { id: 'agua', title: 'Circuito de água', sub: 'Entrada e vazão definidas · saída calculada' },
    { id: 'trocador', title: 'Trocador e área mínima', sub: 'Unidades, face, arranjo e U', keep: true },
    { id: 'local', title: 'Local e ar ambiente', sub: 'Padrão CNTP: nível do mar, ar seco', premise: true },
    { id: 'superficie', title: 'Superfície de referência', sub: 'Tubo aletado L-fin para estimar U', premise: true },
    { id: 'ventiladores', title: 'Ventiladores e enrolamento', sub: 'Δp disponível, potência e temperatura', premise: true }
  ];
  const opt = (...pairs) => pairs;
  const FIELDS = [
    // 01 · calor no ar
    { key: 'elecLoss', group: 'calor', label: 'Perdas elétricas', sym: 'Pel', unit: 'kW', type: 'num', def: 108.51, req: true, min: 0, help: 'Valor já calculado no projeto.' },
    { key: 'ventLoss', group: 'calor', label: 'Ventilação no ar', sym: 'Pvent', unit: 'kW', type: 'num', def: 0, min: 0, help: 'Ventiladores e atrito do rotor com o ar.' },
    { key: 'extraLoss', group: 'calor', label: 'Outras perdas no ar', sym: 'Poutras', unit: 'kW', type: 'num', def: 0, min: 0, help: 'Resistências, barramentos internos etc.' },
    { key: 'mechLoss', group: 'calor', label: 'Perdas de mancal', sym: 'Pmanc', unit: 'kW', type: 'num', def: 74, min: 0, help: 'Saem pelo óleo. Não entram no trocador.' },
    { key: 'frameLoss', group: 'calor', label: 'Dissipado pela carcaça', sym: 'fcarc', unit: '%', type: 'num', def: 0, min: 0, max: 90, help: '0 % = conservador.' },
    { key: 'designMargin', group: 'calor', label: 'Margem de projeto', sym: 'm', unit: '%', type: 'num', def: 0, min: 0, max: 100 },
    { key: 'rdQ', group: 'calor', label: 'Carga no trocador', sym: 'Q', type: 'calc' },
    // 02 · ventilação
    { key: 'fans', group: 'ar', label: 'Ramos (ventiladores)', sym: 'nramos', unit: 'un.', type: 'int', def: 2, req: true, min: 1, max: 8, help: 'LA + LOA' },
    { key: 'flowPerFan', group: 'ar', label: 'Vazão por ramo', sym: 'V̇ramo', unit: 'm³/s', type: 'num', def: 9.30, req: true, gt: 0, max: 500, help: 'De cada ventilador.' },
    { key: 'flowRef', group: 'ar', label: 'Condição em que a vazão foi dada', type: 'select', def: 'cntp', span: true,
      options: opt(['cntp', 'CNTP · 0 °C e 101,325 kPa (vazão normal)'], ['real', 'Real no ventilador · ar frio, pressão do local']) },
    { key: 'rdFlow', group: 'ar', label: 'Vazão total de ar', sym: 'V̇', type: 'calc' },
    { key: 'airColdTarget', group: 'ar', label: 'Ar frio entrando na máquina', sym: 'Tf', unit: '°C', type: 'num', def: 40, req: true, min: -10, max: 80, help: 'Requisito do trocador. IEC 60034-1: 40 °C.' },
    { key: 'rdTh', group: 'ar', label: 'Ar quente voltando ao trocador', sym: 'Tq', type: 'calc' },
    // 03 · água
    { key: 'waterIn', group: 'agua', label: 'Água entrando', sym: 'Tw,e', unit: '°C', type: 'num', def: 25, req: true, min: 1, max: 60, help: 'IEC 60034-1: 25 °C.' },
    { key: 'waterFlow', group: 'agua', label: 'Vazão de água', sym: 'V̇w', unit: 'm³/h', type: 'num', def: 18.76, req: true, gt: 0, max: 5000, help: 'Total, somando as unidades.' },
    { key: 'rdTwo', group: 'agua', label: 'Água saindo', sym: 'Tw,s', type: 'calc' },
    { key: 'waterQuality', group: 'agua', label: 'Qualidade da água (incrustação)', type: 'select', def: 'tower', span: true,
      options: opt(['closed', 'Circuito fechado tratado / desmineralizada'], ['tower', 'Torre de resfriamento tratada'], ['city', 'Água de rede / poço'], ['river', 'Rio / água bruta'], ['muddy', 'Água lamacenta ou muito poluída'], ['sea', 'Água do mar (< 50 °C)']) },
    { key: 'waterP', group: 'agua', label: 'Pressão de operação', sym: 'pw', unit: 'kgf/cm²', type: 'num', def: 5.0, min: 0, max: 40, help: 'Manométrica, do site.' },
    { key: 'waterDpAllow', group: 'agua', label: 'Δp admissível', sym: 'Δpw', unit: 'kPa', type: 'num', def: 50, min: 0, max: 500, help: 'Perda de carga da água no trocador.' },
    // 04 · trocador
    { key: 'modules', group: 'trocador', label: 'Unidades de trocador', sym: 'nunid', unit: 'un.', type: 'int', def: 2, req: true, min: 1, max: 8 },
    { key: 'vFaceMax', group: 'trocador', label: 'Velocidade frontal máx.', sym: 'vface', unit: 'm/s', type: 'num', def: 2.5, req: true, min: 0.5, max: 6, help: 'Define a face mínima.' },
    { key: 'tubeLength', group: 'trocador', label: 'Comprimento aletado', sym: 'L', unit: 'm', type: 'num', def: 2.30, req: true, min: 0.2, max: 10, help: 'Limitado pela máquina.' },
    { key: 'vWaterTarget', group: 'trocador', label: 'Velocidade da água alvo', sym: 'vw', unit: 'm/s', type: 'num', def: 1.5, req: true, min: 0.2, max: 4, help: 'Define os passes.' },
    { key: 'hxType', group: 'trocador', label: 'Arranjo de escoamento', type: 'select', def: 'multipass', span: true,
      options: opt(['multipass', 'Cruzado-contracorrente · N passes de água'], ['cross', 'Cruzado · 1 passe, ambos não misturados'], ['crossWaterMixed', 'Cruzado · 1 passe, água misturada'], ['counter', 'Contracorrente ideal (limite superior)']) },
    { key: 'uMode', group: 'trocador', label: 'Coeficiente global U', type: 'select', def: 'calc', span: true,
      options: opt(['calc', 'Calcular pela superfície de referência (L-fin)'], ['manual', 'Informar um valor de U']) },
    { key: 'uOverall', group: 'trocador', label: 'U global (manual)', sym: 'U', unit: 'W/m²K', type: 'num', def: 45, gt: 0, max: 500, help: 'Só com "Informar um valor de U".' },
    { key: 'airFoul', group: 'trocador', label: 'Incrustação do ar', sym: 'Rf,o', unit: 'm²K/W', type: 'num', def: 0, min: 0, max: 0.01, help: '0 em circuito fechado limpo.' },
    { key: 'rdArea', group: 'trocador', label: 'Área mínima de troca', sym: 'A', type: 'calc' },
    // 05 · local
    { key: 'altitude', group: 'local', label: 'Altitude', sym: 'h', unit: 'm', type: 'num', def: 0, min: -500, max: 5000, help: 'p = 101,325 kPa (CNTP)' },
    { key: 'rh', group: 'local', label: 'UR do ar ambiente', sym: 'UR', unit: '%', type: 'num', def: 0, min: 0, max: 100, help: '0 = ar seco (CNTP).' },
    { key: 'ambT', group: 'local', label: 'Temperatura ambiente', sym: 'Tamb', unit: '°C', type: 'num', def: 0, min: -30, max: 60, help: 'Só usada com UR > 0.' },
    // 06 · superfície de referência
    { key: 'tubeMaterial', group: 'superficie', label: 'Material do tubo', type: 'select', def: 'copper', span: true,
      options: opt(['copper', 'Cobre (B-111 C12200)'], ['admiralty', 'Latão almirantado'], ['cuni9010', 'Cupro-níquel 90/10'], ['cuni7030', 'Cupro-níquel 70/30'], ['steel', 'Aço carbono'], ['stainless', 'Aço inox']) },
    { key: 'tubeOD', group: 'superficie', label: 'Ø externo do tubo', sym: 'Do', unit: 'mm', type: 'num', def: 19.05, gt: 0, max: 80 },
    { key: 'tubeID', group: 'superficie', label: 'Ø interno do tubo', sym: 'Di', unit: 'mm', type: 'num', def: 16.56, gt: 0, max: 80 },
    { key: 'finOD', group: 'superficie', label: 'Ø externo da aleta', sym: 'Df', unit: 'mm', type: 'num', def: 35.7, gt: 0, max: 150 },
    { key: 'fpi', group: 'superficie', label: 'Densidade de aletas', sym: 'FPI', unit: 'FPI', type: 'num', def: 11, min: 2, max: 25, help: 'Aletas por polegada.' },
    { key: 'finThk', group: 'superficie', label: 'Espessura da aleta', sym: 't', unit: 'mm', type: 'num', def: 0.4, min: 0.1, max: 1.5 },
    { key: 'finK', group: 'superficie', label: 'k da aleta', sym: 'kf', unit: 'W/mK', type: 'num', def: 200, min: 10, max: 420, help: 'Alumínio ≈ 200–220.' },
    { key: 'Pt', group: 'superficie', label: 'Passo transversal', sym: 'Pt', unit: 'mm', type: 'num', def: 41.275, gt: 0, max: 200 },
    { key: 'Pl', group: 'superficie', label: 'Passo longitudinal', sym: 'Pl', unit: 'mm', type: 'num', def: 35.75, gt: 0, max: 200, help: 'Triangular: 0,866 · Pt.' },
    { key: 'contactR', group: 'superficie', label: 'Contato no pé da aleta', sym: 'Rc', unit: 'm²K/W', type: 'num', def: 0.00003, min: 0, max: 0.001, span: true, help: 'Referido à área da raiz. Estimativa para aleta L enrolada.' },
    // 07 · ventiladores e enrolamento
    { key: 'airDp', group: 'ventiladores', label: 'Pressão do ventilador', sym: 'Δpvent', unit: 'Pa', type: 'num', def: 600, min: 0, max: 10000, help: 'Circuito de ar completo.' },
    { key: 'fanEff', group: 'ventiladores', label: 'Eficiência do ventilador', sym: 'η', unit: '%', type: 'num', def: 65, min: 10, max: 95 },
    { key: 'airDpAllow', group: 'ventiladores', label: 'Δp de ar disponível para o trocador', sym: 'Δpar', unit: 'Pa', type: 'num', def: 200, min: 0, max: 5000, span: true, help: 'Curva do ventilador menos as demais perdas do circuito.' },
    { key: 'windingRise', group: 'ventiladores', label: 'Elevação do enrolamento', sym: 'ΔTenr', unit: 'K', type: 'num', def: 80, min: 0, max: 150, help: 'Acima do ar frio de entrada.' },
    { key: 'insClass', group: 'ventiladores', label: 'Classe térmica', type: 'select', def: 'F',
      options: opt(['B', 'B (130 °C)'], ['F', 'F (155 °C)'], ['H', 'H (180 °C)']) }
  ];
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const INPUTS = FIELDS.filter(f => f.type !== 'calc');
  const EXAMPLE = Object.fromEntries(INPUTS.map(f => [f.key, f.def]));
  const EMPTY = Object.fromEntries(INPUTS.map(f => [f.key, f.type === 'select' ? f.def : null]));

  class InputError extends Error {
    constructor(errors, fields) { super(errors.join(' ')); this.name = 'InputError'; this.errors = errors; this.fields = fields; }
  }

  /* ---- Formatação (pt-BR) ---------------------------------------------------- */
  const isNum = Number.isFinite;
  const nfCache = new Map();
  const nf = d => { if (!nfCache.has(d)) nfCache.set(d, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })); return nfCache.get(d); };
  const fx = (v, d = 2) => isNum(v) ? nf(d).format(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v) : '—';
  const f0 = v => fx(v, 0);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---- Propriedades ---------------------------------------------------------- */
  const pressureAtAltitude = h => P0 * Math.pow(1 - 2.25577e-5 * clamp(h, -500, 11000), 5.25588);
  const pSatWater = T => 610.94 * Math.exp((17.625 * T) / (T + 243.04));
  const dewFromPv = pv => { if (!(pv > 0)) return NaN; const g = Math.log(pv / 610.94); return 243.04 * g / (17.625 - g); };
  const muWater = T => 2.414e-5 * Math.pow(10, 247.8 / (T + 133.15));
  const rhoWater = T => 1000 * (1 - ((T + 288.9414) / (508929.2 * (T + 68.12963))) * Math.pow(T - 3.9863, 2));
  const kWater = T => 0.555 + 0.0024 * T - 1.25e-5 * T * T;
  const airMu = T => { const TK = T + 273.15; return 1.458e-6 * Math.pow(TK, 1.5) / (TK + 110.4); };
  const airK = T => 0.0242 + 7.35e-5 * T;
  const moistRho = (p, pv, T) => { const TK = T + 273.15; return (p - pv) / (R_DA * TK) + pv / (R_V * TK); };

  /* ---- ε–NTU ----------------------------------------------------------------- */
  function epsCounter(N, Cr) {
    if (N <= 0) return 0;
    if (Math.abs(1 - Cr) < 1e-6) return N / (1 + N);
    const e = Math.exp(-N * (1 - Cr));
    return (1 - e) / (1 - Cr * e);
  }
  function epsCrossUnmixed(N, Cr) {
    if (N <= 0) return 0;
    if (Cr < 1e-8) return 1 - Math.exp(-N);
    return 1 - Math.exp((Math.pow(N, 0.22) / Cr) * (Math.exp(-Cr * Math.pow(N, 0.78)) - 1));
  }
  const epsCmaxMixed = (N, Cr) => Cr < 1e-8 ? 1 - Math.exp(-N) : (1 / Cr) * (1 - Math.exp(-Cr * (1 - Math.exp(-N))));
  const epsCminMixed = (N, Cr) => Cr < 1e-8 ? 1 - Math.exp(-N) : 1 - Math.exp(-(1 / Cr) * (1 - Math.exp(-Cr * N)));
  function epsMultipass(N, Cr, passes) {
    const n = Math.max(1, Math.round(passes));
    const ep = epsCrossUnmixed(N / n, Cr);
    if (n === 1) return ep;
    if (Math.abs(1 - Cr) < 1e-6) return n * ep / (1 + (n - 1) * ep);
    const r = Math.pow((1 - ep * Cr) / (1 - ep), n);
    return (r - 1) / (r - Cr);
  }
  function epsFor(type, N, Cr, ctx) {
    switch (type) {
      case 'counter': return epsCounter(N, Cr);
      case 'cross': return epsCrossUnmixed(N, Cr);
      case 'crossWaterMixed': return ctx.waterIsCmin ? epsCminMixed(N, Cr) : epsCmaxMixed(N, Cr);
      default: return epsMultipass(N, Cr, ctx.passes);
    }
  }
  function solveNTU(type, eps, Cr, ctx) {
    if (!(eps > 0 && eps < 0.9999)) return NaN;
    let lo = 1e-7, hi = 60;
    if (epsFor(type, hi, Cr, ctx) < eps) return NaN;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (epsFor(type, mid, Cr, ctx) < eps) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* ---- Lado da água ---------------------------------------------------------- */
  const petukhovF = Re => Math.pow(0.790 * Math.log(Re) - 1.64, -2);
  function gnielinskiNu(Re, Pr) {
    const f = petukhovF(Re);
    return (f / 8) * (Re - 1000) * Pr / (1 + 12.7 * Math.sqrt(f / 8) * (Math.pow(Pr, 2 / 3) - 1));
  }
  function nusseltTube(Re, Pr) {
    const NuLam = 3.66;
    if (!(Re > 0)) return NaN;
    if (Re < 2300) return NuLam;
    if (Re < 1e4) { const g = (Re - 2300) / (1e4 - 2300); return (1 - g) * NuLam + g * gnielinskiNu(1e4, Pr); }
    return gnielinskiNu(Re, Pr);
  }
  function frictionTube(Re) {
    if (!(Re > 0)) return NaN;
    if (Re < 2300) return 64 / Re;
    if (Re < 4000) { const g = (Re - 2300) / 1700; return (1 - g) * 64 / 2300 + g * petukhovF(4000); }
    return petukhovF(Re);
  }

  /* ---- Tubo com aleta L-fin (superfície de referência) ----------------------- */
  function lfinGeom(d) {
    const OD = d.tubeOD, t = Math.max(0.05, d.finThk || 0.4);
    const Dr = OD + 2 * t, Df = d.finOD, hf = (Df - Dr) / 2;
    const nf = Math.max(1, d.fpi) / 0.0254;
    const s = 1 / nf - t / 1000;
    const DrM = Dr / 1000, DfM = Df / 1000, tM = t / 1000;
    const Afin = nf * (2 * Math.PI / 4 * (DfM * DfM - DrM * DrM) + Math.PI * DfM * tM);
    const Abare = Math.PI * DrM * Math.max(0, 1 - nf * tM);
    const Ao = Afin + Abare;
    const Pt = d.Pt, Pl = d.Pl > 0 ? d.Pl : Pt * Math.sqrt(3) / 2;
    const blk = 2 * hf * t * nf / 1000;
    const gapT = Pt - Dr - blk;
    const Pd = Math.sqrt((Pt / 2) * (Pt / 2) + Pl * Pl);
    const gapD = 2 * (Pd - Dr - blk);
    const wmin = Math.min(gapT, gapD);
    const sigma = wmin > 0 ? wmin / Pt : NaN;
    const valid = hf > 0 && s > 0 && wmin > 0 && Pt >= Df * 0.99 && Pd >= Df * 0.99;
    return { OD, t, Dr, Df, hf, nf, s, Afin, Abare, Ao, Pt, Pl, Pd, sigma, gapT, gapD, valid, pitchMM: 1000 / nf };
  }
  function finEffSchmidt(h, k, g) {
    const r1 = g.Dr / 2000, r2c = (g.Df / 2 + g.t / 2) / 1000, tM = g.t / 1000;
    if (!(h > 0 && k > 0 && r2c > r1)) return NaN;
    const m = Math.sqrt(2 * h / (k * tM));
    const ratio = r2c / r1;
    const phi = (ratio - 1) * (1 + 0.35 * Math.log(ratio));
    const x = m * r1 * phi;
    return { eta: x > 1e-9 ? Math.tanh(x) / x : 1, m, phi, r1, x };
  }
  const tubesStaggered = (rows, npr) => rows * npr - Math.floor(rows / 2);

  /* ---- Validação --------------------------------------------------------------- */
  function validate(values) {
    const d = {}, fields = {}, errors = [];
    const v0 = values || {};
    for (const f of INPUTS) {
      let v = v0[f.key];
      if (f.type === 'select') { d[f.key] = f.options.some(o => o[0] === v) ? v : f.def; continue; }
      if (v === null || v === undefined || v === '') {
        if (f.req) { fields[f.key] = 'informe o valor'; continue; }
        v = f.def;
      }
      if (typeof v !== 'number' || !isNum(v)) { fields[f.key] = 'número inválido'; continue; }
      if (f.type === 'int' && !Number.isInteger(v)) { fields[f.key] = 'use um número inteiro'; continue; }
      if (f.gt !== undefined && !(v > f.gt)) { fields[f.key] = `precisa ser maior que ${fx(f.gt, 0)}`; continue; }
      if (f.min !== undefined && v < f.min) { fields[f.key] = `mínimo ${String(f.min).replace('.', ',')} ${f.unit || ''}`.trim(); continue; }
      if (f.max !== undefined && v > f.max) { fields[f.key] = `máximo ${String(f.max).replace('.', ',')} ${f.unit || ''}`.trim(); continue; }
      d[f.key] = v;
    }
    const ok = k => !(k in fields);
    if (ok('elecLoss') && ok('ventLoss') && ok('extraLoss') && d.elecLoss + d.ventLoss + d.extraLoss <= 0)
      fields.elecLoss = 'a soma das perdas no ar precisa ser maior que zero';
    if (ok('airColdTarget') && ok('waterIn') && d.airColdTarget <= d.waterIn) {
      fields.airColdTarget = `o ar frio precisa ficar acima da água de entrada (${fx(d.waterIn, 1)} °C)`;
    }
    if (ok('tubeOD') && ok('tubeID') && d.tubeID >= d.tubeOD) fields.tubeID = 'precisa ser menor que o Ø externo';
    if (ok('tubeOD') && ok('finOD') && ok('finThk') && d.finOD <= d.tubeOD + 2 * d.finThk) fields.finOD = 'precisa ser maior que o tubo com a base da aleta';
    if (ok('fpi') && ok('finThk') && 25.4 / d.fpi <= d.finThk) fields.fpi = 'as aletas encostam umas nas outras';
    if (ok('Pt') && ok('finOD') && d.Pt < d.finOD * 0.99) fields.Pt = `as aletas se sobrepõem (Ø aleta ${fx(d.finOD, 1)} mm)`;
    if (ok('Pt') && ok('Pl') && ok('finOD')) {
      const Pd = Math.hypot(d.Pt / 2, d.Pl);
      if (Pd < d.finOD * 0.99) fields.Pl = 'as aletas se tocam na diagonal';
    }
    if (Object.keys(fields).length) throw new InputError(errors, fields);
    return d;
  }

  /* ---- Cálculo ------------------------------------------------------------------ */
  function compute(d) {
    const r = { d };
    const fans = Math.max(1, Math.round(d.fans || 1));
    const modules = Math.max(1, Math.round(d.modules || 1));
    const manual = d.uMode === 'manual';
    Object.assign(r, { fans, modules, manual });
    r.flowPerFan = d.flowPerFan;
    r.flowTotal = r.flowPerFan * fans;

    // ar úmido no local
    r.p = pressureAtAltitude(d.altitude);
    const rh = clamp(d.rh, 0, 100);
    r.pv = rh > 0 ? Math.min(rh / 100 * pSatWater(d.ambT), 0.999 * r.p) : 0;
    r.w = 0.62198 * r.pv / Math.max(1, r.p - r.pv);
    r.dew = r.pv > 0 ? dewFromPv(r.pv) : NaN;
    r.cpAir = 1006 + 1860 * r.w;
    const Tc = d.airColdTarget; r.Tc = Tc;

    // massa de ar a partir da vazão e da condição de referência
    if (d.flowRef === 'real') {
      const TK = Tc + 273.15;
      r.rhoRefDa = (r.p - r.pv) / (R_DA * TK);
      r.rhoRef = r.rhoRefDa + r.pv / (R_V * TK);
      r.mdotDry = r.rhoRefDa * r.flowTotal;
      r.mMoist = r.mdotDry * (1 + r.w);
    } else {
      r.rhoRef = RHO_N;
      r.mMoist = RHO_N * r.flowTotal;
      r.mdotDry = r.mMoist / (1 + r.w);
    }
    r.cAir = r.mdotDry * r.cpAir / 1000;
    r.flowNormal = r.mMoist / RHO_N;

    // carga no trocador: só o calor que fica no ar
    r.qElec = Math.max(0, d.elecLoss);
    r.qVent = Math.max(0, d.ventLoss);
    r.qExtra = Math.max(0, d.extraLoss);
    r.qBearing = Math.max(0, d.mechLoss);
    r.qGross = r.qElec + r.qVent + r.qExtra;
    r.qFrame = r.qGross * clamp(d.frameLoss, 0, 100) / 100;
    r.qBase = r.qGross - r.qFrame;
    r.qMargin = r.qBase * Math.max(0, d.designMargin) / 100;
    r.qDesign = r.qBase + r.qMargin;

    // ar quente pelo balanço (consequência)
    r.dTair = r.cAir > 0 ? r.qDesign / r.cAir : NaN;
    r.Th = Tc + r.dTair;
    r.Tam = (r.Th + Tc) / 2;
    r.rhoMean = moistRho(r.p, r.pv, r.Tam);
    r.rhoCold = moistRho(r.p, r.pv, Tc);
    r.flowFanReal = r.mMoist / r.rhoCold;
    r.flowCoolerMean = r.mMoist / r.rhoMean;
    r.rhHot = r.pv > 0 ? r.pv / pSatWater(r.Th) * 100 : 0;
    r.fanPower = d.fanEff > 0 ? d.airDp * r.flowFanReal / (d.fanEff / 100) / 1000 : NaN;

    // água: entrada e vazão definidas → elevação e saída calculadas (ρ na temperatura média)
    r.qvWh = d.waterFlow;
    r.qvW = r.qvWh / 3600;
    let rise = 5;
    for (let i = 0; i < 30; i++) {
      const next = r.qDesign * 1000 / (r.qvW * rhoWater(d.waterIn + rise / 2) * CP_W);
      if (Math.abs(next - rise) < 1e-10) { rise = next; break; }
      rise = next;
    }
    r.waterRise = rise;
    r.waterOut = d.waterIn + rise;
    r.waterMean = d.waterIn + rise / 2;
    r.rhoW = rhoWater(r.waterMean);
    r.mu = muWater(r.waterMean);
    r.kW = kWater(r.waterMean);
    r.Pr = r.mu * CP_W / r.kW;
    r.mdotW = r.qvW * r.rhoW;
    r.cW = r.mdotW * CP_W / 1000;

    // capacidades e efetividade requerida
    r.Cmin = Math.min(r.cAir, r.cW); r.Cmax = Math.max(r.cAir, r.cW);
    r.Cr = r.Cmax > 0 ? r.Cmin / r.Cmax : NaN;
    r.waterIsCmin = r.cW < r.cAir;
    r.qMax = r.Cmin > 0 ? r.Cmin * (r.Th - d.waterIn) : NaN;
    r.eps = r.qMax > 0 ? r.qDesign / r.qMax : NaN;

    // superfície de referência e face mínima
    const mat = MATERIAL[d.tubeMaterial] || MATERIAL.copper;
    const foul = FOULING[d.waterQuality] || FOULING.tower;
    r.mat = mat; r.foul = foul;
    const g = lfinGeom(d); r.g = g;
    const Do = d.tubeOD / 1000, Di = d.tubeID / 1000, L = Math.max(0.1, d.tubeLength);
    const vF = Math.max(0.3, d.vFaceMax || 2.5);
    r.faceVel = vF;
    r.frontalArea = r.flowCoolerMean / (modules * vF);
    r.npr = Math.max(1, Math.round(r.frontalArea / (L * g.Pt / 1000)));
    r.faceHeight = r.npr * g.Pt / 1000;
    r.Gmax = (r.rhoMean * vF) / g.sigma;
    r.Vmax = r.Gmax / r.rhoMean;
    r.muAir = airMu(r.Tam); r.kAir = airK(r.Tam);
    r.PrAir = r.cpAir * r.muAir / r.kAir;
    r.ReAir = r.Gmax * (g.Dr / 1000) / r.muAir;
    r.sh = g.s * 1000 / g.hf; r.st = g.s * 1000 / g.t;
    r.NuAir = 0.134 * Math.pow(r.ReAir, 0.681) * Math.pow(r.PrAir, 1 / 3) * Math.pow(r.sh, 0.2) * Math.pow(r.st, 0.1134);
    r.hAir = r.NuAir * r.kAir / (g.Dr / 1000);
    const fin = finEffSchmidt(r.hAir, d.finK, g);
    r.fin = fin;
    r.etaf = fin ? fin.eta : NaN;
    r.eta0 = 1 - (g.Afin / g.Ao) * (1 - r.etaf);
    r.Ao_m = g.Ao;
    r.areaFactor = g.Ao / (Math.PI * Do);
    r.tubeAreaInt = Math.PI * Di * Di / 4;
    r.Ai_m = Math.PI * Di;
    r.AoAi = g.Ao / r.Ai_m;
    r.tubeAreaEff = g.Ao * L;
    r.qvWModule = r.qvW / modules;
    const Ro = (r.hAir > 0 && r.eta0 > 0) ? 1 / (r.eta0 * r.hAir) : NaN;
    const Rfo = (d.airFoul > 0 && r.eta0 > 0) ? d.airFoul / r.eta0 : 0;
    const Rc = d.contactR > 0 ? d.contactR * g.Ao / (Math.PI * g.Dr / 1000) : 0;
    const Rw = (Do > Di && Di > 0) ? g.Ao * Math.log(Do / Di) / (2 * Math.PI * mat.k) : 0;
    const Rf = r.AoAi * foul.rf;
    const Ufor = vW => {
      const Re = r.rhoW * vW * Di / r.mu, Nu = nusseltTube(Re, r.Pr), hi = Nu * r.kW / Di, Ri = r.AoAi / hi;
      return { Re, Nu, hi, Ri, U: 1 / (Ro + Rfo + Rc + Rw + Ri + Rf), Uclean: 1 / (Ro + Rc + Rw + Ri) };
    };
    const ctxFor = p => ({ passes: p, waterIsCmin: r.waterIsCmin });
    const vT = Math.max(0.1, d.vWaterTarget || 1.5);
    const tppTarget = r.tubeAreaInt > 0 ? r.qvWModule / (vT * r.tubeAreaInt) : NaN;
    const dpFor = (p, nt) => { const v = r.qvWModule / ((nt / p) * r.tubeAreaInt); const Re = r.rhoW * v * Di / r.mu; const f = frictionTube(Re); return (f * L * p / Di + 1.5 * (p + 1)) * r.rhoW * v * v / 2 / 1000; };
    // passes: o mais próximo da velocidade alvo, reduzindo até caber no Δp admissível
    const choosePasses = nt => { let p = isNum(tppTarget) ? Math.max(1, Math.round(nt / tppTarget)) : 4; while (p > 1 && d.waterDpAllow > 0 && dpFor(p, nt) > d.waterDpAllow) p--; return p; };

    // fileiras e passes do exemplo de montagem (iterativo: U depende da velocidade da água)
    let rows = 4, passes = 4, tubes = tubesStaggered(rows, r.npr), tpp = tubes / passes;
    for (let it = 0; it < 25; it++) {
      tubes = tubesStaggered(rows, r.npr);
      passes = choosePasses(tubes);
      tpp = tubes / passes;
      const u = Ufor(r.qvWModule / (tpp * r.tubeAreaInt));
      const U = manual ? d.uOverall : u.U;
      const NTU = solveNTU(d.hxType, r.eps, r.Cr, ctxFor(passes));
      const Aunit = NTU * r.Cmin * 1000 / U / modules;
      if (!isNum(Aunit) || !(r.tubeAreaEff > 0)) break;
      let rN = 1; while (rN < 80 && tubesStaggered(rN, r.npr) * r.tubeAreaEff < Aunit) rN++;
      if (rN === rows) break;
      rows = rN;
    }
    tubes = tubesStaggered(rows, r.npr);
    passes = choosePasses(tubes);
    tpp = tubes / passes;
    Object.assign(r, { rows, passes, tpp, tubes });
    r.depth = (rows - 1) * g.Pl + g.Df;

    r.waterVel = r.tubeAreaInt > 0 ? r.qvWModule / (tpp * r.tubeAreaInt) : NaN;
    const u = Ufor(r.waterVel);
    r.Re = u.Re; r.Nu = u.Nu; r.hi = u.hi;
    r.res = { Ro, Rfo, Rc, Rw, Ri: u.Ri, Rf };
    r.Rtot = Ro + Rfo + Rc + Rw + u.Ri + Rf;
    r.Ucalc = u.U; r.UcalcClean = u.Uclean;
    r.U = manual ? d.uOverall : r.Ucalc;

    const ctx = ctxFor(passes); r.ctx = ctx;
    r.NTU = solveNTU(d.hxType, r.eps, r.Cr, ctx);
    r.UA = (isNum(r.NTU) && r.Cmin > 0) ? r.NTU * r.Cmin : NaN;
    r.areaMin = (r.UA > 0 && r.U > 0) ? r.UA * 1000 / r.U : NaN;
    r.areaMinUnit = r.areaMin / modules;
    r.areaGeoUnit = r.tubeAreaEff * tubes;
    r.arr = Object.keys(HX_LABEL).map(t => { const N = solveNTU(t, r.eps, r.Cr, ctx); return { t, N, UA: N * r.Cmin, A: N * r.Cmin * 1000 / r.U }; });

    // LMTD (contracorrente)
    r.dTh = r.Th - r.waterOut; r.dTc = Tc - d.waterIn;
    r.approach = r.dTc;
    r.LMTD = (r.dTh > 0 && r.dTc > 0) ? (Math.abs(r.dTh - r.dTc) < 1e-6 ? r.dTh : (r.dTh - r.dTc) / Math.log(r.dTh / r.dTc)) : NaN;
    r.Ffac = (r.UA > 0 && r.LMTD > 0) ? r.qDesign / (r.UA * r.LMTD) : NaN;

    // hidráulica do exemplo de montagem
    r.fric = frictionTube(r.Re);
    r.tubeDp = (isNum(r.fric) && Di > 0) ? (r.fric * L * passes / Di + 1.5 * (passes + 1)) * r.rhoW * r.waterVel * r.waterVel / 2 / 1000 : NaN;
    r.fRB = 18.93 * Math.pow(r.ReAir, -0.316) * Math.pow(g.Pt / g.Dr, -0.927) * Math.pow(g.Pt / g.Pd, 0.515);
    r.dpAir = isNum(r.fRB) ? r.fRB * rows * r.Gmax * r.Gmax / r.rhoMean : NaN;

    // N−1 com a área mínima
    if (modules >= 2 && r.UA > 0) {
      const n = modules;
      const Ca = r.cAir / n, Cw = r.cW / (n - 1);
      const Cmn = Math.min(Ca, Cw), Cmx = Math.max(Ca, Cw), Crm = Cmn / Cmx;
      const NTUm = (r.UA / n) / Cmn;
      const em = epsFor(d.hxType, NTUm, Crm, { passes, waterIsCmin: Cw < Ca });
      const k = (n - 1) * em * Cmn;
      r.n1Th = d.waterIn + r.qDesign / k;
      r.n1Tc = r.n1Th - r.qDesign / r.cAir;
      const denom = 1 / k - 1 / r.cAir;
      r.n1Load = denom > 0 ? ((Tc - d.waterIn) / denom) / r.qDesign * 100 : NaN;
    } else { r.n1Th = NaN; r.n1Tc = NaN; r.n1Load = NaN; }

    // parede mínima no lado do ar (ponta fria)
    const Rin = u.Ri + Rf + Rw + Rc, Rout = Ro + Rfo;
    r.wallMin = (isNum(Rin) && isNum(Rout) && !manual) ? d.waterIn + (Tc - d.waterIn) * Rin / (Rin + Rout) : d.waterIn;

    // enrolamento
    r.windN = Tc + d.windingRise;
    r.windN1 = r.n1Tc + d.windingRise;
    r.windLim = 40 + (CLASS_RISE[d.insClass] || 105);
    r.windLimB = 40 + CLASS_RISE.B;
    return r;
  }

  /* ---- Memória de cálculo ------------------------------------------------------ */
  function buildSteps(r) {
    const d = r.d, g = r.g, S = [];
    const add = (section, title, formula, subst, value, unit, dg, extra = {}) => S.push({ section, title, formula, subst, value, unit, d: dg, ...extra });
    const cntp = d.flowRef !== 'real';
    // 1 · calor
    add('calor', 'Perdas que ficam no ar', 'Par = Pel + Pvent + Poutras', `${fx(r.qElec)} + ${fx(r.qVent)} + ${fx(r.qExtra)}`, r.qGross, 'kW', 2, { source: 'Projeto elétrico' });
    add('calor', 'Parcela pela carcaça', 'Pcarc = fcarc · Par', `${fx(d.frameLoss, 1)} % × ${fx(r.qGross)}`, r.qFrame, 'kW', 2, { comment: '0 % é o conservador: todo o calor passa pelo trocador.' });
    add('calor', 'Margem de projeto', 'Pmarg = m · (Par − Pcarc)', `${fx(d.designMargin, 1)} % × ${fx(r.qBase)}`, r.qMargin, 'kW', 2);
    add('calor', 'Carga no trocador', 'Q = Par − Pcarc + Pmarg', `${fx(r.qGross)} − ${fx(r.qFrame)} + ${fx(r.qMargin)}`, r.qDesign, 'kW', 2,
      { comment: `= ${f0(r.qDesign * KW_TO_KCALH)} kcal/h. Os ${fx(r.qBearing, 1)} kW de mancal não entram: saem pelo óleo.` });
    // 2 · ar
    add('ar', 'Vazão total de ar', 'V̇ = nramos · V̇ramo', `${r.fans} × ${fx(r.flowPerFan)}`, r.flowTotal, cntp ? 'm³/s (CNTP)' : 'm³/s', 2,
      { source: 'Ventiladores LA/LOA', comment: r.fans === 2 ? 'Um ramo no lado acoplado (LA) e outro no oposto (LOA), logo depois dos mancais.' : r.fans === 1 ? 'Só um ramo (LA).' : `LA + LOA + ${r.fans - 2} ramo(s).` });
    if (cntp) add('ar', 'Densidade da vazão (CNTP)', 'ρN = p0 / (Rar · T0)', `${f0(P0)} / (287,058 × 273,15)`, RHO_N, 'kg/m³', 4, { comment: 'Ar seco a 0 °C e 101,325 kPa.' });
    else add('ar', 'Densidade da vazão (real)', 'ρ = (p − pv)/(Rar · T) + pv/(Rv · T)', `p ${fx(r.p / 1000, 3)} kPa · pv ${f0(r.pv)} Pa · T ${fx(r.Tc, 1)} °C`, r.rhoRef, 'kg/m³', 4, { comment: 'Ar úmido no ar frio, na pressão do local.' });
    add('ar', 'Massa de ar', 'ṁ = ρ · V̇', `${fx(r.rhoRef, 4)} × ${fx(r.flowTotal)}`, r.mMoist, 'kg/s', 2, { comment: `= ${f0(r.mMoist * 3600)} kg/h.` });
    add('ar', 'Calor específico do ar úmido', 'cp = 1,006 + 1,860 · w', `1,006 + 1,860 × ${fx(r.w, 4)}`, r.cpAir / 1000, 'kJ/(kg·K)', 4, { comment: r.w > 0 ? `w = ${fx(r.w * 1000, 1)} g/kg.` : 'w = 0: ar seco (CNTP).' });
    add('ar', 'Capacidade térmica do ar', 'Ċar = ṁseco · cp', `${fx(r.mdotDry)} × ${fx(r.cpAir / 1000, 4)}`, r.cAir, 'kW/K', 2);
    add('ar', 'Elevação do ar na máquina', 'ΔTar = Q / Ċar', `${fx(r.qDesign)} / ${fx(r.cAir)}`, r.dTair, 'K', 2);
    add('ar', 'Ar quente voltando ao trocador', 'Tq = Tf + ΔTar', `${fx(r.Tc, 1)} + ${fx(r.dTair)}`, r.Th, '°C', 2, { comment: 'Consequência do balanço, não é dado de entrada.' });
    add('ar', 'Vazão real nos ventiladores', 'V̇real = ṁ / ρ(Tf, p)', `${fx(r.mMoist)} / ${fx(r.rhoCold, 4)}`, r.flowFanReal, 'm³/s', 2, { comment: `Total, para conferir com a curva dos ventiladores (${fx(r.flowFanReal / r.fans)} m³/s por ramo).` });
    // 3 · água
    add('agua', 'Massa de água', 'ṁw = V̇w · ρw / 3600', `${fx(r.qvWh)} × ${fx(r.rhoW, 1)} / 3600`, r.mdotW, 'kg/s', 3,
      { source: 'Vazão definida', comment: `ρw a ${fx(r.waterMean, 1)} °C, média da água (entrada e saída).` });
    add('agua', 'Capacidade térmica da água', 'Ċw = ṁw · cp,w', `${fx(r.mdotW, 3)} × 4,180`, r.cW, 'kW/K', 2);
    add('agua', 'Elevação da água', 'ΔTw = Q / Ċw', `${fx(r.qDesign)} / ${fx(r.cW)}`, r.waterRise, 'K', 2);
    add('agua', 'Água saindo do trocador', 'Tw,s = Tw,e + ΔTw', `${fx(d.waterIn, 1)} + ${fx(r.waterRise)}`, r.waterOut, '°C', 2,
      { comment: 'Consequência da vazão escolhida: menos água sai mais quente, encurta a diferença de temperatura e pede mais área.' });
    // 4 · ε–NTU e UA
    add('ua', 'Capacidade mínima', 'Cmin = mín(Ċar ; Ċw)', `mín(${fx(r.cAir)} ; ${fx(r.cW)})`, r.Cmin, 'kW/K', 2, { comment: r.waterIsCmin ? 'No lado da água.' : 'No lado do ar.' });
    add('ua', 'Razão de capacidades', 'Cr = Cmin / Cmax', `${fx(r.Cmin)} / ${fx(r.Cmax)}`, r.Cr, '', 3);
    add('ua', 'Troca máxima possível', 'Qmax = Cmin · (Tq − Tw,e)', `${fx(r.Cmin)} × (${fx(r.Th)} − ${fx(d.waterIn, 1)})`, r.qMax, 'kW', 1);
    add('ua', 'Efetividade requerida', 'ε = Q / Qmax', `${fx(r.qDesign)} / ${fx(r.qMax, 1)}`, r.eps, '', 4);
    add('ua', 'NTU requerido', 'ε = f(NTU ; Cr ; arranjo) → NTU', d.hxType === 'multipass' ? `Cruzado-contracorrente com ${r.passes} passes de água` : HX_LABEL[d.hxType], r.NTU, '', 4, { comment: 'Relação ε–NTU do arranjo resolvida por bisseção.' });
    add('ua', 'UA requerido', 'UA = NTU · Cmin', `${fx(r.NTU, 4)} × ${fx(r.Cmin)}`, r.UA, 'kW/K', 3);
    add('ua', 'Conferência por LMTD', 'LMTD = (ΔT1 − ΔT2) / ln(ΔT1/ΔT2)', `ΔT1 = ${fx(r.Th)} − ${fx(r.waterOut)} = ${fx(r.dTh)} · ΔT2 = ${fx(r.Tc, 1)} − ${fx(d.waterIn, 1)} = ${fx(r.dTc)}`, r.LMTD, 'K', 2);
    add('ua', 'Fator F equivalente', 'F = Q / (UA · LMTD)', `${fx(r.qDesign)} / (${fx(r.UA, 3)} × ${fx(r.LMTD)})`, r.Ffac, '', 3, { comment: 'Perto de 1: o arranjo de N passes se comporta quase como contracorrente.' });
    // 5 · coeficiente U
    add('u', 'Área frontal mínima por unidade', 'Aface = (ṁ / ρm) / (nunid · vface)', `(${fx(r.mMoist)} / ${fx(r.rhoMean, 3)}) / (${r.modules} × ${fx(r.faceVel, 1)})`, r.frontalArea, 'm²', 2,
      { source: 'Lado do ar', comment: `ρm a ${fx(r.Tam, 1)} °C, média do ar no trocador.` });
    add('u', 'Tubos por fileira', 'nt = Aface / (L · Pt)', `${fx(r.frontalArea)} / (${fx(d.tubeLength)} × ${fx(g.Pt / 1000, 4)})`, r.npr, '', 0);
    add('u', 'Velocidade mássica máxima', 'Gmax = ρm · vface / σ', `${fx(r.rhoMean, 3)} × ${fx(r.faceVel, 1)} / ${fx(g.sigma, 3)}`, r.Gmax, 'kg/(m²·s)', 2, { comment: 'σ = seção livre mínima / face, já descontando as aletas.' });
    add('u', 'Reynolds do ar', 'Re = Gmax · Dr / μ', `${fx(r.Gmax)} × ${fx(g.Dr / 1000, 5)} / ${fx(r.muAir * 1e5, 3)}·10⁻⁵`, r.ReAir, '', 0);
    add('u', 'Nusselt do ar · Briggs & Young', 'Nu = 0,134 Re^0,681 Pr^⅓ (s/h)^0,2 (s/t)^0,1134', `Pr ${fx(r.PrAir, 3)} · s/h ${fx(r.sh, 3)} · s/t ${fx(r.st, 2)}`, r.NuAir, '', 1);
    add('u', 'h do ar', 'ho = Nu · k / Dr', `${fx(r.NuAir, 1)} × ${fx(r.kAir, 4)} / ${fx(g.Dr / 1000, 5)}`, r.hAir, 'W/(m²·K)', 1);
    add('u', 'Eficiência da aleta · Schmidt', 'ηf = tanh(m·r1·φ) / (m·r1·φ)', r.fin ? `m = √(2h/(k·t)) = ${fx(r.fin.m, 1)} · φ = ${fx(r.fin.phi, 3)}` : '—', r.etaf, '', 3);
    add('u', 'Eficiência da superfície', 'η0 = 1 − (Aaleta/Ao) · (1 − ηf)', `1 − ${fx(g.Afin / g.Ao, 3)} × (1 − ${fx(r.etaf, 3)})`, r.eta0, '', 3);
    add('u', 'Velocidade da água nos tubos', 'vw = (V̇w/nunid) / ((ntubos/N) · Ai)', `${fx(r.qvWModule * 1000, 3)}·10⁻³ / (${fx(r.tpp, 1)} × ${fx(r.tubeAreaInt * 1e4, 3)}·10⁻⁴)`, r.waterVel, 'm/s', 2,
      { source: 'Lado da água', comment: `${r.tubes} tubos em ${r.passes} passes no exemplo de montagem.` });
    add('u', 'Reynolds da água', 'Re = ρw · vw · Di / μw', `${fx(r.rhoW, 1)} × ${fx(r.waterVel)} × ${fx(d.tubeID / 1000, 5)} / ${fx(r.mu * 1000, 3)}·10⁻³`, r.Re, '', 0);
    add('u', 'Nusselt da água · Gnielinski', 'Nu = (f/8)(Re − 1000)Pr / [1 + 12,7 √(f/8) (Pr^⅔ − 1)]', `Pr ${fx(r.Pr, 2)} · f = (0,790 ln Re − 1,64)⁻²`, r.Nu, '', 1);
    add('u', 'h da água', 'hi = Nu · k / Di', `${fx(r.Nu, 1)} × ${fx(r.kW, 3)} / ${fx(d.tubeID / 1000, 5)}`, r.hi, 'W/(m²·K)', 0);
    const R = r.res;
    add('u', 'Coeficiente global (área externa)', '1/U = 1/(η0·ho) + Rf,o/η0 + Rc + Rp + (Ao/Ai)(1/hi + Rf,i)', `${fx(R.Ro * 1000)} + ${fx(R.Rfo * 1000)} + ${fx(R.Rc * 1000)} + ${fx(R.Rw * 1000)} + ${fx(R.Ri * 1000)} + ${fx(R.Rf * 1000)} m²K/kW`, r.Ucalc, 'W/(m²·K)', 1,
      { source: 'Global', comment: r.manual ? `U informado manualmente: ${fx(r.U, 1)} W/m²K. O valor ao lado é a referência L-fin.` : `Limpo seria ${fx(r.UcalcClean, 1)} W/m²K; a incrustação da água tira ${f0((1 - r.Ucalc / r.UcalcClean) * 100)} %.` });
    // 6 · área
    add('area', 'Área mínima total', 'A = UA / U', `${f0(r.UA * 1000)} / ${fx(r.U, 2)}`, r.areaMin, 'm²', 1, { source: 'Para o fornecedor', comment: 'Já inclui a incrustação. Ao fornecedor vai arredondada para cima.' });
    add('area', 'Área mínima por unidade', 'Aunid = A / nunid', `${fx(r.areaMin, 1)} / ${r.modules}`, r.areaMinUnit, 'm²', 1);
    add('area', 'Face mínima total', 'nunid · Aface', `${r.modules} × ${fx(r.frontalArea)}`, r.frontalArea * r.modules, 'm²', 2, { comment: `Para velocidade frontal até ${fx(r.faceVel, 1)} m/s.` });
    // 7 · hidráulica
    add('hidraulica', 'Δp do ar no trocador · Robinson & Briggs', 'Δp = f · N · G²max / ρm', `f = 18,93 Re^−0,316 (Pt/Dr)^−0,927 (Pt/Pd)^0,515 = ${fx(r.fRB, 4)} · N = ${r.rows}`, r.dpAir, 'Pa', 0,
      { comment: `≈ ${fx(r.dpAir / 9.80665, 1)} mmCA (±25 %). Disponível: ${f0(d.airDpAllow)} Pa.` });
    add('hidraulica', 'Δp da água nos tubos', 'Δp = (f·L·N/Di + 1,5·(N + 1)) · ρw·v² / 2', `f = ${fx(r.fric, 4)} · L = ${fx(d.tubeLength)} m · N = ${r.passes}`, r.tubeDp, 'kPa', 1, { comment: `Admissível: ${f0(d.waterDpAllow)} kPa. Inclui perdas nos cabeçotes.` });
    add('hidraulica', 'Potência dos ventiladores', 'P = Δpvent · V̇real / η', `${f0(d.airDp)} × ${fx(r.flowFanReal)} / ${fx(d.fanEff / 100, 2)}`, r.fanPower, 'kW', 1,
      { comment: 'Esse trabalho termina como calor no ar. Se não estiver nas perdas elétricas, entre com ele em "Ventilação no ar".' });
    add('hidraulica', 'Profundidade do feixe', 'p = (nfil − 1) · Pl + Df', `(${r.rows} − 1) × ${fx(g.Pl)} + ${fx(g.Df, 1)}`, r.depth, 'mm', 0);
    // 8 · N−1 e enrolamento
    if (r.modules >= 2) {
      add('n1', 'Ar quente com uma unidade fora', 'Tq,N−1 = Tw,e + Q / ((n − 1) · ε1 · Cmin,1)', `${r.modules - 1} de ${r.modules} unidades com a água total`, r.n1Th, '°C', 1, { comment: 'Cada unidade mantém a área mínima; a água se redistribui entre as ativas.' });
      add('n1', 'Ar frio misturado com N−1', 'Tf,N−1 = Tq,N−1 − Q / Ċar', `${fx(r.n1Th, 1)} − ${fx(r.qDesign)} / ${fx(r.cAir)}`, r.n1Tc, '°C', 1);
      add('n1', 'Carga admissível mantendo Tf', 'Qadm = (Tf − Tw,e) / (1/kN−1 − 1/Ċar)', `mantendo ${fx(r.Tc, 1)} °C de ar frio`, r.n1Load, '%', 0, { comment: 'Se N−1 for requisito, a área por unidade precisa crescer.' });
    } else add('n1', 'Uma unidade fora', 'N−1', 'requer 2 ou mais unidades', null, '', 0, { comment: 'Com uma unidade só, não há operação N−1.' });
    add('n1', 'Enrolamento, operação normal', 'Tenr = Tf + ΔTenr', `${fx(r.Tc, 1)} + ${f0(d.windingRise)}`, r.windN, '°C', 1, { comment: `Referência classe ${d.insClass}: ${f0(r.windLim)} °C (40 + ${CLASS_RISE[d.insClass]}). Classe B: ${f0(r.windLimB)} °C.` });
    if (r.modules >= 2) add('n1', 'Enrolamento com N−1', 'Tenr,N−1 = Tf,N−1 + ΔTenr', `${fx(r.n1Tc, 1)} + ${f0(d.windingRise)}`, r.windN1, '°C', 1);
    return S;
  }

  /* ---- Folha de dados para o fornecedor ---------------------------------------- */
  function rfqData(r) {
    const d = r.d, n = r.modules;
    const mAir = r.mMoist * 3600 / n, mW = r.mdotW * 3600 / n;
    const muA = airMu(r.Tam) * 1000;
    const pAbs = r.p / 98066.5;
    const desW = Math.max(d.waterP * 1.1, d.waterP + 1);
    const testW = 1.25 * desW;
    const airDesT = Math.max(100, Math.ceil((r.Th + 20) / 10) * 10);
    const watDesT = Math.max(60, Math.ceil((r.waterOut + 20) / 10) * 10);
    const rfW = r.foul.rf * 1.163, rfA = (d.airFoul || 0) * 1.163;
    const capKcal = r.qDesign / n * KW_TO_KCALH;
    const rows = [
      { c: ['Fluido', '—', 'Ar (circuito fechado)', `Água (${r.foul.label.toLowerCase()})`] },
      { c: ['Vazão por unidade', 'kg/h', `${f0(mAir)} (≈ ${f0(r.flowNormal * 3600 / n)} Nm³/h)`, `${f0(mW)} (${fx(r.qvWh / n, 2)} m³/h)`] },
      { c: ['Temperatura de operação', '°C', `entr. ${fx(r.Th, 1)} · saída ${fx(d.airColdTarget, 1)}`, `entr. ${fx(d.waterIn, 1)} · saída ${fx(r.waterOut, 1)}`] },
      { c: ['Temperatura de projeto', '°C', f0(airDesT), f0(watDesT)] },
      { c: ['Viscosidade média', 'cP', fx(muA, 4), fx(r.mu * 1000, 3)] },
      { c: ['Densidade média', 'kg/m³', fx(r.rhoMean, 3), fx(r.rhoW, 1)] },
      { c: ['Pressão de operação', 'kgf/cm²', `ATM (≈ ${fx(pAbs, 3)} abs · alt. ${f0(d.altitude)} m)`, fx(d.waterP, 1)] },
      { c: ['Pressão de projeto', 'kgf/cm²', 'N/A', `${fx(desW, 1)} (sugestão)`] },
      { c: ['Pressão de teste', 'kgf/cm²', 'N/A', `${fx(testW, 1)} (1,25 × projeto)`] },
      { c: ['Velocidade de escoamento', 'm/s', `frontal ≤ ${fx(r.faceVel, 1)}`, `1,0 a ${fx(r.mat.vmax, 1)} (${r.mat.label})`] },
      { c: ['Perda de carga admissível', 'mmCA · kgf/cm²', `${f0(d.airDpAllow / 9.80665)} mmCA`, `${fx(d.waterDpAllow / 98.0665, 2)} kgf/cm²`] },
      { c: ['Fator de incrustação', 'h·m²·°C/kcal', fx(rfA, 5), fx(rfW, 5)] },
      { c: ['Número de passes', '—', '1', 'a critério'] },
      { c: ['Capacidade de troca térmica', 'kcal/h', `${f0(capKcal)} por unidade (${fx(r.qDesign / n, 1)} kW)`, `total ${f0(capKcal * n)} (${fx(r.qDesign, 1)} kW)`], key: true },
      { c: ['Área de troca mínima', 'm²', `≥ ${f0(Math.ceil(r.areaMinUnit))} por unidade`, `total ≥ ${f0(Math.ceil(r.areaMin))} · U ≈ ${f0(r.U)} W/m²K com incrustação`], key: true },
      { c: ['Área frontal mínima', 'm²', `≥ ${fx(r.frontalArea, 2)} por unidade`, `velocidade frontal ≤ ${fx(r.faceVel, 1)} m/s`], key: true }
    ];
    const req = [
      ['Capacidade garantida', ` de ${f0(capKcal)} kcal/h por unidade (${n} unidade${n > 1 ? 's' : ''}), com água entrando a ${fx(d.waterIn, 1)} °C e ${fx(r.qvWh, 2)} m³/h no total, ar entrando a ${fx(r.Th, 1)} °C e saindo a no máximo ${fx(d.airColdTarget, 1)} °C, com os fatores de incrustação indicados.`],
      ['Área mínima', ` de ${f0(Math.ceil(r.areaMinUnit))} m² por unidade e face mínima de ${fx(r.frontalArea, 2)} m² por unidade.`],
      ['Vazão de ar em massa', ' (kg/h). A vazão normal (Nm³/h) é só referência; não converter com outra densidade.'],
      ['Informar o Δp de ar e de água', ' calculados, para fechar com a curva dos ventiladores LA/LOA.'],
      ['Materiais', ` compatíveis com ${r.foul.label.toLowerCase()}; cabeçotes removíveis para limpeza mecânica dos tubos.`],
      ['Condensado e vazamento', ': bandeja com dreno para fora da máquina e ponto para detector de vazamento.']
    ];
    return { rows, req, capKcal };
  }

  /* ---- Verificações -------------------------------------------------------------- */
  function buildChecks(r) {
    const d = r.d, C = [];
    const add = (sev, title, detail) => C.push({ sev, title, detail });
    add('ok', 'Carga no trocador', `${fx(r.qDesign, 1)} kW no ar: ${fx(r.qElec, 1)} kW elétricas${r.qVent > 0 ? ` + ${fx(r.qVent, 1)} kW de ventilação` : ''}${r.qExtra > 0 ? ` + ${fx(r.qExtra, 1)} kW outras` : ''}. Os ${fx(r.qBearing, 1)} kW de mancal não entram.`);
    if (r.qVent <= 0 && isNum(r.fanPower) && r.fanPower > 0.5)
      add('warn', 'Ventilação fora da carga', `Pelo Δp e pela eficiência informados, os ventiladores LA/LOA consomem ≈ ${fx(r.fanPower, 1)} kW, e esse trabalho termina como calor no ar do circuito fechado. Se essa parcela não estiver nas perdas elétricas, informe-a em "Ventilação no ar".`);
    add((r.dTair >= 3 && r.dTair <= 40) ? 'ok' : 'warn', 'Ar na máquina', `${r.fans} × ${fx(r.flowPerFan)} m³/s = ${fx(r.mMoist)} kg/s. O ar esquenta ${fx(r.dTair, 1)} K: ${fx(r.Tc, 1)} → ${fx(r.Th, 1)} °C.${r.dTair < 3 ? ' Elevação muito pequena: confira se a vazão por ramo não está superestimada.' : r.dTair > 40 ? ' Elevação muito grande para uma máquina: confira a vazão.' : ''}`);
    add(r.waterRise > 15 ? 'warn' : 'ok', 'Água no trocador', `${fx(r.qvWh, 1)} m³/h esquentam ${fx(r.waterRise, 1)} K: ${fx(d.waterIn, 1)} → ${fx(r.waterOut, 1)} °C.${r.waterRise > 15 ? ' Elevação alta: pouca água encarece o trocador e aproxima a saída da água do ar quente.' : ''}`);
    if (r.eps > 0.85) add('warn', 'Efetividade muito exigente', `ε = ${fx(r.eps, 3)}. A área cresce muito e fica sensível à incrustação.`);
    else add('ok', 'Área mínima', `${f0(r.areaMin)} m² no total (${r.modules} × ${f0(r.areaMinUnit)} m²) para UA = ${fx(r.UA)} kW/K com U ≈ ${fx(r.U, 1)} W/m²K, já com incrustação. Face mínima ${r.modules} × ${fx(r.frontalArea)} m².`);
    if (isNum(r.approach) && r.approach > 0 && r.approach < 4) add('warn', 'Aproximação fria apertada', `Ar frio só ${fx(r.approach, 1)} K acima da água de entrada. Abaixo de ~4–5 K a área cresce rapidamente.`);
    if (isNum(r.dTh) && r.dTh < 3) add('warn', 'Água sai perto do ar quente', `Só ${fx(r.dTh, 1)} K entre o ar quente e a água de saída. Aumente a vazão de água.`);
    if (r.faceVel > 3.5) add('warn', 'Velocidade frontal alta', `${fx(r.faceVel, 1)} m/s. Acima de ~3,5 m/s crescem Δp, ruído e arraste de condensado.`);
    if (isNum(r.dpAir)) {
      const okDp = r.dpAir <= d.airDpAllow;
      add(okDp ? 'ok' : 'warn', 'Δp de ar no trocador', `≈ ${f0(r.dpAir)} Pa (${fx(r.dpAir / 9.80665, 1)} mmCA, ±25 %) com ${r.rows} fileira${r.rows > 1 ? 's' : ''}, contra ${f0(d.airDpAllow)} Pa disponíveis.${okDp ? '' : ' Aumente a face (menor velocidade) ou revise o ventilador.'}`);
    }
    if (isNum(r.waterVel)) {
      if (r.waterVel > r.mat.vmax) add('fail', 'Velocidade da água alta para o material', `${fx(r.waterVel)} m/s em ${r.mat.label} (máximo orientativo ${fx(r.mat.vmax, 1)} m/s).`);
      else if (r.waterVel < 0.8) add('warn', 'Velocidade da água baixa', `${fx(r.waterVel)} m/s. Favorece depósito; aumente a velocidade alvo ou o Δp admissível.`);
      else add('ok', 'Velocidade da água', `${fx(r.waterVel)} m/s em ${r.mat.label} (faixa ~1,0 a ${fx(r.mat.vmax, 1)} m/s), ${r.passes} passes.`);
    }
    if (isNum(r.Re) && r.Re < 2300) add('fail', 'Água em regime laminar', 'O h interno cai para Nu ≈ 3,66 e o U despenca. Aumente a velocidade da água.');
    if (isNum(r.tubeDp) && d.waterDpAllow > 0 && r.tubeDp > d.waterDpAllow) add('warn', 'Δp de água acima do admissível', `≈ ${fx(r.tubeDp, 1)} kPa contra ${f0(d.waterDpAllow)} kPa, mesmo com um passe.`);
    const reOk = r.ReAir >= 1100 && r.ReAir <= 18000 && r.sh >= 0.13 && r.sh <= 0.63;
    if (!r.manual && !reOk) add('warn', 'Fora da faixa de Briggs & Young', `Re = ${f0(r.ReAir)}, s/h = ${fx(r.sh, 3)}. Trate o h do ar como estimativa grosseira.`);
    if (!r.manual && r.rows < 4) add('warn', 'Feixe raso no exemplo de montagem', `${r.rows} fileira${r.rows > 1 ? 's' : ''}: Briggs & Young vem de feixes de 6 fileiras; com menos de 4 o h real do ar tende a ser menor. Para a área mínima, considere U uns 10 % menor ou uma face menor (mais fileiras).`);
    if (['river', 'muddy'].includes(d.waterQuality) && d.tubeMaterial === 'steel')
      add('warn', 'Material × qualidade da água', `BBC 1972: aço com cabeçote fixo só para água limpa e não corrosiva. Para ${r.foul.label.toLowerCase()}, cobre ou latão especial com cabeçotes removíveis.`);
    if (d.waterQuality === 'sea' && ['copper', 'steel', 'admiralty'].includes(d.tubeMaterial))
      add('warn', 'Água do mar', `${r.mat.label} não é indicado; prefira CuNi 90/10 ou 70/30.`);
    if (!(d.rh > 0)) add('ok', 'Ar seco (CNTP)', 'Sem umidade informada, a condensação não é verificada. Informe a UR e a temperatura ambiente do local para checar.');
    else {
      if (r.dew >= d.waterIn) add('warn', 'Condensação na parada com água circulando', `Orvalho ${fx(r.dew, 1)} °C ≥ água ${fx(d.waterIn, 1)} °C. Fechar a água com a máquina parada e prever bandeja e dreno.`);
      if (r.dew >= r.wallMin) add('fail', 'Condensação em operação', `Parede mínima ≈ ${fx(r.wallMin, 1)} °C ≤ orvalho ${fx(r.dew, 1)} °C: bandeja e dreno obrigatórios.`);
      else if (r.dew < d.waterIn) add('ok', 'Condensação pouco provável', `Orvalho ${fx(r.dew, 1)} °C abaixo da água e da parede mínima (${fx(r.wallMin, 1)} °C).`);
    }
    if (isNum(r.n1Th)) add('info', 'Uma unidade fora (N−1)', `Com a área mínima, o ar quente iria a ${fx(r.n1Th, 1)} °C (+${fx(r.n1Th - r.Th, 1)} K). Para manter o ar frio, a carga cai a ~${f0(r.n1Load)} %. Se N−1 for requisito, a área por unidade precisa crescer.`);
    if (r.windN > r.windLim) add('fail', 'Enrolamento acima da referência', `${f0(r.windN)} °C > ${f0(r.windLim)} °C (classe ${d.insClass}).`);
    else if (r.windN > r.windLimB) add('warn', 'Enrolamento usa a reserva da classe F', `${f0(r.windN)} °C, acima da referência classe B (${f0(r.windLimB)} °C).`);
    else add('ok', 'Enrolamento', `${f0(r.windN)} °C, dentro da referência classe B (${f0(r.windLimB)} °C).`);
    if (r.manual && isNum(r.Ucalc) && d.uOverall > 0 && Math.abs(d.uOverall / r.Ucalc - 1) > 0.25)
      add('warn', 'U manual × superfície de referência', `${f0(d.uOverall)} W/m²K contra ${fx(r.Ucalc, 1)} calculado (${d.uOverall > r.Ucalc ? '+' : ''}${f0((d.uOverall / r.Ucalc - 1) * 100)} %).`);
    return C;
  }

  /* ---- Entrada pública -------------------------------------------------------------- */
  function calculate(values) {
    const d = validate(values);
    const r = compute(d);
    if (!(r.eps > 0 && r.eps < 1)) {
      throw new InputError([`Trocador inviável: a efetividade requerida passa de 1. Com ${fx(r.qvWh, 1)} m³/h, a água sairia a ${fx(r.waterOut, 1)} °C, acima do ar quente (${fx(r.Th, 1)} °C).`], {
        waterFlow: 'aumente a vazão de água',
        waterIn: 'ou use água mais fria',
        airColdTarget: 'ou aceite um ar frio mais quente'
      });
    }
    if (!isNum(r.NTU)) {
      throw new InputError([`O arranjo escolhido não atinge ε = ${fx(r.eps, 3)} com Cr = ${fx(r.Cr, 3)}.`], { hxType: 'use mais passes ou contracorrente' });
    }
    if (!(r.U > 0) || !isNum(r.areaMin)) throw new InputError(['Não foi possível calcular o coeficiente U com essa superfície.'], { finOD: 'confira a geometria da aleta' });
    r.steps = buildSteps(r);
    r.rfq = rfqData(r);
    r.checks = buildChecks(r);
    return r;
  }

  window.VGThermal = {
    GROUPS, FIELDS, FIELD, EXAMPLE, EMPTY, InputError, calculate,
    HX_LABEL, MATERIAL, FOULING, CLASS_RISE, KW_TO_KCALH, RHO_N, fx, f0
  };
})();
