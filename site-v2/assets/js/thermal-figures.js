/* Laboratório térmico · figuras: circuito de ventilação IC81 e perfil de temperaturas no trocador. */
(() => {
  'use strict';
  const fx = (v, d = 1) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const f0 = v => fx(v, 0);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---- Circuito de ventilação ---------------------------------------------------
     Corte longitudinal esquemático: trocador no topo, carcaça, estator com dutos radiais,
     rotor, eixo, mancais e um ventilador logo depois de cada mancal (LA e LOA). */
  function circuitSVG(r) {
    const d = r.d, off = r.fans < 2;
    const ref = d.flowRef === 'cntp' ? ' CNTP' : '';
    const flow = v => `${fx(v, 2)} m³/s${ref}`;
    const ducts = [267, 305, 343, 381, 419, 457, 495].map(x => `<rect class="d-gap" x="${x}" y="163" width="6" height="58"/>`).join('');
    const label = `Circuito de ventilação: ${r.fans} ramo(s) de ${flow(r.flowPerFan)}, ar frio ${fx(r.Tc)} °C, ar quente ${fx(r.Th)} °C, água ${fx(d.waterIn)} a ${fx(r.waterOut)} °C.`;
    return `
<svg class="dg" viewBox="0 0 760 380" role="img" aria-label="${esc(label)}">
  <defs>
    <marker id="tmk-cold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-mk-cold"/></marker>
    <marker id="tmk-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-mk-hot"/></marker>
    <marker id="tmk-water" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-mk-water"/></marker>
    <marker id="tmk-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-mk-ink"/></marker>
  </defs>
  <rect class="d-cooler" x="110" y="26" width="540" height="70" rx="8"/>
  <line class="d-tube" x1="126" y1="38" x2="634" y2="38"/>
  <line class="d-tube" x1="126" y1="84" x2="634" y2="84"/>
  <text class="d-t d-strong" x="380" y="56" text-anchor="middle">Trocador ar–água · ${r.modules} unid. · área mín. ${f0(r.areaMin)} m²</text>
  <text class="d-t d-muted d-mono d-small" x="380" y="74" text-anchor="middle">${fx(r.qDesign)} kW · ${fx(r.flowTotal, 2)} m³/s${ref} · ${fx(r.mMoist, 2)} kg/s de ar</text>
  <line class="d-water" x1="748" y1="46" x2="654" y2="46" marker-end="url(#tmk-water)"/>
  <line class="d-water" x1="654" y1="78" x2="748" y2="78" marker-end="url(#tmk-water)"/>
  <text class="d-t d-muted d-small" x="701" y="38" text-anchor="middle">água entra</text>
  <text class="d-t d-mono d-strong" x="701" y="62" text-anchor="middle">${fx(d.waterIn)} °C</text>
  <text class="d-t d-mono d-strong d-calc" x="701" y="94" text-anchor="middle">${fx(r.waterOut)} °C</text>
  <text class="d-t d-muted d-small" x="701" y="108" text-anchor="middle">água sai</text>
  <text class="d-t d-mono d-small d-water-t" x="701" y="126" text-anchor="middle">${fx(r.qvWh, 2)} m³/h</text>
  <rect class="d-frame" x="90" y="140" width="580" height="190" rx="10"/>
  <rect class="d-stator" x="235" y="162" width="290" height="60" rx="3"/>
  <rect class="d-stator" x="235" y="278" width="290" height="44" rx="3"/>
  ${ducts}
  <line class="d-hot d-thin" x1="308" y1="224" x2="308" y2="166"/>
  <line class="d-hot d-thin" x1="384" y1="224" x2="384" y2="166"/>
  <line class="d-hot d-thin" x1="460" y1="224" x2="460" y2="166"/>
  <rect class="d-rotor" x="255" y="228" width="250" height="44" rx="3"/>
  <rect class="d-shaft" x="24" y="245" width="712" height="10" rx="3"/>
  <rect class="d-bearing" x="24" y="232" width="22" height="36" rx="3"/>
  <text class="d-t d-muted d-small" x="35" y="224" text-anchor="middle">acopl.</text>
  <rect class="d-bearing" x="98" y="234" width="22" height="32" rx="3"/>
  <rect class="d-bearing" x="640" y="234" width="22" height="32" rx="3"/>
  <line class="d-ink d-dash" x1="109" y1="268" x2="109" y2="296" marker-end="url(#tmk-ink)"/>
  <line class="d-ink d-dash" x1="651" y1="268" x2="651" y2="296" marker-end="url(#tmk-ink)"/>
  <text class="d-t d-muted d-small" x="100" y="314">mancal → óleo</text>
  <text class="d-t d-muted d-small" x="660" y="314" text-anchor="end">mancal → óleo</text>
  <g><rect class="d-fan" x="170" y="206" width="12" height="36" rx="3"/><rect class="d-fan" x="170" y="258" width="12" height="36" rx="3"/></g>
  <g class="${off ? 'd-off' : ''}"><rect class="d-fan" x="578" y="206" width="12" height="36" rx="3"/><rect class="d-fan" x="578" y="258" width="12" height="36" rx="3"/></g>
  <polyline class="d-cold" points="140,98 140,214 230,214" marker-end="url(#tmk-cold)"/>
  <polyline class="d-cold ${off ? 'd-off' : ''}" points="620,98 620,214 530,214" marker-end="url(#tmk-cold)"/>
  <line class="d-hot" x1="286" y1="160" x2="286" y2="101" marker-end="url(#tmk-hot)"/>
  <line class="d-hot" x1="474" y1="160" x2="474" y2="101" marker-end="url(#tmk-hot)"/>
  <text class="d-t d-mono d-strong d-cold-t" x="148" y="122">${fx(r.Tc)} °C</text>
  <text class="d-t d-mono d-strong d-cold-t ${off ? 'd-off' : ''}" x="612" y="122" text-anchor="end">${off ? '' : fx(r.Tc) + ' °C'}</text>
  <text class="d-t d-mono d-strong d-hot-t" x="380" y="118" text-anchor="middle">${fx(r.Th)} °C</text>
  <text class="d-t d-muted d-small" x="380" y="133" text-anchor="middle">ar quente · ΔT ${fx(r.dTair)} K</text>
  <text class="d-t d-small d-strong" x="380" y="303" text-anchor="middle">perdas no ar ${fx(r.qDesign)} kW</text>
  <text class="d-t d-strong" x="176" y="354" text-anchor="middle">LA · ${flow(r.flowPerFan)}</text>
  <text class="d-t d-strong ${off ? 'd-off' : ''}" x="584" y="354" text-anchor="middle">${off ? 'LOA · sem ventilador' : 'LOA · ' + flow(r.flowPerFan)}</text>
  <text class="d-t d-muted d-small" x="176" y="370" text-anchor="middle">ventilador · lado acoplado</text>
  <text class="d-t d-muted d-small ${off ? 'd-off' : ''}" x="584" y="370" text-anchor="middle">ventilador · lado oposto</text>
</svg>`;
  }

  /* ---- Perfil de temperaturas (contracorrente equivalente) ------------------------- */
  const PF = { W: 440, H: 238, x0: 40, x1: 402, y0: 14, y1: 194 };
  function profilePoints(r) {
    const Th = r.Th, Tc = r.Tc, Two = r.waterOut;
    const th0 = Th - Two, th1 = Tc - r.d.waterIn;
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const x = i / 60;
      let th, ta;
      if (Math.abs(th0 - th1) < 1e-6 || th0 <= 0 || th1 <= 0) { th = th0 + (th1 - th0) * x; ta = Th + (Tc - Th) * x; }
      else { th = th0 * Math.pow(th1 / th0, x); ta = Th - (Th - Tc) * (th0 - th) / (th0 - th1); }
      pts.push({ x, ta, tw: ta - th });
    }
    return pts;
  }
  function niceStep(range) { const raw = range / 5; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }
  function profileSVG(r) {
    if (!(Number.isFinite(r.Th) && Number.isFinite(r.waterOut) && r.Th > r.Tc)) return null;
    const pts = profilePoints(r);
    const lo = Math.min(r.d.waterIn, r.Tc) - 1, hi = Math.max(r.Th, r.waterOut) + 1;
    const step = niceStep(hi - lo);
    const yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step;
    const X = x => PF.x0 + x * (PF.x1 - PF.x0);
    const Y = t => PF.y1 - (t - yMin) / (yMax - yMin) * (PF.y1 - PF.y0);
    const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
    let s = '';
    for (let t = yMin; t <= yMax + 1e-9; t += step) {
      s += `<line class="pf-grid" x1="${PF.x0}" x2="${PF.x1}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>`;
      s += `<text class="pf-axis" x="${PF.x0 - 6}" y="${(Y(t) + 3).toFixed(1)}" text-anchor="end">${fx(t, step < 1 ? 1 : 0)}</text>`;
    }
    const air = pts.map(p => P(X(p.x), Y(p.ta))).join(' ');
    const water = pts.map(p => P(X(p.x), Y(p.tw))).join(' ');
    const band = air + ' ' + pts.slice().reverse().map(p => P(X(p.x), Y(p.tw))).join(' ');
    s += `<polygon class="pf-band" points="${band}"/>`;
    s += `<polyline class="pf-air" points="${air}"/>`;
    s += `<polyline class="pf-water" points="${water}"/>`;
    const a0 = pts[0], a1 = pts[pts.length - 1];
    s += `<text class="pf-lab pf-lab-air" x="${X(0) + 6}" y="${(Y(a0.ta) - 7).toFixed(1)}">ar ${fx(a0.ta)} °C</text>`;
    s += `<text class="pf-lab pf-lab-air" x="${X(1) + 5}" y="${(Y(a1.ta) + 4).toFixed(1)}">${fx(a1.ta)}</text>`;
    s += `<text class="pf-lab pf-lab-water" x="${X(0) + 6}" y="${(Y(a0.tw) + 15).toFixed(1)}">água ${fx(a0.tw)} °C</text>`;
    s += `<text class="pf-lab pf-lab-water" x="${X(1) + 5}" y="${(Y(a1.tw) + 4).toFixed(1)}">${fx(a1.tw)}</text>`;
    s += `<text class="pf-axis" x="${PF.x0}" y="${PF.y1 + 16}">entrada do ar</text>`;
    s += `<text class="pf-axis" x="${PF.x1}" y="${PF.y1 + 16}" text-anchor="end">saída do ar →</text>`;
    s += `<text class="pf-axis" x="${(PF.x0 + PF.x1) / 2}" y="${PF.y1 + 32}" text-anchor="middle">posição no sentido do ar · água em contracorrente</text>`;
    s += `<line class="pf-cross" x1="0" x2="0" y1="${PF.y0}" y2="${PF.y1}" visibility="hidden"/>`;
    s += `<circle class="pf-dot-air" r="4.5" cx="0" cy="0" visibility="hidden"/>`;
    s += `<circle class="pf-dot-water" r="4.5" cx="0" cy="0" visibility="hidden"/>`;
    const label = `Perfil de temperaturas: ar de ${fx(r.Th)} a ${fx(r.Tc)} °C, água de ${fx(r.d.waterIn)} a ${fx(r.waterOut)} °C.`;
    const svg = `<svg class="pf" viewBox="0 0 ${PF.W} ${PF.H}" role="img" aria-label="${esc(label)}">${s}</svg>`;
    return { svg, pts, X, Y };
  }

  window.VGThermalFigures = { circuitSVG, profileSVG, profilePoints, PF };
})();
