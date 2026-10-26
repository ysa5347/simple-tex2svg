// MathJax (TeX -> SVG) rendering plus SVG/PNG/JPEG export and clipboard helpers.
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import type { RenderSettings } from './store';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// noerrors/noundefined would swallow errors we want to surface in the linter.
const PACKAGES = AllPackages.filter((p) => !['bussproofs', 'noerrors', 'noundefined'].includes(p));
// fontCache 'local' keeps every SVG self-contained, which export requires.
const svgOutput = new SVG({ fontCache: 'local' });

const EM_PX = 16;
const EX_PX = 8;
const PAD_EM = 0.25;

export interface RenderResult {
  svg: string | null;
  error: { message: string; id: string } | null;
}

/**
 * True when `\\` appears outside any group or environment. Display math
 * silently drops everything after such a break, so we wrap it in \displaylines.
 */
function hasTopLevelLineBreak(src: string): boolean {
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '%') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '\\') {
      if (src[i + 1] === '\\' && depth === 0) return true;
      const m = /^\\(begin|end)\b/.exec(src.slice(i, i + 7));
      if (m) depth += m[1] === 'begin' ? 1 : -1;
      i++;
    } else if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return false;
}

export function renderTex(source: string): RenderResult {
  if (!source.trim()) return { svg: null, error: null };
  const tex = hasTopLevelLineBreak(source) ? `\\displaylines{${source}\n}` : source;
  // A fresh document per render keeps \newcommand definitions scoped to one file.
  const doc = mathjax.document('', {
    InputJax: new TeX({
      packages: PACKAGES,
      formatError: (_jax: unknown, err: Error) => {
        throw err;
      },
    }),
    OutputJax: svgOutput,
  });
  try {
    const node = doc.convert(tex, { display: true, em: EM_PX, ex: EX_PX, containerWidth: 80 * EM_PX });
    return { svg: adaptor.outerHTML(adaptor.firstChild(node) as any), error: null };
  } catch (e: any) {
    return { svg: null, error: { message: String(e?.message ?? e), id: String(e?.id ?? 'Error') } };
  }
}

/** SVG with padding, pixel dimensions and a concrete fill color, ready to save or rasterize. */
export function standaloneSvg(svg: string, color: string): { markup: string; width: number; height: number } {
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const [x, y, w, h] = el.getAttribute('viewBox')!.split(/\s+/).map(Number);
  const pad = PAD_EM * 1000; // viewBox units are 1/1000 em
  const width = (parseFloat(el.getAttribute('width')!) * EX_PX) + 2 * PAD_EM * EM_PX;
  const height = (parseFloat(el.getAttribute('height')!) * EX_PX) + 2 * PAD_EM * EM_PX;
  el.setAttribute('viewBox', `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`);
  el.setAttribute('width', `${width.toFixed(2)}px`);
  el.setAttribute('height', `${height.toFixed(2)}px`);
  el.removeAttribute('style');
  el.removeAttribute('role');
  el.removeAttribute('focusable');
  const markup = new XMLSerializer().serializeToString(el).replaceAll('currentColor', color);
  return { markup, width, height };
}

export async function rasterize(
  svg: string,
  settings: RenderSettings,
  type: 'image/png' | 'image/jpeg',
): Promise<Blob> {
  const { markup, width, height } = standaloneSvg(svg, settings.color);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * settings.scale);
    canvas.height = Math.ceil(height * settings.scale);
    const ctx = canvas.getContext('2d')!;
    if (type === 'image/jpeg' || !settings.transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), type, 0.95),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyPng(svg: string, settings: RenderSettings): Promise<void> {
  // Passing a promise keeps the clipboard write inside the user gesture (needed by Safari).
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': rasterize(svg, settings, 'image/png') })]);
}

export async function copySvgCode(svg: string, settings: RenderSettings): Promise<void> {
  await navigator.clipboard.writeText(standaloneSvg(svg, settings.color).markup);
}

export function download(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function saveAs(
  svg: string,
  settings: RenderSettings,
  format: 'png' | 'jpeg' | 'svg',
  basename: string,
): Promise<void> {
  const stem = basename.replace(/\.tex$/, '');
  if (format === 'svg') {
    const { markup } = standaloneSvg(svg, settings.color);
    download(new Blob([markup], { type: 'image/svg+xml' }), `${stem}.svg`);
  } else {
    const blob = await rasterize(svg, settings, format === 'png' ? 'image/png' : 'image/jpeg');
    download(blob, `${stem}.${format === 'png' ? 'png' : 'jpg'}`);
  }
}
