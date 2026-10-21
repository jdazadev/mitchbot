import { describe, expect, it } from 'vitest'
import { whatsAppWebhookUrl } from '@/services/project.service'

describe('whatsAppWebhookUrl', () => {
  it('cuelga el webhook de la URL absoluta de la API', () => {
    expect(whatsAppWebhookUrl('https://api.mitchbot.io/api', 'https://app.mitchbot.io'))
      .toBe('https://api.mitchbot.io/api/webhooks/whatsapp')
    expect(whatsAppWebhookUrl('https://api.mitchbot.io/api/', 'https://app.mitchbot.io'))
      .toBe('https://api.mitchbot.io/api/webhooks/whatsapp')
  })

  it('resuelve una API relativa contra el origen de la app', () => {
    expect(whatsAppWebhookUrl('/api', 'https://app.mitchbot.io')).toBe('https://app.mitchbot.io/api/webhooks/whatsapp')
  })
})
