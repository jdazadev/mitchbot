import { describe, expect, it } from 'vitest'
import { latestDelivery } from '@/lib/delivery'
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
