import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so build/ can be served from any subpath (e.g. GitHub Pages).
  base: './',
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 2500,
  },
});
