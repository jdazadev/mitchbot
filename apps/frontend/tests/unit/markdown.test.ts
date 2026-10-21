import { describe, expect, it } from 'vitest'
import { escapeHtml, renderMarkdown } from '@/lib/markdown'

describe('renderMarkdown', () => {
  it('aplica negritas, itálicas y saltos de línea', () => {
    expect(renderMarkdown('**Hola** *mundo*\nadiós')).toBe('<strong>Hola</strong> <em>mundo</em><br/>adiós')
  })

  it('escapa el HTML antes de dar formato', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> **ok**')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).toContain('<strong>ok</strong>')
  })

  it('devuelve cadena vacía sin contenido', () => {
    expect(renderMarkdown('')).toBe('')
  })
})

describe('escapeHtml', () => {
  it('escapa los cinco caracteres reservados', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
