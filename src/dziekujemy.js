import './style.css';
import { inicjujZgody } from './analytics/zgody.js';
import { konwersjaLead, sledzTelefony } from './analytics/zdarzenia.js';

inicjujZgody();
sledzTelefony();

// Konwersja liczy się DOPIERO tutaj — czyli po realnie przyjętym zgłoszeniu.
// Dzięki temu Google Ads i Meta uczą się na prawdziwych leadach, nie na kliknięciach.
const kwota = Number(new URLSearchParams(location.search).get('kwota')) || 0;
konwersjaLead(kwota);

if (kwota > 0) {
  const el = document.getElementById('kwota-wyceny');
  if (el) el.textContent = kwota.toLocaleString('pl-PL') + ' zł';
  document.getElementById('kwota-wiersz')?.removeAttribute('hidden');
}
