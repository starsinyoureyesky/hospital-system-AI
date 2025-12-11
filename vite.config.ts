import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 'base: "./"' is crucial for deploying to GitHub Pages or subdirectories.
  // It ensures assets are linked relatively (e.g., "assets/script.js" instead of "/assets/script.js")
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000
  }
});