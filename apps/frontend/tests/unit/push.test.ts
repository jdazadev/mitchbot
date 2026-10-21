import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import { pushStatus, urlBase64ToUint8Array } from '@/lib/push'
import { pushService } from '@/services/push.service'
import PushSettings from '@/components/profile/PushSettings.vue'

afterEach(() => vi.restoreAllMocks())

describe('lib/push', () => {
  it('convierte la clave pública VAPID a bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239])
  })

  it('el estado va de lo más bloqueante a lo activo', () => {
    const base = { supported: true, serverEnabled: true, permission: 'default' as NotificationPermission, subscribed: false }
    expect(pushStatus({ ...base, supported: false })).toBe('unsupported')
    expect(pushStatus({ ...base, serverEnabled: false })).toBe('unavailable')
    expect(pushStatus({ ...base, permission: 'denied' })).toBe('denied')
    expect(pushStatus(base)).toBe('off')
    expect(pushStatus({ ...base, permission: 'granted', subscribed: true })).toBe('on')
  })
})

describe('PushSettings', () => {
  const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })
  const allOn = { team: true, approval: true, delivery: true, channel: true, sla: true }
  // happy-dom no trae Push API: se simula lo justo para que el componente la vea.
  function browserWithPush(permission: NotificationPermission = 'default') {
    vi.stubGlobal('PushManager', function PushManager() {})
    vi.stubGlobal('Notification', { permission, requestPermission: vi.fn().mockResolvedValue('granted') })
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
  }
  const render = (role = 'support') => mount(PushSettings, { props: { role }, global: { plugins: [i18n] } })

  it('sin claves en el servidor lo dice y no ofrece activarlas', async () => {
    browserWithPush()
    vi.spyOn(pushService, 'getConfig').mockResolvedValue({ enabled: false })
    vi.spyOn(pushService, 'getMine').mockResolvedValue({ preferences: allOn, devices: 0, endpoints: [] })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-testid="push-status"]').attributes('data-status')).toBe('unavailable')
    expect(wrapper.text()).toContain('El servidor no las tiene configuradas')
    expect(wrapper.find('button').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('activa, prueba y muestra solo los tipos del rol', async () => {
    browserWithPush()
    vi.spyOn(pushService, 'getConfig').mockResolvedValue({ enabled: true, publicKey: 'AQID' })
    vi.spyOn(pushService, 'getMine').mockResolvedValue({ preferences: { ...allOn, sla: false }, devices: 0, endpoints: [] })
    vi.spyOn(pushService, 'currentSubscription').mockResolvedValue(null)
    const enable = vi.spyOn(pushService, 'enable').mockResolvedValue({} as PushSubscription)
    const test = vi.spyOn(pushService, 'sendTest').mockResolvedValue({ devices: 1 })
    const wrapper = render('support')
    await flushPromises()

    expect(wrapper.get('[data-testid="push-status"]').text()).toContain('Desactivadas en este dispositivo')
    expect(wrapper.text()).not.toContain('Aprobaciones pendientes')
    expect((wrapper.get('input[aria-label="Esperas vencidas"]').element as HTMLInputElement).checked).toBe(false)

    await wrapper.findAll('button').find((b) => b.text() === 'Activar en este dispositivo')!.trigger('click')
    await flushPromises()
    expect(enable).toHaveBeenCalledWith('AQID')
    expect(wrapper.get('[data-testid="push-status"]').attributes('data-status')).toBe('on')

    await wrapper.findAll('button').find((b) => b.text() === 'Enviar prueba')!.trigger('click')
    await flushPromises()
    expect(test).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Prueba enviada')
    vi.unstubAllGlobals()
  })

  it('cambiar un tipo lo guarda y lo revierte si falla', async () => {
    browserWithPush('granted')
    vi.spyOn(pushService, 'getConfig').mockResolvedValue({ enabled: true, publicKey: 'AQID' })
    vi.spyOn(pushService, 'getMine').mockResolvedValue({ preferences: allOn, devices: 1, endpoints: [] })
    vi.spyOn(pushService, 'currentSubscription').mockResolvedValue({} as PushSubscription)
    const update = vi.spyOn(pushService, 'updatePreferences').mockRejectedValue(new Error('x'))
    const wrapper = render('admin')
    await flushPromises()
    expect(wrapper.text()).toContain('Aprobaciones pendientes')
    const team = wrapper.get('input[aria-label="Mensajes del equipo"]')
    await team.setValue(false)
    await flushPromises()
    expect(update).toHaveBeenCalledWith({ team: false })
    expect((team.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo completar')
    vi.unstubAllGlobals()
  })
})
