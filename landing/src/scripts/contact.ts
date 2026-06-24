// Contact form handler — submits to the public submit_contact RPC.
const S = (de: string, en: string) => (document.documentElement.lang === 'en' ? en : de);

const cfgEl = document.getElementById('contact-config');
const config = cfgEl ? (JSON.parse(cfgEl.textContent || '{}') as { url: string; key: string }) : null;
const form = document.getElementById('contact-form') as HTMLFormElement | null;
const msg = document.querySelector<HTMLElement>('[data-contact-msg]');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const message = String(fd.get('message') || '').trim();
    const submit = form.querySelector<HTMLButtonElement>('[data-contact-submit]');
    const show = (t: string, ok: boolean) => {
      if (!msg) return;
      msg.textContent = t;
      msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
      msg.hidden = false;
    };
    // Honeypot: if filled, a bot submitted — pretend success, do nothing.
    if (String(fd.get('company') || '').trim()) {
      form.reset();
      show(S('Danke! Deine Nachricht ist angekommen — wir melden uns.', 'Thanks! Your message has arrived — we’ll get back to you.'), true);
      return;
    }
    if (!name || !email.includes('@') || !message) {
      show(S('Bitte alle Felder ausfüllen.', 'Please fill in all fields.'), false);
      return;
    }
    if (!config || !config.url || !config.key) {
      show(S('Gerade nicht möglich — bitte später erneut.', 'Not possible right now — please try again later.'), false);
      return;
    }
    const label = submit ? submit.textContent : '';
    if (submit) { submit.disabled = true; submit.textContent = S('Wird gesendet …', 'Sending …'); }
    try {
      const res = await fetch(`${config.url}/rest/v1/rpc/submit_contact`, {
        method: 'POST',
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_name: name, p_email: email, p_message: message }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      show(S('Danke! Deine Nachricht ist angekommen — wir melden uns.', 'Thanks! Your message has arrived — we’ll get back to you.'), true);
    } catch {
      show(S('Hat nicht geklappt — bitte später erneut.', 'That didn’t work — please try again later.'), false);
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = label; }
    }
  });
}
