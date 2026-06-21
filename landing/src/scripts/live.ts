// Runtime data layer: re-fetches the public RPC on every page load and updates
// the stats, sport list, map dots and venue list live — so the page is always
// current, not frozen at build time. Falls back silently to the server-rendered
// (build-time) content if config is missing or the request fails.
import { sportIconPath } from '../lib/icons';
import { groupByStadtteil } from '../lib/stadtteile';

interface Venue { name: string; area: string; lat: number; lng: number; sports: string[]; sessions: number }
interface RpcVenue { name: string; lat: number; lng: number; sports: string[]; sessions: number }
interface Stats {
  members: number;
  sports_active: number;
  weekly_cardiotage?: number;
  sports?: { name: string; icon: string | null }[];
  venues: RpcVenue[];
}
interface Proj { minX: number; maxY: number; scale: number; pad: number }

const SVGNS = 'http://www.w3.org/2000/svg';
const cfgEl = document.getElementById('live-config');
const config = cfgEl ? (JSON.parse(cfgEl.textContent || '{}') as { url: string; key: string; proj: Proj }) : null;

const region = document.querySelector<HTMLElement>('[data-region]');
const stage = region?.querySelector<HTMLElement>('.stage') ?? null;
const tip = region?.querySelector<HTMLElement>('[data-tip]') ?? null;
let venues: Venue[] = [];

const S = (de: string, en: string) => (document.documentElement.lang === 'en' ? en : de);

const toRad = (d: number) => (d * Math.PI) / 180;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
const r1 = (n: number) => Math.round(n * 10) / 10;
function toXY(lng: number, lat: number, p: Proj) {
  return { x: p.pad + (toRad(lng) - p.minX) * p.scale, y: p.pad + (p.maxY - mercY(lat)) * p.scale };
}

function showTip(i: number) {
  if (!tip || !stage || !region) return;
  const v = venues[i];
  if (!v) return;
  const word = v.sessions === 1 ? S('Cardiotag', 'cardio day') : S('Cardiotage', 'cardio days');
  const sessionLine = v.sessions > 0
    ? `<div class="t-sessions"><b>${v.sessions}</b> ${word} ${S('hier', 'here')}</div>`
    : '';
  tip.innerHTML =
    `<h4>${v.name}</h4>` +
    `<div class="t-sports">${v.sports.join(' · ')}</div>${sessionLine}`;
  tip.hidden = false;
  const dots = region.querySelectorAll<SVGGElement>('.venue-dot');
  const el = dots[i];
  if (el) {
    const d = el.getBoundingClientRect();
    const b = stage.getBoundingClientRect();
    tip.style.left = `${d.left - b.left + d.width / 2}px`;
    tip.style.top = `${d.top - b.top}px`;
  }
  dots.forEach((d, k) => d.classList.toggle('active', k === i));
}
function hideTip() {
  if (!tip) return;
  tip.hidden = true;
  region?.querySelectorAll('.venue-dot').forEach((e) => e.classList.remove('active'));
}

function wire() {
  if (!region) return;
  region.querySelectorAll<SVGGElement>('.venue-dot').forEach((d, i) => {
    d.addEventListener('mouseenter', () => showTip(i));
    d.addEventListener('mouseleave', hideTip);
    d.addEventListener('focus', () => showTip(i));
    d.addEventListener('blur', hideTip);
    d.addEventListener('click', () => showTip(i));
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTip(i); }
    });
  });
  // Stadtteil pills: highlight that district's dots.
  region.querySelectorAll<HTMLButtonElement>('.st-pill').forEach((pill) => {
    const idx = (pill.getAttribute('data-indices') || '').split(',').filter(Boolean).map(Number);
    const dots = () => region.querySelectorAll<SVGGElement>('.venue-dot');
    const on = () => { pill.classList.add('active'); idx.forEach((i) => dots()[i]?.classList.add('st-hi')); };
    const off = () => { pill.classList.remove('active'); idx.forEach((i) => dots()[i]?.classList.remove('st-hi')); };
    pill.addEventListener('pointerenter', on);
    pill.addEventListener('pointerleave', off);
    pill.addEventListener('focus', on);
    pill.addEventListener('blur', off);
    pill.addEventListener('click', () => (pill.classList.contains('active') ? off() : on()));
  });
}

function svgIcon(path: string) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
}

