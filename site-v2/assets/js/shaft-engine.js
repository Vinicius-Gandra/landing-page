/* Laboratório de eixos · eixo de máquinas elétricas por elementos finitos e DIN 743.
   Só cálculo, sem DOM. Sequência: potência → torque → modelo (eixo + cubo do pacote nos assentos) → estática por MEF
   (divisão da carga entre os assentos) → torção por MEF (caminho do torque do acoplamento ao pacote) → resistência
   pela DIN 743 nos pontos de entalhe (ou Shigley por trecho) → flecha e inclinação → críticas (MEF) → balanceamento
   → chavetas, ajustes e mancais → verificações → memória → casos de verificação e comparação externa.
   Unidades: mm, N, N·mm (momento), N·m (torque), MPa.
   No navegador: window.VGShaft. No Node: require('./shaft-engine.js') (carrega shaft-fem.js e shaft-din743.js ao lado). */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const fem = node ? require('./shaft-fem.js') : root && root.VGShaftFEM;
  const din = node ? require('./shaft-din743.js') : root && root.VGDIN743;
  const api = factory(fem, din);
  if (node) module.exports = api;
  if (root) root.VGShaft = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (FEM, DIN) {
  'use strict';
  const G0 = 9.80665, NU = 0.3, SQ3 = Math.sqrt(3), PI = Math.PI;

  /* ---- Tabelas de apoio ------------------------------------------------------------------------ */
  // materiais do laboratório 01 (procedimento interno): ruptura e escoamento em MPa e o grupo da DIN 743-3
  const MATERIALS = [
    { id: 'AISI 1045', su: 630, sy: 370, group: 'beneficiado' }, { id: 'AISI 1524', su: 510, sy: 283, group: 'estrutural' },
    { id: 'AISI 8620', su: 530, sy: 385, group: 'cementado' }, { id: 'AISI 4140', su: 655, sy: 420, group: 'beneficiado' },
    { id: 'AISI 4340', su: 810, sy: 745, group: 'beneficiado' }
  ];
  // Marin (Shigley, tab. 6-2): ka = a·Su^b
  const FINISH = { retificado: [1.58, -0.085, 'Retificado'], usinado: [4.51, -0.265, 'Usinado / trefilado'], laminado: [57.7, -0.718, 'Laminado a quente'], forjado: [272, -0.995, 'Forjado bruto'] };
  const RELIAB = { '50': 1.0, '90': 0.897, '95': 0.868, '99': 0.814, '99.9': 0.753 };
  const CRITERIA = { goodman: 'Goodman modificado', gerber: 'Gerber', asme: 'ASME elíptico', soderberg: 'Soderberg' };
  const KINDS = { ombro: 'Ombro', chaveta: 'Rasgo de chaveta', ajuste: 'Borda de ajuste prensado', manual: 'Entalhe informado', liso: 'Seção lisa' };

  /* ---- Formulário --------------------------------------------------------------------------------- */
  const GROUPS = [
    { id: 'ident', title: 'Identificação', sub: 'Carimbo, relatório e pendências · opcional', closed: true },
    { id: 'maquina', title: 'Potência e rotação', sub: 'Dados da FTD → potência no eixo e torque' },
    { id: 'perfil', title: 'Perfil do eixo', sub: 'Trechos, raios, chavetas, assentos e entalhes · tabela editável', custom: 'profile' },
    { id: 'cargas', title: 'Mancais, pacote e cargas', sub: 'Apoios, montagem do pacote nos assentos, forças e caminho do torque' },
    { id: 'material', title: 'Material e resistência', sub: 'DIN 743: material, rugosidade, caso de carga e S mínimo' },
    { id: 'mef', title: 'Modelo e malha', sub: 'Elementos finitos: viga, contato nos assentos, malha e convergência' },
    { id: 'dinamica', title: 'Rotodinâmica e limites', sub: 'Rigidez, entreferro, margens e balanceamento', premise: true },
    { id: 'interfaces', title: 'Chavetas e ajustes', sub: 'Atrito, interferência e materiais', premise: true }
  ];
  const NOTES_EXAMPLE = [
    'Furos sem resistência local: 24×M14×2×45; 2×Ø38 a 50°; 4×M12×1,75×45; 4×M10×1,5×30; 6×M24×3×40.',
    'Raios e ombros, furo axial, fixadores e pressão gerada nos ajustes ainda pendentes.',
    'Ø51 na face A não prova furo passante e pode conflitar com M10 no PCD Ø38.',
    'Comprimentos úteis e posições das chavetas G-G e ponta X são estimados (150 e 400 mm).',
    'Geometria de outra máquina (MOTOR 11000/CAESB): só referência; massa do desenho ≈ 2.700 kg.'
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
      options: [['perdas', 'Potência elétrica ± perdas'], ['rend', 'Potência elétrica e rendimento η']] },
    { key: 'eff', group: 'maquina', label: 'Rendimento', sym: 'η', unit: '', type: 'num', def: 0.98, gt: 0.3, max: 1 },
    { key: 'peak', group: 'maquina', label: 'Fator de torque de pico', sym: 'kpico', unit: '×', type: 'num', def: 2.0, min: 1, max: 30, help: 'Entra no escoamento (S_F). Gerador: curto súbito pode dar 5–8 pu.' },
    { key: 'ripple', group: 'maquina', label: 'Ondulação do torque em regime', sym: 'τa/τm', unit: '%', type: 'num', def: 0, min: 0, max: 100, help: 'Amplitude de pulsação (ex.: 6ª harmônica); entra na fadiga.' },
    { key: 'rdP', group: 'maquina', type: 'calc', label: 'Potência no eixo', sym: 'Peixo' },
    { key: 'rdT', group: 'maquina', type: 'calc', label: 'Torque nominal · pico', sym: 'T' },

    { key: 'xA', group: 'cargas', label: 'Mancal A (centro)', sym: 'xA', unit: 'mm', type: 'num', def: 773.225, req: true, min: 0 },
    { key: 'xB', group: 'cargas', label: 'Mancal B (centro)', sym: 'xB', unit: 'mm', type: 'num', def: 3323.99, req: true, min: 0 },
    { key: 'rotorMass', group: 'cargas', label: 'Massa do pacote, bobinas e cubo', sym: 'mrot', unit: 'kg', type: 'num', def: 5000, min: 0, span: true, help: 'Tudo o que gira além do eixo; distribuída de x0 a x1.' },
    { key: 'rotorFrom', group: 'cargas', label: 'Pacote de', sym: 'x0', unit: 'mm', type: 'num', def: 1368.2, min: 0 },
    { key: 'rotorTo', group: 'cargas', label: 'Pacote até', sym: 'x1', unit: 'mm', type: 'num', def: 2625.5, min: 0 },
    { key: 'mount', group: 'cargas', label: 'Montagem do pacote no eixo', type: 'select', def: 'assentos', span: true,
      options: [['assentos', 'Nos assentos (cubo com interferência): o MEF divide a carga'], ['distribuido', 'Distribuído direto no eixo (simplificação do script)']] },
    { key: 'rotorOD', group: 'cargas', label: 'Ø externo do pacote', sym: 'Dpac', unit: 'mm', type: 'num', def: null, opt: true, gt: 0, max: 20000, help: 'Opcional: inércia de rotação do pacote nas críticas.' },
    { key: 'ump', group: 'cargas', label: 'Força magnética (FTD)', sym: 'Fmag', unit: 'kgf', type: 'num', def: 1924.81, min: 0, help: 'Para baixo: pior caso.' },
    { key: 'umpDist', group: 'cargas', label: 'Força magnética aplicada', type: 'select', def: 'distribuida', options: [['distribuida', 'Distribuída no pacote'], ['pontual', 'Pontual em xmag']] },
    { key: 'xUmp', group: 'cargas', label: 'Posição da força', sym: 'xmag', unit: 'mm', type: 'num', def: 1996.85, min: 0 },
    { key: 'coupleF', group: 'cargas', label: 'Força no acoplamento', sym: 'Facop', unit: 'kN', type: 'num', def: 0, min: -10000, max: 10000, help: 'Vertical; + para cima.' },
    { key: 'axialF', group: 'cargas', label: 'Força axial', sym: 'Fax', unit: 'kN', type: 'num', def: 0, min: -10000, max: 10000 },
    { key: 'coupleEnd', group: 'cargas', label: 'Acoplamento', type: 'select', def: 'right', span: true,
      options: [['right', 'Ponta direita (fim do último trecho)'], ['left', 'Ponta esquerda (x = 0)']] },
    { key: 'torqueMode', group: 'cargas', label: 'Torque na resistência', type: 'select', def: 'mef', span: true,
      options: [['mef', 'Pelo caminho real (MEF de torção: acoplamento → assentos → pacote)'], ['integral', 'Integral em todos os trechos (conservador)']] },
    { key: 'auxTorque', group: 'cargas', label: 'Torque além do pacote', sym: 'Taux', unit: '%', type: 'num', def: 1, min: 0, max: 100, span: true, help: 'Excitatriz, ventilador: sai na ponta oposta ao acoplamento.' },
    { key: 'rdR', group: 'cargas', type: 'calc', label: 'Reações nos mancais', sym: 'RA · RB' },
    { key: 'rdSeats', group: 'cargas', type: 'calc', label: 'Carga nos assentos', sym: 'Fassento' },

    { key: 'strength', group: 'material', label: 'Método de resistência', type: 'select', def: 'din743', span: true,
      options: [['din743', 'DIN 743 · entalhes pela geometria (recomendado)'], ['shigley', 'Shigley · Kt e Kf por trecho (triagem)']] },
    { key: 'material', group: 'material', label: 'Material', type: 'select', def: 'AISI 1045', span: true,
      options: MATERIALS.map(m => [m.id, `${m.id} · Su ${m.su} / Sy ${m.sy} MPa`]).concat([['custom', 'Personalizado']]) },
    { key: 'su', group: 'material', label: 'Limite de ruptura', sym: 'σB', unit: 'MPa', type: 'num', def: 630, req: true, gt: 0, max: 3000 },
    { key: 'sy', group: 'material', label: 'Limite de escoamento', sym: 'σS', unit: 'MPa', type: 'num', def: 370, req: true, gt: 0, max: 3000 },
    { key: 'matBasis', group: 'material', label: 'Valores de σB e σS', type: 'select', def: 'peca', span: true, din: true,
      options: [['peca', 'Do certificado, no tamanho da peça (K1 = 1)'], ['norma', 'Da norma no Ø de referência (K1 pelo Ø efetivo)']] },
    { key: 'matGroup', group: 'material', label: 'Grupo do material', type: 'select', def: 'beneficiado', span: true, din: true,
      options: Object.entries(DIN.GROUPS).map(([k, g]) => [k, g.label]) },
    { key: 'deff', group: 'material', label: 'Ø efetivo no tratamento', sym: 'deff', unit: 'mm', type: 'num', def: null, opt: true, gt: 0, max: 5000, din: true, help: 'Vazio = maior Ø do eixo.' },
    { key: 'rz', group: 'material', label: 'Rugosidade', sym: 'Rz', unit: 'µm', type: 'num', def: 6.3, gt: 0, max: 200, din: true, help: 'Torneado fino 6,3 · retificado 1,6–3,2.' },
    { key: 'kv', group: 'material', label: 'Fator de superfície', sym: 'KV', unit: '', type: 'num', def: 1, min: 1, max: 3, din: true, help: '1 sem endurecimento superficial.' },
    { key: 'rDefault', group: 'material', label: 'Raio dos ombros sem cota', sym: 'r/d', unit: '', type: 'num', def: 0.03, gt: 0, max: 0.5, din: true, help: 'Onde o trecho não tem raio; os pontos ficam marcados.' },
    { key: 'loadCase', group: 'material', label: 'Caso de carga', type: 'select', def: 'f2', din: true, options: [['f2', 'Caso 2 · σm/σa constante'], ['f1', 'Caso 1 · σm constante']] },
    { key: 'sMin', group: 'material', label: 'S mínimo (fadiga e escoamento)', sym: 'Smin', unit: '', type: 'num', def: 1.2, min: 1, max: 5, din: true, help: 'DIN 743: 1,2.' },
    { key: 'seMode', group: 'material', label: 'Limite de fadiga', type: 'select', def: 'fixo', span: true, shigley: true,
      options: [['fixo', 'Se informado, já corrigido (como o script)'], ['marin', 'Se por trecho · fatores de Marin']] },
    { key: 'se', group: 'material', label: 'Limite de fadiga corrigido', sym: 'Se', unit: 'MPa', type: 'num', def: 150, gt: 0, max: 2000, shigley: true },
    { key: 'finish', group: 'material', label: 'Acabamento', type: 'select', def: 'usinado', shigley: true, options: Object.entries(FINISH).map(([k, v]) => [k, v[2]]) },
    { key: 'reliab', group: 'material', label: 'Confiabilidade', type: 'select', def: '90', shigley: true, options: Object.keys(RELIAB).map(k => [k, k.replace('.', ',') + ' %']) },
    { key: 'fatigue', group: 'material', label: 'Critério de fadiga', type: 'select', def: 'goodman', shigley: true, options: Object.entries(CRITERIA).map(([k, v]) => [k, v]) },
    { key: 'sfY', group: 'material', label: 'SF mínimo · escoamento', sym: 'SFesc', unit: '', type: 'num', def: 1.5, min: 1, max: 10, shigley: true },
    { key: 'sfF', group: 'material', label: 'SF mínimo · fadiga', sym: 'SFfad', unit: '', type: 'num', def: 2.0, min: 1, max: 10, shigley: true },
    { key: 'E', group: 'material', label: 'Módulo de elasticidade', sym: 'E', unit: 'MPa', type: 'num', def: 210000, gt: 1000, max: 1e6 },
    { key: 'rho', group: 'material', label: 'Densidade', sym: 'ρ', unit: 'kg/m³', type: 'num', def: 7850, gt: 100, max: 30000 },

    { key: 'beam', group: 'mef', label: 'Teoria de viga', type: 'select', def: 'timoshenko', options: [['timoshenko', 'Timoshenko'], ['euler', 'Euler–Bernoulli']], help: 'Timoshenko soma o cisalhamento.' },
    { key: 'mesh', group: 'mef', label: 'Malha', type: 'select', def: 'conforme', options: [['conforme', 'Conforme'], ['uniforme', 'Uniforme']], help: 'Conforme: nó em toda mudança.' },
    { key: 'nElem', group: 'mef', label: 'Número de elementos', sym: 'Ne', unit: 'el.', type: 'int', def: 200, min: 4, max: 2000, help: 'Alvo de 4 a 2.000; a malha ajusta aos nós obrigatórios.' },
    { key: 'convTol', group: 'mef', label: 'Tolerância de convergência', sym: 'tol', unit: '%', type: 'num', def: 0.1, gt: 0, max: 10, help: 'Variação aceita ao dobrar a malha.' },
    { key: 'krFactor', group: 'mef', label: 'Rigidez do contato nos assentos', sym: 'kr', unit: '× πE', type: 'num', def: 1, min: 0.05, max: 20, help: 'Ajuste colado: kr = πE por metro de assento.' },
    { key: 'hubPct', group: 'mef', label: 'Rigidez do cubo', sym: 'c', unit: '%', type: 'num', def: 100, min: 5, max: 100, help: 'Fração do anel Ø cubo × Ø assento na flexão e na torção.' },
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
    { key: 'r', label: 'Raio no fim', unit: 'mm', opt: true, help: 'Raio de concordância do ombro com o trecho seguinte (DIN 743); vazio = r/d padrão' },
    { key: 'kt', label: 'Kt', req: true, shigley: true, help: 'Só no método de Shigley' },
    { key: 'kf', label: 'Kf', req: true, shigley: true, help: 'Só no método de Shigley' },
    { key: 'tpct', label: 'T', unit: '%', opt: true, help: 'Fração do torque no trecho; vazio = caminho calculado' }
  ];
  const KEY_COLS = [
    { key: 'name', label: 'Chaveta', type: 'text', w: 'name' },
    { key: 'x', label: 'Início x', unit: 'mm', opt: true, help: 'Onde o rasgo começa; vazio = sem ponto DIN 743' },
    { key: 'd', label: 'Ø eixo', unit: 'mm', req: true },
    { key: 'b', label: 'Largura', unit: 'mm', req: true },
    { key: 't', label: 'Prof. eixo', unit: 'mm', req: true },
    { key: 'h', label: 'Altura', unit: 'mm', opt: true, help: 'Para a pressão no cubo' },
    { key: 'L', label: 'Compr. útil', unit: 'mm', req: true },
    { key: 'share', label: 'Torque', unit: '%', req: true },
    { key: 'nk', label: 'Qtd.', opt: true, help: 'Rasgos na mesma seção (2 a 180°: β × 1,15); vazio = 1' }
  ];
  const FIT_COLS = [
    { key: 'name', label: 'Assento', type: 'text', w: 'name' },
    { key: 'x', label: 'Início x', unit: 'mm', opt: true, help: 'Onde o assento começa: põe o cubo no modelo e as bordas na DIN 743' },
    { key: 'd', label: 'Ø', unit: 'mm', req: true },
    { key: 'L', label: 'Comprimento', unit: 'mm', req: true },
    { key: 'hub', label: 'Ø ext. cubo', unit: 'mm', opt: true, help: 'Rigidez do cubo no modelo e pressão de Lamé; vazio = 1,6 × Ø (assumido)' },
    { key: 'share', label: 'Torque', unit: '%', req: true, help: 'Parcela do torque se o caminho não for calculado pelo MEF' }
  ];
  const NOTCH_COLS = [
    { key: 'name', label: 'Entalhe', type: 'text', w: 'name' },
    { key: 'x', label: 'Posição x', unit: 'mm', req: true },
    { key: 'bs', label: 'βσ', req: true, help: 'Fator de entalhe na flexão (DIN 743-2, diagramas ou MEF 3D)' },
    { key: 'bt', label: 'βτ', req: true, help: 'Fator de entalhe na torção' }
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
  const S = (name, end, d, kt, kf, o = {}) => ({ name, end, d, di: o.di ?? null, flats: o.flats ?? null, r: o.r ?? null, kt, kf, tpct: o.tpct ?? null });
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
    { name: 'B-B', x: 223, d: 179.960, b: 19.97, t: 7.61, h: null, L: 92, share: 100, nk: null },
    { name: 'C-C A', x: 1295.2, d: 377.876, b: 25.32, t: 13.676, h: null, L: 73, share: 100, nk: null },
    { name: 'C-C B', x: 2638.2, d: 377.876, b: 25.32, t: 13.676, h: null, L: 73, share: 100, nk: null },
    { name: 'G-G', x: 1600, d: 394.000, b: 25.32, t: 13.00, h: null, L: 150, share: 100, nk: null },
    { name: 'ponta X', x: 3619, d: 280.772, b: 62.94, t: 20.87, h: null, L: 400, share: 100, nk: null }
  ];
  const EXAMPLE_FITS = [
    { name: 'W1', x: 1368.2, d: 394.0, L: 498.5, hub: null, share: 100 },
    { name: 'W2', x: 1866.7, d: 395.0, L: 273.1, hub: null, share: 100 },
    { name: 'W3', x: 2139.8, d: 397.0, L: 276.2, hub: null, share: 100 }
  ];
  const EXAMPLE_NOTCHES = [];
  const clone = x => JSON.parse(JSON.stringify(x));
  const EXAMPLE = Object.assign(Object.fromEntries(INPUTS.map(f => [f.key, f.def])), { sections: clone(EXAMPLE_SECTIONS), keys: clone(EXAMPLE_KEYS), fits: clone(EXAMPLE_FITS), notches: clone(EXAMPLE_NOTCHES), meshRefine: [], meshNodes: [] });

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
  const pct = v => fx(v * 100, Math.abs(v) < 0.01 ? 2 : 1) + ' %';

  /* ---- Propriedades da seção -------------------------------------------------------------------- */
  function props(d, di = 0, flats = null) {
    let area = PI * (d * d - di * di) / 4, I = PI * (d ** 4 - di ** 4) / 64;
    if (flats === null || flats === undefined || flats >= d) return { A: area, I, J: 2 * I, rt: d / 2, flat: false };
    // quatro faces planas: área e I exatos; torção pelo círculo inscrito
    const r = d / 2, a = flats / 2, t = Math.acos(a / r);
    area -= 4 * (r * r * t - a * Math.sqrt(r * r - a * a));
    const ix = r ** 4 * (t / 4 - Math.sin(2 * t) / 6 + Math.sin(4 * t) / 48);
    const iy = r ** 4 * (t - Math.sin(4 * t) / 4) / 4;
    I -= 2 * (ix + iy);
    return { A: area, I, J: PI * (flats ** 4 - di ** 4) / 32, rt: flats / 2, flat: true, t, ix, iy };
  }
  // módulos de resistência (mm³) e área para as tensões nominais
  const moduli = s => ({ Wb: s.I / (s.d / 2), Wt: s.J / s.rt, A: s.A });

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
      if (f.gt !== undefined && !(v > f.gt)) { fields[f.key] = `precisa ser maior que ${fx(f.gt, f.gt % 1 ? 2 : 0)}`; continue; }
      if (f.min !== undefined && v < f.min) { fields[f.key] = `mínimo ${fx(f.min, f.min % 1 ? 2 : 0)} ${f.unit || ''}`.trim(); continue; }
      if (f.max !== undefined && v > f.max) { fields[f.key] = `máximo ${fx(f.max, f.max % 1 ? 1 : 0)} ${f.unit || ''}`.trim(); continue; }
      d[f.key] = v;
    }
    const shig = d.strength === 'shigley';
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
      const end = num('end', true), dd = num('d', true);
      let kt = num('kt', shig), kf = num('kf', shig);
      let di = num('di', false), flats = num('flats', false), tpct = num('tpct', false), rr = num('r', false);
      if (end !== null && !(end > start + 1e-9)) bad('end', i ? `precisa passar de ${fx(start, 1)} mm (fim do anterior)` : 'precisa ser maior que zero');
      if (dd !== null && !(dd > 0)) bad('d', 'precisa ser maior que zero');
      if (di !== null && dd !== null && (di < 0 || di >= dd)) bad('di', 'entre 0 e o Ø externo');
      if (flats !== null && dd !== null && (flats <= (di || 0) || flats > dd)) bad('flats', 'maior que o furo e até o Ø externo');
      if (rr !== null && !(rr > 0)) bad('r', 'precisa ser maior que zero');
      if (kt !== null && kt < 1) bad('kt', 'Kt ≥ 1');
      if (kf !== null && kf < 1) bad('kf', 'Kf ≥ 1');
      if (tpct !== null && (tpct < 0 || tpct > 300)) bad('tpct', 'entre 0 e 300 %');
      if (kt === null) kt = 1; if (kf === null) kf = 1;
      if (end !== null && dd !== null && !Object.keys(fields).some(k => k.startsWith(`sec:${i}:`)))
        secs.push({ i, name, code: code(name), a: start, b: end, len: end - start, d: dd, di: di || 0, flats: flats !== null && flats < dd ? flats : null, r: rr, kt, kf, tpct });
      if (end !== null && end > start) start = end;
    });
    const L = secs.length ? secs[secs.length - 1].b : 0;
    const inShaft = (x, bad, k) => { if (L > 0 && (x < 0 || x > L + 1e-9)) { bad(k, `entre 0 e ${fx(L, 1)} mm`); return false; } return true; };
    const keys = [], fits = [], notches = [];
    (Array.isArray(v0.keys) ? v0.keys : []).slice(0, 30).forEach((row, i) => {
      const bad = (k, m) => { fields[`key:${i}:${k}`] = m; };
      const g = (k, req) => { const x = optNum(row[k]); if (x === null) { if (req) bad(k, 'informe'); return null; } if (!isNum(x) || x < 0) { bad(k, 'inválido'); return null; } return x; };
      const k = { i, name: String(row.name ?? '').trim().slice(0, 40) || `Chaveta ${i + 1}`, x: g('x', false), d: g('d', true), b: g('b', true), t: g('t', true), h: g('h', false), L: g('L', true), share: g('share', true), nk: g('nk', false) };
      if (k.d !== null && !(k.d > 0)) bad('d', '> 0');
      if (k.b !== null && !(k.b > 0)) bad('b', '> 0');
      if (k.L !== null && !(k.L > 0)) bad('L', '> 0');
      if (k.t !== null && k.d !== null && !(k.t > 0 && k.t < k.d / 2)) bad('t', 'entre 0 e o raio');
      if (k.h !== null && k.t !== null && !(k.h > k.t)) bad('h', 'maior que a profundidade');
      if (k.share !== null && k.share > 100) bad('share', 'até 100 %');
      if (k.nk !== null && !(k.nk === 1 || k.nk === 2)) bad('nk', '1 ou 2');
      if (k.x !== null && inShaft(k.x, bad, 'x') && k.L !== null && L > 0 && k.x + k.L > L + 1e-6) bad('L', `passa da ponta (x + L > ${fx(L, 1)} mm)`);
      if (!Object.keys(fields).some(x => x.startsWith(`key:${i}:`))) keys.push(k);
    });
    (Array.isArray(v0.fits) ? v0.fits : []).slice(0, 30).forEach((row, i) => {
      const bad = (k, m) => { fields[`fit:${i}:${k}`] = m; };
      const g = (k, req) => { const x = optNum(row[k]); if (x === null) { if (req) bad(k, 'informe'); return null; } if (!isNum(x) || x < 0) { bad(k, 'inválido'); return null; } return x; };
      const f = { i, name: String(row.name ?? '').trim().slice(0, 40) || `Ajuste ${i + 1}`, x: g('x', false), d: g('d', true), L: g('L', true), hub: g('hub', false), share: g('share', true) };
      if (f.d !== null && !(f.d > 0)) bad('d', '> 0');
      if (f.L !== null && !(f.L > 0)) bad('L', '> 0');
      if (f.hub !== null && f.d !== null && !(f.hub > f.d * 1.02)) bad('hub', 'maior que o Ø do assento');
      if (f.share !== null && f.share > 100) bad('share', 'até 100 %');
      if (f.x !== null && inShaft(f.x, bad, 'x') && f.L !== null && L > 0 && f.x + f.L > L + 1e-6) bad('L', `passa da ponta (x + L > ${fx(L, 1)} mm)`);
      if (!Object.keys(fields).some(x => x.startsWith(`fit:${i}:`))) fits.push(f);
    });
    // assentos não podem se sobrepor (podem encostar)
    const placed = fits.filter(f => f.x !== null).sort((a, b) => a.x - b.x);
    for (let k = 1; k < placed.length; k++) if (placed[k].x < placed[k - 1].x + placed[k - 1].L - 0.5) fields[`fit:${placed[k].i}:x`] = `sobrepõe o assento ${placed[k - 1].name}`;
    (Array.isArray(v0.notches) ? v0.notches : []).slice(0, 40).forEach((row, i) => {
      const bad = (k, m) => { fields[`not:${i}:${k}`] = m; };
      const g = k => { const x = optNum(row[k]); if (x === null) { bad(k, 'informe'); return null; } if (!isNum(x)) { bad(k, 'número inválido'); return null; } return x; };
      const n = { i, name: String(row.name ?? '').trim().slice(0, 40) || `Entalhe ${i + 1}`, x: g('x'), bs: g('bs'), bt: g('bt') };
      if (n.x !== null) inShaft(n.x, bad, 'x');
      if (n.bs !== null && n.bs < 1) bad('bs', 'βσ ≥ 1');
      if (n.bt !== null && n.bt < 1) bad('bt', 'βτ ≥ 1');
      if (!Object.keys(fields).some(x => x.startsWith(`not:${i}:`))) notches.push(n);
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
    d.secs = secs; d.L = L; d.keys = keys; d.fits = fits; d.notches = notches; d.meshRefine = refine; d.meshNodes = meshNodes;
    return d;
  }

  /* ---- Pacote, assentos e cargas -------------------------------------------------------------------- */
  // faixa do pacote (massa e saída do torque); vale mesmo sem massa, se a faixa for válida
  function coreOf(d) {
    const ok = d.rotorTo > d.rotorFrom, len = ok ? d.rotorTo - d.rotorFrom : 0;
    return { ok, has: ok && d.rotorMass > 0, a: d.rotorFrom, b: d.rotorTo, len, m: d.rotorMass, kgPerMm: ok && d.rotorMass > 0 ? d.rotorMass / len : 0 };
  }
  // assentos que levam o pacote: os ajustes com posição que tocam a faixa do pacote
  function seatPlan(d, core) {
    const missing = d.fits.filter(f => f.x === null);
    if (d.mount !== 'assentos') return { mode: 'distribuido', reason: 'escolha', missing, seats: [] };
    if (!core.ok) return { mode: 'distribuido', reason: 'sem pacote', missing, seats: [] };
    const placed = d.fits.filter(f => f.x !== null);
    const onCore = placed.filter(f => f.x <= core.b + 1e-6 && f.x + f.L >= core.a - 1e-6);
    if (!onCore.length) return { mode: 'distribuido', reason: missing.length ? 'sem posição' : 'sem assento no pacote', missing, seats: [] };
    const seats = onCore.map(f => ({ a: f.x, b: f.x + f.L, d: f.d, Dh: f.hub || 1.6 * f.d, DhAssumed: !f.hub, name: f.name, fit: f.i, L: f.L }));
    return { mode: 'assentos', seats, a: Math.min(core.a, ...seats.map(s => s.a)), b: Math.max(core.b, ...seats.map(s => s.b)), missing, others: placed.filter(f => !onCore.includes(f)) };
  }
  // inércia diametral do pacote por metro (kg·m²/m): m′·(De² + Di²)/16
  const coreJ = (d, core, plan) => {
    if (!d.rotorOD || !core.has) return 0;
    const Di = plan.seats.length ? plan.seats.reduce((a, s) => a + s.d, 0) / plan.seats.length : Math.max(...d.secs.filter(s => s.b > core.a && s.a < core.b).map(s => s.d));
    const De = Math.max(d.rotorOD, Di * 1.01) / 1000;
    return core.kgPerMm * 1000 * (De * De + (Di / 1000) ** 2) / 16;
  };
  // cargas do modelo distribuído (método analítico e MEF sem cubo): N/mm e N
  function loadsOf(d, secs, core) {
    const dist = secs.map(s => ({ a: s.a, b: s.b, q: -s.A * 1e-9 * d.rho * G0, kind: 'peso', sec: s.i }));
    if (core.has) dist.push({ a: core.a, b: core.b, q: -core.m * G0 / core.len, kind: 'rotor' });
    const xc = d.coupleEnd === 'left' ? 0 : d.L, Fmag = -d.ump * G0, magDist = d.umpDist === 'distribuida' && core.ok;
    const point = [{ x: xc, F: d.coupleF * 1000, kind: 'acop' }];
    if (magDist) dist.push({ a: core.a, b: core.b, q: Fmag / core.len, kind: 'mag' });
    else point.push({ x: d.xUmp, F: Fmag, kind: 'mag' });
    return { dist, point, xc, magDist };
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
    // integra M/(E·I) e corrige a reta para flecha zero nos dois mancais (método do script)
    const grid = [];
    for (let k = 0; k < Math.ceil(d.L / 10); k++) grid.push(k * 10.0);
    const mesh = [...new Set(grid.concat([d.L, d.xA, d.xB], secs.map(s => s.a), secs.map(s => s.b), loads.point.map(p => p.x)))].sort((a, b) => a - b);
    let y = 0, th = 0, sec = 0;
    const raw = [0], thr = [0];
    for (let i = 0; i < mesh.length - 1; i++) {
      const a = mesh[i], b = mesh[i + 1], xm = (a + b) / 2;
      while (xm > secs[sec].b) sec++;
      const dx = b - a, k = M(xm) / (d.E * secs[sec].I);
      y += th * dx + k * dx * dx / 2;
      th += k * dx;
      raw.push(y); thr.push(th);
    }
    const ia = mesh.indexOf(d.xA), ib = mesh.indexOf(d.xB);
    const ya = raw[ia], yb = raw[ib], incl = (yb - ya) / (d.xB - d.xA);
    return { mesh, y: mesh.map((x, i) => raw[i] - ya - incl * (x - d.xA)), th: thr.map(t => t - incl), ia, ib };
  }

  /* ---- Shigley por trecho (método alternativo) ---------------------------------------------------------- */
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
    const p = props(diam, di, rel ? diam * rel : null);
    const sb = Math.abs(m) * diam / (2 * p.I);
    const tau = t * 1000 * p.rt / p.J;
    const sax = Math.abs(d.axialF * 1000) / p.A;
    const vm = Math.hypot(sax + kt * sb, SQ3 * kt * d.peak * tau);
    const sa = kf * sb, sm = Math.hypot(sax, SQ3 * kf * tau);
    const se = seOf(d, diam);
    return { p, sb, tau, sax, vm, sa, sm, se, sfy: vm ? d.sy / vm : Infinity, sff: fatigueN(d.fatigue, sa, sm, se.se, d.su, d.sy) };
  }
  function dMin(d, s, m, t) {
    const rel = s.flats ? s.flats / s.d : null;
    const target = x => { const z = stressAt(d, x, s.di, rel, m, t, s.kt, s.kf); return z.sfy >= d.sfY && z.sff >= d.sfF; };
    let lo = Math.max(1.0, s.di / (rel || 1) + 0.01), hi = Math.max(s.d, lo * 1.1);
    for (let k = 0; k < 80 && !target(hi); k++) hi *= 1.5;
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (target(mid)) hi = mid; else lo = mid; }
    return hi;
  }
  // maior |M| de um trecho entre as amostras (x, M em N·mm)
  function mAtSamples(xs, Ms) {
    return s => {
      let m = 0, xm = s.a;
      for (let i = 0; i < xs.length; i++) if (xs[i] >= s.a - 1e-7 && xs[i] <= s.b + 1e-7 && Math.abs(Ms[i]) > m) { m = Math.abs(Ms[i]); xm = xs[i]; }
      return { m, xm };
    };
  }
  function mAtAnalytic(d, loads, M) {
    return s => {
      const n = Math.max(1, Math.ceil((s.b - s.a) / 10)), xs = [];
      for (let k = 0; k <= n; k++) xs.push(s.a + (s.b - s.a) * k / n);
      for (const p of loads.point) if (p.x >= s.a && p.x <= s.b) xs.push(p.x);
      for (const x of [d.xA, d.xB]) if (x >= s.a && x <= s.b) xs.push(x);
      let m = 0, xm = s.a;
      for (const x of xs) { const v = Math.abs(M(x)); if (v > m) { m = v; xm = x; } }
      return { m, xm };
    };
  }
  function shigleySections(d, secs, mAt, Tsec) {
    return secs.map(s => {
      const { m, xm } = mAt(s);
      let tl = 0;
      for (const x of [s.a, s.b, (s.a + s.b) / 2]) tl = Math.max(tl, Math.abs(Tsec(s, x)));
      const rel = s.flats ? s.flats / s.d : null;
      const z = stressAt(d, s.d, s.di, rel, m, tl, s.kt, s.kf);
      const dmin = dMin(d, s, m, tl);
      const ok = z.sfy >= d.sfY && z.sff >= d.sfF;
      const uy = d.sfY / z.sfy, uf = d.sfF / z.sff, util = Math.max(uy, uf);
      const lim = d.sy / d.sfY, base = z.sax + s.kt * z.sb;
      const fpkAdm = z.tau > 0 ? (lim > base ? Math.sqrt(lim * lim - base * base) / (SQ3 * s.kt * z.tau) : 0) : Infinity;
      const q = s.kt > 1 ? (s.kf - 1) / (s.kt - 1) : NaN;
      return Object.assign({}, s, { m, xm, torque: tl, sb: z.sb, tau: z.tau, sax: z.sax, vm: z.vm, sa: z.sa, sm: z.sm,
        se: z.se.se, seInfo: z.se, sfy: z.sfy, sff: z.sff, dmin, ok, uy, uf, util, gov: uy >= uf ? 'esc' : 'fad', fpkAdm, q, points: [] });
    });
  }

  /* ---- Elementos finitos: modelo, estática, torção e dinâmica ------------------------------------------ */
  const springsOf = d => d.kBearing ? [d.kBearing * 1e6, d.kBearing * 1e6] : null;   // kN/mm → N/m
  const overlapFrac = (x0, x1, a, b) => Math.max(0, Math.min(x1, b) - Math.max(x0, a)) / (x1 - x0);
  // o.scale: fator sobre a malha do usuário; o.plain: sem refinos nem nós pedidos; o.mount: força a montagem (comparação)
  function feModel(d, secs, loads, n, mesh, o = {}) {
    const core = coreOf(d), plan0 = seatPlan(d, core), plan = o.mount === 'distribuido' ? { mode: 'distribuido', reason: 'comparação', seats: [], missing: [] } : plan0;
    const kMag = d.gap && d.ump > 0 && core.ok ? d.ump * G0 / (d.gap * d.umpEcc / 100) : 0;   // N/mm
    const scale = o.scale ?? (n ? n / d.nElem : 1), Jpm = coreJ(d, core, plan), onHub = plan.mode === 'assentos';
    const geo = {
      L: d.L, E: d.E, nu: NU, rho: d.rho, bearings: [d.xA, d.xB], mesh: mesh || d.mesh, n: n || d.nElem, snap: MESH_SNAP,
      nodes: o.plain ? [] : (d.meshNodes || []).map(p => p.x),
      refine: o.plain ? [] : (d.meshRefine || []).map(z => ({ a: z.a, b: z.b, h: scale > 0 ? z.h / scale : Infinity })),
      secs: secs.map(s => ({ a: s.a, b: s.b, A: s.A, I: s.I, J: s.J, di: s.di, d: s.d })),
      addMass: !onHub && core.has ? [{ a: core.a, b: core.b, kgPerMm: core.kgPerMm }] : [],
      addRot: !onHub && Jpm ? [{ a: core.a, b: core.b, Jpm }] : [],
      points: loads.point.map(p => p.x), breaks: [d.xUmp, loads.xc].concat(core.ok ? [core.a, core.b] : []),
      foundation: !onHub && kMag ? [{ a: core.a, b: core.b, kPerMm: -kMag / core.len }] : [],
      hub: onHub ? { a: plan.a, b: plan.b, seats: plan.seats, c: d.hubPct / 100, kr: d.krFactor, kt: d.krFactor,
        mass: core.has ? [{ a: core.a, b: core.b, kgPerMm: core.kgPerMm }] : [], rot: Jpm ? [{ a: core.a, b: core.b, Jpm }] : [],
        foundation: kMag ? [{ a: core.a, b: core.b, kPerMm: -kMag / core.len }] : [] } : null
    };
    const model = FEM.buildModel(geo);
    Object.assign(model, { kMag, core, plan, Jpm });
    return model;
  }
  // cargas de gravidade (e força magnética distribuída) no eixo e no cubo
  function feLoads(d, loads, model, gravityOnly = false) {
    const hub = model.hub, mag = !gravityOnly && loads.dist.find(q => q.kind === 'mag');
    const qMag = mag ? mag.q * 1000 : 0;                                              // N/m
    const q = (xm, el) => -(el.rhoA + el.mAdd) * G0 + (!hub && mag ? qMag * overlapFrac(el.x0, el.x1, mag.a, mag.b) : 0);
    const qh = hub ? (xm, h) => -h.m * G0 + (mag ? qMag * overlapFrac(h.x0, h.x1, mag.a, mag.b) : 0) : null;
    const points = gravityOnly ? [] : loads.point.filter(p => p.F).map(p => ({ x: p.x, F: p.F, on: p.kind === 'mag' && hub && p.x >= hub.a && p.x <= hub.b ? 'hub' : 'shaft' }));
    return { q, qh, points };
  }
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
  // divisão da carga do pacote entre os assentos, a partir da pressão de contato do MEF
  function seatResults(d, model, st) {
    return model.hub.seats.map((s, k) => {
      let F = 0, Fx = 0, qmax = 0, qsign = 0;
      for (const c of st.contactP) {
        if (c.seat !== k) continue;
        const [a0, a1, a2, a3] = c.pc, L = c.L;
        const i0 = L * (a0 + a1 / 2 + a2 / 3 + a3 / 4), i1 = L * (a0 / 2 + a1 / 3 + a2 / 4 + a3 / 5);
        F += i0; Fx += i0 * c.x0 + i1 * (c.x1 - c.x0);
        for (const xi of [0, 0.25, 0.5, 0.75, 1]) { const p = a0 + a1 * xi + a2 * xi * xi + a3 * xi ** 3; if (Math.abs(p) > qmax) { qmax = Math.abs(p); qsign = Math.sign(p); } }
      }
      const q = qmax / 1000;                                                          // N/mm
      const xc = F ? Fx / F : NaN, xm = (s.a + s.b) / 2;
      // resultante: força e momento em torno do meio do assento (com pressão de um só sinal, também a posição)
      return { k, name: s.name, a: s.a, b: s.b, L: s.L, d: s.d, Dh: s.Dh, DhAssumed: s.DhAssumed, fit: s.fit, F: -F, Mc: -(Fx - F * xm) / 1e6, xc: xc >= s.a - 1e-6 && xc <= s.b + 1e-6 ? xc : NaN, qmax: q, qsign, p0: 2 * q / (PI * s.d) };
    });
  }
  // estática por MEF com o modelo dado: reações, M e V recuperados, deformada interpolada e carga nos assentos
  function feStatic(d, secs, loads, model, shear = d.beam !== 'euler') {
    const L = feLoads(d, loads, model);
    const st = FEM.staticSolve(model, { q: L.q, qh: L.qh, points: L.points, springs: springsOf(d), shear });
    if (!st) return { ok: false };
    const dx = st.diag.x, dM = st.diag.M.map(m => m * 1000), dV = st.diag.V;                  // N·mm, N
    const px = st.plot.x, yv = st.plot.v.map(v => v * 1000);                                   // mm
    const series = {
      v: dx.map((x, i) => [x, dV[i] / 1000]), m: dx.map((x, i) => [x, dM[i] / 1e6]),
      y: px.map((x, i) => [x, yv[i]]), th: px.map((x, i) => [x, st.plot.th[i] * 1000])
    };
    if (model.hub) series.mh = st.hubDiag.x.map((x, i) => [x, st.hubDiag.M[i] / 1000]);       // momento no cubo (kN·m)
    const mAtX = x => { let b = 0; for (let i = 0; i < dx.length; i++) if (Math.abs(dx[i] - x) < Math.abs(dx[b] - x)) b = i; return dM[b]; };
    const Mmax = series.m.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a, [0, 0]);
    const nodes = { x: model.xs, v: st.v.map(v => v * 1000), th: st.th.map(t => t * 1000), M: Array.from(st.nodal.M, m => m / 1000), Vl: Array.from(st.nodal.Vl, v => v / 1000), Vr: Array.from(st.nodal.Vr, v => v / 1000),
      user: (d.meshNodes || []).map((p, k) => ({ name: p.name, x: p.x, idx: model.userNodes[k], at: model.xs[model.userNodes[k]] })) };
    const out = { ok: true, model, st, info: model.info, shear, RA: st.R[0], RB: st.R[1], residual: st.residual, series, dx, dM, dV, Mmax, nodes,
      defl: deflStats(d, px, yv, st.plot.th), mAt: mAtSamples(dx, dM), mAtX };
    if (model.hub) {
      out.seats = seatResults(d, model, st);
      let W = 0; model.hubElems.forEach((h, e) => { if (h) W += st.qh[e] * h.L; }); st.Ph.forEach(p => { W += p; });
      out.Wcore = -W;                                                                    // carga vertical aplicada no cubo (N, para baixo)
      out.seats.forEach(s => { s.share = out.Wcore ? s.F / out.Wcore : NaN; });
    }
    return out;
  }
  // M(x) por interpolação das amostras do MEF (N·mm)
  function interpAt(xs, ys, x) {
    let lo = 0, hi = xs.length - 1;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[hi]) return ys[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    return xs[hi] === xs[lo] ? ys[hi] : ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo]);
  }
  // caminho do torque por MEF de torção: entra no acoplamento, sai no pacote (pelo cubo, se houver) e na ponta oposta (auxiliar)
  function torquePath(d, r, model) {
    const nn = model.nNodes, core = model.core, aux = d.auxTorque / 100, T = r.T, s = d.coupleEnd === 'left' ? 1 : -1;
    const iC = d.coupleEnd === 'left' ? 0 : nn - 1, iF = nn - 1 - iC;
    const nodal = [{ node: iC, T: s * T }], dist = [];
    if (aux > 0) nodal.push({ node: iF, T: -s * aux * T });
    if (core.ok) dist.push({ a: core.a, b: core.b, T: -s * (1 - aux) * T, on: model.hub ? 'hub' : 'shaft' });
    else nodal.push({ node: model.near(d.xUmp), T: -s * (1 - aux) * T });
    const t = FEM.torsionSolve(model, { nodal, dist, fix: iC });
    if (!t) return null;
    const xs = model.xs, Tl = t.Tl, Tr = t.Tr;
    const Tat = x => {
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
      if (Math.abs(x - xs[lo]) < 1e-6) return Math.max(Math.abs(Tl[lo]), Math.abs(Tr[lo]));
      if (Math.abs(x - xs[hi]) < 1e-6) return Math.max(Math.abs(Tl[hi]), Math.abs(Tr[hi]));
      const w = (x - xs[lo]) / (xs[hi] - xs[lo]);
      return Math.abs(Tr[lo] * (1 - w) + Tl[hi] * w);
    };
    const series = [];
    for (let i = 0; i < nn; i++) {
      if (i > 0) series.push([xs[i], Tl[i] / 1000]);
      if (i < nn - 1 && (i === 0 || Math.abs(Tr[i] - Tl[i]) > 1e-9 * Math.max(1, Math.abs(T)))) series.push([xs[i], Tr[i] / 1000]);
    }
    // torque no cubo (kN·m) onde ele existe
    const hubSeries = [];
    if (model.hub) for (let i = 0; i < nn; i++) if (model.hubAt[i]) { hubSeries.push([xs[i], t.hTl[i] / 1000]); if (Math.abs(t.hTr[i] - t.hTl[i]) > 1e-9 * Math.max(1, Math.abs(T))) hubSeries.push([xs[i], t.hTr[i] / 1000]); }
    // giro entre o acoplamento e o pacote (rad): média do giro do cubo (ou do eixo) na faixa do pacote
    let sum = 0, cnt = 0;
    for (let i = 0; i < nn; i++) if (core.ok && xs[i] >= core.a - 1e-6 && xs[i] <= core.b + 1e-6) { sum += model.hub && model.hubAt[i] ? t.phh[i] : t.phi[i]; cnt++; }
    const twist = cnt ? Math.abs(sum / cnt - t.phi[iC]) : Math.abs(t.phi[iF] - t.phi[iC]);
    const seats = model.hub ? model.hub.seats.map((z, k) => ({ name: z.name, T: s * t.seatT[k], share: (s * t.seatT[k]) / ((1 - aux) * T) })) : [];
    return { ok: true, t, Tat, series, hubSeries, twist, seats, iC, iF, s, aux, closure: t.end, Tmax: Math.max(...series.map(p => Math.abs(p[1]))) * 1000 };
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
    const g = feLoads(d, r.loads, model, true);
    const grav = FEM.staticSolve(model, { q: g.q, qh: g.qh, shear });
    out.rayleigh = grav ? FEM.rpmOf(grav.rayleighW2) : NaN;
    if (opts.map) out.map = FEM.criticalMap(model, { q: 3, foundation: false });
    return out;
  }

  /* ---- DIN 743: pontos de verificação ------------------------------------------------------------------- */
  function dinMaterial(d) {
    const maxD = Math.max(...d.secs.map(s => s.d));
    return { sB: d.su, sS: d.sy, basis: d.matBasis, group: d.matGroup, deff: d.deff || maxD, deffAuto: !d.deff };
  }
  const dinOpts = d => ({ Rz: d.rz, KV: d.kv, lc: d.loadCase === 'f1' ? 1 : 2, ripple: d.ripple / 100, peak: d.peak, Smin: d.sMin });
  // pontos: ombros (nas mudanças de Ø), rasgos de chaveta, bordas livres dos ajustes, entalhes informados e a seção lisa de cada trecho
  function dinPoints(d, r, Tsec) {
    const secs = r.secsP, F = d.axialF * 1000, xs = r.fe && r.fe.ok ? r.fe.dx : null, Mfn = r.Mfn;
    const mat = dinMaterial(d), opt = dinOpts(d), pts = [];
    const secIdx = (x, side = 0) => {
      let k = secs.findIndex(s => x > s.a + 1e-6 && x < s.b - 1e-6);
      if (k >= 0) return k;
      k = secs.findIndex(s => Math.abs(x - (side > 0 ? s.a : s.b)) < 1e-6);
      if (k >= 0) return k;
      return Math.max(0, secs.findIndex(s => x >= s.a - 1e-6 && x <= s.b + 1e-6));
    };
    const sv = (s, x) => { const W = moduli(s), M = Mfn(x), T = Tsec(s, x); return Math.hypot(M / W.Wb, SQ3 * T * 1000 / W.Wt); };
    const cands = (a, b) => { const c = [a, b]; if (xs) for (const x of xs) if (x > a && x < b) c.push(x); return c; };
    const push = p => {
      const s = secs[p.sec], W = moduli(s), M = Mfn(p.x), T = Tsec(s, p.x);
      const res = DIN.evaluate({ kind: p.kind, d: s.d, di: s.di, D: p.D, r: p.r, nk: p.nk, bs: p.bs, bt: p.bt, Wb: W.Wb, Wt: W.Wt, A: W.A, M, T, F }, mat, opt);
      pts.push(Object.assign(p, { id: pts.length, code: s.code, d: s.d, M, T, res, SD: res.SD, SF: res.SF, util: res.util, ok: res.ok }));
    };
    for (let i = 0; i < secs.length - 1; i++) {
      const a = secs[i], b = secs[i + 1];
      if (Math.abs(a.d - b.d) < 0.05) continue;
      const small = a.d < b.d ? a : b, big = a.d < b.d ? b : a;
      push({ kind: 'ombro', x: a.b, sec: small.i, D: big.d, r: a.r !== null ? a.r : d.rDefault * small.d, rAssumed: a.r === null, name: `Ombro ${a.code}/${b.code}`, at: `${a.code}|${b.code}` });
    }
    for (const k of d.keys) {
      if (k.x === null) continue;
      const a = k.x, b = Math.min(d.L, k.x + k.L);
      let best = null, bv = -1;
      for (const x of cands(a, b)) { const si = secIdx(x, x === a ? 1 : x === b ? -1 : 0), v = sv(secs[si], x); if (v > bv) { bv = v; best = { x, si }; } }
      push({ kind: 'chaveta', x: best.x, sec: best.si, nk: k.nk || 1, name: `Chaveta ${k.name}`, key: k.i, range: [a, b] });
    }
    for (const f of d.fits) {
      if (f.x === null) continue;
      for (const [edge, side, lab] of [[f.x, 1, 'esq.'], [f.x + f.L, -1, 'dir.']]) {
        const touching = d.fits.some(g => g !== f && g.x !== null && (Math.abs(g.x + g.L - edge) < 1 || Math.abs(g.x - edge) < 1));
        if (touching || edge <= 1e-6 || edge >= d.L - 1e-6) continue;
        push({ kind: 'ajuste', x: edge, sec: secIdx(edge + side * 1e-3, side), name: `Ajuste ${f.name} · borda ${lab}`, fit: f.i });
      }
    }
    for (const n of d.notches) push({ kind: 'manual', x: n.x, sec: secIdx(n.x), bs: n.bs, bt: n.bt, name: `Entalhe ${n.name}`, notch: n.i });
    for (const s of secs) {
      let best = s.a, bv = -1;
      for (const x of cands(s.a, s.b)) { const v = sv(s, x); if (v > bv) { bv = v; best = x; } }
      push({ kind: 'liso', x: best, sec: s.i, name: `${s.code} · seção lisa` });
    }
    return pts;
  }
  // visão por trecho dos pontos DIN 743: o pior ponto de cada trecho
  function dinSections(d, secs, pts) {
    const Smin = d.sMin;
    return secs.map(s => {
      const mine = pts.filter(p => p.sec === s.i);
      const minSF = Math.min(...mine.map(p => p.SF)), minSD = Math.min(...mine.map(p => p.SD));
      const worst = mine.reduce((a, p) => p.util > a.util ? p : a, mine[0]);
      const uy = Smin / minSF, uf = Smin / minSD, util = Math.max(uy, uf), R = worst.res;
      return Object.assign({}, s, { points: mine.map(p => p.id), worst: worst.id, m: Math.abs(worst.M), xm: worst.x, torque: Math.abs(worst.T),
        sb: R.s.sba, tau: R.s.ttm, sax: Math.abs(R.s.szdm), vm: Math.hypot(R.s.sba + Math.abs(R.s.szdm), SQ3 * R.s.ttm), sa: R.s.sba, sm: R.mv.s, se: R.ADK.b.v,
        sfy: minSF, sff: minSD, uy, uf, util, ok: util <= 1, gov: uy >= uf ? 'esc' : 'fad',
        dmin: Math.max(...mine.map(p => p.res.dReq)), fpkAdm: Math.min(...mine.map(p => p.res.peakAdm)), q: NaN });
    });
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
    // seções, pacote e cargas
    const secs = d.secs.map(s => Object.assign(s, props(s.d, s.di, s.flats)));
    r.secsP = secs;
    r.core = coreOf(d);
    r.plan = seatPlan(d, r.core);
    r.loads = loadsOf(d, secs, r.core);
    r.strength = d.strength === 'shigley' ? { method: 'shigley', label: 'Shigley', y: 'SF esc.', f: 'SF fad.', minY: d.sfY, minF: d.sfF } : { method: 'din743', label: 'DIN 743', y: 'S_F', f: 'S_D', minY: d.sMin, minF: d.sMin };
    // massas
    const mShaft = secs.reduce((a, s) => a + s.len * s.A * 1e-9 * d.rho, 0);
    const mxShaft = secs.reduce((a, s) => a + s.len * s.A * 1e-9 * d.rho * (s.a + s.b) / 2, 0);
    const mRot = d.rotorMass, xRot = (d.rotorFrom + d.rotorTo) / 2;
    r.mass = { shaft: mShaft, rotor: mRot, total: mShaft + mRot, cg: (mxShaft + mRot * xRot) / (mShaft + mRot), shaftCg: mxShaft / mShaft };
    // solução analítica do modelo distribuído (superposição e dupla integração): referência e comparação
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
    // elementos finitos com a malha escolhida (eixo + cubo nos assentos)
    const model = feModel(d, secs, r.loads);
    if (model.info.ne > MAX_ELEMS) throw new InputError([`A malha passaria de ${fx(MAX_ELEMS, 0)} elementos (${fx(model.info.ne, 0)}): aumente o h dos refinos ou reduza o número de elementos.`], { nElem: 'malha grande demais com os refinos' });
    r.fe = feStatic(d, secs, r.loads, model);
    if (!r.fe.ok) r.fe.model = model;
    else {
      // a outra teoria de viga na mesma malha: separa o efeito do cisalhamento
      const o = feStatic(d, secs, r.loads, model, !r.fe.shear);
      if (o.ok) r.fe.other = { shear: o.shear, RA: o.RA, RB: o.RB, Mmax: o.Mmax, defl: o.defl, MA: o.mAtX(d.xA), MB: o.mAtX(d.xB), seats: o.seats };
      // pacote nos assentos: o mesmo eixo com o pacote distribuído, para mostrar o que o cubo muda
      if (model.hub) {
        const md = feModel(d, secs, r.loads, null, null, { mount: 'distribuido' }), fd = feStatic(d, secs, r.loads, md);
        if (fd.ok) r.fe.dist = { RA: fd.RA, RB: fd.RB, Mmax: fd.Mmax, defl: fd.defl, series: fd.series, mAt: fd.mAt, MA: fd.mAtX(d.xA), MB: fd.mAtX(d.xB) };
      }
    }
    const useFE = r.fe && r.fe.ok;
    r.method = useFE ? 'mef' : 'analitico';
    const use = useFE ? r.fe : an;
    Object.assign(r, { RA: use.RA, RB: use.RB, Fy: R.fy });
    r.Mfn = useFE ? (x => Math.abs(interpAt(r.fe.dx, r.fe.dM, x))) : (x => Math.abs(M(x)));
    r.seats = useFE && r.fe.seats ? r.fe.seats : [];
    // torção por MEF (sempre: dá a divisão do torque nos assentos); o modo escolhe o torque da resistência
    r.tor = useFE ? torquePath(d, r, model) : null;
    if (r.tor && r.seats.length) r.seats.forEach((s, k) => { s.T = r.tor.seats[k].T; s.Tshare = r.tor.seats[k].share; });
    const Tfor = mode => (mode === 'mef' && r.tor ? r.tor.Tat : () => r.T);
    const TsecOf = Tfn => (s, x) => (s.tpct !== null && s.tpct !== undefined ? r.T * s.tpct / 100 : Tfn(x));
    r.Tfn = Tfor(d.torqueMode);
    // resistência
    if (r.strength.method === 'din743') {
      r.din = dinPoints(d, r, TsecOf(r.Tfn));
      r.res = dinSections(d, secs, r.din);
    } else {
      r.din = [];
      r.res = shigleySections(d, secs, use.mAt, TsecOf(r.Tfn));
    }
    r.fails = r.res.filter(s => !s.ok);
    r.crit = r.res.reduce((a, s) => s.util > a.util ? s : a, r.res[0]);
    r.fpkAdm = r.res.reduce((a, s) => s.fpkAdm < a.v ? { v: s.fpkAdm, s } : a, { v: Infinity, s: null });
    r.dinFails = r.din.filter(p => !p.ok);
    r.dinCrit = r.din.length ? r.din.reduce((a, p) => p.util > a.util ? p : a, r.din[0]) : null;
    // o outro modo de torque (comparação)
    const altMode = d.torqueMode === 'mef' ? 'integral' : 'mef';
    if (r.tor || altMode === 'integral') {
      const Ta = TsecOf(Tfor(altMode));
      const altRes = r.strength.method === 'din743' ? dinSections(d, secs, dinPoints(d, r, Ta)) : shigleySections(d, secs, use.mAt, Ta);
      r.alt = { mode: altMode, fails: altRes.filter(s => !s.ok).map(s => s.code), worst: altRes.reduce((a, s) => s.util > a.util ? s : a, altRes[0]) };
    } else r.alt = { mode: altMode, fails: r.fails.map(s => s.code), worst: r.crit };
    // diagramas e deformada; torque do caminho escolhido
    let tS;
    if (d.torqueMode === 'mef' && r.tor) tS = r.tor.series.slice();
    else { tS = []; for (const s of secs) { tS.push([s.a, r.T / 1000]); tS.push([s.b, r.T / 1000]); } }
    if (secs.some(s => s.tpct !== null && s.tpct !== undefined)) {
      tS = [];
      for (const s of secs) {
        const xsT = r.tor && d.torqueMode === 'mef' ? [s.a, ...r.tor.series.map(p => p[0]).filter(x => x > s.a && x < s.b), s.b] : [s.a, s.b];
        for (const x of xsT) tS.push([x, (s.tpct !== null && s.tpct !== undefined ? r.T * s.tpct / 100 : r.Tfn(x)) / 1000]);
      }
    }
    r.series = Object.assign({}, use.series, { t: tS });
    r.defl = use.defl;
    // esforços máximos
    const mm = useFE ? r.fe.Mmax : an.Mmax;
    r.Mmax = { v: mm[1] * 1e6, x: mm[0], sec: r.res.find(s => mm[0] >= s.a && mm[0] <= s.b) };
    r.MA = use.mAtX(d.xA); r.MB = use.mAtX(d.xB);
    const vm = r.series.v.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a, [0, 0]);
    r.Vmax = { v: vm[1] * 1000, x: vm[0] };
    // torção: giro do acoplamento ao pacote
    const Gm = d.E / (2 * (1 + NU));
    if (r.tor) r.twist = r.tor.twist;
    else { let phi = 0; for (const s of secs) phi += r.T * 1000 * s.len / (Gm * s.J); r.twist = phi; }
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
      let Tshaft = NaN;
      if (k.x !== null) { Tshaft = 0; for (let x = k.x; x <= Math.min(d.L, k.x + k.L) + 1e-9; x += Math.max(1, k.L / 20)) Tshaft = Math.max(Tshaft, Math.abs(r.Tfn(x))); }
      return Object.assign({}, k, { T, F, Fpk, tau, pS, pH, sfT, sfP, sfH, sf, Tshaft, ok: sf >= (r.strength.method === 'din743' ? Math.max(d.sMin, 1.5) : d.sfY) });
    });
    // ajustes por interferência: torque do MEF nos assentos do pacote; parcela informada nos demais
    const Es = d.E, Eh = d.E, sfFit = r.strength.method === 'din743' ? Math.max(d.sMin, 1.5) : d.sfY;
    r.fitRes = d.fits.map(f => {
      const seat = r.seats.find(s => s.fit === f.i), byFE = !!(seat && isNum(seat.T));
      const T = byFE ? Math.abs(seat.T) : r.T * f.share / 100;
      const pReq = 2 * T / (d.mu * PI * (f.d / 1000) ** 2 * (f.L / 1000)) / 1e6;
      const o = Object.assign({}, f, { T, byFE, pReq, pReqPk: pReq * d.peak, seat });
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
        o.ok = o.sfN >= sfFit && o.sfPk >= 1 && o.hubSf >= sfFit;
        if (seat) { o.openN = seat.p0 > o.pN; o.sepMargin = o.pN / Math.max(1e-9, seat.p0); }
      }
      return o;
    });
    // sensibilidade da divisão nos assentos (rigidez do contato e do cubo) e conferência da malha
    if (!opts.lite) {
      r.dyn = dynamics(d, r, opts);
      if (useFE && model.hub) {
        const nc1 = m => { const c = FEM.criticals(m, { q: 1, springs: springsOf(d), foundation: false, shear: d.beam !== 'euler' }); return c.ok ? c.rpm[0] : NaN; };
        const run = (kr, c) => { const dd = Object.assign({}, d, { krFactor: kr, hubPct: c }); const m = feModel(dd, secs, r.loads), f = feStatic(dd, secs, r.loads, m); return f.ok ? { kr, c, seats: f.seats.map(s => s.F), Mmax: Math.abs(f.Mmax[1]), Mcore: maxIn(f.series.m, r.plan.a, r.plan.b), nc1: nc1(m), span: f.defl.span } : null; };
        const maxIn = (ser, a, b) => ser.reduce((m, p) => p[0] >= a && p[0] <= b && Math.abs(p[1]) > m ? Math.abs(p[1]) : m, 0);
        const base0 = (r.dyn.flex || r.dyn.rigid), md = feModel(d, secs, r.loads, null, null, { mount: 'distribuido' });
        r.sens = { base: { kr: d.krFactor, c: d.hubPct, seats: r.seats.map(s => s.F), Mmax: Math.abs(r.fe.Mmax[1]), Mcore: maxIn(r.fe.series.m, r.plan.a, r.plan.b), nc1: base0.ok ? base0.rpm[0] : NaN, span: r.fe.defl.span },
          rows: [[d.krFactor / 3, d.hubPct], [d.krFactor * 3, d.hubPct], [d.krFactor, Math.max(5, d.hubPct / 4)]].map(([k, c]) => run(Math.max(0.05, Math.min(20, k)), c)).filter(Boolean),
          dist: r.fe.dist ? { Mmax: Math.abs(r.fe.dist.Mmax[1]), Mcore: maxIn(r.fe.dist.series.m, r.plan.a, r.plan.b), nc1: nc1(md), span: r.fe.dist.defl.span } : null };
      }
      // conferência automática da malha: a mesma análise com o dobro de elementos
      if (r.fe && r.fe.ok && r.fe.info.ne * 2 > MAX_ELEMS) r.fe.refineSkipped = true;
      else if (r.fe && r.fe.ok && r.dyn) {
        const m2 = feModel(d, secs, r.loads, 2 * d.nElem);
        const f2 = feStatic(d, secs, r.loads, m2);
        const base = r.dyn.flex || r.dyn.rigid;
        const c2 = FEM.criticals(m2, { q: 2, springs: springsOf(d), foundation: false, shear: d.beam !== 'euler' });
        const rel = (a, b) => Math.abs(a - b) / Math.max(1e-30, Math.abs(b));
        if (f2.ok) r.fe.refine = { ne2: m2.info.ne, dSpan: rel(r.fe.defl.span, f2.defl.span), dTip: rel(r.fe.defl.tip, f2.defl.tip), dTh: rel(Math.abs(r.fe.defl.thA), Math.abs(f2.defl.thA)),
          dNc1: base.ok && c2.ok ? rel(base.rpm[0], c2.rpm[0]) : NaN, dM: rel(Math.abs(r.fe.Mmax[1]), Math.abs(f2.Mmax[1])),
          dSeat: r.seats.length && f2.seats ? Math.max(...r.seats.map((s, k) => Math.abs(s.F - f2.seats[k].F) / Math.max(1, Math.max(...f2.seats.map(z => Math.abs(z.F)))))) : NaN };
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
    const d = r.d, c = [], din = r.strength.method === 'din743';
    const add = (sev, title, detail, id) => c.push({ sev, title, detail, id });
    const nF = r.fails.length, N = r.res.length;
    // resistência
    if (din) {
      const P = r.din, bad = r.dinFails;
      if (bad.length) {
        const fD = bad.filter(p => p.SD < d.sMin), fF = bad.filter(p => p.SF < d.sMin);
        add('fail', `${bad.length} de ${P.length} pontos abaixo de S = ${fx(d.sMin, 1)} (DIN 743)`,
          [fD.length ? `Fadiga (S_D): ${fD.map(p => `${p.name} ${fsf(p.SD)}`).join('; ')}.` : '', fF.length ? `Escoamento com pico (S_F): ${fF.map(p => `${p.name} ${fsf(p.SF)}`).join('; ')}.` : '', `Trechos: ${r.fails.map(s => s.code).join(', ')}.`].filter(Boolean).join(' '), 'din743');
      } else add('ok', `Os ${P.length} pontos atingem S ≥ ${fx(d.sMin, 1)} (DIN 743)`, `Mais solicitado: ${r.dinCrit.name}, S_D ${fsf(r.dinCrit.SD)} e S_F ${fsf(r.dinCrit.SF)} (utilização ${fx(r.dinCrit.util, 2)}).`, 'din743');
      const near = P.filter(p => p.ok && p.util > 0.9);
      if (near.length) add('warn', 'Pontos perto do limite', `${near.map(p => p.name).join('; ')}: utilização entre 0,9 e 1,0.`, 'din743');
      const assumed = P.filter(p => p.kind === 'ombro' && p.rAssumed && p.res.alpha.b > 1);
      if (assumed.length) add('warn', `Raio assumido em ${assumed.length} ${assumed.length === 1 ? 'ombro' : 'ombros'}`, `Sem cota no editor, r = ${fx(d.rDefault, 3)} × d: ${assumed.slice(0, 8).map(p => `${p.at} (r ${fx(p.r, 1)} mm)`).join(', ')}${assumed.length > 8 ? '…' : ''}. Informe os raios do desenho na coluna "Raio no fim".`, 'din743');
      const outside = P.filter(p => p.res.notes.some(n => /fora da faixa/.test(n)));
      if (outside.length) add('warn', 'Ombro fora da faixa da fórmula de α', `${outside.map(p => p.at).join(', ')}: r/t < 0,03; α limitado a 6. Confira o raio.`, 'din743');
      const flat = r.res.filter(s => s.flat && !d.notches.some(n => n.x >= s.a && n.x <= s.b));
      if (flat.length) add('warn', 'Entalhes sem fórmula na DIN 743', `${flat.map(s => s.code).join(', ')} com quatro planos: a norma não traz β para isso. Informe βσ e βτ na aba Entalhes (diagramas da DIN 743-2 ou MEF 3D); furos transversais idem.`, 'din743');
      if (d.matBasis === 'norma') { const m = dinMaterial(d); if (m.deff > 500) add('warn', 'Ø efetivo acima de 500 mm', `deff = ${f0(m.deff)} mm: a DIN 743-3 manda combinar K1 com o fornecedor; o cálculo usou o valor de 500 mm.`, 'din743'); }
      if (d.matBasis === 'peca') add('info', 'Material com valores do certificado', `σB ${f0(d.su)} e σS ${f0(d.sy)} MPa valem para o tamanho da peça (K1 = 1). Se forem valores de norma no Ø de 16 mm, troque em "Valores de σB e σS".`, 'din743');
    } else {
      if (nF) {
        const yF = r.fails.filter(s => s.sfy < d.sfY).map(s => s.code), fF = r.fails.filter(s => s.sff < d.sfF).map(s => s.code);
        add('fail', `${nF} de ${N} trechos abaixo dos coeficientes mínimos`,
          [yF.length ? `Escoamento com torque de pico (SF < ${fx(d.sfY, 1)}): ${yF.join(', ')}.` : '', fF.length ? `Fadiga (SF < ${fx(d.sfF, 1)}): ${fF.join(', ')}.` : '', `Pior: ${r.crit.code}, utilização ${fx(r.crit.util, 2)}. Kt e Kf são estimados por trecho: para liberar, use a DIN 743.`].filter(Boolean).join(' '), 'secs');
      } else add('ok', `Os ${N} trechos atingem os coeficientes mínimos`, `Maior utilização: ${r.crit.code} (${fx(r.crit.util, 2)}). Kt e Kf estimados por trecho.`, 'secs');
      const near = r.res.filter(s => s.ok && s.util > 0.9).map(s => s.code);
      if (near.length) add('warn', 'Trechos perto do limite', `${near.join(', ')} com utilização entre 0,9 e 1,0: sensíveis a Kt, Kf e ao torque de pico.`, 'secs');
      for (const s of r.res) if (s.kf > s.kt) add('warn', `Kf maior que Kt em ${s.code}`, 'A sensibilidade ao entalhe não passa de 1: confira os fatores.', 'secs');
    }
    // caminho da carga
    const P = r.plan;
    if (P.mode === 'assentos' && r.seats.length) {
      const tot = r.fe.Wcore, list = r.seats.map(s => `${s.name} ${fx(s.F / 1000, 1)} kN (${pct(s.share)})`).join(' · ');
      add('info', 'Pacote apoiado nos assentos', `O MEF divide ${fx(tot / 1000, 1)} kN do pacote entre ${r.seats.length} ${r.seats.length === 1 ? 'assento' : 'assentos'}: ${list}. ${r.seats.some(s => s.DhAssumed) ? 'Ø externo do cubo assumido (1,6 × Ø) onde está vazio: informe no editor.' : ''}`, 'modelo');
      const pull = r.seats.filter(s => s.F < -1e-6 * Math.abs(tot));
      if (pull.length) add('warn', `${pull.map(s => s.name).join(', ')} ${pull.length === 1 ? 'puxa' : 'puxam'} o cubo para baixo`, 'O eixo e o cubo fletem diferente e o assento do meio fica tracionado: só a interferência segura isso. Confira a pressão do ajuste nesse assento.', 'modelo');
      for (const f of r.fitRes) if (f.seat && f.hub && f.openN) add('fail', `Ajuste ${f.name} abriria na flexão`, `A pressão de flexão no assento (${fx(f.seat.p0, 1)} MPa no pico) passa da pressão do ajuste na rotação (${fx(f.pN, 1)} MPa): o contato descola e o modelo colado deixa de valer.`, 'modelo');
    } else if (d.mount === 'assentos') {
      const why = { 'sem pacote': 'a faixa do pacote não é válida', 'sem posição': `${P.missing.map(f => f.name).join(', ')} sem posição x`, 'sem assento no pacote': 'nenhum assento toca a faixa do pacote' }[P.reason] || '';
      add('warn', 'Pacote distribuído no eixo', `Montagem nos assentos pedida, mas ${why}: as cargas do pacote ficaram distribuídas direto no eixo. Informe o início x de cada assento na aba Ajustes.`, 'modelo');
    }
    // caminho do torque
    const altN = r.alt.fails.length;
    if (d.torqueMode === 'integral') add('info', 'Torque integral em todos os trechos', `Pelo caminho real (MEF de torção) ${altN ? `${altN} ${altN === 1 ? 'trecho ficaria' : 'trechos ficariam'} abaixo (${r.alt.fails.join(', ')})` : 'nenhum trecho ficaria abaixo'}. Os trechos do lado oposto ao acoplamento quase não recebem torque.`, 'torque');
    else add('info', 'Torque pelo caminho real', `Do acoplamento ao pacote pelo MEF de torção. No modo integral (conservador), ${altN ? `${altN} ${altN === 1 ? 'trecho ficaria' : 'trechos ficariam'} abaixo: ${r.alt.fails.join(', ')}` : 'nenhum trecho ficaria abaixo'}.`, 'torque');
    if (isNum(r.fpkAdm.v) && r.fpkAdm.s) add(r.fpkAdm.v >= d.peak && r.fpkAdm.v < 5 && d.machine !== 'motor' ? 'warn' : 'info', 'Torque de pico admissível',
      `O trecho ${r.fpkAdm.s.code} limita o pico a ${fx(r.fpkAdm.v, 2)} × T (${fx(r.fpkAdm.v * r.T / 1000, 1)} kN·m) com ${din ? `S_F ≥ ${fx(d.sMin, 1)}` : `SF ${fx(d.sfY, 1)} no escoamento`}.${d.machine !== 'motor' ? ' Num gerador, o curto súbito nos terminais costuma dar 5 a 8 pu; confirme com o projeto elétrico.' : ''}`, 'torque');
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
      const th = d.beam === 'euler' ? 'Euler–Bernoulli' : 'Timoshenko', I = r.fe.info;
      add('info', `Estática por elementos finitos · ${th}`, `${I.ne} elementos (malha ${I.type})${r.fe.model.hub ? `, eixo e cubo ligados por contato em ${r.seats.length} ${r.seats.length === 1 ? 'assento' : 'assentos'}` : ''}. Resíduo de equilíbrio ${Math.abs(r.fe.residual).toExponential(1)}.`, 'mef');
      const Rf = r.fe.refine;
      if (Rf) {
        const p = v => isNum(v) ? fx(v * 100, v < 0.0001 ? 4 : 3) + ' %' : '—';
        const worst = Math.max(Rf.dSpan, Rf.dTh, Rf.dM, isNum(Rf.dNc1) ? Rf.dNc1 : 0, isNum(Rf.dSeat) ? Rf.dSeat : 0);
        add(worst * 100 <= d.convTol ? 'ok' : 'warn', worst * 100 <= d.convTol ? 'Malha convergida' : 'Malha grossa para a tolerância',
          `Com ${Rf.ne2} elementos (o dobro), a flecha no vão muda ${p(Rf.dSpan)}, a inclinação em A ${p(Rf.dTh)}, o momento máximo ${p(Rf.dM)}, a 1ª crítica ${p(Rf.dNc1)}${isNum(Rf.dSeat) ? ` e a carga nos assentos ${p(Rf.dSeat)}` : ''}. Tolerância: ${fx(d.convTol, 2)} %.`, 'mef');
      }
    } else add('warn', 'Modelo de elementos finitos indisponível', 'A estática ficou com a solução analítica do modelo distribuído.', 'mef');
    if (d.drawingMass) { const e = r.mass.shaft / d.drawingMass - 1; add(Math.abs(e) > 0.1 ? 'warn' : 'info', 'Massa do eixo × desenho', `Geometria: ${f0(r.mass.shaft)} kg; desenho: ${f0(d.drawingMass)} kg (${e > 0 ? '+' : '−'}${fx(Math.abs(e) * 100, 1)} %). Rasgos, furos e planos não detalhados explicam parte da diferença.`, 'cargas'); }
    // chavetas e ajustes
    for (const k of r.keyRes) {
      const low = isNum(k.Tshaft) && k.Tshaft < 0.5 * k.T;
      add(k.ok ? 'ok' : 'fail', `Chaveta ${k.name}`, `${fx(k.share, 0)} % do torque (${fx(k.T / 1000, 1)} kN·m): cisalhamento ${fx(k.tau, 1)} MPa e pressão no eixo ${fx(k.pS, 1)} MPa nominais; com pico, SF ${fx(k.sf, 2)}.${isNum(k.Tshaft) ? ` No caminho calculado, o eixo leva ${fx(k.Tshaft / 1000, 1)} kN·m nesse rasgo.` : ''}${!k.ok && low ? ' Se a chaveta só arrasta o que passa ali, reduza a parcela de torque.' : ''}`, 'interfaces');
    }
    for (const f of r.fitRes) {
      const src = f.byFE ? `${fx(f.T / 1000, 1)} kN·m pelo MEF de torção` : `${fx(f.share, 0)} % do torque`;
      if (f.hub) add(f.ok ? 'ok' : 'fail', `Ajuste ${f.name}`, `Leva ${src}: requer ${fx(f.pReq, 2)} MPa; gera ${fx(f.pN, 1)} MPa na rotação e transmite ${fx(f.TtrN / 1000, 1)} kN·m = ${fx(f.sfN, 2)} × o que passa por ele; tensão no cubo ${fx(f.hubVm, 0)} MPa.`, 'interfaces');
      else add('info', `Ajuste ${f.name}: pressão gerada não verificada`, `Leva ${src}: requer ${fx(f.pReq, 2)} MPa (μ ${fx(d.mu, 2)}). Informe o Ø externo do cubo para Lamé com perda por rotação.`, 'interfaces');
    }
    for (const b of r.bearings) if (b.p > 2.5) add('warn', `Pressão específica no mancal ${b.name}`, `${fx(b.p, 2)} MPa com o colo Ø${fx(b.D, 1)} × ${fx(b.B, 1)} mm, acima de 2,5 MPa.`, 'mancais');
    if (r.res.some(s => s.flat)) add('info', 'Seção com quatro planos', 'Área e inércia exatas; a torção usa o círculo inscrito.', din ? 'din743' : 'secs');
    if (r.bal && !r.bal.inboard) add('warn', 'Centro de massa fora dos mancais', 'A divisão do desbalanceamento admissível segue a regra de rotor em balanço (ISO 1940-1, 7.2.3).', 'balanceamento');
    return c;
  }

  /* ---- Memória de cálculo ---------------------------------------------------------------------------- */
  function buildSteps(r) {
    const d = r.d, s = [], gen = d.machine !== 'motor', din = r.strength.method === 'din743';
    const st = (section, title, formula, subst, value, unit, dd, comment, source) => s.push({ section, title, formula, subst, value, unit, d: dd, comment, source });
    const thName = d.beam === 'euler' ? 'Euler–Bernoulli' : 'Timoshenko';
    // torque
    if (d.powerBase === 'rend') st('torque', 'Potência no eixo', gen ? 'Peixo = Pel / η' : 'Peixo = Pel · η', `${fx(d.pElec, 2)} ${gen ? '/' : '·'} ${fx(d.eff, 3)}`, r.Pshaft, 'kW', 2, `Pelas perdas daria ${fx(r.PshaftAlt, 2)} kW.`);
    else st('torque', 'Potência no eixo', gen ? 'Peixo = Pel + Pmec + Pperd' : 'Peixo = Pel − Pmec − Pperd', gen ? `${fx(d.pElec, 2)} + ${fx(d.lossMech, 2)} + ${fx(d.lossElec, 2)}` : `${fx(d.pElec, 2)} − ${fx(d.lossMech, 2)} − ${fx(d.lossElec, 2)}`, r.Pshaft, 'kW', 2, `Pelo rendimento ${fx(d.eff, 3)} daria ${fx(r.PshaftAlt, 2)} kW: confirme a base das perdas.`, gen ? 'Gerador: a turbina entrega a potência elétrica mais as perdas' : 'Motor: o eixo entrega a potência elétrica menos as perdas');
    st('torque', 'Torque nominal', 'T = Peixo · 60 000 / (2π · n)', `${fx(r.Pshaft, 2)} · 60 000 / (2π · ${fx(d.speed, 0)})`, r.T / 1000, 'kN·m', 2, null, 'N·m com P em kW e n em rpm');
    st('torque', 'Torque de pico (escoamento)', 'Tpico = kpico · T', `${fx(d.peak, 2)} · ${fx(r.T / 1000, 2)}`, r.Tpk / 1000, 'kN·m', 2, d.machine !== 'motor' ? 'O 2,09 pu da FTD é dado de motor. Para gerador, o curto súbito nos terminais pode chegar a 5–8 pu.' : null);
    if (d.ripple > 0) st('torque', 'Amplitude de torque em regime (fadiga)', 'Ta = (τa/τm) · T', `${fx(d.ripple, 1)} % · ${fx(r.T / 1000, 2)}`, r.T * d.ripple / 100 / 1000, 'kN·m', 2, 'Entra na DIN 743 como τta; sem ela, a torção só conta no escoamento e como tensão média.');
    // modelo e caminho da carga
    const P = r.plan, F = r.fe && r.fe.ok ? r.fe : null;
    if (P.mode === 'assentos' && F && F.model.hub) {
      const H = F.model.hub, c = d.hubPct / 100, E = d.E, G = E / (2 * (1 + NU));
      st('modelo', 'Duas vigas: eixo e cubo do pacote', 'eixo (x de 0 a L) + cubo (x de a a b) · contato só nos assentos', `cubo de ${fx(P.a, 1)} a ${fx(P.b, 1)} mm · assentos ${P.seats.map(z => `${z.name} ${fx(z.a, 1)}–${fx(z.b, 1)}`).join(' · ')}`, null, '', 0,
        'O pacote (massa, força magnética e torque) carrega o cubo; o cubo só toca o eixo nos assentos. Quanto vai para cada assento sai do equilíbrio e da compatibilidade de deslocamentos das duas vigas, não de uma hipótese.', 'Viga sobre fundação elástica entre duas vigas (Winkler)');
      for (const z of P.seats) {
        const Ih = PI * (z.Dh ** 4 - z.d ** 4) / 64;
        st('modelo', `Rigidez do cubo em ${z.name}`, 'EIcubo = c · E · π(Dcubo⁴ − d⁴)/64 · GJcubo = c · G · π(Dcubo⁴ − d⁴)/32', `c = ${fx(c * 100, 0)} % · Dcubo = ${fx(z.Dh, 1)}${z.DhAssumed ? ' (assumido 1,6 × d)' : ''} · d = ${fx(z.d, 1)} mm`, c * E * Ih / 1e9 / (PI * z.d ** 4 / 64 * E / 1e9), '× EI do eixo', 2, `EIcubo = ${fx(c * E * Ih / 1e12, 1)} MN·m².`);
      }
      const z0 = P.seats[0], dm = z0.d / 1000, kr = d.krFactor * PI * E * 1e6, EIs = E * 1e6 * PI * dm ** 4 / 64, lam = Math.pow(4 * EIs / kr, 0.25) * 1000;
      st('modelo', 'Contato nos assentos (ajuste colado)', 'kr = f · π · E (N/m por metro) · kt = f · (π/8) · G · d² (N·m/rad por metro)', `f = ${fx(d.krFactor, 2)} · E = ${f0(E)} MPa · d = ${fx(z0.d, 1)} mm`, kr / 1e9, 'GN/m²', 1,
        `Comprimento de transferência na flexão 1/β = (4EI/kr)^¼ ≈ ${fx(lam, 0)} mm e na torção √(GJ/kt) = d/2 ≈ ${fx(z0.d / 2, 0)} mm: a carga entra e sai pelas bordas dos assentos. Vale enquanto o ajuste não descola (conferido com a pressão de Lamé).`, 'Interferência tratada como camada elástica colada');
      st('modelo', 'Elemento de contato', 'Kc = kr · L/420 · [156, 22L, 54, −13L; …] · [[Kc, −Kc], [−Kc, Kc]] entre os GDL do eixo e do cubo', `${F.model.contact.filter(Boolean).length} elementos de assento · meia-largura de banda ${F.st.hb}`, null, '', 0, 'Mesma interpolação de Hermite da massa consistente; a pressão p(x) = kr·(vcubo − veixo) é integrada dentro de cada elemento para o cortante e o momento do eixo.');
      st('modelo', 'Carga total no cubo', 'W = mrot · g + Fmag', `${f0(d.rotorMass)} kg · 9,80665${d.ump ? ` + ${fx(d.ump * G0 / 1000, 2)} kN` : ''}`, F.Wcore / 1000, 'kN', 2, `Força magnética ${d.umpDist === 'distribuida' ? 'distribuída no pacote' : `pontual em x = ${fx(d.xUmp, 1)} mm`}.`);
      for (const z of r.seats) st('modelo', `Carga no assento ${z.name}`, 'Fassento = ∫ p(x) dx no assento', `x ${fx(z.a, 1)}–${fx(z.b, 1)} mm · resultante em x = ${fx(z.xc, 1)} mm · pico ${fx(z.qmax, 1)} N/mm`, z.F / 1000, 'kN', 2,
        `${pct(z.share)} da carga do pacote. Pressão de flexão no assento p = 2q/(π·d) = ${fx(z.p0, 2)} MPa.${isNum(z.T) ? ` Torque transferido: ${fx(z.T / 1000, 1)} kN·m (${pct(z.Tshare)}).` : ''}`);
      st('modelo', 'Equilíbrio dos assentos', 'Σ Fassento = W', `${r.seats.map(z => fx(z.F / 1000, 2)).join(' + ')}`, r.seats.reduce((a, z) => a + z.F, 0) / 1000, 'kN', 2, `Diferença ${Math.abs(r.seats.reduce((a, z) => a + z.F, 0) / F.Wcore - 1).toExponential(1)}: só arredondamento.`);
    } else st('modelo', 'Pacote distribuído no eixo', 'q = mrot · g / (x1 − x0) aplicada direto no eixo', r.core.has ? `${f0(d.rotorMass)} kg de ${fx(d.rotorFrom, 1)} a ${fx(d.rotorTo, 1)} mm` : 'sem massa de pacote', null, '', 0, d.mount === 'assentos' ? 'A montagem nos assentos não fechou (veja as verificações); ficou o modelo distribuído.' : 'Simplificação do script: o pacote não enrijece o eixo e a carga não passa pelos assentos.');
    // cargas
    st('cargas', 'Massa do eixo (geometria)', 'meixo = Σ ρ · A · L', `${f0(d.rho)} kg/m³ · ${r.res.length} trechos`, r.mass.shaft, 'kg', 0, d.drawingMass ? `Desenho: ${f0(d.drawingMass)} kg.` : null, 'Seção líquida dos trechos; rasgos e furos fora');
    st('cargas', 'Peso próprio (por trecho)', 'q = −A · ρ · g', `ex. ${r.res[0].code}: −${fx(r.res[0].A, 0)} mm² · ${f0(d.rho)} · 9,80665 · 10⁻⁹`, -r.res[0].A * 1e-9 * d.rho * G0, 'N/mm', 3);
    if (r.core.has) st('cargas', 'Massa do pacote distribuída', 'qrot = −mrot · g / (x1 − x0)', `−${f0(d.rotorMass)} · 9,80665 / (${fx(d.rotorTo, 1)} − ${fx(d.rotorFrom, 1)})`, -d.rotorMass * G0 / (d.rotorTo - d.rotorFrom), 'N/mm', 2, P.mode === 'assentos' ? 'Aplicada no cubo, que a leva aos assentos.' : 'Aplicada direto no eixo.');
    st('cargas', 'Força magnética', 'Fmag = F[kgf] · 9,80665', `${fx(d.ump, 2)} · 9,80665 · ${r.loads.magDist ? 'distribuída no pacote' : `em x = ${fx(d.xUmp, 1)} mm`}`, d.ump * G0 / 1000, 'kN', 3, 'Direção é hipótese: soma com a gravidade (pior caso).');
    st('cargas', 'Massa total girante e centro de massa', 'm = meixo + mrot · xcg = Σm·x / m', `${f0(r.mass.shaft)} + ${f0(d.rotorMass)} kg`, r.mass.total, 'kg', 0, `Centro de massa em x = ${fx(r.mass.cg, 1)} mm.`);
    // reações
    st('reacoes', 'Soma das forças verticais', 'ΣFy = Σ q·(b − a) + Σ F', 'peso do eixo + pacote + força magnética + acoplamento', r.Fy / 1000, 'kN', 2);
    st('reacoes', 'Reação no mancal B (equilíbrio)', 'RB = −Σ M(A) / (xB − xA)', `momentos em torno de A / (${fx(d.xB, 2)} − ${fx(d.xA, 3)})`, r.an.RB / 1000, 'kN', 2, 'Com dois mancais as reações saem só do equilíbrio, com ou sem cubo.');
    st('reacoes', 'Reação no mancal A (equilíbrio)', 'RA = −ΣFy − RB', `${fx(-r.Fy / 1000, 2)} − ${fx(r.an.RB / 1000, 2)}`, r.an.RA / 1000, 'kN', 2, `${f0(r.an.RA / G0)} kgf e ${f0(r.an.RB / G0)} kgf.`);
    if (F) st('reacoes', 'Reações por elementos finitos (usadas)', 'R = Σ esforços dos elementos no nó − força aplicada', `RA ${fx(F.RA / 1000, 4)} · RB ${fx(F.RB / 1000, 4)} kN · resíduo de equilíbrio ${Math.abs(F.residual).toExponential(1)}`, null, '', 0, `Equilíbrio: ${fx(r.an.RA / 1000, 4)} e ${fx(r.an.RB / 1000, 4)} kN.`);
    // esforços
    if (F) {
      st('esforcos', 'Momento fletor máximo no eixo (MEF)', F.model.hub ? 'fe = Ke·ue − fe,eq + Kc·(ue − ucubo) · M(ξ) = −M1 + V1·ξ + q·ξ²/2 + ∫∫p' : 'fe = Ke·ue − fe,eq · M(ξ) = −M1 + V1·ξ + q·ξ²/2', `máximo em x = ${fx(r.Mmax.x, 1)} mm (${r.Mmax.sec ? r.Mmax.sec.code : '—'}) · ${F.info.ne} elementos`, Math.abs(r.Mmax.v) / 1e6, 'kN·m', 2,
        F.model.hub ? `Dentro dos assentos o cubo leva parte do momento. Com o pacote distribuído no eixo daria ${fx(F.dist ? Math.abs(F.dist.Mmax[1]) : NaN, 2)} kN·m; solução analítica do modelo distribuído: ${fx(Math.abs(r.an.Mmax[1]), 2)} kN·m.` : `Recuperado por equilíbrio dentro de cada elemento. Solução analítica (superposição): ${fx(Math.abs(r.an.Mmax[1]), 2)} kN·m.`);
      if (F.model.hub && F.series.mh) { const mh = F.series.mh.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a, [0, 0]); st('esforcos', 'Momento máximo no cubo', 'Mcubo(x) pelo mesmo equilíbrio, com a pressão de contato trocada de sinal', `em x = ${fx(mh[0], 1)} mm`, Math.abs(mh[1]), 'kN·m', 2, 'É o momento que o cubo tira do eixo dentro dos assentos.'); }
    } else st('esforcos', 'Momento fletor máximo', 'M(x) = RA⟨x−xA⟩ + RB⟨x−xB⟩ + Σ F⟨x−xF⟩ + Σ q·t·(x − a − t/2)', `máximo em x = ${fx(r.Mmax.x, 1)} mm`, Math.abs(r.Mmax.v) / 1e6, 'kN·m', 2, 'Superposição; t = trecho da carga distribuída à esquerda de x.');
    st('esforcos', 'Momento nos mancais', 'M(xA), M(xB)', `balanços de ${fx(d.xA, 1)} e ${fx(d.L - d.xB, 1)} mm`, Math.max(Math.abs(r.MA), Math.abs(r.MB)) / 1e6, 'kN·m', 2, `A: ${fx(r.MA / 1e6, 2)} · B: ${fx(r.MB / 1e6, 2)} kN·m.`);
    st('esforcos', 'Cortante máximo', 'V(x) = Σ forças à esquerda', `em x = ${fx(r.Vmax.x, 1)} mm`, Math.abs(r.Vmax.v) / 1000, 'kN', 2);
    // torção
    if (r.tor) {
      const T = r.tor, G = d.E / (2 * (1 + NU)), m = F.model;
      st('torcao', 'Elemento de torção', 'Ke = GJ/L · [1, −1; −1, 1] · contato Kc = kt·L/6 · [2, 1; 1, 2] entre eixo e cubo', `G = E/2(1+ν) = ${f0(G)} MPa · ${m.elems.length} elementos no eixo${m.hub ? ` + cubo com GJ = c · G · π(Dcubo⁴ − d⁴)/32` : ''}`, null, '', 0, 'Um giro φ por nó; GJ pela média harmônica dos trechos que o elemento cobre (exato para eixo escalonado).', 'Elementos finitos de torção');
      st('torcao', 'Torques aplicados', 'acoplamento +T · pacote −(1 − aux)·T distribuído · ponta oposta −aux·T', `T = ${fx(r.T / 1000, 2)} kN·m · aux ${fx(d.auxTorque, 1)} % · ${m.hub ? 'pacote no cubo' : 'pacote direto no eixo'} de ${fx(d.rotorFrom, 1)} a ${fx(d.rotorTo, 1)} mm`, null, '', 0, 'O sistema é livre e os torques se equilibram; o nó do acoplamento é travado só para tirar o giro de corpo rígido (a reação sai nula).');
      st('torcao', 'Torque interno', 'T(x) = Σ torques aplicados à esquerda + Σ ∫ kt·(φcubo − φeixo) dx', `fecha em ${Math.abs(T.closure).toExponential(1)} N·m na outra ponta`, T.Tmax / 1000, 'kN·m (máx.)', 2, m.hub ? 'Nos assentos o torque passa do eixo para o cubo pelas bordas (comprimento de transferência ≈ d/2); entre o acoplamento e o primeiro assento o eixo leva o torque inteiro.' : 'Sem cubo, o torque cai linearmente ao longo do pacote.');
      for (const z of T.seats) st('torcao', `Torque transferido em ${z.name}`, 'Tassento = Σ kt·L/2·(Δφ1 + Δφ2) nos elementos do assento', 'Δφ = φcubo − φeixo', z.T / 1000, 'kN·m', 2, `${pct(z.share)} do torque que sai pelo pacote.`);
      st('torcao', 'Giro entre o acoplamento e o pacote', 'Δφ = |φ̄pacote − φacoplamento|', `rigidez torcional equivalente T/Δφ = ${fx(r.T / T.twist / 1e6, 1)} MN·m/rad`, T.twist * 180 / PI, '°', 4, `${fx(T.twist * 1000, 3)} mrad.`);
    } else {
      const Gm = d.E / (2 * (1 + NU));
      st('torcao', 'Ângulo de torção do eixo', 'φ = Σ T·L / (G·J)', `G = ${f0(Gm)} MPa · torque integral`, r.twist * 180 / PI, '°', 3);
    }
    // flecha
    if (F) st('flecha', 'Flecha máxima (MEF)', 'K·u = f · v(ξ) = N(ξ)·ue dentro de cada elemento', `${F.info.ne} elementos de ${thName} · máximo em x = ${fx(r.defl.xmax, 1)} mm`, r.defl.max, 'mm', 4, `${r.defl.xmax < d.xA || r.defl.xmax > d.xB ? 'O máximo está na ponta em balanço, não no vão. ' : ''}Deslocamentos dos nós interpolados pelas funções de forma; o máximo dentro do elemento sai de dv/dξ = 0.`, `Elementos finitos · ${d.kBearing ? `mancais de ${fx(d.kBearing, 0)} kN/mm` : 'mancais rígidos'}`);
    st('flecha', 'Flecha no vão entre mancais', 'máx |y| em xA ≤ x ≤ xB', `em x = ${fx(r.defl.xspan, 1)} mm`, r.defl.span, 'mm', 4, isNum(r.defl.core) ? `No pacote: ${fx(r.defl.core, 4)} mm.` : null);
    st('flecha', 'Inclinação nos mancais', 'θ = rotação da seção no nó do mancal', `A: ${fx(r.defl.thA * 1000, 4)} · B: ${fx(r.defl.thB * 1000, 4)} mrad`, Math.max(Math.abs(r.defl.thA), Math.abs(r.defl.thB)) * 1000, 'mrad', 3, `Admissível ${fx(d.slopeMax, 2)} mrad.`);
    if (F) st('flecha', 'Conferência analítica (modelo distribuído)', 'y″ = M/(E·I), dupla integração, apoios rígidos', `vão ${fx(r.an.defl.span, 4)} mm · ponta ${fx(r.an.defl.tip, 4)} mm · θA ${fx(Math.abs(r.an.defl.thA) * 1000, 4)} mrad`, r.an.defl.span, 'mm', 4,
      `${F.model.hub ? `Com o cubo nos assentos o eixo fica mais rígido no pacote: a flecha no vão é ${fx((r.fe.defl.span / r.an.defl.span - 1) * 100, 1)} % da analítica sem cubo.` : `Diferença no vão: ${fx((r.fe.defl.span / r.an.defl.span - 1) * 100, 3)} %.`} ${d.beam === 'euler' ? '' : `Cisalhamento (Timoshenko): na mesma malha, Euler–Bernoulli daria ${fx(r.fe.other ? r.fe.other.defl.span : NaN, 4)} mm.`}`);
    // elementos finitos
    if (F) {
      const I = F.info, els = F.model.elems, phis = Array.from(F.st.phis), kap = els.reduce((a, e) => Math.min(a, e.kappa), 1);
      const extra = [I.zones ? `${I.zones} ${I.zones === 1 ? 'região' : 'regiões'} de refino` : '', I.user ? `${I.user} ${I.user === 1 ? 'nó pedido' : 'nós pedidos'}` : ''].filter(Boolean).join(' e ');
      st('mef', 'Discretização', `elementos de viga de 2 nós · v e θ por nó${F.model.hub ? ' no eixo e no cubo' : ''}`, `malha ${I.type} · alvo ${d.nElem}${extra ? ` + ${extra}` : ''} → ${I.ne} elementos, ${I.nn} nós`, F.st.ndof, 'GDL', 0,
        `Elementos de ${fx(I.hmin, 1)} a ${fx(I.hmax, 1)} mm. ${I.type === 'uniforme' ? 'Os degraus do eixo caem dentro dos elementos: rigidez pela média harmônica, massa e peso pela média do que o elemento cobre.' : 'Há nó em toda mudança de seção, nos mancais, nas forças, nas pontas do pacote e dos assentos.'}${I.zones ? ' Nas regiões de refino, nenhum elemento passa do h pedido.' : ''}`, 'Elementos finitos de viga');
      st('mef', `Rigidez do elemento · ${thName}`, 'Ke = EI/((1+Φ)·L³)·[12, 6L, −12, 6L; 6L, (4+Φ)L², −6L, (2−Φ)L²; …] · Φ = 12EI/(κGAL²)', d.beam === 'euler' ? 'Φ = 0 (sem cisalhamento)' : `κ (Cowper) ≥ ${fx(kap, 3)} · Φ de ${sig(Math.min(...phis))} a ${sig(Math.max(...phis))}`, null, '', 0,
        d.beam === 'euler' ? 'Hermite cúbica: deslocamentos nos nós exatos para cargas uniformes por elemento.' : 'Interpolação interdependente: exata para a viga de Timoshenko com carga uniforme, sem travamento por cisalhamento.');
      st('mef', 'Massa consistente', d.beam === 'euler' ? 'M = m′L/420·[156, 22L, 54, −13L; …] + ρI/(30L)·[36, 3L, −36, 3L; …]' : 'M = m′L/(210(1+Φ)²)·[70Φ²+147Φ+78, …] + ρI/(30(1+Φ)²L)·[36, (3−15Φ)L, …]', d.beam === 'euler' ? 'translação e inércia de rotação' : 'mesmas funções de forma da rigidez (Przemieniecki)', null, '', 0, 'Com a massa de Hermite e a rigidez de Timoshenko, as críticas convergiriam para um valor errado em eixos grossos; com a massa do próprio elemento, convergem para a solução exata (casos de verificação).');
      st('mef', 'Cargas nodais consistentes', 'fe,eq = [qL/2, qL²/12, qL/2, −qL²/12] · forças concentradas nos nós', `peso de ${I.ne} elementos${d.rotorMass > 0 ? ' + pacote' : ''} + força magnética${d.coupleF ? ' + acoplamento' : ''}`, -F.st.Ftot / 1000, 'kN', 3, 'Soma das cargas aplicadas, para baixo.');
      st('mef', 'Condições de contorno e solução', d.kBearing ? 'molas k nos nós dos mancais · K·u = f' : 'v = 0 nos nós dos mancais · K·u = f', `${F.st.ndof} equações · Cholesky em banda (meia-largura ${F.st.hb})`, null, '', 0, d.kBearing ? `k = ${fx(d.kBearing, 0)} kN/mm: a flecha inclui o recuo dos mancais.` : 'Mancais rígidos.');
      st('mef', 'Equilíbrio', 'ΣR + ΣF = 0', `RA + RB = ${fx((F.RA + F.RB) / 1000, 4)} kN · cargas ${fx(-F.st.Ftot / 1000, 4)} kN`, Math.abs(F.residual) * 100, '% de resíduo', 2, `Erro relativo ${Math.abs(F.residual).toExponential(1)}: só arredondamento.`);
      if (F.refineSkipped) st('mef', 'Malha com o dobro de elementos', 'Δ = |Q(N) − Q(2N)| / |Q(2N)|', `${I.ne} elementos: o dobro passaria de ${fx(MAX_ELEMS, 0)}`, null, '', 0, 'Conferência automática desligada nesta malha; o estudo de convergência compara com malhas mais grossas.');
      if (F.refine) st('mef', 'Malha com o dobro de elementos', 'Δ = |Q(N) − Q(2N)| / |Q(2N)|', `${I.ne} → ${F.refine.ne2} elementos · flecha ${fx(F.refine.dSpan * 100, 4)} % · θA ${fx(F.refine.dTh * 100, 4)} % · 1ª crítica ${fx(F.refine.dNc1 * 100, 4)} %${isNum(F.refine.dSeat) ? ` · assentos ${fx(F.refine.dSeat * 100, 4)} %` : ''}`,
        Math.max(F.refine.dSpan, F.refine.dTh, F.refine.dM, isNum(F.refine.dNc1) ? F.refine.dNc1 : 0, isNum(F.refine.dSeat) ? F.refine.dSeat : 0) * 100, '% (maior)', 4, `Tolerância ${fx(d.convTol, 2)} %. O estudo completo de convergência fica logo abaixo.`);
    }
    // DIN 743: o ponto mais solicitado, em resumo (a memória completa de cada ponto fica na tabela)
    if (din && r.dinCrit) {
      const p = r.dinCrit, R = p.res, m = dinMaterial(d);
      st('din743', 'Pontos de verificação', 'ombros + rasgos de chaveta + bordas livres dos ajustes + entalhes informados + seção lisa de cada trecho', `${r.din.length} pontos: ${Object.keys(KINDS).map(k => [k, r.din.filter(q => q.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${KINDS[k].toLowerCase()}`).join(', ')}`, null, '', 0, 'Em cada ponto: M do MEF de flexão, T do caminho do torque e força axial; tensões nominais na seção do trecho.', 'DIN 743-1:2012, 4 e 5');
      st('din743', 'Material no Ø da peça', d.matBasis === 'peca' ? 'σB(d) = σB · σS(d) = σS (certificado no tamanho da peça)' : 'σB(d) = K1(deff) · σB(dB) · σS(d) = K1(deff) · σS(dB)', d.matBasis === 'peca' ? `${f0(d.su)} · ${f0(d.sy)} MPa` : `deff = ${f0(m.deff)} mm${m.deffAuto ? ' (maior Ø)' : ''} · K1 = ${fx(R.mat.k1B, 3)} e ${fx(R.mat.k1S, 3)}`, R.mat.sB, 'MPa (σB)', 0, `σS(d) = ${f0(R.mat.sS)} MPa. Limites de fadiga: σbW = 0,5·σB = ${f0(R.W.b)}, τtW = 0,3·σB = ${f0(R.W.t)} MPa.`, 'DIN 743-3:2012');
      st('din743', `Ponto mais solicitado: ${p.name}`, 'S_D = 1/√[(σzda/σzdADK + σba/σbADK)² + (τta/τtADK)²] · S_F = 1/√[(σzdmáx/σzdFK + σbmáx/σbFK)² + (τtmáx/τtFK)²]', `x = ${fx(p.x, 1)} mm · Ø${fx(p.d, 1)} · Kσ ${fx(R.K.b, 3)} · Kτ ${fx(R.K.t, 3)} · σba ${fx(R.s.sba, 1)} · τtm ${fx(R.s.ttm, 1)} MPa`, Math.min(p.SD, p.SF), 'S (menor)', 2,
        `S_D = ${fsf(p.SD)} · S_F = ${fsf(p.SF)} · mínimo ${fx(d.sMin, 2)}. A memória completa de qualquer ponto abre na tabela abaixo.`, 'DIN 743-1:2012, eq. 1 e 2');
    }
    // críticas
    if (r.dyn) {
      const D = r.dyn;
      st('criticas', 'Modelo de viga', 'K·φ = ω²·M·φ', `${D.elems} elementos de ${thName} (malha ${D.info.type}), ${D.nodes} nós, massa consistente + inércia de rotação`, null, '', 0, `${P.mode === 'assentos' ? `A massa do pacote (${f0(d.rotorMass)} kg) está no cubo, que enrijece o eixo nos assentos.` : `A massa do pacote (${f0(d.rotorMass)} kg) entra distribuída no eixo, sem rigidez.`}${r.fe && r.fe.model && r.fe.model.Jpm ? ` Inércia de rotação do pacote ${fx(r.fe.model.Jpm, 1)} kg·m²/m (Ø ${f0(d.rotorOD)} mm).` : ''} Sem efeito giroscópico nem amortecimento.`);
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
    if (r.fitRes.length) { const f = r.fitRes[0]; st('interfaces', `Ajuste ${f.name}: pressão requerida`, 'p = 2T / (μ · π · d² · L)', `2 · ${fx(f.T, 0)} / (${fx(d.mu, 2)} · π · ${fx(f.d / 1000, 3)}² · ${fx(f.L / 1000, 4)})`, f.pReq, 'MPa', 2, f.byFE ? 'T = torque que o MEF de torção passa por este assento.' : 'T = parcela informada do torque.'); }
    for (const b of r.bearings) st('mancais', `Mancal ${b.name}: pressão específica`, 'pm = F / (D · B)', `${fx(Math.abs(b.F) / 1000, 2)} kN / (${fx(b.D, 1)} · ${fx(b.B, 1)}) · trecho ${b.s.code}`, b.p, 'MPa', 3, `Velocidade periférica ${fx(b.v, 1)} m/s. B = comprimento do colo, então pm é o limite inferior.`);
    return s;
  }
  // memória completa de um ponto DIN 743
  function pointSteps(r, p) {
    const d = r.d, R = p.res, out = [], m = dinMaterial(d);
    const st = (title, formula, subst, value, unit, dd, comment, source) => out.push({ section: 'ponto', title, formula, subst, value, unit, d: dd, comment, source });
    const s = r.secsP[p.sec], W = moduli(s);
    st('Local e seção', `${KINDS[p.kind]} · x = ${fx(p.x, 1)} mm`, `trecho ${s.code} · Ø${fx(s.d, 2)}${s.di ? ` × Ø${fx(s.di, 1)}` : ''}${s.flat ? ` · planos ${fx(s.flats, 1)}` : ''} · Wb = ${fx(W.Wb / 1e3, 1)}·10³ mm³ · Wt = ${fx(W.Wt / 1e3, 1)}·10³ mm³`, null, '', 0, p.kind === 'ombro' ? `D = ${fx(p.D, 2)} mm · t = (D − d)/2 = ${fx((p.D - s.d) / 2, 2)} mm · r = ${fx(p.r, 2)} mm${p.rAssumed ? ` (assumido ${fx(d.rDefault, 3)} × d)` : ''}.` : p.kind === 'chaveta' ? `Rasgo de ${fx(p.range[0], 1)} a ${fx(p.range[1], 1)} mm; ponto onde a tensão nominal é máxima.${p.nk > 1 ? ' Dois rasgos na seção.' : ''}` : null);
    st('Esforços no ponto', 'M do MEF de flexão · T do caminho do torque · F axial', `M = ${fx(p.M / 1e6, 3)} kN·m · T = ${fx(p.T / 1000, 2)} kN·m · F = ${fx(d.axialF, 1)} kN`, null, '', 0, d.torqueMode === 'mef' ? 'Torque pelo MEF de torção.' : 'Torque integral.');
    st('Tensões nominais', 'σba = M/Wb (flexão alternada) · τtm = T/Wt · σzdm = F/A', `${fx(p.M / 1e6, 3)}·10⁶ / ${fx(W.Wb / 1e3, 1)}·10³ · ${fx(p.T, 0)}·10³ / ${fx(W.Wt / 1e3, 1)}·10³`, R.s.sba, 'MPa (σba)', 2, `τtm = ${fx(R.s.ttm, 2)} MPa${R.s.tta ? ` · τta = ${fx(R.s.tta, 2)} MPa` : ''}${R.s.szdm ? ` · σzdm = ${fx(R.s.szdm, 2)} MPa` : ''}. No pico: τtmáx = kpico·τtm = ${fx(R.s.ttmax, 2)} MPa.`, 'Eixo girando: flexão totalmente alternada, torque constante');
    st('Material no Ø d', m.basis === 'peca' ? 'σB(d) = σB · σS(d) = σS' : 'σB(d) = K1,B(deff)·σB · σS(d) = K1,S(deff)·σS', m.basis === 'peca' ? 'valores do certificado' : `${R.mat.k1info ? R.mat.k1info.B.txt : ''} = ${fx(R.mat.k1B, 3)} · ${R.mat.k1info ? R.mat.k1info.S.txt : ''} = ${fx(R.mat.k1S, 3)} · deff = ${f0(m.deff)} mm`, R.mat.sB, 'MPa (σB(d))', 0, `σS(d) = ${f0(R.mat.sS)} MPa.`, 'DIN 743-3:2012, 5');
    if (p.kind === 'ombro' && R.G) {
      st('Fator de forma α (ombro)', 'α = 1 + 1/√(A·r/t + 2B·(r/d)·(1 + 2r/d)² + C·(r/t)^z·d/D)', `flexão A 0,62 · B 5,8 · C 0,2 · z 3 · torção A 3,4 · B 19 · C 1 · z 2 · r/t = ${fx(p.r / ((p.D - s.d) / 2), 3)} · d/D = ${fx(s.d / p.D, 3)}`, R.alpha.b, 'αb', 3, `αt = ${fx(R.alpha.t, 3)}${R.s.szdm ? ` · αzd = ${fx(R.alpha.zd, 3)}` : ''}.${R.notes.length ? ' ' + R.notes.join('; ') + '.' : ''}`, 'DIN 743-2:2012, tab. 2');
      st('Gradiente relativo G′', 'G′b = 2,3·(1+φ)/r · G′t = 1,15/r · φ = 1/(4√(t/r) + 2) se d/D > 0,67', `φ = ${fx(R.G.phi, 4)} · r = ${fx(p.r, 2)} mm`, R.G.b, 'mm⁻¹ (flexão)', 4, `G′t = ${fx(R.G.t, 4)} mm⁻¹.`, 'DIN 743-2:2012, tab. 3');
      st('Número de apoio n', 'n = 1 + √(G′·mm)·10^−(0,33 + σS(d)/712 MPa)', `σS(d) = ${f0(R.mat.sS)} MPa`, R.n.b, 'nb', 4, `nt = ${fx(R.n.t, 4)}.`, 'DIN 743-2:2012, eq. 9');
      st('Fator de entalhe β', 'β = α / n', `${fx(R.alpha.b, 3)} / ${fx(R.n.b, 4)}`, R.beta.b, 'βσ', 3, `βτ = ${fx(R.alpha.t, 3)} / ${fx(R.n.t, 4)} = ${fx(R.beta.t, 3)}.`);
    } else if (p.kind === 'chaveta') {
      const k = R.extra.key;
      st('Fator de entalhe β (rasgo de chaveta)', 'βσ(dBK) = 3,0·(σB(d)/1000)^0,38 · βτ(dBK) = 0,56·βσ + 0,1 · β(d) = β(dBK)·K3(dBK)/K3(d)', `dBK = 40 mm · σB(d) = ${f0(R.mat.sB)} MPa · βσ(dBK) = ${fx(k.b0, 3)} · βτ(dBK) = ${fx(k.t0, 3)}${k.f2 > 1 ? ' · × 1,15 (dois rasgos)' : ''}`, R.beta.b, 'βσ', 3, `βτ = ${fx(R.beta.t, 3)}. K3(d) = 1 − 0,2·lg β(dBK)·lg(d/7,5)/lg 20 (0,2·lg β acima de 150 mm).`, 'DIN 743-2:2012, tab. 1 e eq. 4');
    } else if (p.kind === 'ajuste') {
      const k = R.extra.fit;
      st('Fator de entalhe β (borda do ajuste prensado)', 'βσ(dBK) = 2,7·(σB(d)/1000)^0,43 · βτ(dBK) = 0,65·βσ · β(d) = β(dBK)·K3(dBK)/K3(d)', `dBK = 40 mm · σB(d) = ${f0(R.mat.sB)} MPa · βσ(dBK) = ${fx(k.b0, 3)} · βτ(dBK) = ${fx(k.t0, 3)}`, R.beta.b, 'βσ', 3, `βτ = ${fx(R.beta.t, 3)}. Na borda livre do cubo, onde o momento volta para o eixo.`, 'DIN 743-2:2012, tab. 1');
    } else if (p.kind === 'manual') st('Fator de entalhe β (informado)', 'βσ, βτ da aba Entalhes', `βσ = ${fx(R.beta.b, 3)} · βτ = ${fx(R.beta.t, 3)}`, R.beta.b, 'βσ', 3, 'Valores para o Ø da peça (sem correção K3).');
    else st('Seção lisa', 'β = 1', 'sem entalhe', 1, 'β', 0, R.notes.length ? R.notes.join('; ') + '.' : null);
    st('Tamanho, rugosidade e superfície', 'K2(d) = 1 − 0,2·lg(d/7,5)/lg 20 (0,8 a partir de 150 mm) · KFσ = 1 − 0,22·lg Rz·(lg(σB(d)/20) − 1) · KFτ = 0,575·KFσ + 0,425', `d = ${fx(s.d, 1)} mm · Rz = ${fx(d.rz, 1)} µm · KV = ${fx(d.kv, 2)}`, R.k2.b, 'K2', 3, `KFσ = ${fx(R.kf.s, 4)} · KFτ = ${fx(R.kf.t, 4)}.`, 'DIN 743-2:2012, eq. 7, 15 e 16');
    st('Fator de influência total K', 'Kσ = (βσ/K2 + 1/KFσ − 1)/KV · Kτ = (βτ/K2 + 1/KFτ − 1)/KV', `(${fx(R.beta.b, 3)}/${fx(R.k2.b, 3)} + 1/${fx(R.kf.s, 4)} − 1)/${fx(R.KV, 2)}`, R.K.b, 'Kσ', 3, `Kτ = (${fx(R.beta.t, 3)}/${fx(R.k2.t, 3)} + 1/${fx(R.kf.t, 4)} − 1)/${fx(R.KV, 2)} = ${fx(R.K.t, 3)}.`, 'DIN 743-2:2012, eq. 1 e 2');
    st('Limite de fadiga com entalhe', 'σbWK = σbW(d)/Kσ · τtWK = τtW(d)/Kτ · σbW = 0,5·σB(d) · τtW = 0,3·σB(d)', `${f0(R.W.b)} / ${fx(R.K.b, 3)} · ${f0(R.W.t)} / ${fx(R.K.t, 3)}`, R.WK.b, 'MPa (σbWK)', 1, `τtWK = ${fx(R.WK.t, 1)} MPa.`, 'DIN 743-1:2012, eq. 12 e 13');
    st('Sensibilidade à tensão média', 'ψσK = σWK/(2·σB(d) − σWK) · σmv = √((σzdm + σbm)² + 3·τtm²) · τmv = σmv/√3', `ψσbK = ${fx(R.psi.b, 4)} · ψτK = ${fx(R.psi.t, 4)}`, R.mv.s, 'MPa (σmv)', 2, `τmv = ${fx(R.mv.t, 2)} MPa.`, 'DIN 743-1:2012, eq. 17 a 19');
    st(`Amplitude admissível · caso ${d.loadCase === 'f1' ? '1' : '2'}`, d.loadCase === 'f1' ? 'σADK = σWK − ψσK·σmv (ou σFK − σmv no escoamento)' : 'σADK = σWK/(1 + ψσK·σmv/σa) (ou σFK/(1 + σmv/σa) no escoamento)', `ramo de ${R.ADK.b.branch}`, R.ADK.b.v, 'MPa (σbADK)', 1, R.s.tta > 0 ? `τtADK = ${fx(R.ADK.t.v, 1)} MPa (ramo de ${R.ADK.t.branch}).` : 'Sem amplitude de torção: o termo de torção da fadiga é nulo.', 'DIN 743-1:2012, eq. 20 a 23');
    st('Segurança à fadiga', 'S_D = 1/√[(σzda/σzdADK + σba/σbADK)² + (τta/τtADK)²]', `(${fx(R.s.sba, 2)}/${fx(R.ADK.b.v, 1)})${R.s.tta > 0 ? ` e (${fx(R.s.tta, 2)}/${fx(R.ADK.t.v, 1)})` : ''}`, p.SD, 'S_D', 2, `Mínimo ${fx(d.sMin, 2)} · utilização ${fx(R.uD, 2)}.`, 'DIN 743-1:2012, eq. 1');
    st('Escoamento com apoio', 'σbFK = K2F·γF·σS(d) · τtFK = K2F·γF·σS(d)/√3', `K2F ${fx(R.k2F.b, 1)} e ${fx(R.k2F.t, 1)} · γF ${fx(R.gF.b, 2)} · σS(d) = ${f0(R.mat.sS)} MPa`, R.FK.b, 'MPa (σbFK)', 1, `τtFK = ${fx(R.FK.t, 1)} MPa. K2F = 1,2 maciço (1,1 vazado na flexão; 1,0 na torção vazada); γF sobe com α nos entalhes circunferenciais.`, 'DIN 743-1:2012, eq. 4 a 6 e tab. 1 e 2');
    st('Segurança ao escoamento', 'S_F = 1/√[(σzdmáx/σzdFK + σbmáx/σbFK)² + (τtmáx/τtFK)²]', `(${fx(R.s.sbmax, 2)}/${fx(R.FK.b, 1)}) e (${fx(R.s.ttmax, 2)}/${fx(R.FK.t, 1)})`, p.SF, 'S_F', 2, `Mínimo ${fx(d.sMin, 2)} · utilização ${fx(R.uF, 2)}. Pico admissível com S_F mínimo: ${isNum(R.peakAdm) ? fx(R.peakAdm, 2) + ' × T' : 'sem torque'}.`, 'DIN 743-1:2012, eq. 2');
    st('Ø estimado para S mínimo', 'd ≈ d · (Smin/S)^(1/3)', `${fx(s.d, 1)} · (${fx(d.sMin, 2)} / ${fsf(Math.min(p.SD, p.SF))})^(1/3)`, R.dReq, 'mm', 1, 'Estimativa com tensões ∝ 1/d³ (os fatores mudam pouco com d).');
    return out;
  }
  // memória de um trecho: o pior ponto DIN 743 do trecho, ou Shigley
  function sectionSteps(r, s) {
    if (r.strength.method === 'din743') { const p = r.din[s.worst]; return p ? pointSteps(r, p) : []; }
    const d = r.d, out = [];
    const st = (title, formula, subst, value, unit, dd, comment, source) => out.push({ section: 'trecho', title, formula, subst, value, unit, d: dd, comment, source });
    st('Área e inércia', s.flat ? 'A, I com quatro planos (segmentos circulares)' : 'A = π(d² − di²)/4 · I = π(d⁴ − di⁴)/64', `d = ${fx(s.d, 3)}${s.di ? ` · di = ${fx(s.di, 2)}` : ''}${s.flat ? ` · planos ${fx(s.flats, 1)}` : ''} mm`, s.I / 1e4, '·10⁴ mm⁴', 1, `A = ${fx(s.A, 0)} mm² · J = ${fx(s.J / 1e4, 1)}·10⁴ mm⁴${s.flat ? ' (círculo inscrito)' : ''}.`);
    st('Momento máximo no trecho', 'M = máx |M(x)|, x de a até b', `MEF: M recuperado em cada elemento do trecho · x = ${fx(s.xm, 1)} mm`, s.m / 1e6, 'kN·m', 3);
    st('Torque no trecho', s.tpct !== null && s.tpct !== undefined ? 'T = T · fração do trecho' : d.torqueMode === 'mef' ? 'T(x) pelo MEF de torção' : 'T = T nominal (integral)', `${fx(r.T / 1000, 2)} kN·m${s.tpct !== null && s.tpct !== undefined ? ` · ${fx(s.tpct, 0)} %` : ''}`, s.torque / 1000, 'kN·m', 2);
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
    return out;
  }

  /* ---- Mapa de críticas e convergência ----------------------------------------------------------------- */
  function criticalMap(r, n = 33) {
    if (!FEM || !r.dyn) return null;
    const d = r.d, ks = Array.from({ length: n }, (_, i) => Math.pow(10, 7 + 4 * i / (n - 1)));
    const model = r.dyn.model.info.ne > 300 ? feModel(d, d.secs, r.loads, 200, 'conforme', { plain: true }) : r.dyn.model;
    return FEM.criticalMap(model, { ks, q: 3, foundation: false, shear: d.beam !== 'euler' });
  }
  // chave do que muda o modelo: geometria, material elástico, pacote, assentos, mancais e malha
  const mapKey = d => JSON.stringify([d.secs.map(s => [s.b, s.d, s.di, s.flats]), d.E, d.rho, d.rotorMass, d.rotorFrom, d.rotorTo, d.rotorOD, d.mount, d.fits.map(f => [f.x, f.d, f.L, f.hub]), d.hubPct, d.krFactor, d.xA, d.xB, d.beam, d.mesh, d.nElem, (d.meshRefine || []).map(z => [z.a, z.b, z.h]), (d.meshNodes || []).map(p => p.x)]);
  const CONV_KEYS = ['ySpan', 'yTip', 'thA', 'Mmax', 'RA', 'nc1', 'nc2'];
  const CONV_FLOOR = 1e-6, CONV_CAP = 1100;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  // a malha do usuário inteira refinada na mesma proporção, de 1/16 a 16 vezes, até ~1.100 elementos
  function convergence(r) {
    const d = r.d;
    if (!FEM) return null;
    const t0 = now(), secs = d.secs, shear = d.beam !== 'euler', springs = springsOf(d), seats = r.seats.length > 0;
    const keys = seats ? CONV_KEYS.concat(['Fseat']) : CONV_KEYS.slice();
    const rows = [];
    for (const f of [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16]) {
      const n = Math.max(1, Math.round(d.nElem * f));
      if (f !== 1 && n < 4) continue;
      const model = feModel(d, secs, r.loads, n, null, { scale: f });
      if (f > 1 && model.info.ne > CONV_CAP) break;
      const fe = feStatic(d, secs, r.loads, model);
      if (!fe.ok) continue;
      const c = FEM.criticals(model, { q: 2, springs, foundation: false, shear });
      const row = { f, n, ne: model.info.ne, nn: model.info.nn, ndof: fe.st.ndof, hmin: model.info.hmin, hmax: model.info.hmax, cur: f === 1,
        ySpan: fe.defl.span, yTip: fe.defl.tip, thA: Math.abs(fe.defl.thA) * 1000, RA: fe.RA / 1000,
        Mmax: Math.abs(fe.Mmax[1]), nc1: c.ok ? c.rpm[0] : NaN, nc2: c.ok ? c.rpm[1] : NaN };
      if (seats && fe.seats) row.Fseat = Math.max(...fe.seats.map(s => Math.abs(s.F))) / 1000;
      const prev = rows[rows.length - 1];
      if (prev && prev.ne === row.ne) { if (row.cur) { prev.cur = true; prev.f = 1; prev.n = n; } continue; }
      rows.push(row);
    }
    if (!rows.length) return null;
    const ref = rows[rows.length - 1], tol = d.convTol / 100, conv = {}, order = {}, exact = {};
    for (const k of keys) {
      rows.forEach((row, i) => {
        row[k + 'Err'] = Math.abs(row[k] - ref[k]) / Math.max(1e-30, Math.abs(ref[k]));
        row[k + 'Chg'] = i ? Math.abs(row[k] - rows[i - 1][k]) / Math.max(1e-30, Math.abs(row[k])) : NaN;
      });
      let at = null;
      for (let i = rows.length - 2; i >= 0; i--) { if (rows[i + 1][k + 'Chg'] <= tol) at = rows[i]; else break; }
      conv[k] = at;
      exact[k] = rows.every(row => !(row[k + 'Err'] > CONV_FLOOR));
      const pts = rows.slice(0, -2).filter(row => row[k + 'Err'] > 2 * CONV_FLOOR).map(row => [Math.log(row.ne), Math.log(row[k + 'Err'])]);
      order[k] = null;
      if (pts.length >= 3) {
        const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        let sxy = 0, sxx = 0, syy = 0;
        for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
        const r2 = sxx > 0 && syy > 0 ? sxy * sxy / (sxx * syy) : 0;
        if (sxx > 0 && -sxy / sxx > 0) order[k] = { p: -sxy / sxx, r2, n: pts.length };
      }
    }
    return { rows, ref, keys, conv, order, exact, floor: CONV_FLOOR, tol, type: d.mesh, beam: d.beam, zones: (d.meshRefine || []).length, seats, ms: now() - t0 };
  }
  const convKey = d => JSON.stringify([mapKey(d), d.ump, d.umpDist, d.xUmp, d.coupleF, d.coupleEnd, d.kBearing, d.convTol]);

  /* ---- Casos de verificação --------------------------------------------------------------------------- */
  // soluções exatas conhecidas calculadas pelo mesmo código do MEF e da DIN 743; erro relativo e tolerância por grandeza
  function verification(r) {
    const t0 = now(), cases = [];
    const E = 210000, nu = 0.3, rho = 7850, Gp = E * 1e6 / (2 * (1 + nu)), kapS = 6 * (1 + nu) / (7 + 6 * nu);
    const sec = (a, b, dd, di = 0) => ({ a, b, d: dd, di, A: PI * (dd * dd - di * di) / 4, I: PI * (dd ** 4 - di ** 4) / 64, J: PI * (dd ** 4 - di ** 4) / 32 });
    const EIof = dd => E * 1e6 * PI * (dd / 1000) ** 4 / 64, GAof = dd => kapS * Gp * PI * (dd / 1000) ** 2 / 4;
    const row = (label, unit, exact, calc, tol, scale) => { const err = Math.abs(calc - exact) / Math.max(1e-300, Math.abs(scale ?? exact)); return { label, unit, exact, calc, err, tol, ok: err <= tol }; };
    const add = (id, group, title, what, ref, rows, note) => cases.push({ id, group, title, what, ref, rows, note, ok: rows.every(x => x.ok) });
    const L1 = 2000, d1 = 100, q1 = -10000;
    // 1 · bi-apoiada, carga uniforme, Euler–Bernoulli
    {
      const m = FEM.buildModel({ L: L1, secs: [sec(0, L1, d1)], E, nu, rho, bearings: [0, L1], n: 8 });
      const s = FEM.staticSolve(m, { q: () => q1, shear: false }), i = m.near(L1 / 2), Lm = L1 / 1000, EI = EIof(d1);
      const Mmid = s.nodal.M[i];
      add('ss-eb', 'Flexão', 'Viga bi-apoiada · carga uniforme · Euler–Bernoulli', '8 elementos, L = 2 m, Ø100, q = 10 kN/m', 'Timoshenko & Gere, Mechanics of Materials', [
        row('Flecha no meio', 'mm', 5 * q1 * Lm ** 4 / (384 * EI) * 1000, s.v[i] * 1000, 1e-9),
        row('Momento no meio', 'kN·m', -q1 * Lm * Lm / 8 / 1000, Mmid / 1000, 1e-9),
        row('Reação', 'kN', -q1 * Lm / 2 / 1000, s.R[0] / 1000, 1e-9),
        row('Inclinação no apoio', 'mrad', -q1 * Lm ** 3 / (24 * EI) * 1000, -s.th[0] * 1000, 1e-9)
      ], 'Hermite cúbica: nos nós a solução é exata para carga uniforme, com qualquer malha.');
    }
    // 2 · bi-apoiada curta, Timoshenko
    {
      const L = 600, dd = 150, m = FEM.buildModel({ L, secs: [sec(0, L, dd)], E, nu, rho, bearings: [0, L], n: 8 });
      const s = FEM.staticSolve(m, { q: () => q1 }), i = m.near(L / 2), Lm = L / 1000, EI = EIof(dd), kGA = GAof(dd);
      add('ss-tim', 'Flexão', 'Viga bi-apoiada curta · Timoshenko', '8 elementos, L/d = 4, κ de Cowper', 'Timoshenko & Gere · Cowper (1966)', [
        row('Flecha no meio (flexão + cisalhamento)', 'mm', (5 * q1 * Lm ** 4 / (384 * EI) + q1 * Lm * Lm / (8 * kGA)) * 1000, s.v[i] * 1000, 1e-9),
        row('Parcela de cisalhamento', '%', 100 * (q1 * Lm * Lm / (8 * kGA)) / (5 * q1 * Lm ** 4 / (384 * EI) + q1 * Lm * Lm / (8 * kGA)), 100 * (1 - (5 * q1 * Lm ** 4 / (384 * EI)) / s.v[i]), 1e-7)
      ], 'Interpolação interdependente: exata nos nós também com cisalhamento.');
    }
    // 3 · balanço com carga na ponta (viga com balanço)
    {
      const Ls = 1000, a = 300, P = -20000, dd = 120, m = FEM.buildModel({ L: Ls + a, secs: [sec(0, Ls + a, dd)], E, nu, rho, bearings: [0, Ls], n: 13 });
      const sE = FEM.staticSolve(m, { points: [{ x: Ls + a, F: P }], shear: false }), sT = FEM.staticSolve(m, { points: [{ x: Ls + a, F: P }] });
      const tip = m.nNodes - 1, EI = EIof(dd), kGA = GAof(dd), Lm = Ls / 1000, am = a / 1000;
      add('overhang', 'Flexão', 'Viga com balanço · carga na ponta', 'vão 1 m, balanço 0,3 m, Ø120, P = 20 kN', 'Roark’s Formulas for Stress and Strain, tab. 8', [
        row('Flecha na ponta · Euler–Bernoulli', 'mm', P * am * am * (Lm + am) / (3 * EI) * 1000, sE.v[tip] * 1000, 1e-9),
        row('Flecha na ponta · Timoshenko', 'mm', (P * am * am * (Lm + am) / (3 * EI) + P * am * (Lm + am) / (Lm * kGA)) * 1000, sT.v[tip] * 1000, 1e-9),
        row('Momento no apoio B', 'kN·m', -P * am / 1000, -sE.nodal.M[m.near(Ls)] / 1000, 1e-9),
        row('Reação em B', 'kN', -P * (Lm + am) / Lm / 1000, sE.R[1] / 1000, 1e-9)
      ]);
    }
    // 4 · eixo escalonado, carga no meio (trabalho virtual exato)
    {
      const P = -50000, m = FEM.buildModel({ L: 1200, secs: [sec(0, 400, 120), sec(400, 800, 160), sec(800, 1200, 120)], E, nu, rho, bearings: [0, 1200], n: 12 });
      const sE = FEM.staticSolve(m, { points: [{ x: 600, F: P }], shear: false }), sT = FEM.staticSolve(m, { points: [{ x: 600, F: P }] }), i = m.near(600);
      const EI1 = EIof(120), EI2 = EIof(160), kG1 = GAof(120), kG2 = GAof(160);
      const vb = (P / 2) * ((0.4 ** 3 / 3) / EI1 + ((0.6 ** 3 - 0.4 ** 3) / 3) / EI2), vs = (P / 2) * (0.4 / kG1 + 0.2 / kG2);
      add('stepped', 'Flexão', 'Eixo escalonado · carga no meio', 'Ø120–Ø160–Ø120, vão 1,2 m, P = 50 kN', 'Método da carga unitária (trabalho virtual)', [
        row('Flecha no meio · Euler–Bernoulli', 'mm', vb * 1000, sE.v[i] * 1000, 1e-9),
        row('Flecha no meio · Timoshenko', 'mm', (vb + vs) * 1000, sT.v[i] * 1000, 1e-9)
      ], 'Rigidez do elemento pela média harmônica dos trechos: exata quando o degrau cai num nó.');
    }
    // 5 · frequências naturais, Euler–Bernoulli
    {
      const m = FEM.buildModel({ L: L1, secs: [sec(0, L1, d1)], E, nu, rho, bearings: [0, L1], n: 40 });
      const c = FEM.criticals(m, { q: 3, shear: false, rotary: false });
      const A = PI * (d1 / 1000) ** 2 / 4, ex = k => (k * PI / (L1 / 1000)) ** 2 * Math.sqrt(EIof(d1) / (rho * A)) * 60 / (2 * PI);
      add('freq-eb', 'Dinâmica', 'Frequências naturais · bi-apoiada · Euler–Bernoulli', '40 elementos, massa consistente, sem inércia de rotação', 'Rao, Vibration of Continuous Systems, cap. 11', [1, 2, 3].map(k => row(`${k}º modo`, 'rpm', ex(k), c.rpm[k - 1], 1e-5)), 'Massa consistente: o erro cai com h⁴.');
    }
    // 6 · frequências naturais, Timoshenko (cisalhamento + inércia de rotação)
    {
      const L = 1000, dd = 250, m = FEM.buildModel({ L, secs: [sec(0, L, dd)], E, nu, rho, bearings: [0, L], n: 160 });
      const c = FEM.criticals(m, { q: 3 });
      const Lm = L / 1000, dm = dd / 1000, A = PI * dm * dm / 4, I = PI * dm ** 4 / 64;
      const ex = k => { const kk = k * PI / Lm, a = rho * rho * I / (kapS * Gp), b = rho * A + rho * I * kk * kk + rho * E * 1e6 * I * kk * kk / (kapS * Gp), cc = E * 1e6 * I * kk ** 4; return Math.sqrt((b - Math.sqrt(b * b - 4 * a * cc)) / (2 * a)) * 60 / (2 * PI); };
      add('freq-tim', 'Dinâmica', 'Frequências naturais · bi-apoiada · Timoshenko', '160 elementos, L/d = 4, massa consistente do elemento de Timoshenko', 'Timoshenko (1921) · Han, Benaroya & Wei, J. Sound Vib. 225 (1999)', [1, 2, 3].map(k => row(`${k}º modo`, 'rpm', ex(k), c.rpm[k - 1], 2e-4)),
        'Com a massa de Hermite (versão anterior) o 3º modo ficava 10 % abaixo, sem convergir; com a massa do próprio elemento o erro cai com h².');
    }
    // 7 · corpo rígido em molas
    {
      const L = 1000, dd = 200, k = 1e5, m = FEM.buildModel({ L, secs: [sec(0, L, dd)], E, nu, rho, bearings: [0, L], n: 20 });
      const c = FEM.criticals(m, { q: 2, springs: [k, k], shear: false, rotary: false }), mass = rho * PI * (dd / 1000) ** 2 / 4 * L / 1000;
      add('rigid', 'Dinâmica', 'Rotor rígido em mancais macios', 'k = 100 kN/m por mancal, eixo Ø200 × 1 m', 'Corpo rígido: ω₁ = √(2k/m), ω₂ = √(6k/m)', [
        row('Translação', 'rpm', Math.sqrt(2 * k / mass) * 60 / (2 * PI), c.rpm[0], 1e-4), row('Basculamento', 'rpm', Math.sqrt(6 * k / mass) * 60 / (2 * PI), c.rpm[1], 1e-4)
      ], 'A flexão do eixo é desprezível perto das molas; o erro restante é essa flexão.');
    }
    // 8 · Jeffcott
    {
      const L = 1000, dd = 50, Mdisk = 100, rs = 100, m = FEM.buildModel({ L, secs: [sec(0, L, dd)], E, nu, rho: rs, bearings: [0, L], n: 40, addMass: [{ a: 498, b: 502, kgPerMm: Mdisk / 4 }] });
      const c = FEM.criticals(m, { q: 2, shear: false, rotary: false }), ms = rs * PI * (dd / 1000) ** 2 / 4 * L / 1000;
      add('jeffcott', 'Dinâmica', 'Rotor de Jeffcott', `disco de 100 kg no meio de um eixo Ø50 × 1 m quase sem massa (${fx(ms, 2)} kg)`, 'ω = √(48EI/((M + 17/35·meixo)·L³))', [row('1ª crítica', 'rpm', Math.sqrt(48 * EIof(dd) / ((Mdisk + 17 / 35 * ms) * (L / 1000) ** 3)) * 60 / (2 * PI), c.ok ? c.rpm[0] : NaN, 1e-4)], 'Disco espalhado em 4 mm e massa do eixo pela correção de Rayleigh: diferenças de segunda ordem.');
    }
    // 9 · torção escalonada
    {
      const T = 5000, secs = [sec(0, 200, 80), sec(200, 500, 120), sec(500, 800, 100, 40)], m = FEM.buildModel({ L: 800, secs, E, nu, rho, bearings: [100, 700], n: 40 });
      const t = FEM.torsionSolve(m, { nodal: [{ node: 0, T }, { node: m.nNodes - 1, T: -T }], fix: 0 });
      add('tors-step', 'Torção', 'Torção de eixo escalonado (com furo)', 'Ø80–Ø120–Ø100×40, T = 5 kN·m', 'φ = Σ T·Li/(G·Ji)', [row('Giro entre as pontas', 'mrad', secs.reduce((a, c) => a + T * (c.b - c.a) / 1000 / (Gp * c.J * 1e-12), 0) * 1000, Math.abs(t.phi[m.nNodes - 1]) * 1000, 1e-9)]);
    }
    // 10 · torção com cubo elástico colado (transferência pelo contato)
    {
      const L = 600, dd = 100, Dh = 200, a = 100, b = 500, T = 10000, ell = (b - a) / 1000;
      const GJs = Gp * PI * (dd / 1000) ** 4 / 32, GJh = Gp * PI * ((Dh / 1000) ** 4 - (dd / 1000) ** 4) / 32, kt = PI / 8 * Gp * (dd / 1000) ** 2;
      const mu = Math.sqrt(kt * (1 / GJs + 1 / GJh)), rs = GJh / (GJs + GJh), rh = GJs / (GJs + GJh);
      const exT = xmm => { if (xmm <= a) return T; if (xmm >= b) return 0; const x = (xmm - a) / 1000; return T * (1 - rh * x / ell - rs * (1 - Math.sinh(mu * (ell - x)) / Math.sinh(mu * ell))); };
      const m = FEM.buildModel({ L, secs: [sec(0, L, dd)], E, nu, rho, bearings: [0, L], n: 480, hub: { a, b, seats: [{ a, b, d: dd, Dh, name: 'W' }], c: 1 } });
      const t = FEM.torsionSolve(m, { nodal: [{ node: 0, T }], dist: [{ a, b, T: -T, on: 'hub' }], fix: 0 });
      const at = x => { const i = m.near(x); return { x: m.xs[i], v: t.Tl[i] }; };
      const p1 = at(a + 25), p2 = at(a + 50), p3 = at(a + 200);
      add('tors-hub', 'Assentos', 'Torque passando do eixo para um cubo colado', 'Ø100 com cubo Ø200 de 400 mm, contato kt = (π/8)·G·d², T = 10 kN·m', 'Equação de shear lag: T″ = μ²·(T − T∞), forma fechada', [
        row(`Torque no eixo a ${fx(p1.x - a, 0)} mm da borda`, 'kN·m', exT(p1.x) / 1000, p1.v / 1000, 1e-4, T / 1000),
        row(`Torque no eixo a ${fx(p2.x - a, 0)} mm da borda`, 'kN·m', exT(p2.x) / 1000, p2.v / 1000, 1e-4, T / 1000),
        row(`Torque no eixo a ${fx(p3.x - a, 0)} mm da borda`, 'kN·m', exT(p3.x) / 1000, p3.v / 1000, 1e-4, T / 1000),
        row('Torque transferido ao cubo', 'kN·m', T / 1000, t.seatT[0] / 1000, 1e-9)
      ], `Erro relativo ao torque aplicado. 1/μ = ${fx(1000 / mu, 1)} mm: o torque sai do eixo nas bordas do assento, não no meio.`);
    }
    // 11 · luva colada (duas vigas): no limite de contato rígido, EI = EI eixo + EI cubo
    {
      const L = 1000, dd = 100, Dh = 160, q = -10000, m = FEM.buildModel({ L, secs: [sec(0, L, dd)], E, nu, rho, bearings: [0, L], n: 100, hub: { a: 0, b: L, seats: [{ a: 0, b: L, d: dd, Dh, name: 'S' }], c: 1, kr: 1000 } });
      const s = FEM.staticSolve(m, { qh: () => q, shear: false }), i = m.near(L / 2);
      const EIt = E * 1e6 * PI * (Dh / 1000) ** 4 / 64;
      add('sleeve', 'Assentos', 'Luva colada em todo o comprimento', 'eixo Ø100 + cubo Ø160, contato kr × 1000 (quase rígido), carga no cubo', 'Viga composta concêntrica: EI = E·π·Dcubo⁴/64', [
        row('Flecha no meio', 'mm', 5 * q * (L / 1000) ** 4 / (384 * EIt) * 1000, s.v[i] * 1000, 2e-4),
        row('Carga que chega ao eixo', 'kN', -q * L / 1e6, -s.seatF[0] / 1000, 1e-7)
      ], 'O erro some como 1/kr; com o kr padrão (×1) a luva fica cerca de 1 % mais flexível que colada.');
    }
    // 12 · três assentos curtos (hiperestático) × método das forças
    {
      const Lm = 2.0, dm = 0.15, Dhm = 0.2, a = 0.5, b = 1.5, xs3 = [0.52, 1.0, 1.48], w = 20000;
      const EIs = E * 1e6 * PI * dm ** 4 / 64, EIh = E * 1e6 * PI * (Dhm ** 4 - dm ** 4) / 64;
      const ssDef = (xx, aa, P) => { const bb = Lm - aa; if (xx <= aa) return P * bb * xx * (Lm * Lm - bb * bb - xx * xx) / (6 * Lm * EIs); const xr = Lm - xx; return P * aa * xr * (Lm * Lm - aa * aa - xr * xr) / (6 * Lm * EIs); };
      const s3 = xs3[2] - xs3[0], xi = xs3[1] - xs3[0], o1 = xs3[0] - a, o3 = b - xs3[2], M1 = -w * o1 * o1 / 2, M3 = -w * o3 * o3 / 2;
      const dhW = w * xi * (s3 ** 3 - 2 * s3 * xi * xi + xi ** 3) / (24 * EIh) + M1 * xi * (s3 - xi) * (2 * s3 - xi) / (6 * s3 * EIh) + M3 * xi * (s3 - xi) * (s3 + xi) / (6 * s3 * EIh);
      const fh = xi * xi * (s3 - xi) ** 2 / (3 * s3 * EIh), W = w * (b - a), xc = (a + b) / 2;
      const F13 = F2 => { const Rr = W - F2, Mo = W * xc - F2 * xs3[1], F3 = (Mo - Rr * xs3[0]) / (xs3[2] - xs3[0]); return [Rr - F3, F3]; };
      const dS = F2 => { const [Fa, Fc] = F13(F2), Fs = [Fa, F2, Fc], v = xs3.map(xx => Fs.reduce((acc, P, j) => acc + ssDef(xx, xs3[j], P), 0)); return v[1] - (v[0] * (xs3[2] - xs3[1]) + v[2] * (xs3[1] - xs3[0])) / (xs3[2] - xs3[0]); };
      const g = F2 => (dhW - F2 * fh) - dS(F2), F2 = -g(0) / (g(1) - g(0)), Fx = [F13(F2)[0], F2, F13(F2)[1]];
      const half = 0.25, m = FEM.buildModel({ L: 2000, secs: [sec(0, 2000, 150)], E, nu, rho, bearings: [0, 2000], n: 400, hub: { a: 500, b: 1500, seats: xs3.map((x, k) => ({ a: x * 1000 - half, b: x * 1000 + half, d: 150, Dh: 200, name: 'W' + (k + 1) })), c: 1, kr: 6400 } });
      const s = FEM.staticSolve(m, { qh: () => -w, shear: false });
      add('three-seats', 'Assentos', 'Cubo em três assentos curtos (hiperestático)', 'eixo Ø150 bi-apoiado em 2 m, cubo Ø200 de 1 m em 3 assentos de 0,5 mm, 20 kN no cubo', 'Método das forças com fórmulas de viga, independente do MEF', [0, 1, 2].map(k => row(`Assento W${k + 1}`, 'kN', Fx[k] / 1000, -s.seatF[k] / 1000, 2e-3, W / 1000)),
        'Erro relativo à carga total. Assentos curtos e rígidos viram apoios pontuais; o do meio fica tracionado porque o eixo flete mais que o cubo. Com assentos reais (longos) o contato também transmite momento.');
    }
    // 13 · equilíbrio do caso atual
    if (r && r.fe && r.fe.ok) {
      const rows = [row('Reações × cargas (ΣR + ΣF)', 'kN', 0, (r.fe.RA + r.fe.RB + r.fe.st.Ftot) / 1000, 1e-8, r.fe.st.Ftot / 1000)];
      if (r.seats.length) rows.push(row('Σ cargas nos assentos × carga no cubo', 'kN', r.fe.Wcore / 1000, r.seats.reduce((a, z) => a + z.F, 0) / 1000, 1e-8));
      if (r.tor) {
        rows.push(row('Torque que sobra depois da última seção', 'kN·m', 0, r.tor.closure / 1000, 1e-8, r.T / 1000));
        if (r.tor.seats.length) rows.push(row('Σ torques nos assentos × torque do pacote', 'kN·m', (1 - r.d.auxTorque / 100) * r.T / 1000, r.tor.seats.reduce((a, z) => a + z.T, 0) / 1000, 1e-8));
      }
      rows.push(row('Reações MEF × equilíbrio analítico (RA)', 'kN', r.an.RA / 1000, r.fe.RA / 1000, r.d.mesh === 'uniforme' ? 1e-2 : 1e-8));
      add('balance', 'Caso atual', 'Equilíbrio do caso calculado', `${r.fe.info.ne} elementos${r.seats.length ? `, ${r.seats.length} assentos` : ''}`, 'ΣF = 0 e ΣT = 0', rows, 'Resíduos que não são arredondamento indicariam erro de montagem do modelo.');
    }
    // 14 · DIN 743, exemplo do Beiblatt 1
    {
      const k1 = DIN.K1('beneficiado', 50, 'B').k, Wm = DIN.moduli(42);
      const p = DIN.evaluate({ kind: 'ombro', d: 42, D: 50, r: 5, di: 0, ...Wm, M: 0, T: 0, F: 0 }, { sB: 1000, sS: 800, basis: 'norma', group: 'beneficiado', deff: 50, K1S: k1 }, { Rz: 5, KV: 1, lc: 2, ripple: 0, peak: 1, Smin: 1.2 });
      add('din-ex', 'DIN 743', 'DIN 743 · exemplo do Beiblatt 1', 'ombro D50/d42, r = 5 mm, 34CrMo4 (σB 1000, σS 800 MPa), Rz 5 µm, deff 50 mm', 'DIN 743 Beiblatt 1:2012, exemplo 4.1 (valores publicados, 3 casas)', [
        row('K1(deff)', '', 0.871, p.mat.k1B, 5e-3), row('K2(d)', '', 0.885, p.k2.b, 5e-3), row('KFσ', '', 0.902, p.kf.s, 5e-3), row('KFτ', '', 0.944, p.kf.t, 5e-3),
        row('ασ (flexão)', '', 1.557, p.alpha.b, 5e-3), row('ατ (torção)', '', 1.283, p.alpha.t, 5e-3), row('G′σ', 'mm⁻¹', 0.542, p.G.b, 5e-3), row('G′τ', 'mm⁻¹', 0.23, p.G.t, 5e-3),
        row('nσ', '', 1.036, p.n.b, 5e-3), row('nτ', '', 1.024, p.n.t, 5e-3), row('βσ', '', 1.503, p.beta.b, 5e-3), row('βτ', '', 1.253, p.beta.t, 5e-3),
        row('Kσ', '', 1.809, p.K.b, 5e-3), row('Kτ', '', 1.475, p.K.t, 5e-3)
      ], 'Como no exemplo, σS(d) usa o mesmo K1 da ruptura. No cálculo do eixo, com valores de norma, o aço beneficiado usa o K1 próprio do escoamento (menor, a favor da segurança).');
    }
    return { cases, ms: now() - t0, ok: cases.every(c => c.ok), n: cases.reduce((a, c) => a + c.rows.length, 0), nBad: cases.reduce((a, c) => a + c.rows.filter(x => !x.ok).length, 0) };
  }

  /* ---- Comparação com resultados externos (ANSYS, KISSsoft, planilha) ---------------------------------- */
  const COMPARE_QTY = {
    y: { label: 'Flecha', unit: 'mm', units: { mm: 1, 'µm': 1e-3, m: 1000 } },
    m: { label: 'Momento fletor', unit: 'kN·m', units: { 'kN·m': 1, 'N·m': 1e-3, 'N·mm': 1e-6 } },
    v: { label: 'Cortante', unit: 'kN', units: { kN: 1, N: 1e-3 } },
    t: { label: 'Torque', unit: 'kN·m', units: { 'kN·m': 1, 'N·m': 1e-3, 'N·mm': 1e-6 } },
    th: { label: 'Inclinação', unit: 'mrad', units: { mrad: 1, rad: 1000, '°': 1000 * PI / 180 } }
  };
  const COMPARE_KEYS = [
    ['RA', 'Reação em A', 'kN', r => Math.abs(r.RA) / 1000], ['RB', 'Reação em B', 'kN', r => Math.abs(r.RB) / 1000],
    ['Mmax', 'Momento máximo', 'kN·m', r => Math.abs(r.Mmax.v) / 1e6], ['ySpan', 'Flecha no vão', 'mm', r => r.defl.span], ['yMax', 'Flecha máxima', 'mm', r => r.defl.max],
    ['thA', 'Inclinação em A', 'mrad', r => Math.abs(r.defl.thA) * 1000], ['nc1', '1ª crítica', 'rpm', r => r.dyn && r.dyn.design && r.dyn.design.ok ? r.dyn.design.rpm[0] : NaN],
    ['nc2', '2ª crítica', 'rpm', r => r.dyn && r.dyn.design && r.dyn.design.ok ? r.dyn.design.rpm[1] : NaN], ['Smin', 'S mínimo', '', r => r.strength.method === 'din743' && r.dinCrit ? Math.min(r.dinCrit.SD, r.dinCrit.SF) : Math.min(...r.res.map(s => Math.min(s.sfy, s.sff)))]
  ];
  // spec: { qty, unit, sign (±1), shift (mm, origem do x externo), pts: [[x, v]], keys: { RA: v, … } }
  function compareExternal(r, spec) {
    const out = { series: null, keys: [] };
    const Q = COMPARE_QTY[spec.qty];
    if (Q && Array.isArray(spec.pts) && spec.pts.length && r.series[spec.qty]) {
      const ser = r.series[spec.qty], f = (Q.units[spec.unit] ?? 1) * (spec.sign === -1 ? -1 : 1), sh = spec.shift || 0;
      const at = (x, ref) => {           // nos degraus (dois valores no mesmo x), o mais perto do valor externo
        let lo = 0, hi = ser.length - 1;
        if (x <= ser[0][0]) return ser[0][1];
        if (x >= ser[hi][0]) return ser[hi][1];
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ser[m][0] <= x) lo = m; else hi = m; }
        const same = ser.filter(p => Math.abs(p[0] - x) < 1e-6);
        if (same.length > 1) return same.reduce((a, p) => Math.abs(p[1] - ref) < Math.abs(a[1] - ref) ? p : a)[1];
        const a = ser[lo], b = ser[hi];
        return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      };
      const rows = spec.pts.filter(p => isNum(p[0]) && isNum(p[1])).map(([x0, v]) => { const x = x0 + sh, ext = v * f, model = at(x, ext); return { x, ext, model, diff: model - ext }; }).sort((a, b) => a.x - b.x);
      const scale = Math.max(...ser.map(p => Math.abs(p[1])), 1e-30);
      const maxAbs = rows.reduce((a, q) => Math.max(a, Math.abs(q.diff)), 0), rms = Math.sqrt(rows.reduce((a, q) => a + q.diff * q.diff, 0) / Math.max(1, rows.length));
      const worst = rows.reduce((a, q) => !a || Math.abs(q.diff) > Math.abs(a.diff) ? q : a, null);
      out.series = { qty: spec.qty, label: Q.label, unit: Q.unit, rows, maxAbs, rms, rel: maxAbs / scale, scale, worst, n: rows.length };
    }
    for (const [k, label, unit, get] of COMPARE_KEYS) {
      const v = spec.keys ? spec.keys[k] : null;
      if (!isNum(v)) continue;
      const m = get(r);
      out.keys.push({ k, label, unit, ext: v, model: m, diff: m - v, rel: v ? (m - v) / Math.abs(v) : NaN });
    }
    return out;
  }

  return {
    GROUPS, FIELDS, FIELD, INPUTS, EXAMPLE, InputError, calculate, sectionSteps, pointSteps, props, validate, criticalMap, mapKey, convergence, convKey, CONV_KEYS,
    minElems: r => (FEM ? feModel(r.d, r.d.secs, r.loads, 1, 'conforme', { scale: 0 }).info.ne : NaN),
    verification, compareExternal, COMPARE_QTY, COMPARE_KEYS, KINDS,
    REFINE_COLS, NODE_COLS, NOTCH_COLS, MESH_SNAP, MAX_ELEMS,
    SECTION_COLS, KEY_COLS, FIT_COLS, EXAMPLE_SECTIONS, EXAMPLE_KEYS, EXAMPLE_FITS, EXAMPLE_NOTCHES, MATERIALS, FINISH, RELIAB, CRITERIA, DIN,
    fx, f0, fsf, code, G0
  };
});
