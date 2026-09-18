# 🖤 Guía de Componentes UI

## ⚙️ 0. Arquitectura Base y Utilidades
*Antes de los componentes, shadcn requiere esta base técnica:*
- [ ] **Configuración de Tailwind CSS:** Definir colores semánticos usando variables CSS (`--background`, `--foreground`, `--primary`, `--muted`, `--destructive`, `--ring`).
- [ ] **Función utilitaria `cn()`:** Una mezcla de `clsx` y `tailwind-merge` para agrupar y sobrescribir clases condicionales sin conflictos.
- [ ] **Soporte para Dark Mode:** Clases `.dark` en la raíz cambiando las variables CSS.
- [ ] **Iconografía:** Integración estándar (shadcn usa *Lucide Icons* por defecto).

## 🧱 1. Elementos Base e Inputs (Core)
*Componentes primitivos de interacción, totalmente accesibles y controlables:*
- [ ] **Button:** Variantes (default, destructive, outline, secondary, ghost, link) y tamaños (default, sm, lg, icon).
- [ ] **Input:** Campo de texto estándar con estados de focus interactivos (`ring`).
- [ ] **Textarea:** Área de texto multilínea.
- [ ] **Label:** Etiqueta accesible vinculada al input (`htmlFor`).
- [ ] **Checkbox:** Selector múltiple accesible.
- [ ] **Radio Group:** Selector único accesible.
- [ ] **Switch:** Interruptor tipo toggle (encendido/apagado).
- [ ] **Slider:** Control deslizante para rangos numéricos.

## 📦 2. Contenedores y Layout
*Estructuras para agrupar contenido de forma consistente:*
- [ ] **Card:** Compuesto por `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, y `CardFooter`.
- [ ] **Separator:** Línea divisoria horizontal o vertical (accesible para lectores de pantalla).
- [ ] **Scroll Area:** Contenedor con barras de desplazamiento personalizadas y cross-browser.
- [ ] **Aspect Ratio:** Contenedor que mantiene una proporción específica (ej. 16:9 para videos).
- [ ] **Resizable:** Paneles ajustables que el usuario puede arrastrar para cambiar su tamaño.

## 🧭 3. Navegación y Menús
*Elementos para moverse por la aplicación:*
- [ ] **Tabs:** Pestañas para alternar contenido (compuesto por `TabsList`, `TabsTrigger`, `TabsContent`).
- [ ] **Dropdown Menu:** Menú desplegable al hacer clic en un botón (ideal para perfiles o acciones).
- [ ] **Navigation Menu:** Barra de navegación superior con menús desplegables complejos.
- [ ] **Breadcrumb:** Migas de pan para mostrar la ruta actual.
- [ ] **Pagination:** Controles para cambiar de página.
- [ ] **Context Menu:** Menú que aparece al hacer clic derecho.

## 🪟 4. Overlays y Feedback (El poder de Radix)
*Componentes que flotan sobre la interfaz, gestionando el foco y cierres con el teclado (Esc):*
- [ ] **Dialog (Modal):** Ventana superpuesta crítica. Bloquea el fondo.
- [ ] **Alert Dialog:** Un modal específico para acciones destructivas (requiere confirmación).
- [ ] **Sheet (Drawer):** Un panel que se desliza desde un lado de la pantalla (ideal para menús móviles o filtros).
- [ ] **Popover:** Un pequeño cuadro flotante anclado a un botón (ej. para un selector de fechas).
- [ ] **Tooltip:** Información contextual al pasar el mouse por encima.
- [ ] **Hover Card:** Un tooltip más grande que permite contenido interactivo dentro.
- [ ] **Toast (Sonner):** Notificaciones temporales en la esquina de la pantalla.

## 📊 5. Visualización de Datos
*Mostrar información de forma clara:*
- [ ] **Table:** Tablas estáticas con un diseño limpio.
- [ ] **Data Table:** Tablas complejas con ordenamiento, filtrado y paginación (shadcn integra *TanStack Table*).
- [ ] **Avatar:** Imagen de perfil con iniciales de respaldo (fallback) si la imagen falla.
- [ ] **Badge:** Pequeñas etiquetas para estados (ej. "Activo", "Beta").
- [ ] **Progress:** Barra de progreso lineal.
- [ ] **Skeleton:** Estado de carga animado (pulsación gris) con la misma forma del contenido que va a cargar.
- [ ] **Carousel:** Deslizador de imágenes o tarjetas.

## 🧠 6. Formularios Avanzados
*Interacciones complejas de selección y entrada de datos:*
- [ ] **Form:** Wrapper que integra inputs con librerías de validación y muestra mensajes de error automáticamente.
- [ ] **Select:** Menú de selección nativo o personalizado pero totalmente accesible.
- [ ] **Command (Command Palette):** Un input de búsqueda rápido con atajo (ej. `Cmd+K` o `Ctrl+K`) que filtra listas de opciones. Funciona como un ComboBox.
- [ ] **Date Picker:** Selector de fechas (usualmente un mix entre `Popover`, `Button` y un componente de calendario).