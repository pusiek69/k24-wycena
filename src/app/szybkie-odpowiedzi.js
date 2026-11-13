/**
 * SZYBKIE ODPOWIEDZI W WIADOMOŚCI DO KLIENTA (zlecenie Dawida, 13.11.2026).
 *
 * „Jak wysyłam wycenę klientowi, żebym miał kilka propozycji." Przyciski
 * nad polem „Wiadomość od Ciebie" w edytorze właściciela — klik dokleja
 * gotowy, ładnie napisany akapit; wszystko zostaje edytowalne przed
 * wysłaniem, można łączyć kilka szablonów.
 *
 * Treści ZAAKCEPTOWANE przez Dawida 13.11.2026 („tak pasuje") — zmiana
 * słowa to decyzja Dawida, nie refaktor (test pilnuje ich co do znaku).
 * Moduł czysty, bez DOM — testowalny w gołym node.
 */

export const SZYBKIE_ODPOWIEDZI = [
  {
    id: 'podziekowanie',
    etykieta: '🙏 Podziękowanie',
    tresc:
      'Dziękuję za złożenie zapytania i zaufanie. Przygotowałem wycenę osobiście — ' +
      'wszystkie pozycje znajdą Państwo w rozbiciu poniżej.',
  },
  {
    id: 'pytania',
    etykieta: '❓ Pytania?',
    tresc:
      'Czy mają Państwo pytania dotyczące wyceny? Chętnie wyjaśnię każdą pozycję albo ' +
      'przygotuję wariant w innym materiale — często różnice w cenie potrafią pozytywnie zaskoczyć.',
  },
  {
    id: 'etap',
    etykieta: '🛠 Etap kuchni',
    tresc:
      'Na jakim etapie jest Państwa kuchnia? Jeśli znany jest już termin montażu mebli, ' +
      'chętnie zarezerwuję pomiar i montaż blatu tak, aby wszystko zagrało z harmonogramem — ' +
      'kuchnia nie będzie czekać bez blatu.',
  },
  {
    id: 'proliner',
    etykieta: '📐 Pomiar Proliner',
    tresc:
      'Zapraszam na bezpłatny, niezobowiązujący pomiar urządzeniem Proliner — to cyfrowy ' +
      'pomiar co do milimetra, dzięki któremu blat pasuje idealnie, bez szablonów i poprawek. ' +
      'Pomiar do niczego nie zobowiązuje, a daje pewną cenę końcową.',
  },
  {
    id: 'kontakt',
    etykieta: '☎ Kontakt',
    tresc:
      'W razie jakichkolwiek pytań proszę śmiało dzwonić: 796 991 128 (pon.–pt. 8:00–18:00) — ' +
      'odbieram osobiście. Można też po prostu odpisać na tę wiadomość.',
  },
  {
    id: 'aktualizacja',
    etykieta: '🔄 Aktualizacja',
    tresc:
      'Zgodnie z naszą rozmową przygotowałem zaktualizowaną wycenę — zmiany widoczne są ' +
      'w rozbiciu poniżej. Proszę dać znać, czy ta wersja odpowiada Państwa oczekiwaniom.',
  },
];

/**
 * Dokleja szablon do bieżącej treści pola: pusty wiersz odstępu między
 * akapitami, końcowe entery Dawida nie mnożą się. Zwraca NOWY tekst albo
 * `null`, gdy szablon nie zmieści się w limicie W CAŁOŚCI — wolimy nie
 * wstawiać nic niż urwać zdanie w pół, którego Dawid nie zauważy.
 */
export function doklejSzablon(obecny, szablon, maks) {
  const baza = String(obecny || '').replace(/\s+$/, '');
  const wynik = baza ? `${baza}\n\n${szablon}` : String(szablon);
  return wynik.length <= maks ? wynik : null;
}
