import { ref, onMounted } from 'vue';
import { projectService, type Project } from '../services/project.service';

/** Color de identidad por defecto del mundo Aurora */
export const DEFAULT_BRAND_COLOR = '#E2C6FF';

export interface BrandConfig {
  name: string | null;
  color: string;
  logo: string | null;
}

const brand = ref<BrandConfig>({
  name: null,
  color: DEFAULT_BRAND_COLOR,
  logo: null,
});

const loaded = ref(false);

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Alto contraste sobre el color de marca según su luminancia */
function isLightColor(hsl: { h: number; s: number; l: number }) {
  return hsl.l >= 72;
}

export function applyBrand(next: BrandConfig) {
  brand.value = next;
  const hsl = hexToHsl(next.color || DEFAULT_BRAND_COLOR);
  const root = document.documentElement.style;
  root.setProperty('--brand-h', String(hsl.h));
  root.setProperty('--brand-s', `${hsl.s}%`);
  root.setProperty('--brand-l', `${hsl.l}%`);
  root.setProperty('--brand-contrast', isLightColor(hsl) ? 'var(--ink-1)' : '#ffffff');
  // Favicon liviano teñido con la marca del proyecto
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const r = 16;
    ctx.fillStyle = next.color || DEFAULT_BRAND_COLOR;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(64, 0);
    ctx.lineTo(64, 64);
    ctx.lineTo(0, 64);
    ctx.lineTo(0, r);
    ctx.arc(r, r, r, Math.PI, Math.PI / 2, true);
    ctx.fill();
    ctx.fillStyle = isLightColor(hsl) ? '#0b0b0c' : '#ffffff';
    ctx.font = '800 34px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', 32, 34);
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL('image/png');
  }
}

export function useBrand() {
  async function loadBrand() {
    if (loaded.value) return;
    try {
      const project = await projectService.getProject();
      if (project) {
        applyBrand({
          name: project.name || null,
          color: project.config?.brand?.color || DEFAULT_BRAND_COLOR,
          logo: project.config?.brand?.logo || project.logo || null,
        });
      }
    } catch {
      applyBrand({ name: null, color: DEFAULT_BRAND_COLOR, logo: null });
    } finally {
      loaded.value = true;
    }
  }

  return { brand, loaded, loadBrand, applyBrand };
}

export function currentProject(): Promise<Project | null> {
  return projectService.getProject();
}
