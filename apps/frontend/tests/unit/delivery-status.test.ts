import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import DeliveryStatus from '@/components/messaging/DeliveryStatus.vue'
import type { MessageDelivery } from '@/services/messaging.service'

const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })

function render(delivery?: Partial<MessageDelivery>, props: Record<string, unknown> = {}) {
  return mount(DeliveryStatus, {
    props: {
      delivery: delivery ? { attempts: 1, updatedAt: '2026-10-20T10:00:00Z', ...delivery } as MessageDelivery : undefined,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

describe('DeliveryStatus', () => {
  it('no pinta nada sin estado de entrega (mensajes Web)', () => {
    expect(render().find('[data-testid="delivery-status"]').exists()).toBe(false)
  })

  it('muestra enviando y enviado sin acciones', () => {
    expect(render({ status: 'queued' }).text()).toContain('Enviando…')
    const sent = render({ status: 'sent' })
    expect(sent.text()).toContain('Enviado')
    expect(sent.find('button').exists()).toBe(false)
  })

  it('distingue entregado y leído con el doble check', () => {
    const delivered = render({ status: 'delivered' })
    expect(delivered.get('[data-testid="delivery-status"]').attributes('data-status')).toBe('delivered')
    expect(delivered.text()).toContain('Entregado')
    const read = render({ status: 'read' })
    expect(read.get('[data-testid="delivery-status"]').attributes('data-status')).toBe('read')
    expect(read.text()).toContain('Leído')
    expect(read.find('button').exists()).toBe(false)
  })

  it('anuncia el fallo con su motivo y emite retry', async () => {
    const wrapper = render({ status: 'failed', error: 'Número no válido' })
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toContain('No entregado')
    expect(status.text()).toContain('Número no válido')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('desactiva el botón mientras reintenta y avisa si el reintento falla', () => {
    const retrying = render({ status: 'failed' }, { retrying: true })
    expect(retrying.get('button').attributes('disabled')).toBeDefined()
    expect(retrying.get('button').text()).toBe('Reintentando…')
    expect(render({ status: 'failed' }, { retryError: true }).text()).toContain('no se pudo reintentar')
  })
})
