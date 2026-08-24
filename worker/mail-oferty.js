/**
 * MAIL Z OFERTĄ — treść wiadomości, którą dostaje klient.
 *
 * Osobny moduł, bo ta sama funkcja obsługuje dwie rzeczy:
 *   • wysyłkę (POST /oferta/wyslij),
 *   • PODGLĄD przed wysyłką w trybie właściciela — Dawid widzi dokładnie
 *     ten HTML, który pojdzie mailem, a nie jego podobiznę.
 *
 * Dzięki wydzieleniu da się to też przetestować w gołym node.
 */

export const TEMAT_OFERTY = 'Wycena przygotowana przez Dawida Ząbka — Kamieniarstwo 24h';

/**
 * Kwota po polsku: „1 234 zł".
 *
 * Grupowanie robimy SAMI, zamiast przez toLocaleString: worker (workerd)
 * i node formatują `pl-PL` różnie — raz spacja nierozdzielająca, raz nic —
 * a klient ma dostać dokładnie ten zapis, który Dawid widział w podglądzie.
 */
const zl = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł';

/**
 * ROZRYS W MAILU — zajawka, nie rysunek.
 *
 * SVG w mailu to loteria: Gmail wycina go w całości, Outlook renderuje
 * po swojemu. Zamiast wysyłać obrazek, który u połowy klientów będzie
 * pustą ramką, mówimy WPROST, co czeka pod linkiem — i podajemy liczby,
 * które tłumaczą cenę materiału (ile płyt, ile z nich wchodzi w blat).
 */
function rozrysZajawka(o) {
  const r = o?.rozrys;
  const s = r && r.statystyki;
  if (!s || !(s.plyt > 0)) return '';

  const plyt = s.plyt === 1 ? '1 płyta' : `${s.plyt} płyty`;
  return `<div style="margin:0 0 18px;padding:14px 16px;background:#f7f5f1;border:1px solid #e4e0d6;border-radius:8px">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8578;margin-bottom:6px">Rozrys płyt</div>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#2b2823">
        Pod linkiem poniżej zobaczą Państwo rysunek: jak elementy blatu układają się na płycie kamienia.
        Ten blat wymaga <b>${plyt}</b>; powierzchnia blatu to ${liczbaPl(s.elementyM2)} m² z ${liczbaPl(s.plytM2)} m² płyt,
        co daje ${liczbaPl(s.wykorzystanieProc, 1)}% wykorzystania — reszta to nieunikniony odpad przy cięciu.
      </p>
    </div>`;
}

/** Liczba po polsku, z przecinkiem — bez zależności od ustawień środowiska. */
const liczbaPl = (n, miejsc = 2) =>
  (Math.round((Number(n) || 0) * 10 ** miejsc) / 10 ** miejsc).toString().replace('.', ',');

/**
 * WIADOMOŚĆ OD DAWIDA — osobisty dopisek do oferty.
 *
 * Idzie w mailu NAD przyciskiem, bo to pierwsza rzecz, którą klient ma
 * przeczytać po kwocie. Ta sama treść stoi na stronie oferty — jedno
 * źródło, więc mail i strona nie mogą się rozjechać.
 */
function wiadomoscDawida(tresc) {
  const t = String(tresc || '').trim();
  if (!t) return '';
  return `<div style="margin:0 0 18px;padding:14px 16px;background:#f7f5f1;border-left:3px solid #8a6a2f;border-radius:8px">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8578;margin-bottom:6px">Od Dawida</div>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#2b2823;white-space:pre-wrap">${eskapuj(t)}</p>
    </div>`;
}

/** Mail z ofertą — spójny z mailem wyceny, ale podpisany osobiście. */
export function mailOferty(imie, o, link) {
  const kwota = zl(o.razem);
  const przekreslona =
    o.przekresl && Number(o.razemPrzed) > Number(o.razem)
      ? `<span style="text-decoration:line-through;color:#8a8578;font-size:16px">${zl(o.razemPrzed)}</span> `
      : '';
  const gratisy = (o.pozycje || [])
    .filter((p) => p.gratis)
    .map((p) => `<li style="margin:4px 0">${eskapuj(p.nazwa)} — <b>gratis</b></li>`)
    .join('');

  return `<!doctype html><html lang="pl"><body style="margin:0;background:#f5f3ef;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2b2823">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d6;border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8578">Kamieniarstwo 24h</p>
    <h1 style="margin:0 0 16px;font-size:20px">Wycena przygotowana przez Dawida Ząbka</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${imie ? `Pan(i) ${eskapuj(imie)} — p` : 'P'}rzygotowałem indywidualną wycenę blatu: <b>${eskapuj(o.opis || '')}</b>.</p>
    <p style="margin:0 0 6px;font-size:15px">Kwota całkowita brutto:</p>
    <p style="margin:0 0 18px;font-size:28px;font-weight:bold">${przekreslona}${kwota}</p>
    ${gratisy ? `<ul style="margin:0 0 18px;padding-left:20px;font-size:14px">${gratisy}</ul>` : ''}
    ${wiadomoscDawida(o.wiadomosc)}
    ${rozrysZajawka(o)}
    <p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#8a6a2f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px">Zobacz pełne rozbicie wyceny →</a></p>
    <p style="margin:0 0 6px;font-size:13px;color:#6d6a60">Wycena przygotowana indywidualnie, ważna 30 dni.</p>
    <p style="margin:0;font-size:13px;color:#6d6a60">Pytania? Proszę śmiało dzwonić: <a href="tel:+48796991128" style="color:#8a6a2f">796 991 128</a> (pon.–pt. 8:00–18:00) albo odpisać na tę wiadomość.</p>
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#8a8578;text-align:center">Kamieniarstwo 24h · Aaron sp. z o.o. · ul. Szpitalna 8, 39-400 Tarnobrzeg · NIP 8672241748</p>
</body></html>`;
}

const eskapuj = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
