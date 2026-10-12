/*!
 * VG · Telas do laboratório: visão geral, memória de cálculo, ferramentas e referências
 */
(function (raiz) {
  'use strict';
  const E = raiz.VGEngine, D = raiz.VGDiag, M = raiz.VGMath, U = raiz.VGUI;
  const { h, svgIco, F, FA, FI, fP, sec, grade } = U;
  const V = raiz.VGViews = raiz.VGViews || {};

  // ════════════════════════════════════════════════════════════════════════
  // Visão geral
  // ════════════════════════════════════════════════════════════════════════
  function veredito(o) {
    return h('article', { class: 'verdict ' + o.st },
      h('div', { class: 'verdict-top' }, h('span', { class: 'overline' }, o.overline), U.badge(o.st, o.badgeTxt)),
      o.corpo || [
        h('div', null,
          h('div', { class: 'hero' }, h('span', { class: 'sym' }, o.simb), h('span', { class: 'val' }, o.val), h('span', { class: 'uni' }, o.uni)),
          h('p', { class: 'hero-sub', html: o.sub, style: 'margin-top:6px' })),
        o.medidor ? U.medidor(o.medidor) : null,
        h('div', { class: 'minis' }, o.minis.map(([l, v, s]) => h('div', { class: 'mini' }, h('span', null, l), h('b', null, v), s ? h('small', null, s) : null)))
      ]);
  }

  V.visao = function (p, ctx) {
    const R = ctx.R, m = R.mancal, e = R.entrada;
    // ── vereditos
    const vE = veredito({
      overline: e.diametro_existente ? 'Ponta de eixo · verificação' : 'Ponta de eixo', st: R.status, simb: 'd', val: FA(R.d_adotado), uni: 'mm',
      badgeTxt: R.status === 'ok' ? 'Atende' : R.status === 'atencao' ? 'Com ressalvas' : 'Não atende',
      sub: `d mín <b>${F(R.d_min, 2)} mm</b> · ${e.diametro_existente ? 'diâmetro informado' : (R.d_norm_especial ? 'diâmetro especial' : e.serie_diametros)} · ${R.tolerancia}` + (R.comprimento ? ` · L ${FI(R.comprimento[0])} mm` : ''),
      medidor: { rotulo: 'Utilização da capacidade (P / P máx)', valor: 100 * R.utilizacao, max: Math.max(120, 100 * R.utilizacao * 1.08), txt: `${F(100 * R.utilizacao, 1)} %`,
        classe: R.utilizacao > 1 + 1e-9 ? 'fail' : '', marca: 100, marcaRotulo: 'capacidade 100 %' },
      minis: [['Torque', `${F(R.mt / 1000, 2)} kN·m`, `com FS ${F(R.mt * R.fs / 1000, 2)} kN·m`],
        ['SF real', F(R.sf_real, 2), `mínimo ${FA(R.sf)}`], ['P máx', `${fP(R.p_max)} kW`, `margem ${R.p_max >= R.p_kw ? '+' : ''}${F(100 * R.p_max / R.p_kw - 100, 1)} %`]]
    });
    let vM;
    if (m) {
      const k = m.critico, hm = k.hmin * 1e6, hl = m.h_lim * 1000, c = m.principal;
      vM = veredito({
        overline: 'Mancal de deslizamento', st: m.status, simb: 'h', val: F(hm, 1), uni: 'µm',
        badgeTxt: m.status === 'ok' ? 'Atende' : m.status === 'atencao' ? 'Com ressalvas' : 'Não atende',
        sub: `Filme mínimo, pior caso (${k.rotulo}) · <b>${hm >= hl ? '≥' : '<'} h lim ${FA(hl)} µm</b>`,
        medidor: { rotulo: 'Filme mínimo × limite da tabela', valor: hm, max: Math.max(hm, hl) * 1.18, txt: `${F(hm / hl, 1)}× o limite`, classe: hm < hl ? 'fail' : '', marca: hl, marcaRotulo: `h lim ${FA(hl)}` },
        minis: [['Pressão p̄', `${F(m.p, 2)} N/mm²`, `admissível ${FA(m.p_lim)}`], ['Óleo', `ISO VG ${m.vg}`, `${F(m.t_eff, m.balanco ? 1 : 0)} °C · ${m.balanco ? 'balanço' : 'informada'}`],
          ['Perda', `${F(c.pf / 1000, 2)} kW`, `ΔT ${F(m.dt_1min, 1)} K/min`]]
      });
    } else if (R.mancal_erro) {
      vM = veredito({ overline: 'Mancal de deslizamento', st: 'erro', corpo: [
        h('p', { class: 'muted' }, 'Não foi possível calcular o mancal com os dados atuais:'),
        h('ul', { class: 'hip' }, R.mancal_erro.split(' · ').map(t => h('li', null, t))),
        h('div', null, h('button', { class: 'btn btn-s', type: 'button', onclick: () => ctx.focar('mancal_carga') }, 'Revisar dados do mancal'))] });
    } else {
      vM = veredito({ overline: 'Mancal de deslizamento', st: 'off', corpo: [
        h('p', { class: 'muted' }, 'O cálculo do mancal está desativado. Ative para verificar o filme de óleo, a pressão, o óleo e a perda por atrito a partir do mesmo eixo.'),
        h('div', null, h('button', { class: 'btn btn-s', type: 'button', onclick: () => ctx.definir('mancal_ativo', true) }, 'Ativar o mancal'))] });
    }
    p.append(sec(null, null, h('div', { class: 'verdicts' }, vE, vM)));

    // ── desenho esquemático
    const cMont = U.ccard({ overline: 'Desenho esquemático', titulo: 'Ponta de eixo e mancal',
      nota: 'Diâmetros e comprimentos em escala real entre si; rasgo de chaveta, transições e caixa apenas indicativos. Cotas em milímetros.' });
    const dl = pares => h('dl', { class: 'dl' }, pares.filter(Boolean).map(([a, b]) => h('div', null, h('dt', null, a), h('dd', { html: b }))));
    const areaDesenho = h('div', { style: 'min-width:0' });
    const ficha = h('div', { class: 'mont-spec' },
      h('div', null, h('h4', null, h('i'), 'Ponta de eixo'), dl([
        ['Diâmetro', `⌀${FA(R.d_adotado)} ${R.tolerancia}`],
        ['Comprimento', R.comprimento ? `${FI(R.comprimento[0])} mm <small>(curta ${R.comprimento[1] ? FI(R.comprimento[1]) : '—'})</small>` : '—'],
        ['Material', R.material.nome],
        ['Torque nominal', `${U.fN(R.mt)} N·m`]])),
      m ? h('div', null, h('h4', { class: 'm' }, h('i'), 'Mancal'), dl([
        ['Colo D × B', `${FA(m.d)} × ${F(m.l, 1)} mm`],
        ['Furo H7', `${F(m.furo_min, 3)}–${F(m.furo_max, 3)}`],
        ['Colo do eixo', `${F(m.eixo_min, 3)}–${F(m.eixo_max, 3)}`],
        ['Óleo · carga', `VG ${m.vg} · ${F(m.carga / 1000, 1)} kN`]])) : null);
    cMont.corpo.replaceWith(h('div', { class: 'mont' }, areaDesenho, ficha));
    p.append(sec(null, null, cMont));
    D.montagem(areaDesenho, R);

    // ── fluxo do cálculo (eixo · mancal)
    const passosE = [
      { id: 'E1', nm: 'Potência de cálculo', v: fP(R.p_kw), u: 'kW' },
      { id: 'E2', nm: 'Rotação', v: F(R.n_rpm, R.n_rpm % 1 ? 1 : 0), u: 'rpm' },
      { id: 'E5', nm: 'Torque nominal', v: F(R.mt / 1000, 2), u: 'kN·m' },
      { id: 'E6', nm: 'Diâmetro mínimo', v: F(R.d_min, 1), u: 'mm' },
      { id: 'E7', nm: e.diametro_existente ? 'Diâmetro verificado' : 'Diâmetro adotado', v: FA(R.d_adotado), u: 'mm', st: R.status === 'falha' ? 'falha' : '' }
    ];
    const passosM = m ? [
      { id: 'M2', nm: 'Colo D × B', v: `${FA(m.d)} × ${F(m.l, 1)}`, u: 'mm' },
      { id: 'M6', nm: 'Pressão específica', v: F(m.p, 2), u: 'N/mm²', st: m.p > m.p_falha ? 'falha' : '' },
      { id: 'M18', nm: 'Sommerfeld', v: F(m.principal.so, 3), u: '' },
      { id: 'M19', nm: 'Excentricidade', v: F(m.principal.eps, 3), u: '' },
      { id: 'M22', nm: 'Filme mínimo', v: F(m.critico.hmin * 1e6, 1), u: 'µm', st: m.critico.hmin * 1000 < m.h_lim ? 'falha' : '' }] : [];
    const linhaPassos = (passos, mancal, titulo, sub) => h('div', { class: 'pipe-row' + (mancal ? ' m' : '') }, h('div', { class: 'pipe-lbl' }, h('b', null, titulo), h('small', null, sub)),
      h('div', { class: 'pipeline', role: 'list', 'aria-label': titulo }, passos.map(s => h('button', { type: 'button', role: 'listitem', class: 'step' + (mancal ? ' mancal' : '') + (s.st ? ' ' + s.st : ''), 'data-ref': s.id, title: `Abrir ${s.id} na memória de cálculo` },
        h('span', { class: 'sid' }, s.id), h('span', { class: 'snm' }, s.nm), h('span', { class: 'sv' }, s.v, s.u ? h('small', null, ' ' + s.u) : null)))));
    p.append(sec('Fluxo do cálculo', 'Da potência ao filme de óleo. Cada etapa abre a equação, a substituição numérica e a fonte na memória de cálculo.',
      h('div', { class: 'pipes' }, linhaPassos(passosE, false, 'Ponta de eixo', 'seções 4 a 9'), m ? linhaPassos(passosM, true, 'Mancal', 'DIN 31652 · Reynolds') : null)));

    // ── pontos de atenção
    const itens = U.itensAtencao(R);
    const nF = itens.filter(i => i.sev !== 'nota').length;
    p.append(sec('Pontos de atenção', itens.length ? `${nF ? nF + (nF > 1 ? ' avisos' : ' aviso') + ' de verificação' : 'Nenhum aviso de verificação'} · ${itens.length - nF} ${itens.length - nF === 1 ? 'nota' : 'notas'} sobre hipóteses e convenções.` : 'Nenhum aviso.',
      itens.length ? U.listaAtencao(itens) : h('p', { class: 'muted' }, 'Sem avisos para este caso.')));
  };

  // ════════════════════════════════════════════════════════════════════════
  // Memória de cálculo
  // ════════════════════════════════════════════════════════════════════════
  function valorRes(r) { return r.c === 'sci' ? E.fmt_sci(r.v, 3) : E.fmt(r.v, r.c); }
  function itemMemoria(it, mancal) {
    const est = it.estado === 'ok' ? U.badge('ok') : it.estado === 'falha' ? U.badge('falha') : it.estado === 'aviso' ? U.badge('aviso') : null;
    return h('article', { class: 'mem-item' + (mancal ? ' m' : ''), id: 'mem-' + it.id, 'aria-labelledby': 'mh-' + it.id },
      h('div', { class: 'mem-h' }, h('span', { class: 'mem-id' }, it.id), h('h3', { id: 'mh-' + it.id }, it.titulo), h('span', { class: 'mem-src' }, (it.tipo === 'consulta' ? 'Consulta · ' : '') + it.fonte), est),
      it.resultado ? h('div', { class: 'mem-res' }, h('div', { class: 'mem-res-v', html: M.mathml(it.resultado.s) + ` <b>${valorRes(it.resultado)}</b>` + (it.resultado.u ? ` <small>${it.resultado.u}</small>` : '') })) : null,
      h('div', { class: 'mem-eq' }, it.linhas.map(l => h('div', { class: 'ln', html: M.mathml(l, true) }))),
      it.vars.length ? h('div', { class: 'mem-vars' }, it.vars.flatMap(x => [h('span', { class: 'vs', html: M.mathml(x.s) }), h('span', { class: 'vd' }, x.d), h('span', { class: 'vv' }, x.v + (x.u ? ' ' + x.u : ''))])) : null,
      it.nota ? h('p', { class: 'mem-note' }, it.nota) : null);
  }
  V.memoria = function (p, ctx) {
    const mem = ctx.memoria, R = ctx.R;
    const idx = h('nav', { class: 'mem-index', 'aria-label': 'Índice da memória de cálculo' },
      h('h4', null, 'Ponta de eixo'), mem.eixo.map(it => h('a', { href: '#mem-' + it.id, 'data-ref': it.id }, h('span', { class: 'i' }, it.id), h('span', null, it.titulo), h('span', { class: 'd ' + (it.estado || '') }))),
      mem.mancal.length ? [h('h4', null, 'Mancal'), mem.mancal.map(it => h('a', { href: '#mem-' + it.id, class: 'm', 'data-ref': it.id }, h('span', { class: 'i' }, it.id), h('span', null, it.titulo), h('span', { class: 'd ' + (it.estado || '') })))] : null);
    const bCopiar = h('button', { type: 'button', class: 'btn btn-s' }, svgIco('i-copiar'), 'Copiar como texto');
    bCopiar.addEventListener('click', async () => { const ok = await U.copiar(raiz.VGMemoria.comoTexto(mem, R)); U.toast(ok ? 'Memória de cálculo copiada' : 'Não foi possível copiar'); });
    const bRel = h('a', { class: 'btn btn-s', href: ctx.linkRelatorio(), target: '_blank', rel: 'noopener' }, svgIco('i-pdf'), 'Relatório para PDF');
    const corpo = h('div', null,
      h('div', { class: 'mem-toolbar' }, h('p', null, 'Cada grandeza tem identificação (E = ponta de eixo, M = mancal), forma simbólica, substituição com os valores do caso, resultado com unidade, fonte e verificação.'), h('div', { style: 'display:flex;gap:6px' }, bCopiar, bRel)),
      h('h2', { class: 'mem-group-title' }, `Ponta de eixo · ${mem.eixo.length} etapas`),
      h('div', { class: 'mem-list' }, mem.eixo.map(it => itemMemoria(it, false))),
      mem.mancal.length ? [h('h2', { class: 'mem-group-title' }, `Mancal de deslizamento · ${mem.mancal.length} etapas`), h('div', { class: 'mem-list' }, mem.mancal.map(it => itemMemoria(it, true)))] :
        h('p', { class: 'muted', style: 'margin-top:20px' }, R.mancal_erro ? 'Mancal não calculado: ' + R.mancal_erro : 'Mancal desativado.'));
    idx.addEventListener('click', ev => { const a = ev.target.closest('a[data-ref]'); if (!a) return; ev.preventDefault(); ctx.irMemoria(a.dataset.ref); });
    p.append(h('div', { class: 'mem-layout' }, idx, corpo));
  };

  // ════════════════════════════════════════════════════════════════════════
  // Ferramentas rápidas (independentes do caso)
  // ════════════════════════════════════════════════════════════════════════
  const FERRAMENTAS = [
    { id: 'sinc', n: '01', cat: 'Campo girante', titulo: 'Velocidade síncrona', desc: 'Velocidade do campo girante pela frequência da rede e pelo número de polos.',
      campos: [['f', 'Frequência', 'Hz', 60], ['p', 'Polos', 'polos', 4]],
      eq: () => M.r(M.i('n', 's'), M.o('='), M.f(M.r(M.n(120), M.o('·'), M.i('f')), M.i('p'))),
      calc: ({ f, p }) => { if (!(f > 0)) throw 'Frequência deve ser maior que zero.'; if (!(p >= 2) || p % 2) throw 'Polos: número inteiro, par e ≥ 2.'; const n = 120 * f / p; return [F(n, n % 1 ? 1 : 0), 'rpm', `ω = ${F(2 * Math.PI * n / 60, 2)} rad/s`]; } },
    { id: 'torque', n: '02', cat: 'Potência e rotação', titulo: 'Torque no eixo', desc: 'Torque a partir da potência mecânica e da rotação (mesma constante da seção 5).',
      campos: [['P', 'Potência', 'kW', 7.5], ['n', 'Rotação', 'rpm', 1750]],
      eq: () => M.r(M.i('M', 't'), M.o('='), M.f(M.r(M.n(9550), M.o('·'), M.i('P')), M.i('n'))),
      calc: ({ P, n }) => { if (!(P > 0) || !(n > 0)) throw 'Informe potência e rotação maiores que zero.'; const t = 9550 * P / n; return [U.fN(t), 'N·m', `${F(t / 9.80665, 1)} kgf·m`]; } },
    { id: 'tau', n: '03', cat: 'Resistência', titulo: 'Tensão de torção', desc: 'Cisalhamento máximo em eixo maciço sob torção pura.',
      campos: [['Mt', 'Torque', 'N·m', 26528], ['d', 'Diâmetro', 'mm', 200]],
      eq: () => M.r(M.i('τ'), M.o('='), M.f(M.r(M.n(16), M.o('·'), M.i('M', 't')), M.r(M.i('π'), M.o('·'), M.sup(M.i('d'), M.n(3))))),
      calc: ({ Mt, d }) => { if (!(Mt > 0) || !(d > 0)) throw 'Informe torque e diâmetro maiores que zero.'; const t = E.tensao_torcao(Mt, d); return [U.fN(t), 'MPa', 'Torque em N·m, diâmetro em mm.']; } },
    { id: 'corrente', n: '04', cat: 'Sistema trifásico', titulo: 'Corrente de linha', desc: 'Estimativa para motor trifásico pela potência de saída, tensão, fator de potência e rendimento.',
      campos: [['P', 'Potência de saída', 'kW', 7.5], ['V', 'Tensão de linha', 'V', 380], ['fp', 'Fator de potência', '', 0.85], ['eta', 'Rendimento', '', 0.9]],
      eq: () => M.r(M.i('I'), M.o('≈'), M.f(M.r(M.n(1000), M.o('·'), M.i('P')), M.r(M.rt(M.n(3)), M.o('·'), M.i('V', 'L'), M.o('·'), M.i('cos'), M.i('φ'), M.o('·'), M.i('η')))),
      calc: ({ P, V, fp, eta }) => { if (!(P > 0) || !(V > 0)) throw 'Informe potência e tensão maiores que zero.'; if (!(fp > 0 && fp <= 1) || !(eta > 0 && eta <= 1)) throw 'cos φ e η entre 0 e 1.'; const I = 1000 * P / (Math.sqrt(3) * V * fp * eta); return [U.fN(I), 'A', 'Sem corrente de partida nem harmônicas.']; } },
    { id: 'escorregamento', n: '05', cat: 'Motor de indução', titulo: 'Escorregamento', desc: 'Diferença relativa entre a velocidade síncrona e a do rotor.',
      campos: [['ns', 'Síncrona ns', 'rpm', 1800], ['n', 'Rotor n', 'rpm', 1750]],
      eq: () => M.r(M.i('s'), M.o('='), M.f(M.r(M.i('n', 's'), M.o('−'), M.i('n')), M.i('n', 's')), M.o('·'), M.n(100), M.u('%')),
      calc: ({ ns, n }) => { if (!(ns > 0) || !(n >= 0)) throw 'Velocidades devem ser positivas.'; const s = (ns - n) / ns * 100; return [F(s, 2), '%', s < 0 ? 'n > ns: operação como gerador.' : 'Operação como motor (0 ≤ n ≤ ns).']; } },
    { id: 'rad', n: '06', cat: 'Unidades', titulo: 'rpm ↔ rad/s', desc: 'Velocidade angular a partir da rotação (e o caminho inverso no resultado).',
      campos: [['n', 'Rotação', 'rpm', 1800]],
      eq: () => M.r(M.i('ω'), M.o('='), M.f(M.r(M.n(2), M.o('·'), M.i('π'), M.o('·'), M.i('n')), M.n(60))),
      calc: ({ n }) => { if (!(n >= 0)) throw 'Rotação deve ser positiva.'; const w = 2 * Math.PI * n / 60; return [F(w, 3), 'rad/s', `${FA(n / 60)} rotações por segundo · 1 rad/s = ${F(60 / (2 * Math.PI), 3)} rpm`]; } }
  ];
  V.ferramentas = function (p) {
    p.append(sec('Ferramentas rápidas', 'Relações isoladas para conferência e triagem — calculam enquanto você digita e não alteram o caso.'));
    const grid = h('div', { class: 'tools' });
    for (const t of FERRAMENTAS) {
      const out = h('div', { class: 'tool-out', 'aria-live': 'polite' });
      const vals = {};
      const atualizar = () => {
        out.className = 'tool-out';
        try {
          const [v, u, nota] = t.calc(vals);
          out.replaceChildren(h('span', null, 'Resultado'), h('b', null, v, ' ', h('small', null, u)), h('em', null, nota));
        } catch (msg) { out.className = 'tool-out err'; out.replaceChildren(h('span', null, 'Verifique os dados'), h('b', null, typeof msg === 'string' ? msg : 'Dados inválidos.')); }
      };
      const campos = t.campos.map(([k, rot, un, padrao]) => {
        vals[k] = padrao;
        const id = `t-${t.id}-${k}`;
        const inp = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: E.fmt_campo(padrao) });
        inp.addEventListener('input', () => {
          try { vals[k] = E.ler_numero(inp.value, rot, true); inp.parentNode.classList.remove('err'); }
          catch (_) { vals[k] = NaN; inp.parentNode.classList.add('err'); }
          atualizar();
        });
        return h('div', { class: 'fld' }, h('label', { class: 'fld-label', for: id }, h('span', null, rot)), h('div', { class: 'inp' }, inp, un ? h('span', { class: 'un' }, un) : null));
      });
      const linhas = [];
      for (let i = 0; i < campos.length; i += 2) linhas.push(h('div', { class: 'fld-row' }, campos.slice(i, i + 2)));
      grid.append(h('article', { class: 'tool' },
        h('div', { class: 'tool-h' }, h('div', null, h('span', { class: 'overline' }, t.cat), h('h3', null, t.titulo)), h('span', { class: 'tool-n' }, t.n)),
        h('p', { class: 'desc' }, t.desc),
        h('div', { class: 'tool-f' }, linhas, h('div', { class: 'tool-eq', html: M.mathml(t.eq(), true) })),
        out));
      atualizar();
    }
    p.append(grid);
  };

  // ════════════════════════════════════════════════════════════════════════
  // Referências
  // ════════════════════════════════════════════════════════════════════════
  V.referencias = function (p, ctx) {
    const R = ctx.R, DD = E.DADOS, e = R ? R.entrada : {};
    const card = (titulo, lead, ...c) => h('article', { class: 'ref-card' }, h('h3', null, titulo), lead ? h('p', { class: 'lead', html: lead }) : null, ...c);
    // hipóteses
    p.append(sec('Hipóteses, fontes e tabelas', 'Tudo o que o cálculo assume e de onde vem cada número.'));
    const hip = card('Hipóteses do modelo', null, h('ul', { class: 'hip' },
      h('li', { html: '<b>Ponta de eixo:</b> seção circular maciça sob torção pura, com fator de serviço (seção 6.2.7) e fator de segurança mínimo 9 sobre o cisalhamento máximo (seção 5). Não avalia flexão, fadiga, concentração de tensões, rasgo de chaveta nem velocidade crítica.' }),
      h('li', { html: '<b>Seleção:</b> menor diâmetro da série DIN 748-1 (ou da série escolhida) maior ou igual ao mínimo; acima de 630 mm, múltiplo de 10 mm.' }),
      h('li', { html: '<b>Mancal:</b> cilíndrico, regime permanente, geometria rígida e alinhada, viscosidade uniforme à temperatura efetiva; ε e β pela solução numérica da equação de Reynolds com condição de cavitação de Reynolds.' }),
      h('li', { html: '<b>Folgas:</b> furo H7 e folgas diametrais mínima/máxima das tabelas da planilha; os três casos (mínima, média e máxima) são verificados e o pior filme governa.' }),
      h('li', { html: '<b>Óleo:</b> viscosidade pela reta de Walther (ASTM D341) entre 40 °C (ISO VG) e um valor típico a 100 °C; densidade com dilatação de 0,065 %/K.' }),
      h('li', { html: '<b>Temperatura:</b> informada (padrão 40 °C, como a planilha) ou por balanço térmico da caixa em convecção natural (DIN 31652-2).' })));
    const fontes = card('Fontes', null, h('ul', { class: 'hip' }, DD.REFERENCIAS.map(r => h('li', null, r))));
    p.append(grade('g2', hip, fontes));
    // materiais e FS
    const mats = card('Materiais do eixo (seção 4)', 'τ<sub>máx</sub> ≈ Se/√3 (tabela) é usado no critério da seção 5/8; o critério da seção 9 usa Se/3.',
      U.tbl({ colunas: ['Material', 'Su (MPa)', 'Se (MPa)', 'τmáx (MPa)', 'τadm (MPa)', 'T mín (°C)', { t: 'Soldável', cls: 'c' }],
        linhas: E.ORDEM_MATERIAIS_DOC.map(n => { const m = E.MATERIAIS[n]; return [m.nome + (m.observacao ? ` · ${m.observacao.toLowerCase()}` : ''), FA(m.ruptura), FA(m.escoamento), FA(m.tau_max), FA(m.tau_adm), FA(m.temp_min), m.soldavel ? 'sim' : 'não']; }),
        sel: i => E.ORDEM_MATERIAIS_DOC[i] === e.material, compacta: true }));
    const fs = card('Fatores de serviço (tabela 6.2.7)', 'Regime contínuo, 24 h/dia.',
      U.tbl({ colunas: ['Aplicação', 'FS'], linhas: DD.APLICACOES.map(([a, f]) => [U.nomeApl(a), FA(f)]), sel: i => DD.APLICACOES[i][0] === e.aplicacao, compacta: true }));
    p.append(sec(null, null, mats));
    // pontas de eixo e IEC
    const comp = card('Comprimento da ponta de eixo (DIN 748-1)', 'Série longa e curta por faixa de diâmetro (mm).',
      U.tbl({ colunas: ['Diâmetros (mm)', 'Longa', 'Curta'], linhas: DD.GRUPOS_COMPRIMENTO.map(([ds, l, c]) => [ds.join(' · '), FI(l), c ? FI(c) : '—']),
        sel: i => R && DD.GRUPOS_COMPRIMENTO[i][0].includes(R.d_adotado), compacta: true }));
    const iec = card('Harmonização IEC (seção 7)', 'Pontas de eixo de motores IEC até 100 mm e carcaças correspondentes.',
      U.tbl({ colunas: ['d (mm)', { t: 'Tol.', cls: 'c' }, { t: 'Carcaças IEC', cls: 'wrap' }], linhas: DD.HARMONIZACAO_IEC.map(([d, t, l]) => [FI(d), t, l.length ? l.map(([c, pol]) => c + (pol === '2' ? ' (2p)' : pol === 'demais' ? ' (demais)' : '')).join(', ') : '—']),
        sel: i => R && DD.HARMONIZACAO_IEC[i][0] === R.d_adotado, compacta: true }));
    p.append(grade('g2', fs, comp), sec(null, null, iec));
    // tabelas do mancal
    const vel = ['≤ 0,3', '≤ 3', '≤ 10', '≤ 30', '> 30'];
    const fdR = ['≤ 63', '≤ 160', '< 400', '≤ 1.000', '≤ 2.500', '> 2.500'];
    const hlim = card('Espessura mínima admissível h lim (µm)', 'Linhas: diâmetro do colo D (mm). Colunas: velocidade periférica v (m/s).',
      U.tbl({ colunas: ['D \\ v'].concat(vel), linhas: Object.keys(DD.H_LIM_TABELA).map((k, i) => [fdR[i]].concat(DD.H_LIM_TABELA[k].map(x => FI(x * 1000)))),
        sel: i => R && R.mancal && R.mancal.fd === i + 1, compacta: true }));
    const psi = card('Folga relativa média ψm (‰)', 'Linhas: D (mm). Colunas: v (m/s).',
      U.tbl({ colunas: ['D \\ v', '≤ 3', '≤ 10', '≤ 25', '≤ 50', '> 50'], linhas: Object.keys(DD.PSI_TABELA).map((k, i) => [['≤ 100', '≤ 250', '≤ 500', '> 500'][i]].concat(DD.PSI_TABELA[k].map(x => x === null ? '—' : FA(x)))),
        sel: i => R && R.mancal && R.mancal.psi_fatores && R.mancal.psi_fatores[0] === i + 1, compacta: true }));
    const vg = card('Óleo recomendado (ISO VG)', 'Linhas: pressão específica p̄ (N/mm²). Colunas: v (m/s).',
      U.tbl({ colunas: ['p̄ \\ v', '≤ 3', '≤ 10', '≤ 25', '≤ 50', '> 50'], linhas: Object.keys(DD.VG_TABELA).map((k, i) => [['≤ 1,25', '≤ 2,5', '> 2,5'][i]].concat(DD.VG_TABELA[k].map(String))),
        sel: i => R && R.mancal && R.mancal.vg_indices && R.mancal.vg_indices[0] === i + 1, compacta: true }));
    const oleos = card('Propriedades dos óleos', 'ν40 = grau ISO VG; ν100 e ρ15 típicos de óleos minerais.',
      U.tbl({ colunas: ['ISO VG', 'ν40 (mm²/s)', 'ν100 (mm²/s)', 'ρ15 (kg/m³)'], linhas: DD.OLEOS.map(([v, o]) => [`VG ${v}`, FA(v), F(o.nu100, 1), FA(o.rho15)]),
        sel: i => R && R.mancal && DD.OLEOS[i][0] === R.mancal.vg, compacta: true }));
    p.append(grade('g2', hlim, psi), grade('g2', vg, oleos));
    // erratas
    const errata = (lista) => h('div', { class: 'errata' }, lista.map(([id, onde, txt]) => h('div', null, h('span', { class: 'eid' }, id), h('div', null, h('h4', null, onde), h('p', null, txt)))));
    p.append(grade('g2',
      card('Erratas do procedimento', 'Inconsistências encontradas ao validar as 39.900 células das tabelas; o cálculo usa o critério correto e aponta as diferenças.', errata(DD.ERRATA_DOCUMENTO)),
      card('Correções da planilha de mancais', 'Diferenças entre a planilha original e a formulação da DIN 31652 / ISO 7902 adotada aqui.', errata(DD.ERRATA_PLANILHA_MANCAL))));
  };
})(window);
