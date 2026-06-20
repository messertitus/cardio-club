// Scroll-reveal + count-up. Adds `.in` to [data-reveal] elements as they enter
// the viewport (staggered per sibling group) and animates [data-countup] numbers.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el: HTMLElement) {
  const text = (el.textContent || '').trim();
  const m = text.match(/^(\D*)(\d+)(.*)$/);
  if (!m) return;
  const prefix = m[1];
  const target = parseInt(m[2], 10);
  const suffix = m[3];
  if (reduce || target === 0) { el.textContent = `${prefix}${target}${suffix}`; return; }
  const dur = 1000;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.classList.add('in');
      if (el.hasAttribute('data-countup')) countUp(el);
      el.querySelectorAll<HTMLElement>('[data-countup]').forEach(countUp);
      io.unobserve(el);
    }
  },
  { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
);

function init() {
  const groups = new Map<Element, HTMLElement[]>();
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const p = el.parentElement || document.body;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p)!.push(el);
  });
  groups.forEach((els) =>
    els.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i, 6) * 0.06}s`);
      io.observe(el);
    }),
  );
  // count-ups that aren't wrapped in a reveal
  document.querySelectorAll<HTMLElement>('[data-countup]').forEach((el) => {
    if (!el.closest('[data-reveal]')) io.observe(el);
  });
}

// Scroll progress bar
function scrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = h > 0 ? `${Math.min(100, (window.scrollY / h) * 100)}%` : '0';
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

if (document.readyState !== 'loading') { init(); scrollProgress(); }
else document.addEventListener('DOMContentLoaded', () => { init(); scrollProgress(); });
