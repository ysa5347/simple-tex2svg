// localStorage-backed persistence for .tex sources and preview settings.

export interface TexFile {
  id: string;
  name: string;
  source: string;
  updatedAt: number;
}

export interface RenderSettings {
  color: string;
  scale: number; // raster scale factor (1x–4x)
  transparent: boolean; // PNG background
}

const FILES_KEY = 'texclip.files';
const SETTINGS_KEY = 'texclip.settings';

export const COLOR_PRESETS = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#1f5fd6' },
  { name: 'Red', value: '#d62828' },
  { name: 'Green', value: '#2a9d43' },
  { name: 'Purple', value: '#7b3fbf' },
];

const DEFAULT_SETTINGS: RenderSettings = { color: '#000000', scale: 3, transparent: true };

const SEED: Array<Pick<TexFile, 'name' | 'source'>> = [
  { name: 'quadratic.tex', source: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  {
    name: 'bayes.tex',
    source: '% Bayes\' theorem\nP(A \\mid B) = \\frac{P(B \\mid A)\\, P(A)}{P(B)}',
  },
  {
    name: 'maxwell.tex',
    source:
      '\\begin{aligned}\n  \\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\\n  \\nabla \\cdot \\mathbf{B} &= 0 \\\\\n  \\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\\n  \\nabla \\times \\mathbf{B} &= \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}\n\\end{aligned}',
  },
  {
    name: 'rotation.tex',
    source:
      '\\newcommand{\\R}{\\mathbb{R}}\nR(\\theta) = \\begin{bmatrix}\n  \\cos\\theta & -\\sin\\theta \\\\\n  \\sin\\theta & \\cos\\theta\n\\end{bmatrix} \\in \\R^{2 \\times 2}',
  },
];

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; the in-memory state still works for this session.
  }
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let files: TexFile[] =
  read<TexFile[]>(FILES_KEY) ??
  SEED.map((f, i) => ({ ...f, id: newId(), updatedAt: Date.now() - i * 60_000 }));
write(FILES_KEY, files);

export function listFiles(): TexFile[] {
  return [...files].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getFile(id: string): TexFile | undefined {
  return files.find((f) => f.id === id);
}

function uniqueName(base: string): string {
  const names = new Set(files.map((f) => f.name));
  if (!names.has(base)) return base;
  const stem = base.replace(/\.tex$/, '');
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}.tex`;
    if (!names.has(candidate)) return candidate;
  }
}

export function createFile(source = ''): TexFile {
  const file: TexFile = { id: newId(), name: uniqueName('untitled.tex'), source, updatedAt: Date.now() };
  files.push(file);
  write(FILES_KEY, files);
  return file;
}

export function updateFile(id: string, patch: Partial<Pick<TexFile, 'name' | 'source'>>): void {
  const file = getFile(id);
  if (!file) return;
  if (patch.name !== undefined) {
    let name = patch.name.trim() || 'untitled';
    if (!name.endsWith('.tex')) name += '.tex';
    patch.name = name === file.name ? name : uniqueName(name);
  }
  Object.assign(file, patch, { updatedAt: Date.now() });
  write(FILES_KEY, files);
}

export function deleteFile(id: string): void {
  files = files.filter((f) => f.id !== id);
  write(FILES_KEY, files);
}

export function loadSettings(): RenderSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<RenderSettings>>(SETTINGS_KEY) };
}

export function saveSettings(settings: RenderSettings): void {
  write(SETTINGS_KEY, settings);
}
