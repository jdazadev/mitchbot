/*
 * Cargador del widget de Mitchbot. Se instala en la web del cliente con:
 *   <script src="https://<backend>/widget.js" data-mitchbot="<slug>" async></script>
 * Pinta un botón flotante y abre el chat en un iframe servido por el backend.
 * No usa dependencias ni toca los estilos de la página anfitriona.
 */
(function () {
  'use strict';
  var script = document.currentScript || document.querySelector('script[data-mitchbot]');
  if (!script || window.__mitchbotWidget) return;
  var slug = script.getAttribute('data-mitchbot');
  if (!slug) return;
  window.__mitchbotWidget = true;

  var base = new URL(script.src, location.href).origin;
  var api = base + '/api/public/widget/' + encodeURIComponent(slug);

  fetch(api + '/config')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (config) { if (config && config.enabled) mount(config); })
    .catch(function () { /* Sin widget: la página sigue funcionando. */ });

  function mount(config) {
    var side = config.position === 'left' ? 'left' : 'right';
    var color = /^#[0-9a-f]{3,8}$/i.test(config.color || '') ? config.color : '#0B0B0C';
    var ink = config.colorContrast === 'light' ? '#ffffff' : '#0B0B0C';
    var open = false;
    var frame = null;

    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-mitchbot-launcher', '');
    button.setAttribute('aria-label', config.strings.open);
    button.setAttribute('aria-expanded', 'false');
    button.title = config.strings.open;
    button.innerHTML = '<svg width="26" height="26" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216 48H40a16 16 0 0 0-16 16v160a15.84 15.84 0 0 0 9.25 14.5A16.05 16.05 0 0 0 40 240a15.89 15.89 0 0 0 10.25-3.78L82.76 208H216a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16Z"/></svg>';
    style(button, {
      position: 'fixed', bottom: '20px', zIndex: '2147483646', width: '58px', height: '58px',
      borderRadius: '999px', border: '0', cursor: 'pointer', background: color, color: ink,
      boxShadow: '0 10px 30px rgba(11,11,12,.25)', display: 'grid', placeItems: 'center', padding: '0',
    });
    button.style[side] = '20px';
    button.addEventListener('click', function () { toggle(!open); });
    document.body.appendChild(button);

    function createFrame() {
      frame = document.createElement('iframe');
      frame.src = api + '/frame';
      frame.title = config.title || config.strings.title;
      frame.setAttribute('data-mitchbot-frame', '');
      frame.allow = 'clipboard-write';
      style(frame, {
        position: 'fixed', bottom: '90px', zIndex: '2147483647', width: '380px', height: '600px',
        maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 110px)', border: '0', borderRadius: '22px',
        boxShadow: '0 24px 60px rgba(11,11,12,.25)', background: '#fff', display: 'none',
      });
      frame.style[side] = '20px';
      document.body.appendChild(frame);
    }

    /** En pantallas estrechas el chat ocupa el ancho con márgenes iguales a ambos lados. */
    function place() {
      if (!frame) return;
      var narrow = window.matchMedia('(max-width: 480px)').matches;
      frame.style.width = narrow ? 'auto' : '380px';
      frame.style.left = narrow || side === 'left' ? (narrow ? '12px' : '20px') : 'auto';
      frame.style.right = narrow || side === 'right' ? (narrow ? '12px' : '20px') : 'auto';
    }
    window.addEventListener('resize', place);

    function toggle(next) {
      open = next;
      if (open && !frame) createFrame();
      place();
      if (frame) frame.style.display = open ? 'block' : 'none';
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? config.strings.close : config.strings.open);
      button.title = open ? config.strings.close : config.strings.open;
      if (open && frame) {
        frame.focus();
        frame.contentWindow && frame.contentWindow.postMessage({ type: 'mitchbot:opened' }, base);
      } else {
        button.focus();
      }
    }

    // La página del chat pide cerrarse (botón o Escape).
    window.addEventListener('message', function (event) {
      if (event.origin === base && event.data && event.data.type === 'mitchbot:close') toggle(false);
    });

    window.MitchbotWidget = {
      open: function () { toggle(true); },
      close: function () { toggle(false); },
    };
  }

  function style(element, rules) {
    for (var key in rules) element.style[key] = rules[key];
  }
})();
