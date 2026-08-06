# ⚠ TAJEMNICA HANDLOWA — ten folder nie trafia do gita ani na Netlify

Tu leżą ceny katalogowe dostawców, rabaty Dawida i marże.
`.gitignore` wyklucza wszystko poza tym plikiem i wzorem `_WZOR.zasady.json`.

**Nie wklejaj tych liczb do plików w `src/`** — one idą prosto do przeglądarki klienta.

Po każdej zmianie:

```bash
npm run cennik           # przeliczy ceny końcowe do src/generated/
npm run cennik:sprawdz   # tylko sprawdzenie, czy coś się rozjechało
```

## Kopia zapasowa

Ten folder jest jedynym miejscem z zasadami wycen, a git go nie chroni.
Warto trzymać kopię np. na dysku Google obok cenników z `Downloads\CENNIKI\`.

## Co jest teraz

| Plik | Skąd | Stan |
|---|---|---|
| `avant-quartz.zasady.json` | stara aplikacja (cennik Architype 2026) | rabat/marża do potwierdzenia |
| `caesarstone.zasady.json` | stara aplikacja (cennik Architype 2026) | rabat/marża do potwierdzenia |
| `keralini.zasady.json` | stara aplikacja (cennik Architype 2026) | rabat/marża do potwierdzenia |
| `technistone.zasady.json` | stara aplikacja | **brak PDF-a** — ceny tymczasowe |
