// Good Hands Homes — small interactions (no dependencies)

// 1. Nav shadow once you scroll past the hero top
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// 2. Reveal-on-scroll for .reveal-up elements
const revealEls = document.querySelectorAll('.reveal-up');
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.18 });
revealEls.forEach((el) => revealObserver.observe(el));

// 3. Count-up animation for stats
const animateCount = (el) => {
  const target = parseFloat(el.dataset.count);
  const decimals = (el.dataset.count.split('.')[1] || '').length;
  const duration = 1400;
  let start = null;

  const tick = (ts) => {
    if (start === null) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    const value = (target * eased).toFixed(decimals);
    el.textContent = Number(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const statObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      statObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.6 });
document.querySelectorAll('.stat-num[data-count]').forEach((el) => statObserver.observe(el));

// 4. CTA form — submits to Web3Forms (https://web3forms.com)
const form = document.getElementById('join-form');
const status = document.querySelector('.form-status');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = form.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  const data = Object.fromEntries(new FormData(form));

  // Guard against the unconfigured placeholder key
  if (!data.access_key || data.access_key.includes('YOUR_WEB3FORMS')) {
    setStatus('Form isn’t connected yet. Add your Web3Forms access key.', 'is-error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Sending…';
  setStatus('', '');

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
      form.reset();
      setStatus('Thanks! A real person will reply within a business day.', 'is-success');
    } else {
      throw new Error(json.message || 'Submission failed');
    }
  } catch (err) {
    setStatus('Something went wrong. Please try again, or email us directly.', 'is-error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
});

function setStatus(message, cls) {
  if (!status) return;
  status.textContent = message;
  status.className = 'form-status' + (cls ? ' ' + cls : '');
}
