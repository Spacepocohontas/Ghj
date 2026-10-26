/* Production-boundary and mobile fixes loaded after all feature adapters. */
(() => {
  if (window.__nfDeploymentFixes) return;
  window.__nfDeploymentFixes = 1;

  const staleBridge = 'https://ghj-git-main-ohnoitstamara-4066.vercel.app';
  const previousFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.startsWith(`${staleBridge}/api/tts`)) {
      return previousFetch(url.slice(staleBridge.length), init);
    }
    return previousFetch(input, init);
  };

  // Only one assignment sheet should exist, even if more than one legacy
  // character-card enhancer responds to the same tap.
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-nf-card-voice],[data-nf-voice-picker],[data-cbvoice],[data-cb-chat]')) return;
    document.querySelectorAll('.nf-voice-modal').forEach(modal => modal.remove());
  }, true);

  window.addEventListener('load', () => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (ios && window.nfKokoro && window.nfBrowserVoice) {
      window.nfKokoro.speak = (text, voice) => window.nfBrowserVoice.speak(text, {
        voice: {
          provider: 'browser',
          deliveryStyle: /adam|michael|george|lewis/i.test(String(voice)) ? 'dark' : 'natural',
        },
      });
    }
  });
})();
