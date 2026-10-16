/* Laboratório de eixos · triagem do eixo de máquinas elétricas (porte e extensão do calcular.py).
   Só cálculo, sem DOM. Sequência: potência → torque → cargas → reações → esforços → tensões por trecho
   → coeficientes de segurança e Ø mínimo → flecha e inclinação → críticas (MEF) → balanceamento
   → chavetas, ajustes e mancais → verificações. Unidades: mm, N, N·mm (momento), N·m (torque), MPa.
   No navegador: window.VGShaft. No Node: require('./shaft-engine.js') (carrega shaft-fem.js ao lado). */
(function (root, factory) {
  const fem = (typeof module === 'object' && module.exports) ? require('./shaft-fem.js') : root && root.VGShaftFEM;
  const api = factory(fem);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VGShaft = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (FEM) {
  'use strict';
  const G0 = 9.80665, NU = 0.3, SQ3 = Math.sqrt(3), PI = Math.PI;

  /* ---- Tabelas de apoio ------------------------------------------------------------------------ */
  // mesmos materiais do laboratório 01 (procedimento interno): ruptura e escoamento em MPa
  const MATERIALS = [
    { id: 'AISI 1045', su: 630, sy: 370 }, { id: 'AISI 1524', su: 510, sy: 283 }, { id: 'AISI 8620', su: 530, sy: 385 },
    { id: 'AISI 4140', su: 655, sy: 420 }, { id: 'AISI 4340', su: 810, sy: 745 }
  ];
  // Marin (Shigley, tab. 6-2): ka = a·Su^b
  const FINISH = { retificado: [1.58, -0.085, 'Retificado'], usinado: [4.51, -0.265, 'Usinado / trefilado'], laminado: [57.7, -0.718, 'Laminado a quente'], forjado: [272, -0.995, 'Forjado bruto'] };
  const RELIAB = { '50': 1.0, '90': 0.897, '95': 0.868, '99': 0.814, '99.9': 0.753 };
  const CRITERIA = { goodman: 'Goodman modificado', gerber: 'Gerber', asme: 'ASME elíptico', soderberg: 'Soderberg' };

  /* ---- Formulário --------------------------------------------------------------------------------- */
  const GROUPS = [
    { id: 'ident', title: 'Identificação', sub: 'Carimbo, relatório e pendências · opcional', closed: true },
    { id: 'maquina', title: 'Potência e rotação', sub: 'Dados da FTD → potência no eixo e torque' },
    { id: 'perfil', title: 'Perfil do eixo', sub: 'Trechos, chavetas e ajustes · tabela editável', custom: 'profile' },
    { id: 'cargas', title: 'Mancais e cargas', sub: 'Apoios, massa do rotor, forças e caminho do torque' },
    { id: 'material', title: 'Material e critérios', sub: 'Resistência, fadiga e coeficientes mínimos' },
    { id: 'mef', title: 'Método e malha', sub: 'Elementos finitos: teoria, nº de elementos e convergência' },
    { id: 'dinamica', title: 'Rotodinâmica e limites', sub: 'Rigidez, entreferro, margens e balanceamento', premise: true },
    { id: 'interfaces', title: 'Chavetas e ajustes', sub: 'Atrito, interferência e materiais', premise: true }
  ];
  const NOTES_EXAMPLE = [
    'Furos sem resistência local: 24×M14×2×45; 2×Ø38 a 50°; 4×M12×1,75×45; 4×M10×1,5×30; 6×M24×3×40.',
  ].join('\n');
  const FIELDS = [
    { key: 'cliente', group: 'ident', label: 'Cliente', type: 'text', def: '' },
    { key: 'os', group: 'ident', label: 'O.S.', type: 'text', def: '' },
    { key: 'equipamento', group: 'ident', label: 'Equipamento', type: 'text', def: 'Gerador síncrono 8.000 kW · 1.800 rpm', span: true, placeholder: 'Ex.: gerador 8.000 kW, 1.800 rpm' },
    { key: 'elaborado', group: 'ident', label: 'Elaborado por', type: 'text', def: '', span: true },
    { key: 'notas', group: 'ident', label: 'Pendências e notas (uma por linha)', type: 'textarea', def: NOTES_EXAMPLE, span: true, help: 'Vão para o relatório e para a folha A3.' },

    { key: 'machine', group: 'maquina', label: 'Máquina', type: 'select', def: 'gerador', span: true,
      options: [['gerador', 'Gerador · a potência entra pelo eixo'], ['motor', 'Motor · a potência sai pelo eixo']] },
    { key: 'pElec', group: 'maquina', label: 'Potência elétrica', sym: 'Pel', unit: 'kW', type: 'num', def: 8000, req: true, gt: 0 },
    { key: 'speed', group: 'maquina', label: 'Rotação nominal', sym: 'n', unit: 'rpm', type: 'num', def: 1800, req: true, gt: 0, max: 100000 },
    { key: 'lossMech', group: 'maquina', label: 'Perdas mecânicas', sym: 'Pmec', unit: 'kW', type: 'num', def: 74, min: 0, help: 'Atrito e ventilação.' },
    { key: 'lossElec', group: 'maquina', label: 'Perdas elétricas', sym: 'Pperd', unit: 'kW', type: 'num', def: 108.51, min: 0, help: 'Cobre, ferro e adicionais.' },
    { key: 'powerBase', group: 'maquina', label: 'Potência no eixo por', type: 'select', def: 'perdas', span: true,
      options: [['perdas', 'Potência elétrica ± perdas (como o script)'], ['rend', 'Potência elétrica e rendimento η']] },
    { key: 'eff', group: 'maquina', label: 'Rendimento', sym: 'η', unit: '', type: 'num', def: 0.98, gt: 0.3, max: 1 },
    { key: 'peak', group: 'maquina', label: 'Fator de torque de pico', sym: 'kpico', unit: '×', type: 'num', def: 2.0, min: 1, max: 30, help: 'Gerador: curto súbito pode dar 5–8 pu.' },
    { key: 'rdP', group: 'maquina', type: 'calc', label: 'Potência no eixo', sym: 'Peixo' },
    { key: 'rdT', group: 'maquina', type: 'calc', label: 'Torque nominal · pico', sym: 'T' },

    { key: 'xA', group: 'cargas', label: 'Mancal A (centro)', sym: 'xA', unit: 'mm', type: 'num', def: 773.225, req: true, min: 0 },
    { key: 'xB', group: 'cargas', label: 'Mancal B (centro)', sym: 'xB', unit: 'mm', type: 'num', def: 3323.99, req: true, min: 0 },
    { key: 'rotorMass', group: 'cargas', label: 'Massa do rotor além do eixo', sym: 'mrot', unit: 'kg', type: 'num', def: 5000, min: 0, span: true, help: 'Pacote, bobinas, cubo; distribuída de x0 a x1.' },
    { key: 'rotorFrom', group: 'cargas', label: 'Rotor de', sym: 'x0', unit: 'mm', type: 'num', def: 1368.2, min: 0 },
    { key: 'rotorTo', group: 'cargas', label: 'Rotor até', sym: 'x1', unit: 'mm', type: 'num', def: 2625.5, min: 0 },
    { key: 'ump', group: 'cargas', label: 'Força magnética (FTD)', sym: 'Fmag', unit: 'kgf', type: 'num', def: 1924.81, min: 0, help: 'Para baixo: pior caso.' },
    { key: 'xUmp', group: 'cargas', label: 'Posição da força', sym: 'xmag', unit: 'mm', type: 'num', def: 1996.85, min: 0 },
    { key: 'coupleF', group: 'cargas', label: 'Força no acoplamento', sym: 'Facop', unit: 'kN', type: 'num', def: 0, min: -10000, max: 10000, help: 'Vertical; + para cima.' },
    { key: 'axialF', group: 'cargas', label: 'Força axial', sym: 'Fax', unit: 'kN', type: 'num', def: 0, min: -10000, max: 10000 },
    { key: 'coupleEnd', group: 'cargas', label: 'Acoplamento', type: 'select', def: 'right', span: true,
      options: [['right', 'Ponta direita (fim do último trecho)'], ['left', 'Ponta esquerda (x = 0)']] },
    { key: 'torqueMode', group: 'cargas', label: 'Torque ao longo do eixo', type: 'select', def: 'linear', span: true,
      options: [['integral', 'Integral em todos os trechos'], ['linear', 'Do acoplamento ao pacote, caindo ao longo do rotor']] },
    { key: 'auxTorque', group: 'cargas', label: 'Torque além do pacote', sym: 'Taux', unit: '%', type: 'num', def: 1, min: 0, max: 100, span: true, help: 'Excitatriz, ventilador. Só no caminho pelo pacote.' },
    { key: 'rdR', group: 'cargas', type: 'calc', label: 'Reações nos mancais', sym: 'RA · RB' },

    { key: 'material', group: 'material', label: 'Material', type: 'select', def: 'AISI 1045', span: true,
      options: MATERIALS.map(m => [m.id, `${m.id} · Su ${m.su} / Sy ${m.sy} MPa`]).concat([['custom', 'Personalizado']]) },
    { key: 'su', group: 'material', label: 'Limite de ruptura', sym: 'Su', unit: 'MPa', type: 'num', def: 630, req: true, gt: 0, max: 3000 },
    { key: 'sy', group: 'material', label: 'Limite de escoamento', sym: 'Sy', unit: 'MPa', type: 'num', def: 370, req: true, gt: 0, max: 3000 },
    { key: 'seMode', group: 'material', label: 'Limite de fadiga', type: 'select', def: 'fixo', span: true,
      options: [['fixo', 'Se informado, já corrigido'], ['marin', 'Se por trecho · fatores de Marin']] },
    { key: 'se', group: 'material', label: 'Limite de fadiga corrigido', sym: 'Se', unit: 'MPa', type: 'num', def: 150, gt: 0, max: 2000 },
    { key: 'finish', group: 'material', label: 'Acabamento', type: 'select', def: 'usinado', options: Object.entries(FINISH).map(([k, v]) => [k, v[2]]) },
    { key: 'reliab', group: 'material', label: 'Confiabilidade', type: 'select', def: '90', options: Object.keys(RELIAB).map(k => [k, k.replace('.', ',') + ' %']) },
    { key: 'fatigue', group: 'material', label: 'Critério de fadiga', type: 'select', def: 'goodman', options: Object.entries(CRITERIA).map(([k, v]) => [k, v + (k === 'goodman' ? ' (script)' : '')]) },
    { key: 'sfY', group: 'material', label: 'SF mínimo · escoamento', sym: 'SFesc', unit: '', type: 'num', def: 1.5, min: 1, max: 10 },
    { key: 'sfF', group: 'material', label: 'SF mínimo · fadiga', sym: 'SFfad', unit: '', type: 'num', def: 2.0, min: 1, max: 10 },
    { key: 'E', group: 'material', label: 'Módulo de elasticidade', sym: 'E', unit: 'MPa', type: 'num', def: 210000, gt: 1000, max: 1e6 },
    { key: 'rho', group: 'material', label: 'Densidade', sym: 'ρ', unit: 'kg/m³', type: 'num', def: 7850, gt: 100, max: 30000 },

    { key: 'method', group: 'mef', label: 'Método da estática', type: 'select', def: 'mef', span: true,
      options: [['mef', 'Elementos finitos de viga (MEF)'], ['analitico', 'Analítico: superposição e dupla integração']] },
    { key: 'beam', group: 'mef', label: 'Teoria de viga', type: 'select', def: 'timoshenko', options: [['timoshenko', 'Timoshenko'], ['euler', 'Euler–Bernoulli']], help: 'Timoshenko soma o cisalhamento.' },
    { key: 'mesh', group: 'mef', label: 'Malha', type: 'select', def: 'conforme', options: [['conforme', 'Conforme'], ['uniforme', 'Uniforme']], help: 'Conforme: nó em toda mudança.' },
    { key: 'nElem', group: 'mef', label: 'Número de elementos', sym: 'Ne', unit: 'el.', type: 'int', def: 100, min: 4, max: 2000, help: 'Alvo de 4 a 2.000; a malha ajusta aos nós obrigatórios.' },
    { key: 'convTol', group: 'mef', label: 'Tolerância de convergência', sym: 'tol', unit: '%', type: 'num', def: 0.1, gt: 0, max: 10, help: 'Variação aceita ao dobrar a malha.' },
    { key: 'meshEdit', group: 'mef', type: 'button', label: 'Refinos locais e nós da malha' },
    { key: 'rdMesh', group: 'mef', type: 'calc', label: 'Malha gerada', sym: 'MEF' },

    { key: 'kBearing', group: 'dinamica', label: 'Rigidez radial dos mancais', sym: 'k', unit: 'kN/mm', type: 'num', def: null, opt: true, gt: 0, max: 1e7, help: 'Vazio = apoios rígidos.' },
    { key: 'gap', group: 'dinamica', label: 'Entreferro radial', sym: 'g', unit: 'mm', type: 'num', def: null, opt: true, gt: 0, max: 200, help: 'Opcional: flecha no pacote e rigidez magnética.' },
    { key: 'umpEcc', group: 'dinamica', label: 'Excentricidade da Fmag', sym: 'e/g', unit: '%', type: 'num', def: 10, gt: 0, max: 100, help: 'A que a força da FTD se refere.' },
    { key: 'margin', group: 'dinamica', label: 'Margem para as críticas', sym: 'SM', unit: '%', type: 'num', def: 20, min: 0, max: 100, help: 'Separação mínima da rotação.' },
    { key: 'overspeed', group: 'dinamica', label: 'Sobrevelocidade', sym: 'kov', unit: '×', type: 'num', def: 1.2, min: 1, max: 3, help: 'IEC 60034-1: 1,2 × em geral.' },
    { key: 'slopeMax', group: 'dinamica', label: 'Inclinação admissível', sym: 'θadm', unit: 'mrad', type: 'num', def: 0.5, gt: 0, max: 50, help: 'Rolos 0,8–1,2 · esferas 1–3 (Shigley).' },
    { key: 'grade', group: 'dinamica', label: 'Qualidade de balanceamento', type: 'select', def: '2.5', options: [['1', 'G 1'], ['2.5', 'G 2,5 · máquinas > 950 rpm'], ['6.3', 'G 6,3 · máquinas ≤ 950 rpm']] },
    { key: 'drawingMass', group: 'dinamica', label: 'Massa do eixo no desenho', sym: 'mdes', unit: 'kg', type: 'num', def: 2700, opt: true, gt: 0, max: 1e6, help: 'Opcional: confere a geometria.' },

    { key: 'mu', group: 'interfaces', label: 'Atrito no ajuste', sym: 'μ', unit: '', type: 'num', def: 0.15, gt: 0, max: 1 },
    { key: 'interf', group: 'interfaces', label: 'Interferência diametral', sym: 'δ', unit: 'mm', type: 'num', def: 0.30, min: 0, max: 10 },
    { key: 'interfTol', group: 'interfaces', label: 'Tolerância da interferência', sym: '±', unit: 'mm', type: 'num', def: 0.02, min: 0, max: 5 },
    { key: 'smooth', group: 'interfaces', label: 'Perda por alisamento', sym: 'ΔU', unit: 'mm', type: 'num', def: 0.01, min: 0, max: 1, help: '≈ 0,8·(Rz eixo + Rz cubo).' },
    { key: 'keySy', group: 'interfaces', label: 'Escoamento da chaveta', sym: 'Sy,ch', unit: 'MPa', type: 'num', def: 370, gt: 0, max: 3000 },
    { key: 'hubSy', group: 'interfaces', label: 'Escoamento do cubo', sym: 'Sy,cubo', unit: 'MPa', type: 'num', def: 370, gt: 0, max: 3000 }
  ];
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const INPUTS = FIELDS.filter(f => f.type !== 'calc' && f.type !== 'button');

  /* ---- Tabelas editáveis -------------------------------------------------------------------------- */
  const SECTION_COLS = [
    { key: 'name', label: 'Trecho', type: 'text', w: 'name' },
    { key: 'end', label: 'Fim x', unit: 'mm', req: true },
    { key: 'd', label: 'Ø ext.', unit: 'mm', req: true },
    { key: 'di', label: 'Ø int.', unit: 'mm', opt: true },
    { key: 'flats', label: 'Planos', unit: 'mm', opt: true, help: 'Distância entre 4 faces planas' },
    { key: 'kt', label: 'Kt', req: true },
    { key: 'kf', label: 'Kf', req: true },
    { key: 'tpct', label: 'T', unit: '%', opt: true, help: 'Fração do torque; vazio = automático' }
  ];
  const KEY_COLS = [
    { key: 'name', label: 'Chaveta', type: 'text', w: 'name' },
    { key: 'd', label: 'Ø eixo', unit: 'mm', req: true },
    { key: 'b', label: 'Largura', unit: 'mm', req: true },
    { key: 't', label: 'Prof. eixo', unit: 'mm', req: true },
    { key: 'h', label: 'Altura', unit: 'mm', opt: true, help: 'Para a pressão no cubo' },
    { key: 'L', label: 'Compr. útil', unit: 'mm', req: true },
    { key: 'share', label: 'Torque', unit: '%', req: true }
  ];
  const FIT_COLS = [
    { key: 'name', label: 'Assento', type: 'text', w: 'name' },
    { key: 'd', label: 'Ø', unit: 'mm', req: true },
    { key: 'L', label: 'Comprimento', unit: 'mm', req: true },
    { key: 'hub', label: 'Ø ext. cubo', unit: 'mm', opt: true, help: 'Para a pressão gerada (Lamé)' },
    { key: 'share', label: 'Torque', unit: '%', req: true }
  ];
  const REFINE_COLS = [
    { key: 'name', label: 'Região', type: 'text', w: 'name' },
    { key: 'a', label: 'De x', unit: 'mm', req: true },
    { key: 'b', label: 'Até x', unit: 'mm', req: true },
    { key: 'h', label: 'h máx.', unit: 'mm', req: true, help: 'Comprimento máximo dos elementos na região (mínimo 1 mm)' }
  ];
  const NODE_COLS = [
    { key: 'name', label: 'Nó', type: 'text', w: 'name' },
    { key: 'x', label: 'Posição x', unit: 'mm', req: true, help: 'Nó obrigatório nesta posição; resultados aparecem na tabela de nós' }
  ];
  const MESH_SNAP = 1;            // mm: nó pedido a menos disso de um nó obrigatório junta-se a ele
  const MAX_ELEMS = 3000;
  const S = (name, end, d, kt, kf, o = {}) => ({ name, end, d, di: o.di ?? null, flats: o.flats ?? null, kt, kf, tpct: o.tpct ?? null });
  const EXAMPLE_SECTIONS = [
    S('S01 ponta A', 102.00, 179.98, 2.8, 2.0), S('S02 ponta reduzida', 218.00, 178.000, 2.0, 1.5),
    S('S03 rasgo B-B', 320.00, 179.960, 3.0, 2.2), S('S04 assento 220', 491.00, 220.000, 2.0, 1.5),
    S('S05 pré-mancal A', 653.10, 279.860, 1.8, 1.4), S('S06 flange A entrada', 666.80, 345.000, 2.0, 1.5),
    S('S07 pista mancal A', 879.65, 279.677, 1.8, 1.4), S('S08 flange A saída', 893.35, 345.000, 2.0, 1.5),
    S('S09 pós-mancal A', 1215.80, 279.860, 1.8, 1.4), S('S10 ressalto A', 1295.20, 374.650, 2.0, 1.5),
    S('S11 rasgo C-C A', 1368.20, 377.876, 3.0, 2.2), S('S12 W1 quatro planos', 1542.40, 394.000, 3.5, 2.5, { flats: 336.6 }),
    S('S13 W1 furos inclinados', 1866.70, 394.000, 3.0, 2.2), S('S14 W2', 2139.80, 395.000, 1.8, 1.4),
    S('S15 W3', 2416.00, 397.000, 1.8, 1.4), S('S16 ressalto 406', 2638.20, 406.400, 2.0, 1.5),
    S('S17 rasgo C-C B', 2711.20, 377.876, 3.0, 2.2), S('S18 ressalto B', 2790.30, 374.650, 2.0, 1.5),
    S('S19 pré-mancal B', 3203.90, 279.860, 1.8, 1.4), S('S20 flange B entrada', 3217.60, 345.000, 2.0, 1.5),
    S('S21 pista mancal B', 3430.38, 279.677, 1.8, 1.4), S('S22 flange B saída', 3444.08, 345.000, 2.0, 1.5),
    S('S23 pós-mancal B', 3584.00, 279.860, 1.8, 1.4), S('S24 ponta X / rasgo', 4054.00, 280.772, 4.0, 3.0)
  ];
  const EXAMPLE_KEYS = [
    { name: 'EXCITATRIZ', d: 179.960, b: 19.97, t: 7.61, h: null, L: 92, share: 10 },
    { name: 'VENTILADOR (cada)', d: 377.876, b: 25.32, t: 13.676, h: null, L: 73, share: 20 },
    { name: 'G-G', d: 394.000, b: 25.32, t: 13.00, h: null, L: 150, share: 20 },
    { name: 'ACOPLAMENTO', d: 280.772, b: 62.94, t: 20.87, h: null, L: 400, share: 20 }
  ];
  const EXAMPLE_FITS = [
    { name: 'W1', d: 394.0, L: 498.5, hub: null, share: 20 },
    { name: 'W2', d: 395.0, L: 273.1, hub: null, share: 20 },
    { name: 'W3', d: 397.0, L: 276.2, hub: null, share: 20 }
  ];
  const clone = x => JSON.parse(JSON.stringify(x));
  const EXAMPLE = Object.assign(Object.fromEntries(INPUTS.map(f => [f.key, f.def])), { sections: clone(EXAMPLE_SECTIONS), keys: clone(EXAMPLE_KEYS), fits: clone(EXAMPLE_FITS), meshRefine: [], meshNodes: [] });

  class InputError extends Error {
    constructor(errors, fields) { super(errors.join(' ')); this.name = 'InputError'; this.errors = errors; this.fields = fields; }
  }

  /* ---- Formatação (pt-BR) ------------------------------------------------------------------------ */
  const isNum = Number.isFinite;
  const nfc = new Map();
  const nf = d => { if (!nfc.has(d)) nfc.set(d, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })); return nfc.get(d); };
  const fx = (v, d = 2) => isNum(v) ? nf(d).format(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v) : (v === Infinity ? '∞' : '—');
  const f0 = v => fx(v, 0);
  const fsf = v => v === Infinity || v > 999 ? '> 999' : fx(v, 2);
  const code = name => String(name || '').trim().split(/\s+/)[0] || '—';
  const sig = v => fx(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 2 : 3);     // ~3 algarismos

  /* ---- Propriedades da seção (idênticas ao script) ---------------------------------------------- */
  function props(d, di = 0, flats = null) {
    let area = PI * (d * d - di * di) / 4, I = PI * (d ** 4 - di ** 4) / 64;
    if (flats === null || flats === undefined || flats >= d) return { A: area, I, J: 2 * I, rt: d / 2, flat: false };
    // quatro faces planas: área e I exatos; torção pelo círculo inscrito (aproximação do script)
    const r = d / 2, a = flats / 2, t = Math.acos(a / r);
    area -= 4 * (r * r * t - a * Math.sqrt(r * r - a * a));
    const ix = r ** 4 * (t / 4 - Math.sin(2 * t) / 6 + Math.sin(4 * t) / 48);
    const iy = r ** 4 * (t - Math.sin(4 * t) / 4) / 4;
    I -= 2 * (ix + iy);
    return { A: area, I, J: PI * (flats ** 4 - di ** 4) / 32, rt: flats / 2, flat: true, t, ix, iy };
  }

  /* ---- Validação ------------------------------------------------------------------------------------ */
  const optNum = v => v === null || v === undefined || v === '' ? null : v;
  function validate(values) {
    const v0 = values || {}, d = {}, fields = {}, errors = [];
    for (const f of INPUTS) {
      let v = v0[f.key];
      if (f.type === 'select') { d[f.key] = f.options.some(o => o[0] === v) ? v : f.def; continue; }
      if (f.type === 'text' || f.type === 'textarea') { d[f.key] = String(v ?? '').slice(0, f.type === 'text' ? 80 : 2000); continue; }
      if (v === null || v === undefined || v === '') {
        if (f.req) { fields[f.key] = 'informe o valor'; continue; }
        if (f.opt || f.def === null) { d[f.key] = null; continue; }
        v = f.def;
      }
      if (typeof v !== 'number' || !isNum(v)) { fields[f.key] = 'número inválido'; continue; }
      if (f.type === 'int' && !Number.isInteger(v)) { fields[f.key] = 'use um número inteiro'; continue; }
      if (f.gt !== undefined && !(v > f.gt)) { fields[f.key] = `precisa ser maior que ${fx(f.gt, f.gt % 1 ? 1 : 0)}`; continue; }
      if (f.min !== undefined && v < f.min) { fields[f.key] = `mínimo ${fx(f.min, f.min % 1 ? 1 : 0)} ${f.unit || ''}`.trim(); continue; }
      if (f.max !== undefined && v > f.max) { fields[f.key] = `máximo ${fx(f.max, f.max % 1 ? 1 : 0)} ${f.unit || ''}`.trim(); continue; }
      d[f.key] = v;
    }
    // trechos
    const rows = Array.isArray(v0.sections) ? v0.sections : [];
    if (!rows.length) errors.push('O perfil do eixo precisa de pelo menos um trecho.');
    if (rows.length > 80) errors.push('Use no máximo 80 trechos.');
    const secs = [];
    let start = 0;
    rows.slice(0, 80).forEach((row, i) => {
      const bad = (k, m) => { fields[`sec:${i}:${k}`] = m; };
      const num = (k, req) => { const x = optNum(row[k]); if (x === null) { if (req) bad(k, 'informe o valor'); return null; } if (!isNum(x)) { bad(k, 'número inválido'); return null; } return x; };
      const name = String(row.name ?? '').trim().slice(0, 60) || `S${String(i + 1).padStart(2, '0')}`;
      const end = num('end', true), dd = num('d', true), kt = num('kt', true), kf = num('kf', true);
      let di = num('di', false), flats = num('flats', false), tpct = num('tpct', false);
      if (end !== null && !(end > start + 1e-9)) bad('end', i ? `precisa passar de ${fx(start, 1)} mm (fim do anterior)` : 'precisa ser maior que zero');
      if (dd !== null && !(dd > 0)) bad('d', 'precisa ser maior que zero');
      if (di !== null && dd !== null && (di < 0 || di >= dd)) bad('di', 'entre 0 e o Ø externo');
      if (flats !== null && dd !== null && (flats <= (di || 0) || flats > dd)) bad('flats', 'maior que o furo e até o Ø externo');
      if (kt !== null && kt < 1) bad('kt', 'Kt ≥ 1');
      if (kf !== null && kf < 1) bad('kf', 'Kf ≥ 1');
      if (tpct !== null && (tpct < 0 || tpct > 300)) bad('tpct', 'entre 0 e 300 %');
      if (end !== null && dd !== null && kt !== null && kf !== null && !Object.keys(fields).some(k => k.startsWith(`sec:${i}:`)))
        secs.push({ i, name, code: code(name), a: start, b: end, len: end - start, d: dd, di: di || 0, flats: flats !== null && flats < dd ? flats : null, kt, kf, tpct });
      if (end !== null && end > start) start = end;
    });
    const L = secs.length ? secs[secs.length - 1].b : 0;
    const keys = [], fits = [];
    (Array.isArray(v0.keys) ? v0.keys : []).slice(0, 30).forEach((row, i) => {
      const bad = (k, m) => { fields[`key:${i}:${k}`] = m; };
      const g = (k, req) => { const x = optNum(row[k]); if (x === null) { if (req) bad(k, 'informe'); return null; } if (!isNum(x) || x < 0) { bad(k, 'inválido'); return null; } return x; };
      const k = { i, name: String(row.name ?? '').trim().slice(0, 40) || `Chaveta ${i + 1}`, d: g('d', true), b: g('b', true), t: g('t', true), h: g('h', false), L: g('L', true), share: g('share', true) };
      if (k.d !== null && !(k.d > 0)) bad('d', '> 0');
      if (k.b !== null && !(k.b > 0)) bad('b', '> 0');
      if (k.L !== null && !(k.L > 0)) bad('L', '> 0');
      if (k.t !== null && k.d !== null && !(k.t > 0 && k.t < k.d / 2)) bad('t', 'entre 0 e o raio');
      if (k.h !== null && k.t !== null && !(k.h > k.t)) bad('h', 'maior que a profundidade');
      if (k.share !== null && k.share > 100) bad('share', 'até 100 %');
      if (!Object.keys(fields).some(x => x.startsWith(`key:${i}:`))) keys.push(k);
    });
    (Array.isArray(v0.fits) ? v0.fits : []).slice(0, 30).forEach((row, i) => {
      const bad = (k, m) => { fields[`fit:${i}:${k}`] = m; };
      const g = (k, req) => { const x = optNum(row[k]); if (x === null) { if (req) bad(k, 'informe'); return null; } if (!isNum(x) || x < 0) { bad(k, 'inválido'); return null; } return x; };
      const f = { i, name: String(row.name ?? '').trim().slice(0, 40) || `Ajuste ${i + 1}`, d: g('d', true), L: g('L', true), hub: g('hub', false), share: g('share', true) };
      if (f.d !== null && !(f.d > 0)) bad('d', '> 0');
      if (f.L !== null && !(f.L > 0)) bad('L', '> 0');
      if (f.hub !== null && f.d !== null && !(f.hub > f.d * 1.02)) bad('hub', 'maior que o Ø do assento');
      if (f.share !== null && f.share > 100) bad('share', 'até 100 %');
      if (!Object.keys(fields).some(x => x.startsWith(`fit:${i}:`))) fits.push(f);
    });
    // malha: regiões de refino e nós pedidos
    const refine = [], meshNodes = [];
    (Array.isArray(v0.meshRefine) ? v0.meshRefine : []).slice(0, 40).forEach((row, i) => {
      const bad = (k, m) => { fields[`ref:${i}:${k}`] = m; };
      const g = k => { const x = optNum(row[k]); if (x === null) { bad(k, 'informe'); return null; } if (!isNum(x)) { bad(k, 'número inválido'); return null; } return x; };
      const z = { i, name: String(row.name ?? '').trim().slice(0, 40) || `Refino ${i + 1}`, a: g('a'), b: g('b'), h: g('h') };
      if (z.a !== null && z.a < 0) bad('a', 'não pode ser negativo');
      else if (z.a !== null && L > 0 && z.a >= L) bad('a', `fora do eixo (L = ${fx(L, 1)} mm)`);
      if (z.a !== null && z.b !== null && !(z.b > z.a + 0.5)) bad('b', 'precisa passar do início');
      if (z.h !== null && z.h < 1) bad('h', 'mínimo 1 mm');
      if (!Object.keys(fields).some(x => x.startsWith(`ref:${i}:`))) refine.push(Object.assign(z, { b: L > 0 ? Math.min(z.b, L) : z.b }));
    });
    (Array.isArray(v0.meshNodes) ? v0.meshNodes : []).slice(0, 100).forEach((row, i) => {
      const x = optNum(row.x), bad = m => { fields[`nod:${i}:x`] = m; };
      if (x === null) bad('informe a posição');
      else if (!isNum(x)) bad('número inválido');
      else if (x < 0 || (L > 0 && x > L)) bad(`entre 0 e ${fx(L, 1)} mm`);
      else meshNodes.push({ i, name: String(row.name ?? '').trim().slice(0, 40) || `N${i + 1}`, x });
    });
    const ok = k => !(k in fields) && d[k] !== undefined;
    if (L > 0) {
      for (const k of ['xA', 'xB', 'rotorFrom', 'rotorTo', 'xUmp']) if (ok(k) && d[k] > L + 1e-9) fields[k] = `fora do eixo (L = ${fx(L, 1)} mm)`;
      if (ok('xA') && ok('xB') && !(d.xB > d.xA + 1)) fields.xB = 'precisa ficar à direita do mancal A';
      if (ok('rotorFrom') && ok('rotorTo') && d.rotorMass > 0 && !(d.rotorTo > d.rotorFrom)) fields.rotorTo = 'precisa ser maior que o início';
    }
    if (ok('su') && ok('sy') && d.sy > d.su) fields.sy = 'não pode passar do limite de ruptura';
    if (Object.keys(fields).length || errors.length) throw new InputError(errors, fields);
    d.secs = secs; d.L = L; d.keys = keys; d.fits = fits; d.meshRefine = refine; d.meshNodes = meshNodes;
    return d;
  }

  /* ---- Cargas, esforços e flecha ----------------------------------------------------------------- */
  function torqueFn(d, T, mode) {
    // devolve T(x) em N·m para o modo de distribuição
    if (mode !== 'linear' || !(d.rotorTo > d.rotorFrom)) return () => T;
    const x0 = d.rotorFrom, x1 = d.rotorTo, aux = T * d.auxTorque / 100;
    if (d.coupleEnd === 'left') return x => x <= x0 ? T : x >= x1 ? aux : T - (T - aux) * (x - x0) / (x1 - x0);
    return x => x >= x1 ? T : x <= x0 ? aux : aux + (T - aux) * (x - x0) / (x1 - x0);
  }
  function loadsOf(d, secs) {
    const dist = secs.map(s => ({ a: s.a, b: s.b, q: -s.A * 1e-9 * d.rho * G0, kind: 'peso', sec: s.i }));
    if (d.rotorMass > 0) dist.push({ a: d.rotorFrom, b: d.rotorTo, q: -d.rotorMass * G0 / (d.rotorTo - d.rotorFrom), kind: 'rotor' });
    const xc = d.coupleEnd === 'left' ? 0 : d.L;
    const point = [{ x: d.xUmp, F: -d.ump * G0, kind: 'mag' }, { x: xc, F: d.coupleF * 1000, kind: 'acop' }];
    return { dist, point, xc };
  }
  function reactions(d, loads) {
    let fy = 0, mm = 0;
    for (const { a, b, q } of loads.dist) { fy += q * (b - a); mm += q * (b - a) * ((a + b) / 2 - d.xA); }
    for (const { x, F } of loads.point) { fy += F; mm += F * (x - d.xA); }
    const rb = -mm / (d.xB - d.xA), ra = -fy - rb;
    return { ra, rb, fy, mm };
  }
  function makeM(d, loads, ra, rb) {
    const dist = loads.dist, point = loads.point, A = d.xA, B = d.xB;
    const M = x => {
      let m = ra * Math.max(0, x - A) + rb * Math.max(0, x - B);
      for (const p of point) m += p.F * Math.max(0, x - p.x);
      for (const { a, b, q } of dist) { const t = Math.min(Math.max(x - a, 0), b - a); m += q * t * (x - a - t / 2); }
      return m;   // N·mm
    };
    // cortante: right = true inclui forças aplicadas exatamente em x
    const V = (x, right = true) => {
      const H = xf => right ? x >= xf : x > xf;
      let v = (H(A) ? ra : 0) + (H(B) ? rb : 0);
      for (const p of point) if (H(p.x)) v += p.F;
      for (const { a, b, q } of dist) v += q * Math.min(Math.max(x - a, 0), b - a);
      return v;   // N
    };
    return { M, V };
  }
  function deflection(d, secs, loads, M) {
    // integra M/(E·I) e corrige a reta para flecha zero nos dois mancais (idêntico ao script)
    const grid = [];
    for (let k = 0; k < Math.ceil(d.L / 10); k++) grid.push(k * 10.0);
    const mesh = [...new Set(grid.concat([d.L, d.xA, d.xB], secs.map(s => s.a), secs.map(s => s.b), loads.point.map(p => p.x)))].sort((a, b) => a - b);
    let y = 0, th = 0, sec = 0;
    const raw = [0], thr = [0], kap = [];
    for (let i = 0; i < mesh.length - 1; i++) {
      const a = mesh[i], b = mesh[i + 1], xm = (a + b) / 2;
      while (xm > secs[sec].b) sec++;
      const dx = b - a, k = M(xm) / (d.E * secs[sec].I);
      y += th * dx + k * dx * dx / 2;
      th += k * dx;
      raw.push(y); thr.push(th); kap.push(k);
    }
    const ia = mesh.indexOf(d.xA), ib = mesh.indexOf(d.xB);
    const ya = raw[ia], yb = raw[ib], incl = (yb - ya) / (d.xB - d.xA);
    const ys = mesh.map((x, i) => raw[i] - ya - incl * (x - d.xA));
    const ths = thr.map(t => t - incl);
    return { mesh, y: ys, th: ths, ia, ib };
  }

  /* ---- Tensões e coeficientes por trecho -------------------------------------------------------- */
  function seOf(d, diam) {
    if (d.seMode !== 'marin') return { se: d.se };
    const [a, b] = FINISH[d.finish] || FINISH.usinado;
    const se0 = d.su <= 1400 ? 0.5 * d.su : 700;
    const ka = Math.min(1, a * Math.pow(d.su, b));
    const kb = diam <= 51 ? (diam >= 2.79 ? 1.24 * Math.pow(diam, -0.107) : 1) : Math.max(0.6, 1.51 * Math.pow(diam, -0.157));
    const ke = RELIAB[d.reliab] ?? 0.897;
    return { se: se0 * ka * kb * ke, se0, ka, kb, kc: 1, kd: 1, ke };
  }
  function fatigueN(crit, sa, sm, se, su, sy) {
    if (!(sa > 0) && !(sm > 0)) return Infinity;
    if (crit === 'soderberg') return 1 / (sa / se + sm / sy);
    if (crit === 'asme') return 1 / Math.hypot(sa / se, sm / sy);
    if (crit === 'gerber') {
      if (!(sm > 0)) return se / sa;
      if (!(sa > 0)) return su / sm;
      return 0.5 * (su / sm) ** 2 * (sa / se) * (-1 + Math.sqrt(1 + (2 * sm * se / (su * sa)) ** 2));
    }
    return 1 / (sa / se + sm / su);
  }
  function stressAt(d, diam, di, rel, m, t, kt, kf) {
    // m em N·mm, t em N·m; rel = planos/Ø (ou null)
    const p = props(diam, di, rel ? diam * rel : null);
    const sb = Math.abs(m) * diam / (2 * p.I);
    const tau = t * 1000 * p.rt / p.J;
    const sax = Math.abs(d.axialF * 1000) / p.A;
    const vm = Math.hypot(sax + kt * sb, SQ3 * kt * d.peak * tau);
    const sa = kf * sb, sm = Math.hypot(sax, SQ3 * kf * tau);
    const se = seOf(d, diam);
    const sfy = vm ? d.sy / vm : Infinity;
    const sff = fatigueN(d.fatigue, sa, sm, se.se, d.su, d.sy);
    return { p, sb, tau, sax, vm, sa, sm, se, sfy, sff };
  }
  function dMin(d, s, m, t) {
    const rel = s.flats ? s.flats / s.d : null;
    const target = x => { const z = stressAt(d, x, s.di, rel, m, t, s.kt, s.kf); return z.sfy >= d.sfY && z.sff >= d.sfF; };
    let lo = Math.max(1.0, s.di / (rel || 1) + 0.01), hi = Math.max(s.d, lo * 1.1);
    for (let k = 0; k < 80 && !target(hi); k++) hi *= 1.5;
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (target(mid)) hi = mid; else lo = mid; }
    return hi;
  }
  // M máximo de cada trecho: amostras a cada ≤ 10 mm, nas cargas e nos mancais (como o script)
  function mAtAnalytic(d, loads, M) {
    return s => {
      const n = Math.max(1, Math.ceil((s.b - s.a) / 10));
      const xs = [];
      for (let k = 0; k <= n; k++) xs.push(s.a + (s.b - s.a) * k / n);
      for (const p of loads.point) if (p.x >= s.a && p.x <= s.b) xs.push(p.x);
      for (const x of [d.xA, d.xB]) if (x >= s.a && x <= s.b) xs.push(x);
      let m = 0, xm = s.a;
      for (const x of xs) { const v = Math.abs(M(x)); if (v > m) { m = v; xm = x; } }
      return { m, xm };
    };
  }
  // pelo MEF: maior |M| entre as amostras recuperadas nos elementos que caem no trecho
  function mAtSamples(xs, Ms) {
    return s => {
      let m = 0, xm = s.a;
      for (let i = 0; i < xs.length; i++) if (xs[i] >= s.a - 1e-7 && xs[i] <= s.b + 1e-7 && Math.abs(Ms[i]) > m) { m = Math.abs(Ms[i]); xm = xs[i]; }
      return { m, xm };
    };
  }
  function checkSections(d, secs, mAt, Tfn, T) {
    return secs.map(s => {
      const { m, xm } = mAt(s);
      let tl = 0;
      if (s.tpct !== null && s.tpct !== undefined) tl = T * s.tpct / 100;
      else for (const x of [s.a, s.b, (s.a + s.b) / 2]) tl = Math.max(tl, Math.abs(Tfn(x)));
      const rel = s.flats ? s.flats / s.d : null;
      const z = stressAt(d, s.d, s.di, rel, m, tl, s.kt, s.kf);
      const dmin = dMin(d, s, m, tl);
      const ok = z.sfy >= d.sfY && z.sff >= d.sfF;
      const uy = d.sfY / z.sfy, uf = d.sfF / z.sff, util = Math.max(uy, uf);
      // fator de pico admissível (estático) com o SF mínimo
      const lim = d.sy / d.sfY, base = z.sax + s.kt * z.sb;
      const fpkAdm = z.tau > 0 ? (lim > base ? Math.sqrt(lim * lim - base * base) / (SQ3 * s.kt * z.tau) : 0) : Infinity;
      const q = s.kt > 1 ? (s.kf - 1) / (s.kt - 1) : NaN;
      return Object.assign({}, s, { A: z.p.A, I: z.p.I, J: z.p.J, rt: z.p.rt, flat: z.p.flat, m, xm, torque: tl, sb: z.sb, tau: z.tau, sax: z.sax, vm: z.vm, sa: z.sa, sm: z.sm,
        se: z.se.se, seInfo: z.se, sfy: z.sfy, sff: z.sff, dmin, ok, uy, uf, util, gov: uy >= uf ? 'esc' : 'fad', fpkAdm, q });
    });
  }

  /* ---- Elementos finitos: modelo, estática e dinâmica ------------------------------------------------ */
  const qEl = (xm, el) => -(el.rhoA + el.mAdd) * G0;                          // peso por metro (N/m) = massa do elemento × g
  // o.scale: fator sobre a malha do usuário (refinos com h/escala; o estudo de convergência refina tudo junto);
  // o.plain: sem refinos nem nós pedidos (mapa de críticas)
  function feModel(d, secs, loads, n, mesh, o = {}) {
    const kMag = d.gap && d.ump > 0 && d.rotorTo > d.rotorFrom ? d.ump * G0 / (d.gap * d.umpEcc / 100) : 0;   // N/mm
    const scale = o.scale ?? (n ? n / d.nElem : 1);
    const geo = {
      L: d.L, E: d.E, nu: NU, rho: d.rho, bearings: [d.xA, d.xB], mesh: mesh || d.mesh, n: n || d.nElem, snap: MESH_SNAP,
      nodes: o.plain ? [] : (d.meshNodes || []).map(p => p.x),
      refine: o.plain ? [] : (d.meshRefine || []).map(z => ({ a: z.a, b: z.b, h: scale > 0 ? z.h / scale : Infinity })),
      secs: secs.map(s => ({ a: s.a, b: s.b, A: s.A, I: s.I, di: s.di, d: s.d })),
      addMass: d.rotorMass > 0 ? [{ a: d.rotorFrom, b: d.rotorTo, kgPerMm: d.rotorMass / (d.rotorTo - d.rotorFrom) }] : [],
      points: loads.point.map(p => p.x), breaks: [d.xUmp, loads.xc],
      foundation: kMag ? [{ a: d.rotorFrom, b: d.rotorTo, kPerMm: -kMag / (d.rotorTo - d.rotorFrom) }] : []
    };
    const model = FEM.buildModel(geo);
    model.kMag = kMag;
    return model;
  }
  const springsOf = d => d.kBearing ? [d.kBearing * 1e6, d.kBearing * 1e6] : null;   // kN/mm → N/m
  // estatística da deformada: máximos no total, no vão, no pacote e inclinação nos mancais (x em mm, y em mm, θ em rad)
  function deflStats(d, xs, ys, ths) {
    const near = x => { let b = 0; xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[b] - x)) b = i; }); return b; };
    const ia = near(d.xA), ib = near(d.xB);
    let im = 0, isp = ia, ic = -1, it = -1;
    ys.forEach((v, i) => {
      if (Math.abs(v) > Math.abs(ys[im])) im = i;
      if (xs[i] >= d.xA && xs[i] <= d.xB && Math.abs(v) > Math.abs(ys[isp])) isp = i;
      if (d.rotorMass > 0 && xs[i] >= d.rotorFrom && xs[i] <= d.rotorTo && (ic < 0 || Math.abs(v) > Math.abs(ys[ic]))) ic = i;
      if ((xs[i] < d.xA || xs[i] > d.xB) && (it < 0 || Math.abs(v) > Math.abs(ys[it]))) it = i;
    });
    return { max: Math.abs(ys[im]), xmax: xs[im], ymax: ys[im], span: Math.abs(ys[isp]), xspan: xs[isp], yspan: ys[isp],
      core: ic >= 0 ? Math.abs(ys[ic]) : NaN, xcore: ic >= 0 ? xs[ic] : NaN, tip: it >= 0 ? Math.abs(ys[it]) : 0, xtip: it >= 0 ? xs[it] : NaN,
      left: ys[0], right: ys[ys.length - 1], thA: ths[ia], thB: ths[ib], thMax: Math.max(...ths.map(Math.abs)) };
  }
  // estática por MEF com o modelo dado: reações, M e V recuperados, deformada interpolada (nós + extremos internos)
  function feStatic(d, secs, loads, model, shear = d.beam !== 'euler') {
    const st = FEM.staticSolve(model, { q: qEl, points: loads.point.filter(p => p.F).map(p => ({ x: p.x, F: p.F })), springs: springsOf(d), shear });
    if (!st) return { ok: false };
    const dx = st.diag.x, dM = st.diag.M.map(m => m * 1000), dV = st.diag.V;                  // N·mm, N
    const px = st.plot.x, yv = st.plot.v.map(v => v * 1000);                                   // mm
    const series = {
      v: dx.map((x, i) => [x, dV[i] / 1000]), m: dx.map((x, i) => [x, dM[i] / 1e6]),
      y: px.map((x, i) => [x, yv[i]]), th: px.map((x, i) => [x, st.plot.th[i] * 1000])
    };
    const mAtX = x => { let b = 0; for (let i = 0; i < dx.length; i++) if (Math.abs(dx[i] - x) < Math.abs(dx[b] - x)) b = i; return dM[b]; };
    const Mmax = series.m.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a, [0, 0]);
    // resultados em cada nó (mm, mrad, kN·m, kN) e onde ficou cada nó pedido
    const nodes = { x: model.xs, v: st.v.map(v => v * 1000), th: st.th.map(t => t * 1000), M: Array.from(st.nodal.M, m => m / 1000), Vl: Array.from(st.nodal.Vl, v => v / 1000), Vr: Array.from(st.nodal.Vr, v => v / 1000),
      user: (d.meshNodes || []).map((p, k) => ({ name: p.name, x: p.x, idx: model.userNodes[k], at: model.xs[model.userNodes[k]] })) };
    return { ok: true, model, st, info: model.info, shear, RA: st.R[0], RB: st.R[1], residual: st.residual, series, dx, dM, dV, Mmax, nodes,
      defl: deflStats(d, px, yv, st.plot.th), mAt: mAtSamples(dx, dM), mAtX };
  }
  function dynamics(d, r, opts) {
    if (!FEM) return null;
    const model = r.fe && r.fe.model ? r.fe.model : feModel(d, d.secs, r.loads);
    const kMag = model.kMag, shear = d.beam !== 'euler';
    const out = { model, elems: model.elems.length, nodes: model.nNodes, kMag, info: model.info };
    out.rigid = FEM.criticals(model, { q: 3, foundation: false, shear });
    const springs = springsOf(d);
    if (springs) out.flex = FEM.criticals(model, { q: 3, springs, foundation: false, shear });
    if (kMag) out.mag = FEM.criticals(model, { q: 3, springs, foundation: true, shear });
    out.design = out.mag || out.flex || out.rigid;
    out.designLabel = [springs ? `mancais de ${fx(d.kBearing, 0)} kN/mm` : 'mancais rígidos', kMag ? 'com rigidez magnética negativa' : ''].filter(Boolean).join(', ');
    // Rayleigh com a deflexão estática pelo peso (mancais rígidos)
    const grav = FEM.staticSolve(model, { q: qEl, shear });
    out.rayleigh = grav ? FEM.rpmOf(grav.rayleighW2) : NaN;
    if (opts.map) out.map = FEM.criticalMap(model, { q: 3, foundation: false });
    return out;
  }

  /* ---- Cálculo principal ------------------------------------------------------------------------- */
  function calculate(values, opts = {}) {
    const d = validate(values);
    const r = { d, info: { cliente: d.cliente, os: d.os, equipamento: d.equipamento, elaborado: d.elaborado }, notes: String(d.notas || '').split(/\n+/).map(s => s.trim()).filter(Boolean) };
    // potência e torque
    const losses = d.lossMech + d.lossElec, gen = d.machine !== 'motor';
    r.Pshaft = d.powerBase === 'rend' ? (gen ? d.pElec / d.eff : d.pElec * d.eff) : (gen ? d.pElec + losses : d.pElec - losses);
    r.PshaftAlt = d.powerBase === 'rend' ? (gen ? d.pElec + losses : d.pElec - losses) : (gen ? d.pElec / d.eff : d.pElec * d.eff);
    if (!(r.Pshaft > 0)) throw new InputError(['A potência no eixo ficou nula ou negativa: confira as perdas.'], { lossElec: 'perdas maiores que a potência' });
    r.T = r.Pshaft * 60000 / (2 * PI * d.speed);              // N·m
    r.Tpk = d.peak * r.T;
    r.w = 2 * PI * d.speed / 60;
    // seções e cargas
    const secs = d.secs.map(s => Object.assign(s, props(s.d, s.di, s.flats)));
    r.loads = loadsOf(d, secs);
    r.Tfn = torqueFn(d, r.T, d.torqueMode);
    // massas
    const mShaft = secs.reduce((a, s) => a + s.len * s.A * 1e-9 * d.rho, 0);
    const mxShaft = secs.reduce((a, s) => a + s.len * s.A * 1e-9 * d.rho * (s.a + s.b) / 2, 0);
    const mRot = d.rotorMass, xRot = (d.rotorFrom + d.rotorTo) / 2;
    r.mass = { shaft: mShaft, rotor: mRot, total: mShaft + mRot, cg: (mxShaft + mRot * xRot) / (mShaft + mRot), shaftCg: mxShaft / mShaft };
    // método analítico do script: estática, superposição e dupla integração (sempre: é a referência)
    const R = reactions(d, r.loads);
    const { M, V } = makeM(d, r.loads, R.ra, R.rb);
    const df = deflection(d, secs, r.loads, M);
    const jumpsV = new Set([d.xA, d.xB, ...r.loads.point.filter(p => p.F).map(p => p.x)]);
    const vA = [];
    for (const x of df.mesh) { if (jumpsV.has(x)) { vA.push([x, V(x, false) / 1000]); vA.push([x, V(x, true) / 1000]); } else vA.push([x, V(x) / 1000]); }
    const an = {
      RA: R.ra, RB: R.rb, mAt: mAtAnalytic(d, r.loads, M), mAtX: M, mesh: df.mesh,
      series: { v: vA, m: df.mesh.map(x => [x, M(x) / 1e6]), y: df.mesh.map((x, i) => [x, df.y[i]]), th: df.mesh.map((x, i) => [x, df.th[i] * 1000]) },
      defl: deflStats(d, df.mesh, df.y, df.th)
    };
    an.Mmax = an.series.m.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a, [0, 0]);
    r.an = an;
    // elementos finitos com a malha escolhida
    if (FEM) {
      const model = feModel(d, secs, r.loads);
      if (model.info.ne > MAX_ELEMS) throw new InputError([`A malha passaria de ${fx(MAX_ELEMS, 0)} elementos (${fx(model.info.ne, 0)}): aumente o h dos refinos ou reduza o número de elementos.`], { nElem: 'malha grande demais com os refinos' });
      r.fe = feStatic(d, secs, r.loads, model);
      if (!r.fe.ok) r.fe.model = model;
      // a outra teoria de viga na mesma malha: separa o efeito do cisalhamento na comparação com o script
      else { const o = feStatic(d, secs, r.loads, model, !r.fe.shear); if (o.ok) r.fe.other = { shear: o.shear, RA: o.RA, RB: o.RB, Mmax: o.Mmax, defl: o.defl, MA: o.mAtX(d.xA), MB: o.mAtX(d.xB) }; }
    }
    const useFE = d.method === 'mef' && r.fe && r.fe.ok;
    r.method = useFE ? 'mef' : 'analitico';
    const use = useFE ? r.fe : an;
    Object.assign(r, { RA: use.RA, RB: use.RB, Fy: R.fy });
    // por trecho
    r.res = checkSections(d, secs, use.mAt, r.Tfn, r.T);
    r.fails = r.res.filter(s => !s.ok);
    r.crit = r.res.reduce((a, s) => s.util > a.util ? s : a, r.res[0]);
    r.fpkAdm = r.res.reduce((a, s) => s.fpkAdm < a.v ? { v: s.fpkAdm, s } : a, { v: Infinity, s: null });
    // modo de torque alternativo (comparação)
    const altMode = d.torqueMode === 'linear' ? 'integral' : 'linear';
    const alt = checkSections(Object.assign({}, d), secs, use.mAt, torqueFn(d, r.T, altMode), r.T);
    r.alt = { mode: altMode, fails: alt.filter(s => !s.ok).map(s => s.code), worst: alt.reduce((a, s) => s.util > a.util ? s : a, alt[0]) };
    // diagramas e deformada do método escolhido; torque é o mesmo nos dois
    const tAt = (x, s) => (s.tpct !== null && s.tpct !== undefined ? r.T * s.tpct / 100 : r.Tfn(x)) / 1000;
    const tS = [];
    let ti = 0;
    for (const x of df.mesh) {
      while (ti < secs.length - 1 && x > secs[ti].b) ti++;
      tS.push([x, tAt(x, secs[ti])]);
      if (x === secs[ti].b && secs[ti + 1]) { const nx = tAt(x, secs[ti + 1]); if (Math.abs(nx - tS[tS.length - 1][1]) > 1e-9) tS.push([x, nx]); }
    }
    r.series = Object.assign({}, use.series, { t: tS });
    r.defl = use.defl;
    // esforços máximos
    const mm = useFE ? r.fe.Mmax : an.Mmax;
    r.Mmax = { v: mm[1] * 1e6, x: mm[0], sec: r.res.find(s => mm[0] >= s.a && mm[0] <= s.b) };
    r.MA = use.mAtX(d.xA); r.MB = use.mAtX(d.xB);
    const vm = r.series.v.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a, [0, 0]);
    r.Vmax = { v: vm[1] * 1000, x: vm[0] };
    // torção (ângulo) com G = E/2(1+ν)
    const Gm = d.E / (2 * (1 + NU));
    let phi = 0, si = 0;
    for (let i = 0; i < df.mesh.length - 1; i++) {
      const a = df.mesh[i], b = df.mesh[i + 1], xm = (a + b) / 2;
      while (xm > r.res[si].b) si++;
      const s = r.res[si], t = s.tpct !== null && s.tpct !== undefined ? r.T * s.tpct / 100 : r.Tfn(xm);
      phi += t * 1000 * (b - a) / (Gm * s.J);
    }
    r.twist = phi;   // rad
    // mancais
    const secAt = x => r.res.find(s => x > s.a && x < s.b) || r.res.find(s => x >= s.a && x <= s.b);
    r.bearings = [['A', d.xA, r.RA, r.defl.thA], ['B', d.xB, r.RB, r.defl.thB]].map(([name, x, F, th]) => {
      const s = secAt(x);
      const D = s.d, B = s.len, p = Math.abs(F) / (D * B), v = PI * D * d.speed / 60000;
      return { name, x, F, s, D, B, p, v, th, edge: Math.abs(th) * B / 2, ok: Math.abs(th) * 1000 <= d.slopeMax };
    });
    // chavetas
    r.keyRes = d.keys.map(k => {
      const T = r.T * k.share / 100, F = 2 * T * 1000 / k.d, Fpk = F * d.peak;
      const tau = F / (k.b * k.L), pS = F / (k.t * k.L), pH = k.h ? F / ((k.h - k.t) * k.L) : NaN;
      const syk = Math.min(d.keySy, d.sy);
      const sfT = (d.keySy / SQ3) / (tau * d.peak), sfP = syk / (pS * d.peak), sfH = isNum(pH) ? Math.min(d.keySy, d.hubSy) / (pH * d.peak) : NaN;
      const sf = Math.min(sfT, sfP, isNum(sfH) ? sfH : Infinity);
      return Object.assign({}, k, { T, F, Fpk, tau, pS, pH, sfT, sfP, sfH, sf, ok: sf >= d.sfY });
    });
    // ajustes por interferência
    const Es = d.E, Eh = d.E;
    r.fitRes = d.fits.map(f => {
      const T = r.T * f.share / 100;
      const pReq = 2 * T / (d.mu * PI * (f.d / 1000) ** 2 * (f.L / 1000)) / 1e6;
      const o = Object.assign({}, f, { T, pReq, pReqPk: pReq * d.peak });
      if (f.hub) {
        const dd = f.d, Do = f.hub;
        const C = (1 / Eh) * ((Do * Do + dd * dd) / (Do * Do - dd * dd) + NU) + (1 / Es) * (1 - NU);
        const lossW = (n) => { const w = 2 * PI * n / 60; return (3 + NU) * d.rho * w * w * (dd / 1000) * (Do / 2000) ** 2 / (4 * Eh * 1e6) * 1000; };   // mm (diametral)
        const dMinI = d.interf - d.interfTol - d.smooth, dMaxI = d.interf + d.interfTol;
        o.lossN = lossW(d.speed); o.lossOv = lossW(d.speed * d.overspeed);
        const pAt = delta => Math.max(0, delta) / (dd * C);
        o.p0 = pAt(dMinI); o.pN = pAt(dMinI - o.lossN); o.pOv = pAt(dMinI - o.lossOv); o.pMax = pAt(dMaxI);
        const Ttr = p => d.mu * p * 1e6 * PI * (dd / 1000) ** 2 * (f.L / 1000) / 2;   // N·m
        o.TtrN = Ttr(o.pN); o.TtrOv = Ttr(o.pOv);
        o.sfN = T > 0 ? o.TtrN / T : Infinity; o.sfPk = T > 0 ? o.TtrN / (T * d.peak) : Infinity; o.sfOv = T > 0 ? o.TtrOv / T : Infinity;
        const st = o.pMax * (Do * Do + dd * dd) / (Do * Do - dd * dd);
        o.hubVm = Math.sqrt(st * st + o.pMax * o.pMax + st * o.pMax);
        o.hubSf = d.hubSy / o.hubVm;
        o.ok = o.sfN >= d.sfY && o.sfPk >= 1 && o.hubSf >= d.sfY;
      }
      return o;
    });
    // rotodinâmica
    if (!opts.lite) {
      r.dyn = dynamics(d, r, opts);
      // conferência automática da malha: a mesma análise com o dobro de elementos
      if (r.fe && r.fe.ok && r.fe.info.ne * 2 > MAX_ELEMS) r.fe.refineSkipped = true;
      else if (r.fe && r.fe.ok && r.dyn) {
        const m2 = feModel(d, secs, r.loads, 2 * d.nElem);
        const f2 = feStatic(d, secs, r.loads, m2);
        const base = r.dyn.flex || r.dyn.rigid;
        const c2 = FEM.criticals(m2, { q: 2, springs: springsOf(d), foundation: false, shear: d.beam !== 'euler' });
        const rel = (a, b) => Math.abs(a - b) / Math.max(1e-30, Math.abs(b));
        if (f2.ok) r.fe.refine = { ne2: m2.info.ne, dSpan: rel(r.fe.defl.span, f2.defl.span), dTip: rel(r.fe.defl.tip, f2.defl.tip), dTh: rel(Math.abs(r.fe.defl.thA), Math.abs(f2.defl.thA)),
          dNc1: base.ok && c2.ok ? rel(base.rpm[0], c2.rpm[0]) : NaN, dM: rel(Math.abs(r.fe.Mmax[1]), Math.abs(f2.Mmax[1])) };
      }
      // balanceamento ISO 1940-1 / 21940-11 (mancais = planos de tolerância)
      const G = Number(d.grade), m = r.mass.total, eper = G / r.w * 1000;        // µm
      const U = 1000 * G * m / r.w;                                              // g·mm
      const Ltot = d.xB - d.xA, LA = r.mass.cg - d.xA, LB = d.xB - r.mass.cg, inboard = LA > 0 && LB > 0;
      let UA = U * LB / Ltot, UB = U * LA / Ltot;
      if (inboard) { UA = Math.min(0.7 * U, Math.max(0.3 * U, UA)); UB = Math.min(0.7 * U, Math.max(0.3 * U, UB)); }
      const Fw = u => u / 1e6 * r.w * r.w;                                       // g·mm → kg·m → N
      r.bal = { G, m, eper, U, UA, UB, FA: Fw(UA), FB: Fw(UB), LA, LB, inboard };
    }
    r.checks = buildChecks(r);
    r.steps = buildSteps(r);
    return r;
  }

  /* ---- Verificações -------------------------------------------------------------------------------- */
  function buildChecks(r) {
    const d = r.d, c = [];
    const add = (sev, title, detail, id) => c.push({ sev, title, detail, id });
    const nF = r.fails.length, N = r.res.length;
    if (nF) {
      const yF = r.fails.filter(s => s.sfy < d.sfY).map(s => s.code), fF = r.fails.filter(s => s.sff < d.sfF).map(s => s.code);
      add('fail', `${nF} de ${N} trechos abaixo dos coeficientes mínimos`,
        [yF.length ? `Escoamento com torque de pico (SF < ${fx(d.sfY, 1)}): ${yF.join(', ')}.` : '', fF.length ? `Fadiga (SF < ${fx(d.sfF, 1)}): ${fF.join(', ')}.` : '', `Pior: ${r.crit.code}, utilização ${fx(r.crit.util, 2)}. É a fórmula simplificada; a verificação local continua pendente.`].filter(Boolean).join(' '), 'secs');
    } else add('ok', `Os ${N} trechos atingem os coeficientes mínimos`, `Maior utilização: ${r.crit.code} (${fx(r.crit.util, 2)}). Fórmula simplificada; verificação local pendente.`, 'secs');
    const near = r.res.filter(s => s.ok && s.util > 0.9).map(s => s.code);
    if (near.length) add('warn', 'Trechos perto do limite', `${near.join(', ')} com utilização entre 0,9 e 1,0: sensíveis a Kt, Kf e ao torque de pico.`, 'secs');
    // caminho do torque
    const altN = r.alt.fails.length;
    if (d.torqueMode === 'integral') add('info', 'Torque integral em todos os trechos', altN === nF ? `Com o torque entrando pelo acoplamento e saindo no pacote, o resultado seria o mesmo (${altN} abaixo).` : `Com o torque entrando pelo acoplamento e saindo no pacote, ${altN ? `${altN} ${altN === 1 ? 'trecho ficaria' : 'trechos ficariam'} abaixo (${r.alt.fails.join(', ')})` : 'nenhum trecho ficaria abaixo'}. Os trechos do lado oposto ao acoplamento quase não recebem torque.`, 'torque');
    else add('info', 'Torque pelo caminho real', `No modo integral, ${altN ? `${altN} ${altN === 1 ? 'trecho ficaria' : 'trechos ficariam'} abaixo: ${r.alt.fails.join(', ')}` : 'nenhum trecho ficaria abaixo'}.`, 'torque');
    if (isNum(r.fpkAdm.v) && r.fpkAdm.s) add(r.fpkAdm.v >= d.peak && r.fpkAdm.v < 5 && d.machine !== 'motor' ? 'warn' : 'info', 'Torque de pico admissível',
      `O trecho ${r.fpkAdm.s.code} limita o pico a ${fx(r.fpkAdm.v, 2)} × T (${fx(r.fpkAdm.v * r.T / 1000, 1)} kN·m) com SF ${fx(d.sfY, 1)} no escoamento.${d.machine !== 'motor' ? ' Num gerador, o curto súbito nos terminais costuma dar 5 a 8 pu; confirme com o projeto elétrico.' : ''}`, 'torque');
    // potência
    const dp = r.Pshaft - r.PshaftAlt;
    if (Math.abs(dp) > 0.001 * r.Pshaft) add('info', 'Base da potência no eixo', `${d.powerBase === 'rend' ? 'Pelo rendimento' : 'Pelas perdas'}: ${fx(r.Pshaft, 2)} kW. ${d.powerBase === 'rend' ? 'Pelas perdas' : `Pelo rendimento ${fx(d.eff, 3)}`}: ${fx(r.PshaftAlt, 2)} kW (${dp > 0 ? '+' : '−'}${fx(Math.abs(dp), 2)} kW). Confirme qual base a FTD usa.`, 'torque');
    // flecha e inclinação
    if (d.gap) {
      const lim = 0.1 * d.gap, y = isNum(r.defl.core) ? r.defl.core : r.defl.span;
      add(y > lim ? 'fail' : y > 0.5 * lim ? 'warn' : 'ok', 'Flecha no pacote × entreferro', `${fx(y, 3)} mm no pacote = ${fx(y / d.gap * 100, 1)} % do entreferro (${fx(d.gap, 2)} mm). Regra usual: até 10 %.`, 'flecha');
    } else add('info', 'Flecha sem referência de entreferro', `Flecha no vão ${fx(r.defl.span, 3)} mm. Informe o entreferro (grupo 07) para conferir a regra de 10 %.`, 'flecha');
    for (const b of r.bearings) add(b.ok ? 'ok' : 'fail', `Inclinação no mancal ${b.name}`, `${fx(Math.abs(b.th) * 1000, 3)} mrad (admissível ${fx(d.slopeMax, 2)}); desalinhamento na borda do colo ≈ ${fx(b.edge * 1000, 1)} µm em ${fx(b.B, 0)} mm.`, 'mancais');
    // críticas
    if (r.dyn && r.dyn.design && r.dyn.design.ok) {
      const nc = r.dyn.design.rpm, n = d.speed, m = d.margin / 100;
      const n1 = nc[0], ratio = n1 / n;
      if (n1 >= n * (1 + m)) add('ok', 'Primeira crítica acima da rotação', `${f0(n1)} rpm = ${fx(ratio, 2)} × n (${r.dyn.designLabel}). Rotor rígido; margem exigida ${f0(d.margin)} %.${n1 < n * d.overspeed * (1 + m) ? ` Na sobrevelocidade (${fx(d.overspeed, 2)} ×) a separação cai para ${f0((n1 / (n * d.overspeed) - 1) * 100)} %.` : ''}`, 'criticas');
      else if (n1 > n * (1 - m)) add('fail', 'Crítica dentro da faixa de operação', `${f0(n1)} rpm está a ${fx(Math.abs(ratio - 1) * 100, 1)} % da rotação (${f0(n)} rpm); a margem exigida é ${f0(d.margin)} %.`, 'criticas');
      else {
        const n2 = nc[1], near2 = isNum(n2) && Math.abs(n2 / n - 1) < m;
        add(near2 ? 'fail' : 'warn', 'Rotor flexível (opera acima da 1ª crítica)', `1ª crítica ${f0(n1)} rpm < n. ${near2 ? `A 2ª (${f0(n2)} rpm) também está perto da rotação.` : `A 2ª está em ${f0(n2)} rpm.`} Passa pela crítica na partida: exige análise amortecida e balanceamento em vários planos.`, 'criticas');
      }
      const base = r.dyn.flex || r.dyn.rigid;
      if (r.dyn.mag && r.dyn.mag.ok && base.ok) {
        const red = 1 - r.dyn.mag.rpm[0] / base.rpm[0];
        if (red > 0.05) add('warn', 'Rigidez magnética derruba a crítica', `A força magnética como mola negativa reduz a 1ª crítica em ${fx(red * 100, 1)} %.`, 'criticas');
      }
    } else if (r.dyn && r.dyn.design && !r.dyn.design.ok) add('fail', 'Rotor instável no modelo', 'A rigidez magnética negativa supera a do eixo nos mancais: reveja o entreferro e a excentricidade.', 'criticas');
    // método e malha
    if (r.fe && r.fe.ok) {
      const th = d.beam === 'euler' ? 'Euler–Bernoulli' : 'Timoshenko', I = r.fe.info, an = r.an;
      const dR = Math.abs(r.fe.RA - an.RA) / Math.abs(an.RA), dS = r.fe.defl.span / an.defl.span - 1;
      add('info', r.method === 'mef' ? `Estática por elementos finitos · ${th}` : 'Estática',
        `${I.ne} elementos (malha ${I.type}). ${dR < 1e-6 ? 'Reações e momentos iguais aos da estática: com dois mancais o eixo é isostático.' : `Reações diferem ${fx(dR * 100, 3)} % da estática: na malha uniforme o peso fica espalhado por igual dentro de cada elemento.`} Flecha no vão: MEF ${fx(r.fe.defl.span, 4)} mm, ${fx(an.defl.span, 4)} mm (${dS >= 0 ? '+' : '−'}${fx(Math.abs(dS) * 100, 1)} %${d.beam !== 'euler' && r.fe.other && Math.abs(r.fe.other.defl.span / an.defl.span - 1) < 0.1 * Math.abs(dS) ? ', quase tudo cisalhamento' : ''}).`, 'mef');
      const R = r.fe.refine;
      if (R) {
        const pct = v => isNum(v) ? fx(v * 100, v < 0.0001 ? 4 : 3) + ' %' : '—';
        const worst = Math.max(R.dSpan, R.dTh, R.dM, isNum(R.dNc1) ? R.dNc1 : 0);
        add(worst * 100 <= d.convTol ? 'ok' : 'warn', worst * 100 <= d.convTol ? 'Malha convergida' : 'Malha grossa para a tolerância',
          `Com ${R.ne2} elementos (o dobro), a flecha no vão muda ${pct(R.dSpan)}, a inclinação em A ${pct(R.dTh)}, o momento máximo ${pct(R.dM)} e a 1ª crítica ${pct(R.dNc1)}. Tolerância: ${fx(d.convTol, 2)} %.`, 'mef');
      }
    }
    // massa
    if (d.drawingMass) { const e = r.mass.shaft / d.drawingMass - 1; add(Math.abs(e) > 0.1 ? 'warn' : 'info', 'Massa do eixo × desenho', `Geometria: ${f0(r.mass.shaft)} kg; desenho: ${f0(d.drawingMass)} kg (${e > 0 ? '+' : '−'}${fx(Math.abs(e) * 100, 1)} %). Rasgos, furos e planos não detalhados explicam parte da diferença.`, 'cargas'); }
    // chavetas
    for (const k of r.keyRes) add(k.ok ? 'ok' : 'fail', `Chaveta ${k.name}`, `${fx(k.share, 0)} % do torque: cisalhamento ${fx(k.tau, 1)} MPa e pressão no eixo ${fx(k.pS, 1)} MPa nominais; com pico, SF ${fx(k.sf, 2)} (mín. ${fx(d.sfY, 1)}).${!k.ok && k.share >= 99 ? ' Se ela só arrasta um acessório, reduza a parcela de torque.' : ''}`, 'interfaces');
    for (const f of r.fitRes) {
      if (f.hub) add(f.ok ? 'ok' : 'fail', `Ajuste ${f.name}`, `Pressão gerada ${fx(f.pN, 1)} MPa na rotação (requerida ${fx(f.pReq, 2)}); transmite ${fx(f.TtrN / 1000, 1)} kN·m = ${fx(f.sfN, 2)} × o torque; tensão no cubo ${fx(f.hubVm, 0)} MPa.`, 'interfaces');
      else add('info', `Ajuste ${f.name}: pressão gerada não verificada`, `Requer ${fx(f.pReq, 2)} MPa (μ ${fx(d.mu, 2)}, ${fx(f.share, 0)} % do torque). Informe o Ø externo do cubo para o cálculo de Lamé com perda por rotação.`, 'interfaces');
    }
    // mancais
    for (const b of r.bearings) if (b.p > 2.5) add('warn', `Pressão específica no mancal ${b.name}`, `${fx(b.p, 2)} MPa com o colo Ø${fx(b.D, 1)} × ${fx(b.B, 1)} mm, acima de 2,5 MPa.`, 'mancais');
    for (const s of r.res) if (s.kf > s.kt) add('warn', `Kf maior que Kt em ${s.code}`, 'A sensibilidade ao entalhe não passa de 1: confira os fatores.', 'secs');
    if (r.res.some(s => s.flat)) add('info', 'Seção com quatro planos', 'Área e inércia exatas; a torção usa o círculo inscrito .', 'secs');
    if (r.bal && !r.bal.inboard) add('warn', 'Centro de massa fora dos mancais', 'A divisão do desbalanceamento admissível segue a regra de rotor em balanço (ISO 1940-1, 7.2.3).', 'balanceamento');
    return c;
  }

  /* ---- Memória de cálculo ---------------------------------------------------------------------------- */
  function buildSteps(r) {
    const d = r.d, s = [], gen = d.machine !== 'motor';
    const st = (section, title, formula, subst, value, unit, dd, comment, source) => s.push({ section, title, formula, subst, value, unit, d: dd, comment, source });
    // torque
    if (d.powerBase === 'rend') st('torque', 'Potência no eixo', gen ? 'Peixo = Pel / η' : 'Peixo = Pel · η', `${fx(d.pElec, 2)} ${gen ? '/' : '·'} ${fx(d.eff, 3)}`, r.Pshaft, 'kW', 2, `Pelas perdas daria ${fx(r.PshaftAlt, 2)} kW.`);
    else st('torque', 'Potência no eixo', gen ? 'Peixo = Pel + Pmec + Pperd' : 'Peixo = Pel − Pmec − Pperd', gen ? `${fx(d.pElec, 2)} + ${fx(d.lossMech, 2)} + ${fx(d.lossElec, 2)}` : `${fx(d.pElec, 2)} − ${fx(d.lossMech, 2)} − ${fx(d.lossElec, 2)}`, r.Pshaft, 'kW', 2, `Pelo rendimento ${fx(d.eff, 3)} daria ${fx(r.PshaftAlt, 2)} kW: confirme a base das perdas.`, gen ? 'Gerador: a turbina entrega a potência elétrica mais as perdas' : 'Motor: o eixo entrega a potência elétrica menos as perdas');
    st('torque', 'Torque nominal', 'T = Peixo · 60 000 / (2π · n)', `${fx(r.Pshaft, 2)} · 60 000 / (2π · ${fx(d.speed, 0)})`, r.T / 1000, 'kN·m', 2, null, 'N·m com P em kW e n em rpm');
    st('torque', 'Torque de pico (verificação estática)', 'Tpico = kpico · T', `${fx(d.peak, 2)} · ${fx(r.T / 1000, 2)}`, r.Tpk / 1000, 'kN·m', 2, d.machine !== 'motor' ? 'O 2,09 pu da FTD é dado de motor. Para gerador, o curto súbito nos terminais pode chegar a 5–8 pu.' : null);
    st('torque', 'Ângulo de torção do eixo', 'φ = Σ T(x)·Δx / (G·J)', `G = E/2(1+ν) = ${f0(d.E / 2.6)} MPa · ${d.torqueMode === 'linear' ? 'torque pelo caminho real' : 'torque integral'}`, r.twist * 180 / PI, '°', 3, `${fx(r.twist * 180 / PI / (d.L / 1000), 3)} °/m em média.`);
    // cargas
    st('cargas', 'Massa do eixo (geometria)', 'meixo = Σ ρ · A · L', `${f0(d.rho)} kg/m³ · ${r.res.length} trechos`, r.mass.shaft, 'kg', 0, d.drawingMass ? `Desenho: ${f0(d.drawingMass)} kg.` : null, 'Seção líquida dos trechos; rasgos e furos fora');
    st('cargas', 'Peso próprio (por trecho)', 'q = −A · ρ · g', `ex. ${r.res[0].code}: −${fx(r.res[0].A, 0)} mm² · ${f0(d.rho)} · 9,80665 · 10⁻⁹`, -r.res[0].A * 1e-9 * d.rho * G0, 'N/mm', 3);
    if (d.rotorMass > 0) st('cargas', 'Massa do rotor distribuída', 'qrot = −mrot · g / (x1 − x0)', `−${f0(d.rotorMass)} · 9,80665 / (${fx(d.rotorTo, 1)} − ${fx(d.rotorFrom, 1)})`, -d.rotorMass * G0 / (d.rotorTo - d.rotorFrom), 'N/mm', 2);
    st('cargas', 'Força magnética', 'Fmag = F[kgf] · 9,80665', `${fx(d.ump, 2)} · 9,80665 (para baixo, em x = ${fx(d.xUmp, 1)} mm)`, d.ump * G0 / 1000, 'kN', 3, 'Direção é hipótese: soma com a gravidade (pior caso).');
    st('cargas', 'Massa total girante e centro de massa', 'm = meixo + mrot · xcg = Σm·x / m', `${f0(r.mass.shaft)} + ${f0(d.rotorMass)} kg`, r.mass.total, 'kg', 0, `Centro de massa em x = ${fx(r.mass.cg, 1)} mm.`);
    // reações
    st('reacoes', 'Soma das forças verticais', 'ΣFy = Σ q·(b − a) + Σ F', 'peso do eixo + rotor + força magnética + acoplamento', r.Fy / 1000, 'kN', 2);
    st('reacoes', 'Reação no mancal B', 'RB = −Σ M(A) / (xB − xA)', `momentos em torno de A / (${fx(d.xB, 2)} − ${fx(d.xA, 3)})`, r.RB / 1000, 'kN', 2);
    st('reacoes', 'Reação no mancal A', 'RA = −ΣFy − RB', `${fx(-r.Fy / 1000, 2)} − ${fx(r.RB / 1000, 2)}`, r.RA / 1000, 'kN', 2, `${f0(r.RA / G0)} kgf e ${f0(r.RB / G0)} kgf.`);
    if (r.fe && r.fe.ok) st('reacoes', `Reações por elementos finitos${r.method === 'mef' ? ' (usadas)' : ''}`, 'R = Σ esforços dos elementos no nó − força aplicada', `RA ${fx(r.fe.RA / 1000, 4)} · RB ${fx(r.fe.RB / 1000, 4)} kN · resíduo de equilíbrio ${Math.abs(r.fe.residual).toExponential(1)}`, null, '', 0, `Estática: ${fx(r.an.RA / 1000, 4)} e ${fx(r.an.RB / 1000, 4)} kN.`);
    // esforços
    if (r.method === 'mef') st('esforcos', 'Momento fletor máximo (MEF)', 'fe = Ke·ue − fe,eq · M(ξ) = −M1 + V1·ξ + q·ξ²/2', `máximo em x = ${fx(r.Mmax.x, 1)} mm (${r.Mmax.sec ? r.Mmax.sec.code : '—'}) · ${r.fe.info.ne} elementos`, Math.abs(r.Mmax.v) / 1e6, 'kN·m', 2, `Recuperado por equilíbrio dentro de cada elemento. Superposição: ${fx(Math.abs(r.an.Mmax[1]), 2)} kN·m.`);
    else st('esforcos', 'Momento fletor máximo', 'M(x) = RA⟨x−xA⟩ + RB⟨x−xB⟩ + Σ F⟨x−xF⟩ + Σ q·t·(x − a − t/2)', `máximo em x = ${fx(r.Mmax.x, 1)} mm (${r.Mmax.sec ? r.Mmax.sec.code : '—'})`, Math.abs(r.Mmax.v) / 1e6, 'kN·m', 2, 'Superposição; t = trecho da carga distribuída à esquerda de x.');
    st('esforcos', 'Momento nos mancais', 'M(xA), M(xB)', `balanços de ${fx(d.xA, 1)} e ${fx(d.L - d.xB, 1)} mm`, Math.max(Math.abs(r.MA), Math.abs(r.MB)) / 1e6, 'kN·m', 2, `A: ${fx(r.MA / 1e6, 2)} · B: ${fx(r.MB / 1e6, 2)} kN·m.`);
    st('esforcos', 'Cortante máximo', 'V(x) = Σ forças à esquerda', `em x = ${fx(r.Vmax.x, 1)} mm`, Math.abs(r.Vmax.v) / 1000, 'kN', 2);
    // flecha
    const thName = d.beam === 'euler' ? 'Euler–Bernoulli' : 'Timoshenko';
    if (r.method === 'mef') st('flecha', 'Flecha máxima (MEF)', 'K·u = f · v(ξ) = N(ξ)·ue dentro de cada elemento', `${r.fe.info.ne} elementos de ${thName} · máximo em x = ${fx(r.defl.xmax, 1)} mm`, r.defl.max, 'mm', 4, `${r.defl.xmax < d.xA || r.defl.xmax > d.xB ? 'O máximo está na ponta em balanço, não no vão. ' : ''}Deslocamentos dos nós interpolados pelas funções de forma; o máximo dentro do elemento sai de dv/dξ = 0.`, `Elementos finitos · ${d.kBearing ? `mancais de ${fx(d.kBearing, 0)} kN/mm` : 'mancais rígidos'}`);
    else st('flecha', 'Flecha máxima', 'y″ = M / (E·I) · y(xA) = y(xB) = 0', `malha de ${r.an.mesh.length} pontos · máximo em x = ${fx(r.defl.xmax, 1)} mm`, r.defl.max, 'mm', 3, r.defl.xmax < d.xA || r.defl.xmax > d.xB ? 'O máximo está na ponta em balanço, não no vão.' : null, 'Dupla integração com mancais rígidos');
    st('flecha', 'Flecha no vão entre mancais', 'máx |y| em xA ≤ x ≤ xB', `em x = ${fx(r.defl.xspan, 1)} mm`, r.defl.span, 'mm', 4, isNum(r.defl.core) ? `No pacote do rotor: ${fx(r.defl.core, 4)} mm.` : null);
    st('flecha', 'Inclinação nos mancais', r.method === 'mef' ? 'θ = rotação da seção no nó do mancal' : 'θ = y′(x)', `A: ${fx(r.defl.thA * 1000, 4)} · B: ${fx(r.defl.thB * 1000, 4)} mrad`, Math.max(Math.abs(r.defl.thA), Math.abs(r.defl.thB)) * 1000, 'mrad', 3, `Admissível ${fx(d.slopeMax, 2)} mrad.`);
    if (r.fe && r.fe.ok) {
      const other = r.method === 'mef' ? r.an.defl : r.fe.defl;
      st('flecha', r.method === 'mef' ? 'Conferência pelo método original' : 'Conferência por elementos finitos', r.method === 'mef' ? 'y″ = M/(E·I), dupla integração, apoios rígidos' : `K·u = f · ${r.fe.info.ne} elementos de ${thName}`,
        `vão ${fx(other.span, 4)} mm · ponta ${fx(other.tip, 4)} mm · θA ${fx(Math.abs(other.thA) * 1000, 4)} mrad`, other.span, 'mm', 4,
        `Diferença no vão: ${fx((r.fe.defl.span / r.an.defl.span - 1) * 100, 3)} % (MEF sobre o script). ${d.beam === 'euler' ? 'Com Euler–Bernoulli os dois resolvem a mesma equação: o que sobra é a integração numérica do script, numa grade de 10 mm.' : `Vem da deformação por cisalhamento (Timoshenko), relevante num eixo curto e grosso: na mesma malha, Euler–Bernoulli daria ${fx(r.fe.other ? r.fe.other.defl.span : NaN, 4)} mm (${fx(r.fe.other ? (r.fe.other.defl.span / r.an.defl.span - 1) * 100 : NaN, 3)} % do script).`}`);
    }
    // elementos finitos: modelo, malha e verificação
    if (r.fe && r.fe.ok) {
      const F = r.fe, I = F.info, els = F.model.elems;
      const phis = Array.from(F.st.phis);
      const kap = els.reduce((a, e) => Math.min(a, e.kappa), 1);
      const extra = [I.zones ? `${I.zones} ${I.zones === 1 ? 'região' : 'regiões'} de refino` : '', I.user ? `${I.user} ${I.user === 1 ? 'nó pedido' : 'nós pedidos'}` : ''].filter(Boolean).join(' e ');
      st('mef', 'Discretização', 'elementos de viga de 2 nós · 2 graus de liberdade por nó (v, θ)', `malha ${I.type} · alvo ${d.nElem}${extra ? ` + ${extra}` : ''} → ${I.ne} elementos, ${I.nn} nós`, I.ndof, 'GDL', 0,
        `Elementos de ${fx(I.hmin, 1)} a ${fx(I.hmax, 1)} mm. ${I.type === 'uniforme' ? 'Os degraus do eixo caem dentro dos elementos: rigidez pela média harmônica, massa e peso pela média do que o elemento cobre. É esse erro de geometria que a convergência mostra.' : 'Há nó em toda mudança de seção, nos mancais, nas forças e nas pontas do pacote; cada trecho é dividido na proporção do comprimento.'}${I.zones ? ' Nas regiões de refino, nenhum elemento passa do h pedido.' : ''}${I.user ? ` Nós pedidos a menos de ${fx(MESH_SNAP, 0)} mm de um nó obrigatório juntam-se a ele.` : ''}`, 'Elementos finitos de viga');
      st('mef', `Rigidez do elemento · ${thName}`, 'Ke = EI/((1+Φ)·L³)·[12, 6L, −12, 6L; 6L, (4+Φ)L², −6L, (2−Φ)L²; …] · Φ = 12EI/(κGAL²)', d.beam === 'euler' ? 'Φ = 0 (sem cisalhamento)' : `κ (Cowper) ≥ ${fx(kap, 3)} · Φ de ${sig(Math.min(...phis))} a ${sig(Math.max(...phis))}`, null, '', 0,
        d.beam === 'euler' ? 'Hermite cúbica: deslocamentos nos nós exatos para cargas uniformes por elemento.' : 'Interpolação interdependente: exata para a viga de Timoshenko sem carga no elemento e sem travamento por cisalhamento. Φ alto só diz que o elemento é mais curto que o Ø; quem é viga é o eixo inteiro.');
      st('mef', 'Cargas nodais consistentes', 'fe,eq = [qL/2, qL²/12, qL/2, −qL²/12] · forças concentradas nos nós', `peso de ${I.ne} elementos${d.rotorMass > 0 ? ' + rotor' : ''} + força magnética${d.coupleF ? ' + acoplamento' : ''}`, -F.st.Ftot / 1000, 'kN', 3, 'Soma das cargas aplicadas, para baixo.');
      st('mef', 'Condições de contorno e solução', d.kBearing ? 'molas k nos nós dos mancais · K·u = f' : 'v = 0 nos nós dos mancais · K·u = f', `${F.st.ndof} equações livres · Cholesky em banda (meia-largura 3)`, null, '', 0, d.kBearing ? `k = ${fx(d.kBearing, 0)} kN/mm: a flecha inclui o recuo dos mancais.` : 'Mancais rígidos, como no script.');
      st('mef', 'Equilíbrio', 'ΣR + ΣF = 0', `RA + RB = ${fx((F.RA + F.RB) / 1000, 4)} kN · cargas ${fx(-F.st.Ftot / 1000, 4)} kN`, Math.abs(F.residual) * 100, '% de resíduo', 2, `Erro relativo ${Math.abs(F.residual).toExponential(1)}: só arredondamento.`);
      if (F.refineSkipped) st('mef', 'Malha com o dobro de elementos', 'Δ = |Q(N) − Q(2N)| / |Q(2N)|', `${I.ne} elementos: o dobro passaria de ${fx(MAX_ELEMS, 0)}`, null, '', 0, 'Conferência automática desligada nesta malha; o estudo de convergência logo abaixo compara com malhas mais grossas.');
      if (F.refine) st('mef', 'Malha com o dobro de elementos', 'Δ = |Q(N) − Q(2N)| / |Q(2N)|', `${I.ne} → ${F.refine.ne2} elementos · flecha ${fx(F.refine.dSpan * 100, 4)} % · θA ${fx(F.refine.dTh * 100, 4)} % · 1ª crítica ${fx(F.refine.dNc1 * 100, 4)} %`,
        Math.max(F.refine.dSpan, F.refine.dTh, F.refine.dM, isNum(F.refine.dNc1) ? F.refine.dNc1 : 0) * 100, '% (maior)', 4, `Tolerância ${fx(d.convTol, 2)} %. O estudo completo de convergência fica logo abaixo.`);
    }
    // críticas
    if (r.dyn) {
      const D = r.dyn;
      st('criticas', 'Modelo de viga', 'K·φ = ω²·M·φ', `${D.elems} elementos de ${thName} (malha ${D.info.type}), ${D.nodes} nós, massa consistente + inércia de rotação`, null, '', 0, `A massa do rotor (${f0(d.rotorMass)} kg) entra distribuída, sem rigidez. Sem efeito giroscópico nem amortecimento. Mesma malha do grupo Método e malha.`);
      if (isNum(D.rayleigh)) st('criticas', 'Rayleigh (deflexão pelo peso)', 'ω² = uᵀ·f / (uᵀ·M·u)', 'u = deflexão estática sob o peso próprio, mancais rígidos', D.rayleigh, 'rpm', 0, 'Limite superior da 1ª crítica: confere o autovalor.');
      if (D.rigid.ok) st('criticas', '1ª crítica · mancais rígidos', 'n = ω · 60 / 2π', `ω = ${fx(D.rigid.w[0], 1)} rad/s · ${D.rigid.iterations} iterações em subespaço`, D.rigid.rpm[0], 'rpm', 0, `${fx(D.rigid.rpm[0] / d.speed, 2)} × a rotação nominal. 2ª: ${f0(D.rigid.rpm[1])} rpm · 3ª: ${f0(D.rigid.rpm[2])} rpm. Rayleigh fica ${fx((D.rayleigh / D.rigid.rpm[0] - 1) * 100, 2)} % acima, como deve.`);
      if (D.flex && D.flex.ok) st('criticas', '1ª crítica · mancais elásticos', `k = ${fx(d.kBearing, 0)} kN/mm em A e B`, `2ª: ${f0(D.flex.rpm[1])} rpm`, D.flex.rpm[0], 'rpm', 0, `${fx(D.flex.rpm[0] / d.speed, 2)} × n.`);
      if (D.mag && D.mag.ok) st('criticas', '1ª crítica · com rigidez magnética', `kmag = −Fmag / (e·g) = −${fx(D.kMag, 1)} N/mm`, `e = ${fx(d.umpEcc, 0)} % de ${fx(d.gap, 2)} mm, distribuída no pacote`, D.mag.rpm[0], 'rpm', 0);
    }
    // balanceamento
    if (r.bal) {
      const B = r.bal;
      st('balanceamento', 'Excentricidade admissível', 'eper = G / ω', `${fx(B.G, 1)} mm/s / ${fx(r.w, 2)} rad/s`, B.eper, 'µm', 2, null, 'ISO 1940-1 / ISO 21940-11');
      st('balanceamento', 'Desbalanceamento residual admissível', 'Uper = 1000 · G · m / ω', `1000 · ${fx(B.G, 1)} · ${f0(B.m)} / ${fx(r.w, 2)}`, B.U, 'g·mm', 0);
      st('balanceamento', 'Divisão nos mancais', 'UA = U · LB / L · UB = U · LA / L', `LA = ${fx(B.LA, 1)} · LB = ${fx(B.LB, 1)} mm${B.inboard ? ' · limites 30–70 %' : ''}`, B.UA, 'g·mm (A)', 0, `B: ${f0(B.UB)} g·mm.`);
      st('balanceamento', 'Força girante residual', 'F = U · ω²', `A: ${f0(B.UA)} g·mm · ${fx(r.w, 2)}²`, B.FA / 1000, 'kN (A)', 2, `B: ${fx(B.FB / 1000, 2)} kN. Comparar com as reações estáticas (${fx(r.RA / 1000, 1)} e ${fx(r.RB / 1000, 1)} kN).`);
    }
    // interfaces
    if (r.keyRes.length) { const k = r.keyRes[0]; st('interfaces', `Chaveta ${k.name} (exemplo)`, 'F = 2T/d · τ = F/(b·L) · p = F/(t·L)', `F = 2 · ${fx(k.T / 1000, 2)} kN·m / ${fx(k.d, 1)} mm = ${fx(k.F / 1000, 1)} kN`, k.tau, 'MPa', 1, `Pressão no eixo ${fx(k.pS, 1)} MPa. Com pico: SF ${fx(k.sf, 2)}.`, 'Cisalhamento médio ideal; todas na tabela'); }
    if (r.fitRes.length) { const f = r.fitRes[0]; st('interfaces', `Ajuste ${f.name}: pressão requerida`, 'p = 2T / (μ · π · d² · L)', `2 · ${fx(f.T, 0)} / (${fx(d.mu, 2)} · π · ${fx(f.d / 1000, 3)}² · ${fx(f.L / 1000, 4)})`, f.pReq, 'MPa', 2, 'Pressão que o atrito precisa para levar o torque; a gerada depende do cubo.'); }
    // mancais
    for (const b of r.bearings) st('mancais', `Mancal ${b.name}: pressão específica`, 'pm = F / (D · B)', `${fx(Math.abs(b.F) / 1000, 2)} kN / (${fx(b.D, 1)} · ${fx(b.B, 1)}) · trecho ${b.s.code}`, b.p, 'MPa', 3, `Velocidade periférica ${fx(b.v, 1)} m/s. B = comprimento do colo, então pm é o limite inferior.`);
    return s;
  }
  // memória de um trecho (o selecionado no explorador)
  function sectionSteps(r, s) {
    const d = r.d, out = [];
    const st = (title, formula, subst, value, unit, dd, comment, source) => out.push({ section: 'trecho', title, formula, subst, value, unit, d: dd, comment, source });
    st('Área e inércia', s.flat ? 'A, I com quatro planos (segmentos circulares)' : 'A = π(d² − di²)/4 · I = π(d⁴ − di⁴)/64', `d = ${fx(s.d, 3)}${s.di ? ` · di = ${fx(s.di, 2)}` : ''}${s.flat ? ` · planos ${fx(s.flats, 1)}` : ''} mm`, s.I / 1e4, '·10⁴ mm⁴', 1, `A = ${fx(s.A, 0)} mm² · J = ${fx(s.J / 1e4, 1)}·10⁴ mm⁴${s.flat ? ' (círculo inscrito)' : ''}.`);
    st('Momento máximo no trecho', 'M = máx |M(x)|, x de a até b', r.method === 'mef' ? `MEF: M(ξ) recuperado em cada elemento do trecho (pontas${r.fe.info.ne > 400 ? '' : ', quartos'} e vértice) · x = ${fx(s.xm, 1)} mm` : `amostras a cada ≤ 10 mm + cargas e mancais · x = ${fx(s.xm, 1)} mm`, s.m / 1e6, 'kN·m', 3);
    st('Torque no trecho', s.tpct !== null && s.tpct !== undefined ? 'T = T · fração do trecho' : d.torqueMode === 'linear' ? 'T(x) pelo caminho acoplamento → pacote' : 'T = T nominal (integral)', `${fx(r.T / 1000, 2)} kN·m${s.tpct !== null && s.tpct !== undefined ? ` · ${fx(s.tpct, 0)} %` : ''}`, s.torque / 1000, 'kN·m', 2);
    st('Tensão de flexão', 'σb = M · (d/2) / I', `${fx(s.m / 1e6, 3)}·10⁶ · ${fx(s.d / 2, 2)} / ${fx(s.I / 1e4, 1)}·10⁴`, s.sb, 'MPa', 2);
    st('Tensão de torção', 'τ = T · r / J', `${fx(s.torque, 0)}·10³ · ${fx(s.rt, 2)} / ${fx(s.J / 1e4, 1)}·10⁴`, s.tau, 'MPa', 2);
    if (s.sax) st('Tensão axial', 'σax = |Fax| / A', `${fx(Math.abs(d.axialF), 2)}·10³ / ${fx(s.A, 0)}`, s.sax, 'MPa', 2);
    st('Von Mises com pico e Kt', 'σvm = √[(σax + Kt·σb)² + 3·(Kt·kpico·τ)²]', `Kt ${fx(s.kt, 2)} · kpico ${fx(d.peak, 2)}`, s.vm, 'MPa', 1);
    st('SF ao escoamento', 'SFesc = Sy / σvm', `${f0(d.sy)} / ${fx(s.vm, 1)}`, s.sfy, '', 2, `Mínimo ${fx(d.sfY, 2)} · utilização ${fx(s.uy, 2)}.`);
    if (d.seMode === 'marin') { const z = s.seInfo; st('Limite de fadiga (Marin)', 'Se = ka · kb · kc · kd · ke · Se′', `${fx(z.ka, 3)} · ${fx(z.kb, 3)} · 1 · 1 · ${fx(z.ke, 3)} · ${fx(z.se0, 0)}`, s.se, 'MPa', 1, 'kb pelo Ø do trecho (≥ 0,6 acima de 254 mm).', 'Shigley, cap. 6'); }
    st('Tensões de fadiga', 'σa = Kf·σb · σm = √(σax² + 3·(Kf·τ)²)', `Kf ${fx(s.kf, 2)}`, s.sa, 'MPa (σa)', 2, `σm = ${fx(s.sm, 2)} MPa (torque constante; flexão alternada).`);
    const fml = { goodman: '1/SF = σa/Se + σm/Su', gerber: 'SF·σa/Se + (SF·σm/Su)² = 1', asme: '1/SF = √[(σa/Se)² + (σm/Sy)²]', soderberg: '1/SF = σa/Se + σm/Sy' }[d.fatigue];
    st(`SF à fadiga · ${CRITERIA[d.fatigue]}`, fml, `Se ${fx(s.se, 1)} · Su ${f0(d.su)} · Sy ${f0(d.sy)}`, s.sff, '', 2, `Mínimo ${fx(d.sfF, 2)} · utilização ${fx(s.uf, 2)}.`);
    st('Ø mínimo pela fórmula', 'menor d com SFesc ≥ mín. e SFfad ≥ mín.', `bisseção (30 passos) com M, T, Kt e Kf do trecho${s.flat ? ' e planos proporcionais' : ''}`, s.dmin, 'mm', 1, `${s.d >= s.dmin ? 'Folga' : 'Falta'} de ${fx(Math.abs(s.d / s.dmin - 1) * 100, 1)} % no diâmetro.`);
    if (isNum(s.fpkAdm)) st('Fator de pico admissível', 'kpico,adm = √[(Sy/SFesc)² − (σax + Kt·σb)²] / (√3·Kt·τ)', `${f0(d.sy)} / ${fx(d.sfY, 2)}`, s.fpkAdm, '× T', 2);
    if (isNum(s.q)) out.push({ section: 'trecho', title: 'Sensibilidade ao entalhe implícita', formula: 'q = (Kf − 1) / (Kt − 1)', subst: `(${fx(s.kf, 2)} − 1) / (${fx(s.kt, 2)} − 1)`, value: s.q, unit: '', d: 2, comment: s.q > 1 ? 'q > 1: Kf não deveria passar de Kt.' : 'Faixa usual de aços: 0,6 a 0,95.' });
    return out;
  }

  // mapa de críticas × rigidez (caro: a interface calcula sob demanda e guarda em cache pela geometria).
  // Com malha muito fina, o mapa usa 200 elementos conformes: o efeito da malha ali é menor que a espessura da linha.
  function criticalMap(r, n = 33) {
    if (!FEM || !r.dyn) return null;
    const d = r.d, ks = Array.from({ length: n }, (_, i) => Math.pow(10, 7 + 4 * i / (n - 1)));
    const model = r.dyn.model.info.ne > 300 ? feModel(d, d.secs, r.loads, 200, 'conforme', { plain: true }) : r.dyn.model;
    return FEM.criticalMap(model, { ks, q: 3, foundation: false, shear: d.beam !== 'euler' });
  }
  // chave do que muda o mapa: geometria, material elástico, massa do rotor, mancais e malha
  const mapKey = d => JSON.stringify([d.secs.map(s => [s.b, s.d, s.di, s.flats]), d.E, d.rho, d.rotorMass, d.rotorFrom, d.rotorTo, d.xA, d.xB, d.beam, d.mesh, d.nElem, (d.meshRefine || []).map(z => [z.a, z.b, z.h]), (d.meshNodes || []).map(p => p.x)]);
  // estudo de convergência: a malha do usuário inteira refinada na mesma proporção (número de elementos e
  // h de cada refino), de 1/16 a 16 vezes, até ~1.100 elementos. Erro relativo à malha mais fina;
  // abaixo de CONV_FLOOR a diferença é arredondamento, não discretização.
  const CONV_KEYS = ['ySpan', 'yTip', 'thA', 'Mmax', 'RA', 'nc1', 'nc2'];
  const CONV_FLOOR = 1e-6, CONV_CAP = 1100;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  function convergence(r) {
    const d = r.d;
    if (!FEM) return null;
    const t0 = now();
    const secs = d.secs, shear = d.beam !== 'euler', springs = springsOf(d);
    const rows = [];
    for (const f of [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16]) {
      const n = Math.max(1, Math.round(d.nElem * f));
      if (f !== 1 && n < 4) continue;
      const model = feModel(d, secs, r.loads, n, null, { scale: f });
      if (f > 1 && model.info.ne > CONV_CAP) break;
      const fe = feStatic(d, secs, r.loads, model);
      if (!fe.ok) continue;
      const c = FEM.criticals(model, { q: 2, springs, foundation: false, shear });
      const row = { f, n, ne: model.info.ne, nn: model.info.nn, ndof: model.info.ndof, hmin: model.info.hmin, hmax: model.info.hmax, cur: f === 1,
        ySpan: fe.defl.span, yTip: fe.defl.tip, thA: Math.abs(fe.defl.thA) * 1000, RA: fe.RA / 1000,
        Mmax: Math.abs(fe.Mmax[1]), nc1: c.ok ? c.rpm[0] : NaN, nc2: c.ok ? c.rpm[1] : NaN };
      const prev = rows[rows.length - 1];
      if (prev && prev.ne === row.ne) { if (row.cur) { prev.cur = true; prev.f = 1; prev.n = n; } continue; }    // a malha conforme mínima se repete
      rows.push(row);
    }
    if (!rows.length) return null;
    const ref = rows[rows.length - 1], tol = d.convTol / 100, conv = {}, order = {}, exact = {};
    for (const k of CONV_KEYS) {
      rows.forEach((row, i) => {
        row[k + 'Err'] = Math.abs(row[k] - ref[k]) / Math.max(1e-30, Math.abs(ref[k]));
        row[k + 'Chg'] = i ? Math.abs(row[k] - rows[i - 1][k]) / Math.max(1e-30, Math.abs(row[k])) : NaN;
      });
      let at = null;                                    // menor malha a partir da qual refinar muda menos que a tolerância
      for (let i = rows.length - 2; i >= 0; i--) { if (rows[i + 1][k + 'Chg'] <= tol) at = rows[i]; else break; }
      conv[k] = at;
      exact[k] = rows.every(row => !(row[k + 'Err'] > CONV_FLOOR));
      // ordem observada: inclinação de log(erro) × log(Ne), sem as duas malhas mais finas (a referência e a vizinha)
      const pts = rows.slice(0, -2).filter(row => row[k + 'Err'] > 2 * CONV_FLOOR).map(row => [Math.log(row.ne), Math.log(row[k + 'Err'])]);
      order[k] = null;
      if (pts.length >= 3) {
        const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        let sxy = 0, sxx = 0, syy = 0;
        for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
        const r2 = sxx > 0 && syy > 0 ? sxy * sxy / (sxx * syy) : 0;
        if (sxx > 0 && -sxy / sxx > 0) order[k] = { p: -sxy / sxx, r2, n: pts.length };      // r2 baixo = convergência aos solavancos
      }
    }
    return { rows, ref, keys: CONV_KEYS, conv, order, exact, floor: CONV_FLOOR, tol, type: d.mesh, beam: d.beam, zones: (d.meshRefine || []).length, ms: now() - t0 };
  }
  const convKey = d => JSON.stringify([mapKey(d), d.ump, d.xUmp, d.coupleF, d.coupleEnd, d.kBearing, d.convTol, d.secs.map(s => s.kt)]);

  return {
    GROUPS, FIELDS, FIELD, INPUTS, EXAMPLE, InputError, calculate, sectionSteps, props, validate, criticalMap, mapKey, convergence, convKey, CONV_KEYS,
    minElems: r => (FEM ? feModel(r.d, r.d.secs, r.loads, 1, 'conforme', { scale: 0 }).info.ne : NaN),
    REFINE_COLS, NODE_COLS, MESH_SNAP, MAX_ELEMS,
    SECTION_COLS, KEY_COLS, FIT_COLS, EXAMPLE_SECTIONS, EXAMPLE_KEYS, EXAMPLE_FITS, MATERIALS, FINISH, RELIAB, CRITERIA,
    fx, f0, fsf, code, G0
  };
});
