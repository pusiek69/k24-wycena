/**
 * WYSOKOŚĆ WYPALONEGO PODPISU U DOŁU ZDJĘCIA
 *
 * Grafiki Dawida mają pod zdjęciem pasek z nazwą kamienia, adresem i telefonem.
 * W dużej wersji (lightbox) to jego znak i zostaje. W miniaturze, którą siatka
 * pokazuje jako kafel, ucięty w połowie napis wygląda jak błąd.
 *
 * CO ODRÓŻNIA PODPIS OD BIAŁEJ ŚCIANY
 * Pierwsze podejście liczyło „jasne i bezbarwne piksele" i myliło się: biała
 * ściana albo jasny sufit potrafiły dać 45% wysokości zdjęcia. Podpis ma jedną
 * cechę, której zdjęcie nie ma — tło jest JEDNOLITE. W wierszu podpisu
 * przytłaczająca większość pikseli ma niemal identyczną jasność (tło druku),
 * a reszta to ciemne litery. Ściana zawsze ma gradient, cień albo fakturę.
 *
 * Zwracamy wysokość w pikselach oryginału; wywołujący decyduje, czy ją przyjąć.
 */

const ODLEGLOSC_TLA = 20; // jak blisko modalnego koloru musi być piksel tła
const MIN_UDZIAL_TLA = 0.72; // tyle wiersza musi być jednolitym tłem
const MIN_TEKSTU = 0.004; // w całym pasie muszą być litery (inaczej to gładka ściana)
const MAKS_UDZIAL_WYS = 0.35; // pas grubszy niż 1/3 zdjęcia to nie podpis
const KUBELEK = 8; // zgrubność histogramu koloru

export async function wysokoscPodpisu(sharpFabryka) {
  const { data, info } = await sharpFabryka()
    .greyscale(false)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const krok = Math.max(1, Math.floor(width / 300));
  const limit = Math.floor(height * MAKS_UDZIAL_WYS);

  let ostatniDobry = height;   // najwyzszy wiersz nalezacy jeszcze do paska
  let zlych = 0;               // ile niejednolitych wierszy z rzedu
  const tolerancja = Math.max(10, Math.round(height * 0.03)); // najgrubsza linijka tekstu w tych grafikach
  let ciemne = 0;
  let probki = 0;

  const KUBELKOW = Math.ceil(256 / KUBELEK);
  const hist = new Uint32Array(KUBELKOW ** 3);

  for (let y = height - 1; y >= height - limit; y--) {
    hist.fill(0);
    const piksele = [];
    for (let x = 0; x < width; x += krok) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      piksele.push(r, g, b);
      const k =
        Math.floor(r / KUBELEK) * KUBELKOW * KUBELKOW + Math.floor(g / KUBELEK) * KUBELKOW + Math.floor(b / KUBELEK);
      hist[k]++;
    }
    const n = piksele.length / 3;
    if (!n) break;

    // najliczniejszy kolor wiersza = tło paska (albo faktura zdjęcia)
    let szczyt = 0;
    let ile = 0;
    for (let k = 0; k < hist.length; k++) {
      if (hist[k] > ile) {
        ile = hist[k];
        szczyt = k;
      }
    }
    const tr = (Math.floor(szczyt / (KUBELKOW * KUBELKOW)) + 0.5) * KUBELEK;
    const tg = (Math.floor((szczyt / KUBELKOW) % KUBELKOW) + 0.5) * KUBELEK;
    const tb = ((szczyt % KUBELKOW) + 0.5) * KUBELEK;

    let wTle = 0;
    let daleko = 0;
    for (let j = 0; j < piksele.length; j += 3) {
      const d = Math.hypot(piksele[j] - tr, piksele[j + 1] - tg, piksele[j + 2] - tb);
      if (d <= ODLEGLOSC_TLA) wTle++;
      else if (d > 60) daleko++; // litery: wyraźnie inny kolor niż tło
    }

    // Zdjęcie ma fakturę — nigdy 72% pikseli w jednym odcieniu przez cały wiersz.
    // Ale wiersz przechodzący przez środek liter też nie jest jednolity,
    // dlatego pozwalamy na krótkie przerwy: pas kończy się dopiero wtedy,
    // gdy niejednolitych wierszy jest z rzędu więcej niż wysokość linijki tekstu.
    if (wTle / n < MIN_UDZIAL_TLA) {
      zlych++;
      if (zlych > tolerancja) break;
      ciemne += daleko;
      probki += n;
      continue;
    }
    zlych = 0;
    ostatniDobry = y;
    ciemne += daleko;
    probki += n;
  }

  if (!probki || ciemne / probki < MIN_TEKSTU) return 0; // gladka plama bez liter
  const pas = height - ostatniDobry;
  return pas >= Math.round(height * 0.01) ? pas : 0;
}
