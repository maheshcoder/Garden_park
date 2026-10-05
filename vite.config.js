import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/* classic.html embeds the original 2D garden as plain (non-module) scripts.
   Vite only bundles <script type="module">, so copy script.js into dist. */
const copyClassicScript = () => ({
  name: 'copy-classic-script',
  closeBundle() {
    if (!existsSync(resolve(root, 'dist'))) mkdirSync(resolve(root, 'dist'));
    copyFileSync(resolve(root, 'script.js'), resolve(root, 'dist', 'script.js'));
  }
});

export default defineConfig({
  base: './',
  plugins: [copyClassicScript()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        classic: resolve(root, 'classic.html')
      }
    }
  }
});
