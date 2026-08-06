import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Vite config for the Pet Sitter Finder SPA. */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