function renderMap(list: Venue[]) {
  const g = document.getElementById('venue-dots');
  const count = document.getElementById('venue-count');
  const stCount = document.getElementById('venue-st-count');
  if (!g || !config) return;
  const maxSports = Math.max(1, ...list.map((v) => v.sports.length));
  const glowOf = (n: number) => 0.3 + (n / maxSports) * 0.5;

  // Dots (flat, indexed — matches groupByStadtteil item.i).
  g.replaceChildren();
  list.forEach((v, i) => {
    const t = v.sports.length / maxSports;
    const core = 3 + t * 4, halo = 12 + t * 24;
    const { x, y } = toXY(v.lng, v.lat, config.proj);
    const grp = document.createElementNS(SVGNS, 'g');
    grp.setAttribute('class', 'venue-dot');
    grp.setAttribute('tabindex', '0');
    grp.setAttribute('role', 'button');
    grp.setAttribute('aria-label', `${v.name}: ${v.sports.join(', ')}`);
    grp.setAttribute('transform', `translate(${r1(x)} ${r1(y)})`);
    grp.style.setProperty('--delay', `${((i * 0.41) % 2.2).toFixed(2)}s`);
    grp.style.setProperty('--dur', `${(2.8 + (i % 3) * 0.5).toFixed(2)}s`);
    const mk = (cls: string, attrs: Record<string, string>) => {
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('class', cls);
      for (const k in attrs) c.setAttribute(k, attrs[k]);
      return c;
    };
    const halo1 = mk('halo', { r: String(halo), fill: 'url(#vGlow)' });
    halo1.style.opacity = String(glowOf(v.sports.length));
    grp.append(
      halo1,
      mk('ring', { r: String(core + 3), fill: 'none', stroke: '#8fc7ff', 'stroke-opacity': '0' }),
      mk('core', { r: String(core), fill: '#cfe6ff', filter: 'url(#vSoft)' }),
    );
    g.appendChild(grp);
  });

  // Stadtteil pills.
  const pills = document.getElementById('st-pills');
  const groups = groupByStadtteil(list);
  if (pills) {
    pills.replaceChildren();
    for (const grp of groups) {
      const btn = document.createElement('button');
      btn.className = 'st-pill';
      btn.type = 'button';
      btn.setAttribute('data-indices', grp.items.map((it) => it.i).join(','));
      btn.innerHTML = `${grp.stadtteil}<span class="st-pill-n">${grp.items.length}</span>`;
      pills.appendChild(btn);
    }
  }
  if (count) count.textContent = String(list.length);
  if (stCount) stCount.textContent = String(groups.length);
}

function setStat(key: string, value: string) {
  document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => (el.textContent = value));
}

function renderStats(stats: Stats) {
  const sports = stats.sports ?? [];
  setStat('members', String(stats.members));
  setStat('sports', String(stats.sports_active));
  setStat('venues', String(stats.venues.length));
  if (stats.weekly_cardiotage != null) setStat('cardiotage', String(stats.weekly_cardiotage));

  const grid = document.getElementById('sport-grid');
  if (grid && sports.length) {
    grid.innerHTML = sports
      .map((s) => `<li class="sport"><span class="s-icon">${svgIcon(sportIconPath(s.name, s.icon))}</span><span>${s.name}</span></li>`)
      .join('');
  }
}

function wireWaitlist() {
  const dlg = document.getElementById('waitlist') as HTMLDialogElement | null;
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const form = document.getElementById('waitlist-form') as HTMLFormElement | null;
  const msg = dlg.querySelector<HTMLElement>('[data-wl-msg]');

  document.querySelectorAll('[data-open-waitlist]').forEach((b) =>
    b.addEventListener('click', () => { if (msg) msg.hidden = true; dlg.showModal(); }),
  );
  dlg.querySelectorAll('[data-close-waitlist]').forEach((b) =>
    b.addEventListener('click', () => dlg.close()),
  );
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    const submit = form.querySelector<HTMLButtonElement>('[data-wl-submit]');
    const show = (text: string, ok: boolean) => {
      if (!msg) return;
      msg.textContent = text;
      msg.className = 'wl-msg ' + (ok ? 'ok' : 'err');
      msg.hidden = false;
    };
    if (!name || phone.length < 4) { show(S('Bitte Name und Telefonnummer angeben.', 'Please enter your name and phone number.'), false); return; }
    if (!config || !config.url || !config.key) { show(S('Gerade nicht möglich — bitte später erneut.', 'Not possible right now — please try again later.'), false); return; }
    const submitLabel = submit ? submit.textContent : '';
    if (submit) { submit.disabled = true; submit.textContent = S('Wird gesendet …', 'Sending …'); }
    try {
      const res = await fetch(`${config.url}/rest/v1/rpc/request_invite`, {
        method: 'POST',
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_name: name, p_phone: phone }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      show(S('Danke! Du stehst auf der Warteliste — wir melden uns.', 'Thanks! You’re on the waitlist — we’ll be in touch.'), true);
    } catch {
      show(S('Hat nicht geklappt — bitte später erneut versuchen.', 'That didn’t work — please try again later.'), false);
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = submitLabel; }
    }
  });
}

function init() {
  wireWaitlist();
  const vd = document.getElementById('venues-data');
  if (vd) { try { venues = JSON.parse(vd.textContent || '[]'); } catch { /* keep */ } }
  wire();
  if (!config || !config.url || !config.key) return;

  fetch(`${config.url}/rest/v1/rpc/landing_public_stats`, {
    method: 'POST',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((stats: Stats) => {
      const live = (stats.venues ?? []).map((v: RpcVenue) => ({
        name: v.name,
        area: v.name.includes('Kreuzlingen') ? 'Kreuzlingen' : 'Konstanz',
        lat: v.lat, lng: v.lng, sports: v.sports ?? [], sessions: v.sessions ?? 0,
      }));
      if (live.length) { venues = live; renderMap(live); }
      renderStats(stats);
      wire();
    })
    .catch(() => { /* keep server-rendered content */ });
}

if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
