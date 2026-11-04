/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5174 },
  preview: { port: 4176 },
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], css: false },
});
