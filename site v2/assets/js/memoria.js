/*!
 * VG · Memória de cálculo estruturada
 * Cada grandeza é uma entrada identificada (E1…, M1…) com: título, fonte, forma simbólica,
 * substituição numérica, resultado com unidade, variáveis descritas e verificação.
 * Depende de VGEngine e VGMath.
 */
(function (raiz, fabrica) {
  const api = fabrica(raiz);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz) raiz.VGMemoria = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (raiz) {
  'use strict';
  const E = (raiz && raiz.VGEngine) || require('./engine.js');
  const M = (raiz && raiz.VGMath) || require('./math.js');
  const { i, n, o, r, f, rt, p, sup, tx, u, fn } = M;
  const eq = o('='), vez = o('·'), x = o('×'), menos = o('−'), mais = o('+');
  const PROC = 'Procedimento — seção ';
  const PLAN = 'Planilha de mancais';

  function item(id, titulo, fonte, linhas, vars = [], extra = {}) {
    return Object.assign({ id, titulo, fonte, linhas: linhas.filter(Boolean), vars, nota: '', estado: null, tipo: 'equacao' }, extra);
  }
  const v = (s, d, valor, un = '') => ({ s, d, v: valor, u: un });

  // ════════════════════════════════════════════════════════════════════════
  // Eixo
  // ════════════════════════════════════════════════════════════════════════
  function eixo(R) {
    const e = R.entrada, out = [];
    const P = i('P'), nn = i('n'), Mt = i('M', 't'), FS = i('FS'), SF = i('SF'), tau = i('τ'), d = i('d'), dmin = i('d', 'mín');

    // E1 — potência de cálculo
    {
      const S = i('S'), cos = r(i('cos'), i('φ')), eta = i('η');
      let linhas, vars = [], nota = '';
      const pk = R.p_kw;
      const s_kva = e.unidade_potencia === 'MVA' ? e.potencia * 1000 : e.potencia;
      switch (R.p_regra) {
        case 'kW': linhas = [r(P, eq, n(pk, 'auto'), u('kW'))]; nota = 'Potência informada no eixo.'; break;
        case 'MW': linhas = [r(P, eq, i('P', 'MW'), vez, n(1000)), r(eq, n(e.potencia, 'auto'), vez, n(1000)), r(eq, n(pk, 1), u('kW'))]; break;
        case 'cv': linhas = [r(P, eq, i('P', 'cv'), vez, n('0,73549875')), r(eq, n(e.potencia, 'auto'), x, n('0,73549875')), r(eq, n(pk, 2), u('kW'))]; break;
        case 'HP': linhas = [r(P, eq, i('P', 'HP'), vez, n('0,745699872')), r(eq, n(e.potencia, 'auto'), x, n('0,745699872')), r(eq, n(pk, 2), u('kW'))]; break;
        case 'kva_convencao':
          linhas = [r(P, eq, S), r(eq, n(s_kva, 'auto'), u('kVA → kW'))];
          nota = 'Convenção das tabelas da seção 9: a potência aparente em kVA é usada numericamente como kW (lado conservador). Ative a conversão para usar S·cos φ e η.';
          break;
        case 'kva_gerador':
          linhas = [r(P, eq, f(r(S, vez, cos), eta)), r(eq, f(r(n(s_kva, 'auto'), x, n(e.cos_phi, 3)), n(e.rendimento, 3))), r(eq, n(pk, 1), u('kW'))];
          vars = [v(S, 'potência aparente', E.fmt_auto(s_kva), 'kVA'), v(cos, 'fator de potência', E.fmt(e.cos_phi, 3)), v(eta, 'rendimento', E.fmt(e.rendimento, 3))];
          nota = 'Gerador: potência de acionamento no eixo.';
          break;
        case 'kva_motor':
          linhas = [r(P, eq, S, vez, cos, vez, eta), r(eq, n(s_kva, 'auto'), x, n(e.cos_phi, 3), x, n(e.rendimento, 3)), r(eq, n(pk, 1), u('kW'))];
          vars = [v(S, 'potência aparente', E.fmt_auto(s_kva), 'kVA'), v(cos, 'fator de potência', E.fmt(e.cos_phi, 3)), v(eta, 'rendimento', E.fmt(e.rendimento, 3))];
          nota = 'Motor: potência mecânica no eixo.';
          break;
        default:
          linhas = [r(P, eq, S, vez, cos), r(eq, n(s_kva, 'auto'), x, n(e.cos_phi, 3)), r(eq, n(pk, 1), u('kW'))];
      }
      if (e.unidade_potencia === 'MVA') vars.unshift(v(S, 'potência aparente', `${E.fmt_auto(e.potencia)} MVA = ${E.fmt_auto(s_kva)}`, 'kVA'));
      out.push(item('E1', 'Potência de cálculo', 'Procedimento — seções 5 e 9', linhas, vars, { nota, resultado: { s: P, v: pk, u: 'kW', c: 1 } }));
    }
    // E2 — rotação
    {
      const fq = i('f'), pp = i('p'), ns = i('n', 's'), s = i('s');
      let linhas, vars = [];
      if (e.modo_rotacao === 'rpm') linhas = [r(nn, eq, n(R.n_rpm, 'auto'), u('rpm'))];
      else if (e.escorregamento) {
        linhas = [r(ns, eq, f(r(n(120), vez, fq), pp), eq, f(r(n(120), x, n(e.frequencia, 'auto')), n(e.polos)), eq, n(R.n_sincrona, 1), u('rpm')),
          r(nn, eq, ns, vez, p(r(n(1), menos, f(s, n(100))))), r(eq, n(R.n_sincrona, 1), x, p(r(n(1), menos, f(n(e.escorregamento, 'auto'), n(100))))), r(eq, n(R.n_rpm, 1), u('rpm'))];
        vars = [v(fq, 'frequência da rede', E.fmt_auto(e.frequencia), 'Hz'), v(pp, 'número de polos', String(e.polos)), v(s, 'escorregamento', E.fmt_auto(e.escorregamento), '%')];
      } else {
        linhas = [r(nn, eq, f(r(n(120), vez, fq), pp)), r(eq, f(r(n(120), x, n(e.frequencia, 'auto')), n(e.polos))), r(eq, n(R.n_rpm, 1), u('rpm'))];
        vars = [v(fq, 'frequência da rede', E.fmt_auto(e.frequencia), 'Hz'), v(pp, 'número de polos', String(e.polos))];
      }
      out.push(item('E2', 'Rotação', e.modo_rotacao === 'rpm' ? 'Informada' : 'Velocidade síncrona', linhas, vars,
        { nota: e.modo_rotacao === 'polos' && !e.escorregamento ? 'Rotação síncrona (sem escorregamento).' : '', resultado: { s: nn, v: R.n_rpm, u: 'rpm', c: 1 } }));
    }
    // E3 — fator de serviço
    out.push(item('E3', 'Fator de serviço', e.fs_personalizado != null ? 'Informado' : PROC + '6.2.7',
      [r(FS, eq, n(R.fs, 'auto'))], [], { tipo: 'consulta', nota: R.fs_origem.replace(/^FS = [^ ]+ /, '').replace(/^— /, ''), resultado: { s: FS, v: R.fs, u: '', c: 2 } }));
    // E4 — tensão de referência
    {
      const mat = R.material, g = R.criterio_governante, Se = i('S', 'e');
      let linhas, nota;
      if (g === 'SECAO_5') {
        linhas = [r(tau, eq, i('τ', 'máx'), eq, n(R.tau_ref, 'auto'), u('MPa'))];
        nota = mat.personalizado ? 'Material personalizado: τmáx = Se/√3.' : `τmáx da tabela da seção 4 (≈ Se/√3 = ${E.fmt(mat.tau_escoamento, 1)} MPa, arredondado). Critério da seção 5/8.`;
      } else if (g === 'SECAO_9') {
        linhas = [r(tau, eq, f(Se, n(3))), r(eq, f(n(mat.escoamento, 'auto'), n(3))), r(eq, n(R.tau_ref, 2), u('MPa'))];
        nota = 'Critério implícito nas tabelas da seção 9 (Tresca Se/2 dividido por 1,5).';
      } else {
        linhas = [r(tau, eq, n(R.tau_ref, 'auto'), u('MPa'))];
        nota = 'Tensão informada pelo usuário (critério personalizado).';
      }
      out.push(item('E4', 'Tensão de referência', PROC + '4', linhas,
        [v(Se, 'limite de escoamento', E.fmt_auto(mat.escoamento), 'MPa'), v(i('τ', 'máx'), 'cisalhamento máximo (tabela)', E.fmt_auto(mat.tau_max), 'MPa')],
        { nota: `${mat.nome}${mat.observacao ? ' (' + mat.observacao + ')' : ''} · ${nota}`, resultado: { s: tau, v: R.tau_ref, u: 'MPa', c: 2 } }));
    }
    // E5 — torque nominal
    out.push(item('E5', 'Torque nominal', PROC + '5',
      [r(Mt, eq, f(r(n(9550), vez, P), nn)), r(eq, f(r(n(9550), x, n(R.p_kw, 1)), n(R.n_rpm, 1))), r(eq, n(R.mt, 1), u('N·m'))],
      [v(P, 'potência de cálculo', E.fmt(R.p_kw, 1), 'kW'), v(nn, 'rotação', E.fmt(R.n_rpm, 1), 'rpm')],
      { nota: `Torque de serviço Mt·FS = ${E.fmt(R.mt * R.fs, 1)} N·m.`, resultado: { s: Mt, v: R.mt, u: 'N·m', c: 1 } }));
    // E6 — diâmetro mínimo
    {
      const miolo = R.sf * R.mt * R.fs * 1000 * 16 / (Math.PI * R.tau_ref);
      out.push(item('E6', 'Diâmetro mínimo', PROC + '5',
        [r(dmin, eq, rt(f(r(SF, vez, Mt, vez, FS, vez, n(1000), vez, n(16)), r(i('π'), vez, tau)), 3)),
          r(eq, rt(f(r(n(R.sf, 'auto'), x, n(R.mt, 1), x, n(R.fs, 'auto'), x, n(1000), x, n(16)), r(i('π'), x, n(R.tau_ref, 2))), 3)),
          r(eq, rt(n(miolo, 0), 3), eq, n(R.d_min, 2), u('mm'))],
        [v(SF, 'fator de segurança (mín. 9)', E.fmt_auto(R.sf)), v(FS, 'fator de serviço', E.fmt_auto(R.fs)), v(tau, 'tensão de referência', E.fmt(R.tau_ref, 2), 'MPa')],
        { nota: `Critério governante: ${E.CRITERIO_CURTO[R.criterio_governante]}. ` + Object.values(R.por_criterio).filter(c => c.criterio !== R.criterio_governante)
          .map(c => `${E.CRITERIO_CURTO[c.criterio]}: ${E.fmt(c.d_min, 1)} mm → ${E.fmt_int(c.d_norm)} mm`).join(' · '),
          resultado: { s: dmin, v: R.d_min, u: 'mm', c: 2 } }));
    }
    // E7 — seleção do diâmetro
    {
      const linhas = e.diametro_existente
        ? [r(d, eq, n(R.d_adotado, 'auto'), u('mm'))]
        : [r(d, eq, r(tx('menor '), i('d', 'i'), tx(' da série '), tx(e.serie_diametros), tx(' com '), i('d', 'i'), o('≥'), dmin)), r(eq, n(R.d_adotado, 'auto'), u('mm'))];
      let nota = e.diametro_existente ? 'Diâmetro existente informado (verificação).' : `Tolerância ${R.tolerancia}` + (R.comprimento ? ` · comprimento série longa ${R.comprimento[0]} mm` + (R.comprimento[1] ? `, curta ${R.comprimento[1]} mm` : '') : '') + '.';
      if (R.d_inferior && !e.diametro_existente) nota += ` O diâmetro imediatamente inferior (${E.fmt_int(R.d_inferior)} mm) admitiria só ${E.fmt(R.p_inferior, 0)} kW (${E.fmt(100 * R.p_inferior / R.p_kw, 1)}% da potência de cálculo).`;
      if (R.d_norm_especial && !e.diametro_existente) nota += ' Acima da série: diâmetro especial (múltiplo de 10 mm).';
      out.push(item('E7', e.diametro_existente ? 'Diâmetro verificado' : 'Diâmetro normalizado', e.diametro_existente ? 'Informado' : 'DIN 748-1 · ' + PROC + '7', linhas, [],
        { tipo: 'consulta', nota, resultado: { s: d, v: R.d_adotado, u: 'mm', c: 1 },
          estado: e.diametro_existente ? (R.verif_existente.atende ? 'ok' : 'falha') : null }));
    }
    // E8–E10 — verificação de tensões
    const tnom = i('τ', 'nom'), tserv = i('τ', 'serv'), sfr = i('SF', 'real');
    out.push(item('E8', 'Tensão nominal de torção', 'Resistência dos materiais',
      [r(tnom, eq, f(r(n(16), vez, Mt, vez, n(1000)), r(i('π'), vez, sup(d, n(3))))), r(eq, f(r(n(16), x, n(R.mt, 1), x, n(1000)), r(i('π'), x, sup(n(R.d_adotado, 'auto'), n(3))))), r(eq, n(R.tau_nominal, 3), u('MPa'))],
      [], { resultado: { s: tnom, v: R.tau_nominal, u: 'MPa', c: 3 } }));
    out.push(item('E9', 'Tensão de serviço', 'Resistência dos materiais',
      [r(tserv, eq, tnom, vez, FS), r(eq, n(R.tau_nominal, 3), x, n(R.fs, 'auto')), r(eq, n(R.tau_servico, 3), u('MPa'))], [],
      { resultado: { s: tserv, v: R.tau_servico, u: 'MPa', c: 3 } }));
    const okSF = R.sf_real >= R.sf - 1e-9;
    out.push(item('E10', 'Fator de segurança real', PROC + '5',
      [r(sfr, eq, f(tau, tserv)), r(eq, f(n(R.tau_ref, 2), n(R.tau_servico, 3))), r(eq, n(R.sf_real, 2), o(okSF ? '≥' : '<'), n(R.sf, 'auto'))], [],
      { estado: okSF ? 'ok' : 'falha', nota: okSF ? 'Atende ao fator de segurança mínimo.' : 'Abaixo do fator de segurança exigido.', resultado: { s: sfr, v: R.sf_real, u: '', c: 2 } }));
    out.push(item('E11', 'Utilização do diâmetro', 'Inversão da seção 5',
      [r(i('U'), eq, sup(p(f(dmin, d)), n(3)), eq, f(P, i('P', 'máx'))), r(eq, sup(p(f(n(R.d_min, 2), n(R.d_adotado, 'auto'))), n(3))), r(eq, n(100 * R.utilizacao, 1), u('%'))], [],
      { estado: R.utilizacao <= 1 + 1e-9 ? 'ok' : 'falha', resultado: { s: i('U'), v: 100 * R.utilizacao, u: '%', c: 1 } }));
    const mtadm = i('M', 't,adm'), pmax = i('P', 'máx');
    out.push(item('E12', 'Torque admissível', 'Inversão da seção 5',
      [r(mtadm, eq, f(r(i('π'), vez, tau, vez, sup(d, n(3))), r(n(16000), vez, SF, vez, FS))), r(eq, f(r(i('π'), x, n(R.tau_ref, 2), x, sup(n(R.d_adotado, 'auto'), n(3))), r(n(16000), x, n(R.sf, 'auto'), x, n(R.fs, 'auto')))), r(eq, n(R.mt_max, 0), u('N·m'))], [],
      { resultado: { s: mtadm, v: R.mt_max, u: 'N·m', c: 0 } }));
    out.push(item('E13', 'Potência máxima admissível', PROC + '8',
      [r(pmax, eq, f(r(mtadm, vez, nn), n(9550))), r(eq, f(r(n(R.mt_max, 0), x, n(R.n_rpm, 1)), n(9550))), r(eq, n(R.p_max, 0), u('kW'))], [],
      { nota: `${E.fmt(100 * R.p_max / R.p_kw - 100, 1)}% acima da potência de cálculo.`, resultado: { s: pmax, v: R.p_max, u: 'kW', c: 0 } }));
    if (R.verif_pico) {
      const vp = R.verif_pico, tp = i('τ', 'pico'), k = i('k');
      out.push(item('E14', 'Torque de pico (verificação complementar)', 'Fora do escopo do procedimento',
        [r(tp, eq, f(r(n(16), vez, k, vez, Mt, vez, n(1000)), r(i('π'), vez, sup(d, n(3)))), eq, n(vp.tau_pico, 2), u('MPa')),
          r(tx('margem'), eq, f(f(i('S', 'e'), rt(n(3))), tp), eq, f(n(vp.tau_esc, 2), n(vp.tau_pico, 2)), eq, n(vp.margem, 2))],
        [v(k, 'múltiplo do torque nominal', E.fmt_auto(vp.k))],
        { estado: vp.atende ? 'ok' : 'falha', nota: vp.atende ? 'Sem escoamento no pico (Se/√3, von Mises).' : 'Risco de deformação permanente no pico.', resultado: { s: tp, v: vp.tau_pico, u: 'MPa', c: 2 } }));
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Mancal
  // ════════════════════════════════════════════════════════════════════════
  function mancal(R, campo) {
    const m = R.mancal, e = R.entrada;
    if (!m) return [];
    const out = [], c = m.principal;
    const D = i('D'), L = i('L'), F = i('F'), nn = i('n'), vv = i('v'), om = i('ω'), pm = i('p̄'), psi = i('ψ'), eta = i('η'),
      So = i('So'), ep = i('ε'), be = i('β'), ff = i('f'), Pf = i('P', 'f'), hmin = i('h', 'mín'), hlim = i('h', 'lim');
    // M1 — diâmetro do colo
    out.push(item('M1', 'Diâmetro do colo', m.d_origem.startsWith('auto') ? PLAN + ' — lista de diâmetros' : 'Informado',
      [m.d_origem.startsWith('auto') ? r(D, eq, r(tx('menor '), i('D', 'i'), tx(' da lista com '), i('D', 'i'), o('≥'), i('d')), eq, n(m.d, 'auto'), u('mm')) : r(D, eq, n(m.d, 'auto'), u('mm'))],
      m.d_origem.startsWith('auto') ? [v(i('d'), 'diâmetro adotado da ponta de eixo', E.fmt_auto(R.d_adotado), 'mm')] : [],
      { tipo: 'consulta', resultado: { s: D, v: m.d, u: 'mm', c: 1 } }));
    // M2 — largura
    out.push(item('M2', 'Largura da bucha', m.l_origem === 'informada' ? 'Informada' : 'Relação B/D',
      m.l_origem === 'informada'
        ? [r(L, eq, n(m.l, 'auto'), u('mm')), r(f(i('B'), D), eq, f(n(m.l, 'auto'), n(m.d, 'auto')), eq, n(m.bd, 3))]
        : [r(L, eq, p(f(i('B'), D)), vez, D, eq, n(String(+Number(e.mancal_bd || 0.8).toPrecision(8)).replace('.', ',')), x, n(m.d, 'auto'), eq, n(m.l, 'auto'), u('mm'))],
      [], { nota: m.l_origem === 'informada' ? '' : 'Arredondada a 0,1 mm.', resultado: { s: L, v: m.l, u: 'mm', c: 1 } }));
    // M3 — carga
    if (m.carga_origem === 'informada') out.push(item('M3', 'Carga radial', 'Informada', [r(F, eq, n(m.carga, 0), u('N'))], [], { tipo: 'consulta', resultado: { s: F, v: m.carga, u: 'N', c: 0 } }));
    else {
      const fr = e.mancal_fracao ?? 50, fa = e.mancal_fator_carga ?? 1;
      out.push(item('M3', 'Carga radial', 'Peso do rotor',
        [r(F, eq, i('m', 'rotor'), vez, i('g'), vez, i('x'), vez, i('k', 'F')), r(eq, n(e.mancal_massa_rotor, 'auto'), x, n('9,81'), x, n(fr / 100, 'auto'), x, n(fa, 'auto')), r(eq, n(m.carga, 0), u('N'))],
        [v(i('m', 'rotor'), 'massa do rotor', E.fmt_auto(e.mancal_massa_rotor), 'kg'), v(i('x'), 'fração do peso neste mancal', E.fmt_auto(fr), '%'), v(i('k', 'F'), 'fator de carga', E.fmt_auto(fa))],
        { resultado: { s: F, v: m.carga, u: 'N', c: 0 } }));
    }
    // M4–M6
    out.push(item('M4', 'Velocidade periférica', 'Cinemática',
      [r(vv, eq, f(r(i('π'), vez, D, vez, nn), n(60))), r(eq, f(r(i('π'), x, n(m.d / 1000, 'auto'), x, n(m.n, 1)), n(60))), r(eq, n(m.v, 3), u('m/s'))],
      [v(D, 'diâmetro do colo', E.fmt_auto(m.d / 1000), 'm'), v(nn, 'rotação', E.fmt(m.n, 1), 'rpm')], { resultado: { s: vv, v: m.v, u: 'm/s', c: 2 } }));
    out.push(item('M5', 'Velocidade angular', 'Cinemática',
      [r(om, eq, f(r(n(2), vez, i('π'), vez, nn), n(60))), r(eq, f(r(n(2), x, i('π'), x, n(m.n, 1)), n(60))), r(eq, n(m.omega, 3), u('rad/s'))], [],
      { resultado: { s: om, v: m.omega, u: 'rad/s', c: 2 } }));
    const pOk = m.p <= m.p_lim + 1e-12;
    out.push(item('M6', 'Pressão específica', 'DIN 31652',
      [r(pm, eq, f(F, r(D, vez, L))), r(eq, f(n(m.carga, 0), r(n(m.d, 'auto'), x, n(m.l, 'auto')))), r(eq, n(m.p, 3), u('N/mm²'), o(pOk ? '≤' : '>'), n(m.p_lim, 'auto'))], [],
      { estado: m.p > m.p_falha + 1e-12 ? 'falha' : pOk ? 'ok' : 'aviso', nota: `Limite de referência ${E.fmt_auto(m.p_lim)} N/mm²; acima de ${E.fmt_auto(m.p_falha)} N/mm² (DIN 31652-3, metal patente) o mancal não atende.`, resultado: { s: pm, v: m.p, u: 'N/mm²', c: 3 } }));
    // M7 — h lim
    out.push(item('M7', 'Espessura mínima admissível', PLAN + ' — tabela h lim (D × v)',
      [r(hlim, eq, r(tx('tabela('), D, o(','), vv, tx(')')), eq, n(m.h_lim * 1000, 0), u('µm'))], [],
      { tipo: 'consulta', nota: `Fator de diâmetro ${m.fd} · fator de velocidade ${m.fv}.`, resultado: { s: hlim, v: m.h_lim * 1000, u: 'µm', c: 0 } }));
    // M8 — ψm
    out.push(item('M8', 'Folga relativa média recomendada', m.psi_origem === 'informada' ? 'Informada' : PLAN + ' — tabela ψm (D × v)',
      [r(i('ψ', 'm'), eq, n(m.psi_m, 'auto'), u('‰'))], [], { tipo: 'consulta', resultado: { s: i('ψ', 'm'), v: m.psi_m, u: '‰', c: 2 } }));
    // M9–M12 — ajuste
    out.push(item('M9', 'Furo da bucha (H7)', 'ISO 286 — IT7',
      [r(i('D', 'furo'), eq, D, tx(' … '), D, mais, i('IT7'), eq, n(m.furo_min, 3), tx(' … '), n(m.furo_max, 3), u('mm'))],
      [v(i('IT7'), 'tolerância do furo', E.fmt(m.it7 * 1000, 0), 'µm')], { tipo: 'consulta' }));
    out.push(item('M10', 'Folga diametral', PLAN + ' — tabelas de folga máx./mín.',
      [r(i('s', 'mín'), eq, n(m.folga_min, 3), u('mm')), r(i('s', 'máx'), eq, n(m.folga_max, 3), u('mm'))], [], { tipo: 'consulta' }));
    out.push(item('M11', 'Colo do eixo', 'Ajuste furo × eixo',
      [r(i('d', 'colo,máx'), eq, D, menos, i('s', 'mín'), eq, n(m.eixo_max, 3), u('mm')),
        r(i('d', 'colo,mín'), eq, D, mais, i('IT7'), menos, i('s', 'máx'), eq, n(m.eixo_min, 3), u('mm')),
        m.ajuste_viavel ? r(i('d', 'colo'), eq, n(m.eixo_med, 4), o('±'), n(m.eixo_tol, 4), u('mm')) : null], [],
      { estado: m.ajuste_viavel ? null : 'aviso', nota: m.ajuste_viavel ? '' : 'Faixa de folga menor que IT7: ajuste inviável com furo H7.' }));
    out.push(item('M12', 'Folgas relativas efetivas', 'ψ = s / D',
      [r(i('ψ', 'mín'), eq, f(i('s', 'mín'), D), eq, n(m.psi_min * 1000, 3), u('‰')), r(i('ψ', 'méd'), eq, n(m.psi_med * 1000, 3), u('‰')), r(i('ψ', 'máx'), eq, n(m.psi_max * 1000, 3), u('‰'))], [],
      { nota: 'Os três casos (folga mínima, média e máxima) são calculados; o pior filme governa.' }));
    // M13–M17 — lubrificante
    out.push(item('M13', 'Lubrificante', m.vg_origem === 'informado' ? 'Informado' : PLAN + ' — matriz pressão × velocidade',
      [r(tx('ISO VG '), n(m.vg))], [], { tipo: 'consulta', nota: m.vg_origem === 'informado' ? '' : `p̄ = ${E.fmt(m.p, 2)} N/mm² e v = ${E.fmt(m.v, 1)} m/s (limites 1,25 / 2,5 N/mm²; 3 / 10 / 25 / 50 m/s).` }));
    if (m.balanco) {
      out.push(item('M14', 'Temperatura efetiva — balanço térmico', 'DIN 31652-2 (convecção natural)',
        [r(Pf, p(i('T')), eq, i('α'), vez, i('A'), vez, p(r(i('T'), menos, i('T', 'amb')))), r(i('T'), eq, n(m.t_eff, 1), u('°C'))],
        [v(i('α'), 'coeficiente de troca da caixa', E.fmt_auto(m.alfa), 'W/(m²·K)'), v(i('A'), 'área externa da caixa', E.fmt_auto(m.area_caixa), 'm²'), v(i('T', 'amb'), 'temperatura ambiente', E.fmt_auto(m.t_amb), '°C')],
        { estado: m.t_eff > m.t_lim ? 'falha' : 'ok', nota: `Equilíbrio entre a perda por atrito e o calor dissipado pela caixa. Limite ${E.fmt_auto(m.t_lim)} °C.` + (m.convergiu ? '' : ' Sem equilíbrio abaixo de 250 °C.'), resultado: { s: i('T'), v: m.t_eff, u: '°C', c: 1 } }));
    } else {
      out.push(item('M14', 'Temperatura efetiva do filme', 'Informada', [r(i('T'), eq, n(m.t_eff, 1), u('°C'))], [],
        { tipo: 'consulta', nota: Math.abs(m.t_eff - 40) < 1e-9 ? 'Hipótese da planilha: viscosidade nominal a 40 °C. Em regime o filme costuma operar a 50–70 °C.' : '', resultado: { s: i('T'), v: m.t_eff, u: '°C', c: 1 } }));
    }
    const nu = i('ν'), rho = i('ρ');
    out.push(item('M15', 'Viscosidade cinemática', 'ASTM D341 (Walther)',
      [r(fn('log', fn('log', p(r(nu, mais, n('0,7'))))), eq, i('A'), menos, i('B'), vez, fn('log', i('T', 'K'))), r(nu, p(r(n(m.t_eff, 1), u('°C'))), eq, n(m.nu, 2), u('mm²/s'))],
      [v(i('ν', '40'), 'ISO VG (a 40 °C)', String(m.vg), 'mm²/s'), v(i('ν', '100'), 'valor típico a 100 °C', E.fmt(m.nu100, 1), 'mm²/s')],
      { nota: 'A e B pela reta de Walther entre 40 °C e 100 °C; a 40 °C reproduz exatamente a planilha.', resultado: { s: nu, v: m.nu, u: 'mm²/s', c: 2 } }));
    out.push(item('M16', 'Densidade', 'Dilatação térmica do óleo',
      [r(rho, eq, i('ρ', '15'), vez, r(o('['), n(1), menos, n('0,00065'), vez, p(r(i('T'), menos, n(15))), o(']'))), r(eq, n(m.rho15, 'auto'), x, r(o('['), n(1), menos, n('0,00065'), x, p(r(n(m.t_eff, 1), menos, n(15))), o(']'))), r(eq, n(m.rho, 1), u('kg/m³'))], [],
      { resultado: { s: rho, v: m.rho, u: 'kg/m³', c: 1 } }));
    out.push(item('M17', 'Viscosidade dinâmica', 'η = ν · ρ',
      [r(eta, eq, nu, vez, rho), r(eq, n(m.nu, 2), x, sup(n(10), n(-6)), x, n(m.rho, 1)), r(eq, n(m.eta * 1000, 3), u('mPa·s'))], [],
      { resultado: { s: eta, v: m.eta * 1000, u: 'mPa·s', c: 3 } }));
    // M18–M22 — hidrodinâmica (folga média)
    out.push(item('M18', 'Número de Sommerfeld', 'DIN 31652 / ISO 7902 (correção M1)',
      [r(So, eq, f(r(pm, vez, sup(psi, n(2))), r(eta, vez, om))), r(eq, f(r(n(m.p * 1e6, 0), x, sup(n(c.psi, 6), n(2))), r(n(c.eta, 5), x, n(m.omega, 3)))), r(eq, n(c.so, 4))],
      [v(pm, 'pressão específica', E.fmt(m.p * 1e6, 0), 'Pa'), v(psi, 'folga relativa (folga média)', E.fmt(c.psi, 6)), v(eta, 'viscosidade dinâmica', E.fmt(c.eta, 5), 'Pa·s'), v(om, 'velocidade angular', E.fmt(m.omega, 3), 'rad/s')],
      { nota: `${c.regime}. A planilha original usava v (m/s) no lugar de ω (rad/s).`, resultado: { s: So, v: c.so, u: '', c: 4 } }));
    out.push(item('M19', 'Excentricidade e ângulo de posição', 'Solução numérica da equação de Reynolds',
      [r(r(o('('), ep, o(','), be, o(')')), eq, r(tx('Reynolds('), So, o(','), f(i('B'), D), tx(')'))), r(ep, eq, n(c.eps, 4)), r(be, eq, n(c.beta, 2), u('°'))],
      [v(f(i('B'), D), 'relação largura/diâmetro', E.fmt(m.bd, 3))],
      { tipo: 'consulta', estado: c.limitado ? 'falha' : (c.eps > 0.95 ? 'aviso' : null), nota: 'Interpolação cúbica monotônica em ε e linear em log(B/D) na tabela gerada pela equação de Reynolds (condição de cavitação de Reynolds), conferida com Raimondi–Boyd.' + (c.limitado ? ' ε limitado a 0,99: atrito misto.' : ''), resultado: { s: ep, v: c.eps, u: '', c: 4 } }));
    out.push(item('M20', 'Coeficiente de atrito', 'DIN 31652',
      [r(ff, eq, psi, vez, r(o('['), f(i('π'), r(So, vez, rt(r(n(1), menos, sup(ep, n(2)))))), mais, f(ep, n(2)), vez, fn('sen', be), o(']'))),
        r(eq, n(c.psi, 6), x, r(o('['), f(i('π'), r(n(c.so, 4), x, rt(r(n(1), menos, sup(n(c.eps, 4), n(2)))))), mais, f(n(c.eps, 4), n(2)), x, fn('sen', r(n(c.beta, 2), tx('°'))), o(']'))),
        r(eq, n(c.f, 6))], [], { resultado: { s: ff, v: c.f, u: '', c: 6 } }));
    out.push(item('M21', 'Perda por atrito', 'P = f · F · v',
      [r(Pf, eq, ff, vez, F, vez, vv), r(eq, n(c.f, 6), x, n(m.carga, 0), x, n(m.v, 3)), r(eq, n(c.pf, 0), u('W'))], [],
      { resultado: { s: Pf, v: c.pf, u: 'W', c: 0 } }));
    const k = m.critico, okH = k.hmin * 1000 >= m.h_lim - 1e-12 && !k.limitado;
    out.push(item('M22', 'Espessura mínima do filme', 'Geometria do mancal',
      [r(hmin, eq, f(D, n(2)), vez, psi, vez, p(r(n(1), menos, ep))), r(eq, f(n(m.d, 'auto'), n(2)), x, n(c.psi, 6), x, p(r(n(1), menos, n(c.eps, 4)))), r(eq, n(c.hmin * 1e6, 2), u('µm'))],
      [], { estado: okH ? 'ok' : 'falha', nota: `Folga média. Pior caso: ${k.rotulo}, h mín = ${E.fmt(k.hmin * 1e6, 1)} µm ${okH ? '≥' : '<'} h lim = ${E.fmt(m.h_lim * 1000, 0)} µm.`, resultado: { s: hmin, v: c.hmin * 1e6, u: 'µm', c: 2 } }));
    if (campo) {
      const pmx = i('p', 'máx'), PP = i('P', 'máx');
      const pMaxMPa = campo.pMax * c.eta * m.omega / c.psi ** 2 / 1e6;
      out.push(item('M23', 'Pressão máxima no filme', 'Campo de pressão — equação de Reynolds',
        [r(pmx, eq, PP, vez, f(r(eta, vez, om), sup(psi, n(2)))), r(eq, n(campo.pMax, 3), x, f(r(n(c.eta, 5), x, n(m.omega, 3)), sup(n(c.psi, 6), n(2)))), r(eq, n(pMaxMPa, 2), u('MPa'))],
        [v(PP, 'pico da pressão adimensional', E.fmt(campo.pMax, 3))],
        { nota: `${E.fmt(pMaxMPa / m.p, 2)}× a pressão específica média. Pico a ${E.fmt(campo.thetaPMax, 0)}° da folga máxima, no sentido de rotação.`, resultado: { s: pmx, v: pMaxMPa, u: 'MPa', c: 2 } }));
    }
    out.push(item('M24', 'Vazão de referência', PLAN,
      [r(i('Q'), eq, vv, vez, D, vez, i('ψ', 'máx'), vez, L), r(eq, n(m.v, 3), x, n(m.d / 1000, 'auto'), x, n(m.psi_max, 6), x, n(m.l / 1000, 'auto')), r(eq, n(m.q_ref * 1000, 3), u('L/s'), tx(' = '), n(m.q_ref * 60000, 1), u('L/min'))], [],
      { resultado: { s: i('Q'), v: m.q_ref * 1000, u: 'L/s', c: 3 } }));
    out.push(item('M25', 'Aquecimento do óleo em 1 minuto', PLAN + ' (sem dissipação)',
      [r(i('ΔT'), eq, f(r(n(60), vez, Pf), r(i('m', 'óleo'), vez, i('c', 'p')))), r(eq, f(r(n(60), x, n(c.pf, 0)), r(n(m.massa_oleo, 2), x, n(1785)))), r(eq, n(m.dt_1min, 2), u('K'))],
      [v(i('m', 'óleo'), `massa de óleo (${E.fmt_auto(m.volume_oleo)} L × ρ15)`, E.fmt(m.massa_oleo, 2), 'kg'), v(i('c', 'p'), 'calor específico', '1.785', 'J/(kg·K)')],
      { resultado: { s: i('ΔT'), v: m.dt_1min, u: 'K', c: 2 } }));
    out.push(item('M26', 'Rigidez por compressibilidade do óleo', PLAN,
      [r(i('k', 'c'), eq, f(F, r(p(f(pm, i('E'))), vez, D, vez, i('ψ', 'mín')))), r(eq, n(m.rigidez_compress, 'sci'), u('N/m'))],
      [v(i('E'), 'módulo de elasticidade do óleo', '1,4 × 10⁹', 'Pa')], { resultado: { s: i('k', 'c'), v: m.rigidez_compress, u: 'N/m', c: 'sci' } }));
    out.push(item('M27', 'Rigidez hidrodinâmica aproximada', 'Derivada da característica So(ε)',
      [r(i('k', 'h'), eq, f(F, So), vez, f(r(i('d'), So), r(i('d'), ep)), vez, f(n(1), i('c'))), r(eq, n(m.rigidez_hidro, 'sci'), u('N/m'))],
      [v(i('c'), 'folga radial (folga média)', E.fmt(m.folga_radial * 1e6, 1), 'µm')], { resultado: { s: i('k', 'h'), v: m.rigidez_hidro, u: 'N/m', c: 'sci' } }));
    return out;
  }

  function construir(R, campo = null) {
    const eixoItens = eixo(R);
    const mancalItens = mancal(R, campo);
    return { eixo: eixoItens, mancal: mancalItens };
  }

  /** Texto plano da memória (para copiar). */
  function comoTexto(memoria, R) {
    const linhas = [];
    const bloco = (titulo, itens) => {
      if (!itens.length) return;
      linhas.push('', titulo.toUpperCase(), '─'.repeat(titulo.length));
      for (const it of itens) {
        linhas.push(`${it.id} · ${it.titulo}  [${it.fonte}]`);
        it.linhas.forEach((l, k) => linhas.push((k ? '      ' : '   ') + M.texto(l)));
        if (it.vars.length) linhas.push('   onde: ' + it.vars.map(x => `${M.texto(x.s)} = ${x.v}${x.u ? ' ' + x.u : ''} (${x.d})`).join('; '));
        if (it.nota) linhas.push('   ' + it.nota);
      }
    };
    bloco('Ponta de eixo', memoria.eixo);
    bloco('Mancal de deslizamento', memoria.mancal);
    return linhas.join('\n').trim();
  }

  return { construir, comoTexto };
});
