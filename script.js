// Flixbnb: small interactions (no dependencies)

// Translations: the /es/ /fr/ /pl/ pages set window.FLX_T; English is the fallback.
const t = k => (window.FLX_T && window.FLX_T[k]) || k;

// Tabs (the four sizes), with arrow-key support.
function initTabs(list) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];

  function select(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });

  return { tabs, select };
}

document.querySelectorAll('[role="tablist"]').forEach(list => {
  const { tabs, select } = initTabs(list);

  // Campaign links can open a size group directly: flixbnb.com/?size=a (a, b, c or d).
  const size = new URLSearchParams(location.search).get('size');
  const fromUrl = tabs.find(t => t.dataset.size && t.dataset.size === size);
  if (fromUrl) select(fromUrl);
});

// The cloud of situations: show a screenful, fading out, until the visitor asks for all of them.
(function () {
  const cloud = document.getElementById('cloud');
  const more = document.querySelector('.cloud-more');
  if (!cloud || !more) return;
  cloud.classList.add('is-collapsed');
  more.setAttribute('aria-expanded', 'false');
  more.hidden = false;
  more.addEventListener('click', () => {
    const open = cloud.classList.toggle('is-collapsed') === false;
    more.setAttribute('aria-expanded', open);
    more.textContent = t(open ? 'Show fewer' : 'Show all 150+');
  });
})();

// The lead form: every "Start onboarding" and "Schedule a call" button opens it.
// Submissions go to Web3Forms, which emails each one to the address the access key was made for.
// If sending fails, the visitor gets a "Send by email instead" link with their details filled in.
// With no access key set, the form opens a ready-to-send email straight away.
const LEAD_KEY = '60b405a2-1581-4a5c-a8f2-c3ff72a98a2c'; // Web3Forms access key (public by design, safe to keep in this file)
const LEAD_ENDPOINT = 'https://api.web3forms.com/submit';
const LEAD_EMAIL = 'hello@flixbnb.com'; // shown to visitors and used for the email fallback

(function () {
  const dialog = document.getElementById('lead');
  if (!dialog || typeof dialog.showModal !== 'function') return; // no <dialog>: the buttons stay email links

  const form = dialog.querySelector('.lead-form');
  const done = dialog.querySelector('.lead-done');
  const error = dialog.querySelector('.lead-error');
  const submit = dialog.querySelector('.lead-submit');
  const title = form.querySelector('.lead-title');

  const kinds = {
    onboarding: { title: t('Start onboarding'), button: t('Start onboarding'), subject: 'Start onboarding' },
    call: { title: t('Schedule a call'), button: t('Schedule a call'), subject: 'Schedule a call' }
  };

  function open(kind) {
    const k = kinds[kind] || kinds.onboarding;
    form.reset();
    form.request.value = kind;
    title.textContent = k.title;
    submit.textContent = k.button;
    form.hidden = false;
    done.hidden = true;
    error.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(f => f.removeAttribute('aria-invalid'));
    dialog.showModal();
  }

  document.querySelectorAll('[data-lead]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      open(btn.dataset.lead);
    });
  });

  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  // A click on the dimmed backdrop closes it too
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  // A phone number is anything with at least 6 digits; spaces, dashes and a leading + are fine
  function checkPhone() {
    const digits = form.phone.value.replace(/\D/g, '').length;
    form.phone.setCustomValidity(digits >= 6 ? '' : t('Enter a phone number, with the country code.'));
  }

  function valid() {
    checkPhone();
    let ok = true;
    [form.company, form.email, form.phone].forEach(f => {
      const bad = !f.checkValidity();
      f.toggleAttribute('aria-invalid', bad);
      if (bad && ok) { f.focus(); ok = false; }
    });
    return ok;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    error.hidden = true;
    if (!valid()) {
      error.textContent = t('Fill in your company name, a valid email and a phone number.');
      error.hidden = false;
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    const k = kinds[data.request] || kinds.onboarding;

    const subject = k.subject + ': ' + data.company;
    const mailto = 'mailto:' + LEAD_EMAIL + '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent('Company: ' + data.company + '\nEmail: ' + data.email + '\nPhone: ' + data.phone);

    if (LEAD_KEY) {
      submit.disabled = true;
      try {
        const res = await fetch(LEAD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: LEAD_KEY, subject, from_name: 'flixbnb.com',
            request: data.request, company: data.company, email: data.email, phone: data.phone,
            language: document.documentElement.lang, botcheck: data._honey || ''
          })
        });
        const reply = await res.json().catch(() => ({}));
        if (!res.ok || reply.success !== true) throw new Error(reply.message || res.status);
      } catch (err) {
        error.textContent = t("Your details weren't sent. Try again, or email ") + LEAD_EMAIL + '. ';
        const a = document.createElement('a');
        a.href = mailto;
        a.textContent = t('Send by email instead');
        error.append(a);
        error.hidden = false;
        submit.disabled = false;
        return;
      }
      submit.disabled = false;
    } else {
      location.href = mailto;
    }

    form.hidden = true;
    done.hidden = false;
    done.querySelector('.lead-title').focus();
  });

  form.addEventListener('input', e => {
    if (e.target === form.phone) checkPhone();
    if (e.target.hasAttribute('aria-invalid') && e.target.checkValidity()) e.target.removeAttribute('aria-invalid');
  });
})();
