/*!
 * VG · Expressões matemáticas — árvore simples → MathML (tela/relatório) ou texto (cópia).
 * Sem dependências; usa VGEngine.fmt para números no padrão brasileiro.
 */
(function (raiz, fabrica) {
  const api = fabrica(raiz);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz) raiz.VGMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (raiz) {
  'use strict';
  const motor = () => (raiz && raiz.VGEngine) || (typeof require === 'function' ? require('./engine.js') : null);

  // ── Construtores ─────────────────────────────────────────────────────────
  /** Identificador com índice opcional: i('M','t') → Mₜ ; i('d','mín') */
  const i = (v, s = null, e = null) => ({ t: 'i', v, s, e });
  /** Número formatado (casas fixas) — c = 'auto' usa fmt_auto */
  const n = (v, c = 'auto') => ({ t: 'n', v, c });
  const o = v => ({ t: 'o', v });
  const r = (...c) => ({ t: 'r', c: c.flat().filter(Boolean) });
  const f = (num, den) => ({ t: 'f', n: num, d: den });
  const rt = (x, k = 2) => ({ t: 'rt', x, k });
  const p = x => ({ t: 'p', x });
  const sup = (b, e) => ({ t: 'sup', b, e });
  const tx = v => ({ t: 'tx', v });
  const u = v => ({ t: 'u', v });
  const sp = () => ({ t: 'sp' });
  /** Função: fn('sen', x) */
  const fn = (nome, x) => ({ t: 'fn', nome, x });

  // ── MathML ───────────────────────────────────────────────────────────────
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function num(no) {
    const E = motor();
    if (typeof no.v === 'string') return no.v;
    if (!Number.isFinite(no.v)) return '—';
    if (no.c === 'auto') return E.fmt_auto(no.v);
    if (no.c === 'sci') return E.fmt_sci(no.v, 3);
    return E.fmt(no.v, no.c);
  }
  function ml(no) {
    if (no === null || no === undefined) return '';
    if (typeof no === 'string') return `<mi>${esc(no)}</mi>`;
    switch (no.t) {
      case 'i': {
        const base = no.v.length > 1 && !/^[α-ωΑ-Ω]$/.test(no.v) ? `<mi mathvariant="normal">${esc(no.v)}</mi>` : `<mi>${esc(no.v)}</mi>`;
        let out = base;
        if (no.s) out = `<msub>${out}<mtext>${esc(no.s)}</mtext></msub>`;
        if (no.e) out = `<msup>${out}<mn>${esc(no.e)}</mn></msup>`;
        return out;
      }
      case 'n': {
        const s = num(no);
        if (s.includes('×')) {   // notação científica: mantissa × 10^exp
          const m = s.match(/^(.*) × 10(.*)$/);
          if (m) {
            const expo = m[2].replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => '-0123456789'['⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)]);
            return `<mrow><mn>${esc(m[1])}</mn><mo>×</mo><msup><mn>10</mn><mn>${esc(expo.replace('-', '−'))}</mn></msup></mrow>`;
          }
        }
        return `<mn>${esc(s)}</mn>`;
      }
      case 'o': return `<mo>${esc(no.v)}</mo>`;
      case 'r': return `<mrow>${no.c.map(ml).join('')}</mrow>`;
      case 'f': return `<mfrac><mrow>${ml(no.n)}</mrow><mrow>${ml(no.d)}</mrow></mfrac>`;
      case 'rt': return no.k === 2 ? `<msqrt>${ml(no.x)}</msqrt>` : `<mroot><mrow>${ml(no.x)}</mrow><mn>${no.k}</mn></mroot>`;
      case 'p': return `<mrow><mo>(</mo>${ml(no.x)}<mo>)</mo></mrow>`;
      case 'sup': return `<msup><mrow>${ml(no.b)}</mrow><mrow>${ml(no.e)}</mrow></msup>`;
      case 'tx': return `<mtext>${esc(no.v).replace(/^ +| +$/g, m => '&#160;'.repeat(m.length))}</mtext>`;
      case 'u': return `<mspace width="0.3em"></mspace><mtext class="m-un">${esc(no.v)}</mtext>`;
      case 'sp': return '<mspace width="0.5em"></mspace>';
      case 'fn': return `<mrow><mi mathvariant="normal">${esc(no.nome)}</mi><mo>&#x2061;</mo>${ml(no.x)}</mrow>`;
      default: return '';
    }
  }
  function mathml(no, display = false) {
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"${display ? ' display="block"' : ''}>${ml(no)}</math>`;
  }

  // ── Texto (cópia / exportação) ───────────────────────────────────────────
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function composto(no) { return no && ((no.t === 'r' && no.c.length > 1) || no.t === 'f'); }
  function txt(no) {
    if (no === null || no === undefined) return '';
    if (typeof no === 'string') return no;
    switch (no.t) {
      case 'i': return no.v + (no.s ? (no.s.length === 1 ? no.s : ' ' + no.s) : '') + (no.e ? String(no.e).split('').map(c => SUP[c] || c).join('') : '');
      case 'n': return num(no);
      case 'o': return ` ${no.v} `.replace(' · ', '·').replace('  ', ' ');
      case 'r': return no.c.map(txt).join('').replace(/\s+/g, ' ');
      case 'f': return `${composto(no.n) ? '(' + txt(no.n).trim() + ')' : txt(no.n).trim()} / ${composto(no.d) ? '(' + txt(no.d).trim() + ')' : txt(no.d).trim()}`;
      case 'rt': return (no.k === 2 ? '√' : no.k === 3 ? '∛' : `${no.k}√`) + '(' + txt(no.x).trim() + ')';
      case 'p': return '(' + txt(no.x).trim() + ')';
      case 'sup': {
        const e = txt(no.e).trim();
        const b = composto(no.b) ? '(' + txt(no.b).trim() + ')' : txt(no.b).trim();
        return /^[0-9-]+$/.test(e) ? b + e.split('').map(c => SUP[c]).join('') : `${b}^(${e})`;
      }
      case 'tx': return no.v;
      case 'u': return ' ' + no.v;
      case 'sp': return '  ';
      case 'fn': return `${no.nome} ${txt(no.x).trim()}`;
      default: return '';
    }
  }
  function texto(no) { return txt(no).replace(/\s+/g, ' ').trim(); }

  return { i, n, o, r, f, rt, p, sup, tx, u, sp, fn, mathml, texto, esc };
});
