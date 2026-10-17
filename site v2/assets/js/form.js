/*!
 * VG · Formulário de dados do laboratório
 * Esquema declarativo → DOM acessível (rótulos, dicas, erros por campo), estado único,
 * leitura de números no padrão brasileiro e serialização do caso no endereço (#…).
 */
(function (raiz) {
  'use strict';
  const E = raiz.VGEngine;

  // ── Caso de exemplo (gerador de 5 MVA, 4 polos, 60 Hz; mancal da Planilha2) ──────────────
  const EXEMPLO = {
    potencia: 5000, unidade_potencia: 'kVA', tipo_maquina: 'Gerador', converter_kva: false,
    modo_rotacao: 'polos', frequencia: 60, polos: 4, escorregamento: 0,
    aplicacao: 'GERADORES', material: 'AISI 1045', criterio: 'SECAO_5',
    mancal_ativo: true, mancal_carga: 80000, mancal_bd: 0.8785
  };
  const UI_PADRAO = { carga_modo: 'carga' };
  const PADRAO = Object.freeze(Object.assign({}, E.ENTRADA_PADRAO, EXEMPLO, UI_PADRAO));
  const NUMERICOS = new Set(['potencia', 'cos_phi', 'rendimento', 'frequencia', 'polos', 'escorregamento', 'rotacao', 'fs_personalizado',
    'mat_escoamento', 'mat_ruptura', 'mat_temp_min', 'tau_personalizado', 'fator_seguranca', 'temp_min_operacao', 'diametro_existente',
    'torque_pico_pu', 'mancal_diametro', 'mancal_largura', 'mancal_bd', 'mancal_carga', 'mancal_massa_rotor', 'mancal_fracao',
    'mancal_fator_carga', 'mancal_vg', 'mancal_psi', 'mancal_temp_efetiva', 'mancal_area_caixa', 'mancal_alfa', 'mancal_temp_ambiente',
    'mancal_volume_oleo', 'mancal_p_lim', 'mancal_t_lim']);
  const BOOLEANOS = new Set(Object.keys(PADRAO).filter(k => typeof PADRAO[k] === 'boolean'));

  const kva = e => e.unidade_potencia === 'kVA' || e.unidade_potencia === 'MVA';
  const F = (x, c) => E.fmt(x, c), FA = x => E.fmt_auto(x);
  const nomeApl = a => a.charAt(0) + a.slice(1).toLowerCase();

  // ── Esquema ─────────────────────────────────────────────────────────────────────────────
  const GRUPOS = [
    { id: 'id', n: '0', titulo: 'Identificação', aberto: false,
      resumo: e => [e.projeto, e.equipamento].filter(Boolean).join(' · ') || 'Opcional · aparece no relatório',
      campos: [
        { k: 'projeto', tipo: 'texto', rotulo: 'Projeto', ph: 'Ex.: PCH Rio Claro — unidade 2' },
        { linha: [
          { k: 'equipamento', tipo: 'texto', rotulo: 'Equipamento', ph: 'Ex.: gerador síncrono' },
          { k: 'responsavel', tipo: 'texto', rotulo: 'Responsável', ph: 'Nome' }] }
      ] },
    { id: 'pot', n: '1', titulo: 'Máquina e potência', aberto: true,
      resumo: e => `${FA(e.potencia)} ${e.unidade_potencia} · ${e.tipo_maquina}`,
      campos: [
        { k: 'tipo_maquina', tipo: 'seg', rotulo: 'Tipo de máquina', opcoes: E.TIPOS_MAQUINA.map(t => [t, t]) },
        { k: 'potencia', tipo: 'num', rotulo: 'Potência nominal', obrig: true, unSel: { k: 'unidade_potencia', opcoes: E.UNIDADES_POTENCIA },
          dica: (e, R) => {
            if (!kva(e)) return e.unidade_potencia === 'kW' || e.unidade_potencia === 'MW' ? 'Potência mecânica no eixo.' : 'Convertida para kW (potência no eixo).';
            if (!e.converter_kva) return 'Convenção das tabelas da seção 9: kVA usado numericamente como kW (lado conservador).';
            return R ? `Potência no eixo: <b>${F(R.p_kw, 1)} kW</b>.` : 'Potência no eixo pela conversão S·cos φ e η.';
          } },
        { k: 'converter_kva', tipo: 'switch', rotulo: 'Converter kVA → kW', sub: 'Usa S·cos φ (÷ η no gerador, × η no motor)', se: kva },
        { linha: [
          { k: 'cos_phi', tipo: 'num', rotulo: 'Fator de potência', simb: 'cos φ' },
          { k: 'rendimento', tipo: 'num', rotulo: 'Rendimento', simb: 'η' }], se: e => kva(e) && e.converter_kva }
      ] },
    { id: 'rot', n: '2', titulo: 'Rotação', aberto: true,
      resumo: e => e.modo_rotacao === 'rpm' ? `${FA(e.rotacao)} rpm` : `${FA(e.frequencia)} Hz · ${e.polos} polos`,
      campos: [
        { k: 'modo_rotacao', tipo: 'seg', rotulo: 'Informar por', opcoes: [['polos', 'Frequência e polos'], ['rpm', 'Rotação direta']] },
        { linha: [
          { k: 'frequencia', tipo: 'num', rotulo: 'Frequência', un: 'Hz', chips: [50, 60] },
          { k: 'polos', tipo: 'num', rotulo: 'Polos', un: 'polos', chips: [2, 4, 6, 8, 10, 12], inteiro: true }], se: e => e.modo_rotacao === 'polos' },
        { k: 'escorregamento', tipo: 'num', rotulo: 'Escorregamento', un: '%', se: e => e.modo_rotacao === 'polos',
          dica: (e, R) => R ? `n = <b>${F(R.n_rpm, 1)} rpm</b>${e.escorregamento ? ` (síncrona ${F(R.n_sincrona, 0)} rpm)` : ' · síncrona'}` : 'Zero para máquina síncrona.' },
        { k: 'rotacao', tipo: 'num', rotulo: 'Rotação nominal', un: 'rpm', obrig: true, se: e => e.modo_rotacao === 'rpm' }
      ] },
    { id: 'apl', n: '3', titulo: 'Aplicação e fator de serviço', aberto: true,
      resumo: (e, R) => `${nomeApl(e.aplicacao)} · FS ${R ? FA(R.fs) : '—'}`,
      campos: [
        { k: 'aplicacao', tipo: 'sel', rotulo: 'Aplicação', sub: 'tabela 6.2.7',
          opcoes: () => Object.keys(E.APLICACOES).map(a => [a, `${nomeApl(a)} · FS ${FA(E.APLICACOES[a])}`]).concat([[E.APLICACAO_OUTRA, 'Outra · informar FS']]) },
        { k: 'fs_personalizado', tipo: 'num', rotulo: 'Fator de serviço', simb: 'FS', sub: 'opcional', auto: true,
          ph: e => e.aplicacao in E.APLICACOES ? `Tabela · ${FA(E.APLICACOES[e.aplicacao])}` : 'Obrigatório',
          dica: e => e.aplicacao in E.APLICACOES ? 'Deixe vazio para usar o valor da tabela (regime contínuo 24 h/dia).' : 'Informe o FS da aplicação.' },
        { k: 'categoria_motor', tipo: 'sel', rotulo: 'Categoria do motor', sub: 'NBR 7094 · opcional',
          opcoes: () => [['', 'Não informar']].concat(Object.keys(E.CATEGORIAS_MOTOR).map(c => [c, `Categoria ${c}`])), se: e => e.tipo_maquina === 'Motor' }
      ] },
    { id: 'mat', n: '4', titulo: 'Material do eixo', aberto: true,
      resumo: e => e.material === E.MATERIAL_PERSONALIZADO ? `Personalizado · Se ${FA(e.mat_escoamento)} MPa` : e.material,
      campos: [
        { k: 'material', tipo: 'sel', rotulo: 'Aço',
          opcoes: () => E.ORDEM_MATERIAIS_DOC.map(m => [m, `${m} · Se ${FA(E.MATERIAIS[m].escoamento)} MPa`]).concat([[E.MATERIAL_PERSONALIZADO, 'Personalizado']]) },
        { info: 'material', se: e => e.material !== E.MATERIAL_PERSONALIZADO },
        { linha: [
          { k: 'mat_escoamento', tipo: 'num', rotulo: 'Escoamento', simb: 'Se', un: 'MPa', obrig: true },
          { k: 'mat_ruptura', tipo: 'num', rotulo: 'Ruptura', simb: 'Su', un: 'MPa', sub: 'opcional' }], se: e => e.material === E.MATERIAL_PERSONALIZADO },
        { linha: [
          { k: 'mat_temp_min', tipo: 'num', rotulo: 'Temp. mínima', un: '°C', sub: 'opcional' },
          { k: 'mat_soldavel', tipo: 'switch', rotulo: 'Soldável' }], se: e => e.material === E.MATERIAL_PERSONALIZADO }
      ] },
    { id: 'crit', n: '5', titulo: 'Critério e segurança', aberto: true,
      resumo: e => `${E.CRITERIO_CURTO[e.criterio]} · SF ${FA(e.fator_seguranca)}`,
      campos: [
        { k: 'criterio', tipo: 'sel', rotulo: 'Critério de dimensionamento', opcoes: () => Object.keys(E.CRITERIOS).map(c => [c, E.CRITERIOS[c].split(' — ')[0] + (c === 'MAIOR' ? '' : '')]),
          dica: e => ({ SECAO_5: 'Equação da seção 5 com τ<sub>máx</sub> da seção 4 (base das tabelas da seção 8).', SECAO_9: 'τ = Se/3: critério implícito nas tabelas da seção 9 (Tresca ÷ 1,5).',
            MAIOR: 'Calcula pelos dois critérios e adota o maior diâmetro.', PERSONALIZADO: 'Informe a tensão de cisalhamento de referência.' })[e.criterio] },
        { k: 'tau_personalizado', tipo: 'num', rotulo: 'Tensão de referência', simb: 'τ', un: 'MPa', obrig: true, se: e => e.criterio === 'PERSONALIZADO' },
        { linha: [
          { k: 'fator_seguranca', tipo: 'num', rotulo: 'Fator de segurança', simb: 'SF', chips: [9], dica: e => e.fator_seguranca < 9 ? '<b>Abaixo do mínimo 9</b> da seção 5.' : 'Mínimo 9 (seção 5).' },
          { k: 'serie_diametros', tipo: 'sel', rotulo: 'Série de diâmetros', opcoes: () => Object.keys(E.SERIES_DIAMETROS).map(s => [s, s]) }] }
      ] },
    { id: 'ver', n: '6', titulo: 'Verificações opcionais', aberto: false,
      resumo: e => {
        const p = [];
        if (e.diametro_existente) p.push(`d existente ${FA(e.diametro_existente)} mm`);
        if (e.torque_pico_pu) p.push(`pico ${FA(e.torque_pico_pu)}× Mt`);
        if (e.temp_min_operacao !== null && e.temp_min_operacao !== undefined) p.push(`T mín ${FA(e.temp_min_operacao)} °C`);
        if (e.requer_solda) p.push('soldável');
        return p.join(' · ') || 'Diâmetro existente, torque de pico, temperatura, solda';
      },
      campos: [
        { k: 'diametro_existente', tipo: 'num', rotulo: 'Diâmetro existente', simb: 'd', un: 'mm', sub: 'verifica em vez de dimensionar' },
        { linha: [
          { k: 'torque_pico_pu', tipo: 'num', rotulo: 'Torque de pico', un: '× Mt' },
          { k: 'temp_min_operacao', tipo: 'num', rotulo: 'Temp. mín. de operação', un: '°C' }] },
        { k: 'requer_solda', tipo: 'switch', rotulo: 'Eixo soldado', sub: 'Ex.: spider arm — exige aço soldável' }
      ] },
    { id: 'man', n: '7', titulo: 'Mancal de deslizamento', aberto: true, chave: 'mancal_ativo',
      resumo: e => !e.mancal_ativo ? 'Desativado' : (e.carga_modo === 'massa' ? `Rotor ${FA(e.mancal_massa_rotor)} kg` : `F = ${FA(e.mancal_carga)} N`) + ` · B/D ${FA(e.mancal_bd)}`,
      campos: [
        { sep: 'Geometria' },
        { linha: [
          { k: 'mancal_diametro', tipo: 'num', rotulo: 'Diâmetro do colo', simb: 'D', un: 'mm', auto: true, ph: () => 'Automático' },
          { k: 'mancal_bd', tipo: 'num', rotulo: 'Relação B/D', chips: [0.5, 0.8, 1] }] },
        { k: 'mancal_largura', tipo: 'num', rotulo: 'Largura da bucha', simb: 'B', un: 'mm', sub: 'opcional · substitui B/D', auto: true, ph: () => 'Automática' },
        { sep: 'Carga' },
        { k: 'carga_modo', tipo: 'seg', rotulo: 'Informar', opcoes: [['carga', 'Carga radial'], ['massa', 'Massa do rotor']] },
        { k: 'mancal_carga', tipo: 'num', rotulo: 'Carga radial no mancal', simb: 'F', un: 'N', obrig: true, se: e => e.carga_modo !== 'massa',
          dica: e => e.mancal_carga ? `≈ ${F(e.mancal_carga / 1000, 1)} kN · ${F(e.mancal_carga / 9.81, 0)} kgf` : '' },
        { k: 'mancal_massa_rotor', tipo: 'num', rotulo: 'Massa do rotor', un: 'kg', obrig: true, se: e => e.carga_modo === 'massa' },
        { linha: [
          { k: 'mancal_fracao', tipo: 'num', rotulo: 'Parcela neste mancal', un: '%' },
          { k: 'mancal_fator_carga', tipo: 'num', rotulo: 'Fator de carga', simb: 'k' }], se: e => e.carga_modo === 'massa' },
        { sep: 'Lubrificação' },
        { linha: [
          { k: 'mancal_vg', tipo: 'sel', rotulo: 'Óleo', opcoes: () => [['', 'Automático']].concat(E.LISTA_OLEOS.map(v => [String(v), `ISO VG ${v}`])) },
          { k: 'mancal_psi', tipo: 'sel', rotulo: 'Folga relativa ψm', opcoes: () => [['', 'Automática']].concat(E.PSI_SERIE.map(v => [String(v), `${FA(v)} ‰`])) }] },
        { k: 'mancal_modo_temp', tipo: 'seg', rotulo: 'Temperatura do filme', opcoes: [['informada', 'Informada'], ['balanco', 'Balanço térmico']] },
        { k: 'mancal_temp_efetiva', tipo: 'num', rotulo: 'Temperatura efetiva', simb: 'T', un: '°C', chips: [40, 50, 60, 70], se: e => e.mancal_modo_temp !== 'balanco',
          dica: e => Math.abs((e.mancal_temp_efetiva ?? 0) - 40) < 1e-9 ? '40 °C reproduz a planilha (viscosidade nominal). Em regime: 50–70 °C.' : '' },
        { linha: [
          { k: 'mancal_area_caixa', tipo: 'num', rotulo: 'Área da caixa', simb: 'A', un: 'm²', obrig: true },
          { k: 'mancal_alfa', tipo: 'num', rotulo: 'Troca térmica', simb: 'α', un: 'W/m²K' }], se: e => e.mancal_modo_temp === 'balanco' },
        { k: 'mancal_temp_ambiente', tipo: 'num', rotulo: 'Temperatura ambiente', un: '°C', se: e => e.mancal_modo_temp === 'balanco' },
        { sep: 'Limites e reservatório' },
        { linha: [
          { k: 'mancal_p_lim', tipo: 'num', rotulo: 'p̄ admissível', un: 'N/mm²' },
          { k: 'mancal_t_lim', tipo: 'num', rotulo: 'T máxima', un: '°C' }] },
        { k: 'mancal_volume_oleo', tipo: 'num', rotulo: 'Volume de óleo no mancal', un: 'L' }
      ] }
  ];

  // Mapeamento de mensagens de erro do motor → campo
  const MAPA_ERROS = [
    [/^Potência/i, 'potencia'], [/^Unidade de potência/i, 'potencia'], [/^cos φ/i, 'cos_phi'], [/^Rendimento/i, 'rendimento'],
    [/^Rotação/i, 'rotacao'], [/^Frequência/i, 'frequencia'], [/^Número de polos/i, 'polos'], [/^Escorregamento/i, 'escorregamento'],
    [/Aplicação 'OUTRA'/i, 'fs_personalizado'], [/^Fator de serviço/i, 'fs_personalizado'], [/^Material personalizado/i, 'mat_escoamento'],
    [/^Critério personalizado/i, 'tau_personalizado'], [/^Fator de segurança/i, 'fator_seguranca'], [/^Diâmetro existente/i, 'diametro_existente'],
    [/^Torque de pico/i, 'torque_pico_pu'],
    [/ponta de eixo de .* acima/i, 'mancal_diametro'], [/diâmetro do colo/i, 'mancal_diametro'], [/tabelas de folga/i, 'mancal_diametro'],
    [/B\/D/, 'mancal_bd'], [/massa do rotor deve/i, 'mancal_massa_rotor'], [/fração/i, 'mancal_fracao'], [/fator de carga/i, 'mancal_fator_carga'],
    [/informe a carga radial/i, 'mancal_carga'], [/carga radial deve/i, 'mancal_carga'], [/coeficiente α/i, 'mancal_alfa'],
    [/temperatura ambiente/i, 'mancal_temp_ambiente'], [/temperatura efetiva/i, 'mancal_temp_efetiva'], [/pressão admissível/i, 'mancal_p_lim'],
    [/temperatura máxima/i, 'mancal_t_lim'], [/área externa/i, 'mancal_area_caixa'], [/ISO VG/i, 'mancal_vg'], [/ψ|50 m\/s|não define folga/i, 'mancal_psi'],
    [/volume de óleo/i, 'mancal_volume_oleo']
  ];
  function campoDoErro(msg) {
    for (const [re, k] of MAPA_ERROS) if (re.test(msg)) return k;
    return null;
  }

  // ── Utilidades DOM ──────────────────────────────────────────────────────────────────────
  function h(tag, attrs, ...filhos) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat(Infinity)) if (f !== null && f !== undefined && f !== false) n.append(f.nodeType ? f : document.createTextNode(String(f)));
    return n;
  }
  const svgIco = (id, cls = 'ico') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.append(u); return s; };

  // ── Serialização (endereço #…) ─────────────────────────────────────────────────────────
  function codificar(v) { return v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? '1' : '0') : String(v); }
  function decodificar(k, s) {
    if (BOOLEANOS.has(k)) return s === '1' || s === 'true';
    if (s === '') return null;
    if (NUMERICOS.has(k)) { const x = Number(s); return Number.isFinite(x) ? x : null; }
    return s;
  }
  function paraHash(e) {
    const p = new URLSearchParams();
    for (const k of Object.keys(PADRAO)) {
      const a = e[k], b = PADRAO[k];
      const igual = (a === b) || ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === ''));
      if (!igual) p.set(k, codificar(a));
    }
    return p.toString();
  }
  function deHash(str) {
    const out = Object.assign({}, PADRAO);
    const p = new URLSearchParams(String(str || '').replace(/^#/, ''));
    for (const [k, s] of p) if (k in PADRAO) out[k] = decodificar(k, s);
    return out;
  }
  /** Estado da interface → entrada do motor (sem campos de interface). */
  function entradaMotor(e) {
    const x = {};
    for (const k of Object.keys(E.ENTRADA_PADRAO)) x[k] = e[k] === undefined ? E.ENTRADA_PADRAO[k] : e[k];
    if (e.carga_modo === 'massa') x.mancal_carga = null; else x.mancal_massa_rotor = null;
    if (x.mancal_vg !== null && x.mancal_vg !== undefined) x.mancal_vg = Number(x.mancal_vg);
    if (x.mancal_psi !== null && x.mancal_psi !== undefined) x.mancal_psi = Number(x.mancal_psi);
    if (x.material !== E.MATERIAL_PERSONALIZADO) { x.mat_escoamento = null; x.mat_ruptura = null; x.mat_temp_min = null; x.mat_soldavel = false; }
    return x;
  }

  // ── Formulário ──────────────────────────────────────────────────────────────────────────
  function criar(alvo, opcoes) {
    let estado = Object.assign({}, PADRAO, opcoes.estado || {});
    let ultimoR = null;
    const campos = {};            // k → {def, el (wrapper .fld), input, inp(.inp), err, hint}
    const grupos = [];            // {def, el, sum}
    const visiveis = [];          // {el, se}
    const errosParse = {};        // k → msg (texto que não é número)
    const aberto = {};            // estado de abertura dos grupos (memória por sessão)
    try { Object.assign(aberto, JSON.parse(sessionStorage.getItem('vg-grupos') || '{}')); } catch (_) { /* sem armazenamento */ }

    const avisar = (k) => opcoes.aoMudar && opcoes.aoMudar(estado, k);

    function textoCampo(k) {
      const v = estado[k];
      if (v === null || v === undefined) return '';
      return NUMERICOS.has(k) ? E.fmt_campo(v) : String(v);
    }

    function criarCampo(def) {
      const id = 'f-' + def.k;
      const wrap = h('div', { class: 'fld', 'data-k': def.k });
      const rot = h('label', { class: 'fld-label', for: id },
        h('span', null, def.rotulo, def.simb ? h('span', { class: 'dim' }, ' · ', def.simb) : null),
        def.sub ? h('small', null, def.sub) : null);
      const reg = { def, el: wrap };
      if (def.tipo === 'seg') {
        const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': def.rotulo });
        def.opcoes.forEach(([v, txt]) => {
          const b = h('button', { type: 'button', role: 'radio', 'data-v': v, 'aria-checked': String(estado[def.k] === v), tabindex: estado[def.k] === v ? '0' : '-1' }, txt);
          b.addEventListener('click', () => definir(def.k, v));
          seg.append(b);
        });
        seg.addEventListener('keydown', ev => {
          if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
          ev.preventDefault();
          const ops = def.opcoes.map(o => o[0]);
          const i = ops.indexOf(estado[def.k]);
          const novo = ops[(i + (ev.key === 'ArrowRight' ? 1 : ops.length - 1)) % ops.length];
          definir(def.k, novo);
          seg.querySelector(`[data-v="${novo}"]`).focus();
        });
        wrap.append(h('span', { class: 'fld-label' }, h('span', null, def.rotulo)), seg);
        reg.seg = seg;
      } else if (def.tipo === 'switch') {
        const inp = h('input', { type: 'checkbox', id, role: 'switch' });
        inp.checked = !!estado[def.k];
        inp.addEventListener('change', () => definir(def.k, inp.checked));
        wrap.append(h('label', { class: 'sw', for: id }, h('span', { class: 'sw-txt' }, h('strong', null, def.rotulo), def.sub ? h('small', null, def.sub) : null), inp));
        reg.input = inp;
      } else if (def.tipo === 'sel') {
        const sel = h('select', { id, 'aria-describedby': id + '-d' });
        preencherOpcoes(sel, def);
        sel.addEventListener('change', () => definir(def.k, sel.value === '' ? null : (NUMERICOS.has(def.k) ? Number(sel.value) : sel.value)));
        const inp = h('div', { class: 'inp' }, sel);
        wrap.append(rot, inp);
        reg.input = sel; reg.inp = inp;
      } else {   // texto / num
        const attrs = { id, type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': id + '-d', placeholder: typeof def.ph === 'string' ? def.ph : null };
        if (def.tipo === 'num') attrs.inputmode = def.inteiro ? 'numeric' : 'decimal';
        const input = h('input', attrs);
        input.value = textoCampo(def.k);
        const inp = h('div', { class: 'inp' + (def.auto ? ' auto' : '') }, input);
        if (def.un) inp.append(h('span', { class: 'un' }, def.un));
        if (def.unSel) {
          const us = h('select', { class: 'un-sel', 'aria-label': 'Unidade de ' + def.rotulo.toLowerCase() });
          def.unSel.opcoes.forEach(u => us.append(h('option', { value: u }, u)));
          us.value = estado[def.unSel.k];
          us.addEventListener('change', () => definir(def.unSel.k, us.value));
          inp.append(us);
          reg.unSel = us;
        }
        input.addEventListener('input', () => lerTexto(def, input));
        input.addEventListener('blur', () => { if (!errosParse[def.k] && def.tipo === 'num') input.value = textoCampo(def.k); });
        wrap.append(rot, inp);
        reg.input = input; reg.inp = inp;
        if (def.chips) {
          const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Valores usuais de ' + def.rotulo.toLowerCase() });
          def.chips.forEach(c => {
            const b = h('button', { type: 'button', class: 'chip', 'data-v': String(c), 'aria-pressed': 'false' }, E.fmt_auto(c));
            b.addEventListener('click', () => { definir(def.k, c); input.value = textoCampo(def.k); });
            chips.append(b);
          });
          wrap.append(chips);
          reg.chips = chips;
        }
      }
      const hint = h('div', { class: 'fld-hint', id: id + '-d' });
      const err = h('div', { class: 'fld-err', role: 'alert', hidden: true });
      wrap.append(hint, err);
      reg.hint = hint; reg.err = err;
      campos[def.k] = reg;
      return wrap;
    }

    function preencherOpcoes(sel, def) {
      const ops = typeof def.opcoes === 'function' ? def.opcoes(estado) : def.opcoes;
      sel.textContent = '';
      ops.forEach(([v, txt]) => sel.append(h('option', { value: v }, txt)));
      const v = estado[def.k];
      sel.value = v === null || v === undefined ? '' : String(v);
    }

    function lerTexto(def, input) {
      if (def.tipo === 'texto') { estado[def.k] = input.value; avisar(def.k); atualizarResumos(); return; }
      const s = input.value.trim();
      try {
        let v = s === '' ? null : E.ler_numero(s, def.rotulo, false);
        if (v !== null && def.inteiro && !Number.isInteger(v)) throw new E.ErroEntrada([`${def.rotulo}: use um número inteiro.`]);
        delete errosParse[def.k];
        estado[def.k] = v;
      } catch (ex) {
        errosParse[def.k] = ex.erros ? ex.erros[0] : 'Número inválido.';
      }
      mostrarErro(def.k, errosParse[def.k] || null);
      sincronizarChips(def.k);
      atualizarVisibilidade();
      atualizarResumos();
      avisar(def.k);
    }

    function definir(k, v) {
      estado[k] = v;
      const c = campos[k];
      if (c) {
        if (c.seg) c.seg.querySelectorAll('button').forEach(b => { const on = b.dataset.v === String(v); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
        if (c.def.tipo === 'switch') c.input.checked = !!v;
        if (c.def.tipo === 'sel') c.input.value = v === null || v === undefined ? '' : String(v);
        if (c.def.tipo === 'num' || c.def.tipo === 'texto') { delete errosParse[k]; mostrarErro(k, null); }
      }
      for (const r of Object.values(campos)) if (r.unSel && r.def.unSel.k === k) r.unSel.value = v;
      const g = grupos.find(g => g.def.chave === k);
      if (g) { g.chave.checked = !!v; g.el.classList.toggle('off', !v); }
      sincronizarChips(k);
      atualizarVisibilidade();
      atualizarResumos();
      avisar(k);
    }

    function sincronizarChips(k) {
      const c = campos[k];
      if (!c || !c.chips) return;
      c.chips.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === estado[k])));
    }

    function mostrarErro(k, msg) {
      const c = campos[k];
      if (!c) return;
      c.err.textContent = '';
      if (msg) { c.err.append(svgIco('i-x-circle'), h('span', null, msg)); c.err.hidden = false; }
      else c.err.hidden = true;
      if (c.inp) c.inp.classList.toggle('err', !!msg);
      if (c.input && c.def.tipo !== 'switch') c.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      atualizarErrosGrupo();
    }

    function atualizarErrosGrupo() {
      for (const g of grupos) g.el.classList.toggle('has-err', !!g.el.querySelector('.fld:not([hidden]) .fld-err:not([hidden])'));
    }

    function construir() {
      alvo.textContent = '';
      for (const def of GRUPOS) {
        const ab = aberto[def.id] !== undefined ? aberto[def.id] : def.aberto;
        const el = h('section', { class: 'grp', 'data-g': def.id, 'data-aberto': String(ab), 'aria-labelledby': 'gh-' + def.id });
        const sum = h('span', { class: 'grp-sum' });
        const head = h('button', { type: 'button', class: 'grp-head', id: 'gh-' + def.id, 'aria-expanded': String(ab), 'aria-controls': 'gb-' + def.id },
          h('span', { class: 'grp-num' }, def.n), h('span', { class: 'grp-title' }, h('strong', null, def.titulo), sum), svgIco('i-chev', 'grp-chev'));
        head.addEventListener('click', () => {
          const novo = el.dataset.aberto !== 'true';
          el.dataset.aberto = String(novo); head.setAttribute('aria-expanded', String(novo));
          aberto[def.id] = novo;
          try { sessionStorage.setItem('vg-grupos', JSON.stringify(aberto)); } catch (_) { /* ok */ }
        });
        el.append(head);
        const body = h('div', { class: 'grp-body', id: 'gb-' + def.id });
        const reg = { def, el, sum };
        if (def.chave) {
          const id = 'f-' + def.chave;
          const chk = h('input', { type: 'checkbox', id, role: 'switch' });
          chk.checked = !!estado[def.chave];
          chk.addEventListener('change', () => definir(def.chave, chk.checked));
          body.append(h('label', { class: 'sw', for: id }, h('span', { class: 'sw-txt' }, h('strong', null, 'Calcular o mancal'), h('small', null, 'Usa a rotação e o diâmetro adotado da ponta de eixo')), chk));
          reg.chave = chk;
          el.classList.toggle('off', !estado[def.chave]);
        }
        const cont = h('div', { class: 'grp-campos', style: 'display:grid;gap:14px' });
        for (const c of def.campos) {
          let n;
          if (c.sep) n = h('div', { class: 'sub-sep' }, c.sep);
          else if (c.info) { n = h('div', { class: 'callout', 'data-info': c.info }); reg.info = n; }
          else if (c.linha) { n = h('div', { class: 'fld-row' }, c.linha.map(criarCampo)); }
          else n = criarCampo(c);
          if (c.se) visiveis.push({ el: n, se: c.se });
          if (c.linha) c.linha.forEach(s => s.se && visiveis.push({ el: campos[s.k].el, se: s.se }));
          cont.append(n);
        }
        if (def.chave) visiveis.push({ el: cont, se: e => !!e[def.chave] });
        body.append(cont);
        el.append(body);
        alvo.append(el);
        grupos.push(reg);
      }
      Object.keys(campos).forEach(sincronizarChips);
      atualizarVisibilidade();
      atualizarResumos();
      atualizarDicas(null);
    }

    function atualizarVisibilidade() {
      for (const v of visiveis) v.el.hidden = !v.se(estado);
      atualizarErrosGrupo();
    }
    function atualizarResumos() {
      for (const g of grupos) {
        let s = '';
        try { s = g.def.resumo(estado, ultimoR); } catch (_) { s = ''; }
        g.sum.textContent = s;
      }
    }
    function atualizarDicas(R) {
      for (const k in campos) {
        const c = campos[k], d = c.def;
        let txt = '';
        if (d.dica) { try { txt = d.dica(estado, R) || ''; } catch (_) { txt = ''; } }
        c.hint.innerHTML = txt;
        c.hint.hidden = !txt;
        if (typeof d.ph === 'function' && c.input && c.input.tagName === 'INPUT') c.input.placeholder = d.ph(estado, R);
      }
      // material: ficha resumida
      const g = grupos.find(g => g.info);
      if (g && estado.material in E.MATERIAIS) {
        const m = E.MATERIAIS[estado.material];
        g.info.innerHTML = '';
        g.info.append(svgIco('i-info'), h('div', null,
          h('b', null, m.nome), m.observacao ? ` · ${m.observacao.toLowerCase()}` : '', h('br'),
          `Se ${FA(m.escoamento)} MPa · Su ${FA(m.ruptura)} MPa · τ`, h('sub', null, 'máx'), ` ${FA(m.tau_max)} MPa`, h('br'),
          `Até ${FA(m.temp_min)} °C · ${m.soldavel ? 'soldável' : 'não soldável'}`));
      }
    }

    /** Depois de cada cálculo: valores automáticos, dicas dependentes do resultado e erros do motor. */
    function atualizarResultado(R, errosMotor) {
      ultimoR = R;
      if (R && R.mancal) {
        const m = R.mancal;
        if (campos.mancal_diametro && estado.mancal_diametro == null) campos.mancal_diametro.input.placeholder = `Auto · ${FA(m.d)}`;
        if (campos.mancal_largura && estado.mancal_largura == null) campos.mancal_largura.input.placeholder = `Auto · ${F(m.l, 1)}`;
        const ov = campos.mancal_vg && campos.mancal_vg.input.querySelector('option[value=""]');
        if (ov) ov.textContent = `Automático · VG ${m.vg}`;
        const op = campos.mancal_psi && campos.mancal_psi.input.querySelector('option[value=""]');
        if (op) op.textContent = `Automática · ${FA(m.psi_m)} ‰`;
      } else {
        if (campos.mancal_diametro) campos.mancal_diametro.input.placeholder = 'Automático';
        if (campos.mancal_largura) campos.mancal_largura.input.placeholder = 'Automática';
      }
      atualizarDicas(R);
      // erros do motor por campo (os de leitura de número têm prioridade)
      for (const k in campos) if (!errosParse[k]) mostrarErro(k, null);
      for (const msg of errosMotor || []) {
        const k = campoDoErro(msg);
        if (k && campos[k] && !errosParse[k] && !campos[k].el.hidden) mostrarErro(k, msg.replace(/^Mancal:\s*/, ''));
      }
      atualizarResumos();
    }

    function definirEstado(novo) {
      estado = Object.assign({}, PADRAO, novo);
      for (const k in errosParse) delete errosParse[k];
      for (const k in campos) {
        const c = campos[k], d = c.def;
        if (d.tipo === 'seg') c.seg.querySelectorAll('button').forEach(b => { const on = b.dataset.v === String(estado[k]); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
        else if (d.tipo === 'switch') c.input.checked = !!estado[k];
        else if (d.tipo === 'sel') c.input.value = estado[k] === null || estado[k] === undefined ? '' : String(estado[k]);
        else c.input.value = textoCampo(k);
        if (c.unSel) c.unSel.value = estado[d.unSel.k];
        mostrarErro(k, null);
        sincronizarChips(k);
      }
      for (const g of grupos) if (g.chave) { g.chave.checked = !!estado[g.def.chave]; g.el.classList.toggle('off', !estado[g.def.chave]); }
      atualizarVisibilidade();
      atualizarResumos();
      atualizarDicas(null);
      avisar(null);
    }

    function focar(k) {
      const c = campos[k];
      if (!c) return;
      const g = c.el.closest('.grp');
      if (g && g.dataset.aberto !== 'true') g.querySelector('.grp-head').click();
      (c.input || c.seg.querySelector('button')).focus();
      c.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    construir();
    return {
      estado: () => Object.assign({}, estado),
      temErrosLeitura: () => Object.keys(errosParse).length > 0,
      errosLeitura: () => Object.assign({}, errosParse),
      atualizarResultado, definirEstado, focar
    };
  }

  raiz.VGForm = { criar, PADRAO, EXEMPLO, GRUPOS, paraHash, deHash, entradaMotor, campoDoErro, h, svgIco };
})(window);
