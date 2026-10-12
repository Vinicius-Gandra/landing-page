/*!
 * VG · Laboratório — orquestração: estado do caso, recálculo, abas, ações e tema
 */
(function (raiz) {
  'use strict';
  const E = raiz.VGEngine, C = raiz.VGCharts, Fm = raiz.VGForm, U = raiz.VGUI, V = raiz.VGViews, Mem = raiz.VGMemoria;
  const { h, svgIco, F, FA, fP } = U;
  const $ = s => document.querySelector(s);
  const ABAS = ['visao', 'eixo', 'mancal', 'memoria', 'tabelas', 'ferramentas', 'referencias'];

  let form = null, R = null, campo = null, memoria = null, erros = null;
  let aba = 'visao';
  const sujo = new Set(ABAS);
  let timer = null;

  // ── estado inicial: endereço → sessão anterior → exemplo ──────────────────
  function lerHash() {
    const hs = location.hash.replace(/^#/, '');
    if (!hs) return null;
    const p = new URLSearchParams(hs);
    const a = p.get('aba');
    if (a && ABAS.includes(a)) aba = a;
    p.delete('aba');
    return Fm.deHash(p.toString());
  }
  function estadoInicial() {
    const doHash = lerHash();
    if (doHash) return doHash;
    try { const s = localStorage.getItem('vg-caso'); if (s) return Fm.deHash(s); } catch (_) { /* sem armazenamento */ }
    return Object.assign({}, Fm.PADRAO);
  }
  function hashAtual(est) {
    const s = Fm.paraHash(est || form.estado());
    return [s, aba !== 'visao' ? 'aba=' + aba : ''].filter(Boolean).join('&');
  }
  function gravarHash() {
    const est = form.estado();
    const s = hashAtual(est);
    try { history.replaceState(null, '', s ? '#' + s : location.pathname + location.search); } catch (_) { /* file:// em alguns navegadores */ }
    try { localStorage.setItem('vg-caso', Fm.paraHash(est)); } catch (_) { /* ok */ }
    const rel = $('#b-relatorio');
    if (rel) rel.href = linkRelatorio();
  }
  const linkRelatorio = () => 'relatorio.html' + (Fm.paraHash(form.estado()) ? '#' + Fm.paraHash(form.estado()) : '');

  // ── cálculo ────────────────────────────────────────────────────────────────
  function aoMudar(est, k) {
    clearTimeout(timer);
    const digitando = k && document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text';
    timer = setTimeout(recalcular, digitando ? 180 : 0);
  }
  function recalcular() {
    gravarHash();
    if (form.temErrosLeitura()) { mostrarErros(Object.values(form.errosLeitura())); return; }
    let novo;
    try { novo = E.calcular(Fm.entradaMotor(form.estado())); }
    catch (ex) {
      if (ex instanceof E.ErroEntrada) { form.atualizarResultado(null, ex.erros); mostrarErros(ex.erros); }
      else { console.error(ex); mostrarErros(['Erro inesperado no cálculo: ' + (ex && ex.message ? ex.message : ex)]); }
      return;
    }
    R = novo; erros = null;
    try { campo = R.mancal ? E.resolver_reynolds(R.mancal.principal.eps, R.mancal.bd) : null; } catch (ex) { console.error(ex); campo = null; }
    memoria = Mem.construir(R, campo);
    form.atualizarResultado(R, R.mancal_erro ? R.mancal_erro.split(' · ') : []);
    mostrarErros(null);
    ABAS.forEach(a => sujo.add(a));
    sujo.delete('ferramentas');
    atualizarTopo();
    renderizar(aba);
  }

  function mostrarErros(lista) {
    const box = $('#aviso-erro');
    const conteudo = document.querySelectorAll('.tabpanel');
    if (!lista || !lista.length) { box.hidden = true; box.textContent = ''; conteudo.forEach(p => p.style.opacity = ''); return; }
    erros = lista;
    box.hidden = false;
    box.replaceChildren(h('div', { class: 'erro-geral', role: 'alert' }, svgIco('i-x-circle'), h('div', null,
      h('h3', null, R ? 'Corrija os dados destacados — resultados abaixo são do último cálculo válido' : 'Corrija os dados destacados para calcular'),
      h('ul', null, lista.map(t => {
        const k = Fm.campoDoErro(t);
        return h('li', null, k ? h('a', { href: '#f-' + k, onclick: ev => { ev.preventDefault(); irDados(k); } }, t) : t);
      })))));
    conteudo.forEach(p => p.style.opacity = R ? '.42' : '');
    if (!R) { atualizarTopo(); }
  }

  // ── topo: identificação do caso, situação e abas ────────────────────────
  function atualizarTopo() {
    const est = form.estado();
    const tit = [est.projeto, est.equipamento].filter(Boolean).join(' · ');
    const h1 = $('#caso-titulo');
    if (tit) h1.textContent = tit; else h1.innerHTML = 'Ponta de eixo <em>+</em> mancal';
    if (!R) { $('#caso-resumo').textContent = 'Aguardando dados válidos'; $('#caso-chips').textContent = ''; return; }
    const e = R.entrada;
    const pot = `${FA(e.potencia)} ${e.unidade_potencia}` + (R.p_regra !== 'kW' && R.p_regra !== 'kva_convencao' ? ` (${fP(R.p_kw)} kW)` : '');
    $('#caso-resumo').textContent = [pot, `${F(R.n_rpm, R.n_rpm % 1 ? 1 : 0)} rpm`, `${U.nomeApl(e.aplicacao in E.APLICACOES ? e.aplicacao : 'Outra')} · FS ${FA(R.fs)}`, R.material.nome, E.CRITERIO_CURTO[R.criterio_governante]].join('  ·  ');
    const chip = (rot, st, txt, alvo) => {
      const s = U.ST[st];
      const b = h('button', { type: 'button', class: 'st-chip ' + s.cls, title: 'Ver ' + rot.toLowerCase() }, svgIco(s.ico), h('span', null, rot), h('b', null, txt));
      b.addEventListener('click', () => irAba(alvo));
      return b;
    };
    const m = R.mancal;
    $('#caso-chips').replaceChildren(
      chip('Eixo', R.status, `⌀${FA(R.d_adotado)} mm · ${U.situacao(R.status)}`, 'eixo'),
      m ? chip('Mancal', m.status, `h mín ${F(m.critico.hmin * 1e6, 1)} µm · ${U.situacao(m.status)}`, 'mancal')
        : chip('Mancal', R.mancal_erro ? 'erro' : 'off', R.mancal_erro ? 'Dados inválidos' : 'Desativado', 'mancal'));
    const dot = (id, st) => { const d = document.querySelector(`#t-${id} .dot`); if (d) d.className = 'dot ' + (st || ''); };
    dot('eixo', R.status);
    dot('mancal', m ? m.status : (R.mancal_erro ? 'falha' : ''));
    $('#n-memoria').textContent = memoria ? String(memoria.eixo.length + memoria.mancal.length) : '';
    const pior = [R.status, m ? m.status : (R.mancal_erro ? 'falha' : 'ok')].includes('falha') ? 'var(--fail)' : [R.status, m && m.status].includes('atencao') ? 'var(--warn)' : 'var(--ok)';
    $('#mob-status').style.background = pior;
    document.title = `${tit ? tit + ' · ' : ''}⌀${FA(R.d_adotado)} mm${m ? ` · mancal ${FA(m.d)} × ${F(m.l, 1)}` : ''} | Laboratório VG`;
  }

  // ── abas ───────────────────────────────────────────────────────────────────
  const ctx = () => ({ R, campo, memoria, irAba, irMemoria, linkRelatorio, focar: irDados, definir: definirCampo,
    abrirTabela: o => { V.tabelasDefinir(o); sujo.add('tabelas'); irAba('tabelas'); } });
  function renderizar(a) {
    const p = document.getElementById('p-' + a);
    if (!p) return;
    if (!R && !['ferramentas', 'referencias'].includes(a)) { C.liberar(p); p.textContent = ''; return; }
    if (!sujo.has(a) && p.childElementCount) return;
    C.liberar(p);
    p.textContent = '';
    try { V[a](p, ctx()); }
    catch (ex) { console.error(ex); p.append(h('div', { class: 'erro-geral' }, svgIco('i-x-circle'), h('div', null, h('h3', null, 'Falha ao montar esta seção'), h('p', null, String(ex && ex.message || ex))))); }
    sujo.delete(a);
  }
  function irAba(a, foco = false) {
    if (!ABAS.includes(a)) return;
    aba = a;
    document.querySelectorAll('.tab').forEach(t => { const on = t.dataset.aba === a; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    document.querySelectorAll('.tabpanel').forEach(p => { p.hidden = p.id !== 'p-' + a; });
    renderizar(a);
    gravarHash();
    if (window.matchMedia('(max-width: 900px)').matches) definirVista('resultados');
    const topo = $('.res-top');
    const y = topo.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--appbar-h') || 58);
    if (window.scrollY > y) window.scrollTo(0, Math.max(0, y));
    if (foco) document.getElementById('p-' + a).focus({ preventScroll: true });
  }
  function irMemoria(id) {
    irAba('memoria');
    requestAnimationFrame(() => {
      const el = document.getElementById('mem-' + id);
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1800);
    });
  }
  function irDados(k) {
    if (window.matchMedia('(max-width: 900px)').matches) definirVista('dados');
    form.focar(k);
  }
  function definirCampo(k, v) {
    const est = form.estado(); est[k] = v; form.definirEstado(est);
  }

  // ── tema ────────────────────────────────────────────────────────────────────
  function temaAtual() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function alternarTema() {
    const novo = temaAtual() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('vg-theme', novo); } catch (_) { /* ok */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = novo === 'dark' ? '#09131f' : '#f5f5ef';
    window.dispatchEvent(new Event('vg-tema'));
    sujo.add('tabelas');
    if (aba === 'tabelas') renderizar('tabelas');
  }

  // ── vista no celular ─────────────────────────────────────────────────────────
  function definirVista(v) {
    $('#lab').dataset.vista = v;
    document.querySelectorAll('.mob-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vista === v)));
    if (v === 'resultados') { sujo.add(aba); renderizar(aba); }
  }

  // ── ações ───────────────────────────────────────────────────────────────────
  function exportarJSON() {
    const est = form.estado();
    const dados = { app: 'VG · Laboratório de ponta de eixo e mancal', versao_motor: E.VERSAO, gerado_em: new Date().toISOString(), entrada: Fm.entradaMotor(est), interface: { carga_modo: est.carga_modo } };
    if (R) dados.resumo = { d_min_mm: R.d_min, d_adotado_mm: R.d_adotado, status_eixo: R.status_texto,
      mancal: R.mancal ? { d_mm: R.mancal.d, l_mm: R.mancal.l, vg: R.mancal.vg, h_min_um: R.mancal.critico.hmin * 1e6, h_lim_um: R.mancal.h_lim * 1000, status: R.mancal.status_texto } : null };
    const nome = (est.projeto || 'caso').normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'caso';
    U.baixar(`${nome}-eixo-mancal.json`, JSON.stringify(dados, null, 2), 'application/json');
    U.toast('Caso exportado (JSON)');
  }
  function importarJSON(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const o = JSON.parse(leitor.result);
        const ent = o.entrada || o;
        const est = Object.assign({}, Fm.PADRAO);
        for (const k of Object.keys(est)) if (k in ent) est[k] = ent[k];
        est.carga_modo = (o.interface && o.interface.carga_modo) || (ent.mancal_carga ? 'carga' : (ent.mancal_massa_rotor ? 'massa' : 'carga'));
        form.definirEstado(est);
        U.toast('Caso aberto');
      } catch (ex) { U.toast('Arquivo inválido: não é um caso exportado pelo laboratório'); }
    };
    leitor.readAsText(arquivo);
  }

  // ── início ──────────────────────────────────────────────────────────────────
  function iniciar() {
    const est = estadoInicial();
    form = Fm.criar($('#form'), { estado: est, aoMudar });
    // abas (clique + setas)
    const lista = $('.tabs');
    lista.addEventListener('click', ev => { const t = ev.target.closest('.tab'); if (t) irAba(t.dataset.aba); });
    lista.addEventListener('keydown', ev => {
      const i = ABAS.indexOf(aba);
      let j = null;
      if (ev.key === 'ArrowRight') j = (i + 1) % ABAS.length;
      else if (ev.key === 'ArrowLeft') j = (i + ABAS.length - 1) % ABAS.length;
      else if (ev.key === 'Home') j = 0; else if (ev.key === 'End') j = ABAS.length - 1;
      if (j === null) return;
      ev.preventDefault(); irAba(ABAS[j]); document.getElementById('t-' + ABAS[j]).focus();
    });
    // atalhos para a memória (KPI, etapas do fluxo)
    $('#conteudo').addEventListener('click', ev => {
      const b = ev.target.closest('[data-ref]');
      if (b && !b.closest('.mem-index')) { ev.preventDefault(); irMemoria(b.dataset.ref); }
    });
    // ações
    $('#b-exemplo').addEventListener('click', () => { form.definirEstado(Object.assign({}, Fm.PADRAO)); U.toast('Caso de exemplo restaurado'); });
    $('#b-link').addEventListener('click', async () => { gravarHash(); const ok = await U.copiar(location.href); U.toast(ok ? 'Link do caso copiado' : 'Não foi possível copiar o link'); });
    $('#b-json').addEventListener('click', exportarJSON);
    $('#b-importar').addEventListener('click', () => $('#arquivo-json').click());
    $('#arquivo-json').addEventListener('change', ev => { const f = ev.target.files && ev.target.files[0]; if (f) importarJSON(f); ev.target.value = ''; });
    $('#b-tema').addEventListener('click', alternarTema);
    document.querySelectorAll('.mob-switch button').forEach(b => b.addEventListener('click', () => definirVista(b.dataset.vista)));
    window.addEventListener('hashchange', () => { const novo = lerHash(); if (novo) { form.definirEstado(novo); irAba(aba); } });
    // tema do sistema mudou (sem preferência gravada)
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (!document.documentElement.getAttribute('data-theme')) window.dispatchEvent(new Event('vg-tema')); });
    // vista inicial no celular: resultados
    definirVista('resultados');
    irAba(aba);
    recalcular();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window);
