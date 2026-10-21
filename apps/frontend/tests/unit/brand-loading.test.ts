import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProject = vi.fn()
vi.mock('@/services/project.service', () => ({ projectService: { getProject } }))

const { useBrand, DEFAULT_BRAND_COLOR } = await import('@/composables/useBrand')
const brandHue = () => document.documentElement.style.getPropertyValue('--brand-h')

function signIn(projectId: string) {
  localStorage.setItem('mitchbot_token', `token-${projectId}`)
  localStorage.setItem('mitchbot_active_project', projectId)
}

describe('useBrand().loadBrand', () => {
  const { loadBrand, brand } = useBrand()

  beforeEach(() => {
    localStorage.clear()
    getProject.mockReset()
  })

  it('sin sesión aplica la marca de Aurora sin consultar el servidor', async () => {
    await loadBrand()
    expect(getProject).not.toHaveBeenCalled()
    expect(brand.value.color).toBe(DEFAULT_BRAND_COLOR)
  })

  it('al iniciar sesión carga la marca del proyecto', async () => {
    getProject.mockResolvedValue({ name: 'Verde', config: { brand: { color: '#1F8A60' } } })
    signIn('p1')
    await loadBrand()
    expect(brandHue()).toBe('156')
    expect(brand.value.name).toBe('Verde')
  })

  it('no vuelve a consultar si la sesión y el proyecto no cambian', async () => {
    getProject.mockResolvedValue({ name: 'Verde', config: { brand: { color: '#1F8A60' } } })
    signIn('p2')
    await loadBrand()
    await loadBrand()
    expect(getProject).toHaveBeenCalledTimes(1)
  })

  it('recarga al cambiar de proyecto', async () => {
    getProject.mockResolvedValueOnce({ name: 'Verde', config: { brand: { color: '#1F8A60' } } })
    signIn('p3')
    await loadBrand()
    getProject.mockResolvedValueOnce({ name: 'Cian', config: { brand: { color: '#0E7490' } } })
    signIn('p4')
    await loadBrand()
    expect(brand.value.color).toBe('#0E7490')
  })

  it('si el proyecto no se pudo leer, reintenta en la siguiente llamada', async () => {
    getProject.mockResolvedValueOnce(null)
    signIn('p5')
    await loadBrand()
    expect(brand.value.color).toBe(DEFAULT_BRAND_COLOR)
    getProject.mockResolvedValueOnce({ name: 'Verde', config: { brand: { color: '#1F8A60' } } })
    await loadBrand()
    expect(brand.value.color).toBe('#1F8A60')
  })
})
