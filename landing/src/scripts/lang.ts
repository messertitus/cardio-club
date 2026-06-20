// Client-side DE/EN switch. Swaps [data-i18n] (innerHTML) and [data-i18n-ph]
// (placeholder) from the dictionary, persists the choice, and lets other
// scripts react via the `langchange` event. German is the default/SSR content.
import { dict, type Lang } from '../i18n/strings';

const KEY = 'mcc.lang';

function current(): Lang {
  return localStorage.getItem(KEY) === 'en' ? 'en' : 'de';
}

function apply(lang: Lang) {
  document.documentElement.lang = lang;
  const t = dict[lang];
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (k && t[k] != null) el.innerHTML = t[k];
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach((el) => {
    const k = el.getAttribute('data-i18n-ph');
    if (k && t[k] != null) el.placeholder = t[k];
  });
  // Whole-block language variants (used by prose-heavy pages: FAQ, legal).
  document.querySelectorAll<HTMLElement>('[data-lang-only]').forEach((el) => {
    // Explicit 'block' (not '') so it overrides the default-hidden CSS rule.
    el.style.display = el.getAttribute('data-lang-only') === lang ? 'block' : 'none';
  });
  const btn = document.querySelector<HTMLButtonElement>('[data-lang-toggle]');
  if (btn) btn.textContent = lang === 'de' ? 'EN' : 'DE';
  document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

function init() {
  let lang = current();
  apply(lang);
  document.querySelector('[data-lang-toggle]')?.addEventListener('click', () => {
    lang = lang === 'de' ? 'en' : 'de';
    localStorage.setItem(KEY, lang);
    apply(lang);
  });
}

if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
