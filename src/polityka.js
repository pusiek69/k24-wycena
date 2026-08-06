import './style.css';
import { inicjujZgody, zmienZgody } from './analytics/zgody.js';
import { sledzTelefony } from './analytics/zdarzenia.js';

inicjujZgody();
sledzTelefony();

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});
