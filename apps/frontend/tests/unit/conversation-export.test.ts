import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import { downloadBlob, fileNameFromDisposition } from '@/lib/download'
import { messagingService } from '@/services/messaging.service'
import ExportDialog from '@/components/messaging/ExportDialog.vue'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('fileNameFromDisposition', () => {
  it('prefiere filename* y decodifica UTF-8', () => {
    expect(fileNameFromDisposition(`attachment; filename="a.csv"; filename*=UTF-8''mitchbot-conversaci%C3%B3n.csv`, 'x')).toBe('mitchbot-conversación.csv')
  })

  it('usa filename o el nombre por defecto', () => {
    expect(fileNameFromDisposition('attachment; filename="mitchbot.json"', 'x')).toBe('mitchbot.json')
    expect(fileNameFromDisposition('attachment; filename=plano.csv', 'x')).toBe('plano.csv')
    expect(fileNameFromDisposition(null, 'por-defecto.csv')).toBe('por-defecto.csv')
  })
})

describe('downloadBlob', () => {
  it('dispara la descarga con el nombre y libera la URL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mitchbot')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('mitchbot.csv')
      expect(this.href).toBe('blob:mitchbot')
    })
    downloadBlob(new Blob(['a']), 'mitchbot.csv')
    expect(create).toHaveBeenCalled()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(revoke).toHaveBeenCalledWith('blob:mitchbot')
  })
})

describe('messagingService.exportConversations', () => {
  function mockFetch(status = 200, body: BodyInit = 'csv', headers: Record<string, string> = {}) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status, headers }))
  }

  it('pide los últimos días y el canal, y lee el nombre del archivo', async () => {
    const fetchMock = mockFetch(200, 'a,b', { 'Content-Disposition': 'attachment; filename="mitchbot-conversaciones-tienda.csv"' })
    const file = await messagingService.exportConversations({ format: 'csv', days: 7, platform: 'WhatsApp' })
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toMatch(/\/conversations\/export$/)
    expect(Object.fromEntries(url.searchParams)).toEqual({ format: 'csv', days: '7', platform: 'WhatsApp' })
    expect(file.fileName).toBe('mitchbot-conversaciones-tienda.csv')
  })

  it('con fechas no envía days ni el canal "All"', async () => {
    const fetchMock = mockFetch()
    await messagingService.exportConversations({ format: 'json', days: 30, from: '2026-10-01', to: '2026-10-07', platform: 'All' })
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({ format: 'json', from: '2026-10-01', to: '2026-10-07' })
  })

  it('propaga el error del servidor', async () => {
    mockFetch(400, JSON.stringify({ error: 'El rango máximo es de 366 días' }))
    await expect(messagingService.exportConversations({ format: 'csv', days: 400 })).rejects.toThrow('El rango máximo es de 366 días')
  })
})

describe('ExportDialog', () => {
  const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })
  const render = () =>
    mount(ExportDialog, {
      props: { open: true, channels: ['All', 'WhatsApp', 'Web'] },
      global: { plugins: [i18n], stubs: { teleport: true } },
      attachTo: document.body,
    })

  it('exporta con el periodo, canal y formato elegidos', async () => {
    const exportMock = vi.spyOn(messagingService, 'exportConversations').mockResolvedValue({ blob: new Blob(['x']), fileName: 'f.json' })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = render()

    const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)!
    await button('Últimos 7 días').trigger('click')
    await button('WhatsApp').trigger('click')
    await button('JSON').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(exportMock).toHaveBeenCalledWith({ format: 'json', platform: 'WhatsApp', days: 7 })
    expect(wrapper.emitted('exported')?.[0]).toEqual(['f.json'])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('no exporta con fechas propias incompletas o invertidas', async () => {
    const exportMock = vi.spyOn(messagingService, 'exportConversations')
    const wrapper = render()
    await wrapper.findAll('button').find((b) => b.text() === 'Fechas')!.trigger('click')
    const [from, to] = wrapper.findAll('input[type="date"]')
    await from.setValue('2026-10-10')
    await to.setValue('2026-10-01')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Elige una fecha inicial y una final')
    expect(exportMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('muestra el error del servidor sin cerrar', async () => {
    vi.spyOn(messagingService, 'exportConversations').mockRejectedValue(new Error('El rango máximo es de 366 días'))
    const wrapper = render()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('El rango máximo es de 366 días')
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })
})
