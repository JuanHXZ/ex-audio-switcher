function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Se ejecuta dentro de la pestaña para listar las salidas de audio del sistema
async function fetchAudioDevicesInPage() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return { supported: false };
  }

  const allDevices = await navigator.mediaDevices.enumerateDevices();
  const outputs = allDevices.filter((d) => d.kind === 'audiooutput');

  // Si los labels están vacíos, el sitio aún no tiene permiso para leer nombres de hardware
  const hasLabels = outputs.some((d) => d.label && d.label.trim() !== '');

  const state = window.__getPageAudioState
    ? window.__getPageAudioState()
    : { activeSinkId: 'default', mediaCount: document.querySelectorAll('audio, video').length };

  return {
    supported: true,
    hasLabels,
    activeSinkId: state.activeSinkId || 'default',
    mediaCount: state.mediaCount || 0,
    devices: outputs.map((d) => ({
      deviceId: d.deviceId,
      label: d.label || (d.deviceId === 'default' ? 'Dispositivo predeterminado' : 'Dispositivo de audio')
    }))
  };
}

// Solicita el permiso único en la pestaña para desbloquear la lista de salidas de audio
async function unlockAudioDevicesInPage() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { unlocked: true };
  } catch (err) {
    return { unlocked: false, error: err.message };
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const domainEl = document.getElementById('domain');
  const mediaInfoEl = document.getElementById('media-info');
  const containerEl = document.getElementById('device-container');
  const statusEl = document.getElementById('status');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || /^(edge|chrome|about|extension):/i.test(tab.url)) {
    domainEl.textContent = 'Página del sistema';
    mediaInfoEl.textContent = 'No disponible en páginas internas';
    containerEl.innerHTML = '<div class="unlock-box"><p>Abre un sitio web con audio o video para elegir el dispositivo de salida.</p></div>';
    return;
  }

  const url = new URL(tab.url);
  domainEl.textContent = url.hostname;

  async function renderPopup() {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: fetchAudioDevicesInPage
      });

      const data = res?.result;
      if (!data || !data.supported) {
        mediaInfoEl.textContent = 'API de audio no soportada en este sitio';
        return;
      }

      mediaInfoEl.textContent = `Reproductores detectados en la página: ${data.mediaCount}`;

      // Si el navegador aún no muestra tus dispositivos (Altavoces, Corsair, etc.) en este dominio
      if (!data.hasLabels) {
        containerEl.innerHTML = `
          <div class="unlock-box">
            <p>Por privacidad de Edge, debes autorizar una única vez a <b>${escapeHtml(url.hostname)}</b> para listar tus dispositivos de audio (Altavoces, Audífonos, etc.).</p>
            <button id="unlock-btn">🔓 Mostrar mis dispositivos de audio</button>
          </div>
        `;

        document.getElementById('unlock-btn').addEventListener('click', async () => {
          statusEl.textContent = 'Acepta el permiso arriba a la izquierda en la página...';
          statusEl.style.color = '#f9e2af';

          const [unlockRes] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: unlockAudioDevicesInPage
          });

          if (unlockRes?.result?.unlocked) {
            statusEl.textContent = '¡Dispositivos desbloqueados!';
            statusEl.style.color = '#a6e3a1';
            await renderPopup();
          } else {
            statusEl.textContent = 'Permiso denegado o cerrado.';
            statusEl.style.color = '#f38ba8';
          }
        });
        return;
      }

      // Renderizar la lista de salidas de audio disponibles
      containerEl.innerHTML = data.devices
        .map((dev) => {
          const isActive =
            dev.deviceId === data.activeSinkId ||
            (data.activeSinkId === 'default' && dev.deviceId === 'default');
          return `
            <div class="device-item ${isActive ? 'active' : ''}" data-id="${escapeHtml(dev.deviceId)}">
              <div class="radio-dot"></div>
              <div class="device-name">${escapeHtml(dev.label)}</div>
            </div>
          `;
        })
        .join('');

      // Asignar evento de clic a cada dispositivo
      containerEl.querySelectorAll('.device-item').forEach((item) => {
        item.addEventListener('click', async () => {
          const selectedId = item.getAttribute('data-id');

          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            world: 'MAIN',
            func: (sinkId) => {
              if (window.__setPageAudioOutput) {
                return window.__setPageAudioOutput(sinkId);
              }
            },
            args: [selectedId]
          });

          statusEl.textContent = '¡Salida de audio actualizada!';
          statusEl.style.color = '#a6e3a1';
          await renderPopup();
        });
      });
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = '#f38ba8';
    }
  }

  await renderPopup();
});