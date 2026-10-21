import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientToken, verifyClientToken } from '../../src/widget/access';
import { frameAncestors, InvalidOriginError, isWidgetAvailable, normalizeOrigin, normalizeOrigins, widgetSnippet } from '../../src/widget/config';
import { contrastFor, renderFrame } from '../../src/widget/frame';

test('el token de la conversación es estable, propio de cada id y del secreto', () => {
  const token = clientToken('abc', 'secreto');
  assert.equal(token, clientToken('abc', 'secreto'));
  assert.notEqual(token, clientToken('abd', 'secreto'));
  assert.notEqual(token, clientToken('abc', 'otro'));
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(verifyClientToken('abc', token, 'secreto'), true);
  assert.equal(verifyClientToken('abd', token, 'secreto'), false);
  assert.equal(verifyClientToken('abc', `${token}x`, 'secreto'), false);
  assert.equal(verifyClientToken('abc', undefined, 'secreto'), false);
  assert.equal(verifyClientToken('abc', 42, 'secreto'), false);
});

test('los orígenes se normalizan y se rechazan rutas o protocolos raros', () => {
  assert.equal(normalizeOrigin('https://Tienda.com/'), 'https://tienda.com');
  assert.equal(normalizeOrigin(' http://localhost:8080 '), 'http://localhost:8080');
  assert.equal(normalizeOrigin('https://*.tienda.com'), 'https://*.tienda.com');
  for (const bad of ['tienda.com', 'https://tienda.com/blog', 'ftp://tienda.com', 'https://tienda.com?x=1', 'https://user:pw@tienda.com', 'javascript:alert(1)']) {
    assert.throws(() => normalizeOrigin(bad), InvalidOriginError, bad);
  }
  assert.deepEqual(normalizeOrigins(['https://a.com', 'https://a.com/', '', 'https://b.com']), ['https://a.com', 'https://b.com']);
});

test('frame-ancestors combina el propio backend, el panel y las webs del cliente sin repetir', () => {
  assert.equal(frameAncestors([], ['http://localhost:5173']), "frame-ancestors 'self' http://localhost:5173");
  assert.equal(
    frameAncestors(['https://tienda.com', 'http://localhost:5173'], ['http://localhost:5173']),
    "frame-ancestors 'self' http://localhost:5173 https://tienda.com",
  );
});

test('el widget solo está disponible activo y con el canal Web habilitado', () => {
  const base = { status: 'active' as const, config: { channels: { web: true, whatsapp: false, instagram: false }, widget: { enabled: true } } } as any;
  assert.equal(isWidgetAvailable(base), true);
  assert.equal(isWidgetAvailable({ ...base, config: { ...base.config, widget: { enabled: false } } }), false);
  assert.equal(isWidgetAvailable({ ...base, config: { ...base.config, channels: { web: false } } }), false);
  assert.equal(isWidgetAvailable({ ...base, status: 'inactive' }), false);
  assert.equal(isWidgetAvailable(null), false);
});

test('el fragmento apunta al cargador del backend con el slug', () => {
  assert.equal(widgetSnippet('https://api.mitchbot.io/', 'mi-tienda'), '<script src="https://api.mitchbot.io/widget.js" data-mitchbot="mi-tienda" async></script>');
});

test('la tinta sobre la marca es legible', () => {
  assert.equal(contrastFor('#E2C6FF'), 'dark');
  assert.equal(contrastFor('#0E7490'), 'light');
  assert.equal(contrastFor('#fff'), 'dark');
});

test('la página escapa el contenido del proyecto y no permite cerrar el bloque de configuración', () => {
  const html = renderFrame({
    slug: 'mi-tienda', title: 'Tienda <b>"Uno"</b>', greeting: 'Hola </script><script>alert(1)</script>',
    color: '#E2C6FF', colorContrast: 'dark', language: 'es',
  });
  assert.match(html, /<title>Tienda &lt;b&gt;&quot;Uno&quot;&lt;\/b&gt;<\/title>/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /\\u003c\/script>/);
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<script src="\/widget\/frame\.js"><\/script>/);
});
