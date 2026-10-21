/** Nombre de archivo de `Content-Disposition`: prefiere `filename*` (UTF-8) a `filename`. */
export function fileNameFromDisposition(header: string | null | undefined, fallback: string): string {
  if (!header) return fallback;
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Codificación inválida: se prueba con `filename`.
    }
  }
  const plain = header.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  return (plain?.[1] || plain?.[2] || '').trim() || fallback;
}

/** Descarga un blob en el navegador con el nombre indicado. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Algunos navegadores leen el blob después del clic.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
