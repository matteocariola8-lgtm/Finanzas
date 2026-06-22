const FORMSPREE_ENDPOINT = 'https://formspree.io/f/XXXXXXXX';
const WHATSAPP_NUMBER = '393519048233';

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav?.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  hamburger?.addEventListener('click', () => {
    const isOpen = mobileMenu?.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });
  mobileMenu?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === currentPage) link.classList.add('active');
  });

  const revealEls = document.querySelectorAll('.service-card, .post-card, .stat-item, .service-full-card, .blog-post-card');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
  }, { threshold: 0.1 });
  revealEls.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 3) * 0.08}s`;
    revealObserver.observe(el);
  });

  const counters = document.querySelectorAll('[data-count]');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); countObserver.unobserve(e.target); } });
  }, { threshold: 0.5 });
  counters.forEach(c => countObserver.observe(c));

  function animateCounter(el) {
    const target = parseInt(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const success = document.getElementById('formSuccess');
      const error = document.getElementById('formError');
      btn.innerHTML = '<span style="opacity:.7">Invio in corso...</span>';
      btn.disabled = true;
      if (error) error.style.display = 'none';
      if (success) success.style.display = 'none';
      const data = new FormData(form);
      try {
        const res = await fetch(FORMSPREE_ENDPOINT, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } });
        if (res.ok) { if (success) { success.style.display = 'block'; success.scrollIntoView({ behavior: 'smooth', block: 'center' }); } form.reset(); }
        else throw new Error();
      } catch {
        if (error) error.style.display = 'block';
        const waBtn = document.getElementById('waFallback');
        if (waBtn) {
          const nome = data.get('nome') || '';
          const interesse = data.get('interesse') || '';
          waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Ciao Matteo, sono ${nome}. Sono interessato a: ${interesse}.`)}`;
          waBtn.style.display = 'flex';
        }
      } finally {
        btn.innerHTML = 'Invia richiesta →';
        btn.disabled = false;
      }
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) { e.preventDefault(); window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' }); }
    });
  });

  document.querySelectorAll('[href*="wa.me"]').forEach(link => {
    link.addEventListener('click', () => { if (typeof gtag !== 'undefined') gtag('event', 'whatsapp_click'); });
  });
});
