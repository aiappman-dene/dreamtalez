// COPPA & GDPR Parental Consent Banner
(function() {
  if (localStorage.getItem('dt-consent') === '1') return;
  const banner = document.createElement('div');
  banner.className = 'consent-banner';
  banner.innerHTML = `
    <div class="consent-content">
      <strong>Parental Consent Required</strong><br>
      Bedtalez is COPPA & GDPR compliant. By using this app, you confirm you are a parent or have parental consent. <a href="/trust.html" target="_blank">Learn more</a>.<br>
      <button class="btn primary consent-btn">I am a parent / I consent</button>
    </div>
  `;
  document.body.appendChild(banner);
  banner.querySelector('.consent-btn').onclick = function() {
    localStorage.setItem('dt-consent', '1');
    banner.remove();
  };
})();
