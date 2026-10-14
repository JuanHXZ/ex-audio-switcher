# 🔊 Site Audio Output Switcher

Extensión (Manifest V3) para Microsoft Edge y navegadores basados en Chromium que permite elegir el dispositivo de salida de audio (altavoces, audífonos, monitores, interfaces de audio, etc.) de forma independiente para cada sitio web.

## ✨ Características principales

* **Enrutamiento de audio por sitio web:** Asigna diferentes dispositivos de salida a distintas pestañas o dominios simultáneamente mediante la API `HTMLMediaElement.setSinkId()` y `AudioContext.setSinkId()`.
* **Interceptación automática en tiempo real:** Captura etiquetas `<audio>`, `<video>`, instancias dinámicas creadas con `new Audio()` y contextos de la Web Audio API (`AudioContext`) sin necesidad de recargar la página.
* **Memoria por dominio:** Recuerda automáticamente qué dispositivo de salida elegiste en cada sitio web para futuras visitas o cambios de pista/video.
* **Contador de reproductores activos:** Muestra cuántas fuentes multimedia están siendo gestionadas en la pestaña actual.
* **Interfaz oscura (Catppuccin Mocha):** Diseño moderno con selectores interactivos y barras de desplazamiento personalizadas.

## 📁 Estructura del proyecto

```text
edge-audio-switcher/
├── icon.png          # Icono de la extensión (128x128)
├── manifest.json     # Configuración y declaración de scripts (Manifest V3)
├── content.js        # Interceptor de elementos multimedia y AudioContext
├── popup.html        # Estructura y estilos del selector de dispositivos
└── popup.js          # Enumeración de hardware de audio y control de estado
