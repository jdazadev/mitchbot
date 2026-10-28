import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import { isFacebookOrigin, parseSignupEvent, SignupFlowError, startSignup } from '@/lib/embedded-signup'
import { projectService } from '@/services/project.service'
import WhatsAppSignup from '@/components/settings/WhatsAppSignup.vue'

const FB_ORIGIN = 'https://www.facebook.com'
const settings = { appId: '100200300', configId: '400500600', apiVersion: 'v21.0' }
const finish = (event = 'FINISH', data: Record<string, unknown> = { phone_number_id: '111222333', waba_id: '444555666', business_id: '777888999' }) =>
  JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event, data })

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as any).FB
})

describe('parseSignupEvent', () => {
  it('solo acepta facebook.com por HTTPS', () => {
    expect(isFacebookOrigin('https://www.facebook.com')).toBe(true)
    expect(isFacebookOrigin('https://facebook.com')).toBe(true)
    expect(isFacebookOrigin('http://www.facebook.com')).toBe(false)
    expect(isFacebookOrigin('https://facebook.com.evil.test')).toBe(false)
    expect(isFacebookOrigin('https://evilfacebook.com')).toBe(false)
    expect(parseSignupEvent({ origin: 'https://evil.test', data: finish() })).toBeNull()
  })

  it('distingue Cloud API, coexistencia, cancelación y errores', () => {
    expect(parseSignupEvent({ origin: FB_ORIGIN, data: finish() })).toEqual({
      kind: 'finish', phoneNumberId: '111222333', wabaId: '444555666', businessId: '777888999', mode: 'cloud',
    })
    expect(parseSignupEvent({ origin: FB_ORIGIN, data: finish('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') })).toMatchObject({ kind: 'finish', mode: 'coexistence' })
    expect(parseSignupEvent({ origin: FB_ORIGIN, data: finish('CANCEL', { current_step: 'PHONE_NUMBER_SETUP' }) })).toEqual({ kind: 'cancel', step: 'PHONE_NUMBER_SETUP' })
    expect(parseSignupEvent({ origin: FB_ORIGIN, data: finish('CANCEL', { error_message: 'Número no válido' }) })).toEqual({ kind: 'error', message: 'Número no válido' })
    expect(parseSignupEvent({ origin: FB_ORIGIN, data: finish('FINISH_ONLY_WABA', { waba_id: '1' }) })).toEqual({ kind: 'error', message: 'no_number' })
    expect(parseSignupEvent({ origin: FB_ORIGIN, data: '{no es json' })).toBeNull()
    expect(parseSignupEvent({ origin: FB_ORIGIN, data: { type: 'OTRA_COSA' } })).toBeNull()
  })
})

/** SDK simulado: `login` devuelve el código y la ventana publica el evento indicado. */
function fakeFacebook(code: string | null, event?: string) {
  const fb = {
    init: vi.fn(),
    login: vi.fn((callback: (response: any) => void) => {
      if (event) window.dispatchEvent(new MessageEvent('message', { origin: FB_ORIGIN, data: event }))
      callback({ authResponse: code ? { code } : null })
    }),
  }
  ;(window as any).FB = fb
  return fb
}

describe('startSignup', () => {
  it('junta el código y el número', async () => {
    const fb = fakeFacebook('code-1', finish())
    await expect(startSignup(settings)).resolves.toEqual({
      code: 'code-1', phoneNumberId: '111222333', wabaId: '444555666', businessId: '777888999', mode: 'cloud',
    })
    expect(fb.init).toHaveBeenCalledWith(expect.objectContaining({ appId: '100200300', version: 'v21.0' }))
    expect(fb.login.mock.calls[0][1]).toMatchObject({ config_id: '400500600', response_type: 'code', override_default_response_type: true })
  })

  it('cerrar la ventana no es un error', async () => {
    fakeFacebook(null)
    await expect(startSignup(settings)).resolves.toBeNull()
  })

  it('un error de Meta se informa', async () => {
    fakeFacebook('code-2', finish('ERROR', { error_message: 'Algo falló' }))
    await expect(startSignup(settings)).rejects.toMatchObject({ reason: 'meta' })
  })

  it('si el número no llega a tiempo, aborta', async () => {
    vi.useFakeTimers()
    fakeFacebook('code-3')
    const pending = startSignup(settings).catch((error) => error)
    await vi.advanceTimersByTimeAsync(10_001)
    const error = await pending
    vi.useRealTimers()
    expect(error).toBeInstanceOf(SignupFlowError)
    expect(error.reason).toBe('timeout')
  })
})

describe('WhatsAppSignup', () => {
  const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })
  const config = { enabled: true, ...settings }
  const connection = {
    account: '111222333', wabaId: '444555666', mode: 'coexistence' as const, status: 'active' as const,
    displayPhone: '+57 300 111 2233', verifiedName: 'Panadería Sol', connectedAt: new Date().toISOString(),
  }
  const mountIt = (props: Record<string, unknown>) =>
    mount(WhatsAppSignup, { props: { config, connection: null, ...props }, global: { plugins: [i18n], stubs: { teleport: true } } })

  it('conecta y avisa con la conexión guardada', async () => {
    fakeFacebook('code-4', finish('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'))
    const complete = vi.spyOn(projectService, 'completeWhatsAppSignup').mockResolvedValue(connection)
    const wrapper = mountIt({})
    await wrapper.get('[data-testid="wa-signup-connect"]').trigger('click')
    await flushPromises()
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ code: 'code-4', mode: 'coexistence' }))
    expect(wrapper.emitted('connected')?.[0]).toEqual([connection])
  })

  it('muestra el error del servidor', async () => {
    fakeFacebook('code-5', finish())
    vi.spyOn(projectService, 'completeWhatsAppSignup').mockRejectedValue(new Error('Ese número de WhatsApp ya está conectado a otro proyecto'))
    const wrapper = mountIt({})
    await wrapper.get('[data-testid="wa-signup-connect"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="wa-signup-error"]').text()).toContain('otro proyecto')
    expect(wrapper.emitted('connected')).toBeUndefined()
  })

  it('muestra el número, el modo y ofrece reconectar si es inválida', () => {
    const wrapper = mountIt({ connection: { ...connection, status: 'invalid' } })
    expect(wrapper.get('[data-testid="wa-connection-phone"]').text()).toBe('+57 300 111 2233')
    expect(wrapper.get('[data-testid="wa-connection-mode"]').text()).toBe('Coexistencia')
    expect(wrapper.find('[data-testid="wa-signup-reconnect"]').exists()).toBe(true)
  })
})
