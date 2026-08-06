import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * OSOBNY BUILD DLA PODGLĄDU JEDNOPLIKOWEGO
 *
 * Normalny build dzieli kod na kilka plików (tak jest szybciej w internecie).
 * Ale plik otwierany z dysku — przez podwójne kliknięcie — nie potrafi
 * doczytać sąsiednich plików: przeglądarka blokuje to ze względów
 * bezpieczeństwa i strona zostaje pusta.
 *
 * Dlatego podgląd budujemy osobno: wszystko w JEDNEJ paczce, w starym
 * formacie skryptu (bez modułów), który działa też z pliku na dysku.
 */
export default defineConfig({
  build: {
    outDir: 'dist-podglad',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/main.js'),
      name: 'K24H',
      formats: ['iife'],
      fileName: () => 'podglad.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'podglad.css',
      },
    },
  },
});
