// Editor page: sidebar | CodeMirror editor | live preview with copy/export toolbar.
import { COLOR_PRESETS, createFile, getFile, listFiles, loadSettings, saveSettings, updateFile } from '../store';
import { copyPng, copySvgCode, renderTex, saveAs, type RenderResult } from '../render';
import { createEditor, relint } from '../editor';
import { h, icons, toast } from '../ui';

const SIDEBAR_KEY = 'texclip.sidebar';
const SPLIT_KEY = 'texclip.split';

interface MenuItem {
  label: string;
  run: () => void | Promise<void>;
}

function splitButton(label: string, title: string, main: () => void, items: MenuItem[]): HTMLElement {
  const menu = h('div', { class: 'menu', role: 'menu' });
  const wrap = h('div', { class: 'split-btn' });
  const close = () => wrap.classList.remove('open');
  for (const item of items) {
    menu.append(h('button', { role: 'menuitem', onclick: () => (close(), item.run()) }, item.label));
  }
  wrap.append(
    h('button', { class: 'btn split-main', title, onclick: main }, label),
    h('button', {
      class: 'btn split-caret',
      title: `${label} options`,
      'aria-haspopup': 'menu',
      html: icons.caret,
      onclick: (e: Event) => {
        e.stopPropagation();
        const willOpen = !wrap.classList.contains('open');
        document.querySelectorAll('.split-btn.open').forEach((el) => el.classList.remove('open'));
        wrap.classList.toggle('open', willOpen);
      },
    }),
    menu,
  );
  return wrap;
}

