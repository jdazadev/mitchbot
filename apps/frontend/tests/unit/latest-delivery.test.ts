import { describe, expect, it } from 'vitest'
import { latestDelivery, mergeMessages } from '@/lib/delivery'
import type { MessageDelivery } from '@/services/messaging.service'

const at = (status: MessageDelivery['status'], updatedAt: string): MessageDelivery => ({ status, attempts: 1, updatedAt })

describe('latestDelivery', () => {
  it('aplica el primer estado conocido', () => {
    expect(latestDelivery(undefined, at('queued', '2026-10-21T10:00:00Z')).status).toBe('queued')
  })

  it('un queued que llega tarde no pisa el sent del worker', () => {
    const sent = at('sent', '2026-10-21T10:00:01Z')
    expect(latestDelivery(sent, at('queued', '2026-10-21T10:00:00Z'))).toBe(sent)
  })

  it('un estado más reciente reemplaza al anterior', () => {
    const queued = at('queued', '2026-10-21T10:00:02Z')
    expect(latestDelivery(at('failed', '2026-10-21T10:00:00Z'), queued)).toBe(queued)
  })

  it('sin fechas comparables gana lo que llega', () => {
    const incoming = at('sent', 'nunca')
    expect(latestDelivery(at('queued', '2026-10-21T10:00:00Z'), incoming)).toBe(incoming)
  })
})

describe('mergeMessages', () => {
  const msg = (_id: string, createdAt: string, delivery?: MessageDelivery) => ({ _id, createdAt, delivery })

  it('conserva los mensajes recibidos en vivo que el historial aún no traía', () => {
    const merged = mergeMessages(
      [msg('a', '2026-10-21T10:00:00Z'), msg('b', '2026-10-21T10:01:00Z')],
      [msg('c', '2026-10-21T10:02:00Z'), msg('b', '2026-10-21T10:01:00Z')],
    )
    expect(merged.map((m) => m._id)).toEqual(['a', 'b', 'c'])
  })

  it('una burbuja vacía del bot toma el texto que ya tiene el servidor', () => {
    const [merged] = mergeMessages([{ _id: 'a', createdAt: '2026-10-21T10:00:00Z', content: '' }], [{ _id: 'a', createdAt: '2026-10-21T10:00:00Z', content: 'Hola' }])
    expect(merged.content).toBe('Hola')
  })

  it('aplica el estado de entrega más reciente de los dos', () => {
    const [merged] = mergeMessages(
      [msg('a', '2026-10-21T10:00:00Z', at('queued', '2026-10-21T10:00:01Z'))],
      [msg('a', '2026-10-21T10:00:00Z', at('sent', '2026-10-21T10:00:02Z'))],
    )
    expect(merged.delivery?.status).toBe('sent')
  })
})
