/**
 * Render mínimo de Markdown (negritas, itálicas y saltos de línea) seguro para
 * `v-html`: el texto se escapa antes de aplicar el formato, de modo que el
 * contenido enviado por un cliente no puede inyectar HTML.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdown(content: string): string {
  if (!content) return '';
  return escapeHtml(content)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}
