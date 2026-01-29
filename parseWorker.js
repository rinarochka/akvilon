self.addEventListener('message', (e) => {
  if (e.data !== 'start') return;

  fetch('call_registry.json', { cache: 'no-store' })
    .then(r => r.text())
    .then(text => {
      try {
        const data = JSON.parse(text);
        self.postMessage({ type: 'loaded', length: Array.isArray(data) ? data.length : 0, data });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message || String(err) });
      }
    })
    .catch(err => {
      self.postMessage({ type: 'error', error: err.message || String(err) });
    });
});
