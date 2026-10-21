import { describe, expect, it } from 'vitest'
import { channelIcon, channelMeta, channelTone } from '@/lib/channels'

describe('channelMeta', () => {
  it('asigna el pastel semántico de cada canal', () => {
    expect(channelTone('WhatsApp')).toBe('lime')
    expect(channelTone('Instagram')).toBe('lilac')
    expect(channelTone('Web')).toBe('sky')
  })

  it('cae a Web con un canal desconocido o vacío', () => {
    expect(channelMeta('Telegram')).toEqual(channelMeta('Web'))
    expect(channelIcon(undefined)).toBe('Globe')
  })
})
