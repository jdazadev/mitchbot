import { describe, expect, it } from 'vitest'
import { brandDerivatives, hexToHsl } from '@/composables/useBrand'

describe('hexToHsl', () => {
  it('convierte colores de 6 y 3 dígitos', () => {
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 })
    expect(hexToHsl('#fff')).toEqual({ h: 0, s: 0, l: 100 })
    expect(hexToHsl('E2C6FF')).toEqual({ h: 269, s: 100, l: 89 })
  })
})

describe('brandDerivatives', () => {
  const lightness = (value: string) => Number(value.match(/(\d+)%\)?(?: \/|\)$)/)?.[1])

  it('el foco en claro queda oscuro para contrastar con el lienzo', () => {
    const d = brandDerivatives({ h: 269, s: 100, l: 89 }, 'light')
    expect(d.focus).toBe('hsl(269 70% 31%)')
    expect(d.ink).toBe('hsl(269 55% 29%)')
  })

  it('el foco nunca baja de 22% de luminosidad en claro', () => {
    const d = brandDerivatives({ h: 10, s: 80, l: 40 }, 'light')
    expect(d.focus).toBe('hsl(10 70% 22%)')
  })

  it('el tema oscuro aclara el acento a 72% como mínimo', () => {
    const d = brandDerivatives({ h: 200, s: 60, l: 30 }, 'dark')
    expect(d.base).toBe('hsl(200 60% 72%)')
    expect(lightness(d.soft)).toBe(24)
  })
})
