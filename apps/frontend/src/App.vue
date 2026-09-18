<script setup lang="ts">
import { useRoute } from "vue-router";
import DashboardLayout from "./components/layout/DashboardLayout.vue";

const route = useRoute();
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
