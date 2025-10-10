(function () {
  'use strict';

  const BN = window.BN = window.BN || {};

  async function bootstrap() {
    if (!BN.panel || typeof BN.panel.initialize !== 'function') {
      console.warn('[BN] panel initializer missing');
      return;
    }
    try {
      await BN.panel.initialize();
    } catch (error) {
      console.error('[BN] failed to initialize panel', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootstrap());
  } else {
    bootstrap();
  }
})();
