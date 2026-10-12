/* Demonstrações visuais da bobina. Não participa dos cálculos. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  };
  const append = (parent, tag, cls, value) => {
    const node = make(tag, cls, value);
    parent.append(node);
    return node;
  };
  const svg = (parent, tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    parent.append(node);
    return node;
  };
  const fmt = (value, decimals = 1) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let preferredFocus = 'todas';

  function renderWire(parent, result) {
    const wire = result.wire;
    const wrap = append(parent, 'figure', 'v-wire');
    const stage = append(wrap, 'div', 'v-wire-stage');
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label',
      `Uma espira formada por ${wire.Fl} fios na largura e ${wire.Fa} na altura, com núcleo de cobre e isolamento individual.`);
    append(stage, 'div', 'v-wire-halo');
    const bundle = append(stage, 'div', 'v-wire-bundle');
    bundle.style.gridTemplateColumns = `repeat(${wire.Fl}, minmax(0, 1fr))`;
    for (let row = 0; row < wire.Fa; row++) {
      for (let column = 0; column < wire.Fl; column++) {
        const cell = append(bundle, 'span', 'v-wire-piece');
        append(cell, 'span', 'v-wire-core');
      }
    }
    const label = append(stage, 'div', 'v-wire-tag');
    append(label, 'strong', '', `${wire.Fl} × ${wire.Fa}`);
    append(label, 'small', '', wire.n === 1 ? 'fio na espira' : 'fios por espira');
    append(wrap, 'figcaption', '', 'Cobre no centro; isolamento envolve cada fio. A composição acompanha o caso selecionado.');
  }

  function gauge(parent, title, used, free, total, formula) {
    const ratio = total > 0 ? used / total : 0;
    const over = ratio > 1 + 1e-6;
    const row = append(parent, 'div', 'v-fit-gauge' + (over ? ' is-over' : ''));
    const text = append(row, 'div', 'v-fit-gauge-head');
    append(text, 'span', '', title);
    append(text, 'strong', '', over ? `excede ${fmt(-free, 2)} mm` : `sobra ${fmt(free, 2)} mm`);
    const track = append(row, 'div', 'v-fit-track');
    const fill = append(track, 'span', 'v-fit-fill');
    fill.style.width = clamp(ratio * 100, 0, 100) + '%';
    append(row, 'small', '', `${formula} · ${fmt(ratio * 100, 1)}% ocupado`);
  }

  function renderSlot(parent, result) {
    const v = result.input, k = result.coil, sl = result.slot;
    const widthRatio = k.Lb / v.w12;
    const usedHeight = 2 * k.Ab + sl.calcos;
    const heightRatio = usedHeight / v.ds;
    const wrap = append(parent, 'figure', 'v-fit');
    const heading = append(wrap, 'div', 'v-fit-heading');
    append(heading, 'span', 'v-overline', 'CORTE DA RANHURA');
    append(heading, 'h4', '', 'Onde fica cada bobina');
    append(heading, 'p', '', 'Os blocos 1 e 2 são duas bobinas isoladas. Cada uma tem sua própria largura Lb e altura Ab.');
    const content = append(wrap, 'div', 'v-fit-content');
    const scene = append(content, 'div', 'v-fit-scene');
    scene.setAttribute('role', 'img');
    scene.setAttribute('aria-label',
      `Corte da ranhura: bobina 1 superior e bobina 2 inferior. Cada bobina isolada mede ${fmt(k.Lb, 2)} milímetros de largura por ${fmt(k.Ab, 2)} milímetros de altura. A ranhura mede ${fmt(v.w12, 2)} milímetros de largura e ${fmt(v.ds, 2)} milímetros de profundidade útil sob a cunha.`);
    const diagram = append(scene, 'div', 'v-fit-diagram');
    const slotWidth = append(diagram, 'div', 'v-fit-slot-width');
    append(slotWidth, 'span', '', 'W12 · largura da ranhura');
    append(slotWidth, 'strong', '', `${fmt(v.w12, 2)} mm`);
    const well = append(diagram, 'div', 'v-fit-well' + (k.sobraL < 0 || k.sobraA < 0 ? ' is-over' : ''));
    append(well, 'div', 'v-fit-wedge', 'Cunha');
    const wellBody = append(well, 'div', 'v-fit-well-body');
    const stack = append(wellBody, 'div', 'v-fit-stack');
    stack.style.width = clamp(widthRatio * 100, 70, 100) + '%';
    stack.style.height = clamp(heightRatio * 100, 60, 100) + '%';
    const shim = (amount, label) => {
      if (amount <= 0) return;
      const strip = append(stack, 'div', 'v-fit-shim', label);
      strip.style.flexBasis = clamp(amount / usedHeight * 100, 4, 15) + '%';
      strip.title = `${label}: ${fmt(amount, 2)} mm`;
    };
    shim(v.calcoTopo, 'Topo');
    for (const [index, label] of [['1', 'Superior'], ['2', 'Inferior']]) {
      if (index === '2') shim(v.calcoMeio, 'Meio');
      const coil = append(stack, 'div', 'v-fit-coil');
      append(coil, 'span', 'v-fit-coil-copper');
      append(coil, 'span', 'v-fit-coil-index', index);
      append(coil, 'span', 'v-fit-coil-name', label);
      append(coil, 'span', 'v-fit-coil-symbols', 'Lb × Ab');
    }
    shim(v.calcoFundo, 'Fundo');
    const slotDepth = append(diagram, 'div', 'v-fit-slot-depth');
    append(slotDepth, 'span', '', 'DS · sob a cunha');
    append(slotDepth, 'strong', '', `${fmt(v.ds, 2)} mm`);
    const stats = append(content, 'div', 'v-fit-stats');
    const cards = append(stats, 'div', 'v-fit-coil-cards');
    for (const [index, label] of [['1', 'Bobina superior'], ['2', 'Bobina inferior']]) {
      const card = append(cards, 'div', 'v-fit-coil-card');
      const cardHead = append(card, 'div', 'v-fit-coil-card-head');
      append(cardHead, 'span', 'v-fit-card-index', index);
      append(cardHead, 'strong', '', label);
      const dimensions = append(card, 'div', 'v-fit-coil-dimensions');
      const width = append(dimensions, 'div');
      append(width, 'span', '', '↔ Lb · largura');
      append(width, 'strong', '', `${fmt(k.Lb, 2)} mm`);
      const height = append(dimensions, 'div');
      append(height, 'span', '', '↕ Ab · altura');
      append(height, 'strong', '', `${fmt(k.Ab, 2)} mm`);
    }
    const fit = append(stats, 'div', 'v-fit-space');
    append(fit, 'h5', '', 'Espaço livre total na ranhura');
    gauge(fit, 'Lateral', k.Lb, k.sobraL, v.w12, 'W12 − Lb');
    gauge(fit, 'Sob a cunha', usedHeight, k.sobraA, v.ds, 'DS − (2 × Ab + calços)');
    append(fit, 'p', '', `Calços: topo ${fmt(v.calcoTopo, 2)} + meio ${fmt(v.calcoMeio, 2)} + fundo ${fmt(v.calcoFundo, 2)} = ${fmt(sl.calcos, 2)} mm. As folgas são totais, não por lado.`);
    append(wrap, 'figcaption', '', 'Vista em corte para localizar as duas bobinas. Formas ilustrativas; os valores em mm são os resultados do cálculo.');
  }

  function renderCoil(parent, result) {
    const v = result.input, k = result.coil, sl = result.slot;
    const hasTurn = sl.Aie > 0;
    const hasFinish = sl.Aa + sl.Afc > 0;
    const wrap = append(parent, 'div', 'v-coil');
    const header = append(wrap, 'div', 'v-coil-head');
    const title = append(header, 'div');
    append(title, 'span', 'v-overline', 'DEMONSTRAÇÃO INTERATIVA');
    append(title, 'h4', '', 'Uma bobina, duas maneiras de olhar');
    append(title, 'p', '', 'A vista completa mostra as partes. O corte abaixo mostra as medidas do braço que entra na ranhura.');
    const stage = append(wrap, 'div', 'v-coil-stage');
    const visual = svg(stage, 'svg', {
      viewBox: '0 0 780 390', role: 'img',
      'aria-label': `Vista completa ilustrativa de uma bobina com ${v.espBob} espiras, cobre e isolamento para massa${hasTurn ? ', acréscimo entre espiras' : ''}${hasFinish ? ', camada externa adicional' : ''}.`
    });
    const defs = svg(visual, 'defs');
    const grad = svg(defs, 'linearGradient', { id: 'v-copper-gradient', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    svg(grad, 'stop', { offset: '0%', 'stop-color': '#9b4928' });
    svg(grad, 'stop', { offset: '35%', 'stop-color': '#f5b565' });
    svg(grad, 'stop', { offset: '68%', 'stop-color': '#c97035' });
    svg(grad, 'stop', { offset: '100%', 'stop-color': '#793d2d' });
    const shadow = svg(defs, 'radialGradient', { id: 'v-shadow-gradient' });
    svg(shadow, 'stop', { offset: '0%', 'stop-color': '#102f3b', 'stop-opacity': '.45' });
    svg(shadow, 'stop', { offset: '100%', 'stop-color': '#102f3b', 'stop-opacity': '0' });
    svg(visual, 'ellipse', { cx: 386, cy: 328, rx: 330, ry: 53, fill: 'url(#v-shadow-gradient)', class: 'v-coil-shadow' });
    const art = svg(visual, 'g', { transform: 'rotate(-8 390 195)' });
    if (hasFinish) {
      const finish = svg(art, 'g', { class: 'v-layer v-layer-finish' });
      svg(finish, 'rect', { x: 102, y: 69, width: 565, height: 236, rx: 114, class: 'v-loop-finish' });
    }
    const ground = svg(art, 'g', { class: 'v-layer v-layer-ground' });
    svg(ground, 'rect', { x: 114, y: 81, width: 541, height: 212, rx: 102, class: 'v-loop-ground' });
    if (hasTurn) {
      const turn = svg(art, 'g', { class: 'v-layer v-layer-turn' });
      svg(turn, 'rect', { x: 128, y: 94, width: 513, height: 186, rx: 90, class: 'v-loop-turn' });
    }
    const copper = svg(art, 'g', { class: 'v-layer v-layer-copper' });
    const lines = clamp(Math.round(v.espBob), 1, 8);
    const outline = hasTurn
      ? { x: 139, y: 104, width: 491, height: 166, rx: 81 }
      : { x: 128, y: 93, width: 513, height: 188, rx: 90 };
    for (let i = 0; i < lines; i++) {
      const inset = i * 9.3;
      svg(copper, 'rect', {
        x: outline.x + inset, y: outline.y + inset, width: outline.width - 2 * inset,
        height: outline.height - 2 * inset, rx: Math.max(14, outline.rx - inset),
        class: 'v-loop-copper', opacity: String(1 - i * .035)
      });
    }
    svg(copper, 'path', { d: 'M145 246 C115 287 90 327 62 351', class: 'v-coil-lead' });
    svg(copper, 'path', { d: 'M163 259 C142 305 129 336 104 363', class: 'v-coil-lead v-coil-lead-second' });
    svg(copper, 'circle', { cx: 62, cy: 351, r: 7, class: 'v-coil-terminal' });
    svg(copper, 'circle', { cx: 104, cy: 363, r: 7, class: 'v-coil-terminal' });
    if (result.ins.corona) {
      const corona = svg(art, 'g', { class: 'v-layer v-layer-corona' });
      svg(corona, 'path', { d: 'M216 68 C321 50 469 52 550 74', class: 'v-loop-corona' });
      svg(corona, 'path', { d: 'M230 304 C327 321 466 323 541 300', class: 'v-loop-corona' });
    }
    for (const [number, part] of [['1', 'body'], ['2', 'head'], ['3', 'leads']]) {
      const pin = append(stage, 'span', `v-coil-pin v-coil-pin-${part}`, number);
      pin.setAttribute('aria-hidden', 'true');
    }
    const stageBadge = append(stage, 'div', 'v-coil-stage-badge');
    append(stageBadge, 'span', '', 'Vista completa · ilustrativa');
    append(stageBadge, 'strong', '', `${v.espBob} ${v.espBob === 1 ? 'espira' : 'espiras'}`);
    const copy = {
      todas: 'As faixas identificam materiais e regiões. A quantidade de traços e a espessura das faixas são ilustrativas.',
      cobre: `Cobre: ${v.espBob} espiras por bobina; cada espira usa ${result.wire.Fl} × ${result.wire.Fa} fios.`,
      massa: `Para massa: Aim = ${fmt(sl.Aim, 2)} mm de acréscimo total; separa a bobina do núcleo.`
    };
    if (hasTurn) copy.entre = `Entre espiras: Aie = ${fmt(sl.Aie, 4)} mm de acréscimo total na seção da bobina.`;
    if (hasFinish) copy.acabamento = `Camada externa adicional. Acréscimos informados: Aa = ${fmt(sl.Aa, 4)} mm e Afc = ${fmt(sl.Afc, 4)} mm.`;
    if (result.ins.corona) copy.anticorona = 'As fitas anticorona são aplicadas nas regiões previstas para esta tensão.';
    const selector = append(wrap, 'div', 'v-layer-selector');
    selector.setAttribute('role', 'group');
    selector.setAttribute('aria-label', 'Destacar camada da bobina');
    if (!copy[preferredFocus]) preferredFocus = 'todas';
    stage.dataset.focus = preferredFocus;
    const caption = append(wrap, 'p', 'v-coil-caption', copy[preferredFocus]);
    const items = [['todas', 'Todas'], ['cobre', 'Cobre']];
    if (hasTurn) items.push(['entre', 'Entre espiras']);
    items.push(['massa', 'Isolamento para massa']);
    if (hasFinish) items.push(['acabamento', 'Camada externa']);
    if (result.ins.corona) items.push(['anticorona', 'Anticorona']);
    for (const [key, label] of items) {
      const button = append(selector, 'button', 'v-layer-button v-layer-button-' + key, label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(key === preferredFocus));
      button.addEventListener('click', () => {
        preferredFocus = key;
        stage.dataset.focus = key;
        caption.textContent = copy[key];
        for (const other of selector.querySelectorAll('button'))
          other.setAttribute('aria-pressed', String(other === button));
      });
    }
    const parts = append(wrap, 'div', 'v-coil-parts');
    for (const [number, name, meaning] of [
      ['1', 'Braço reto', 'Trecho que entra na ranhura. É dele que mostramos Lb e Ab no corte abaixo.'],
      ['2', 'Cabeça da bobina', 'Curva que liga os braços fora do núcleo do estator.'],
      ['3', 'Pontas de ligação', 'Saídas usadas para conectar a bobina ao enrolamento.']
    ]) {
      const card = append(parts, 'div', 'v-coil-part');
      append(card, 'span', 'v-coil-part-number', number);
      const text = append(card, 'div');
      append(text, 'strong', '', name);
      append(text, 'p', '', meaning);
    }
    const cut = append(wrap, 'section', 'v-coil-cut');
    append(cut, 'span', 'v-overline', 'CORTE DO BRAÇO RETO · UMA BOBINA');
    append(cut, 'h5', '', 'Estas são as medidas da bobina isolada');
    append(cut, 'p', 'v-coil-cut-intro', 'Lb e Ab medem a seção externa de cada bobina dentro da ranhura, não a figura completa acima. Acréscimos de 0 mm não formam uma faixa separada.');
    const cutLayout = append(cut, 'div', 'v-coil-cut-layout');
    const cutDiagram = append(cutLayout, 'div', 'v-coil-cut-diagram');
    const cutShape = append(cutDiagram, 'div', 'v-coil-cut-shape' + (hasFinish ? ' has-finish' : '') + (hasTurn ? ' has-turn' : ''));
    append(cutShape, 'div', 'v-coil-cut-copper');
    const cutWidth = append(cutDiagram, 'div', 'v-coil-cut-width');
    append(cutWidth, 'span', '', '↔ Lb · largura');
    append(cutWidth, 'strong', '', `${fmt(k.Lb, 2)} mm`);
    const cutHeight = append(cutDiagram, 'div', 'v-coil-cut-height');
    append(cutHeight, 'span', '', '↕ Ab · altura');
    append(cutHeight, 'strong', '', `${fmt(k.Ab, 2)} mm`);
    const cutLegend = append(cutLayout, 'div', 'v-coil-cut-legend');
    append(cutLegend, 'strong', 'v-coil-cut-legend-title', 'O que entra nesta seção');
    for (const [key, label, value, active] of [
      ['cobre', 'Cobre das espiras', `${v.espBob} espiras`, true],
      ['fio', 'Acréscimo total por fio · Aif', `${fmt(sl.Aif, 4)} mm`, sl.Aif > 0],
      ['entre', 'Acréscimo entre espiras · Aie', `${fmt(sl.Aie, 4)} mm`, hasTurn],
      ['massa', 'Isolamento para massa · Aim', `${fmt(sl.Aim, 2)} mm`, sl.Aim > 0],
      ['fora', 'Acréscimo externo · Aa + Afc', `${fmt(sl.Aa + sl.Afc, 4)} mm`, hasFinish]
    ]) {
      const item = append(cutLegend, 'div', 'v-coil-cut-legend-item' + (active ? '' : ' is-zero'));
      append(item, 'span', `v-coil-cut-dot v-coil-cut-dot-${key}`);
      append(item, 'span', '', label);
      append(item, 'b', '', value);
    }
    const facts = append(wrap, 'div', 'v-coil-facts');
    for (const [label, value] of [
      ['Espiras por bobina', String(v.espBob)],
      ['Cv · entre extremidades dos pinos', `${fmt(result.head.Cv, 1)} mm`],
      ['Cobre por bobina', `${fmt(result.copper.Mcb, 2)} kg`]
    ]) {
      const fact = append(facts, 'div');
      append(fact, 'span', '', label);
      append(fact, 'strong', '', value);
    }
    append(wrap, 'p', 'v-coil-note', 'Forma completa e corte são esquemas ilustrativos, sem escala. As medidas numéricas vêm do cálculo; Cv não é a largura da figura completa.');
  }

  window.VGCoilVisual = { renderWire, renderSlot, renderCoil };
})();
