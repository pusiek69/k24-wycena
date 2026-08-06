import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      // Każda strona ma własny adres i własny plik HTML — treść jest
      // w źródle, nie doklejana JavaScriptem. Dzięki temu Google widzi ją
      // od razu, bez czekania na wykonanie skryptu.
      //
      // Osobny adres „dziękujemy" jest potrzebny, żeby wygodnie ustawić
      // konwersję w Google Ads i Meta.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        tarnobrzeg: resolve(import.meta.dirname, 'blaty-kuchenne-tarnobrzeg.html'),
        konglomerat: resolve(import.meta.dirname, 'blaty-z-konglomeratu.html'),
        spiek: resolve(import.meta.dirname, 'blaty-ze-spieku.html'),
        granit: resolve(import.meta.dirname, 'blaty-granitowe.html'),
        faq: resolve(import.meta.dirname, 'czesto-zadawane-pytania.html'),
        dziekujemy: resolve(import.meta.dirname, 'dziekujemy.html'),
        polityka: resolve(import.meta.dirname, 'polityka-prywatnosci.html'),
        nieznaleziono: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
