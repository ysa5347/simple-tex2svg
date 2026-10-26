// CodeMirror 6 setup: stex highlighting, snippets, lint, and app keybindings.
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { StreamLanguage } from '@codemirror/language';
import { stexMath } from '@codemirror/legacy-modes/mode/stex';
import { autocompletion } from '@codemirror/autocomplete';
import { linter, lintGutter, forceLinting } from '@codemirror/lint';
import { indentWithTab } from '@codemirror/commands';
import { texCompletions } from './snippets';
import { lintTex } from './lint';
import type { RenderResult } from './render';

export interface EditorHooks {
  onChange: (source: string) => void;
  onRerender: () => void;
  onCopy: () => void;
  getRender: () => RenderResult | null;
}

export function createEditor(parent: HTMLElement, doc: string, hooks: EditorHooks): EditorView {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        StreamLanguage.define(stexMath),
        autocompletion({ override: [texCompletions], activateOnTyping: true }),
        lintGutter(),
        linter((v) => lintTex(v.state.doc.toString(), hooks.getRender()), { delay: 300 }),
        Prec.highest(
          keymap.of([
            { key: 'Mod-Enter', run: () => (hooks.onRerender(), true) },
            { key: 'Mod-Shift-c', run: () => (hooks.onCopy(), true) },
            { key: 'Mod-s', run: () => (hooks.onRerender(), true) },
          ]),
        ),
        keymap.of([indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) hooks.onChange(u.state.doc.toString());
        }),
      ],
    }),
  });
  return view;
}

/** Re-run the linter now, e.g. after a render produced a new MathJax error. */
export function relint(view: EditorView): void {
  forceLinting(view);
}
