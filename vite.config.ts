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
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
