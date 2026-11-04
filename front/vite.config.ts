import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    // Por encima del `asyncUtilTimeout` de setup.ts: si una espera agota su
    // margen, debe fallar con «no encontré tal elemento» y no con un corte
    // seco de vitest, que no dice qué faltaba.
    testTimeout: 20_000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
  },
});
