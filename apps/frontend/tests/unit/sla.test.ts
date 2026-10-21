import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import { formatDuration, waitState } from '@/lib/sla'
import SlaPanel from '@/components/dashboard/SlaPanel.vue'
import type { DashboardSla } from '@/services/dashboard.service'

const now = Date.parse('2026-10-21T12:00:00Z')
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

describe('lib/sla', () => {
  it('clasifica la espera respecto al objetivo', () => {
    expect(waitState(null, 20, now)).toBeNull()
    expect(waitState(ago(10), 20, now)).toBe('ok')
    expect(waitState(ago(15), 20, now)).toBe('at_risk')
    expect(waitState(ago(21), 20, now)).toBe('breached')
    expect(waitState('no es fecha', 20, now)).toBeNull()
  })

  it('formatea duraciones cortas y largas', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(45_000)).toBe('45 s')
    expect(formatDuration(12 * 60_000)).toBe('12 min')
    expect(formatDuration(3 * 3_600_000 + 5 * 60_000)).toBe('3 h 5 min')
    expect(formatDuration(2 * 3_600_000)).toBe('2 h')
    expect(formatDuration(52 * 3_600_000)).toBe('2 d 4 h')
  })
})

describe('SlaPanel', () => {
  const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })
  const sla = (overrides: Partial<DashboardSla> = {}): DashboardSla => ({
    targets: { responseMinutes: 10, resolutionHours: 2, alerts: true },
    response: { total: 3, onTime: 1, rate: 33, medianMs: 31 * 60_000, p90Ms: 60 * 60_000 },
    resolution: { total: 2, onTime: 1, rate: 50, medianMs: 40 * 60_000 },
    now: { breached: 1, atRisk: 2, conversations: [{ id: 'c1', name: 'Laura', platform: 'WhatsApp', awaitingReplySince: ago(45) }] },
    ...overrides,
  })
  const render = (value: DashboardSla | null, isLoading = false) =>
    mount(SlaPanel, { props: { sla: value, isLoading, now }, global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } } })

  it('muestra cumplimiento, espera y esperas vencidas con enlace', () => {
    const wrapper = render(sla())
    expect(wrapper.get('[data-testid="stat-sla-response"]').text()).toContain('Respuesta en 10 min')
    expect(wrapper.get('[data-testid="stat-sla-response"]').text()).toContain('33 %')
    expect(wrapper.get('[data-testid="stat-sla-response"]').text()).toContain('1 de 3 mensajes a tiempo')
    expect(wrapper.get('[data-testid="stat-sla-resolution"]').text()).toContain('50 %')
    expect(wrapper.get('[data-testid="stat-sla-wait"]').text()).toContain('31 min')
    expect(wrapper.get('[data-testid="stat-sla-wait"]').text()).toContain('El 90 % espera menos de 1 h')
    expect(wrapper.get('[data-testid="stat-sla-breached"]').text()).toContain('2 vencen pronto')
    const waiting = wrapper.get('[data-testid="sla-waiting"]')
    expect(waiting.text()).toContain('Laura')
    expect(waiting.text()).toContain('esperando 45 min')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual({ path: '/messaging', query: { conversation: 'c1' } })
  })

  it('sin datos del rango lo dice en lugar de mostrar ceros', () => {
    const wrapper = render(sla({
      response: { total: 0, onTime: 0, rate: null, medianMs: null, p90Ms: null },
      resolution: { total: 0, onTime: 0, rate: null, medianMs: null },
      now: { breached: 0, atRisk: 0, conversations: [] },
    }))
    expect(wrapper.get('[data-testid="stat-sla-response"]').text()).toContain('—')
    expect(wrapper.text()).toContain('Sin mensajes en este rango')
    expect(wrapper.find('[data-testid="sla-waiting"]').exists()).toBe(false)
  })
})
