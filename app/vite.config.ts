import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The source lives in app/, the built site goes to the repo root
// so GitHub Pages (main branch, root folder) serves it as is.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '..',
    emptyOutDir: false,
    assetsDir: 'assets',
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
