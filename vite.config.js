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
        blaty_kuchenne_tarnobrzeg: resolve(import.meta.dirname, 'blaty-kuchenne-tarnobrzeg.html'),
        blaty_lazienkowe: resolve(import.meta.dirname, 'blaty-lazienkowe.html'),
        okladziny_scienne: resolve(import.meta.dirname, 'okladziny-scienne.html'),
        blaty_z_konglomeratu: resolve(import.meta.dirname, 'blaty-z-konglomeratu.html'),
        blaty_ze_spieku: resolve(import.meta.dirname, 'blaty-ze-spieku.html'),
        blaty_granitowe: resolve(import.meta.dirname, 'blaty-granitowe.html'),
        blaty_z_konglomeratu_kwarcowego_poradnik: resolve(import.meta.dirname, 'blaty-z-konglomeratu-kwarcowego-poradnik.html'),
        baza_wiedzy_index: resolve(import.meta.dirname, 'baza-wiedzy/index.html'),
        baza_wiedzy_granit: resolve(import.meta.dirname, 'baza-wiedzy/granit.html'),
        baza_wiedzy_marmur: resolve(import.meta.dirname, 'baza-wiedzy/marmur.html'),
        baza_wiedzy_kwarcyt: resolve(import.meta.dirname, 'baza-wiedzy/kwarcyt.html'),
        baza_wiedzy_trawertyn: resolve(import.meta.dirname, 'baza-wiedzy/trawertyn.html'),
        baza_wiedzy_dolomit: resolve(import.meta.dirname, 'baza-wiedzy/dolomit.html'),
        baza_wiedzy_konglomerat_kwarcowy: resolve(import.meta.dirname, 'baza-wiedzy/konglomerat-kwarcowy.html'),
        baza_wiedzy_spiek_kwarcowy: resolve(import.meta.dirname, 'baza-wiedzy/spiek-kwarcowy.html'),
        baza_wiedzy_pielegnacja_i_impregnacja: resolve(import.meta.dirname, 'baza-wiedzy/pielegnacja-i-impregnacja.html'),
        baza_wiedzy_kwarcyt_czy_granit: resolve(import.meta.dirname, 'baza-wiedzy/kwarcyt-czy-granit.html'),
        /*
         * `/baza-wiedzy/cena-blatu-z-konglomeratu` CELOWO NIE JEST budowana
         * od 01.09.2026: ma tę samą intencję co nowy poradnik filarowy
         * i konkurowała z nim o frazę „blat z konglomeratu cena".
         * Zamiast pliku Netlify oddaje 301 na poradnik (netlify.toml).
         * Plik źródłowy zostaje w repo jako ślad po treści.
         */
        baza_wiedzy_spiek_kwarcowy_wady_i_zalety: resolve(import.meta.dirname, 'baza-wiedzy/spiek-kwarcowy-wady-i-zalety.html'),
        blaty_kuchenne_sandomierz: resolve(import.meta.dirname, 'blaty-kuchenne-sandomierz.html'),
        blaty_kuchenne_stalowa_wola: resolve(import.meta.dirname, 'blaty-kuchenne-stalowa-wola.html'),
        blaty_kuchenne_mielec: resolve(import.meta.dirname, 'blaty-kuchenne-mielec.html'),
        blaty_kuchenne_rzeszow: resolve(import.meta.dirname, 'blaty-kuchenne-rzeszow.html'),
        blaty_kuchenne_kielce: resolve(import.meta.dirname, 'blaty-kuchenne-kielce.html'),
        blaty_kuchenne_nisko: resolve(import.meta.dirname, 'blaty-kuchenne-nisko.html'),
        blaty_kuchenne_nowa_deba: resolve(import.meta.dirname, 'blaty-kuchenne-nowa-deba.html'),
        blaty_kuchenne_debica: resolve(import.meta.dirname, 'blaty-kuchenne-debica.html'),
        blaty_kuchenne_opatow: resolve(import.meta.dirname, 'blaty-kuchenne-opatow.html'),
        blaty_kuchenne_ostrowiec_swietokrzyski: resolve(import.meta.dirname, 'blaty-kuchenne-ostrowiec-swietokrzyski.html'),
        blaty_kuchenne_starachowice: resolve(import.meta.dirname, 'blaty-kuchenne-starachowice.html'),
        blaty_kuchenne_staszow: resolve(import.meta.dirname, 'blaty-kuchenne-staszow.html'),
        blaty_kuchenne_lublin: resolve(import.meta.dirname, 'blaty-kuchenne-lublin.html'),
        blaty_kuchenne_krakow: resolve(import.meta.dirname, 'blaty-kuchenne-krakow.html'),
        wyprzedaz_plyt: resolve(import.meta.dirname, 'wyprzedaz-plyt.html'),
        poradnik_spieki: resolve(import.meta.dirname, 'blaty-ze-spieku-kwarcowego-poradnik.html'),
        realizacje: resolve(import.meta.dirname, 'realizacje.html'),
        o_mnie: resolve(import.meta.dirname, 'o-mnie.html'),
        czesto_zadawane_pytania: resolve(import.meta.dirname, 'czesto-zadawane-pytania.html'),
        polityka_prywatnosci: resolve(import.meta.dirname, 'polityka-prywatnosci.html'),
        licencja_zdjec: resolve(import.meta.dirname, 'licencja-zdjec.html'),
        oferta: resolve(import.meta.dirname, 'oferta.html'),
        dziekujemy: resolve(import.meta.dirname, 'dziekujemy.html'),
        nieznaleziono: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
