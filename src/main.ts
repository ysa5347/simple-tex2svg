import './style.css';
import { homeView } from './views/home';
import { editorView } from './views/editor-view';

const root = document.getElementById('app')!;
let teardown: () => void = () => {};

function route(): void {
  teardown();
  const m = /^#\/edit\/([\w-]+)/.exec(location.hash);
  teardown = m ? editorView(root, m[1]) : homeView(root);
}

window.addEventListener('hashchange', route);
route();
