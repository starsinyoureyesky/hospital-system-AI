import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 'base: "./"' is crucial for deploying to GitHub Pages or subdirectories.
  base: './', 
  define: {
    // Polyfill process.env to prevent "ReferenceError: process is not defined" 
    // when the code tries to access it in the browser.
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000
  }
});