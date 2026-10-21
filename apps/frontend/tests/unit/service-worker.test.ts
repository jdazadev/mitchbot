import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

/** Ejecuta `public/sw.js` con un `self` falso y devuelve sus manejadores. */
function loadWorker(windows: any[] = []) {
  const listeners: Record<string, (event: any) => void> = {}
  const self = {
    location: { origin: 'https://app.mitchbot.io' },
    addEventListener: (type: string, handler: (event: any) => void) => { listeners[type] = handler },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: { matchAll: vi.fn().mockResolvedValue(windows), openWindow: vi.fn().mockResolvedValue(undefined) },
  }
  new Function('self', readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8'))(self)
  return { self, listeners }
}

function event(extra: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve()
  return { ...extra, waitUntil: (p: Promise<unknown>) => { pending = p }, done: () => pending }
}

describe('service worker', () => {
  it('muestra el push con su texto, etiqueta y enlace', async () => {
    const { self, listeners } = loadWorker()
    const e = event({ data: { json: () => ({ title: 'Mitchbot', body: 'Ana espera', tag: 'sla:c1', url: '/messaging?conversation=c1', urgent: true }) } })
    listeners.push(e)
    await e.done()
    expect(self.registration.showNotification).toHaveBeenCalledWith('Mitchbot', {
      body: 'Ana espera', tag: 'sla:c1', renotify: true, requireInteraction: true, data: { url: '/messaging?conversation=c1' },
    })
  })

  it('un push sin JSON se muestra como texto', async () => {
    const { self, listeners } = loadWorker()
    const e = event({ data: { json: () => { throw new Error('no json') }, text: () => 'Hola' } })
    listeners.push(e)
    await e.done()
    expect(self.registration.showNotification).toHaveBeenCalledWith('Mitchbot', expect.objectContaining({ body: 'Hola' }))
  })

  it('al pulsar enfoca una pestaña del panel y la lleva a la conversación', async () => {
    const tab = { url: 'https://app.mitchbot.io/', focus: vi.fn(), navigate: vi.fn() }
    tab.focus.mockResolvedValue(tab)
    const { self, listeners } = loadWorker([{ url: 'https://otra.web/' }, tab])
    const close = vi.fn()
    const e = event({ notification: { close, data: { url: '/messaging?conversation=c1' } } })
    listeners.notificationclick(e)
    await e.done()
    expect(close).toHaveBeenCalled()
    expect(tab.navigate).toHaveBeenCalledWith('https://app.mitchbot.io/messaging?conversation=c1')
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })

  it('sin pestañas abiertas abre una nueva', async () => {
    const { self, listeners } = loadWorker()
    const e = event({ notification: { close: vi.fn(), data: { url: '/tools?tab=approvals' } } })
    listeners.notificationclick(e)
    await e.done()
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://app.mitchbot.io/tools?tab=approvals')
  })
})
