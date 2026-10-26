/**
 * MAIL O ZGŁOSZENIU DO PROGRAMU PARTNERSKIEGO (26.10.2026).
 *
 * Idzie WYŁĄCZNIE do Dawida — zgłaszający dostaje na stronie komunikat
 * „odezwiemy się", a warunki (stawki są NIEJAWNE) poznaje w rozmowie.
 * Dlatego w tym mailu nie ma i nie może być żadnych procentów.
 * Osobny moduł jak mail-rozmowa.js — treść testowalna w gołym node.
 */

const TYPY = {
  stolarz: 'stolarz',
  meble: 'firma meblowa',
  projektant: 'projektant wnętrz',
  inny: 'inny fachowiec',
};

export const typPartnera = (typ) => TYPY[typ] || TYPY.inny;

export function tematZgloszeniaPartnera({ imie, firma }) {
  const kto = [imie, firma && `(${firma})`].filter(Boolean).join(' ');
  return `Nowy partner do programu: ${kto || 'zgłoszenie ze strony'}`;
}

export function mailZgloszeniePartnera({ imie, firma, typ, telefon, email }) {
  const wiersz = (nazwa, wartosc, html) =>
    wartosc
      ? `<tr><td style="color:#6d6a60;padding:3px 10px 3px 0">${nazwa}</td><td style="padding:3px 0">${html || esc(wartosc)}</td></tr>`
      : '';
  return szkielet(`
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8578">Program partnerski — zgłoszenie</p>
    <h1 style="margin:0 0 16px;font-size:20px">${esc(imie || 'Ktoś')} chce zostać partnerem</h1>
    <table role="presentation" style="margin:0 0 18px;font-size:15px;line-height:1.7">
      ${wiersz('Firma', firma)}
      ${wiersz('Typ', typPartnera(typ))}
      ${wiersz('Telefon', telefon, `<a href="tel:${esc(telefon)}" style="color:#8a6a2f;font-weight:bold">${esc(telefon)}</a>`)}
      ${wiersz('E-mail', email, `<a href="mailto:${esc(email)}" style="color:#8a6a2f">${esc(email)}</a>`)}
    </table>
    <p style="margin:0 0 6px;font-size:14px;color:#2b2823">Na stronie obiecujemy kontakt w 48 godzin — warunki przedstawiasz w rozmowie.</p>
    <p style="margin:0;font-size:13px;color:#6d6a60">Karta zgłoszenia czeka w panelu (źródło: zgłoszenie partnerskie). Partnera z kodem zakładasz w zakładce Partnerzy.</p>
  `);
}

/* Te same kawałki co w mail-rozmowa.js — moduł celowo bez importów. */
const szkielet = (srodek) =>
  `<!doctype html><html lang="pl"><body style="margin:0;background:#f5f3ef;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2b2823">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d6;border-radius:12px;padding:28px">${srodek}</div>
  <p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#8a8578;text-align:center">Kamieniarstwo 24h · Aaron sp. z o.o. · ul. Szpitalna 8, 39-400 Tarnobrzeg · NIP 8672241748</p>
</body></html>`;

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
