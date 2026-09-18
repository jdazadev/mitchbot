import { test as base, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { authedContext, publicContext } from './helpers/api';

interface E2EFixtures {
  /** Contexto de API autenticado como el usuario e2e. */
  api: APIRequestContext;
  /** Contexto de API sin autenticación. */
  publicApi: APIRequestContext;
}

export const test = base.extend<E2EFixtures>({
  api: async ({ playwright }, use) => {
    const context = await authedContext(playwright);
    await use(context);
    await context.dispose();
  },

  publicApi: async ({ playwright }, use) => {
    const context = await publicContext(playwright);
    await use(context);
    await context.dispose();
  },
});

export { expect };
