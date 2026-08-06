import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      // Trzy prawdziwe strony — każda z własnym adresem.
      // Osobny adres „dziękujemy" jest potrzebny, żeby wygodnie ustawić
      // konwersję w Google Ads i Meta.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        dziekujemy: resolve(import.meta.dirname, 'dziekujemy.html'),
        polityka: resolve(import.meta.dirname, 'polityka-prywatnosci.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
