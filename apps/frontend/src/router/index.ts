import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/auth.service'
import { projectService } from '../services/project.service'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // === Auth (sin layout) ===
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
      meta: { layout: 'none', public: true },
    },
    // === Project Setup (sin layout, requiere auth) ===
    {
      path: '/setup',
      name: 'setup',
      component: () => import('../views/ProjectSetup.vue'),
      meta: { layout: 'none', skipProjectCheck: true },
    },
    // === App (con dashboard layout) ===
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/Dashboard.vue'),
    },
    {
      path: '/messaging',
      name: 'messaging',
      component: () => import('../views/Messaging.vue'),
    },
    {
      path: '/contacts',
      name: 'contacts',
      component: () => import('../views/Contacts.vue'),
    },
    {
      path: '/brain',
      name: 'brain',
      component: () => import('../views/Brain.vue'),
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/Users.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/Settings.vue'),
    },
    {
      path: '/devadmin/models',
      name: 'devadmin-models',
      component: () => import('../views/DevAdminModels.vue'),
    },
    {
      path: '/devadmin/tests',
      name: 'devadmin-tests',
      component: () => import('../views/DevAdminTests.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/Profile.vue'),
    },
    {
      path: '/test-chat/:slug',
      name: 'test-chat',
      component: () => import('../views/TestChat.vue'),
      meta: { public: true, skipProjectCheck: true, layout: 'none' },
    },
  ],
})

// Navigation Guard
router.beforeEach(async (to, _from, next) => {
  if (to.name === 'test-chat' && !to.params.slug) {
    return next({ name: 'login' })
  }
  // 1. Rutas públicas (login)
  if (to.meta.public) {
    if (authService.isAuthenticated()) {
      return next({ name: 'dashboard' })
    }
    return next()
  }

  // 2. Verificar autenticación
  if (!authService.isAuthenticated()) {
    authService.clearSession()
    projectService.clearLocal()
    return next({ name: 'login' })
  }

  // 3. Si la ruta es setup, permitir acceso directo
  if (to.meta.skipProjectCheck) {
    return next()
  }

  // 4. Verificar si tiene proyecto configurado
  // Primero revisar cache local, si no hay, preguntar al servidor
  let hasProject = projectService.hasLocalProject()
  if (!hasProject) {
    try {
      hasProject = await projectService.checkProject()
    } catch {
      hasProject = false
    }
  }

  if (!hasProject) {
    return next({ name: 'setup' })
  }

  const user = authService.getUser();
  if (to.name === 'devadmin-models' || to.name === 'devadmin-tests') {
    if (!user || user.role !== 'devadmin') {
      return next({ name: 'dashboard' })
    }
  }

  next()
})

export default router
