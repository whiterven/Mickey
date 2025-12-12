
export function register(config?: any) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // FIX: Use relative path './' to ensure the SW script resolves to the 
      // same origin and path context as the document, preventing origin mismatch errors.
      const swUrl = './service-worker.js';

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch((error) => {
          console.error('ServiceWorker registration failed: ', error);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
