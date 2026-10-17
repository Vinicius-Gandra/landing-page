(() => {
  const nav = document.querySelector('nav.lab-areas, nav.e-areas, nav.t-areas, nav.s-areas');
  if (!nav) return;
  const current = nav.querySelector('a[aria-current="page"]');
  const key = 'vg-labs-nav-position';

  try {
    const previous = Number(sessionStorage.getItem(key));
    if (Number.isFinite(previous) && previous >= 0) nav.scrollLeft = previous;
  } catch (_) { /* O arquivo local pode bloquear sessionStorage. */ }

  if (current) {
    const navBox = nav.getBoundingClientRect();
    const itemBox = current.getBoundingClientRect();
    if (itemBox.left < navBox.left || itemBox.right > navBox.right) {
      nav.scrollLeft += itemBox.left - navBox.left - (navBox.width - itemBox.width) / 2;
    }
  }

  nav.addEventListener('click', event => {
    if (!event.target.closest('a[href]')) return;
    try { sessionStorage.setItem(key, String(nav.scrollLeft)); } catch (_) {}
  });
})();
