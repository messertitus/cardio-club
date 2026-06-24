// Cursor-following spotlight glow on cards. Uses event delegation so it keeps
// working after live.ts re-renders the sport tiles.
const SEL = '.sport, .part-card, .fair-card, .join-card, .flow, .usp-card';

function init() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener(
    'pointermove',
    (e) => {
      const pe = e as PointerEvent;
      const card = (pe.target as HTMLElement)?.closest?.<HTMLElement>(SEL);
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${pe.clientX - r.left}px`);
      card.style.setProperty('--my', `${pe.clientY - r.top}px`);
    },
    { passive: true },
  );
}

if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
