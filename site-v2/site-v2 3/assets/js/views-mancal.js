/*!
 * VG · Tela do laboratório: mancal de deslizamento hidrodinâmico
 */
(function (raiz) {
  'use strict';
  const E = raiz.VGEngine, C = raiz.VGCharts, D = raiz.VGDiag, U = raiz.VGUI;
  const { h, svgIco, F, FA, FI, sec, grade } = U;
  const V = raiz.VGViews = raiz.VGViews || {};
  const rad = g => g * Math.PI / 180;

  V.mancal = function (p, ctx) {
    const R = ctx.R, m = R.mancal, e = R.entrada;
    if (!m) {
      if (R.mancal_erro) {
        p.append(h('div', { class: 'erro-geral', style: 'margin-top:0' }, svgIco('i-x-circle'), h('div', null, h('h3', null, 'Dados do mancal inválidos'),
          h('ul', null, R.mancal_erro.split(' · ').map(t => h('li', null, t))),
          h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn btn-s', type: 'button', onclick: () => ctx.focar('mancal_carga') }, 'Ir para os dados do mancal')))));
      } else {
        p.append(h('div', { class: 'vazio' }, h('h3', null, 'Mancal desativado'),
          h('p', null, 'Ative o cálculo para verificar o mancal de deslizamento a partir da rotação e do diâmetro adotado da ponta de eixo: filme de óleo, pressão, óleo, folgas, perda por atrito e campo de pressão pela equação de Reynolds.'),
          h('button', { class: 'btn btn-primary btn-s', type: 'button', onclick: () => ctx.definir('mancal_ativo', true) }, 'Ativar o mancal')));
      }
      return;
    }
    const c = m.principal, k = m.critico, campo = ctx.campo;
    const hl = m.h_lim * 1000, hk = k.hmin * 1e6;
    const okH = hk >= hl - 1e-9 && !k.limitado;
    const pMaxMPa = campo ? campo.pMax * c.eta * m.omega / c.psi ** 2 / 1e6 : null;
    const stP = m.p > m.p_falha + 1e-12 ? 'falha' : m.p > m.p_lim + 1e-12 ? 'atencao' : 'ok';

    // ── indicadores
    p.append(sec(null, null, h('div', { class: 'kpis k6' },
      U.kpi({ l: 'Colo D × B', ref: 'M2', v: `${FA(m.d)} × ${F(m.l, 1)}`, u: 'mm', s: `B/D ${F(m.bd, 3)} · D ${m.d_origem.startsWith('auto') ? 'automático' : 'informado'}` }),
      U.kpi({ l: 'Carga radial', ref: 'M3', v: F(m.carga / 1000, 1), u: 'kN', s: `${FI(m.carga)} N${m.carga_origem === 'informada' ? '' : ' · peso do rotor'}` }),
      U.kpi({ l: 'Velocidade periférica', ref: 'M4', v: F(m.v, 2), u: 'm/s', s: `${F(m.n, 0)} rpm · ω ${F(m.omega, 1)} rad/s` }),
      U.kpi({ l: 'Pressão específica', ref: 'M6', v: F(m.p, 2), u: 'N/mm²', estado: stP, s: `admissível ${FA(m.p_lim)} · máximo ${FA(m.p_falha)}` }),
      U.kpi({ l: 'Óleo', ref: 'M13', v: `VG ${m.vg}`, s: `${m.vg_origem === 'informado' ? 'informado' : 'tabela p̄ × v'} · η ${F(m.eta * 1000, 1)} mPa·s` }),
      U.kpi({ l: 'Temperatura do filme', ref: 'M14', v: F(m.t_eff, 1), u: '°C', estado: m.balanco ? (m.t_eff > m.t_lim ? 'falha' : 'ok') : null, s: m.balanco ? `balanço térmico · máx ${FA(m.t_lim)} °C` : 'informada' }),
      U.kpi({ l: 'Sommerfeld', ref: 'M18', v: F(c.so, 3), s: c.so > 1 ? 'carga elevada (So > 1)' : 'alta velocidade (So < 1)' }),
      U.kpi({ l: 'Excentricidade', ref: 'M19', v: F(c.eps, 3), estado: c.eps > 0.95 ? 'atencao' : null, s: `β ${F(c.beta, 1)}° · folga média` }),
      U.kpi({ l: 'Filme mínimo', ref: 'M22', v: F(hk, 1), u: 'µm', destaque: true, estado: okH ? 'ok' : 'falha', s: `${k.rotulo} · h lim ${FA(hl)} µm` }),
      U.kpi({ l: 'Perda por atrito', ref: 'M21', v: F(c.pf / 1000, 2), u: 'kW', s: `f = ${F(c.f * 1000, 3)} × 10⁻³` }),
      pMaxMPa ? U.kpi({ l: 'Pressão máxima', ref: 'M23', v: F(pMaxMPa, 2), u: 'MPa', s: `${F(pMaxMPa / m.p, 1)}× p̄ · a ${F(campo.thetaPMax, 0)}°` }) : null,
      U.kpi({ l: 'Vazão de referência', ref: 'M24', v: F(m.q_ref * 60000, 1), u: 'L/min', s: `ΔT ${F(m.dt_1min, 1)} K em 1 min (M25)` })
    )));

    // ── corte do mancal + p(θ) e h(θ)
    const cCorte = U.ccard({ overline: 'Corte radial', titulo: 'Posição do eixo e campo de pressão',
      resumo: `O eixo opera excêntrico (ε ${F(c.eps, 3)}) com a linha de centros a <b>β ${F(c.beta, 1)}°</b> da carga. A pressão se concentra antes do filme mínimo, no sentido de rotação.`,
      legenda: [{ tipo: 'band', cor: 'var(--c-em-wash)', txt: 'Bucha' }, { tipo: 'band', cor: 'var(--c-s1-wash)', txt: 'Filme de óleo' }, { tipo: 'line', cor: 'var(--c-em)', txt: 'Pressão (plano central)' }],
      nota: 'Folga e excentricidade ampliadas para visualização. Rotação anti-horária, carga vertical. Pressão pela equação de Reynolds (malha 144 × 20, condição de cavitação de Reynolds).' });
    const kP = c.eta * m.omega / c.psi ** 2 / 1e6;
    const cr = c.psi * m.d / 2 * 1000;
    const dadosP = campo ? Array.from({ length: campo.n + 1 }, (_, i) => ({ x: i * 360 / campo.n, y: campo.perfil[i % campo.n] * kP })) : [];
    const dadosH = Array.from({ length: 145 }, (_, i) => ({ x: i * 2.5, y: cr * (1 + c.eps * Math.cos(rad(i * 2.5))) }));
    const corpoH = h('div', { class: 'ccard-body', style: 'padding-top:0' });
    const cTheta = U.ccard({ overline: 'Ao longo da circunferência', titulo: 'Pressão e espessura do filme',
      resumo: campo ? `Pico de <b>${F(pMaxMPa, 2)} MPa</b> a ${F(campo.thetaPMax, 0)}° — <b>${F(pMaxMPa / m.p, 1)}×</b> a pressão média p̄. O filme é mínimo a 180° (${F(c.hmin * 1e6, 1)} µm na folga média) e a pressão termina em ≈ ${F(campo.thetaFim % 360, 0)}°, onde o óleo cavita.` : '',
      legenda: [{ tipo: 'line', cor: 'var(--c-em)', txt: 'Pressão p(θ)' }, { tipo: 'line', cor: 'var(--c-s1)', txt: 'Espessura h(θ)' }, { tipo: 'dash', cor: 'var(--c-ref)', txt: 'p̄ e h lim' }],
      nota: 'θ medido a partir da folga máxima, no sentido de rotação. Folga média; plano central do mancal.',
      tabela: () => ({ colunas: ['θ (°)', 'p (MPa)', 'h (µm)'], linhas: Array.from({ length: 25 }, (_, i) => { const th = i * 15; const ip = Math.round(th / 360 * (campo ? campo.n : 1)); return [FI(th), campo ? F(campo.perfil[ip % campo.n] * kP, 3) : '—', F(cr * (1 + c.eps * Math.cos(rad(th))), 1)]; }) }) });
    cTheta.corpo.after(corpoH);
    p.append(sec(null, null, grade('g-5-7', cCorte, cTheta)));
    D.secaoMancal(cCorte.corpo, R, campo);
    const xTheta = { dominio: [0, 360], marcas: [0, 60, 120, 180, 240, 300, 360], fmt: v => FI(v) + '°' };
    if (campo) C.xy(cTheta.corpo, {
      x: xTheta, y: { rotulo: 'Pressão (MPa)' },
      series: [{ id: 'p', nome: 'pressão', tipo: 'area', dados: dadosP, cor: 'em', fmtY: v => F(v, 2) + ' MPa' }],
      refs: [{ y: m.p, rotulo: `p̄ ${F(m.p, 2)} MPa`, lado: 'fim' }, { x: 180, rotulo: 'filme mínimo' }],
      pontos: [{ x: campo.thetaPMax, y: pMaxMPa, cor: 'em', r: 5, rotulo: `p máx ${F(pMaxMPa, 2)} MPa`, ancora: 'end', dx: -10, dy: 4 }],
      crosshair: { series: ['p'], fmtX: v => `θ = ${FI(v)}°`, extra: xv => [{ cor: C.tema().s1, valor: F(cr * (1 + c.eps * Math.cos(rad(xv))), 1) + ' µm', rotulo: 'espessura' }] },
      rotulo: 'Pressão no filme ao longo da circunferência'
    }, { altura: 200 });
    C.xy(corpoH, {
      x: Object.assign({ rotulo: 'Ângulo θ a partir da folga máxima (°)' }, xTheta), y: { rotulo: 'Filme (µm)', zero: true, extra: [hl] },
      series: [{ id: 'h', nome: 'espessura', tipo: 'linha', dados: dadosH, cor: 's1', fmtY: v => F(v, 1) + ' µm' }],
      refs: [{ y: hl, rotulo: `h lim ${FA(hl)} µm`, lado: 'inicio' }],
      pontos: [{ x: 180, y: c.hmin * 1e6, cor: 's1', r: 5, rotulo: `${F(c.hmin * 1e6, 1)} µm`, ancora: 'middle', dx: 0, dy: -12 }],
      crosshair: { series: ['h'], fmtX: v => `θ = ${FI(v)}°` }, rotulo: 'Espessura do filme ao longo da circunferência'
    }, { altura: 190 });

    // ── envelope de operação + lugar geométrico
    const casos = Object.values(m.casos);
    const Dm = m.d / 1000, Lm = m.l / 1000;
    const fMax = nk => {
      const om = 2 * Math.PI * nk / 60, vk = Math.PI * Dm * nk / 60;
      const hlk = E.h_lim_tabela(m.d, vk)[0];
      let melhor = Infinity;
      for (const cs of casos) {
        const epsLim = 1 - 2 * hlk / (m.d * cs.psi);
        if (epsLim <= 0) return 0;
        const so = E.sommerfeld_de_eps(Math.min(epsLim, 0.99), m.bd);
        melhor = Math.min(melhor, so * m.eta * om * Dm * Lm / cs.psi ** 2);
      }
      return melhor;
    };
    const nMax = Math.max(m.n * 2, 600);
    const ns = Array.from({ length: 160 }, (_, i) => nMax * (i + 1) / 160);
    const curva = ns.map(x => ({ x, y: fMax(x) / 1000 }));
    const Fplim = m.p_lim * m.d * m.l / 1000, Fpf = m.p_falha * m.d * m.l / 1000, F0 = m.carga / 1000;
    const yTop = Math.max(2.2 * F0, 1.15 * Fplim);
    let nMin = null;
    for (let i = 0; i < curva.length; i++) if (curva[i].y >= F0) { nMin = i ? curva[i - 1].x + (curva[i].x - curva[i - 1].x) * (F0 - curva[i - 1].y) / (curva[i].y - curva[i - 1].y || 1) : curva[i].x; break; }
    const capNom = fMax(m.n) / 1000;
    const cEnv = U.ccard({ overline: 'Envelope de operação', titulo: 'Carga admissível pelo filme × rotação',
      resumo: `Abaixo da curva o filme atende ao h lim da tabela. Na rotação nominal o filme suporta até <b>${F(capNom, 1)} kN</b> (${F(capNom / F0, 1)}× a carga)` + (nMin ? `; com ${F(F0, 1)} kN o mancal atende a partir de ≈ <b>${FI(nMin)} rpm</b>.` : '.'),
      legenda: [{ tipo: 'line', cor: 'var(--c-s1)', txt: 'Carga máxima pelo filme' }, { tipo: 'band', cor: 'var(--c-fail-wash)', txt: 'Não atende (filme ou p̄ máx)' }, { tipo: 'band', cor: 'var(--c-warn-wash)', txt: 'p̄ acima do admissível' }, { tipo: 'dot', cor: 'var(--c-em)', txt: 'Operação' }],
      nota: `Mesma geometria, folgas (pior caso entre mínima, média e máxima), óleo VG ${m.vg} e temperatura de ${F(m.t_eff, 0)} °C. O h lim depende da velocidade periférica, por isso a curva tem degraus.`,
      tabela: () => ({ colunas: ['Rotação (rpm)', 'Carga máx. pelo filme (kN)', 'h lim (µm)'], linhas: ns.filter((_, i) => i % 16 === 15).map(x => [FI(x), F(fMax(x) / 1000, 1), FI(E.h_lim_tabela(m.d, Math.PI * Dm * x / 60)[0] * 1000)]) }) });
    const cLoc = U.ccard({ overline: 'Lugar geométrico', titulo: 'Posição do centro do eixo (ε, β)',
      resumo: `Com carga crescente (So ↑) o centro desce de β ≈ 90° (eixo quase centrado) até β → 0° (encostado no fundo). Folga média: <b>ε ${F(c.eps, 3)} · β ${F(c.beta, 1)}°</b>.`,
      legenda: [{ tipo: 'line', cor: 'var(--c-s1)', txt: `B/D ${F(m.bd, 3)} (caso)` }, { tipo: 'line', cor: 'var(--c-deemph)', txt: 'Outras relações B/D' }, { tipo: 'dot', cor: 'var(--c-em)', txt: 'Folga média' }, { tipo: 'dot', cor: 'var(--c-s1)', txt: 'Folgas mín./máx.' }],
      nota: 'Centro do mancal no topo; raio = excentricidade relativa. Tabela de Reynolds (ε × B/D) gerada para este app e conferida com Raimondi–Boyd.' });
    p.append(grade('g2', cEnv, cLoc));
    C.xy(cEnv.corpo, {
      x: { dominio: [0, nMax], rotulo: 'Rotação (rpm)', fmt: v => FI(v) }, y: { dominio: [0, yTop], rotulo: 'Carga radial (kN)' },
      series: [{ id: 'cap', nome: 'carga máx. pelo filme', tipo: 'linha', dados: curva, cor: 's1', fmtY: v => F(v, 1) + ' kN' }],
      faixas: [{ y0: Fplim, y1: Math.min(Fpf, yTop * 3), cor: 'warnw' }, { y0: Fpf, y1: yTop * 3, cor: 'failw' },
        { pontos: [{ x: 0, y: 0 }].concat(curva, [{ x: nMax, y: yTop * 3 }, { x: 0, y: yTop * 3 }]), cor: 'failw', rotulo: 'h mín < h lim', rotuloEm: { x: Math.min(nMax * 0.5, (nMin || nMax * 0.1) * 0.5), y: yTop * 0.94 }, }],
      refs: [{ y: Fplim, rotulo: `p̄ adm ${FA(m.p_lim)} N/mm²`, lado: 'fim' }].concat(Fpf <= yTop * 1.2 && Fpf > Fplim * 1.001 ? [{ y: Fpf, rotulo: `p̄ máx ${FA(m.p_falha)} N/mm²`, lado: 'fim' }] : []),
      pontos: [{ x: m.n, y: F0, cor: 'em', r: 6, rotulo: `${F(F0, 1)} kN · ${FI(m.n)} rpm`, dica: [{ titulo: 'Ponto de operação' }, { valor: `${F(F0, 1)} kN`, rotulo: 'carga' }, { valor: `${FI(m.n)} rpm`, rotulo: 'rotação' }, { valor: `${F(capNom, 1)} kN`, rotulo: 'capacidade pelo filme' }] }],
      crosshair: { series: ['cap'], fmtX: v => `${FI(v)} rpm` }, rotulo: 'Envelope de operação do mancal'
    }, { altura: w => Math.round(Math.max(260, Math.min(340, w * 0.66))) });
    D.lugarGeometrico(cLoc.corpo, R);

    // ── h mín × rotação + efeito da temperatura
    const nsH = Array.from({ length: 110 }, (_, i) => nMax * (i + 1) / 110);
    const hminEm = (nk, eta) => Math.min(...casos.map(cs => E.calculo_hidrodinamico('', m.carga, m.d, m.l, nk, cs.psi, eta).hmin * 1e6));
    const dadosHn = nsH.map(x => ({ x, y: hminEm(x, m.eta) }));
    const dadosHl = nsH.map(x => ({ x, y: E.h_lim_tabela(m.d, Math.PI * Dm * x / 60)[0] * 1000 }));
    const cRot = U.ccard({ overline: 'Sensibilidade · rotação', titulo: 'Filme mínimo × rotação',
      resumo: `O filme cresce com a rotação (mais óleo arrastado para a cunha). Na rotação nominal: <b>${F(hk, 1)} µm</b>, ${F(hk / hl, 1)}× o limite de ${FA(hl)} µm.`,
      legenda: [{ tipo: 'line', cor: 'var(--c-s1)', txt: 'h mín (pior folga)' }, { tipo: 'dash', cor: 'var(--c-ref)', txt: 'h lim da tabela' }, { tipo: 'dot', cor: 'var(--c-em)', txt: 'Operação' }],
      nota: `Carga, geometria, óleo e temperatura (${F(m.t_eff, 0)} °C) do caso.`,
      tabela: () => ({ colunas: ['Rotação (rpm)', 'h mín (µm)', 'h lim (µm)'], linhas: nsH.filter((_, i) => i % 11 === 10).map(x => [FI(x), F(hminEm(x, m.eta), 1), FI(E.h_lim_tabela(m.d, Math.PI * Dm * x / 60)[0] * 1000)]) }) });
    const tMax = Math.max(100, Math.ceil((m.t_lim + 10) / 10) * 10);
    const Ts = Array.from({ length: Math.round((tMax - 30) / 2) + 1 }, (_, i) => 30 + i * 2);
    const oleos = [...new Set([32, 46, 68, m.vg])].sort((a, b) => a - b);
    const sH = [], sP = [];
    for (const vg of oleos) {
      const sel = vg === m.vg;
      const dh = [], dp = [];
      for (const T of Ts) {
        const eta = E.viscosidade_oleo(vg, T)[0];
        dh.push({ x: T, y: Math.min(...casos.map(cs => E.calculo_hidrodinamico('', m.carga, m.d, m.l, m.n, cs.psi, eta).hmin * 1e6)) });
        dp.push({ x: T, y: E.calculo_hidrodinamico('', m.carga, m.d, m.l, m.n, c.psi, eta).pf / 1000 });
      }
      const base = { nome: `VG ${vg}`, tipo: 'linha', cor: sel ? 'em' : 'deemph', largura: sel ? 2.5 : 1.5, rotuloFim: `VG ${vg}` };
      sH.push(Object.assign({ id: 'h' + vg, dados: dh, fmtY: v => F(v, 1) + ' µm' }, base));
      sP.push(Object.assign({ id: 'p' + vg, dados: dp, fmtY: v => F(v, 2) + ' kW' }, base));
    }
    sH.sort((a, b) => (a.cor === 'em') - (b.cor === 'em')); sP.sort((a, b) => (a.cor === 'em') - (b.cor === 'em'));
    const t2 = Math.min(tMax, m.t_eff + 20);
    const eta2 = E.viscosidade_oleo(m.vg, t2)[0];
    const h2 = Math.min(...casos.map(cs => E.calculo_hidrodinamico('', m.carga, m.d, m.l, m.n, cs.psi, eta2).hmin * 1e6));
    const pf2 = E.calculo_hidrodinamico('', m.carga, m.d, m.l, m.n, c.psi, eta2).pf / 1000;
    const corpoPf = h('div', { class: 'ccard-body', style: 'padding-top:0' });
    const cTemp = U.ccard({ overline: 'Sensibilidade · temperatura e óleo', titulo: 'Filme mínimo e perda × temperatura',
      resumo: `Aquecendo de ${F(m.t_eff, 0)} °C para ${F(t2, 0)} °C, o VG ${m.vg} perde viscosidade: o filme cai para <b>${F(h2, 1)} µm</b> e a perda para <b>${F(pf2, 2)} kW</b>.`,
      legenda: [{ tipo: 'line', cor: 'var(--c-em)', txt: `VG ${m.vg} (caso)` }, { tipo: 'line', cor: 'var(--c-deemph)', txt: 'Outros óleos' }, { tipo: 'dash', cor: 'var(--c-ref)', txt: 'T do caso e h lim' }],
      nota: 'Viscosidade pela reta de Walther (ASTM D341). Filme: pior folga; perda: folga média. Rotação e carga do caso.',
      tabela: () => ({ colunas: ['T (°C)'].concat(oleos.flatMap(v => [`h mín VG ${v} (µm)`, `Pf VG ${v} (kW)`])), linhas: Ts.filter(T => T % 10 === 0).map(T => [FI(T)].concat(oleos.flatMap(v => { const eta = E.viscosidade_oleo(v, T)[0]; return [F(Math.min(...casos.map(cs => E.calculo_hidrodinamico('', m.carga, m.d, m.l, m.n, cs.psi, eta).hmin * 1e6)), 1), F(E.calculo_hidrodinamico('', m.carga, m.d, m.l, m.n, c.psi, eta).pf / 1000, 2)]; }))) }) });
    cTemp.corpo.after(corpoPf);
    p.append(grade('g2', cRot, cTemp));
    C.xy(cRot.corpo, {
      x: { dominio: [0, nMax], rotulo: 'Rotação (rpm)', fmt: v => FI(v) }, y: { rotulo: 'Filme mínimo (µm)', zero: true },
      series: [{ id: 'hn', nome: 'h mín', tipo: 'linha', dados: dadosHn, cor: 's1', fmtY: v => F(v, 1) + ' µm' }, { id: 'hl', nome: 'h lim', tipo: 'degrau', dados: dadosHl, cor: 'ref', tracejado: true, fmtY: v => FI(v) + ' µm' }],
      pontos: [{ x: m.n, y: hk, cor: 'em', r: 6, rotulo: `${F(hk, 1)} µm`, dica: [{ titulo: 'Rotação nominal' }, { valor: `${F(hk, 1)} µm`, rotulo: 'h mín' }, { valor: `${FA(hl)} µm`, rotulo: 'h lim' }] }],
      crosshair: { series: ['hn'], fmtX: v => `${FI(v)} rpm` }, rotulo: 'Filme mínimo em função da rotação'
    }, { altura: w => Math.round(Math.max(250, Math.min(330, w * 0.62))) });
    C.xy(cTemp.corpo, {
      x: { dominio: [30, tMax], fmt: v => FI(v) + ' °C' }, y: { rotulo: 'h mín (µm)', zero: true, extra: [hl] },
      series: sH, margemDir: 50, refs: [{ x: m.t_eff, rotulo: 'caso' }, { y: hl, rotulo: `h lim ${FA(hl)}`, lado: 'inicio' }],
      crosshair: { series: [sH[sH.length - 1].id], fmtX: v => `${FI(v)} °C` }, rotulo: 'Filme mínimo em função da temperatura por óleo'
    }, { altura: 180 });
    C.xy(corpoPf, {
      x: { dominio: [30, tMax], rotulo: 'Temperatura efetiva do filme (°C)', fmt: v => FI(v) + ' °C' }, y: { rotulo: 'Perda (kW)', zero: true },
      series: sP, margemDir: 50, refs: [{ x: m.t_eff }],
      crosshair: { series: [sP[sP.length - 1].id], fmtX: v => `${FI(v)} °C` }, rotulo: 'Perda por atrito em função da temperatura por óleo'
    }, { altura: 180 });

    // ── folgas e ajuste + óleos
    const ordem = ['folga mínima', 'folga média', 'folga máxima'];
    const itensF = ordem.map(nm => { const cs = m.casos[nm]; const hh = cs.hmin * 1e6; return { rotulo: nm.charAt(0).toUpperCase() + nm.slice(1), sub: `ψ ${F(cs.psi * 1000, 3)} ‰ · ε ${F(cs.eps, 3)}`, valor: hh, textoValor: `${F(hh, 1)} µm`, estado: cs === k ? 'sel' : 'ok',
      dica: [{ titulo: nm }, { valor: `${F(hh, 1)} µm`, rotulo: 'h mín' }, { valor: F(cs.so, 3), rotulo: 'So' }, { valor: `${F(cs.pf / 1000, 2)} kW`, rotulo: 'perda' }] }; });
    const cFolga = U.ccard({ overline: 'Folgas e ajuste', titulo: 'Filme mínimo nas três folgas',
      resumo: `O pior filme ocorre na <b>${k.rotulo}</b> (${F(hk, 1)} µm). Furo <b>${F(m.furo_min, 3)}–${F(m.furo_max, 3)} mm</b> (H7) e colo <b>${F(m.eixo_min, 3)}–${F(m.eixo_max, 3)} mm</b>${m.ajuste_viavel ? '' : ' — ajuste H7 inviável'}.`,
      legenda: [{ tipo: 'sq', cor: 'var(--c-em)', txt: 'Caso que governa' }, { tipo: 'sq', cor: 'var(--c-s1)', txt: 'Demais folgas' }, { tipo: 'dash', cor: 'var(--c-ref)', txt: 'h lim' }],
      nota: `Folga relativa recomendada ψm ${FA(m.psi_m)} ‰ (${m.psi_origem}); folgas diametrais da tabela: ${F(m.folga_min * 1000, 0)}–${F(m.folga_max * 1000, 0)} µm; IT7 = ${F(m.it7 * 1000, 0)} µm.` });
    const cAjuste = U.ccard({ overline: 'ISO 286', titulo: 'Zonas de tolerância do ajuste',
      resumo: `Furo H7 (IT7 = ${F(m.it7 * 1000, 0)} µm) e colo do eixo dimensionado para as folgas diametrais da tabela: <b>${F(m.folga_min * 1000, 0)} a ${F(m.folga_max * 1000, 0)} µm</b>${m.ajuste_viavel ? ` — colo ${F(m.eixo_med, 4)} ± ${F(m.eixo_tol, 4)} mm.` : '. A faixa de folga é menor que IT7: ajuste inviável com furo H7.'}`,
      legenda: [{ tipo: 'band', cor: 'var(--c-em-wash)', txt: 'Furo H7' }, { tipo: 'band', cor: 'var(--c-s1-wash)', txt: 'Colo do eixo' }],
      nota: `Desvios em relação ao diâmetro nominal D = ${FA(m.d)} mm (linha zero).` });
    const maxH = Math.max(...m.por_oleo.map(o => o.caso.hmin * 1e6), hl);
    const linhasOleo = m.por_oleo.map(o => [h('span', null, `VG ${o.vg}`, o.selecionado ? h('span', { class: 'tag-mini' }, 'caso') : null), F(o.t, 1), F(o.caso.so, 3), F(o.caso.eps, 3),
      U.ibar(o.caso.hmin * 1e6, maxH, F(o.caso.hmin * 1e6, 1), o.selecionado ? 'em' : ''), F(o.caso.pf / 1000, 2), F(o.dt, 2), U.stCel(o.atende ? 'ok' : 'falha')]);
    const cOleo = h('article', { class: 'ccard' }, h('header', { class: 'ccard-head' }, h('div', null, h('span', { class: 'overline' }, 'Lubrificante'), h('h3', null, 'Comparação de óleos'))),
      h('p', { class: 'takeaway', html: `Óleo mais viscoso → filme maior e mais perda (e mais aquecimento). Recomendado pela tabela p̄ × v: <b>VG ${E.vg_tabela(m.p, m.v)[0]}</b>.` }),
      h('div', { class: 'ccard-body pad' }, U.tbl({ colunas: [{ t: 'Óleo', cls: 'l' }, 'T (°C)', 'So', 'ε', { t: 'h mín (µm)', cls: 'bar-cell' }, 'Pf (kW)', 'ΔT 1 min (K)', { t: 'Situação', cls: 'l' }], linhas: linhasOleo, sel: i => m.por_oleo[i].selecionado, compacta: true })),
      h('p', { class: 'ccard-foot' }, `Folga média; ${m.balanco ? 'temperatura pelo balanço térmico de cada óleo' : `temperatura de ${F(m.t_eff, 0)} °C`}; ΔT sem dissipação com ${FA(m.volume_oleo)} L de óleo.`));
    p.append(grade('g2', cFolga, cAjuste));
    C.barrasH(cFolga.corpo, { itens: itensF, fmt: v => F(v, 0), refs: [{ x: hl, rotulo: `h lim ${FA(hl)} µm` }], alturaLinha: 48, rotulo: 'Filme mínimo por folga' });
    D.ajusteISO(cAjuste.corpo, R);
    p.append(sec(null, null, cOleo));

    // ── rotações das tabelas
    const linhasRot = m.por_rotacao.map(r => r.erro ? [`${r.f} Hz`, String(r.polos), FI(r.n), F(r.v, 1), '—', FI(r.h_lim * 1000), '—', '—', String(r.vg_rec), U.stCel('aviso', r.erro)]
      : [`${r.f} Hz`, String(r.polos), FI(r.n), F(r.v, 1), FA(r.psi_m), FI(r.h_lim * 1000), F(r.caso.hmin * 1e6, 1), F(r.caso.pf / 1000, 2), String(r.vg_rec), U.stCel(r.atende ? 'ok' : 'falha')]);
    p.append(sec('Desempenho nas rotações das tabelas', `Mesmo mancal (D × B, carga, VG ${m.vg}) nas colunas de 50/60 Hz e 2 a 12 polos, com ψm e h lim de cada velocidade periférica (folga média).`,
      U.tbl({ colunas: [{ t: 'Rede', cls: 'l' }, 'Polos', 'n (rpm)', 'v (m/s)', 'ψm (‰)', 'h lim (µm)', 'h mín (µm)', 'Pf (kW)', 'VG rec.', { t: 'Situação', cls: 'l' }], linhas: linhasRot,
        sel: i => Math.abs(m.por_rotacao[i].n - m.n) < 0.5, compacta: true })));
  };
})(window);
