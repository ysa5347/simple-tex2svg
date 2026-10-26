# TeX Clip

A clipboard for math: type LaTeX, see it rendered live, and paste it into lecture-note PDFs as an image.

Everything runs in the browser. MathJax renders the formulas to SVG, and the files are stored in `localStorage`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

The clipboard API only works in a secure context (`localhost` or HTTPS).

## Usage

- **Home** shows one card per `.tex` file, with the rendered formula as its thumbnail. The copy icon on a card copies that formula as a PNG.
- **Editor** has three columns: the sidebar, the CodeMirror editor, and the live preview.
  - The whole file is one display-math formula. There is no `\documentclass` and no `$`.
  - A top-level `\\` is wrapped in `\displaylines` automatically.
  - `\newcommand` definitions are scoped to the file they are defined in.
  - **PNG**: click to copy a PNG to the clipboard. The dropdown also has Save PNG and Save JPEG.
  - **SVG**: click to copy the SVG code. The dropdown also has Save SVG.
  - **Rerender** forces a render. Rendering also happens automatically about 200 ms after you stop typing.
  - The options row sets the ink color, the raster scale (1x–4x) and a transparent background. JPEG always has a white background.

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+Shift+C` | Copy PNG |
| `Ctrl/Cmd+Enter`, `Ctrl/Cmd+S` | Rerender |
| `\` + name, then `Enter` | Snippet or command completion, e.g. `\frac`, `\int`, `\bmatrix`, `\cases`, `\aligned`. `Tab` jumps to the next field. |

### Linter

| Kind | Checks |
| --- | --- |
| Error | Unbalanced `{}`, mismatched `\begin`/`\end`, `\left`/`\right` pairs, and MathJax parse errors. An undefined `\foo` is marked at its position. |
| Warning | `$`, `\[ \]`, document commands such as `\section`, and bare function names such as `sin` (use `\sin`). |
| Info | `...` (use `\dots`). |
