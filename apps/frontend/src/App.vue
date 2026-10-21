<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { onMounted } from "vue";
import DashboardLayout from "./components/layout/DashboardLayout.vue";
import { useBrand } from "./composables/useBrand";

const route = useRoute();
const router = useRouter();
const { loadBrand } = useBrand();

onMounted(() => {
  loadBrand().catch(() => {});
});
// Iniciar o cerrar sesión navega sin recargar: la marca sigue a la sesión.
router.afterEach(() => {
  loadBrand().catch(() => {});
});
</script>

<template>
  <!-- Login / Setup: sin layout -->
  <template v-if="route.meta.layout === 'none'">
    <router-view />
  </template>
  <!-- App: con dashboard layout -->
  <template v-else>
    <DashboardLayout :noPadding="route.name === 'messaging'">
      <router-view />
    </DashboardLayout>
  </template>
</template>

<style scoped></style>
