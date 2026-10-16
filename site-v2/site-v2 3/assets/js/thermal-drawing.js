/* Laboratório térmico · desenhos do trocador ar–água e do circuito IC81 (SVG em texto puro, sem dependências).
   Vistas: na máquina, conjunto (vista frontal + corte A–A), feixe e aleta (detalhes B e C) e passes de água,
   mais a folha A3 de referência para cotação. Face, feixe, tubos, aletas e passes vêm do cálculo; espelho,
   cabeçote, bocais e bandeja são indicativos. O mesmo traçado serve à tela (classes com os tokens do site)
   e ao papel (estilo embutido na folha, em tinta preta). */
(() => {
  'use strict';
  const isNum = Number.isFinite;
  const nfs = new Map();
  const fmt = (v, d = 1) => {
    if (!isNum(v)) return '—';
    if (!nfs.has(d)) nfs.set(d, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
    return nfs.get(d).format(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v);
  };
  const f0 = v => fmt(v, 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const r2 = x => Math.round(x * 100) / 100;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const PI = Math.PI;
  const VW = 800, VH = 460;
  let seq = 0;

  /* ---- Construtor de SVG -------------------------------------------------------- */
  function SB(paper = false, small = false) {
    const out = [];
    const at = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
      .map(([k, v]) => `${k}="${typeof v === 'number' ? r2(v) : esc(v)}"`).join(' ');
    const S = {
      paper, out,
      T: s => paper ? String(s).toUpperCase() : String(s),
      raw: s => { out.push(s); },
      g: (o = {}) => out.push(`<g ${at(o)}>`),
      end: () => out.push('</g>'),
      rect: (x, y, w, h, cls, o = {}) => out.push(`<rect ${at({ x, y, width: Math.max(0, w), height: Math.max(0, h), rx: o.rx, class: cls, ...o.a })}/>`),
      line: (x1, y1, x2, y2, cls, o = {}) => out.push(`<line ${at({ x1, y1, x2, y2, class: cls, ...o.a })}/>`),
      path: (d, cls, o = {}) => out.push(`<path ${at({ d, class: cls, ...o.a })}/>`),
      circle: (cx, cy, r, cls, o = {}) => out.push(`<circle ${at({ cx, cy, r: Math.max(0, r), class: cls, ...o.a })}/>`),
      text: (x, y, t, cls, o = {}) => out.push(`<text ${at({ x, y, class: cls, 'text-anchor': o.anchor, transform: o.rot ? `rotate(${r2(o.rot)} ${r2(x)} ${r2(y)})` : undefined, ...o.a })}>${esc(t)}</text>`),
      head(x, y, ang, size = 6.5, cls = 'hx-ah') {
        const a = 0.4;
        const p = [[x, y], [x - size * Math.cos(ang - a), y - size * Math.sin(ang - a)], [x - size * Math.cos(ang + a), y - size * Math.sin(ang + a)]];
        out.push(`<path class="${cls}" d="M${p.map(q => q.map(r2).join(' ')).join(' L')} Z"/>`);
      },
      // seta de escoamento por uma polilinha (ponta no último ponto)
      flow(pts, kind, o = {}) {
        const d = 'M' + pts.map(p => p.map(r2).join(' ')).join(' L');
        S.path(d, `hx-air hx-${kind}${o.anim === false ? '' : ' hx-flow'}${o.thin ? ' hx-thin' : ''}`, { a: o.a });
        if (o.head !== false) {
          const [a, b] = pts.slice(-2);
          S.head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), o.size ?? 7, `hx-ah-${kind}`);
        }
      },
      // cota horizontal com linhas de chamada a partir das alturas from1/from2
      dimH(x1, x2, y, label, o = {}) {
        for (const [x, f] of [[x1, o.from1], [x2, o.from2]]) if (isNum(f)) { const s = Math.sign(y - f) || 1; S.line(x, f + s * 2, x, y + s * 4, 'hx-ext'); }
        S.line(x1, y, x2, y, 'hx-dim');
        S.head(x1, y, PI, 6); S.head(x2, y, 0, 6);
        S.text((x1 + x2) / 2 + (o.dx || 0), y + (o.below ? 12 : -4.5), label, 'hx-dim-t', { anchor: 'middle' });
      },
      dimV(x, y1, y2, label, o = {}) {
        for (const [y, f] of [[y1, o.from1], [y2, o.from2]]) if (isNum(f)) { const s = Math.sign(x - f) || 1; S.line(f + s * 2, y, x + s * 4, y, 'hx-ext'); }
        S.line(x, y1, x, y2, 'hx-dim');
        S.head(x, y1, -PI / 2, 6); S.head(x, y2, PI / 2, 6);
        const tx = o.left ? x - 4.5 : x + 11.5, ty = (y1 + y2) / 2 + (o.dy || 0);
        S.text(tx, ty, label, 'hx-dim-t', { anchor: 'middle', rot: -90 });
      },
      balloon(id, x, y, tx, ty) {
        const R = 9.5, dx = x - tx, dy = y - ty, L = Math.hypot(dx, dy) || 1;
        S.g({ class: 'hx-bal', 'data-part': id });
        S.circle(tx, ty, 2, 'hx-bal-dot');
        S.line(tx, ty, x - dx / L * R, y - dy / L * R, 'hx-leader');
        S.circle(x, y, R, 'hx-bal-c');
        S.text(x, y + 3.6, id, 'hx-bal-t', { anchor: 'middle' });
        S.end();
      },
      // etiqueta de temperatura: borda na cor da corrente, texto em tinta
      tag(x, y, text, kind) {
        const w = text.length * (paper ? (small ? 7.6 : 5.6) : 6.4) + (small ? 20 : 14), h = small ? 24 : 18;
        S.rect(x - w / 2, y - h / 2, w, h, `hx-tag hx-tag-${kind}`, { rx: h / 2 });
        S.text(x, y + (small ? 4.6 : 3.8), text, 'hx-tag-t', { anchor: 'middle' });
      },
      ox(cx, cy, r = 6.5, kind = 'hot') {   // ar entrando no plano (⊗)
        S.circle(cx, cy, r, `hx-ox hx-ox-${kind}`);
        const k = r * 0.62;
        S.line(cx - k, cy - k, cx + k, cy + k, `hx-ox hx-ox-${kind}`);
        S.line(cx - k, cy + k, cx + k, cy - k, `hx-ox hx-ox-${kind}`);
      },
      part(id, fn) { S.g({ class: 'hx-part', 'data-part': id }); fn(); S.end(); },
      // hachura a 45° recortada num retângulo
      hatch(x, y, w, h, step = 4, cls = 'hx-hatch') {
        for (let c = step; c < w + h; c += step) {
          const u1 = Math.min(c, w), v1 = c - u1, v2 = Math.min(c, h), u2 = c - v2;
          S.line(x + u1, y + v1, x + u2, y + v2, cls);
        }
      },
      // linha de interrupção em zigue-zague (vertical)
      breakV(x, y1, y2, cls = 'hx-break') {
        const m = (y1 + y2) / 2;
        S.path(`M${r2(x)} ${r2(y1)} L${r2(x)} ${r2(m - 6)} L${r2(x - 4)} ${r2(m - 2)} L${r2(x + 4)} ${r2(m + 2)} L${r2(x)} ${r2(m + 6)} L${r2(x)} ${r2(y2)}`, cls);
      }
    };
    return S;
  }
  function smooth(pts) {
    if (pts.length < 3) return 'M' + pts.map(p => p.map(r2).join(' ')).join(' L');
    let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`;
    }
    return d;
  }
  const fins = (id, step = 3.2) => `<defs><pattern id="${id}-fin" width="${step}" height="10" patternUnits="userSpaceOnUse"><rect width="${step}" height="10" class="hx-fin-bg"/><line x1="${step / 2}" y1="0" x2="${step / 2}" y2="10" class="hx-fin-l"/></pattern></defs>`;
  const airGrad = (id, vertical = false) => `<defs><linearGradient id="${id}-air" x1="0" y1="${vertical ? 1 : 0}" x2="${vertical ? 0 : 1}" y2="0"><stop offset="0" class="hx-stop-hot"/><stop offset="1" class="hx-stop-cold"/></linearGradient></defs>`;

  /* ---- Dimensões construtivas (indicativas) ---------------------------------------- */
  const DN = [25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400];
  function layout(r) {
    const d = r.d, g = r.g, n = r.modules;
    const qn = r.qvW / n;
    const area = dn => PI * Math.pow(dn / 1000, 2) / 4;
    const dn = DN.find(x => qn / area(x) <= 2.0) || DN[DN.length - 1];
    const L = d.tubeLength * 1000, H = r.npr * g.Pt, p = r.depth, N = r.passes;
    const ts = 25, box = clamp(Math.round((1.2 * dn + 90) / 5) * 5, 140, 320), cm = 60, clear = 25;
    return {
      L, H, p, N, dn, qn, vNoz: qn / area(dn), ts, box, cm, clear, Dc: p + 2 * clear,
      front: Math.floor(N / 2), rear: Math.floor((N - 1) / 2), outletFront: N % 2 === 0,
      Ltot: L + 2 * (ts + box), Htot: H + 2 * cm, wall: (d.tubeOD - d.tubeID) / 2
    };
  }
  // fronteira entre os passes k e k+1 (passes empilhados de baixo para cima), fração da altura a partir do topo
  const passBoundary = (k, N) => 1 - k / N;

  /* ---- Itens (balões) ------------------------------------------------------------------ */
  function parts(r, lay = layout(r)) {
    const d = r.d, g = r.g, n = r.modules, cntp = d.flowRef !== 'real' ? ' (CNTP)' : '';
    const pl = (k, s, p) => `${k} ${k === 1 ? s : p}`;
    return [
      { id: 'A', views: ['maquina'], name: 'Trocador ar–água', data: `${pl(n, 'unidade', 'unidades')} · área mín. ${f0(r.areaMin)} m² · ${fmt(r.qDesign, 1)} kW` },
      { id: 'B', views: ['maquina'], name: 'Bocais de água', data: `${fmt(r.qvWh, 2)} m³/h · entra ${fmt(d.waterIn)} °C, sai ${fmt(r.waterOut)} °C` },
      { id: 'C', views: ['maquina'], name: 'Ventilador LA', data: `${fmt(r.flowPerFan, 2)} m³/s${cntp}, logo depois do mancal` },
      { id: 'D', views: ['maquina'], name: 'Ventilador LOA', data: r.fans >= 2 ? `${fmt(r.flowPerFan, 2)} m³/s${cntp}, logo depois do mancal` : 'sem ventilador neste caso' },
      { id: 'E', views: ['maquina'], name: 'Mancais', data: `${fmt(r.qBearing, 1)} kW saem pelo óleo, fora do trocador` },
      { id: 'F', views: ['maquina'], name: 'Núcleo do estator e dutos radiais', data: `o ar sai quente pelos dutos e sobe a ${fmt(r.Th)} °C` },
      { id: 'G', views: ['maquina'], name: 'Cabeças de bobina', data: `recebem o ar frio dos ventiladores a ${fmt(r.Tc)} °C` },
      { id: 'H', views: ['maquina'], name: 'Rotor', data: `as perdas no ar aquecem o ar em ${fmt(r.dTair, 2)} K` },
      { id: '1', views: ['conjunto', 'feixe'], name: 'Feixe tubular aletado', data: `${pl(r.rows, 'fileira', 'fileiras')} × ${r.npr} tubos = ${r.tubes} tubos · ${fmt(d.tubeLength, 2)} m aletados` },
      { id: '2', views: ['conjunto'], name: 'Espelhos', data: `2 por unidade · ${r.tubes} furos Ø${fmt(d.tubeOD, 2)} · ${lay.ts} mm (indicativo)` },
      { id: '3', views: ['conjunto', 'passes'], name: 'Cabeçote de entrada e saída', data: `${pl(lay.front, 'divisória', 'divisórias')} · bocal de ${lay.outletFront ? 'entrada e de saída' : 'entrada'}` },
      { id: '4', views: ['conjunto', 'passes'], name: 'Cabeçote de retorno', data: `${pl(lay.rear, 'divisória', 'divisórias')}${lay.outletFront ? ' · vira a água entre os passes' : ' · bocal de saída'}` },
      { id: '5', views: ['conjunto', 'passes'], name: 'Bocal de entrada', data: `DN ${lay.dn} sugerido · ${fmt(lay.qn * 3600, 2)} m³/h a ${fmt(d.waterIn)} °C` },
      { id: '6', views: ['conjunto', 'passes'], name: 'Bocal de saída', data: `DN ${lay.dn} · ${fmt(r.waterOut)} °C · ${fmt(lay.vNoz, 1)} m/s no bocal` },
      { id: '7', views: ['conjunto', 'passes'], name: 'Divisórias de passe', data: `${pl(r.passes, 'passe', 'passes')} × ${fmt(r.tpp, 1)} tubos · água a ${fmt(r.waterVel, 2)} m/s` },
      { id: '8', views: ['conjunto'], name: 'Carcaça e chapas laterais', data: `face ${fmt(d.tubeLength, 2)} × ${fmt(r.faceHeight, 2)} m · vedam o desvio do ar` },
      { id: '9', views: ['conjunto'], name: 'Bandeja de condensado', data: 'dreno para fora da máquina e detector de vazamento' },
      { id: '10', views: ['conjunto', 'passes'], name: 'Respiros e drenos', data: 'no topo e no fundo de cada cabeçote' },
      { id: '11', views: ['feixe'], name: 'Tubo', data: `Ø${fmt(d.tubeOD, 2)} × ${fmt(lay.wall, 2)} mm · ${r.mat.label.toLowerCase()}` },
      { id: '12', views: ['feixe'], name: 'Aleta L', data: `Ø${fmt(g.Df, 1)} · ${fmt(d.fpi, 1)} FPI (passo ${fmt(g.pitchMM, 2)} mm) · ${fmt(g.t, 2)} mm · alumínio` }
    ];
  }

  /* ---- Vista: na máquina (esquema IC81) ------------------------------------------------ */
  function machine(r, o = {}) {
    const S = SB(o.paper), T = S.T, d = r.d, lay = o.lay || layout(r), id = 'hx' + (++seq);
    const off = r.fans < 2;
    const F = { x0: 120, x1: 680, y0: 214, y1: 398 }, Hd = { x0: 104, x1: 696, y0: 50 };
    const B = { x0: 196, x1: 604, y0: 118, y1: 146 };          // feixe (espessura exagerada)
    const bxL = 172, bxR = 628;                                  // faces externas dos cabeçotes
    S.raw(fins(id, 3));
    // zonas de ar (fundo): frio em cima e nos dutos das pontas, quente sob o feixe
    S.rect(Hd.x0, Hd.y0, Hd.x1 - Hd.x0, F.y0 - Hd.y0, 'hx-gap');
    S.rect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0, 'hx-gap');
    S.rect(Hd.x0, Hd.y0, Hd.x1 - Hd.x0, B.y0 - Hd.y0, 'hx-zone-cold');
    S.rect(Hd.x0, B.y0, bxL - Hd.x0, F.y0 - B.y0, 'hx-zone-cold');
    S.rect(bxR, B.y0, Hd.x1 - bxR, F.y0 - B.y0, 'hx-zone-cold');
    S.rect(bxL, B.y1, bxR - bxL, F.y0 - B.y1, 'hx-zone-hot');
    // base
    S.rect(150, F.y1, 60, 14, 'hx-steel'); S.rect(590, F.y1, 60, 14, 'hx-steel');
    S.line(70, F.y1 + 14, 730, F.y1 + 14, 'hx-ground');
    // eixo, acoplamento e mancais
    S.rect(26, 299, 748, 10, 'hx-shaft');
    S.rect(26, 288, 16, 32, 'hx-steel', { rx: 2 });
    S.text(34, 281, T('acopl.'), 'hx-t2', { anchor: 'middle' });
    S.part('E', () => {
      for (const x of [86, 690]) { S.rect(x, 286, 24, 36, 'hx-bearing', { rx: 3 }); S.rect(x - 4, 322, 32, 6, 'hx-steel'); }
      S.flow([[98, 330], [98, 356]], 'oil', { size: 6, anim: false });
      S.flow([[702, 330], [702, 356]], 'oil', { size: 6, anim: false });
      S.text(98, 370, T('óleo'), 'hx-t2', { anchor: 'middle' });
      S.text(702, 370, T('óleo'), 'hx-t2', { anchor: 'middle' });
    });
    // estator com dutos radiais, cabeças de bobina e rotor
    const ducts = [];
    for (let k = 0; k < 6; k++) ducts.push(300 + k * 37);
    S.part('F', () => {
      S.rect(270, 236, 260, 48, 'hx-core'); S.rect(270, 324, 260, 48, 'hx-core');
      for (const x of ducts) { S.rect(x, 237, 6, 46, 'hx-gap'); S.rect(x, 325, 6, 46, 'hx-gap'); }
    });
    S.part('G', () => {
      for (const [x, y] of [[240, 242], [240, 328], [532, 242], [532, 328]]) S.rect(x, y, 28, 38, 'hx-cu', { rx: 9 });
    });
    S.part('H', () => { S.rect(284, 288, 232, 32, 'hx-rotor', { rx: 3 }); });
    S.text(400, 308, T(`perdas no ar ${fmt(r.qDesign, 1)} kW`), 'hx-t hx-on', { anchor: 'middle' });
    // ventiladores logo depois dos mancais
    S.part('C', () => { S.rect(176, 260, 12, 38, 'hx-fan', { rx: 3 }); S.rect(176, 310, 12, 38, 'hx-fan', { rx: 3 }); S.circle(182, 304, 7, 'hx-fan'); });
    S.g({ class: off ? 'hx-off' : '' });
    S.part('D', () => { S.rect(612, 260, 12, 38, 'hx-fan', { rx: 3 }); S.rect(612, 310, 12, 38, 'hx-fan', { rx: 3 }); S.circle(618, 304, 7, 'hx-fan'); });
    S.end();
    // paredes: capô + carcaça, parede superior da carcaça com aberturas, defletores
    S.path(`M${Hd.x0} ${Hd.y0} V${F.y0} H${F.x0} V${F.y1} H${F.x1} V${F.y0} H${Hd.x1} V${Hd.y0} Z`, 'hx-wall');
    for (const [a, b] of [[F.x0, 128], [164, 300], [500, 636], [672, F.x1]]) S.line(a, F.y0, b, F.y0, 'hx-wall');
    S.line(bxL, 156, bxL, F.y0, 'hx-wall'); S.line(bxR, 156, bxR, F.y0, 'hx-wall');
    // trocador: feixe + cabeçotes
    S.part('A', () => {
      S.rect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, 'hx-face-bg');
      S.rect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, 'hx-face', { a: { fill: `url(#${id}-fin)` } });
      const nr = clamp(r.rows, 1, 6);
      for (let j = 0; j < nr; j++) { const y = B.y0 + (j + 0.5) * (B.y1 - B.y0) / nr; S.line(B.x0, y, B.x1, y, 'hx-tube-l'); }
      S.path(`M${B.x0} 108 H${bxL + 6} Q${bxL} 108 ${bxL} 114 V150 Q${bxL} 156 ${bxL + 6} 156 H${B.x0} Z`, 'hx-steel');
      S.path(`M${B.x1} 108 H${bxR - 6} Q${bxR} 108 ${bxR} 114 V150 Q${bxR} 156 ${bxR - 6} 156 H${B.x1} Z`, 'hx-steel');
      S.line(B.x0, 106, B.x0, 158, 'hx-sheet'); S.line(B.x1, 106, B.x1, 158, 'hx-sheet');
    });
    // bocais (entrada embaixo; saída em cima, no mesmo cabeçote se N for par)
    const pipe = (y, side) => {
      const xa = side < 0 ? 60 : bxR, xb = side < 0 ? bxL : 740;
      S.rect(xa, y - 4, xb - xa, 8, 'hx-pipe');
      const xf = side < 0 ? 62 : 732;
      S.rect(xf, y - 9, 6, 18, 'hx-flange');
    };
    S.part('B', () => {
      pipe(148, -1);
      pipe(116, lay.outletFront ? -1 : 1);
    });
    S.flow([[22, 148], [54, 148]], 'water', { anim: false });
    if (lay.outletFront) S.flow([[54, 116], [20, 116]], 'water', { anim: false });
    else S.flow([[746, 116], [780, 116]], 'water', { anim: false });
    // escoamentos de ar
    for (const x of [303, 377, 451]) S.flow([[x, 282], [x, 240]], 'hot', { thin: true, head: false });
    for (const x of [340, 400, 460]) S.flow([[x, 232], [x, 154]], 'hot');
    for (const x of [340, 400, 460]) S.flow([[x, 113], [x, 92]], 'cold', { size: 6 });
    S.flow([[330, 80], [138, 80], [138, 280], [170, 280]], 'cold');
    S.flow([[192, 272], [236, 272]], 'cold', { size: 6 });
    S.g({ class: off ? 'hx-off' : '' });
    S.flow([[470, 80], [662, 80], [662, 280], [630, 280]], 'cold');
    S.flow([[608, 272], [564, 272]], 'cold', { size: 6 });
    S.end();
    // temperaturas
    S.tag(400, 66, `${fmt(r.Tc)} °C`, 'cold');
    S.tag(400, 188, `${fmt(r.Th)} °C`, 'hot');
    S.tag(40, 168, `${fmt(d.waterIn)} °C`, 'water');
    if (lay.outletFront) S.tag(40, 96, `${fmt(r.waterOut)} °C`, 'calc');
    else S.tag(760, 96, `${fmt(r.waterOut)} °C`, 'calc');
    // ventiladores: legenda sob a máquina
    const ref = d.flowRef === 'cntp' ? ' CNTP' : '';
    S.text(182, 436, T(`LA · ${fmt(r.flowPerFan, 2)} m³/s${ref}`), 'hx-t hx-strong', { anchor: 'middle' });
    S.text(182, 450, T('lado acoplado'), 'hx-t2', { anchor: 'middle' });
    S.text(618, 436, T(off ? 'LOA · sem ventilador' : `LOA · ${fmt(r.flowPerFan, 2)} m³/s${ref}`), `hx-t hx-strong${off ? ' hx-off' : ''}`, { anchor: 'middle' });
    S.text(618, 450, T('lado oposto'), `hx-t2${off ? ' hx-off' : ''}`, { anchor: 'middle' });
    // balões
    if (o.balloons !== false) {
      S.balloon('A', 540, 24, 500, 132);
      S.balloon('B', 122, 24, 118, 116);
      S.balloon('C', 226, 196, 184, 262);
      S.balloon('D', 574, 196, 616, 262);
      S.balloon('E', 56, 250, 88, 296);
      S.balloon('F', 456, 432, 430, 368);
      S.balloon('G', 292, 432, 256, 364);
      S.balloon('H', 374, 432, 340, 318);
    }
    return { svg: S.out.join(''), W: VW, H: VH };
  }

  /* ---- Vista: conjunto (vista frontal + corte A–A) -------------------------------------- */
  function assembly(r, o = {}) {
    const S = SB(o.paper), T = S.T, d = r.d, g = r.g, lay = o.lay || layout(r), id = 'hx' + (++seq);
    const N = lay.N;
    const noz = Math.max(0.55 * lay.box, 2.2 * lay.dn);
    const trayGap = 30, tray = 40, drain = 70;
    const Lw = lay.Ltot + noz * (lay.outletFront ? 1 : 2);
    const Hw = lay.Htot + trayGap + tray + drain;
    const FX0 = 30, FX1 = 566, FY0 = 64, FY1 = 398;
    const s = Math.min((FX1 - FX0) / Lw, (FY1 - FY0) / Hw);
    const Ls = lay.L * s, Hs = lay.H * s, ts = lay.ts * s, bx = lay.box * s, cm = lay.cm * s;
    const offX = ((FX1 - FX0) - Lw * s) / 2;
    const x0 = FX0 + offX + (noz + lay.ts + lay.box) * s, y0 = FY0 + cm;
    const xL = x0 - ts - bx, xR = x0 + Ls + ts + bx, yT = y0 - cm, yB = y0 + Hs + cm;
    const byT = y0 - cm * 0.55, byB = y0 + Hs + cm * 0.55;
    const ys = k => y0 + Hs * passBoundary(k, N);
    S.raw(fins(id, Math.max(2.2, Math.min(3.4, g.pitchMM * s * 6))));
    S.raw(airGrad(id));

    // cabeçotes
    const boxShape = (xa, xb, outer) => {
      const rr = Math.min(10, (xb - xa) * 0.4);
      if (outer < 0) S.path(`M${r2(xb)} ${r2(byT)} H${r2(xa + rr)} Q${r2(xa)} ${r2(byT)} ${r2(xa)} ${r2(byT + rr)} V${r2(byB - rr)} Q${r2(xa)} ${r2(byB)} ${r2(xa + rr)} ${r2(byB)} H${r2(xb)} Z`, 'hx-steel');
      else S.path(`M${r2(xa)} ${r2(byT)} H${r2(xb - rr)} Q${r2(xb)} ${r2(byT)} ${r2(xb)} ${r2(byT + rr)} V${r2(byB - rr)} Q${r2(xb)} ${r2(byB)} ${r2(xb - rr)} ${r2(byB)} H${r2(xa)} Z`, 'hx-steel');
      S.line(outer < 0 ? xb - 3 : xa + 3, byT, outer < 0 ? xb - 3 : xa + 3, byB, 'hx-flange-l');
    };
    S.part('3', () => boxShape(xL, x0 - ts, -1));
    S.part('4', () => boxShape(x0 + Ls + ts, xR, 1));
    // divisórias (linhas ocultas): entrada/saída após passes ímpares, retorno após pares
    S.part('7', () => {
      for (let k = 1; k < N; k++) {
        const y = ys(k);
        if (k % 2 === 1) S.line(xL + 3, y, x0 - ts, y, 'hx-hidden');
        else S.line(x0 + Ls + ts, y, xR - 3, y, 'hx-hidden');
      }
    });
    // espelhos
    S.part('2', () => { S.rect(x0 - ts, yT, ts, yB - yT, 'hx-steel-2'); S.rect(x0 + Ls, yT, ts, yB - yT, 'hx-steel-2'); });
    // chapas laterais
    S.part('8', () => {
      S.rect(x0, yT, Ls, cm, 'hx-steel'); S.rect(x0, y0 + Hs, Ls, cm, 'hx-steel');
      S.line(x0, yT + cm * 0.35, x0 + Ls, yT + cm * 0.35, 'hx-flange-l'); S.line(x0, yB - cm * 0.35, x0 + Ls, yB - cm * 0.35, 'hx-flange-l');
    });
    // feixe aletado
    S.part('1', () => {
      S.rect(x0, y0, Ls, Hs, 'hx-face-bg');
      S.rect(x0, y0, Ls, Hs, 'hx-face', { a: { fill: `url(#${id}-fin)` } });
      const pitch = g.Pt * s, step = Math.max(1, Math.ceil(3 / pitch));
      for (let i = 0; i < r.npr; i += step) { const y = y0 + (i + 0.5) * pitch; S.line(x0, y, x0 + Ls, y, 'hx-tube-l'); }
      S.rect(x0, y0, Ls, Hs, 'hx-outline');
    });
    // ar entrando na face
    for (const fy of [0.3, 0.72]) for (const fx of [0.18, 0.5, 0.82]) S.ox(x0 + Ls * fx, y0 + Hs * fy, 6.5, 'hot');
    // bocais
    const nozzle = (side, y) => {
      const xa = side < 0 ? xL - noz * s : xR, w = noz * s, h = Math.max(4, lay.dn * s);
      S.rect(xa, y - h / 2, w, h, 'hx-pipe');
      const xf = side < 0 ? xa - 2 : xa + w - 3;
      S.rect(xf, y - h / 2 - 4, 5, h + 8, 'hx-flange');
      return side < 0 ? xa - 2 : xa + w + 3;
    };
    const yIn = y0 + Hs * (1 - 0.5 / N), yOut = y0 + Hs * (0.5 / N);
    let xin, xout;
    S.part('5', () => { xin = nozzle(-1, yIn); });
    S.part('6', () => { xout = nozzle(lay.outletFront ? -1 : 1, yOut); });
    S.flow([[xin - 30, yIn], [xin - 6, yIn]], 'water', { anim: false });
    if (lay.outletFront) S.flow([[xout - 6, yOut], [xout - 30, yOut]], 'water', { anim: false });
    else S.flow([[xout + 6, yOut], [xout + 30, yOut]], 'water', { anim: false });
    // respiros e drenos
    S.part('10', () => {
      for (const xc of [(xL + x0 - ts) / 2, (x0 + Ls + ts + xR) / 2]) { S.rect(xc - 3, byT - 6, 6, 6, 'hx-flange'); S.rect(xc - 3, byB, 6, 6, 'hx-flange'); }
    });
    // bandeja de condensado e dreno
    const yt = yB + trayGap * s, th = Math.max(5, tray * s);
    S.part('9', () => {
      S.path(`M${r2(x0 - ts - 4)} ${r2(yt)} V${r2(yt + th)} H${r2(x0 + Ls + ts + 4)} V${r2(yt)}`, 'hx-tray');
      S.line(x0 + Ls - 14, yt + th, x0 + Ls - 14, yt + th + Math.max(8, drain * s) - 6, 'hx-drain');
      S.head(x0 + Ls - 14, yt + th + Math.max(8, drain * s), PI / 2, 5, 'hx-ah-water');
    });
    // linha de corte A–A
    const xA = x0 + Ls * 0.64;
    S.line(xA, yT - 14, xA, yt + th + 10, 'hx-cut');
    for (const yy of [yT - 14, yt + th + 10]) { S.line(xA, yy, xA + 14, yy, 'hx-cut-a'); S.head(xA + 17, yy, 0, 6, 'hx-ah'); S.text(xA - 7, yy + 4, 'A', 'hx-cut-t', { anchor: 'middle' }); }
    // cotas
    S.dimH(xL, xR, yT - 22, `≈ ${f0(lay.Ltot)} total`, { from1: byT, from2: byT });
    S.dimH(x0, x0 + Ls, yt + th + Math.max(8, drain * s) + 14, `L ${f0(lay.L)} aletado`, { from1: y0 + Hs, from2: y0 + Hs, below: true });
    S.dimV(xR + 18, y0, y0 + Hs, `H ${f0(lay.H)} face`, { from1: x0 + Ls + ts, from2: x0 + Ls + ts });
    // temperaturas da água
    S.tag(Math.max(FX0 + 30, xin - 18), yIn + 18, `${fmt(d.waterIn)} °C`, 'water');
    if (lay.outletFront) S.tag(Math.max(FX0 + 30, xout - 18), yOut - 18, `${fmt(r.waterOut)} °C`, 'calc');
    else S.tag(Math.min(FX1 - 30, xout + 18), yOut - 18, `${fmt(r.waterOut)} °C`, 'calc');
    S.text((FX0 + FX1) / 2, 450, T('Vista frontal · face de entrada do ar'), 'hx-ttl', { anchor: 'middle' });

    // ---- corte A–A (mesma escala, alinhado à vista frontal)
    const SX0 = 600, SX1 = 790;
    const Dcs = lay.Dc * s, xs0 = SX0 + ((SX1 - SX0) - Dcs) / 2;
    S.rect(xs0, y0, Dcs, Hs, 'hx-airband', { a: { fill: `url(#${id}-air)` } });
    S.part('8', () => {
      S.rect(xs0 - 3, yT, Dcs + 6, cm, 'hx-steel-cut'); S.rect(xs0 - 3, y0 + Hs, Dcs + 6, cm, 'hx-steel-cut');
      if (cm > 6) { S.hatch(xs0 - 3, yT, Dcs + 6, cm, 4); S.hatch(xs0 - 3, y0 + Hs, Dcs + 6, cm, 4); }
    });
    S.part('1', () => {
      const rf = g.Df / 2 * s, rt = d.tubeOD / 2 * s, ri = d.tubeID / 2 * s;
      for (let j = 0; j < r.rows; j++) {
        const cx = xs0 + (lay.clear + g.Df / 2 + j * g.Pl) * s, odd = j % 2 === 1, n = r.npr - (odd ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const cy = y0 + (i + 0.5 + (odd ? 0.5 : 0)) * g.Pt * s;
          S.circle(cx, cy, rf, 'hx-fin');
          if (rt >= 1.2) { S.circle(cx, cy, rt, 'hx-tube'); if (ri >= 1) S.circle(cx, cy, ri, 'hx-bore'); }
        }
      }
    });
    S.part('9', () => { S.path(`M${r2(xs0 - 6)} ${r2(yt)} V${r2(yt + th)} H${r2(xs0 + Dcs + 6)} V${r2(yt)}`, 'hx-tray'); });
    for (const k of [0.22, 0.5, 0.78]) {
      const y = y0 + Hs * k;
      S.flow([[xs0 - 44, y], [xs0 - 6, y]], 'hot');
      S.flow([[xs0 + Dcs + 6, y], [xs0 + Dcs + 44, y]], 'cold');
    }
    S.tag(xs0 - 32, yT - 14, `${fmt(r.Th)} °C`, 'hot');
    S.tag(xs0 + Dcs + 32, yT - 14, `${fmt(r.Tc)} °C`, 'cold');
    S.dimH(xs0 + lay.clear * s, xs0 + (lay.clear + lay.p) * s, yt + th + 18, `p ${f0(lay.p)}`, { from1: y0 + Hs, from2: y0 + Hs, below: true });
    S.text((SX0 + SX1) / 2, 450, T('Corte A–A'), 'hx-ttl', { anchor: 'middle' });

    // balões
    if (o.balloons !== false) {
      const top = 22;
      const kMid = Math.max(1, (Math.floor(N / 2) % 2 === 1) ? Math.floor(N / 2) : Math.floor(N / 2) - 1);
      S.balloon('1', x0 + Ls * 0.36, top, x0 + Ls * 0.36, y0 + Hs * 0.1);
      S.balloon('8', x0 + Ls * 0.86 + 12, top, x0 + Ls * 0.86, yT + cm * 0.5);
      S.balloon('10', (xL + x0 - ts) / 2 - 4, top, (xL + x0 - ts) / 2, byT - 4);
      S.balloon('2', x0 + Ls + ts / 2 + 18, top, x0 + Ls + ts / 2, yT + 3);
      S.balloon('3', xL - 18, y0 + Hs * 0.36, xL + 2, y0 + Hs * 0.36);
      if (N > 1) { const yk = ys(kMid); S.balloon('7', xL - 18, yk + (yk > y0 + Hs * 0.55 ? -26 : 26), (xL + x0 - ts) / 2, yk); }
      S.balloon('4', xR + 34, y0 + Hs * 0.86, xR - 3, y0 + Hs * 0.86);
      S.balloon('5', xin - 16, yIn + 40, xin + 4, yIn);
      S.balloon('6', lay.outletFront ? xout - 16 : xout + 16, yOut + 34, lay.outletFront ? xout + 4 : xout - 4, yOut);
      S.balloon('9', xR + 30, yt + th / 2 + 2, x0 + Ls + ts + 4, yt + th / 2);
      S.balloon('1', xs0 + Dcs + 64, y0 + Hs * 0.36, xs0 + Dcs * 0.5, y0 + Hs * 0.36);
    }
    return { svg: S.out.join(''), W: VW, H: VH, scale: s };
  }

  /* ---- Vista: feixe e aleta (detalhes B e C) ------------------------------------------- */
  function bundle(r, o = {}) {
    const S = SB(o.paper, o.small), T = S.T, d = r.d, g = r.g, id = 'hx' + (++seq);
    // Detalhe B: arranjo alternado
    const cols = clamp(r.rows, 1, 4), rowsShown = 3;
    const wmm = (cols - 1) * g.Pl + g.Df, hmm = (rowsShown - 1) * g.Pt + g.Pt * (cols > 1 ? 0.5 : 0) + g.Df;
    const BX0 = 70, BX1 = 330, BY0 = 70, BY1 = 400;
    const s = Math.min((BX1 - BX0) / wmm, (BY1 - BY0) / hmm, 4.2);
    const ox0 = BX0 + ((BX1 - BX0) - wmm * s) / 2 + g.Df / 2 * s, oy0 = BY0 + ((BY1 - BY0) - hmm * s) / 2 + g.Df / 2 * s;
    S.raw(`<defs><linearGradient id="${id}-fl" gradientUnits="userSpaceOnUse" x1="${BX0 - 40}" y1="0" x2="${BX1 + 40}" y2="0"><stop offset="0" class="hx-stop-hot-s"/><stop offset="1" class="hx-stop-cold-s"/></linearGradient></defs>`);
    const centers = [];
    for (let j = 0; j < cols; j++) {
      const odd = j % 2 === 1;
      for (let i = 0; i < rowsShown - (odd ? 1 : 0); i++) centers.push([ox0 + j * g.Pl * s, oy0 + (i + (odd ? 0.5 : 0)) * g.Pt * s, j, i]);
    }
    // escoamento: linhas de corrente que contornam os tubos (ar quente → ar frio)
    const yRow = i => oy0 + i * g.Pt * s;
    const streams = [];
    for (const k of [0, 1]) {
      const yStart = yRow(k + 0.5);
      const pts = [[BX0 - 30, yStart], [ox0 - g.Df / 2 * s - 4, yStart], [ox0, yStart]];
      for (let j = 1; j < cols; j++) {
        const x = ox0 + j * g.Pl * s;
        const yy = j % 2 === 1 ? yRow(k === 0 ? 0 : 2) : yStart;
        pts.push([x - g.Pl * s * 0.5, (pts[pts.length - 1][1] + yy) / 2], [x, yy]);
      }
      const yEnd = pts[pts.length - 1][1];
      pts.push([BX1 + 22, yEnd], [BX1 + 40, yEnd]);
      streams.push(pts);
      S.path(smooth(pts), 'hx-airflow hx-flow', { a: { stroke: `url(#${id}-fl)` } });
      S.head(BX1 + 46, yEnd, 0, 7, 'hx-ah-cold');
    }
    S.part('1', () => {
      for (const [cx, cy] of centers) {
        S.circle(cx, cy, g.Df / 2 * s, 'hx-fin hx-fin-big');
        S.circle(cx, cy, g.Dr / 2 * s, 'hx-fin-root');
      }
    });
    S.part('11', () => {
      for (const [cx, cy] of centers) {
        S.circle(cx, cy, d.tubeOD / 2 * s, 'hx-tube');
        S.circle(cx, cy, d.tubeID / 2 * s, 'hx-bore');
      }
    });
    for (const [cx, cy] of centers) { S.line(cx - g.Df / 2 * s - 6, cy, cx + g.Df / 2 * s + 6, cy, 'hx-center'); S.line(cx, cy - g.Df / 2 * s - 6, cx, cy + g.Df / 2 * s + 6, 'hx-center'); }
    // cotas Pt, Pl, Df, Do
    const c00 = centers.find(c => c[2] === 0 && c[3] === 0), c01 = centers.find(c => c[2] === 0 && c[3] === 1);
    const c10 = centers.find(c => c[2] === 1 && c[3] === 0);
    if (c00 && c01) S.dimV(BX0 - 44, c00[1], c01[1], `Pt ${fmt(g.Pt, 2)}`, { from1: c00[0], from2: c01[0], left: true });
    if (c00 && c10) S.dimH(c00[0], c10[0], BY0 - 22, `Pl ${fmt(g.Pl, 2)}`, { from1: c00[1] - g.Df / 2 * s, from2: c10[1] - g.Df / 2 * s });
    const cl = centers[centers.length - 1];
    if (cl) {
      S.dimH(cl[0] - g.Df / 2 * s, cl[0] + g.Df / 2 * s, cl[1] + g.Df / 2 * s + 20, `Ø ${fmt(g.Df, 1)}`, { from1: cl[1], from2: cl[1], below: true });
      S.dimV(cl[0] + g.Df / 2 * s + 18, cl[1] - d.tubeOD / 2 * s, cl[1] + d.tubeOD / 2 * s, `Ø ${fmt(d.tubeOD, 2)}`, { from1: cl[0], from2: cl[0] });
    }
    // seção livre mínima (passagem mais estreita)
    if (c00 && c01) {
      const gapT = g.gapT, yA = c00[1] + g.Dr / 2 * s, x = c00[0];
      if (gapT > 0 && (c10 ? g.gapD / 2 >= gapT : true)) {
        S.line(x, yA, x, yA + gapT * s, 'hx-free');
        S.text(x - 8, yA + gapT * s / 2 - 8, T(`livre ${fmt(gapT, 1)}`), 'hx-dim-t', { anchor: 'end' });
      }
    }
    const st0 = streams[0], st1 = streams[1];
    S.tag(BX0 + 2, st1[0][1] + 24, `${fmt(r.Th)} °C`, 'hot');
    S.tag(BX1 + 14, st0[st0.length - 1][1] - 22, `${fmt(r.Tc)} °C`, 'cold');
    S.text((BX0 + BX1) / 2, 450, T(`Detalhe B · tubos alternados${cols < r.rows ? ` (${cols} de ${r.rows} fileiras)` : ''}`), 'hx-ttl', { anchor: 'middle' });

    // Detalhe C: corte longitudinal da aleta L
    const CX0 = 470, CX1 = 690, CY1 = 404;
    const pitch = g.pitchMM, nfin = 7;
    const sc = Math.min((CX1 - CX0) / (nfin * pitch), (CY1 - 96) / (g.Df / 2 + 2), 16);
    const yAx = CY1, rO = d.tubeOD / 2 * sc, rI = d.tubeID / 2 * sc, rT = g.Df / 2 * sc, tt = Math.max(1.4, g.t * sc);
    const xa = CX0, xb = CX0 + nfin * pitch * sc;
    S.line(xa - 16, yAx, xb + 16, yAx, 'hx-center');
    S.text(xa - 18, yAx + 4, T('eixo'), 'hx-t2', { anchor: 'end' });
    S.rect(xa, yAx - rI, xb - xa, rI, 'hx-bore');
    S.part('11', () => {
      S.rect(xa, yAx - rO, xb - xa, rO - rI, 'hx-cu-sec');
      S.hatch(xa, yAx - rO, xb - xa, rO - rI, 5, 'hx-hatch-cu');
    });
    S.part('12', () => {
      for (let k = 0; k < nfin; k++) {
        const x = xa + (k + 0.5) * pitch * sc - tt / 2;
        S.rect(x, yAx - rT, tt, rT - rO - tt, 'hx-fin-sec');
        S.rect(x, yAx - rO - tt, pitch * sc * 0.92, tt, 'hx-fin-sec');
      }
    });
    S.breakV(xa, yAx - rT - 8, yAx + 6); S.breakV(xb, yAx - rT - 8, yAx + 6);
    // cotas da aleta
    const xk = xa + 2.5 * pitch * sc, xk2 = xk + pitch * sc;
    S.dimH(xk, xk2, yAx - rT - 18, `passo ${fmt(pitch, 2)}`, { from1: yAx - rT, from2: yAx - rT });
    const xr = xb + 26;
    S.dimV(xr, yAx - rT, yAx, `Ø ${fmt(g.Df, 1)}`, { from1: xb, from2: xb });
    S.dimV(xr + 26, yAx - rO, yAx, `Ø ${fmt(d.tubeOD, 2)}`, { from1: xb, from2: xb });
    S.dimV(xr + 52, yAx - rI, yAx, `Ø ${fmt(d.tubeID, 2)}`, { from1: xb, from2: xb });
    S.dimV(xa - 22, yAx - rT, yAx - rO - tt, `h ${fmt(g.hf, 1)}`, { from1: xa + 0.5 * pitch * sc, from2: xa + 0.5 * pitch * sc, left: true });
    const xt = xa + 4.5 * pitch * sc;
    S.line(xt, yAx - rT * 0.62, xt + 34, yAx - rT * 0.62 - 26, 'hx-leader');
    S.text(xt + 37, yAx - rT * 0.62 - 28, `e = ${fmt(g.t, 2)}`, 'hx-dim-t');
    S.text((xa + xb) / 2, yAx - rI / 2 + 4, T('água'), 'hx-t2', { anchor: 'middle' });
    S.text((CX0 + CX1 + 60) / 2, 450, T('Detalhe C · corte da aleta L'), 'hx-ttl', { anchor: 'middle' });
    if (o.balloons !== false) {
      const cb = centers.find(c => c[2] === 0 && c[3] === 2) || centers[0];
      const ct = c10 || centers[0];
      S.balloon('1', cb[0] - g.Df / 2 * s - 22, cb[1] + g.Df / 2 * s + 10, cb[0] - g.Df / 2 * s * 0.72, cb[1] + g.Df / 2 * s * 0.6);
      S.balloon('11', ct[0] + g.Df / 2 * s + 30, ct[1] + g.Pt * s * 0.5, ct[0] + d.tubeOD / 2 * s * 0.72, ct[1] + d.tubeOD / 2 * s * 0.72);
      S.balloon('12', xa + 6.5 * pitch * sc + 10, 70, xa + 6.5 * pitch * sc, yAx - rT * 0.8);
      S.balloon('11', xa + 1.2 * pitch * sc - 26, yAx - rO - 40, xa + 1.2 * pitch * sc, yAx - (rO + rI) / 2);
    }
    return { svg: S.out.join(''), W: VW, H: VH };
  }

  /* ---- Vista: passes de água ------------------------------------------------------------- */
  function passes(r, o = {}) {
    const S = SB(o.paper, o.small), T = S.T, d = r.d, g = r.g, lay = o.lay || layout(r), id = 'hx' + (++seq);
    const N = lay.N;
    const PX0 = 120, PX1 = 470, PY0 = 50, PY1 = 400, BW = 34;
    const x0 = PX0 + BW, x1 = PX1 - BW, Hs = PY1 - PY0, bandH = Hs / N;
    const yb = k => PY1 - k * bandH;                       // base do passe k (1 = embaixo)
    const tOf = k => d.waterIn + (k - 0.5) / N * r.waterRise;
    S.raw(fins(id, 3));
    // cabeçotes
    S.part('3', () => { S.path(`M${x0} ${PY0 - 8} H${PX0 + 10} Q${PX0} ${PY0 - 8} ${PX0} ${PY0 + 2} V${PY1 - 2} Q${PX0} ${PY1 + 8} ${PX0 + 10} ${PY1 + 8} H${x0} Z`, 'hx-steel'); });
    S.part('4', () => { S.path(`M${x1} ${PY0 - 8} H${PX1 - 10} Q${PX1} ${PY0 - 8} ${PX1} ${PY0 + 2} V${PY1 - 2} Q${PX1} ${PY1 + 8} ${PX1 - 10} ${PY1 + 8} H${x1} Z`, 'hx-steel'); });
    // faixas dos passes (rampa de um só tom: mais escuro = água mais quente)
    for (let k = 1; k <= N; k++) {
      const y = yb(k);
      S.rect(x0, y, x1 - x0, bandH, 'hx-band', { a: { 'fill-opacity': r2(0.07 + 0.26 * (k - 1) / Math.max(1, N - 1)) } });
    }
    S.rect(x0, PY0, x1 - x0, Hs, 'hx-outline');
    // divisórias
    S.part('7', () => {
      for (let k = 1; k < N; k++) {
        const y = yb(k);
        S.line(x0, y, x1, y, 'hx-pass-l');
        if (k % 2 === 1) S.line(PX0 + 2, y, x0, y, 'hx-divider');
        else S.line(x1, y, PX1 - 2, y, 'hx-divider');
      }
    });
    // setas em cada passe e viradas nos cabeçotes
    const labelEvery = N > 14 ? Math.ceil(N / 7) : 1;
    for (let k = 1; k <= N; k++) {
      const yc = yb(k) + bandH / 2, toRight = k % 2 === 1;
      const xa = toRight ? x0 + 14 : x1 - 14, xz = toRight ? x1 - 14 : x0 + 14;
      S.flow([[xa, yc], [xz, yc]], 'water', { size: Math.min(7, bandH * 0.45) });
      if (bandH >= 14 && (k === 1 || k === N || (k - 1) % labelEvery === 0)) S.text((x0 + x1) / 2, yc - Math.min(6, bandH * 0.18), T(`passe ${k} · ${fmt(tOf(k), 1)} °C`), 'hx-t hx-on-band', { anchor: 'middle' });
      if (k < N) {
        const ycn = yc - bandH, ry = bandH / 2, rx = Math.min(ry, BW - 12);
        if (toRight) S.path(`M${r2(x1 - 10)} ${r2(yc)} H${r2(x1 + 4)} A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(x1 + 4)} ${r2(ycn)} H${r2(x1 - 10)}`, 'hx-turn');
        else S.path(`M${r2(x0 + 10)} ${r2(yc)} H${r2(x0 - 4)} A${r2(rx)} ${r2(ry)} 0 0 1 ${r2(x0 - 4)} ${r2(ycn)} H${r2(x0 + 10)}`, 'hx-turn');
      }
    }
    // bocais
    const yIn = yb(1) + bandH / 2, yOut = yb(N) + bandH / 2;
    S.part('5', () => { S.rect(PX0 - 46, yIn - 6, 46, 12, 'hx-pipe'); S.rect(PX0 - 50, yIn - 11, 6, 22, 'hx-flange'); });
    S.flow([[PX0 - 92, yIn], [PX0 - 56, yIn]], 'water', { anim: false });
    S.tag(PX0 - 76, yIn + 22, `${fmt(d.waterIn)} °C`, 'water');
    S.part('6', () => {
      if (lay.outletFront) { S.rect(PX0 - 46, yOut - 6, 46, 12, 'hx-pipe'); S.rect(PX0 - 50, yOut - 11, 6, 22, 'hx-flange'); }
      else { S.rect(PX1, yOut - 6, 40, 12, 'hx-pipe'); S.rect(PX1 + 38, yOut - 11, 6, 22, 'hx-flange'); }
    });
    if (lay.outletFront) { S.flow([[PX0 - 56, yOut], [PX0 - 92, yOut]], 'water', { anim: false }); S.tag(PX0 - 76, yOut - 22, `${fmt(r.waterOut)} °C`, 'calc'); }
    else { S.flow([[PX1 + 50, yOut], [PX1 + 84, yOut]], 'water', { anim: false }); S.tag(PX1 + 58, yOut - 22, `${fmt(r.waterOut)} °C`, 'calc'); }
    S.part('10', () => { for (const xc of [PX0 + BW / 2, PX1 - BW / 2]) { S.rect(xc - 3, PY0 - 14, 6, 6, 'hx-flange'); S.rect(xc - 3, PY1 + 8, 6, 6, 'hx-flange'); } });
    S.text((PX0 + PX1) / 2, 450, T(`Caminho da água · ${N} ${N === 1 ? 'passe' : 'passes'} empilhados na face`), 'hx-ttl', { anchor: 'middle' });

    // espelhos vistos de dentro dos cabeçotes: furos e câmaras
    const sheetView = (xc, front, title) => {
      const hmm = r.npr * g.Pt, wmm = (r.rows - 1) * g.Pl + g.Df;
      const k = Math.min(Hs / hmm, 70 / wmm);
      const w = wmm * k, h = hmm * k, xl = xc - w / 2;
      S.rect(xl - 8, PY0 - 6, w + 16, Hs + 12, 'hx-steel-2', { rx: 6 });
      for (let j = 0; j < r.rows; j++) {
        const odd = j % 2 === 1, n = r.npr - (odd ? 1 : 0), cx = xl + (g.Df / 2 + j * g.Pl) * k;
        for (let i = 0; i < n; i++) S.circle(cx, PY0 + (Hs - h) / 2 + (i + 0.5 + (odd ? 0.5 : 0)) * g.Pt * k, Math.max(0.8, d.tubeOD / 2 * k), 'hx-hole');
      }
      for (let kk = 1; kk < N; kk++) {
        if ((kk % 2 === 1) !== front) continue;
        const y = PY1 - kk * bandH;
        S.line(xl - 8, y, xl + w + 8, y, 'hx-divider');
      }
      S.text(xc, PY0 - 16, T(title), 'hx-t2', { anchor: 'middle' });
    };
    const sx = lay.outletFront ? 586 : 630;
    S.part('3', () => sheetView(sx, true, 'lado dos bocais'));
    S.part('4', () => sheetView(sx + 122, false, 'lado do retorno'));
    S.text(sx + 61, 450, T('Espelhos vistos de dentro'), 'hx-ttl', { anchor: 'middle' });
    if (o.balloons !== false) {
      S.balloon('3', PX0 + BW / 2, 24, PX0 + BW / 2, PY0);
      S.balloon('4', PX1 - BW / 2, 24, PX1 - BW / 2, PY0);
      S.balloon('7', PX1 + 40, PY0 + bandH * 1.0 + 30, x1 + 2, yb(N - 1));
      S.balloon('5', PX0 - 34, yIn + 46, PX0 - 30, yIn + 6);
      if (lay.outletFront) S.balloon('6', PX0 - 34, yOut - 44, PX0 - 30, yOut - 6);
      else S.balloon('6', PX1 + 24, yOut + 38, PX1 + 20, yOut + 6);
      S.balloon('10', PX0 + BW / 2 + 28, PY1 + 22, PX0 + BW / 2 + 3, PY1 + 11);
    }
    return { svg: S.out.join(''), W: VW, H: VH };
  }

  /* ---- Figura pequena para o formulário (superfície de referência) ------------------------ */
  function finFigure(v) {
    const S = SB(false), id = 'hx' + (++seq);
    const Do = v.tubeOD, Di = v.tubeID, Df = v.finOD, Pt = v.Pt, Pl = v.Pl, t = v.finThk, fpi = v.fpi;
    const ok = [Do, Di, Df, Pt, Pl, t, fpi].every(x => isNum(x) && x > 0) && Df > Do && Di < Do;
    if (!ok) return null;
    // arranjo: dois tubos na 1ª fileira e um na 2ª
    const W = 360, H = 150;
    const k = Math.min(118 / (Pt + Df), 150 / (Pl + Df + 30));
    const cxA = 34 + Df / 2 * k, cyA = 18 + Df / 2 * k, cyB = cyA + Pt * k, cxC = cxA + Pl * k, cyC = cyA + Pt * k / 2;
    S.g({ class: 'ff-geo' });
    for (const [cx, cy] of [[cxA, cyA], [cxA, cyB], [cxC, cyC]]) {
      S.g({ 'data-key': 'finOD' }); S.circle(cx, cy, Df / 2 * k, 'hx-fin hx-fin-big'); S.end();
      S.g({ 'data-key': 'tubeOD' }); S.circle(cx, cy, Do / 2 * k, 'hx-tube'); S.end();
      S.g({ 'data-key': 'tubeID' }); S.circle(cx, cy, Di / 2 * k, 'hx-bore'); S.end();
    }
    S.end();
    S.g({ 'data-key': 'Pt', class: 'ff-dim' }); S.dimV(cxA - Df / 2 * k - 12, cyA, cyB, 'Pt', { left: true, from1: cxA - 4, from2: cxA - 4 }); S.end();
    S.g({ 'data-key': 'Pl', class: 'ff-dim' }); S.dimH(cxA, cxC, cyB + Df / 2 * k + 13, 'Pl', { from1: cyB, from2: cyC, below: false }); S.end();
    S.g({ 'data-key': 'finOD', class: 'ff-dim' }); S.dimH(cxC - Df / 2 * k, cxC + Df / 2 * k, cyC - Df / 2 * k - 10, 'Df', { from1: cyC, from2: cyC }); S.end();
    S.g({ 'data-key': 'tubeOD', class: 'ff-dim' }); S.line(cxC + Do / 2 * k * 0.7, cyC + Do / 2 * k * 0.7, cxC + Df / 2 * k + 16, cyC + Df / 2 * k + 6, 'hx-leader'); S.text(cxC + Df / 2 * k + 18, cyC + Df / 2 * k + 10, 'Do', 'hx-dim-t'); S.end();
    S.g({ 'data-key': 'tubeID', class: 'ff-dim' }); S.line(cxA + Di / 2 * k * 0.5, cyB - Di / 2 * k * 0.3, cxA + Df / 2 * k + 14, cyB - 4, 'hx-leader'); S.text(cxA + Df / 2 * k + 16, cyB - 1, 'Di', 'hx-dim-t'); S.end();
    // perfil da aleta: 4 aletas sobre a parede do tubo
    const ax = 226, ay = 128, pitch = 25.4 / fpi;
    const kk = Math.min(20, 104 / (4 * pitch), 92 / ((Df - Do) / 2 + 1));
    const hfin = (Df - Do) / 2 * kk, tt = Math.max(1.5, t * kk);
    S.g({ 'data-key': 'tubeMaterial' }); S.rect(ax, ay, 4 * pitch * kk + 10, 10, 'hx-cu-sec'); S.hatch(ax, ay, 4 * pitch * kk + 10, 10, 5, 'hx-hatch-cu'); S.end();
    S.g({ 'data-key': 'contactR', class: 'ff-contact' }); S.line(ax, ay, ax + 4 * pitch * kk + 10, ay, 'ff-contact-l'); S.end();
    S.g({ 'data-key': 'finK' });
    for (let i = 0; i < 4; i++) {
      const x = ax + 5 + i * pitch * kk;
      S.rect(x, ay - hfin, tt, hfin - tt, 'hx-fin-sec');
      S.rect(x, ay - tt, pitch * kk * 0.9, tt, 'hx-fin-sec');
    }
    S.end();
    const x1 = ax + 5 + pitch * kk, x2 = x1 + pitch * kk;
    S.g({ 'data-key': 'fpi', class: 'ff-dim' }); S.dimH(x1, x2, ay - hfin - 12, 'passo', { from1: ay - hfin, from2: ay - hfin }); S.end();
    S.g({ 'data-key': 'finThk', class: 'ff-dim' }); S.line(ax + 5 + 3 * pitch * kk + tt, ay - hfin * 0.55, ax + 5 + 3 * pitch * kk + 22, ay - hfin * 0.55 - 16, 'hx-leader'); S.text(ax + 5 + 3 * pitch * kk + 24, ay - hfin * 0.55 - 18, 't', 'hx-dim-t'); S.end();
    return `<svg class="hxv ff" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tubo aletado: diâmetros, passos e perfil da aleta">${S.out.join('')}</svg>`;
  }

  /* ---- Estilo de papel (folha A3) ----------------------------------------------------------- */
  const PAPER_CSS = `
.hxs text{font-family:Arial,Helvetica,sans-serif;fill:#111}
.hxs .hx-t{font-size:8.6px}.hxs .hx-t2{font-size:7.6px;fill:#333}.hxs .hx-strong{font-weight:700}.hxs .hx-ttl{font-size:9.5px;font-weight:700;text-decoration:underline}
.hxs .hx-dim-t{font-size:8.2px}.hxs .hx-bal-t{font-size:8.2px;font-weight:700}.hxs .hx-tag-t{font-size:7.6px;font-weight:700}.hxs .hx-cut-t{font-size:10px;font-weight:700}
.hxs .hx-gap,.hxs .hx-zone-hot,.hxs .hx-zone-cold,.hxs .hx-airband{fill:none}
.hxs .hx-steel{fill:#ececec;stroke:#111;stroke-width:.8}.hxs .hx-steel-2{fill:#d6d6d6;stroke:#111;stroke-width:.8}.hxs .hx-steel-cut{fill:#fff;stroke:#111;stroke-width:.8}
.hxs .hx-hatch{stroke:#111;stroke-width:.35}.hxs .hx-hatch-cu{stroke:#111;stroke-width:.35}
.hxs .hx-face-bg{fill:#fff}.hxs .hx-fin-bg{fill:#fff}.hxs .hx-fin-l{stroke:#9a9a9a;stroke-width:.35}.hxs .hx-tube-l{stroke:#111;stroke-width:.45}.hxs .hx-outline{fill:none;stroke:#111;stroke-width:.9}
.hxs .hx-fin{fill:#f2f2f2;stroke:#111;stroke-width:.4}.hxs .hx-fin-root{fill:none;stroke:#111;stroke-width:.3}.hxs .hx-tube{fill:#bdbdbd;stroke:#111;stroke-width:.45}.hxs .hx-bore{fill:#fff;stroke:#111;stroke-width:.35}
.hxs .hx-cu-sec{fill:#fff;stroke:#111;stroke-width:.6}.hxs .hx-fin-sec{fill:#d9d9d9;stroke:#111;stroke-width:.35}
.hxs .hx-pipe{fill:#e3e3e3;stroke:#111;stroke-width:.7}.hxs .hx-flange{fill:#bdbdbd;stroke:#111;stroke-width:.6}.hxs .hx-flange-l{stroke:#111;stroke-width:.35}
.hxs .hx-tray{fill:none;stroke:#111;stroke-width:.9}.hxs .hx-drain{stroke:#111;stroke-width:.7}
.hxs .hx-hidden{stroke:#111;stroke-width:.5;stroke-dasharray:3 2}.hxs .hx-center{stroke:#111;stroke-width:.35;stroke-dasharray:8 2 2 2}
.hxs .hx-cut{stroke:#111;stroke-width:.6;stroke-dasharray:10 2 2 2}.hxs .hx-cut-a{stroke:#111;stroke-width:1.4}
.hxs .hx-dim,.hxs .hx-ext{stroke:#111;stroke-width:.4}.hxs .hx-ah{fill:#111}
.hxs .hx-air{fill:none;stroke:#111;stroke-width:.9}.hxs .hx-thin{stroke-width:.5;stroke-dasharray:3 2}.hxs .hx-airflow{fill:none;stroke:#111;stroke-width:.9}
.hxs .hx-ah-hot,.hxs .hx-ah-cold,.hxs .hx-ah-water,.hxs .hx-ah-oil{fill:#111}
.hxs .hx-ox{fill:none;stroke:#111;stroke-width:.6}
.hxs .hx-tag{fill:#fff;stroke:#111;stroke-width:.5}
.hxs .hx-bal-c{fill:#fff;stroke:#111;stroke-width:.7}.hxs .hx-leader{stroke:#111;stroke-width:.4}.hxs .hx-bal-dot{fill:#111}
.hxs .hx-band{fill:#000}.hxs .hx-pass-l{stroke:#111;stroke-width:.35}.hxs .hx-divider{stroke:#111;stroke-width:1.6}.hxs .hx-turn{fill:none;stroke:#111;stroke-width:.6;stroke-dasharray:2 2}
.hxs .hx-hole{fill:#fff;stroke:#111;stroke-width:.3}.hxs .hx-break{fill:none;stroke:#111;stroke-width:.5}.hxs .hx-free{stroke:#111;stroke-width:1.2}
.hxs .hx-on-band{font-size:7.4px}
.hxs .k-small .hx-t,.hxs .k-small .hx-on-band{font-size:12.5px}.hxs .k-small .hx-t2{font-size:11.5px}.hxs .k-small .hx-ttl{font-size:14px}.hxs .k-small .hx-dim-t{font-size:12.5px}.hxs .k-small .hx-bal-t{font-size:12px}.hxs .k-small .hx-tag-t{font-size:11.5px}
.hxs .k-small .hx-bal-c{stroke-width:1.1}.hxs .k-small .hx-dim,.hxs .k-small .hx-ext{stroke-width:.7}
.hxs .hx-stop-hot,.hxs .hx-stop-cold,.hxs .hx-stop-hot-s,.hxs .hx-stop-cold-s{stop-color:#111;stop-opacity:1}`;

  /* ---- Folha A3 de referência ----------------------------------------------------------------- */
  function sheet(r, info = {}, partsList) {
    const W = 1260, H = 891, lay = layout(r), d = r.d, P = partsList || parts(r, lay);
    const S = SB(true);
    const L = (x1, y1, x2, y2, w = 0.6) => S.raw(`<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="#111" stroke-width="${w}"/>`);
    const R = (x, y, w, h, sw = 0.6) => S.raw(`<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="none" stroke="#111" stroke-width="${sw}"/>`);
    const Tx = (x, y, t, o = {}) => S.raw(`<text x="${r2(x)}" y="${r2(y)}" font-family="Arial, Helvetica, sans-serif" font-size="${o.size ?? 7.6}" font-weight="${o.bold ? 700 : 400}" text-anchor="${o.anchor || 'start'}" fill="#111">${esc(t)}</text>`);
    const place = (v, x, y, k, cls = '') => S.raw(`<g class="${cls}" transform="translate(${r2(x)} ${r2(y)}) scale(${r2(k)})">${v.svg}</g>`);
    const fit = (t, w, size, upper = false) => {
      const cw = size * (upper ? 0.66 : 0.5), n = Math.floor(w / cw);
      t = String(t);
      return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t;
    };
    S.raw(`<rect width="${W}" height="${H}" fill="#fff"/>`);
    R(12, 12, W - 24, H - 24, 1.6);
    // vistas
    place(assembly(r, { paper: true, lay }), 18, 22, 1);
    place(bundle(r, { paper: true, lay, small: true }), 18, 492, 0.52, 'k-small');
    place(passes(r, { paper: true, lay, small: true }), 428, 492, 0.52, 'k-small');
    // lista de itens
    const lx = 846, lw = W - 12 - 10 - lx, ly = 24;
    const items = P.filter(p => /^\d+$/.test(p.id));
    const rh = 19;
    R(lx, ly, lw, rh * (items.length + 2), 1.1);
    Tx(lx + lw / 2, ly + 12.5, 'LISTA DE ITENS (POR UNIDADE)', { anchor: 'middle', bold: true, size: 8.5 });
    L(lx, ly + rh, lx + lw, ly + rh, 0.6);
    const cI = [lx, lx + 30, lx + 190, lx + lw];
    Tx(cI[0] + 15, ly + rh + 12.5, 'ITEM', { anchor: 'middle', bold: true, size: 6.8 });
    Tx(cI[1] + 4, ly + rh + 12.5, 'DESCRIÇÃO', { bold: true, size: 6.8 });
    Tx(cI[2] + 4, ly + rh + 12.5, 'DADOS', { bold: true, size: 6.8 });
    items.forEach((p, i) => {
      const y = ly + rh * (i + 2);
      L(lx, y, lx + lw, y, 0.4);
      Tx(cI[0] + 15, y + 12.5, p.id, { anchor: 'middle', bold: true, size: 7.4 });
      Tx(cI[1] + 4, y + 12.5, fit(p.name.toUpperCase(), cI[2] - cI[1] - 8, 6.4, true), { size: 6.4 });
      Tx(cI[2] + 4, y + 12.5, fit(p.data, cI[3] - cI[2] - 8, 6.1), { size: 6.1 });
    });
    L(cI[1], ly + rh, cI[1], ly + rh * (items.length + 2), 0.4);
    L(cI[2], ly + rh, cI[2], ly + rh * (items.length + 2), 0.4);
    // dados de projeto
    const dy0 = ly + rh * (items.length + 2) + 14;
    const rows = (r.rfq?.rows || []).map(x => x.c);
    const rh2 = 17.5;
    const cD = [lx, lx + 112, lx + 166, lx + 166 + (lw - 166) / 2, lx + lw];
    R(lx, dy0, lw, rh2 * (rows.length + 2), 1.1);
    Tx(lx + lw / 2, dy0 + 12, 'DADOS DE PROJETO (POR UNIDADE)', { anchor: 'middle', bold: true, size: 8.5 });
    L(lx, dy0 + rh2, lx + lw, dy0 + rh2, 0.6);
    [['', 0], ['UNID.', 1], ['AR (EXTERNO)', 2], ['ÁGUA (INTERNO)', 3]].forEach(([t, i]) => Tx(cD[i] + 4, dy0 + rh2 + 12, t, { bold: true, size: 6.6 }));
    rows.forEach((c, i) => {
      const y = dy0 + rh2 * (i + 2);
      L(lx, y, lx + lw, y, 0.4);
      const key = i >= rows.length - 3;
      Tx(cD[0] + 4, y + 11.8, fit(c[0].toUpperCase(), cD[1] - cD[0] - 6, 5.7, true), { size: 5.7 });
      Tx(cD[1] + 3, y + 11.8, fit(c[1], cD[2] - cD[1] - 5, 5.6), { size: 5.6 });
      Tx(cD[2] + 4, y + 11.8, fit(c[2], cD[3] - cD[2] - 6, key ? 6.2 : 5.9), { size: key ? 6.2 : 5.9, bold: key });
      Tx(cD[3] + 4, y + 11.8, fit(c[3], cD[4] - cD[3] - 6, key ? 6.2 : 5.9), { size: key ? 6.2 : 5.9, bold: key });
    });
    [cD[1], cD[2], cD[3]].forEach(x => L(x, dy0 + rh2, x, dy0 + rh2 * (rows.length + 2), 0.4));
    // notas
    const ny = 740;
    Tx(24, ny, 'NOTAS:', { bold: true, size: 7.8 });
    [
      '1. Arranjo de referência para cotação: o fornecedor define o projeto mecânico e garante a capacidade da tabela de dados.',
      `2. Cotas em mm. Face, feixe, tubos, aletas e passes vêm do cálculo; espelho, cabeçotes, bocais (DN ${lay.dn}) e bandeja são indicativos.`,
      `3. Área mínima ${f0(Math.ceil(r.areaMin))} m² no total (${r.modules} × ${f0(Math.ceil(r.areaMinUnit))} m²), já com incrustação; U de referência ≈ ${f0(r.U)} W/m²K.`,
      `4. Ar: ${fmt(r.Th)} → ${fmt(r.Tc)} °C. Água: ${fmt(d.waterIn)} → ${fmt(r.waterOut)} °C, ${fmt(r.qvWh, 2)} m³/h no total. Vazão de ar em massa (kg/h).`,
      '5. Bandeja com dreno para fora da máquina e ponto para detector de vazamento; cabeçotes removíveis para limpeza dos tubos.'
    ].forEach((t, i) => Tx(24, ny + 12 * (i + 1), t, { size: 7.1 }));
    // carimbo (mesmo do laboratório elétrico)
    {
      const x0 = 790, y0 = 780, x1 = W - 12, y1 = H - 12;
      const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
      R(x0, y0, x1 - x0, y1 - y0, 1.1);
      const col = [x0, x0 + 96, x0 + 300, x1 - 64, x1];
      const rows2 = [y0, y0 + 20, y0 + 40, y0 + 58, y0 + 79, y1];
      rows2.slice(1, -1).forEach(y => L(x0 + (y === rows2[1] || y === rows2[2] ? 96 : 0), y, x1, y, 0.5));
      L(col[1], y0, col[1], rows2[3], 0.5);
      Tx(x0 + 48, y0 + 22, 'VG.', { anchor: 'middle', size: 18, bold: true });
      Tx(x0 + 48, y0 + 33, 'Laboratório térmico', { anchor: 'middle', size: 6 });
      const cell = (x, y, label, value, o = {}) => { Tx(x + 3, y + 7, label, { size: 5.6 }); Tx(o.center ? x + (o.w || 0) / 2 : x + 8, y + 16.5, value, { size: o.size ?? 8.5, bold: o.bold, anchor: o.center ? 'middle' : 'start' }); };
      cell(col[1], y0, 'CLIENTE :', info.cliente || '—');
      L(col[3], y0 + 20, col[3], y0 + 40, 0.5);
      cell(col[1], y0 + 20, 'EQUIPAMENTO :', info.equipamento || '—');
      cell(col[3], y0 + 20, 'O.S. :', info.os || '—');
      cell(x0, y0 + 40, 'TÍTULO :', 'ARRANJO DE REFERÊNCIA · TROCADOR AR–ÁGUA (IC81)', { center: true, w: x1 - x0, bold: true, size: 9 });
      const c4 = [x0, x0 + 110, x0 + 220, x0 + 330, x1];
      c4.slice(1, -1).forEach(x => L(x, rows2[3], x, rows2[4], 0.5));
      cell(c4[0], rows2[3], 'ELABORADO :', info.elaborado || '—', { size: 7.5 });
      cell(c4[1], rows2[3], 'MÉTODO :', 'ε–NTU · L-fin', { size: 7.5 });
      cell(c4[2], rows2[3], 'TIPO DE DESENHO :', 'REFERÊNCIA', { size: 7.5 });
      cell(c4[3], rows2[3], 'DATA :', today, { size: 7.5 });
      const c5 = [x0, x0 + 60, x1 - 120, x1 - 60, x1];
      c5.slice(1, -1).forEach(x => L(x, rows2[4], x, y1, 0.5));
      cell(c5[0], rows2[4], 'ESCALA / FORMATO :', 'S/E · A3', { size: 8 });
      cell(c5[1], rows2[4], 'DESENHO Nº :', `DM-${info.os || 'XXXXX'}-TRC-001`, { size: 9, bold: true });
      cell(c5[2], rows2[4], 'REVISÃO :', '00', { size: 8 });
      cell(c5[3], rows2[4], 'FOLHA :', '1/1', { size: 8 });
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" class="hxs" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><style>${PAPER_CSS}</style>${S.out.join('')}</svg>`;
  }

  const VIEWS = [
    { id: 'maquina', label: 'Na máquina', short: 'Máquina', start: 'center', title: 'Circuito de ventilação IC81', draw: machine,
      caption: r => `Esquema fora de escala. O ar frio (${fmt(r.Tc)} °C) desce pelas pontas, passa ${r.fans === 1 ? 'pelo ventilador LA' : r.fans === 2 ? 'pelos ventiladores LA e LOA' : `pelos ${r.fans} ventiladores (LA, LOA e mais ${r.fans - 2})`}, resfria cabeças de bobina, rotor e estator e sai quente pelos dutos radiais (${fmt(r.Th)} °C). Sobe, atravessa o feixe do trocador e volta frio. Os mancais ficam fora do circuito de ar.` },
    { id: 'conjunto', label: 'Conjunto', short: 'Conjunto', start: 'left', title: 'Vista frontal e corte A–A · por unidade', draw: assembly,
      caption: r => `Em escala na vista e no corte. A face recebe o ar quente (⊗ = ar entrando no plano do desenho); a água entra embaixo e sai em cima depois de ${r.passes} ${r.passes === 1 ? 'passe' : 'passes'}. As divisórias aparecem tracejadas porque ficam dentro dos cabeçotes.` },
    { id: 'feixe', label: 'Feixe e aleta', short: 'Feixe', start: 'left', title: 'Detalhes B e C · superfície de troca', draw: bundle,
      caption: r => `Tubos alternados e aleta L ampliados. São as cotas do grupo “Superfície de referência”: elas dão a área por metro de tubo (${fmt(r.Ao_m, 3)} m²/m, ${fmt(r.areaFactor, 1)} vezes o tubo nu) e a seção livre para o ar.` },
    { id: 'passes', label: 'Passes de água', short: 'Passes', start: 'left', title: 'Caminho da água e câmaras dos cabeçotes', draw: passes,
      caption: r => `A água faz ${r.passes} ${r.passes === 1 ? 'passe' : 'passes'} de ${fmt(r.tpp, 1)} tubos, virando nos cabeçotes; quanto mais intenso o tom, mais quente a água. Velocidade ${fmt(r.waterVel, 2)} m/s, Δp ≈ ${fmt(r.tubeDp, 1)} kPa.` }
  ];

  window.VGThermalDrawing = { VIEWS, layout, parts, machine, assembly, bundle, passes, finFigure, sheet, VW, VH };
})();
