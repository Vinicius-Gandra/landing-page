/*!
 * VG · Telas do laboratório: ponta de eixo e tabelas das seções 8 e 9
 */
(function (raiz) {
  'use strict';
  const E = raiz.VGEngine, C = raiz.VGCharts, U = raiz.VGUI;
  const { h, svgIco, F, FA, FI, fP, sec, grade } = U;
  const V = raiz.VGViews = raiz.VGViews || {};
  const logspace = (a, b, n) => Array.from({ length: n }, (_, i) => a * (b / a) ** (i / (n - 1)));
  const nomeCurto = nome => nome.replace('AISI ', '');

  // ════════════════════════════════════════════════════════════════════════
  // Ponta de eixo
  // ════════════════════════════════════════════════════════════════════════
  V.eixo = function (p, ctx) {
    const R = ctx.R, e = R.entrada, mat = R.material;
    const st = s => s === 'ok' ? 'ok' : s === 'falha' ? 'falha' : null;
    const okSF = R.sf_real >= R.sf - 1e-9;

    // ── indicadores
    p.append(sec(null, null, h('div', { class: 'kpis k5' },
      U.kpi({ l: 'Potência de cálculo', ref: 'E1', v: fP(R.p_kw), u: 'kW', s: { kW: 'informada no eixo', MW: 'MW × 1.000', cv: 'cv × 0,7355', HP: 'HP × 0,7457', kva_convencao: 'kVA tratado como kW', kva_gerador: 'S·cos φ / η', kva_motor: 'S·cos φ·η', kva_outro: 'S·cos φ' }[R.p_regra] }),
      U.kpi({ l: 'Rotação', ref: 'E2', v: F(R.n_rpm, R.n_rpm % 1 ? 1 : 0), u: 'rpm', s: e.modo_rotacao === 'rpm' ? 'informada' : `${FA(e.frequencia)} Hz · ${e.polos} polos${e.escorregamento ? ` · s ${FA(e.escorregamento)} %` : ''}` }),
      U.kpi({ l: 'Fator de serviço', ref: 'E3', v: FA(R.fs), s: e.fs_personalizado != null ? 'informado' : U.nomeApl(e.aplicacao) }),
      U.kpi({ l: 'Tensão de referência', ref: 'E4', v: F(R.tau_ref, R.tau_ref % 1 ? 1 : 0), u: 'MPa', s: `${mat.nome} · ${E.CRITERIO_CURTO[R.criterio_governante]}` }),
      U.kpi({ l: 'Torque nominal', ref: 'E5', v: U.fN(R.mt), u: 'N·m', s: `com FS: ${U.fN(R.mt * R.fs)} N·m` }),
      U.kpi({ l: 'Diâmetro mínimo', ref: 'E6', v: F(R.d_min, 2), u: 'mm', s: `SF ${FA(R.sf)} sobre τ` }),
      U.kpi({ l: e.diametro_existente ? 'Diâmetro verificado' : 'Diâmetro adotado', ref: 'E7', v: FA(R.d_adotado), u: 'mm', destaque: true, estado: e.diametro_existente ? st(R.status) : null,
        s: `${e.diametro_existente ? 'informado' : R.d_norm_especial ? 'especial (múltiplo de 10)' : e.serie_diametros} · ${R.tolerancia}` }),
      U.kpi({ l: 'SF real', ref: 'E10', v: F(R.sf_real, 2), estado: okSF ? 'ok' : 'falha', s: `${okSF ? '≥' : '<'} ${FA(R.sf)} exigido` }),
      U.kpi({ l: 'Utilização', ref: 'E11', v: F(100 * R.utilizacao, 1), u: '%', s: '(d mín / d)³ = P / P máx' }),
      U.kpi({ l: 'Potência máxima', ref: 'E13', v: fP(R.p_max), u: 'kW', s: `Mt adm ${U.fN(R.mt_max)} N·m` })
    )));

    // ── capacidade dos diâmetros vizinhos
    const serie = E.SERIES_DIAMETROS[e.serie_diametros].slice().sort((a, b) => a - b);
    let lista;
    if (R.d_norm_especial) lista = [-3, -2, -1, 0, 1, 2, 3].map(k => R.d_norm + 10 * k).filter(x => x > 0);
    else { const i = serie.indexOf(R.d_norm); lista = serie.slice(Math.max(0, i - 3), i + 4); }
    if (!lista.includes(R.d_adotado)) { lista.push(R.d_adotado); lista.sort((a, b) => a - b); }
    const pm = d => E.potencia_maxima(d, R.n_rpm, R.fs, R.tau_ref, R.sf);
    const cats = lista.map(d => {
      const v = pm(d);
      return { rotulo: '⌀' + FA(d), valor: v, estado: d === R.d_adotado ? 'sel' : v < R.p_kw - 1e-9 ? 'deemph' : 'ok', rotuloValor: true, textoValor: fP(v),
        dica: [{ titulo: `⌀${FA(d)} mm${d === R.d_adotado ? ' · adotado' : ''}` }, { valor: `${fP(v)} kW`, rotulo: 'potência máxima' }, { valor: `${F(100 * R.p_kw / v, 1)} %`, rotulo: 'utilização' }] };
    });
    const dInf = R.d_inferior, pInf = R.p_inferior;
    const cCap = U.ccard({ overline: 'Série de diâmetros', titulo: 'Capacidade dos diâmetros vizinhos',
      resumo: e.diametro_existente
        ? `O diâmetro informado ⌀<b>${FA(R.d_adotado)} mm</b> admite <b>${fP(R.p_max)} kW</b> (${F(100 * R.p_max / R.p_kw, 1)} % da demanda de ${fP(R.p_kw)} kW).`
        : `O menor diâmetro que atende <b>${fP(R.p_kw)} kW</b> é ⌀<b>${FA(R.d_adotado)} mm</b> (${fP(R.p_max)} kW).` + (dInf ? ` O ⌀${FA(dInf)} admitiria ${fP(pInf)} kW — ${F(100 * pInf / R.p_kw, 1)} % da demanda.` : ''),
      legenda: [{ tipo: 'sq', cor: 'var(--c-deemph)', txt: 'Não atende' }, { tipo: 'sq', cor: 'var(--c-s1)', txt: 'Atende' }, { tipo: 'sq', cor: 'var(--c-em)', txt: e.diametro_existente ? 'Informado' : 'Adotado' }, { tipo: 'dash', cor: 'var(--c-ref)', txt: 'Potência de cálculo' }],
      nota: `Potência máxima pela inversão da seção 5 com ${mat.nome}, τ = ${F(R.tau_ref, 1)} MPa, FS ${FA(R.fs)}, SF ${FA(R.sf)} e ${F(R.n_rpm, 0)} rpm.`,
      tabela: () => ({ colunas: ['Diâmetro (mm)', 'P máx (kW)', 'Utilização (%)', 'Situação'], linhas: cats.map(c => [c.rotulo.slice(1), fP(c.valor), F(100 * R.p_kw / c.valor, 1), c.valor >= R.p_kw - 1e-9 ? 'atende' : 'não atende']), destacar: i => lista[i] === R.d_adotado }) });

    // ── mapa de projeto P × n
    const n = R.n_rpm, P = R.p_kw;
    const x0 = Math.min(300, n / 2), x1 = Math.max(4000, n * 2);
    const y0 = 10 ** Math.floor(Math.log10(P / 12)), y1 = 10 ** Math.ceil(Math.log10(P * 12));
    const kOf = d => E.potencia_maxima(d, 1, R.fs, R.tau_ref, R.sf);
    const escolhidos = new Set([R.d_adotado]);
    const pool = R.d_norm_especial ? Array.from({ length: 120 }, (_, i) => (i + 1) * 10) : serie;
    for (let d = R.d_adotado, k = 0; k < 3; k++) { const nx = pool.filter(x => x <= d / 1.25).pop(); if (!nx) break; escolhidos.add(nx); d = nx; }
    for (let d = R.d_adotado, k = 0; k < 3; k++) { const nx = pool.find(x => x >= d * 1.25); if (!nx) break; escolhidos.add(nx); d = nx; }
    const linhaD = (d, pts = 28) => { const k = kOf(d); const a = Math.max(x0, y0 / k), b = Math.min(x1, y1 / k); return a < b ? logspace(a, b, pts).map(x => ({ x, y: k * x })) : []; };
    const seriesMapa = [...escolhidos].sort((a, b) => a - b).map(d => ({ id: 'd' + d, nome: `⌀${FA(d)}`, tipo: 'linha', dados: linhaD(d), cor: d === R.d_adotado ? 'em' : 'deemph', largura: d === R.d_adotado ? 2.5 : 1.25,
      rotuloFim: `⌀${FA(d)}`, dica: d === R.d_adotado, fmtY: v => fP(v) + ' kW' })).filter(s => s.dados.length);
    const faixas = [];
    if (dInf && !e.diametro_existente) {
      const a = linhaD(R.d_adotado, 40), b = linhaD(dInf, 40);
      if (a.length && b.length) { faixas.push({ pontos: a.concat(b.slice().reverse()), cor: 'emw' }); seriesMapa.push({ id: 'dinf', nome: `⌀${FA(dInf)}`, tipo: 'linha', dados: b, cor: 'em', largura: 1, opacidade: 0.55, dica: true, fmtY: v => fP(v) + ' kW' }); }
    }
    const cMapa = U.ccard({ overline: 'Mapa de projeto', titulo: 'Potência máxima × rotação por diâmetro',
      resumo: `Cada linha é a capacidade de um diâmetro (P ∝ d³·n). O ponto de operação — <b>${fP(P)} kW a ${F(n, 0)} rpm</b> — ${e.diametro_existente ? (R.status === 'falha' ? 'fica <b>acima</b> da linha do diâmetro informado.' : 'fica abaixo da linha do diâmetro informado.') : `cai na faixa sombreada, entre o ⌀${dInf ? FA(dInf) : '—'} e o ⌀${FA(R.d_adotado)}.`}`,
      legenda: [{ tipo: 'line', cor: 'var(--c-em)', txt: `⌀${FA(R.d_adotado)} mm` }, { tipo: 'band', cor: 'var(--c-em-wash)', txt: 'Faixa atendida por este diâmetro' }, { tipo: 'line', cor: 'var(--c-deemph)', txt: 'Outros diâmetros da série' }],
      nota: 'Escalas logarítmicas. Mesmo material, critério, FS e SF do caso; passe o cursor para ler a capacidade em qualquer rotação.',
      tabela: () => ({ colunas: ['Diâmetro (mm)', `P máx a ${F(n, 0)} rpm (kW)`, 'P máx a 1.800 rpm (kW)', 'P máx a 3.600 rpm (kW)'], linhas: [...escolhidos].sort((a, b) => a - b).map(d => [FA(d), fP(kOf(d) * n), fP(kOf(d) * 1800), fP(kOf(d) * 3600)]), destacar: i => [...escolhidos].sort((a, b) => a - b)[i] === R.d_adotado }) });

    p.append(grade('g2', cCap, cMapa));
    C.barras(cCap.corpo, { categorias: cats, y: { rotulo: 'Potência máxima admissível (kW)' }, x: { rotulo: 'Diâmetro da ponta de eixo (mm)' }, refs: [{ y: R.p_kw, rotulo: `${fP(R.p_kw)} kW`, fora: true }], rotulo: 'Potência máxima dos diâmetros vizinhos' }, { altura: w => Math.round(Math.max(260, Math.min(340, w * 0.62))) });
    C.xy(cMapa.corpo, {
      x: { tipo: 'log', dominio: [x0, x1], rotulo: 'Rotação (rpm)', fmt: v => FI(v) }, y: { tipo: 'log', dominio: [y0, y1], rotulo: 'Potência (kW)', fmt: v => FI(v) },
      series: seriesMapa, faixas, margemDir: 52,
      pontos: [{ x: n, y: P, cor: 'em', r: 6, rotulo: `${fP(P)} kW · ${F(n, 0)} rpm`, ancora: 'end', dx: -12, dy: -12, dica: [{ titulo: 'Ponto de operação' }, { valor: `${fP(P)} kW`, rotulo: 'potência de cálculo' }, { valor: `${F(n, 0)} rpm`, rotulo: 'rotação' }, { valor: `⌀${FA(R.d_adotado)} mm`, rotulo: 'diâmetro' }] }],
      crosshair: { series: ['d' + R.d_adotado], fmtX: v => `${FI(v)} rpm` }, rotulo: 'Mapa de projeto: potência máxima por diâmetro em função da rotação'
    }, { altura: w => Math.round(Math.max(260, Math.min(340, w * 0.62))) });

    // ── d mín × potência por material
    const critComp = R.criterio_governante !== 'PERSONALIZADO' ? R.criterio_governante : 'SECAO_5';
    const px0 = 10 ** Math.floor(Math.log10(P / 8)), px1 = 10 ** Math.ceil(Math.log10(P * 8));
    const mats = E.ORDEM_MATERIAIS_DOC.map(nm => E.MATERIAIS[nm]).concat(mat.personalizado ? [mat] : []);
    const xsP = logspace(px0, px1, 48);
    const seriesMat = mats.map(m => {
      const sel = m.nome === mat.nome;
      const tau = sel ? R.tau_ref : E.tensao_referencia(m, critComp);
      return { id: 'm' + nomeCurto(m.nome), nome: m.nome, tipo: 'linha', cor: sel ? 'em' : 'deemph', largura: sel ? 2.5 : 1.5, rotuloFim: nomeCurto(m.nome), fmtY: v => F(v, 1) + ' mm',
        dados: xsP.map(x => ({ x, y: E.diametro_minimo(E.torque_nominal(x, n), R.fs, tau, R.sf) })) };
    }).sort((a, b) => (a.cor === 'em') - (b.cor === 'em'));
    const melhor = R.comparacao.find(c => c.melhor);
    const cMat = U.ccard({ overline: 'Dimensionamento', titulo: 'Diâmetro mínimo × potência por material',
      resumo: `Com ${mat.nome}, d mín = <b>${F(R.d_min, 1)} mm</b>. O diâmetro cresce com a raiz cúbica da potência: dobrar P aumenta d em 26 %.` + (melhor && melhor.material !== mat.nome ? ` ${melhor.material} levaria a ⌀${FA(melhor.d_norm)} mm.` : ''),
      legenda: [{ tipo: 'line', cor: 'var(--c-em)', txt: mat.nome }, { tipo: 'line', cor: 'var(--c-deemph)', txt: 'Demais materiais' }],
      nota: `Critério ${E.CRITERIO_CURTO[critComp]}${R.criterio_governante === 'PERSONALIZADO' ? ' (τ informado só para o material do caso)' : ''}, FS ${FA(R.fs)}, SF ${FA(R.sf)}, ${F(n, 0)} rpm. Escala de potência logarítmica.`,
      tabela: () => ({ colunas: ['Potência (kW)'].concat(mats.map(m => nomeCurto(m.nome))), linhas: logspace(px0, px1, 7).map(x => [fP(x)].concat(seriesMat.slice().sort((a, b) => mats.findIndex(m => m.nome === a.nome) - mats.findIndex(m => m.nome === b.nome)).map(s => F(E.diametro_minimo(E.torque_nominal(x, n), R.fs, s.cor === 'em' ? R.tau_ref : E.tensao_referencia(mats.find(m => m.nome === s.nome), critComp), R.sf), 1)))) }) });

    // ── critérios
    const crits = ['SECAO_5', 'SECAO_9', 'PERSONALIZADO'].filter(c => R.por_criterio[c]);
    const itensCrit = crits.map(c => {
      const pc = R.por_criterio[c];
      return { rotulo: E.CRITERIO_CURTO[c], sub: `τ = ${F(pc.tau, 1)} MPa`, valor: pc.d_min, textoValor: `${F(pc.d_min, 1)} → ⌀${FA(pc.d_norm)}`, estado: c === R.criterio_governante ? 'sel' : 'ok',
        dica: [{ titulo: E.CRITERIOS[c] }, { valor: `${F(pc.d_min, 2)} mm`, rotulo: 'd mín' }, { valor: `⌀${FA(pc.d_norm)} mm`, rotulo: 'normalizado' }, { valor: `${fP(pc.p_max_norm)} kW`, rotulo: 'P máx do normalizado' }] };
    });
    const r5 = R.por_criterio.SECAO_5, r9 = R.por_criterio.SECAO_9;
    const cCrit = U.ccard({ overline: 'Critérios', titulo: 'Diâmetro mínimo por critério',
      resumo: `O critério das tabelas da seção 9 (τ = Se/3) dá um diâmetro <b>${F(100 * (r9.d_min / r5.d_min - 1), 1)} % maior</b> que a equação da seção 5/8. Governa: <b>${E.CRITERIO_CURTO[R.criterio_governante]}</b>.`,
      legenda: [{ tipo: 'sq', cor: 'var(--c-em)', txt: 'Critério governante' }, { tipo: 'sq', cor: 'var(--c-s1)', txt: 'Comparação' }],
      nota: 'Barras: diâmetro mínimo calculado; o texto mostra o normalizado na série escolhida. Veja a errata E3 em Referências.',
      tabela: () => ({ colunas: ['Critério', 'τ (MPa)', 'd mín (mm)', 'd normalizado (mm)', 'P máx (kW)'], linhas: crits.map(c => { const pc = R.por_criterio[c]; return [E.CRITERIO_CURTO[c], F(pc.tau, 1), F(pc.d_min, 2), FA(pc.d_norm), fP(pc.p_max_norm)]; }), destacar: i => crits[i] === R.criterio_governante }) });
    p.append(grade('g2', cMat, cCrit));
    C.xy(cMat.corpo, {
      x: { tipo: 'log', dominio: [px0, px1], rotulo: 'Potência de cálculo (kW)', fmt: v => FI(v) }, y: { rotulo: 'Diâmetro mínimo (mm)', zero: false },
      series: seriesMat, margemDir: 46,
      pontos: [{ x: P, y: R.d_min, cor: 'em', guia: 'xy', rotulo: `${F(R.d_min, 1)} mm`, dica: [{ titulo: mat.nome }, { valor: `${fP(P)} kW`, rotulo: 'potência' }, { valor: `${F(R.d_min, 2)} mm`, rotulo: 'd mín' }] }],
      crosshair: { series: [seriesMat[seriesMat.length - 1].id], fmtX: v => `${fP(v)} kW` }, rotulo: 'Diâmetro mínimo em função da potência para cada material'
    }, { altura: w => Math.round(Math.max(260, Math.min(330, w * 0.6))) });
    C.barrasH(cCrit.corpo, { itens: itensCrit, fmt: v => F(v, 0), refs: [{ x: R.d_adotado, rotulo: `d adotado ${FA(R.d_adotado)} mm` }], alturaLinha: 46, rotulo: 'Diâmetro mínimo por critério' });
    cCrit.corpo.after(h('div', { class: 'crit-def' },
      h('div', null, h('b', null, 'Seção 5/8'), h('span', { html: `τ = τ<sub>máx</sub> da tabela da seção 4 (≈ Se/√3, von Mises) com SF ${FA(R.sf)}: é a equação do procedimento e a base das tabelas da seção 8.` })),
      h('div', null, h('b', null, 'Seção 9'), h('span', { html: 'τ = Se/3 (Tresca Se/2 ÷ 1,5): critério implícito nas tabelas por aplicação. Diâmetros ≈ 20 % maiores (∛(τ<sub>máx</sub>/(Se/3)) ≈ 1,20).' })),
      R.por_criterio.PERSONALIZADO ? h('div', null, h('b', null, 'Personalizado'), h('span', null, `τ = ${F(R.por_criterio.PERSONALIZADO.tau, 1)} MPa informado.`)) : null));

    // ── tabela de materiais
    const maxD = Math.max(...R.comparacao.map(c => c.d_norm));
    const linhasMat = R.comparacao.map(c => {
      const restr = [];
      if (!c.atende_temp) restr.push(`até ${FA(c.temp_min)} °C`);
      if (!c.atende_solda) restr.push('não soldável');
      return [h('span', null, c.material, c.selecionado ? h('span', { class: 'tag-mini' }, 'caso') : null, c.melhor ? h('span', { class: 'tag-mini t' }, 'menor ⌀') : null),
        FA(c.escoamento), F(c.tau, 1), F(c.d_min, 1), U.ibar(c.d_norm, maxD, FA(c.d_norm), c.selecionado ? 'em' : (c.atende_temp && c.atende_solda ? '' : 'de')),
        fP(c.p_max_norm), F(100 * c.utilizacao, 1) + ' %', restr.length ? U.stCel('atencao', restr.join(' · ')) : U.stCel('ok', 'elegível')];
    });
    p.append(sec('Comparação de materiais', `Mesmo caso com cada aço da seção 4 (critério ${E.CRITERIO_CURTO[critComp]}). Restrições de temperatura mínima e solda vêm das verificações opcionais.`,
      U.tbl({ colunas: [{ t: 'Material', cls: 'l' }, 'Se (MPa)', 'τ (MPa)', 'd mín (mm)', { t: 'd normalizado (mm)', cls: 'bar-cell' }, 'P máx (kW)', 'Utilização', { t: 'Restrições', cls: 'l' }],
        linhas: linhasMat, sel: i => R.comparacao[i].selecionado, legenda: 'Comparação de materiais' })));

    // ── ponta de eixo e equivalência com tabelas
    const dl = pares => h('dl', { class: 'dl' }, pares.filter(Boolean).map(([a, b]) => h('div', null, h('dt', { html: a }), h('dd', { html: b }))));
    const cPonta = h('article', { class: 'ccard' }, h('header', { class: 'ccard-head' }, h('div', null, h('span', { class: 'overline' }, 'DIN 748-1 · IEC 60072'), h('h3', null, 'Ponta de eixo'))),
      h('div', { class: 'ccard-body pad' }, dl([
        ['Diâmetro', `${FA(R.d_adotado)} mm <small>(${R.d_adotado_origem})</small>`],
        ['Tolerância ISO', `${R.tolerancia} <small>(k6 até 50 mm, m6 acima)</small>`],
        R.comprimento ? ['Comprimento · série longa', `${FI(R.comprimento[0])} mm`] : ['Comprimento', '— <small>(diâmetro fora da DIN 748-1)</small>'],
        R.comprimento && R.comprimento[1] ? ['Comprimento · série curta', `${FI(R.comprimento[1])} mm`] : null,
        ['Carcaças IEC', R.iec_carcacas.length ? R.iec_carcacas.join(', ') : '— <small>(tabela IEC até 100 mm)</small>'],
        R.iec_menor ? ['Menor ponta IEC ≥ d mín', `⌀${FA(R.iec_menor[0])} ${R.iec_menor[1]}${R.iec_menor[2].length ? ' · ' + R.iec_menor[2].join(', ') : ''}`] : null,
        ['Tensão nominal / de serviço', `${F(R.tau_nominal, 2)} / ${F(R.tau_servico, 2)} MPa`],
        ['Torque admissível', `${U.fN(R.mt_max)} N·m`]
      ])));
    const t8 = R.consulta_tab8, t9 = R.consulta_tab9;
    const bt8 = h('button', { type: 'button', class: 'btn btn-s', onclick: () => ctx.abrirTabela({ sec: 8, material: mat.nome, fs: R.fs }) }, svgIco('i-tabela'), t8 ? `Abrir tabela ${t8.secao}` : 'Abrir tabelas da seção 8');
    const bt9 = h('button', { type: 'button', class: 'btn btn-s', onclick: () => ctx.abrirTabela({ sec: 9, material: mat.nome, aplicacao: e.aplicacao in E.APLICACOES ? e.aplicacao : 'GERADORES' }) }, svgIco('i-tabela'), t9 ? `Abrir tabela ${t9.secao}` : 'Abrir tabelas da seção 9');
    const motivo8 = !E.secao_tabela8(mat.nome, R.fs) ? `FS ${FA(R.fs)} ou material sem tabela na seção 8` : 'rotação fora das colunas das tabelas';
    const cEq = h('article', { class: 'ccard' }, h('header', { class: 'ccard-head' }, h('div', null, h('span', { class: 'overline' }, 'Procedimento · seções 8 e 9'), h('h3', null, 'Equivalência com as tabelas'))),
      h('div', { class: 'ccard-body pad' }, dl([
        t8 ? [`Tabela ${t8.secao} · ${t8.coluna}`, `⌀${FA(t8.d)} mm <small>(${FI(t8.p_max)} kW)</small>`] : ['Tabelas da seção 8', `— <small>(${motivo8})</small>`],
        t8 && t8.abaixo ? ['Observação', 'abaixo da faixa da tabela (110 mm)'] : null,
        t9 ? [`Tabela ${t9.secao} · linha ${FI(t9.linha)} kW`, `${FI(t9.d)} mm <small>(impresso: ${FI(t9.d_doc)}${t9.errata ? ' · errata ' + t9.errata : ''})</small>`] : ['Tabelas da seção 9', `— <small>(${e.fs_personalizado != null ? 'FS informado difere da aplicação' : R.p_kw < 1000 ? 'potência abaixo de 1.000 kW' : 'sem tabela para o caso'})</small>`],
        t9 && t9.conservador ? ['Coluna da seção 9', `${t9.coluna} <small>(rotação menor mais próxima, lado conservador)</small>`] : null
      ]), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px' }, bt8, bt9)),
      h('p', { class: 'ccard-foot' }, 'As tabelas da seção 8 usam a mesma equação da seção 5 (τmáx): coincidem com o cálculo direto. As da seção 9 usam τ = Se/3 e dão diâmetros maiores — por isso os valores diferem. Linhas e colunas destacadas na aba Tabelas 8 · 9.'));
    p.append(sec(null, null, grade('g2', cPonta, cEq)));

    // ── verificações e tipo de carga
    const extras = [];
    if (R.verif_existente || R.verif_pico || e.temp_min_operacao != null || e.requer_solda) {
      const itens = [];
      if (R.verif_existente) { const v = R.verif_existente; itens.push([v.atende ? 'ok' : 'falha', `Diâmetro existente ⌀${FA(v.d)} mm`, v.atende ? `atende: d mín ${F(R.d_min, 1)} mm, utilização ${F(100 * v.utilizacao, 1)} %` : `faltam ${F(v.falta, 1)} mm; admite ${fP(v.p_max)} kW (${F(100 * v.p_max / R.p_kw, 1)} %)`]); }
      if (R.verif_pico) { const v = R.verif_pico; itens.push([v.atende ? 'ok' : 'falha', `Torque de pico ${FA(v.k)}× Mt`, `τ pico ${F(v.tau_pico, 1)} MPa ${v.atende ? '≤' : '>'} Se/√3 = ${F(v.tau_esc, 1)} MPa (margem ${F(v.margem, 2)})`]); }
      if (e.temp_min_operacao != null) { const ok = Number.isNaN(mat.temp_min) || e.temp_min_operacao >= mat.temp_min; itens.push([ok ? 'ok' : 'atencao', `Temperatura mínima ${FA(e.temp_min_operacao)} °C`, `${mat.nome} indicado até ${FA(mat.temp_min)} °C`]); }
      if (e.requer_solda) itens.push([mat.soldavel ? 'ok' : 'atencao', 'Eixo soldado', mat.soldavel ? `${mat.nome} é soldável` : `${mat.nome} não é soldável (seção 4)`]);
      extras.push(h('article', { class: 'ccard' }, h('header', { class: 'ccard-head' }, h('div', null, h('span', { class: 'overline' }, 'Verificações opcionais'), h('h3', null, 'Resultado das verificações'))),
        h('div', { class: 'ccard-body pad' }, h('div', { class: 'attn' }, itens.map(([s, t, d]) => h('div', { class: 'attn-item ' + (s === 'ok' ? 'nota' : s === 'falha' ? 'fail' : 'warn') }, svgIco(U.ST[s].ico), h('div', null, h('b', null, t), h('br'), d)))))));
    }
    for (const g of R.grupo_carga) {
      extras.push(h('article', { class: 'ccard' }, h('header', { class: 'ccard-head' }, h('div', null, h('span', { class: 'overline' }, `Tipo de carga · grupo ${g.grupo}`), h('h3', null, U.nomeApl(e.aplicacao)))),
        h('div', { class: 'ccard-body pad' }, dl([['Exemplos', g.exemplos], ['Conjugado de partida', g.partida], ['Conjugado máximo', g.maximo], ['Motor indicado', g.motor]]),
          h('ul', { class: 'hip', style: 'margin-top:12px' }, g.caracteristicas.map(c => h('li', null, c))))));
    }
    if (extras.length) p.append(sec(null, null, grade(extras.length > 1 ? 'g2' : '', ...extras)));
  };

  // ════════════════════════════════════════════════════════════════════════
  // Tabelas das seções 8 e 9 (mapa de calor)
  // ════════════════════════════════════════════════════════════════════════
  const est = { sec: 8, material: 'AISI 1045', fs: 1.25, aplicacao: 'GERADORES', impresso: false, iniciado: false };
  V.tabelasDefinir = function (o) { Object.assign(est, o, { iniciado: true }); };

  V.tabelas = function (p, ctx) {
    const R = ctx.R;
    if (!est.iniciado && R) {
      est.material = R.material.personalizado ? 'AISI 1045' : R.material.nome;
      est.fs = E.DADOS.FS_TABELAS_SECAO8.find(f => Math.abs(f - R.fs) < 1e-9) ?? 1.25;
      est.aplicacao = R.entrada.aplicacao in E.APLICACOES ? R.entrada.aplicacao : 'GERADORES';
      est.iniciado = true;
    }
    const re = () => { C.liberar(p); p.textContent = ''; V.tabelas(p, ctx); };
    // controles
    const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Seção do procedimento' },
      [[8, 'Seção 8 · potência máxima'], [9, 'Seção 9 · diâmetro mínimo']].map(([v, t]) => {
        const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(est.sec === v) }, t);
        b.addEventListener('click', () => { est.sec = v; re(); });
        return b;
      }));
    const sel = (rot, opcoes, valor, aoMudar, cls = '') => {
      const s = h('select', null, opcoes.map(([v, t]) => h('option', { value: String(v) }, t)));
      s.value = String(valor);
      s.addEventListener('change', () => { aoMudar(s.value); re(); });
      return h('label', { class: 'fld ' + cls }, h('span', { class: 'fld-label' }, h('span', null, rot)), h('span', { class: 'inp' }, s));
    };
    const cMat = sel('Material', E.ORDEM_MATERIAIS_DOC.map(m => [m, m]), est.material, v => { est.material = v; });
    const cFs = est.sec === 8 ? sel('Fator de serviço', E.DADOS.FS_TABELAS_SECAO8.map(f => [f, 'FS ' + FA(f)]), est.fs, v => { est.fs = Number(v); })
      : sel('Aplicação', E.DADOS.ORDEM_APLICACOES_SECAO9.map(a => [a, `${U.nomeApl(a)} · FS ${FA(E.APLICACOES[a])}`]), est.aplicacao, v => { est.aplicacao = v; }, 'w');
    let cImp = null;
    if (est.sec === 9) {
      const chk = h('input', { type: 'checkbox', role: 'switch', id: 'tb-imp' });
      chk.checked = est.impresso;
      chk.addEventListener('change', () => { est.impresso = chk.checked; re(); });
      cImp = h('label', { class: 'sw', for: 'tb-imp' }, h('span', { class: 'sw-txt' }, h('strong', null, 'Como impresso'), h('small', null, 'inclui as erratas E1 e E2')), chk);
    }
    const bCaso = h('button', { type: 'button', class: 'btn btn-s' }, 'Caso atual');
    bCaso.addEventListener('click', () => { est.iniciado = false; re(); });
    const bCsv = h('button', { type: 'button', class: 'btn btn-s' }, svgIco('i-baixar'), 'CSV');
    p.append(h('div', { class: 'tb-ctrls' }, h('div', { class: 'fld' }, h('span', { class: 'fld-label' }, h('span', null, 'Tabela')), seg), cMat, cFs, cImp, h('div', { class: 'tb-acoes' }, bCaso, bCsv)));

    // dados
    const m = E.MATERIAIS[est.material];
    const cols = E.COLUNAS_ROTACAO, rots = E.ROTACOES_COLUNAS;
    let linhas, valores, titulo, sub, unidade, secao, fsTab, errataCel = () => null;
    if (est.sec === 8) {
      fsTab = est.fs; secao = E.secao_tabela8(m.nome, fsTab);
      linhas = E.DIAMETROS_SECAO8;
      valores = E.tabela_potencia_maxima(m, fsTab, 'SECAO_5').map(r => r.map(Math.round));
      titulo = `Potência máxima admissível (kW) · ${m.nome} · FS ${FA(fsTab)}`; unidade = 'kW';
      sub = 'Linhas: diâmetro da ponta de eixo (mm). Colunas: frequência · polos · rotação síncrona. SF 9 sobre τmáx (seção 5).';
    } else {
      fsTab = E.APLICACOES[est.aplicacao]; secao = E.secao_tabela9(est.aplicacao, m.nome);
      linhas = E.POTENCIAS_SECAO9;
      valores = est.impresso ? linhas.map(P => rots.map(n => E.valor_tabela9_documento(m, fsTab, P, n)))
        : E.tabela_diametro_minimo(m, fsTab, 'SECAO_9').map(r => r.map(Math.round));
      errataCel = (i) => est.impresso ? E.errata_aplicavel(m.nome, fsTab, linhas[i]) : null;
      titulo = `Diâmetro mínimo (mm) · ${U.nomeApl(est.aplicacao)} · ${m.nome} · FS ${FA(fsTab)}`; unidade = 'mm';
      sub = `Linhas: potência (kW). Colunas: frequência · polos · rotação síncrona. τ = Se/3. ${est.impresso ? 'Valores como impressos no documento (células com ponto vermelho seguem uma errata).' : 'Valores recalculados pelo critério da própria seção 9.'}`;
    }
    // destaque do caso
    let col = -1, lin = -1;
    if (R) {
      col = rots.findIndex(r => Math.abs(r - R.n_rpm) < 0.5);
      if (col >= 0) lin = est.sec === 8 ? valores.findIndex(r => r[col] >= R.p_kw - 1e-9) : linhas.findIndex(P => P >= R.p_kw - 1e-9);
    }
    // cores (escala logarítmica)
    const T = C.tema();
    const rampa = C.rampa(T.seqLo, T.seqHi);
    const flat = valores.flat().filter(v => v > 0);
    const lmin = Math.log(Math.min(...flat)), lmax = Math.log(Math.max(...flat));
    const corDe = v => rampa((Math.log(Math.max(v, 1e-9)) - lmin) / (lmax - lmin || 1));
    const tabela = h('table', { class: 'heat' },
      h('caption', { class: 'sr-only' }, titulo),
      h('thead', null, h('tr', null, h('th', { class: 'rh', scope: 'col' }, est.sec === 8 ? 'd (mm)' : 'P (kW)'),
        cols.map(([f, pp], j) => h('th', { scope: 'col', class: j === col ? 'csel' : null }, `${f} Hz · ${pp}p`, h('small', null, `${FI(rots[j])} rpm`))))),
      h('tbody', null, linhas.map((L, i) => h('tr', { class: i === lin ? 'rsel' : null },
        h('th', { class: 'rh', scope: 'row' }, FI(L)),
        valores[i].map((v, j) => {
          const bg = corDe(v), escuro = C.luminancia(bg) < 0.33;
          const err = errataCel(i);
          const td = h('td', { class: [j === col ? 'csel' : '', err ? 'err' : ''].join(' ').trim() || null,
            title: `${cols[j][0]} Hz · ${cols[j][1]} polos · ${FI(rots[j])} rpm — ${est.sec === 8 ? `⌀${FI(L)} mm: ${FI(v)} kW` : `${FI(L)} kW: ${FI(v)} mm`}${err ? ` (errata ${err})` : ''}${i === lin && j === col ? ' · caso atual' : ''}` }, FI(v));
          td.style.background = bg; td.style.color = escuro ? '#f4f8f8' : '#0d1a22';
          return td;
        })))));
    const casoTxt = R && col >= 0 && lin >= 0 ? `Caso atual: ${fP(R.p_kw)} kW a ${FI(rots[col])} rpm → ${est.sec === 8 ? `⌀${FI(linhas[lin])} mm (${FI(valores[lin][col])} kW)` : `linha ${FI(linhas[lin])} kW → ${FI(valores[lin][col])} mm`}.`
      : R ? (col < 0 ? `A rotação do caso (${F(R.n_rpm, 0)} rpm) não coincide com as colunas — use o cálculo direto.` : 'A potência do caso está fora desta tabela.') : '';
    p.append(h('div', { class: 'tb-title' }, h('h3', null, secao ? h('span', null, `Tabela ${secao} · `) : null, titulo), h('p', null, casoTxt)),
      h('div', { class: 'heat-wrap', tabindex: '0', role: 'region', 'aria-label': titulo }, tabela),
      h('div', { class: 'heat-legend' }, h('span', null, 'menor'), (() => { const r = h('span', { class: 'ramp' }); r.style.background = `linear-gradient(90deg, ${[0, .25, .5, .75, 1].map(t => rampa(t)).join(', ')})`; return r; })(), h('span', null, `maior ${unidade} (escala log)`),
        h('span', null, h('i', { class: 'sw-cell' }), 'linha/coluna do caso'), est.sec === 9 && est.impresso ? h('span', null, h('i', { class: 'err-dot' }), 'errata') : null),
      h('p', { class: 'fld-hint', style: 'margin-top:8px' }, sub));
    bCsv.addEventListener('click', () => {
      const cab = [est.sec === 8 ? 'd (mm)' : 'P (kW)'].concat(cols.map(([f, pp], j) => `${f} Hz ${pp}p ${rots[j]} rpm`));
      const csv = [cab.join(';')].concat(linhas.map((L, i) => [L].concat(valores[i]).join(';'))).join('\r\n');
      U.baixar(`tabela-${secao || est.sec}${est.impresso ? '-impressa' : ''}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    });
  };
})(window);
