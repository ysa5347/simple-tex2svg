// Main page: a board of cards, one per .tex file, with the rendered formula as thumbnail.
import { createFile, deleteFile, listFiles, loadSettings } from '../store';
import { copyPng, renderTex } from '../render';
import { h, icons, relativeTime, toast } from '../ui';

export function homeView(root: HTMLElement): () => void {
  const settings = loadSettings();
  const query = h('input', { class: 'search', type: 'search', placeholder: 'Search files or source…' });
  const grid = h('div', { class: 'grid' });

  const newFile = () => {
    location.hash = `#/edit/${createFile().id}`;
  };

  const draw = () => {
    const q = query.value.trim().toLowerCase();
    grid.replaceChildren(
      h('button', { class: 'card card-new', onclick: newFile }, h('span', { html: icons.plus }), 'New formula'),
    );
    for (const file of listFiles()) {
      if (q && !file.name.toLowerCase().includes(q) && !file.source.toLowerCase().includes(q)) continue;
      const result = renderTex(file.source);
      const thumb = h('div', { class: 'thumb', style: `color:${settings.color}` });
      if (result.svg) thumb.innerHTML = result.svg;
      else thumb.append(h('span', { class: result.error ? 'thumb-error' : 'thumb-empty' }, result.error ? 'Render error' : 'Empty'));

      const copyBtn = h('button', {
        class: 'icon-btn',
        title: 'Copy as PNG',
        html: icons.copy,
        disabled: !result.svg,
        onclick: async (e: Event) => {
          e.stopPropagation();
          try {
            await copyPng(result.svg!, settings);
            toast(`Copied ${file.name} as PNG`);
          } catch (err) {
            toast(`Copy failed: ${(err as Error).message}`, 'error');
          }
        },
      });
      const delBtn = h('button', {
        class: 'icon-btn danger',
        title: 'Delete',
        html: icons.trash,
        onclick: (e: Event) => {
          e.stopPropagation();
          if (confirm(`Delete ${file.name}?`)) {
            deleteFile(file.id);
            draw();
          }
        },
      });
      grid.append(
        h(
          'a',
          { class: 'card', href: `#/edit/${file.id}` },
          thumb,
          h(
            'div',
            { class: 'card-meta' },
            h('div', {}, h('div', { class: 'card-name' }, file.name), h('div', { class: 'card-time' }, relativeTime(file.updatedAt))),
            h('div', { class: 'card-actions' }, copyBtn, delBtn),
          ),
        ),
      );
    }
  };

  query.addEventListener('input', draw);
  root.replaceChildren(
    h(
      'div',
      { class: 'home' },
      h(
        'header',
        { class: 'home-header' },
        h('h1', {}, 'TeX Clip'),
        h('p', { class: 'subtitle' }, 'Render a formula, copy it, paste it into your lecture notes.'),
        h('div', { class: 'home-tools' }, query, h('button', { class: 'btn primary', onclick: newFile, html: `${icons.plus}<span>New</span>` })),
      ),
      grid,
    ),
  );
  draw();
  return () => {};
}
