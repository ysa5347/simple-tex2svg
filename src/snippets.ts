// Autocompletion for the TeX editor: tab-stop snippets plus plain command names.
import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';

const SNIPPETS: Array<[label: string, template: string, detail: string]> = [
  ['\\frac', '\\frac{${num}}{${den}}', 'fraction'],
  ['\\dfrac', '\\dfrac{${num}}{${den}}', 'display fraction'],
  ['\\sqrt', '\\sqrt{${x}}', 'square root'],
  ['\\sqrtn', '\\sqrt[${n}]{${x}}', 'n-th root'],
  ['\\sum', '\\sum_{${i=1}}^{${n}} ${}', 'sum with limits'],
  ['\\prod', '\\prod_{${i=1}}^{${n}} ${}', 'product with limits'],
  ['\\int', '\\int_{${a}}^{${b}} ${f(x)} \\,d${x}', 'definite integral'],
  ['\\iint', '\\iint_{${D}} ${f} \\,dA', 'double integral'],
  ['\\oint', '\\oint_{${C}} ${}', 'contour integral'],
  ['\\lim', '\\lim_{${x} \\to ${\\infty}} ${}', 'limit'],
  ['\\pd', '\\frac{\\partial ${f}}{\\partial ${x}}', 'partial derivative'],
  ['\\dd', '\\frac{d ${y}}{d ${x}}', 'derivative'],
  ['\\left(', '\\left( ${} \\right)', 'auto-size parentheses'],
  ['\\left[', '\\left[ ${} \\right]', 'auto-size brackets'],
  ['\\left\\{', '\\left\\{ ${} \\right\\}', 'auto-size braces'],
  ['\\left|', '\\left| ${} \\right|', 'auto-size bars'],
  ['\\abs', '\\left| ${x} \\right|', 'absolute value'],
  ['\\norm', '\\left\\| ${x} \\right\\|', 'norm'],
  ['\\text', '\\text{${}}', 'upright text'],
  ['\\mathbb', '\\mathbb{${R}}', 'blackboard bold'],
  ['\\mathbf', '\\mathbf{${}}', 'bold'],
  ['\\mathcal', '\\mathcal{${}}', 'calligraphic'],
  ['\\vec', '\\vec{${v}}', 'vector arrow'],
  ['\\hat', '\\hat{${x}}', 'hat'],
  ['\\bar', '\\bar{${x}}', 'bar'],
  ['\\overline', '\\overline{${}}', 'overline'],
  ['\\underbrace', '\\underbrace{${}}_{${label}}', 'underbrace'],
  ['\\binom', '\\binom{${n}}{${k}}', 'binomial'],
  ['\\newcommand', '\\newcommand{\\${name}}{${body}}', 'define macro'],
  ['\\aligned', '\\begin{aligned}\n  ${a} &= ${b} \\\\\n  ${} &= ${}\n\\end{aligned}', 'aligned equations'],
  ['\\cases', '\\begin{cases}\n  ${a} & \\text{if } ${x > 0} \\\\\n  ${b} & \\text{otherwise}\n\\end{cases}', 'piecewise'],
  ['\\pmatrix', '\\begin{pmatrix}\n  ${a} & ${b} \\\\\n  ${c} & ${d}\n\\end{pmatrix}', 'matrix ( )'],
  ['\\bmatrix', '\\begin{bmatrix}\n  ${a} & ${b} \\\\\n  ${c} & ${d}\n\\end{bmatrix}', 'matrix [ ]'],
  ['\\vmatrix', '\\begin{vmatrix}\n  ${a} & ${b} \\\\\n  ${c} & ${d}\n\\end{vmatrix}', 'determinant'],
  ['\\begin', '\\begin{${env}}\n  ${}\n\\end{${env}}', 'environment'],
];

const COMMANDS = (
  'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho ' +
  'sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega ' +
  'infty partial nabla cdot cdots ldots vdots ddots dots times div pm mp circ bullet ' +
  'leq geq neq approx equiv sim simeq cong propto ll gg in notin subset subseteq supset supseteq cup cap setminus emptyset ' +
  'forall exists neg land lor implies iff to mapsto rightarrow leftarrow Rightarrow Leftarrow leftrightarrow Leftrightarrow ' +
  'sin cos tan log ln exp max min sup inf det arg mid quad qquad hbar ell Re Im langle rangle lfloor rfloor lceil rceil ' +
  'mathrm boldsymbol operatorname displaystyle tilde dot ddot overrightarrow underline overbrace cancel boxed tag'
).split(' ');

const ENVIRONMENTS = 'aligned gathered cases matrix pmatrix bmatrix Bmatrix vmatrix Vmatrix array split alignedat smallmatrix'.split(' ');

const snippetOptions: Completion[] = SNIPPETS.map(([label, template, detail]) =>
  snippetCompletion(template, { label, detail, type: 'function', boost: 1 }),
);
const commandOptions: Completion[] = COMMANDS.map((c) => ({ label: '\\' + c, type: 'keyword' }));
const envOptions: Completion[] = ENVIRONMENTS.map((e) => ({ label: e, type: 'type' }));

export function texCompletions(ctx: CompletionContext): CompletionResult | null {
  const env = ctx.matchBefore(/\\(?:begin|end)\{[a-zA-Z*]*/);
  if (env) {
    return { from: env.from + env.text.indexOf('{') + 1, options: envOptions, validFor: /^[a-zA-Z*]*$/ };
  }
  const word = ctx.matchBefore(/\\[a-zA-Z]*[([{|]?/);
  if (!word) return null;
  return { from: word.from, options: [...snippetOptions, ...commandOptions], validFor: /^\\[a-zA-Z]*$/ };
}
