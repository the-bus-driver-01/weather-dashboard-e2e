/** Mobile nav toggle */
const toggle = document.querySelector('.nav-toggle');
const menu = document.querySelector('.nav-menu');

if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    menu.classList.toggle('open');
  });
}

/** Active nav link */
document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
    e.currentTarget.classList.add('active');
  });
});