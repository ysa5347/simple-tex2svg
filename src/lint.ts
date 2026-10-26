// Client-side LaTeX (math-only) linter: structural checks with positions, chktex-style
// style hints, and MathJax parse errors mapped back onto the source.
import type { Diagnostic } from '@codemirror/lint';
import type { RenderResult } from './render';

const TEXT_ARG_CMDS = new Set(['text', 'textrm', 'textit', 'textbf', 'mathrm', 'operatorname', 'mbox', 'label', 'tag']);
const DOCUMENT_CMDS = new Set([
  'documentclass', 'usepackage', 'section', 'subsection', 'subsubsection', 'chapter',
  'maketitle', 'title', 'author', 'date', 'paragraph', 'item', 'includegraphics',
]);
const FUNCTION_NAMES = 'sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|arcsin|arccos|arctan|log|ln|lg|exp|lim|max|min|sup|inf|det|arg|gcd|deg|dim|ker';
const BARE_FUNCTION = new RegExp(`(?<![\\\\a-zA-Z])(${FUNCTION_NAMES})(?![a-zA-Z])`, 'g');

interface Open {
  pos: number;
  len: number;
  name?: string;
}

/** Replace comments with spaces so offsets stay aligned with the original source. */
function stripComments(src: string): string {
  return src.replace(/(?<!\\)%[^\n]*/g, (m) => ' '.repeat(m.length));
}

export function lintTex(source: string, render: RenderResult | null): Diagnostic[] {
  const src = stripComments(source);
  const out: Diagnostic[] = [];
  const braces: Open[] = [];
  const lefts: Open[] = [];
  const envs: Open[] = [];
  const textRanges: Array<[number, number]> = [];
  const textStarts: Array<{ depth: number; start: number }> = [];

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(src.slice(i));
      if (!m) continue;
      const cmd = m[1];
      const len = m[0].length;
      if (cmd === 'begin' || cmd === 'end') {
        const env = /^\s*\{([^}]*)\}/.exec(src.slice(i + len));
        if (env) {
          const total = len + env[0].length;
          if (cmd === 'begin') {
            if (env[1] === 'document') {
              out.push({ from: i, to: i + total, severity: 'warning', message: 'Document environments are not needed: the whole file is display math.' });
            }
            envs.push({ pos: i, len: total, name: env[1] });
          } else {
            const open = envs.pop();
            if (!open) {
              out.push({ from: i, to: i + total, severity: 'error', message: `\\end{${env[1]}} without matching \\begin.` });
            } else if (open.name !== env[1]) {
              out.push({ from: i, to: i + total, severity: 'error', message: `\\end{${env[1]}} does not match \\begin{${open.name}}.` });
              out.push({ from: open.pos, to: open.pos + open.len, severity: 'error', message: `\\begin{${open.name}} is closed by \\end{${env[1]}}.` });
            }
          }
          i += total - 1;
          continue;
        }
      } else if (cmd === 'left') {
        lefts.push({ pos: i, len });
      } else if (cmd === 'right') {
        if (!lefts.pop()) out.push({ from: i, to: i + len, severity: 'error', message: '\\right without matching \\left.' });
      } else if (DOCUMENT_CMDS.has(cmd)) {
        out.push({ from: i, to: i + len, severity: 'warning', message: `\\${cmd} is a document command and is not supported in math mode.` });
      } else if ('[]()'.includes(cmd)) {
        out.push({ from: i, to: i + len, severity: 'warning', message: `Math delimiter \\${cmd} is not needed: the source is already display math.` });
      } else if (TEXT_ARG_CMDS.has(cmd) && /^\s*\{/.test(src.slice(i + len))) {
        textStarts.push({ depth: braces.length, start: i });
      }
      i += len - 1;
    } else if (c === '{') {
      braces.push({ pos: i, len: 1 });
    } else if (c === '}') {
      if (!braces.pop()) {
        out.push({ from: i, to: i + 1, severity: 'error', message: 'Unmatched closing brace }.' });
      } else if (textStarts.length && textStarts[textStarts.length - 1].depth === braces.length) {
        textRanges.push([textStarts.pop()!.start, i]);
      }
    } else if (c === '$') {
      out.push({ from: i, to: i + 1, severity: 'warning', message: 'Remove $: the source is already display math.' });
    }
  }

  for (const b of braces) out.push({ from: b.pos, to: b.pos + 1, severity: 'error', message: 'Unclosed brace {.' });
  for (const l of lefts) out.push({ from: l.pos, to: l.pos + l.len, severity: 'error', message: '\\left without matching \\right.' });
  for (const e of envs) out.push({ from: e.pos, to: e.pos + e.len, severity: 'error', message: `\\begin{${e.name}} is never closed.` });

  const inText = (pos: number) => textRanges.some(([a, b]) => pos > a && pos < b);

  for (const m of src.matchAll(/\.\.\./g)) {
    if (inText(m.index!)) continue;
    out.push({ from: m.index!, to: m.index! + 3, severity: 'info', message: 'Use \\dots (or \\ldots / \\cdots) instead of "...".' });
  }
  for (const m of src.matchAll(BARE_FUNCTION)) {
    if (inText(m.index!)) continue;
    out.push({ from: m.index!, to: m.index! + m[0].length, severity: 'warning', message: `Use \\${m[1]} so the function name is set upright.` });
  }

  if (render?.error) out.push(...mapRenderError(source, src, render.error, out));
  return out.map((d) => ({ ...d, source: d.source ?? 'lint' }));
}

function mapRenderError(
  source: string,
  stripped: string,
  error: NonNullable<RenderResult['error']>,
  existing: Diagnostic[],
): Diagnostic[] {
  const base = { severity: 'error' as const, message: `MathJax: ${error.message}`, source: 'mathjax' };
  const cs = /\\[a-zA-Z]+|\\./.exec(error.message)?.[0];
  if (cs) {
    const re = new RegExp(cs.replace(/\\/g, '\\\\').replace(/[.*+?^${}()|[\]]/g, '\\$&') + '(?![a-zA-Z])', 'g');
    const hits = [...stripped.matchAll(re)].map((m) => ({ ...base, from: m.index!, to: m.index! + cs.length }));
    if (hits.length) return hits;
  }
  // Structural errors already point at the culprit; don't repeat the message vaguely.
  if (existing.some((d) => d.severity === 'error')) return [];
  const lineEnd = source.indexOf('\n');
  return [{ ...base, from: 0, to: lineEnd === -1 ? source.length : lineEnd }];
}
