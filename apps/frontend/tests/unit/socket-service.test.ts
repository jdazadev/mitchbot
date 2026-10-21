import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Socket falso: guarda manejadores y emisiones; `active`/`connected` controlables. */
class FakeSocket {
  handlers = new Map<string, Set<(...args: any[]) => void>>()
  emitted: [string, unknown][] = []
  connected = false
  active = true
  constructor(public options: any) {}
  on(event: string, handler: (...args: any[]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return this
  }
  off(event: string, handler?: (...args: any[]) => void) {
    if (handler) this.handlers.get(event)?.delete(handler)
    else this.handlers.delete(event)
    return this
  }
  emit(event: string, payload: unknown) { this.emitted.push([event, payload]); return this }
  disconnect() { this.connected = false; this.active = false }
  fire(event: string, payload?: unknown) { this.handlers.get(event)?.forEach((h) => h(payload)) }
}

const sockets: FakeSocket[] = []
vi.mock('socket.io-client', () => ({
  io: (_url: string, options: any) => {
    const socket = new FakeSocket(options)
    sockets.push(socket)
    return socket
  },
}))

const { socketService } = await import('@/services/socket.service')

beforeEach(() => {
  socketService.disconnect()
  socketService.leavePublic()
  socketService.off('admin:notification')
  socketService.off('chat:message')
  socketService.lastRoom = null
  socketService.session = { token: null, projectId: null, slug: undefined }
  sockets.length = 0
  localStorage.clear()
})

describe('socketService', () => {
  it('sin sesión no abre el socket del panel, pero recuerda los manejadores', () => {
    const handler = vi.fn()
    socketService.onNotification(handler)
    expect(sockets).toHaveLength(0)

    // Tras iniciar sesión, cualquier suscripción conecta y entrega el manejador anterior.
    localStorage.setItem('mitchbot_token', 'token-1')
    localStorage.setItem('mitchbot_active_project', 'p1')
    socketService.onMessage(vi.fn())
    expect(sockets).toHaveLength(1)
    expect(sockets[0].options.auth).toEqual({ token: 'token-1', projectId: 'p1' })
    sockets[0].fire('admin:notification', { message: 'hola' })
    expect(handler).toHaveBeenCalledWith({ message: 'hola' })
  })

  it('un socket rechazado o de otra sesión se sustituye conservando los manejadores', () => {
    localStorage.setItem('mitchbot_token', 'token-1')
    const handler = vi.fn()
    socketService.onNotification(handler)
    const first = sockets[0]
    first.active = false // el servidor lo rechazó

    socketService.onNotification(handler)
    expect(sockets).toHaveLength(2)
    sockets[1].fire('admin:notification', 1)
    expect(handler).toHaveBeenCalledTimes(1)

    localStorage.setItem('mitchbot_token', 'token-2')
    socketService.ensure()
    expect(sockets).toHaveLength(3)
    expect(sockets[2].options.auth.token).toBe('token-2')
  })

  it('no duplica el manejador si se registra dos veces sobre el mismo socket', () => {
    localStorage.setItem('mitchbot_token', 'token-1')
    const handler = vi.fn()
    socketService.onNotification(handler)
    socketService.onNotification(handler)
    sockets[0].fire('admin:notification', 1)
    expect(handler).toHaveBeenCalledTimes(1)
    socketService.offNotification(handler)
    sockets[0].fire('admin:notification', 2)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('al reconectar vuelve a unirse a la última sala, con su token si es pública', () => {
    socketService.connect({ isPublic: true, slug: 'tienda' })
    socketService.joinRoom('c1', 'tok')
    expect(sockets[0].emitted).toEqual([['join:room', { roomId: 'c1', clientToken: 'tok' }]])
    sockets[0].fire('connect')
    expect(sockets[0].emitted.at(-1)).toEqual(['join:room', { roomId: 'c1', clientToken: 'tok' }])
  })

  it('al salir del chat público el panel vuelve a su socket autenticado', () => {
    localStorage.setItem('mitchbot_token', 'token-1')
    socketService.connect({ isPublic: true, slug: 'tienda' })
    expect(sockets[0].options.query).toEqual({ isPublic: 'true', slug: 'tienda' })
    socketService.leavePublic()
    socketService.onNotification(vi.fn())
    expect(sockets).toHaveLength(2)
    expect(sockets[1].options.auth.token).toBe('token-1')
    expect(sockets[1].options.query.isPublic).toBeUndefined()
  })
})
