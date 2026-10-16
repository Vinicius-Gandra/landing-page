/*!
 * VG · Componentes de interface do laboratório (KPI, cartões de gráfico, tabelas, selos, avisos)
 */
(function (raiz) {
  'use strict';
  const E = raiz.VGEngine, C = raiz.VGCharts;
  const { h, svgIco } = raiz.VGForm;

  const F = (x, c = 1) => E.fmt(x, c), FA = x => E.fmt_auto(x), FI = x => E.fmt_int(x);
  /** Potência em kW com casas conforme a grandeza. */
  const fP = kw => !Number.isFinite(kw) ? '—' : Math.abs(kw) >= 100 ? F(kw, 0) : Math.abs(kw) >= 10 ? F(kw, 1) : F(kw, 2);
  /** Quatro algarismos significativos, no máximo. */
  const fN = x => { if (!Number.isFinite(x)) return '—'; const a = Math.abs(x); return a >= 1000 ? F(x, 0) : a >= 100 ? F(x, 1) : a >= 10 ? F(x, 2) : a >= 1 ? F(x, 3) : F(x, 4); };

  const ST = {
    ok: { ico: 'i-ok', txt: 'Atende', cls: 'ok' },
    atencao: { ico: 'i-alerta', txt: 'Com ressalvas', cls: 'atencao' },
    aviso: { ico: 'i-alerta', txt: 'Atenção', cls: 'atencao' },
    falha: { ico: 'i-x-circle', txt: 'Não atende', cls: 'falha' },
    off: { ico: 'i-off', txt: 'Desativado', cls: 'off' },
    erro: { ico: 'i-x-circle', txt: 'Dados inválidos', cls: 'falha' }
  };
  function badge(st, txt) { const s = ST[st] || ST.off; return h('span', { class: 'badge ' + s.cls }, svgIco(s.ico), txt || s.txt); }

  function kpi(o) {
    const tag = o.ref ? 'button' : 'div';
    return h(tag, {
      class: 'kpi' + (o.estado ? ' ' + o.estado : '') + (o.destaque ? ' destaque' : ''), type: o.ref ? 'button' : null,
      'data-ref': o.ref || null, title: o.ref ? `Abrir ${o.ref} na memória de cálculo` : null
    },
      h('span', { class: 'kpi-l' }, h('span', null, o.l), o.ref ? h('span', { class: 'ref' + (o.ref[0] === 'M' ? ' m' : '') }, o.ref) : null),
      h('span', { class: 'kpi-v' + (String(o.v).length > 9 ? ' long' : '') }, o.v, o.u ? h('small', null, o.u) : null),
      o.s ? h('span', { class: 'kpi-s', html: o.s }) : null,
      o.estado && ST[o.estado] && o.estado !== 'off' ? svgIco(ST[o.estado].ico) : null);
  }

  function legenda(itens) {
    return h('div', { class: 'legend' }, itens.map(i => {
      const k = h('i', { class: 'lg ' + (i.tipo || 'line'), 'aria-hidden': 'true' });
      k.style.setProperty('--k', i.cor);
      return h('span', null, k, i.txt);
    }));
  }

  /** Cartão de gráfico: cabeçalho, frase-resumo, legenda, área do gráfico, alternância com a tabela, rodapé. */
  function ccard(o) {
    const corpo = h('div', { class: 'ccard-body' + (o.pad ? ' pad' : '') });
    const twin = h('div', { class: 'twin', hidden: true });
    const tools = h('div', { class: 'ccard-tools' });
    const card = h('article', { class: 'ccard ' + (o.classe || '') },
      h('header', { class: 'ccard-head' }, h('div', null, o.overline ? h('span', { class: 'overline' }, o.overline) : null, h('h3', null, o.titulo)), tools),
      o.resumo ? h('p', { class: 'takeaway', html: o.resumo }) : null,
      o.legenda ? legenda(o.legenda) : null,
      corpo, twin,
      o.nota ? h('p', { class: 'ccard-foot', html: o.nota }) : null);
    if (o.tabela) {
      const rot = h('span', null, 'Tabela');
      const b = h('button', { type: 'button', class: 'btn btn-ghost btn-s', 'aria-pressed': 'false', title: 'Alternar entre gráfico e tabela de dados' }, svgIco('i-tabela'), rot);
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        if (on) C.tabela(twin, o.tabela());
        twin.hidden = !on; corpo.hidden = on;
        rot.textContent = on ? 'Gráfico' : 'Tabela';
        if (!on) corpo.querySelectorAll('.vg-chart').forEach(n => n.__vgGrafico && n.__vgGrafico.desenhar());
      });
      tools.append(b);
    }
    if (o.ferramentas) o.ferramentas.forEach(f => tools.append(f));
    card.corpo = corpo;
    return card;
  }

  /** Seção com título e descrição opcionais. */
  function sec(titulo, desc, ...filhos) {
    return h('section', { class: 'sec' }, titulo ? h('div', { class: 'sec-head' }, h('div', null, h('h2', null, titulo), desc ? h('p', { html: desc }) : null)) : null, ...filhos);
  }
  const grade = (cls, ...filhos) => h('div', { class: cls }, ...filhos);

  /** Tabela simples: colunas [{t, cls}] ou strings; linhas de células (texto ou nó). */
  function tbl(o) {
    const cols = o.colunas.map(c => typeof c === 'string' ? { t: c } : c);
    return h('div', { class: 'tbl-wrap' },
      h('table', { class: 'tbl' + (o.compacta ? ' compact' : '') },
        o.legenda ? h('caption', { class: 'sr-only' }, o.legenda) : null,
        h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.cls || null, scope: 'col' }, c.t)))),
        h('tbody', null, o.linhas.map((l, i) => h('tr', { class: o.sel && o.sel(i) ? 'sel' : null }, l.map((v, j) => h('td', { class: cols[j] && cols[j].cls || null }, v)))))));
  }
  /** Barra inline para células numéricas. */
  function ibar(valor, max, txt, cls = '') {
    const i = h('i', { class: cls, 'aria-hidden': 'true' });
    i.style.width = Math.max(2, Math.min(100, 100 * valor / max)) * 0.6 + 'px';
    return h('span', { class: 'ibar' }, txt, i);
  }
  function stCel(st, txt) { const s = ST[st] || ST.off; return h('span', { class: 'st ' + s.cls }, svgIco(s.ico), txt || s.txt); }

  /** Medidor horizontal (demanda × capacidade/limite). */
  function medidor(o) {
    const fill = h('div', { class: 'meter-fill ' + (o.classe || '') });
    fill.style.width = Math.max(0, Math.min(100, 100 * o.valor / o.max)) + '%';
    const bar = h('div', { class: 'meter-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(o.max), 'aria-valuenow': String(o.valor), 'aria-label': o.rotulo }, fill);
    if (o.marca !== undefined) {
      const mk = h('div', { class: 'meter-mark', 'data-r': o.marcaRotulo || '' });
      mk.style.left = `calc(${Math.min(100, 100 * o.marca / o.max)}% - 1px)`;
      bar.append(mk);
    }
    return h('div', { class: 'meter' + (o.marca !== undefined ? ' has-mark' : '') },
      h('div', { class: 'meter-top' }, h('span', null, o.rotulo), h('b', null, o.txt)), bar,
      o.escala ? h('div', { class: 'meter-scale' }, o.escala.map(s => h('span', null, s))) : null);
  }

  let tt = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.querySelector('span').textContent = msg;
    t.classList.add('on');
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.remove('on'), 2400);
  }
  function baixar(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = h('a', { href: url, download: nome });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
  }
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (_) {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = texto; document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
      ta.remove(); return ok;
    }
  }

  /** Classifica avisos/notas em itens de atenção com severidade. */
  function itensAtencao(R) {
    const out = [];
    const falhaRe = /NÃO atende|< h lim|acima do máximo|insuficiente|atrito misto|acima do limite \d|sem equilíbrio/i;
    for (const a of R.avisos) out.push({ sev: R.status === 'falha' && falhaRe.test(a) ? 'fail' : 'warn', tag: 'Eixo', txt: a });
    const m = R.mancal;
    if (m) for (const a of m.avisos) out.push({ sev: m.status === 'falha' && falhaRe.test(a) ? 'fail' : 'warn', tag: 'Mancal', txt: a });
    if (R.mancal_erro) out.push({ sev: 'fail', tag: 'Mancal', txt: 'Dados do mancal inválidos: ' + R.mancal_erro });
    for (const n of R.notas) out.push({ sev: 'nota', tag: 'Eixo', txt: n });
    if (m) for (const n of m.notas) out.push({ sev: 'nota', tag: 'Mancal', txt: n });
    const ordem = { fail: 0, warn: 1, nota: 2 };
    return out.sort((a, b) => ordem[a.sev] - ordem[b.sev]);
  }
  function listaAtencao(itens) {
    const icos = { fail: 'i-x-circle', warn: 'i-alerta', nota: 'i-info' };
    const rot = { fail: 'Não atende', warn: 'Atenção', nota: 'Nota' };
    return h('div', { class: 'attn' }, itens.map(i => h('div', { class: 'attn-item ' + i.sev }, svgIco(icos[i.sev]),
      h('div', null, h('span', { class: 'tag' }, `${i.tag} · ${rot[i.sev]}`), i.txt))));
  }

  /** Texto curto da situação. */
  const situacao = st => (ST[st] || ST.off).txt;
  const nomeApl = a => a ? a.charAt(0) + a.slice(1).toLowerCase() : '';

  raiz.VGUI = { h, svgIco, F, FA, FI, fP, fN, ST, badge, kpi, legenda, ccard, sec, grade, tbl, ibar, stCel, medidor, toast, baixar, copiar, itensAtencao, listaAtencao, situacao, nomeApl };
})(window);
