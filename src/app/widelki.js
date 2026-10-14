/**
 * WIDEŁKI CENY PRZED FORMULARZEM (flow 4/4, decyzja Dawida 9/14.10.2026).
 *
 * Zasada firmy „dokładna kwota po zostawieniu kontaktu" ZOSTAJE — widełki
 * to świadomy wyjątek: klient przed formularzem widzi uczciwe „od–do",
 * żeby wiedział, czy jest w swoim budżecie, zanim poda telefon. Mniej
 * porzuconych formularzy, zero rozdawania dokładnej wyceny anonimowo.
 *
 * ±5% i zaokrąglenie do pełnych setek W PRZECIWNE strony: dolna w dół,
 * górna w górę. Dzięki temu dokładnej kwoty nie da się odtworzyć z widełek,
 * a prawdziwa cena zawsze mieści się w środku — obietnica z karty nigdy
 * nie kłamie.
 */

export function widelkiWyceny(kwota) {
  const k = Number(kwota);
  if (!Number.isFinite(k) || k <= 0) return null;
  const od = Math.max(0, Math.floor((k * 0.95) / 100) * 100);
  const do_ = Math.ceil((k * 1.05) / 100) * 100;
  return { od, do: do_ };
}

/** 7250 → „6 800 zł" (twarda spacja, jak wszędzie w kwotach na stronie). */
const zlote = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł';

/** Jedno zdanie nad formularzem; null, gdy nie ma czego obiecywać. */
export function tekstWidelek(kwota) {
  const w = widelkiWyceny(kwota);
  if (!w) return null;
  return `Orientacyjnie ${zlote(w.od)}–${zlote(w.do)} brutto — dokładną kwotę pokażemy po wysłaniu.`;
}
