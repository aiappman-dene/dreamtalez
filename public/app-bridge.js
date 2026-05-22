// Translation bridge — applies i18n keys to the DOM.
// Extracted from index.html to allow a stricter Content-Security-Policy
// (no 'unsafe-inline' in script-src).

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (window.i18n) el.textContent = window.i18n.t(key);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (window.i18n) el.setAttribute('placeholder', window.i18n.t(key));
  });
}

document.addEventListener('DOMContentLoaded', applyTranslations);

window.setAppLanguage = function (lang) {
  if (window.i18n) {
    window.i18n.setLang(lang);
    applyTranslations();
  }
};
