import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // use the TypeScript source of the shared package directly
      '@timbertrail/shared': fileURLToPath(new URL('../packages/shared/src/index.ts', import.meta.url)),
      // shadcn/ui components import from "@/…"
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // the vendor chunk below is deliberately one file (~530 kB, ~170 kB gzipped)
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Third-party code every screen needs (React, router, Radix, Query…) in its own chunk.
              // It changes only when a dependency is updated, so browsers keep it cached across
              // releases instead of re-downloading it whenever app code (e.g. a new phrase) changes.
              // The table library stays out: only list pages load it, on demand.
              name: 'vendor',
              test: /node_modules[\\/](?!@tanstack[\\/](table-core|react-table|store|react-store)[\\/])/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
