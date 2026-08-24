/**
 * MAILE Z ROZMOWY POD OFERTĄ.
 *
 * Dwa kierunki, dwa różne cele:
 *   • klient napisał  → mail do Dawida: ma zobaczyć TREŚĆ od razu, żeby
 *     mógł odpisać z telefonu bez wchodzenia w panel;
 *   • Dawid odpisał   → mail do klienta: zajawka + przycisk do oferty,
 *     bo cała rozmowa i tak wisi pod wyceną.
 *
 * Osobny moduł, jak mail-oferty.js — dzięki temu treść da się przetestować
 * w gołym node, bez stawiania workera.
 */
import { skrot } from './rozmowa.js';

const TEL = '796 991 128';

/** Temat maila do Dawida — od razu wiadomo, kto i w jakiej sprawie. */
export function tematDoDawida(imie, opis) {
  const kto = String(imie || '').trim() || 'Klient';
  return `${kto} pisze w sprawie wyceny${opis ? ` — ${opis}` : ''}`;
}

export const TEMAT_DO_KLIENTA = 'Odpowiedź od Dawida Ząbka — Kamieniarstwo 24h';

/**
 * Klient napisał — mail do Dawida.
 *
 * Treść wchodzi w całości, bo to jest sedno wiadomości. Kontakt do klienta
 * jest tuż pod nią: najczęstszą reakcją Dawida na pytanie o blat jest
 * telefon, nie pisanie.
 */
export function mailDoDawida({ imie, telefon, email, opis, tresc, linkPanelu }) {
  return szkielet(`
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8578">Nowa wiadomość od klienta</p>
    <h1 style="margin:0 0 16px;font-size:20px">${esc(imie || 'Klient')} pyta o wycenę</h1>
    ${opis ? `<p style="margin:0 0 14px;font-size:14px;color:#6d6a60">Dotyczy: <b style="color:#2b2823">${esc(opis)}</b></p>` : ''}
    ${dymek(esc(tresc))}
    <table role="presentation" style="margin:0 0 20px;font-size:14px;line-height:1.7">
      ${telefon ? `<tr><td style="color:#6d6a60;padding-right:10px">Telefon</td><td><a href="tel:${esc(telefon)}" style="color:#8a6a2f;font-weight:bold">${esc(telefon)}</a></td></tr>` : ''}
      ${email ? `<tr><td style="color:#6d6a60;padding-right:10px">E-mail</td><td><a href="mailto:${esc(email)}" style="color:#8a6a2f">${esc(email)}</a></td></tr>` : ''}
    </table>
    ${linkPanelu ? przycisk(linkPanelu, 'Odpisz w panelu →') : ''}
    <p style="margin:0;font-size:13px;color:#6d6a60">Odpowiedź z panelu trafi do klienta mailem i pod wycenę.</p>
  `);
}

/**
 * Dawid odpisał — mail do klienta.
 *
 * Treść dajemy w całości (klient i tak ją zaraz przeczyta), ale przycisk
 * prowadzi pod wycenę: tam jest cała rozmowa i tam można odpisać.
 */
export function mailDoKlienta({ imie, tresc, link }) {
  return szkielet(`
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8578">Kamieniarstwo 24h</p>
    <h1 style="margin:0 0 16px;font-size:20px">Odpowiedź od Dawida Ząbka</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${imie ? `Pan(i) ${esc(imie)} — o` : 'O'}dpisałem na Państwa pytanie o wycenę:</p>
    ${dymek(esc(tresc))}
    ${przycisk(link, 'Zobacz wycenę i odpisz →')}
    <p style="margin:0 0 6px;font-size:13px;color:#6d6a60">Odpowiedź można napisać wprost pod wyceną — albo po prostu odpisać na tę wiadomość.</p>
    <p style="margin:0;font-size:13px;color:#6d6a60">Pytania? Proszę śmiało dzwonić: <a href="tel:+48796991128" style="color:#8a6a2f">${TEL}</a> (pon.–pt. 8:00–18:00).</p>
  `);
}

/** Zajawka pod ofertę w mailu — jedno zdanie, gdy w wątku coś wisi. */
export function zajawkaRozmowy(ile) {
  if (!(ile > 0)) return '';
  return ile === 1
    ? 'Pod wyceną czeka 1 wiadomość.'
    : `Pod wyceną czeka ${ile} wiadomości.`;
}

export { skrot };

/* ─────────────────────────────────────────────────────────── kawałki HTML */

/** Dymek z treścią — ta sama forma po obu stronach rozmowy. */
const dymek = (trescHtml) =>
  `<div style="margin:0 0 18px;padding:14px 16px;background:#f7f5f1;border-left:3px solid #8a6a2f;border-radius:8px">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#2b2823;white-space:pre-wrap">${trescHtml}</p>
    </div>`;

const przycisk = (link, napis) =>
  `<p style="margin:0 0 22px"><a href="${esc(link)}" style="display:inline-block;background:#8a6a2f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px">${napis}</a></p>`;

const szkielet = (srodek) =>
  `<!doctype html><html lang="pl"><body style="margin:0;background:#f5f3ef;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2b2823">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d6;border-radius:12px;padding:28px">${srodek}</div>
  <p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#8a8578;text-align:center">Kamieniarstwo 24h · Aaron sp. z o.o. · ul. Szpitalna 8, 39-400 Tarnobrzeg · NIP 8672241748</p>
</body></html>`;

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
