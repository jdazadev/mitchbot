import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import { invalidOrigins, originLines, widgetFrameUrl, widgetSnippet, type WidgetForm } from '@/lib/widget'
import WidgetSettings from '@/components/settings/WidgetSettings.vue'

afterEach(() => vi.restoreAllMocks())

describe('lib/widget', () => {
  it('separa los dominios por línea o coma y detecta los inválidos', () => {
    expect(originLines(' https://a.com \n\nhttps://b.com, https://c.com')).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
    expect(invalidOrigins('https://a.com\nb.com\nhttps://c.com/tienda\nhttps://*.d.com\nhttp://localhost:8080')).toEqual(['b.com', 'https://c.com/tienda'])
  })

  it('el fragmento y la vista previa apuntan al origen del backend', () => {
    expect(widgetSnippet('https://api.mitchbot.io/api', 'tienda', 'https://app.mitchbot.io'))
      .toBe('<script src="https://api.mitchbot.io/widget.js" data-mitchbot="tienda" async></script>')
    expect(widgetSnippet('/api', 'tienda', 'https://app.mitchbot.io'))
      .toBe('<script src="https://app.mitchbot.io/widget.js" data-mitchbot="tienda" async></script>')
    expect(widgetFrameUrl('http://localhost:3000/api', 'mi tienda', 'http://localhost:5173'))
      .toBe('http://localhost:3000/api/public/widget/mi%20tienda/frame')
  })
})

describe('WidgetSettings', () => {
  const i18n = createI18n({ legacy: false, locale: 'es', messages: { es } })
  const form = (overrides: Partial<WidgetForm> = {}): WidgetForm => ({ enabled: true, allowedOrigins: '', position: 'right', title: '', greeting: '', ...overrides })
  const render = (modelValue: WidgetForm, savedEnabled = true) =>
    mount(WidgetSettings, {
      props: { modelValue, slug: 'tienda', apiBase: 'http://localhost:3000/api', savedEnabled, 'onUpdate:modelValue': () => {} },
      global: { plugins: [i18n] },
    })

  it('desactivado solo muestra el interruptor', () => {
    const wrapper = render(form({ enabled: false }))
    expect(wrapper.find('#widget-origins').exists()).toBe(false)
    expect(wrapper.find('#widget-snippet').exists()).toBe(false)
  })

  it('avisa de los dominios inválidos y muestra el fragmento', () => {
    const wrapper = render(form({ allowedOrigins: 'https://ok.com\nmal.com' }))
    expect(wrapper.text()).toContain('Revisa estos dominios: mal.com')
    expect(wrapper.get('#widget-origins').attributes('aria-invalid')).toBe('true')
    expect((wrapper.get('#widget-snippet').element as HTMLInputElement).value)
      .toBe('<script src="http://localhost:3000/widget.js" data-mitchbot="tienda" async></script>')
  })

  it('copia el fragmento', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const wrapper = render(form())
    await wrapper.findAll('button').find((b) => b.text() === 'Copiar código')!.trigger('click')
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('<script src="http://localhost:3000/widget.js" data-mitchbot="tienda" async></script>')
    expect(wrapper.emitted('copied')).toHaveLength(1)
  })

  it('la vista previa necesita el widget guardado como activo', async () => {
    const unsaved = render(form(), false)
    const previewButton = unsaved.findAll('button').find((b) => b.text().includes('Vista previa'))!
    expect(previewButton.attributes('disabled')).toBeDefined()
    expect(unsaved.text()).toContain('Guarda los canales con el widget activado')

    const saved = render(form(), true)
    await saved.findAll('button').find((b) => b.text().includes('Vista previa'))!.trigger('click')
    expect(saved.get('[data-testid="widget-preview"]').attributes('src')).toBe('http://localhost:3000/api/public/widget/tienda/frame')
  })
})
