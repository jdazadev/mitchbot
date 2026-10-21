import { describe, expect, it } from 'vitest'
import { channelWebhookUrl } from '@/services/project.service'
import { isValidAccountId } from '@/lib/channels'

describe('channelWebhookUrl', () => {
  it('cuelga el webhook de la URL absoluta de la API', () => {
    expect(channelWebhookUrl('whatsapp', 'https://api.mitchbot.io/api', 'https://app.mitchbot.io'))
      .toBe('https://api.mitchbot.io/api/webhooks/whatsapp')
    expect(channelWebhookUrl('instagram', 'https://api.mitchbot.io/api/', 'https://app.mitchbot.io'))
      .toBe('https://api.mitchbot.io/api/webhooks/instagram')
  })

  it('resuelve una API relativa contra el origen de la app', () => {
    expect(channelWebhookUrl('whatsapp', '/api', 'https://app.mitchbot.io')).toBe('https://app.mitchbot.io/api/webhooks/whatsapp')
  })
})

describe('isValidAccountId', () => {
  it('solo acepta IDs numéricos de Meta', () => {
    expect(isValidAccountId('106540352242922')).toBe(true)
    expect(isValidAccountId(' 17841400000000001 ')).toBe(true)
    expect(isValidAccountId('12ab')).toBe(false)
    expect(isValidAccountId('123')).toBe(false)
  })
})

import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { vi } from 'vitest'
import es from '@/locales/es.json'
import ChannelConnection from '@/components/settings/ChannelConnection.vue'

const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })

function render(props: Record<string, unknown>) {
  return mount(ChannelConnection, {
    props: { channel: 'instagram', modelValue: '', webhookUrl: 'https://api.test/api/webhooks/instagram', ...props },
    global: { plugins: [i18n] },
  })
}

describe('ChannelConnection', () => {
  it('muestra las etiquetas del canal y la URL de su webhook', () => {
    const wrapper = render({})
    expect(wrapper.get('[data-testid="instagram-connection"]').text()).toContain('ID de la cuenta de Instagram')
    expect((wrapper.get('#instagram-webhook').element as HTMLInputElement).value).toBe('https://api.test/api/webhooks/instagram')
  })

  it('avisa de un ID no numérico y lo marca como inválido', () => {
    const wrapper = render({ modelValue: 'mi_cuenta' })
    expect(wrapper.text()).toContain('El ID de la cuenta de Instagram solo contiene dígitos.')
    expect(wrapper.get('#instagram-account').attributes('aria-invalid')).toBe('true')
  })

  it('indica qué le falta al servidor', () => {
    const wrapper = render({ status: { connected: false, missing: ['INSTAGRAM_TOKEN', 'INSTAGRAM_APP_SECRET'] } })
    expect(wrapper.get('[data-testid="instagram-server-status"]').text()).toContain('faltan INSTAGRAM_TOKEN, INSTAGRAM_APP_SECRET')
  })

  it('emite el v-model y copia la URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText)
    const wrapper = render({})
    await wrapper.get('#instagram-account').setValue('17841400000000001')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['17841400000000001'])
    await wrapper.get('button').trigger('click')
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('https://api.test/api/webhooks/instagram')
    expect(wrapper.emitted('copied')).toHaveLength(1)
  })
})
