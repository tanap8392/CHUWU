(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav.links a[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === here) a.classList.add('active');
    });
    var yearEls = document.querySelectorAll('[data-year]');
    yearEls.forEach(function (el) { el.textContent = new Date().getFullYear(); });
  });
})();
