/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The deploy workflow sets VITE_BASE=/dcc-watch-hub/ for GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // 5173 is often taken by another Vite project on the author's machine.
  server: { port: 5180 },
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    /*
     * 010: the Studio is the first lazy chunk in the app, and Vite's
     * `modulePreload` polyfill would land ~1.2 kB of helper in the *viewer's*
     * entry chunk to serve it. Constitution VII says the viewer bundle must not
     * grow because of the Studio, and every browser the constitution names
     * (current Chrome, Firefox, Safari) supports `<link rel=modulepreload>`
     * natively - without the polyfill an older one simply loads the chunk when
     * the dynamic import runs, which is exactly what the Studio wants anyway.
     */
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
