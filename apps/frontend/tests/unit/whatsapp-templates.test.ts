import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import { emptyParameters, isWindowClosed, parametersComplete, previewTemplate, WINDOW_MS, type WhatsAppTemplate } from '@/lib/templates'
import { messagingService } from '@/services/messaging.service'
import TemplatePicker from '@/components/messaging/TemplatePicker.vue'

const order: WhatsAppTemplate = {
  name: 'seguimiento_pedido', language: 'es', category: 'UTILITY', parameterFormat: 'positional',
  header: 'Pedido {{1}}', body: 'Hola {{1}}, tu pedido {{2}} está en camino.', footer: 'Mitchbot',
  buttons: [{ type: 'QUICK_REPLY', text: 'Gracias' }],
  variables: [
    { component: 'header', key: '1', example: 'A-12' },
    { component: 'body', key: '1', example: 'Ana' },
    { component: 'body', key: '2', example: 'A-12' },
  ],
  supported: true,
}
const promo: WhatsAppTemplate = {
  name: 'promo_imagen', language: 'es', category: 'MARKETING', parameterFormat: 'positional', body: 'Oferta',
  buttons: [], variables: [], supported: false, unsupportedReason: 'Tiene una cabecera multimedia',
}

afterEach(() => vi.restoreAllMocks())

describe('lib/templates', () => {
  it('rellena la vista previa y deja visibles las variables vacías', () => {
    const params = emptyParameters(order)
    expect(params).toEqual({ header: [''], body: ['', ''] })
    expect(previewTemplate(order, params)).toBe('Pedido {{1}}\n\nHola {{1}}, tu pedido {{2}} está en camino.\n\nMitchbot')
    expect(previewTemplate(order, { header: ['A-12'], body: [' Ana ', ''] })).toBe('Pedido A-12\n\nHola Ana, tu pedido {{2}} está en camino.\n\nMitchbot')
    expect(parametersComplete({ header: ['A'], body: ['B', ' '] })).toBe(false)
    expect(parametersComplete({ header: ['A'], body: ['B', 'C'] })).toBe(true)
  })

  it('la ventana se cierra a las 24 h del último mensaje del cliente', () => {
    const now = Date.parse('2026-10-21T12:00:00Z')
    expect(isWindowClosed(new Date(now - WINDOW_MS + 60_000).toISOString(), now)).toBe(false)
    expect(isWindowClosed(new Date(now - WINDOW_MS - 60_000).toISOString(), now)).toBe(true)
    expect(isWindowClosed(undefined, now)).toBe(false)
    expect(isWindowClosed('no es fecha', now)).toBe(false)
  })
})

describe('TemplatePicker', () => {
  const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })
  const render = () =>
    mount(TemplatePicker, {
      props: { open: true, conversationId: 'conv-1', windowClosed: true },
      global: { plugins: [i18n], stubs: { teleport: true } },
      attachTo: document.body,
    })

  it('lista las plantillas, bloquea las no compatibles y envía con variables', async () => {
    vi.spyOn(messagingService, 'listTemplates').mockResolvedValue([order, promo])
    const send = vi.spyOn(messagingService, 'sendTemplate').mockResolvedValue({ _id: 'm1' } as any)
    const wrapper = render()
    await flushPromises()

    expect(wrapper.text()).toContain('solo permite escribirle con una plantilla')
    const promoButton = wrapper.get('[data-template="promo_imagen"]')
    expect(promoButton.attributes('disabled')).toBeDefined()
    expect(promoButton.text()).toContain('No compatible: Tiene una cabecera multimedia')

    await wrapper.get('[data-template="seguimiento_pedido"]').trigger('click')
    expect(wrapper.text()).toContain('Cabecera · {{1}}')
    expect(wrapper.text()).toContain('Variable {{2}}')
    const submit = wrapper.findAll('button').find((b) => b.text() === 'Enviar plantilla')!
    expect(submit.attributes('disabled')).toBeDefined()

    const inputs = wrapper.findAll('input.field')
    expect(inputs[1].attributes('placeholder')).toBe('Ej. Ana')
    await inputs[0].setValue('A-12')
    await inputs[1].setValue('Ana')
    await inputs[2].setValue('A-12')
    expect(wrapper.get('[data-testid="template-preview"]').text()).toBe('Pedido A-12\n\nHola Ana, tu pedido A-12 está en camino.\n\nMitchbot')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(send).toHaveBeenCalledWith('conv-1', { name: 'seguimiento_pedido', language: 'es', parameters: { header: ['A-12'], body: ['Ana', 'A-12'] } })
    expect(wrapper.emitted('sent')?.[0]).toEqual([{ _id: 'm1' }])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('muestra el motivo si no se pueden cargar y permite reintentar', async () => {
    const list = vi.spyOn(messagingService, 'listTemplates').mockRejectedValueOnce(new Error('Configura el ID de la cuenta de WhatsApp Business (WABA)'))
    list.mockResolvedValueOnce([order])
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('WABA')
    await wrapper.findAll('button').find((b) => b.text() === 'Reintentar')!.trigger('click')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(true)
    expect(wrapper.find('[data-template="seguimiento_pedido"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('deja la ventana abierta con el error de envío', async () => {
    vi.spyOn(messagingService, 'listTemplates').mockResolvedValue([{ ...order, header: undefined, variables: [], body: 'Hola' }])
    vi.spyOn(messagingService, 'sendTemplate').mockRejectedValue(new Error('La plantilla no existe o no está aprobada'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-template="seguimiento_pedido"]').trigger('click')
    expect(wrapper.text()).toContain('Esta plantilla no tiene variables.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('no está aprobada')
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })
})
