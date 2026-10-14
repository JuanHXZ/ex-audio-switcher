(() => {
  if (window.__audioSwitcherInitialized) return;
  window.__audioSwitcherInitialized = true;

  const STORAGE_KEY = '__edge_preferred_audio_sink';
  const trackedMedia = new Set();
  const trackedAudioContexts = new Set();

  let currentSinkId = 'default';
  try {
    currentSinkId = localStorage.getItem(STORAGE_KEY) || 'default';
  } catch (e) {}

  async function applySinkToElement(el, sinkId) {
    if (!el || typeof el.setSinkId !== 'function') return;
    try {
      const targetSink = sinkId === 'default' ? '' : sinkId;
      if (el.sinkId !== targetSink) {
        await el.setSinkId(targetSink);
      }
    } catch (err) {
      // Si el dispositivo fue desconectado, vuelve al predeterminado
    }
  }

  // 1. Interceptar HTMLMediaElement.prototype.play (captura <video>, <audio> y new Audio())
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    trackedMedia.add(this);
    if (currentSinkId && currentSinkId !== 'default') {
      applySinkToElement(this, currentSinkId);
    }
    return originalPlay.apply(this, args);
  };

  // 2. Interceptar Web Audio API (AudioContext) si el sitio la usa
  if (window.AudioContext && typeof AudioContext.prototype.setSinkId === 'function') {
    const OriginalAudioContext = window.AudioContext;
    window.AudioContext = function (...args) {
      const ctx = new OriginalAudioContext(...args);
      trackedAudioContexts.add(ctx);
      if (currentSinkId && currentSinkId !== 'default') {
        const targetSink = currentSinkId === 'default' ? '' : currentSinkId;
        ctx.setSinkId(targetSink).catch(() => {});
      }
      return ctx;
    };
    window.AudioContext.prototype = OriginalAudioContext.prototype;
  }

  // 3. Función global invocada desde el popup para cambiar el dispositivo en tiempo real
  window.__setPageAudioOutput = async (sinkId) => {
    currentSinkId = sinkId || 'default';
    try {
      localStorage.setItem(STORAGE_KEY, currentSinkId);
    } catch (e) {}

    const domElements = document.querySelectorAll('audio, video');
    domElements.forEach((el) => trackedMedia.add(el));

    const promises = [];
    for (const el of trackedMedia) {
      promises.push(applySinkToElement(el, currentSinkId));
    }

    const targetSink = currentSinkId === 'default' ? '' : currentSinkId;
    for (const ctx of trackedAudioContexts) {
      if (typeof ctx.setSinkId === 'function' && ctx.state !== 'closed') {
        promises.push(ctx.setSinkId(targetSink).catch(() => {}));
      }
    }

    await Promise.all(promises);
    return {
      success: true,
      mediaCount: trackedMedia.size + trackedAudioContexts.size,
      activeSinkId: currentSinkId
    };
  };

  // 4. Función global para consultar el estado actual desde el popup
  window.__getPageAudioState = () => {
    document.querySelectorAll('audio, video').forEach((el) => trackedMedia.add(el));
    return {
      activeSinkId: currentSinkId,
      mediaCount: trackedMedia.size + trackedAudioContexts.size
    };
  };
})();