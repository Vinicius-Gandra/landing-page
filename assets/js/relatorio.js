(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = window.VGEngine;
  const F = window.VGForm;
  const M = window.VGMemoria;
  const MathVG = window.VGMath;
  const fmt = (n, casas = 1) => E.fmt(n, casas);
  const auto = n => E.fmt_auto(n);
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined && value !== null) element.textContent = String(value);
    return element;
  };
  const append = (parent, ...children) => parent.append(...children);
  const definition = (parent, name, value, className = '') => {
    const row = node('div', `definition ${className}`.trim());
    append(row, node('dt', '', name), node('dd', '', value));
    parent.append(row);
  };
  const mainResult = (name, value, unit, detail, tone = '') => {
    const card = node('div', `key-result ${tone}`.trim());
    const number = node('strong', '', value);
    if (unit) number.append(node('span', '', ` ${unit}`));
    append(card, node('span', 'key-label', name), number, node('small', '', detail));
    $('resultados-principais').append(card);
  };
  const status = (name, state, detail) => {
    const item = node('div', `status-item status-${state || 'off'}`);
    append(item, node('span', 'status-dot'), node('div', 'status-copy'));
    append(item.lastChild, node('small', '', name), node('strong', '', detail));
    $('situacao').append(item);
  };
  const notice = (kind, title, text) => {
    const item = node('div', `notice notice-${kind}`);
    append(item, node('strong', '', title), node('p', '', text));
    $('avisos').append(item);
  };
  const resultText = result => result.c === 'sci' ? E.fmt_sci(result.v, 3) : E.fmt(result.v, result.c);

  function memoryCard(item) {
    const article = node('article', 'memory-card');
    article.id = `mem-${item.id}`;
    const head = node('div', 'memory-card-head');
    const heading = node('div', 'memory-title');
    append(heading, node('span', 'memory-id', item.id), node('h4', '', item.titulo));
    head.append(heading);
    if (item.estado) {
      const labels = { ok: 'Atende', falha: 'Não atende', aviso: 'Atenção', atencao: 'Atenção' };
      head.append(node('span', `memory-state state-${item.estado}`, labels[item.estado] || item.estado));
    }
    article.append(head);
    article.append(node('p', 'memory-source', `${item.tipo === 'consulta' ? 'Consulta · ' : ''}${item.fonte}`));

    if (item.resultado) {
      const panel = node('div', 'memory-result');
      append(panel, node('span', 'result-label', 'RESULTADO'), node('span', 'result-symbol', MathVG.texto(item.resultado.s)));
      const value = node('strong', 'result-value', resultText(item.resultado));
      if (item.resultado.u) value.append(node('small', '', ` ${item.resultado.u}`));
      panel.append(value);
      article.append(panel);
    }

    if (item.linhas.length) {
      const equations = node('div', 'equations');
      item.linhas.forEach((line, index) => {
        const row = node('div', 'equation-row');
        const label = index === 0 ? 'Equação' : index === item.linhas.length - 1 ? 'Resultado' : 'Substituição';
        append(row, node('span', '', label), node('code', '', MathVG.texto(line)));
        equations.append(row);
      });
      article.append(equations);
    }

    if (item.vars.length) {
      const box = node('div', 'variable-box');
      box.append(node('p', 'variable-heading', 'VARIÁVEIS USADAS'));
      const list = node('dl', 'variables');
      item.vars.forEach(variable => {
        const row = node('div', 'variable-row');
        append(row,
          node('dt', 'variable-symbol', MathVG.texto(variable.s)),
          node('dd', 'variable-name', variable.d),
          node('dd', 'variable-value', variable.v + (variable.u ? ` ${variable.u}` : '')));
        list.append(row);
      });
      box.append(list);
      article.append(box);
    }
    if (item.nota) article.append(node('p', 'memory-note', item.nota));
    return article;
  }

  $('imprimir').addEventListener('click', () => window.print());
  $('data').textContent = `Emitido em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`;
  $('voltar').href = 'laboratorio.html' + location.hash;

  try {
    const state = location.hash ? F.deHash(location.hash) : { ...F.PADRAO };
    const R = E.calcular(F.entradaMotor(state));
    const memory = M.construir(R);
    const m = R.mancal;
    document.title = `Relatório - ${state.projeto || state.equipamento || 'Caso de exemplo'} | Laboratório VG`;
    $('meta-tecnica').textContent = `Motor de cálculo v${E.VERSAO} · ${memory.eixo.length + memory.mancal.length} etapas identificadas`;

    definition($('identificacao'), 'Projeto', state.projeto || 'Caso de exemplo', !state.projeto ? 'is-empty' : '');
    definition($('identificacao'), 'Equipamento', state.equipamento || 'Não informado', !state.equipamento ? 'is-empty' : '');
    definition($('identificacao'), 'Responsável', state.responsavel || 'Não informado', !state.responsavel ? 'is-empty' : '');
    status('Ponta de eixo', R.status, R.status_texto || R.status);
    status('Mancal de deslizamento', m ? m.status : R.mancal_erro ? 'falha' : 'off', m ? m.status_texto : R.mancal_erro ? 'Dados inválidos' : 'Não analisado');

    mainResult('DIÂMETRO ADOTADO', auto(R.d_adotado), 'mm', 'Ponta de eixo', R.status === 'falha' ? 'tone-fail' : 'tone-primary');
    mainResult('DIÂMETRO MÍNIMO', fmt(R.d_min, 2), 'mm', 'Critério governante');
    mainResult('FILME MÍNIMO', m ? fmt(m.critico.hmin * 1e6, 1) : '—', m ? 'µm' : '', m ? 'Caso mais crítico do mancal' : 'Mancal não analisado', m && m.status === 'falha' ? 'tone-fail' : '');
    mainResult('LIMITE DO FILME', m ? fmt(m.h_lim * 1000, 1) : '—', m ? 'µm' : '', m ? 'Espessura mínima requerida' : 'Mancal não analisado');

    definition($('eixo-resumo'), 'Torque nominal', `${fmt(R.mt, 1)} N·m`);
    definition($('eixo-resumo'), 'Fator de segurança real', auto(R.sf_real));
    definition($('eixo-resumo'), 'Utilização do diâmetro', `${fmt(R.utilizacao * 100, 1)}%`);
    definition($('eixo-resumo'), 'Potência admissível', `${fmt(R.p_max, 0)} kW`);
    if (m) {
      definition($('mancal-resumo'), 'Diâmetro × largura', `${auto(m.d)} × ${fmt(m.l, 1)} mm`);
      definition($('mancal-resumo'), 'Carga radial', `${fmt(m.carga, 0)} N`);
      definition($('mancal-resumo'), 'Pressão específica', `${fmt(m.p, 2)} N/mm²`);
      definition($('mancal-resumo'), 'Óleo selecionado', `ISO VG ${m.vg}`);
    } else {
      definition($('mancal-resumo'), 'Situação', R.mancal_erro ? 'Não calculado: ' + R.mancal_erro : 'Análise desativada');
    }

    definition($('entradas'), 'Máquina', R.entrada.tipo_maquina);
    definition($('entradas'), 'Potência informada', `${auto(R.entrada.potencia)} ${R.entrada.unidade_potencia}`);
    definition($('entradas'), 'Potência de cálculo', `${fmt(R.p_kw, 1)} kW`);
    definition($('entradas'), 'Rotação', `${fmt(R.n_rpm, 1)} rpm`);
    definition($('entradas'), 'Aplicação', R.entrada.aplicacao);
    definition($('entradas'), 'Fator de serviço', auto(R.fs));
    definition($('entradas'), 'Material do eixo', R.material.nome);
    definition($('entradas'), 'Fator de segurança exigido', auto(R.sf));
    definition($('entradas'), 'Critério de dimensionamento', E.CRITERIO_CURTO[R.criterio_governante] || R.criterio_governante);
    if (m) {
      definition($('entradas'), 'Relação B/D', fmt(m.bd, 3));
      definition($('entradas'), 'Temperatura efetiva', `${fmt(m.t_eff, 1)} °C`);
      definition($('entradas'), 'Folga diametral', `${fmt(m.folga_min, 3)}–${fmt(m.folga_max, 3)} mm`);
    }

    R.avisos.forEach(text => notice('warning', 'Eixo · verificação', text));
    if (m) m.avisos.forEach(text => notice('warning', 'Mancal · verificação', text));
    if (R.mancal_erro) notice('warning', 'Mancal não calculado', R.mancal_erro);
    R.notas.forEach(text => notice('info', 'Nota de cálculo', text));
    if (m) m.notas.forEach(text => notice('info', 'Nota do mancal', text));
    if (!$('avisos').childElementCount) notice('ok', 'Sem avisos adicionais', 'Os dados informados não geraram avisos complementares neste modelo.');

    $('contagem-eixo').textContent = `${memory.eixo.length} etapas`;
    memory.eixo.forEach(item => $('etapas-eixo').append(memoryCard(item)));
    if (memory.mancal.length) {
      $('contagem-mancal').textContent = `${memory.mancal.length} etapas`;
      memory.mancal.forEach(item => $('etapas-mancal').append(memoryCard(item)));
    } else {
      $('memoria-mancal').hidden = true;
      $('link-memoria-mancal').hidden = true;
    }
    $('conteudo').hidden = false;
  } catch (error) {
    $('erro').hidden = false;
    $('erro').textContent = 'Não foi possível gerar o relatório: ' + (Array.isArray(error.erros) ? error.erros.join(' · ') : error.message || String(error));
  }
})();
