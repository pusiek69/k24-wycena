/**
 * KLUCZ DEKORU PŁYTY Z WYPRZEDAŻY — jedno miejsce prawdy dla obu stron.
 *
 * Wydzielone z `wyprzedaz.js` (01.09.2026), bo tej samej funkcji potrzebuje
 * WORKER, żeby podać asystentowi dokładną nazwę, którą ma zwrócić w wycenie.
 * Tamtego modułu worker zaimportować nie może: ciągnie `firms/index.js`
 * z `import.meta.glob`, czyli mechanizmem Vite, którego w workerze nie ma.
 *
 * ⚠ Przepisanie tej reguły „na chwilę" do workera skończyłoby się dokładnie
 * tak, jak błąd, przez który powstał ten plik: asystent mówił o płycie
 * „Taj Mahal Light Konglomerat Kwarcowy", a kalkulator szukał
 * „Taj Mahal Light Konglomerat Kwarcowy #6" i odpowiadał „nie znam dekoru".
 * Dwie kopie tej samej reguły zawsze się w końcu rozjeżdżają.
 */

/**
 * Klucz dekoru dla silnika wyceny.
 *
 * Numer albo kod są w nim CELOWO: Dawid może mieć na placu dwie płyty o tej
 * samej nazwie (np. dwa „Taj Mahal Light"), a rozliczamy konkretną sztukę.
 * Bez rozróżnienia wycena trafiałaby raz w jedną, raz w drugą.
 */
export function kluczDekoru(p) {
  return p.kodPlyty ? `${p.nazwa} (${p.kodPlyty})` : `${p.nazwa} #${p.id}`;
}
