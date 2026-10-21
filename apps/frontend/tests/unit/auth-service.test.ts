import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from '@/services/auth.service'

function mockProfile(profile: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(profile), { status: 200 })))
}

describe('authService.getProfile', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('conserva el proyecto de la pestaña si el usuario sigue siendo miembro', async () => {
    localStorage.setItem('mitchbot_active_project', 'project-a')
    mockProfile({ _id: 'u1', projectIds: ['project-a', 'project-b'], activeProjectId: 'project-b' })
    await authService.getProfile()
    expect(authService.getActiveProjectId()).toBe('project-a')
  })

  it('adopta el proyecto del servidor si ya no pertenece al local', async () => {
    localStorage.setItem('mitchbot_active_project', 'project-gone')
    mockProfile({ _id: 'u1', projectIds: ['project-b'], activeProjectId: 'project-b' })
    await authService.getProfile()
    expect(authService.getActiveProjectId()).toBe('project-b')
  })

  it('adopta el proyecto del servidor si la pestaña no tenía ninguno', async () => {
    mockProfile({ _id: 'u1', projectIds: ['project-b'], activeProjectId: 'project-b' })
    await authService.getProfile()
    expect(authService.getActiveProjectId()).toBe('project-b')
  })
})
