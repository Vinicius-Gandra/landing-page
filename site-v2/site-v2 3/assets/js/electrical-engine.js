/* Laboratório elétrico · bobina pré-formada do estator.
   Método: REMC – Design de Bobinas, rev. 00 (DATA Engenharia, 15/01/2025), itens 3.1 a 3.17 e 5.2.
   Entrada: dados da FTD digitados. O condutor (fios, dimensões) é composto a partir da
   resistência por fase e do espaço da ranhura; a geometria da cabeça segue o item 3.7. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VGElectrical = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PI = Math.PI;
  const SQRT3 = Math.sqrt(3);
  const MU0 = 4e-7 * PI;
  const MANUAL = 'Design de Bobinas rev. 00';
  const it = n => `${MANUAL}, item ${n}`;

  /* ---- Campos ------------------------------------------------------------------ */
  const GROUPS = [
    { id: 'ident', title: 'Identificação', sub: 'Carimbo do desenho' },
    { id: 'nominal', title: 'Dados nominais', sub: 'Valores característicos e placa da FTD' },
    { id: 'estator', title: 'Estator e ranhura', sub: 'Partes mecânicas do estator' },
    { id: 'enrol', title: 'Enrolamento do estator', sub: 'Bobina pré-formada' },
    { id: 'geom', title: 'Geometria da bobina', sub: 'Medidas da máquina (POP-MTR-03005)', premise: true },
    { id: 'prem', title: 'Fabricação e limites', sub: 'Materiais, arredondamento e restrições', premise: true }
  ];
  const F = [];
  const add = (group, key, type, label, unit, code, def, extra = {}) => F.push({ group, key, type, label, unit, code, def, ...extra });

  add('ident', 'cliente', 'text', 'Cliente', '', 'NOME CLIENTE', 'DATA');
  add('ident', 'os', 'text', 'Ordem de serviço', '', 'O.S.', '');
  add('ident', 'equipamento', 'text', 'Equipamento', '', '', '', { placeholder: 'Automático', span: true });
  add('ident', 'elaborado', 'text', 'Elaborado por', '', '', '', { span: true });

  add('nominal', 'funcao', 'select', 'Tipo de máquina', '', '', 'gerador', { options: [['gerador', 'Gerador'], ['motor', 'Motor']], help: 'Muda o cálculo da corrente (item 3.1).' });
  add('nominal', 'ligacao', 'select', 'Ligação', '', '', 'Y', { options: [['Y', 'Estrela · Y'], ['D', 'Triângulo · Δ']] });
  add('nominal', 'potencia', 'num', 'Potência ativa', 'kW', 'Potência Ativa', 8000, { req: true });
  add('nominal', 'fp', 'num', 'Fator de potência', '', 'FP', 0.8, { req: true });
  add('nominal', 'rend', 'num', 'Rendimento', 'pu', 'Rend.', 0.98, { help: 'Usado para motor.' });
  add('nominal', 'tensao', 'num', 'Tensão', 'V', 'Tensão', 13800, { req: true });
  add('nominal', 'corrente', 'num', 'Corrente', 'A', 'Corrente', 418.37, { placeholder: 'Calcular' });
  add('nominal', 'frequencia', 'num', 'Frequência', 'Hz', 'Frequência', 60, { req: true });
  add('nominal', 'polos', 'int', 'Polos', '', 'Polos', 4, { req: true });

  add('estator', 'ranhuras', 'int', 'Ranhuras', '', 'Qt. Ranhuras', 54, { req: true });
  add('estator', 'pacote', 'num', 'Comprimento do núcleo', 'mm', 'Pac.', 1257.3, { req: true });
  add('estator', 'dInt', 'num', 'Diâmetro interno', 'mm', 'Diâmetro Interno', 827.532, { req: true });
  add('estator', 'dExt', 'num', 'Diâmetro externo', 'mm', 'Diâmetro Externo', 1371.6, { req: true });
  add('estator', 'w12', 'num', 'Largura da ranhura', 'mm', 'W12', 20.828, { req: true });
  add('estator', 'd12', 'num', 'Profundidade total', 'mm', 'D12', 105.41, { req: true });
  add('estator', 'ds', 'num', 'Profundidade sob a cunha', 'mm', 'DS', 100.41, { req: true });
  add('estator', 'skew', 'num', 'Inclinação (skew)', 'ranh.', 'SKEW', 1, { help: '0 = sem skew. Só entra no desenho.' });

  add('enrol', 'espBob', 'int', 'Espiras por bobina', '', 'Esp./Bob.', 9, { req: true });
  add('enrol', 'circuitos', 'int', 'Circuitos paralelos', '', 'Circ.-Lig.', 2, { req: true });
  add('enrol', 'pbPct', 'num', 'Passo da bobina', '%', 'PB%', 96.2962963, { req: true, help: 'Convertido para passo 1–X.' });
  add('enrol', 'cme', 'num', 'Comprimento médio da espira', 'mm', 'CME', 4998.24, { help: 'Ajusta a extensão da parte curva (geometria).' });
  add('enrol', 'rFase', 'num', 'Resistência por fase · 25 °C', 'Ω', 'Resistência/Fase', 0.064, { placeholder: 'Vazio: ocupar a ranhura', span: true, help: 'Define a secção do condutor. Vazio: o fio ocupa toda a altura da ranhura.' });
  add('enrol', 'iTer', 'num', 'Isolação para terra (Aim)', 'mm', 'ITer.', 6.4, { req: true, help: 'Acréscimo total dos dois lados.' });
  add('enrol', 'iEsp', 'num', 'Isolação do fio (Aif)', 'mm', 'IEsp.', 0.3048, { req: true, help: 'Acréscimo total do isolamento de cada fio.' });
  add('enrol', 'iEntre', 'num', 'Isolação entre espiras (Aie)', 'mm', 'IEntre-espiras', 0);

  add('geom', 'calcoFundo', 'num', 'Calço de fundo', 'mm', '', 1);
  add('geom', 'calcoMeio', 'num', 'Calço intermediário', 'mm', '', 5);
  add('geom', 'calcoTopo', 'num', 'Calço de topo', 'mm', '', 1);
  add('geom', 'dedo', 'num', 'Largura do dedo de aperto', 'mm', '', 25);
  add('geom', 'retaLL', 'num', 'Parte reta · LL', 'mm', '', 50, { help: 'Fora do núcleo, lado da ligação.' });
  add('geom', 'retaLOL', 'num', 'Parte reta · LOL', 'mm', '', 50, { help: 'Fora do núcleo, lado oposto.' });
  add('geom', 'caimLL', 'num', 'Caimento da cabeça · LL', 'mm', '', 25);
  add('geom', 'caimLOL', 'num', 'Caimento da cabeça · LOL', 'mm', '', 25);
  add('geom', 'phiC', 'num', 'Diâmetro interno da cabeça', 'mm', '', null, { placeholder: 'Mínimo (3.10)', help: 'Vazio: mínimo recomendado pelo item 3.10.' });
  add('geom', 'distLig', 'num', 'Distância das ligações', 'mm', '', 50);
  add('geom', 'expcModo', 'select', 'Parte curva', '', '', 'cme', { options: [['cme', 'Ajustar ao CME da FTD'], ['manual', 'Informar a extensão']], span: true });
  add('geom', 'expcLL', 'num', 'Extensão da parte curva · LL', 'mm', '', 400, { help: 'Projeção. Usada se "Informar a extensão".' });
  add('geom', 'expcLOL', 'num', 'Extensão da parte curva · LOL', 'mm', '', 400);
  add('geom', 'braco', 'select', 'Braço superior', '', '', 'direita', { options: [['direita', 'À direita do inferior'], ['esquerda', 'À esquerda do inferior']] });
  add('geom', 'pontasInv', 'int', 'Bobinas com pontas invertidas', '', '', 0, { help: 'As demais têm pontas normais.' });

  add('prem', 'afc', 'num', 'Acréscimo da fita condutiva (Afc)', 'mm', '', 0, { help: 'Acima de 4,16 kV, se não estiver no ITer.' });
  add('prem', 'aa', 'num', 'Acréscimo do acabamento (Aa)', 'mm', '', 0, { help: 'Até 4,16 kV, se não estiver no ITer.' });
  add('prem', 'isoFio', 'text', 'Isolamento do fio', '', '', '', { placeholder: 'Ex.: ESMR 1F-50' });
  add('prem', 'isoMassa', 'text', 'Instrução de isolamento', '', '', '', { placeholder: 'Ex.: PT20A (IP-164)' });
  add('prem', 'passo', 'num', 'Arredondamento do fio', 'mm', '', 0.05);
  add('prem', 'largMax', 'num', 'Largura máxima do fio', 'mm', '', 10, { help: 'Limite para conformar a bobina.' });
  add('prem', 'espMin', 'num', 'Altura mínima do fio', 'mm', '', 0.8);
  add('prem', 'espMax', 'num', 'Altura máxima do fio', 'mm', '', 5.6);
  add('prem', 'maxFios', 'int', 'Máximo de fios por espira', '', '', 6);
  add('prem', 'fiosLarg', 'int', 'Fixar fios na largura', '', '', null, { placeholder: 'Automático' });
  add('prem', 'fiosAlt', 'int', 'Fixar fios na altura', '', '', null, { placeholder: 'Automático' });
  add('prem', 'reserva', 'int', 'Bobinas reserva', '', '', 2);

  const FIELDS = Object.freeze(F.map(f => Object.freeze(f)));
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const EXAMPLE = Object.freeze(Object.fromEntries(FIELDS.map(f => [f.key, f.def ?? null])));
  const FTD_GROUPS = ['ident', 'nominal', 'estator', 'enrol'];
  const EMPTY = Object.freeze(Object.fromEntries(FIELDS.map(f => [f.key, FTD_GROUPS.includes(f.group) && f.type !== 'select' ? (f.type === 'text' ? '' : null) : f.def ?? null])));
  const RHO = 0.017241;     // Ω·mm²/m a 25 °C (item 3.13, NEMA MW 1000)
  const DCU = 8.89;         // g/cm³ (item 3.15)

  class InputError extends Error {
    constructor(errors) {
      super(errors.join(' · '));
      this.name = 'InputError';
      this.errors = errors;
      this.fields = {};
      for (const msg of errors) {
        const f = FIELDS.find(x => msg.startsWith(x.label + ':'));
        if (f) this.fields[f.key] = msg.slice(f.label.length + 1).trim();
      }
    }
  }
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const fmt = (x, d) => {
    if (!finite(x)) return '—';
    const a = Math.abs(x);
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d ?? (a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 3 : 4) }).format(x);
  };
  const deg = r => r * 180 / PI;

  // Raio das quinas do fio retangular conforme a altura (IEC 60317-0-2); usado no fator de curvatura (item 3.3).
  const cornerRadius = t => t <= 1.6 ? 0.5 : t <= 2.24 ? 0.65 : t <= 3.55 ? 0.8 : 1.0;
  const curvature = t => cornerRadius(t) ** 2 * (1 - PI / 4);         // Fc: quadrado − quarto de círculo
  const wireArea = (Af, Lf) => Af * Lf - 4 * curvature(Af);
  const phi = x => x < 1e-4 ? 1 : x * (Math.sinh(2 * x) + Math.sin(2 * x)) / (Math.cosh(2 * x) - Math.cos(2 * x));
  const psi = x => x < 1e-4 ? 0 : 2 * x * (Math.sinh(x) - Math.sin(x)) / (Math.cosh(x) + Math.cos(x));

  function calculate(raw = {}) {
    const v = { ...EXAMPLE, ...raw };
    const errors = [], notes = [], steps = [];
    const note = (severity, title, detail) => notes.push({ severity, title, detail });
    const step = (section, title, formula, subst, value, unit, source = '', comment = '') =>
      steps.push({ section, title, formula, subst, value, unit, source, comment });

    for (const f of FIELDS) {
      const x = v[f.key];
      if (f.type === 'text') { v[f.key] = x == null ? '' : String(x).trim(); continue; }
      if (f.type === 'select') { if (!f.options.some(([o]) => o === x)) errors.push(`${f.label}: escolha uma opção.`); continue; }
      if (x === null || x === undefined || x === '') { v[f.key] = null; if (f.req) errors.push(`${f.label}: informe o valor${f.code ? ` (FTD: ${f.code})` : ''}.`); continue; }
      if (typeof x !== 'number' || !Number.isFinite(x)) { errors.push(`${f.label}: use um número.`); continue; }
      if (f.type === 'int' && !Number.isInteger(x)) errors.push(`${f.label}: use número inteiro.`);
      if (x < 0) errors.push(`${f.label}: não use valor negativo.`);
      if (f.req && x === 0) errors.push(`${f.label}: deve ser maior que zero.`);
    }
    if (v.funcao === 'motor' && !(finite(v.rend) && v.rend > 0)) errors.push('Rendimento: informe para motor.');
    if (finite(v.fp) && v.fp > 1) errors.push('Fator de potência: use valor até 1.');
    if (finite(v.rend) && v.rend > 1) errors.push('Rendimento: use valor em pu (até 1).');
    if (finite(v.polos) && v.polos % 2) errors.push('Polos: use número par.');
    if (finite(v.ds) && finite(v.d12) && v.ds > v.d12) errors.push('Profundidade sob a cunha: não pode ser maior que a profundidade total (D12).');
    if (finite(v.dExt) && finite(v.dInt) && v.dExt <= v.dInt) errors.push('Diâmetro externo: deve ser maior que o interno.');
    if (finite(v.pbPct) && (v.pbPct <= 0 || v.pbPct > 150)) errors.push('Passo da bobina: use percentual do passo polar entre 0 e 150 %.');
    if (v.expcModo === 'manual' && !(finite(v.expcLL) && finite(v.expcLOL))) errors.push('Extensão da parte curva · LL: informe as duas extensões ou escolha ajustar ao CME.');
    if (v.expcModo === 'cme' && !finite(v.cme)) errors.push('Comprimento médio da espira: informe o CME da FTD ou escolha informar a extensão da parte curva.');
    for (const k of ['calcoFundo', 'calcoMeio', 'calcoTopo', 'dedo', 'retaLL', 'retaLOL', 'caimLL', 'caimLOL', 'distLig', 'passo', 'largMax', 'espMin', 'espMax', 'maxFios'])
      if (!finite(v[k]) && !errors.some(e => e.startsWith(FIELD[k].label))) errors.push(`${FIELD[k].label}: informe o valor.`);
    if (finite(v.passo) && v.passo <= 0) errors.push('Arredondamento do fio: maior que zero.');
    if (finite(v.espMin) && finite(v.espMax) && v.espMin >= v.espMax) errors.push('Altura mínima do fio: deve ser menor que a máxima.');
    if (errors.length) throw new InputError([...new Set(errors)]);

    const Nr = v.ranhuras, Np = v.polos, Nc = v.circuitos, Ne = v.espBob;
    const Aif = v.iEsp, Aie = v.iEntre ?? 0, Aim = v.iTer;
    const highV = v.tensao > 4160;
    const Afc = highV ? v.afc : 0, Aa = highV ? 0 : v.aa;
    const cunha = v.d12 - v.ds;
    const calcos = v.calcoFundo + v.calcoMeio + v.calcoTopo;
    const qGrupo = Nr / (3 * Np);
    const tau = Nr / Np;
    const span = Math.round(v.pbPct / 100 * tau);
    const Pb = span + 1;                               // passo 1–X (item 2.21)
    if (Math.abs(v.pbPct / 100 * tau - span) > 0.02) note('warn', 'Passo da bobina não inteiro', `PB% × passo polar = ${fmt(v.pbPct / 100 * tau)} ranhuras; adotado passo 1–${Pb}.`);
    if (span < 1) throw new InputError(['Passo da bobina: resulta em menos de uma ranhura.']);

    /* 3.1 · 3.2 · Correntes --------------------------------------------------------- */
    const isGen = v.funcao === 'gerador';
    const S = v.potencia / v.fp;
    const IL = finite(v.corrente) ? v.corrente : isGen ? S * 1000 / (v.tensao * SQRT3) : v.potencia * 1000 / (v.fp * v.rend * v.tensao * SQRT3);
    if (finite(v.corrente)) step('corrente', 'Corrente de linha', 'I_L = corrente da FTD', fmt(IL), IL, 'A', 'FTD');
    else if (isGen) step('corrente', 'Corrente de linha (gerador)', 'I_L = S/(V·√3),  S = P/FP', `${fmt(S * 1000)}/(${fmt(v.tensao)}·√3)`, IL, 'A', it('3.1'));
    else step('corrente', 'Corrente de linha (motor)', 'I_L = P/(FP·η·V·√3)', `${fmt(v.potencia * 1000)}/(${fmt(v.fp)}·${fmt(v.rend)}·${fmt(v.tensao)}·√3)`, IL, 'A', it('3.1'));
    const If = v.ligacao === 'Y' ? IL : IL / SQRT3;
    step('corrente', 'Corrente de fase', v.ligacao === 'Y' ? 'I_F = I_L  (Y)' : 'I_F = I_L/√3  (Δ)', v.ligacao === 'Y' ? fmt(IL) : `${fmt(IL)}/√3`, If, 'A', it('3.2'));
    const Ie = If / Nc;
    step('corrente', 'Corrente na espira', 'I_e = I_F/Nc', `${fmt(If)}/${Nc}`, Ie, 'A', it('6.18'));
    const Vf = v.ligacao === 'Y' ? v.tensao / SQRT3 : v.tensao;
    const Nfase = Nr / 3 * Ne / Nc;
    step('corrente', 'Tensão por espira', 'V_e = V_F/(Nr/3·Ne/Nc)', `${fmt(Vf)}/(${Nr}/3·${Ne}/${Nc})`, Vf / Nfase, 'V', it('6.14'), `Tensão de fase ${fmt(Vf)} V; ${fmt(Nfase)} espiras em série por circuito.`);
    step('corrente', 'Bobinas por grupo', 'q = Nr/(3·Np)', `${Nr}/(3·${Np})`, qGrupo, 'bobinas', it('2.11'), Number.isInteger(qGrupo) ? '' : 'Enrolamento fracionário: valor médio.');

    /* Geometria e resistências do item 3.4 ao 3.13 para um fio dado ------------- */
    const R = v.d12, rMid = v.dInt / 2 + R / 2;
    const Abb = (Pb - 1) / Nr * 2 * PI / 2;          // item 3.8 (rad)
    const Xr = rMid * 2 * Math.sin(Abb / 2);          // item 3.9
    function geometry(w, expc) {
      const { Af, Lf, Fa, Fl } = w;
      const Sw = wireArea(Af, Lf);
      const Se = Sw * Fa * Fl;                         // item 3.3
      const Lbi = (Lf + Aif) * Fl + Aie;
      const Aib = (Af + Aif) * Fa * Ne + Aie;
      const Lb = (Lf + Aif) * Fl + Aie + Aim + Aa + Afc;   // item 3.4
      const Ab = (Af + Aif) * Fa * Ne + Aie + Aim + Aa + Afc;
      const sobraL = v.w12 - Lb;                       // item 3.5
      const sobraA = v.ds - (2 * Ab + calcos);
      const Pr = v.pacote + v.retaLL + v.retaLOL;
      const phiMin = Math.floor((0.01367 * Pr + 2.6694 * Af + 0.782025 * Ne + 0.000595806 * v.potencia) / 5) * 5;  // item 3.10
      const phiC = finite(v.phiC) && v.phiC > 0 ? v.phiC : Math.max(5, phiMin);
      const side = (ExPc, caim) => {
        const Yr = ExPc - Aib;
        const Asc = Math.atan2(Xr, Yr);               // item 3.9
        const X = rMid * Abb - phiC / 2 * Math.sin(Asc);   // item 3.7
        const Y = ExPc - Aib - phiC / 2 * Math.cos(Asc);
        const Z = caim - cunha;
        return { ExPc, Yr, Asc, X, Y, Z, Pc: Math.hypot(X, Y, Z) };
      };
      const build = (eLL, eLOL) => {
        const LL = side(eLL, v.caimLL), LOL = side(eLOL, v.caimLOL);
        const Cv = (Pr + LL.Pc + LOL.Pc + phiC) * 1.00591;   // item 3.7
        const Cme = 2 * (Cv - phiC) + 2 * (phiC / 2 + Ab / 2) * PI;   // item 3.12
        return { LL, LOL, Cv, Cme };
      };
      let eLL = v.expcLL, eLOL = v.expcLOL, fitted = false, unreachable = false;
      if (v.expcModo === 'cme') {
        // Mesma extensão nos dois lados; procura a que reproduz o CME da FTD (Cme cresce com ExPc).
        const lo0 = Aib + phiC / 2 + 1;
        let lo = lo0, hi = Math.max(lo0 + 10, 6000);
        if (build(lo, lo).Cme > v.cme) { unreachable = true; eLL = eLOL = lo; }
        else {
          for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (build(mid, mid).Cme < v.cme) lo = mid; else hi = mid; }
          eLL = eLOL = (lo + hi) / 2; fitted = true;
        }
      } else if (expc) { eLL = expc.LL; eLOL = expc.LOL; }
      const g = build(eLL, eLOL);
      let Cte = 2 * (g.Cv - phiC) * Ne;                 // item 3.12
      const turns = [];
      for (let i = 1; i <= Ne; i++) {
        const head = 2 * (phiC / 2 + (Af + Aif) * Fa * (i - 0.5)) * PI;
        turns.push(2 * (g.Cv - phiC) + head);
        Cte += head;
      }
      const toMilli = mm => mm / 1000 / Se * RHO * 1000;
      const Rb = toMilli(Cte + 2 * v.distLig);          // item 3.13
      const Rg = Rb * qGrupo;
      const Raf = toMilli(v.dInt / 2 * (2 * PI / Nc) * (Nc - 1) / 2);
      const Rcg = toMilli((v.dInt / 2 + R) * (2 * PI / Np) * ((Np - 1) - (Nc - 1)));
      const Rcl = 0.65 / (1.3 * Se) * RHO * 1000;
      const Rf = Rb * (Nr / 3) / Nc ** 2 + Rcg / Nc ** 2 + Raf + Rcl;
      const RL = v.ligacao === 'Y' ? 2 * Rf : 2 / 3 * Rf;
      return { Sw, Se, Lbi, Aib, Lb, Ab, sobraL, sobraA, Pr, phiMin, phiC, ...g, Cte, turns, Rb, Rg, Raf, Rcg, Rcl, Rf, RL, fitted, unreachable };
    }

    /* Composição do condutor a partir da FTD --------------------------------------- */
    const st = v.passo;
    const floorTo = x => Math.round(Math.floor(x / st + 1e-9) * st * 1e6) / 1e6;
    const ceilTo = x => Math.round(Math.ceil(x / st - 1e-9) * st * 1e6) / 1e6;
    const Wd = v.w12 - Aie - Aim - Aa - Afc;          // largura para (Lf + Aif)·Fl
    const Hd = ((v.ds - calcos) / 2 - Aie - Aim - Aa - Afc) / Ne;   // altura por espira para (Af + Aif)·Fa
    if (Wd <= 0 || Hd <= 0) throw new InputError(['A isolação e os calços não deixam espaço para o cobre na ranhura: revise ITer, IEsp, calços e a ranhura.']);
    const tRef = 95;
    const rhoHot = RHO * (234.5 + tRef) / (234.5 + 25) * 1e-6;
    const krFor = (Af, wTot, m) => {
      const xi = Af / 1000 * Math.sqrt(PI * v.frequencia * MU0 / rhoHot * wTot / v.w12);
      return { xi, kr: phi(xi) + (m * m - 1) / 3 * psi(xi) };
    };
    const byR = finite(v.rFase) && v.rFase > 0;
    const forced = finite(v.fiosLarg) && finite(v.fiosAlt) && v.fiosLarg > 0 && v.fiosAlt > 0;
    const combos = [];
    if (forced) combos.push([v.fiosLarg, v.fiosAlt]);
    else for (let Fl = 1; Fl <= 4; Fl++) for (let Fa = 1; Fa <= 4; Fa++) if (Fl * Fa <= v.maxFios) combos.push([Fl, Fa]);
    function compose(Sreq, K) {
      const list = [];
      for (const [Fl, Fa] of combos) {
        const Lf = floorTo(Wd / Fl - Aif);
        const Afit = floorTo(Hd / Fa - Aif);
        if (Lf <= 0 || Afit <= 0) { list.push({ Fl, Fa, Lf, Af: Afit, fits: false, reason: 'sem espaço para o fio' }); continue; }
        let Af = Afit;
        if (Sreq) {
          const As = Sreq / (Fa * Fl);
          Af = As / Lf;
          for (let i = 0; i < 5; i++) Af = (As + 4 * curvature(Math.min(Af, Lf))) / Lf;
          Af = ceilTo(Af);
        }
        const Se = wireArea(Af, Lf) * Fa * Fl;
        const Ab = (Af + Aif) * Fa * Ne + Aie + Aim + Aa + Afc;
        const Lb = (Lf + Aif) * Fl + Aie + Aim + Aa + Afc;
        const sobraA = v.ds - (2 * Ab + calcos), sobraL = v.w12 - Lb;
        const ratio = Af / Lf;
        const { xi, kr } = krFor(Af, Fl * Lf, 2 * Ne * Fa);
        const reasons = [];
        if (sobraA < -1e-9) reasons.push(`falta ${fmt(-sobraA, 2)} mm na altura da ranhura`);
        if (sobraL < -1e-9) reasons.push(`falta ${fmt(-sobraL, 2)} mm na largura`);
        if (Af < v.espMin) reasons.push(`altura do fio abaixo de ${fmt(v.espMin)} mm`);
        if (Af > v.espMax) reasons.push(`altura do fio acima de ${fmt(v.espMax)} mm`);
        if (Lf > v.largMax) reasons.push(`largura do fio acima de ${fmt(v.largMax)} mm`);
        if (Af > Lf) reasons.push('altura maior que a largura (item 2.40)');
        else if (ratio > 0.75) reasons.push(`altura/largura ${fmt(ratio, 3)} > 0,75 (alerta 11)`);
        else if (ratio < 0.18) reasons.push(`altura/largura ${fmt(ratio, 3)} < 0,18 (alerta 12)`);
        list.push({ Fl, Fa, Lf, Af, Se, Ab, Lb, sobraA, sobraL, ratio, xi, kr, J: Ie / Se, R: K ? K / Se / 1000 : null, fits: !reasons.length, reason: reasons.join('; ') });
      }
      const ok = list.filter(c => c.fits);
      let chosen;
      if (ok.length) {
        const best = Math.min(...ok.map(c => c.kr));
        chosen = ok.filter(c => c.kr <= best * 1.05).sort((a, b) => a.Fa * a.Fl - b.Fa * b.Fl || a.kr - b.kr)[0];
      } else chosen = forced ? list.find(c => finite(c.Se)) : list.filter(c => finite(c.Se)).sort((a, b) => Math.min(b.sobraA, b.sobraL) - Math.min(a.sobraA, a.sobraL))[0];
      return { list, chosen, okCount: ok.length };
    }
    // Primeira estimativa: Cte ≈ Ne·CME; depois a geometria do item 3.7–3.13 refina K = R_fase·S.
    let K = null, Sreq = null;
    if (byR) {
      const cmeGuess = finite(v.cme) ? v.cme : 2 * (v.pacote + 600);
      const K0 = (Ne * cmeGuess / 1000 * RHO * 1000) * (Nr / 3) / Nc ** 2;
      Sreq = K0 / (v.rFase * 1000);
    }
    let comp = compose(Sreq, K), geo = null;
    for (let iter = 0; iter < 6 && comp.chosen; iter++) {
      geo = geometry(comp.chosen);
      if (!byR) break;
      K = geo.Rf * geo.Se;
      const S2 = K / (v.rFase * 1000);
      const next = compose(S2, K);
      const same = next.chosen && next.chosen.Fl === comp.chosen.Fl && next.chosen.Fa === comp.chosen.Fa && next.chosen.Lf === comp.chosen.Lf && next.chosen.Af === comp.chosen.Af;
      Sreq = S2; comp = next;
      if (same) break;
    }
    if (!comp.chosen) throw new InputError(['Não há espaço para nenhum fio na ranhura: revise W12, DS, ITer, IEsp e os calços.']);
    const w = comp.chosen;
    for (const c of comp.list) c.chosen = c === w;
    comp.list.sort((a, b) => (b.chosen - a.chosen) || (b.fits - a.fits) || (a.kr ?? 99) - (b.kr ?? 99));
    geo = geometry(w);
    if (!w.fits) note('fail', forced ? 'A composição fixada não atende' : 'Nenhuma composição cabe na ranhura', `${w.Fl} × ${w.Fa}: ${w.reason}. ${forced ? '' : 'Mostrada a mais próxima de caber. '}Revise calços, isolação ou os dados da FTD.`);

    const r = cornerRadius(w.Af), Fc = curvature(w.Af);
    if (byR) {
      step('condutor', 'Secção de cobre necessária', 'S = K/R_fase,  K = R_fase·S da geometria (itens 3.7–3.13)', `${fmt(K / 1000, 5)}/${fmt(v.rFase)}`, Sreq, 'mm²', it('3.13'),
        'K soma bobinas, jumpers, anel de fase e cabo de ligação, todos proporcionais a 1/S. Calculado em iterações com a geometria da bobina.');
    } else note('info', 'Secção pelo espaço da ranhura', 'Sem resistência por fase: o fio ocupa toda a altura disponível em cada espira.');
    step('condutor', 'Largura disponível para os fios', '(Lf + Aif)·Fl ≤ W12 − Aie − Aim − Aa − Afc', `${fmt(v.w12)} − ${fmt(Aie)} − ${fmt(Aim)} − ${fmt(Aa)} − ${fmt(Afc)}`, Wd, 'mm', it('3.4'), 'Sem calço lateral (item 3.5).');
    step('condutor', 'Altura disponível por espira', '(Af + Aif)·Fa ≤ [(DS − calços)/2 − Aie − Aim − Aa − Afc]/Ne', `[(${fmt(v.ds)} − ${fmt(calcos)})/2 − ${fmt(Aie)} − ${fmt(Aim)} − ${fmt(Aa)} − ${fmt(Afc)}]/${Ne}`, Hd, 'mm', it('3.4 e 3.5'),
      `Calços: fundo ${fmt(v.calcoFundo)}, intermediário ${fmt(v.calcoMeio)} e topo ${fmt(v.calcoTopo)} mm.`);
    step('condutor', 'Fios por espira', 'Fl × Fa', `${w.Fl} na largura × ${w.Fa} na altura`, w.Fl * w.Fa, 'fios', it('2.44 e 2.45'),
      forced ? 'Fixado nas premissas.' : comp.okCount === 1 ? 'Única composição testada que cabe e respeita a relação altura/largura de 0,18 a 0,75.' : `Entre ${comp.okCount} composições que cabem, a de menor perda por correntes parasitas; com perdas até 5 % maiores, a de menos fios.`);
    step('condutor', 'Largura do fio (Lf)', 'Lf = W_disp/Fl − Aif  (arredondada para baixo)', `${fmt(Wd)}/${w.Fl} − ${fmt(Aif)} = ${fmt(Wd / w.Fl - Aif)}`, w.Lf, 'mm', it('2.41'), `Passos de ${fmt(st)} mm.`);
    if (byR) step('condutor', 'Altura do fio (Af)', 'Af = [S/(Fa·Fl) + 4·Fc]/Lf  (arredondada para cima)', `[${fmt(Sreq)}/${w.Fa * w.Fl} + 4·${fmt(Fc, 4)}]/${fmt(w.Lf)}`, w.Af, 'mm', it('2.40 e 3.3'), `Fc = r²·(1 − π/4) com r = ${fmt(r)} mm.`);
    else step('condutor', 'Altura do fio (Af)', 'Af = H_disp/Fa − Aif  (arredondada para baixo)', `${fmt(Hd)}/${w.Fa} − ${fmt(Aif)}`, w.Af, 'mm', it('2.40'));
    step('condutor', 'Relação altura/largura', 'Af/Lf  (0,18 a 0,75)', `${fmt(w.Af)}/${fmt(w.Lf)}`, w.ratio, '', it('3.24, alertas 11 e 12'));

    /* 3.3 a 3.6 -------------------------------------------------------------------- */
    step('ranhura', 'Fator de curvatura', 'Fc = r² − π·r²/4', `${fmt(r)}² − π·${fmt(r)}²/4`, Fc, 'mm²', it('3.3'), 'Área do quadrado menos a do quarto de círculo em cada aresta.');
    step('ranhura', 'Secção da espira', 'S = (Af·Lf − 4·Fc)·Fa·Fl', `(${fmt(w.Af)}·${fmt(w.Lf)} − 4·${fmt(Fc, 4)})·${w.Fa}·${w.Fl}`, geo.Se, 'mm²', it('3.3'));
    step('ranhura', 'Densidade de corrente', 'J = I_e/S', `${fmt(Ie)}/${fmt(geo.Se)}`, Ie / geo.Se, 'A/mm²', it('6.19'));
    step('ranhura', 'Largura da bobina', 'Lb = (Lf + Aif)·Fl + Aie + Aim + Aa + Afc', `(${fmt(w.Lf)} + ${fmt(Aif)})·${w.Fl} + ${fmt(Aie)} + ${fmt(Aim)} + ${fmt(Aa)} + ${fmt(Afc)}`, geo.Lb, 'mm', it('3.4'),
      highV ? 'Tensão acima de 4,16 kV: acabamento nulo na ranhura.' : 'Até 4,16 kV: sem fita condutiva.');
    step('ranhura', 'Altura da bobina', 'Ab = (Af + Aif)·Fa·Ne + Aie + Aim + Aa + Afc', `(${fmt(w.Af)} + ${fmt(Aif)})·${w.Fa}·${Ne} + ${fmt(Aie)} + ${fmt(Aim)} + ${fmt(Aa)} + ${fmt(Afc)}`, geo.Ab, 'mm', it('3.4'));
    step('ranhura', 'Sobra na lateral da ranhura', 'W12 − Lb', `${fmt(v.w12)} − ${fmt(geo.Lb)}`, geo.sobraL, 'mm', it('3.5'));
    step('ranhura', 'Sobra na altura da ranhura', 'DS − (2·Ab + calços)', `${fmt(v.ds)} − (2·${fmt(geo.Ab)} + ${fmt(calcos)})`, geo.sobraA, 'mm', it('3.5'));
    if (geo.sobraL < 0) note('fail', 'Falta espaço na lateral da ranhura', `Faltam ${fmt(-geo.sobraL, 2)} mm (alerta 1).`);
    if (geo.sobraA < 0) note('fail', 'Falta espaço na altura da ranhura', `Faltam ${fmt(-geo.sobraA, 2)} mm (alerta 2).`);
    const { kr, xi } = w;
    step('ranhura', 'Perdas adicionais por correntes parasitas', 'k_r = φ(ξ) + (m² − 1)/3·ψ(ξ)', `ξ = ${fmt(xi, 4)}; m = 2·${Ne}·${w.Fa}`, kr, 'pu', 'Pyrhönen et al., resistências', 'Complementar ao manual: critério de escolha entre as composições. Cobre a 95 °C.');

    const Vs = v.tensao * 3.5 * Math.sqrt(2 / 3);
    step('isolacao', 'Tensão de surto do enrolamento (surge test final)', 'Vs = Vn·3,5·√(2/3)', `${fmt(v.tensao)}·3,5·√(2/3)`, Vs, 'V', it('3.6 · IEEE 522'));
    step('isolacao', 'Surge test da bobina solteira', '0,6·Vs', `0,6·${fmt(Vs)}`, 0.6 * Vs, 'V', it('3.6'));
    step('isolacao', 'Tensão de surto entre espiras', 'Vs/Ne', `${fmt(Vs)}/${Ne}`, Vs / Ne, 'V', it('3.6'), 'Define o isolamento do fio e entre espiras.');
    step('isolacao', 'Stress dielétrico da isolação para a massa', 'V_L/Aim', `${fmt(v.tensao)}/${fmt(Aim)}`, v.tensao / Aim, 'V/mm', it('6.12'), 'Razão direta entre tensão de linha e acréscimo total, como no manual.');
    const corona = highV ? { conductive: v.pacote + 2 * v.dedo + 10, grading: v.tensao <= 6900 ? 75 : v.tensao <= 11000 ? 115 : 140, overlap: v.tensao <= 6900 ? 7 : v.tensao <= 11000 ? 14 : 18 } : null;
    if (corona) {
      step('isolacao', 'Fita condutiva (por braço)', 'Cn + 2·dedo + 10', `${fmt(v.pacote)} + 2·${fmt(v.dedo)} + 10`, corona.conductive, 'mm', 'POP-MTR-08002', `Fita grading (semicondutiva) ${corona.grading} mm por curva, sobreposição ${corona.overlap} mm.`);
      if (corona.overlap > v.dedo + 5) note('warn', 'Sobreposição da fita semicondutiva', `${corona.overlap} mm passa do dedo de aperto + 5 mm: a fita invade a ranhura (alerta 8).`);
    }

    /* 3.7 a 3.11 · Violino --------------------------------------------------------- */
    step('violino', 'Parte reta', 'Pr = Cn + reta LL + reta LOL', `${fmt(v.pacote)} + ${fmt(v.retaLL)} + ${fmt(v.retaLOL)}`, geo.Pr, 'mm', it('3.7'));
    step('violino', 'Inclinação do braço', 'Âbb = [(X − 1)/Nr·360°]/2', `[(${Pb} − 1)/${Nr}·360]/2`, deg(Abb), '°', it('3.8'), `Passo 1–${Pb} (PB% ${fmt(v.pbPct)} × ${fmt(tau)} ranhuras por polo).`);
    step('violino', 'Diâmetro interno mínimo da cabeça', 'Φcmín = ⌊(0,01367·Pr + 2,6694·Af + 0,782025·Ne + 0,000595806·P)/5⌋·5', `⌊(0,01367·${fmt(geo.Pr)} + 2,6694·${fmt(w.Af)} + 0,782025·${Ne} + 0,000595806·${fmt(v.potencia)})/5⌋·5`, geo.phiMin, 'mm', it('3.10'),
      finite(v.phiC) && v.phiC > 0 ? `Adotado Φc = ${fmt(geo.phiC)} mm (informado).` : 'Adotado como diâmetro interno da cabeça.');
    if (geo.phiC < geo.phiMin) note('warn', 'Diâmetro interno da cabeça abaixo do mínimo', `Φc = ${fmt(geo.phiC)} mm < ${fmt(geo.phiMin)} mm (alerta 10).`);
    step('violino', 'Deslocamento reto lateral', 'Xr = (Φin/2 + R/2)·2·sen(Âbb/2)', `(${fmt(v.dInt / 2)} + ${fmt(R / 2)})·2·sen(${fmt(deg(Abb))}°/2)`, Xr, 'mm', it('3.9'));
    step('violino', 'Altura inicial da bobina', 'Aib = (Af + Aif)·Fa·Ne + Aie', `(${fmt(w.Af)} + ${fmt(Aif)})·${w.Fa}·${Ne} + ${fmt(Aie)}`, geo.Aib, 'mm', it('3.7'), 'Sem isolamento externo.');
    if (v.expcModo === 'cme') {
      step('violino', 'Extensão da parte curva (LL = LOL)', 'ExPc tal que Cme (3.12) = CME da FTD', `CME ${fmt(v.cme)} mm`, geo.LL.ExPc, 'mm', it('3.7 e 3.12'),
        geo.unreachable ? 'O CME da FTD é menor que o mínimo possível com esta geometria; adotada a menor extensão.' : 'Resolvido por bisseção: o Cme cresce com a extensão da parte curva.');
      if (geo.unreachable) note('warn', 'CME da FTD não alcançado', 'Mesmo com a menor parte curva o Cme calculado passa do CME da FTD. Revise parte reta, Φc ou o CME.');
    }
    for (const [lab, s, caim] of [['LL', geo.LL, v.caimLL], ['LOL', geo.LOL, v.caimLOL]]) {
      step('violino', `Ângulo superior da cabeça · ${lab}`, 'Âsc = atan[Xr/(ExPc − Aib)]', `atan[${fmt(Xr)}/(${fmt(s.ExPc)} − ${fmt(geo.Aib)})]`, deg(s.Asc), '°', it('3.9'), `Na vista superior a cota mostra 2·Âsc = ${fmt(2 * deg(s.Asc), 1)}°.`);
      step('violino', `Deslocamentos · ${lab}`, 'X = (Φin/2 + R/2)·Âbb − (Φc/2)·sen Âsc;  Y = ExPc − Aib − (Φc/2)·cos Âsc;  Z = caimento − cunha',
        `X = ${fmt(rMid)}·${fmt(Abb, 4)} − ${fmt(geo.phiC / 2)}·sen ${fmt(deg(s.Asc), 2)}°;  Y = ${fmt(s.ExPc)} − ${fmt(geo.Aib)} − ${fmt(geo.phiC / 2)}·cos ${fmt(deg(s.Asc), 2)}°;  Z = ${fmt(caim)} − ${fmt(cunha)}`,
        null, '', it('3.7'), `X = ${fmt(s.X)} · Y = ${fmt(s.Y)} · Z = ${fmt(s.Z)} mm`);
      step('violino', `Parte curva · ${lab}`, 'Pc = √(X² + Y² + Z²)', `√(${fmt(s.X)}² + ${fmt(s.Y)}² + ${fmt(s.Z)}²)`, s.Pc, 'mm', it('3.7'));
    }
    if (geo.LL.Y <= 0 || geo.LOL.Y <= 0) note('fail', 'Geometria da cabeça impossível', 'O deslocamento Y ficou negativo: aumente a extensão da parte curva ou reduza Φc.');
    if (geo.LL.Z < 0 || geo.LOL.Z < 0) note('warn', 'Caimento menor que a cunha', 'Z negativo: confira o caimento medido e a altura da cunha.');
    step('violino', 'Comprimento interno do violino', 'Cv = (Pr + Pc_LL + Pc_LOL + Φc)·1,00591', `(${fmt(geo.Pr)} + ${fmt(geo.LL.Pc)} + ${fmt(geo.LOL.Pc)} + ${fmt(geo.phiC)})·1,00591`, geo.Cv, 'mm', it('3.7'), 'Entre extremidades dos pinos. Fator empírico 1,00591.');
    const AccRaw = 16.5759 + 0.01387 * geo.Pr + 2.5133 * Pb - 0.3524 * Nr + 0.0239667 * v.dInt - 0.663689 * v.ds - 6.85733 * w.Fa - 0.094969 * geo.LOL.ExPc - 0.10531 * geo.LOL.X;
    const Acc = Math.max(10, Math.floor(AccRaw));
    step('violino', 'Ângulo frontal da cabeça', 'Âcc = 16,5759 + 0,01387·Pr + 2,5133·Pb − 0,3524·Nr + 0,0239667·Φin − 0,663689·Psc − 6,85733·Fa − 0,094969·ExPc − 0,10531·X',
      `regressão = ${fmt(AccRaw, 2)}°  →  arredondado para baixo, mínimo 10°`, Acc, '°', it('3.11'));

    /* 3.12 a 3.15 --------------------------------------------------------------------- */
    step('comprimento', 'Comprimento médio da espira', 'Cme = 2·(Cv − Φc) + 2·(Φc/2 + Ab/2)·π', `2·(${fmt(geo.Cv)} − ${fmt(geo.phiC)}) + 2·(${fmt(geo.phiC / 2)} + ${fmt(geo.Ab / 2)})·π`, geo.Cme, 'mm', it('3.12'));
    step('comprimento', 'Comprimento total das espiras', 'Cte = 2·(Cv − Φc)·Ne + Σ 2·[Φc/2 + (Af + Aif)·Fa·(i − 0,5)]·π', `2·(${fmt(geo.Cv)} − ${fmt(geo.phiC)})·${Ne} + Σ(i = 1…${Ne})`, geo.Cte, 'mm', it('3.12'),
      `Espira mais curta ${fmt(geo.turns[0], 1)} mm; mais longa ${fmt(geo.turns[Ne - 1], 1)} mm.`);
    step('resistencia', 'Resistência da bobina', 'Rb = (Cte + 2·DL)/1000/S·ρ·1000', `(${fmt(geo.Cte)} + 2·${fmt(v.distLig)})/1000/${fmt(geo.Se)}·${RHO}·1000`, geo.Rb, 'mΩ', it('3.13'), 'ρ = 0,017241 Ω·mm²/m a 25 °C.');
    step('resistencia', 'Resistência do grupo', 'Rg = Rb·q', `${fmt(geo.Rb)}·${fmt(qGrupo)}`, geo.Rg, 'mΩ', it('3.13'));
    step('resistencia', 'Anel de fase (médio)', 'Raf = [Φin/2·(2π/Nc)·(Nc − 1)/2]/1000/S·ρ·1000', `[${fmt(v.dInt / 2)}·(2π/${Nc})·(${Nc} − 1)/2]/1000/${fmt(geo.Se)}·${RHO}·1000`, geo.Raf, 'mΩ', it('3.13'));
    step('resistencia', 'Conexões dos grupos (jumpers)', 'Rcg = [(Φin/2 + R)·(2π/Np)·((Np − 1) − (Nc − 1))]/1000/S·ρ·1000', `[(${fmt(v.dInt / 2)} + ${fmt(R)})·(2π/${Np})·(${Np - 1} − ${Nc - 1})]/1000/${fmt(geo.Se)}·${RHO}·1000`, geo.Rcg, 'mΩ', it('3.13'));
    step('resistencia', 'Cabo de ligação', 'Rcl = 0,65/(1,3·S)·ρ·1000', `0,65/(1,3·${fmt(geo.Se)})·${RHO}·1000`, geo.Rcl, 'mΩ', it('3.13'), 'Comprimento 0,65 m e secção 1,3·S assumidos pelo manual.');
    step('resistencia', 'Resistência de fase', 'Rf = Rb·(Nr/3)/Nc² + Rcg/Nc² + Raf + Rcl', `${fmt(geo.Rb)}·(${Nr}/3)/${Nc}² + ${fmt(geo.Rcg)}/${Nc}² + ${fmt(geo.Raf)} + ${fmt(geo.Rcl)}`, geo.Rf, 'mΩ', it('3.13'),
      byR ? `Alvo da FTD: ${fmt(v.rFase * 1000)} mΩ; diferença pelo arredondamento do fio.` : '');
    step('resistencia', 'Resistência de linha', v.ligacao === 'Y' ? 'R_L = 2·Rf (Y)' : 'R_L = (2/3)·Rf (Δ)', v.ligacao === 'Y' ? `2·${fmt(geo.Rf)}` : `(2/3)·${fmt(geo.Rf)}`, geo.RL, 'mΩ', it('3.13'));
    const Pj = 3 * If ** 2 * geo.Rf / 1000 / 1000;
    step('resistencia', 'Perdas Joule DC no estator', 'P = 3·I_F²·Rf', `3·${fmt(If)}²·${fmt(geo.Rf / 1000, 5)}`, Pj, 'kW', it('3.14'), 'Sem efeito pelicular, a 25 °C.');

    const Mcb = (geo.Cte + 2 * v.distLig) * geo.Se / 1000 * DCU / 1000;
    step('cobre', 'Massa de cobre da bobina', 'Mcb = (Cte + 2·DL)·S/1000·8,89/1000', `(${fmt(geo.Cte)} + 2·${fmt(v.distLig)})·${fmt(geo.Se)}/1000·8,89/1000`, Mcb, 'kg', it('3.15'));
    step('cobre', 'Cobre do enrolamento', 'Mcb·Nr', `${fmt(Mcb)}·${Nr}`, Mcb * Nr, 'kg', it('3.15'));
    // 3.17 · carretéis
    const nCond = w.Fa * w.Fl;
    const part = Mcb / nCond;
    let reel = null;
    for (let total = Nr + (v.reserva || 0); total <= Nr + (v.reserva || 0) + 3; total++) {
      let cand = null;
      for (let k = 1; part * k <= 119; k++) if (total % k === 0) cand = { coilsPerSet: k, base: part * k };
      if (cand) {
        cand.coils = total; cand.count = Math.round(Mcb * total / cand.base); cand.each = cand.base * 1.05;
        cand.length = cand.each * (1000 / DCU) / (geo.Sw / 100) / 100;
        if (!reel || cand.base > reel.base) reel = cand;
      }
      if (reel && reel.base >= 47.62) break;
    }
    if (reel) step('cobre', 'Carretéis de fio', 'Mc = (Mcb/n)·bobinas por conjunto ≤ 119 kg;  +5 %', `(${fmt(Mcb)}/${nCond})·${reel.coilsPerSet}·1,05`, reel.each, 'kg', it('3.17'),
      `${reel.count} carretéis de ${fmt(reel.length, 0)} m; ${reel.coilsPerSet} bobinas por conjunto de ${nCond}; ${reel.coils} bobinas (${reel.coils - Nr} reserva${reel.coils - Nr === 1 ? '' : 's'}).`);
    else note('warn', 'Carretéis', 'Uma bobina por condutor passa de 119 kg: divida o fornecimento.');

    const pontasNormais = Nr - (v.pontasInv || 0);
    if (pontasNormais < 0) note('warn', 'Pontas', 'Pontas invertidas passam do número de ranhuras (alerta 9).');

    return {
      input: v, notes, steps, candidates: comp.list, okCount: comp.okCount,
      wire: { ...w, r, Fc, Sw: geo.Sw, n: nCond, forced, byR, Sreq },
      current: { S, IL, If, Ie, Vf, Nfase, isGen },
      slot: { Wd, Hd, calcos, cunha, Aif, Aie, Aim, Aa, Afc, highV },
      coil: { Lb: geo.Lb, Ab: geo.Ab, Lbi: geo.Lbi, Aib: geo.Aib, sobraL: geo.sobraL, sobraA: geo.sobraA, Se: geo.Se, J: Ie / geo.Se, kr },
      head: { Pb, span, tau, Abb, Xr, Pr: geo.Pr, phiC: geo.phiC, phiMin: geo.phiMin, LL: geo.LL, LOL: geo.LOL, Cv: geo.Cv, Acc, fitted: geo.fitted, rMid },
      lengths: { Cme: geo.Cme, Cte: geo.Cte, turns: geo.turns },
      res: { Rb: geo.Rb, Rg: geo.Rg, Raf: geo.Raf, Rcg: geo.Rcg, Rcl: geo.Rcl, Rf: geo.Rf, RL: geo.RL, Pj, q: qGrupo },
      ins: { Vs, Vsb: 0.6 * Vs, Vse: Vs / Ne, stress: v.tensao / Aim, corona },
      copper: { Mcb, Mtot: Mcb * Nr, reel, nCond },
      pontas: { normais: Math.max(0, pontasNormais), invertidas: v.pontasInv || 0 }
    };
  }

  return { calculate, FIELDS, FIELD, GROUPS, EXAMPLE, EMPTY, InputError, cornerRadius, MANUAL };
});
