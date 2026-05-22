const retryButton = document.getElementById('retry-btn');
if (retryButton) {
  retryButton.addEventListener('click', () => {
    window.location.reload();
  });
}
