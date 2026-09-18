/// <reference types="../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { useRoute } from "vue-router";
import DashboardLayout from "./components/layout/DashboardLayout.vue";
const route = useRoute();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
if (__VLS_ctx.route.meta.layout === 'none') {
    const __VLS_0 = {}.RouterView;
    /** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    /** @type {[typeof DashboardLayout, typeof DashboardLayout, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(DashboardLayout, new DashboardLayout({
        noPadding: (__VLS_ctx.route.name === 'messaging'),
    }));
    const __VLS_5 = __VLS_4({
        noPadding: (__VLS_ctx.route.name === 'messaging'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    __VLS_6.slots.default;
    const __VLS_7 = {}.RouterView;
    /** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({}));
    const __VLS_9 = __VLS_8({}, ...__VLS_functionalComponentArgsRest(__VLS_8));
    var __VLS_6;
}
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            DashboardLayout: DashboardLayout,
            route: route,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=App.vue.js.map