export function editorView(root: HTMLElement, id: string): () => void {
  const file = getFile(id);
  if (!file) {
    location.hash = '#/';
    return () => {};
  }
  const settings = loadSettings();
  let result: RenderResult | null = null;
  let timer: number | undefined;

  // ---------- sidebar ----------
  const sidebar = h('nav', { class: 'sidebar' });
  const drawSidebar = () => {
    const list = h('ul', { class: 'file-list' });
    for (const f of listFiles()) {
      list.append(
        h('li', {}, h('a', { href: `#/edit/${f.id}`, class: f.id === id ? 'active' : '', title: f.name }, h('span', { html: icons.file }), f.name)),
      );
    }
    sidebar.replaceChildren(
      h('div', { class: 'side-top' },
        h('button', { class: 'icon-btn', title: 'Toggle sidebar', html: icons.panel, onclick: toggleSidebar }),
        h('a', { class: 'side-home', href: '#/', title: 'Home', html: `${icons.home}<span>Home</span>` }),
      ),
      h('button', {
        class: 'side-new',
        title: 'New file',
        html: `${icons.plus}<span>New file</span>`,
        onclick: () => (location.hash = `#/edit/${createFile().id}`),
      }),
      h('div', { class: 'side-label' }, 'Files'),
      list,
    );
  };
  const toggleSidebar = () => {
    shell.classList.toggle('collapsed');
    localStorage.setItem(SIDEBAR_KEY, shell.classList.contains('collapsed') ? '1' : '0');
  };

  // ---------- editor pane ----------
  const nameInput = h('input', { class: 'name-input', value: file.name, spellcheck: 'false', 'aria-label': 'File name' });
  const commitName = () => {
    updateFile(id, { name: nameInput.value });
    nameInput.value = getFile(id)!.name;
    drawSidebar();
  };
  nameInput.addEventListener('change', commitName);
  nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && nameInput.blur());
  const status = h('span', { class: 'status' });
  const editorHost = h('div', { class: 'editor-host' });
  const editorPane = h('section', { class: 'pane editor-pane' },
    h('div', { class: 'pane-bar' }, nameInput, status),
    editorHost,
  );

  // ---------- preview pane ----------
  const preview = h('div', { class: 'preview-canvas' });
  const errorBox = h('div', { class: 'render-error', hidden: true });

  const withSvg = (fn: (svg: string) => Promise<void>, ok: string) => async () => {
    if (!result?.svg) return toast('Nothing to export: fix the render error first.', 'error');
    try {
      await fn(result.svg);
      if (ok) toast(ok);
    } catch (err) {
      toast(`Failed: ${(err as Error).message}`, 'error');
    }
  };
  const doCopyPng = withSvg((svg) => copyPng(svg, settings), `Copied PNG (${settings.scale}x)`);
  const doCopySvg = withSvg((svg) => copySvgCode(svg, settings), 'Copied SVG code');
  const save = (fmt: 'png' | 'jpeg' | 'svg') => withSvg((svg) => saveAs(svg, settings, fmt, getFile(id)!.name), '');

  const scaleSelect = h('select', { title: 'Raster scale', 'aria-label': 'Raster scale' },
    ...[1, 2, 3, 4].map((s) => h('option', { value: s, selected: s === settings.scale }, `${s}x`)));
  const bgToggle = h('input', { type: 'checkbox', checked: settings.transparent });
  const swatches = h('div', { class: 'swatches' });
  const drawSwatches = () => {
    swatches.replaceChildren(
      ...COLOR_PRESETS.map((c) =>
        h('button', {
          class: `swatch${c.value === settings.color ? ' active' : ''}`,
          style: `--c:${c.value}`,
          title: c.name,
          'aria-label': c.name,
          onclick: () => {
            settings.color = c.value;
            applySettings();
          },
        }),
      ),
    );
  };
  const applySettings = () => {
    saveSettings(settings);
    preview.style.color = settings.color;
    preview.classList.toggle('checker', settings.transparent);
    drawSwatches();
  };
  scaleSelect.addEventListener('change', () => {
    settings.scale = Number(scaleSelect.value);
    applySettings();
  });
  bgToggle.addEventListener('change', () => {
    settings.transparent = bgToggle.checked;
    applySettings();
  });

  const previewPane = h('section', { class: 'pane preview-pane' },
    h('div', { class: 'pane-bar toolbar' },
      splitButton('PNG', 'Copy PNG to clipboard (Ctrl+Shift+C)', doCopyPng, [
        { label: 'Copy PNG to clipboard', run: doCopyPng },
        { label: 'Save as PNG…', run: save('png') },
        { label: 'Save as JPEG…', run: save('jpeg') },
      ]),
      splitButton('SVG', 'Copy SVG code to clipboard', doCopySvg, [
        { label: 'Copy SVG code', run: doCopySvg },
        { label: 'Save as SVG…', run: save('svg') },
      ]),
      h('button', { class: 'btn', title: 'Rerender (Ctrl+Enter)', html: `${icons.refresh}<span>Rerender</span>`, onclick: () => rerender() }),
    ),
    h('div', { class: 'pane-bar options' },
      swatches,
      h('label', { class: 'opt' }, 'Scale', scaleSelect),
      h('label', { class: 'opt' }, bgToggle, 'Transparent'),
    ),
    h('div', { class: 'preview-area' }, preview, errorBox),
  );

  // ---------- render loop ----------
  const rerender = () => {
    clearTimeout(timer);
    const source = view.state.doc.toString();
    result = renderTex(source);
    if (result.svg) {
      preview.innerHTML = result.svg;
      preview.classList.remove('stale');
      errorBox.hidden = true;
    } else {
      // Keep the last good render visible (dimmed) while the user is mid-edit.
      preview.classList.toggle('stale', !!result.error);
      if (!result.error) preview.replaceChildren(h('span', { class: 'placeholder' }, 'Start typing a formula…'));
      errorBox.hidden = !result.error;
      errorBox.textContent = result.error ? result.error.message : '';
    }
    status.textContent = result.error ? 'Error' : result.svg ? 'Rendered' : '';
    status.className = `status ${result.error ? 'bad' : 'good'}`;
    relint(view);
  };

  const view = createEditor(editorHost, file.source, {
    onChange: (source) => {
      updateFile(id, { source });
      clearTimeout(timer);
      timer = window.setTimeout(rerender, 200);
    },
    onRerender: rerender,
    onCopy: doCopyPng,
    getRender: () => result,
  });

  // ---------- resizable split ----------
  const divider = h('div', { class: 'divider', role: 'separator', 'aria-orientation': 'vertical' });
  divider.addEventListener('pointerdown', (e) => {
    divider.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const box = main.getBoundingClientRect();
      const pct = Math.min(80, Math.max(20, ((ev.clientX - box.left) / box.width) * 100));
      main.style.setProperty('--split', `${pct}%`);
    };
    const up = () => {
      divider.removeEventListener('pointermove', move);
      localStorage.setItem(SPLIT_KEY, main.style.getPropertyValue('--split'));
    };
    divider.addEventListener('pointermove', move);
    divider.addEventListener('pointerup', up, { once: true });
  });

  const main = h('main', { class: 'split' }, editorPane, divider, previewPane);
  const saved = localStorage.getItem(SPLIT_KEY);
  if (saved) main.style.setProperty('--split', saved);
  const shell = h('div', { class: `shell${localStorage.getItem(SIDEBAR_KEY) === '1' ? ' collapsed' : ''}` }, sidebar, main);

  const closeMenus = () => document.querySelectorAll('.split-btn.open').forEach((el) => el.classList.remove('open'));
  document.addEventListener('click', closeMenus);

  drawSidebar();
  applySettings();
  root.replaceChildren(shell);
  rerender();
  view.focus();

  return () => {
    clearTimeout(timer);
    document.removeEventListener('click', closeMenus);
    view.destroy();
  };
}
