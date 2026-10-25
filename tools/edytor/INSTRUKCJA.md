# Szybkie dodawanie osób z tekstu

W edytorze (`npm run edytor` → http://localhost:3000/edytor/) jest pole **„Szybkie dodawanie – wklej tekst”**.
Wklejasz tekst w formacie poniżej (albo wczytujesz plik `.txt`) i klikasz **„Przetwórz tekst”**.

- **Jedna osoba** → dane trafiają do formularza. Sprawdzasz je i klikasz „Zapisz osobę”.
- **Kilka osób** (oddzielonych linią `---`) → lista rozpoznanych osób z przyciskiem „Dodaj wszystkie nowe”.
  Każdą możesz też otworzyć osobno linkiem „do formularza”.
- **Osoba już jest na liście** (to samo imię, nazwisko i miasto) → edytor pyta, czy uzupełnić istniejący wpis.
  Pola, których nie ma w tekście, zostają bez zmian. Przy dodawaniu wielu osób istniejące są pomijane.

## Format

Gotowy przykład: [szablon.txt](szablon.txt).

```
Imię i nazwisko: Jan Kowalski
Miejscowość: Bydgoszcz
Skąd: z Bydgoszczy
Kim jest: student informatyki i koszykarz
Podsumowanie: Jan Kowalski to student informatyki z Bydgoszczy, zawodnik klubu Astoria Bydgoszcz.
E-mail: jan@example.com

Atrybuty:
- Rocznik: 2005
- Wzrost: 196 cm
- Klub: Astoria Bydgoszcz

Linki:
- Instagram: https://instagram.com/jan.kowalski
- Statystyki: https://kpzkosz.com/zawodnik/jan-kowalski

Opis:
Pierwszy akapit.

Drugi akapit.

Pytania:
P: Kim jest Jan Kowalski z Bydgoszczy?
O: To student informatyki i koszykarz.

---

Imię i nazwisko: Następna osoba
...
```

### Pola

| Pole | Inne nazwy, które też działają | Uwagi |
|---|---|---|
| Imię i nazwisko | Osoba | **wymagane** |
| Miejscowość | Miasto | w mianowniku: *Toruń* |
| Skąd | Z miasta | *z Torunia*, *ze Swarzędza*; jeśli brak – zgadywane z miejscowości (sprawdź!) |
| Kim jest | Rola, Zawód | krótko |
| Podsumowanie | Streszczenie, W skrócie | 1 zdanie, 50–160 znaków, z imieniem, nazwiskiem i miastem |
| E-mail | Email, Mail | będzie publiczny |
| Atrybuty: | Dane, Informacje | pod spodem linie `- Nazwa: wartość` |
| Linki: | Profile, Media | pod spodem linie `- Serwis: https://…` |
| Opis: | Bio, O mnie | wszystko do następnego pola; akapity oddziel pustą linią |
| Pytania: | FAQ | pary `P: …` / `O: …` |

Wielkość liter i polskie znaki w nazwach pól nie mają znaczenia (`miasto:` = `Miejscowość:`).

### Parser jest wyrozumiały

- Nieznane pole poza sekcjami, np. `Wzrost: 196 cm`, trafia do atrybutów.
- Sam adres `https://instagram.com/…` w osobnej linii trafia do linków, a nazwa serwisu jest rozpoznawana z adresu.
- Zwykłe zdania bez dwukropka trafiają do opisu.

## Jak wygenerować taki tekst z pomocą AI

1. W edytorze rozwiń **„Jak przygotować taki tekst z pomocą AI”** i kliknij **„Kopiuj polecenie”**.
2. Wklej polecenie do ChatGPT, Claude albo Gemini.
3. Pod nim wklej surowe informacje o osobie (jednej albo kilku): tekst ze strony ze statystykami, CV, notatkę, bio z Instagrama.
4. Odpowiedź AI wklej do pola w edytorze i kliknij „Przetwórz tekst”.
5. **Przeczytaj wynik przed zapisaniem.** AI potrafi coś dopowiedzieć – polecenie tego zabrania, ale sprawdź,
   czy wszystkie fakty są prawdziwe. Na stronie trafiają do Google.

Polecenie każe AI używać tylko podanych faktów, pomijać brakujące pola i oddzielać osoby linią `---`.

## Dobre praktyki

- Ta sama miejscowość i to samo imię i nazwisko co na profilach społecznościowych danej osoby.
- Przynajmniej jeden prawdziwy link do profilu (najważniejsze dla Google).
- Dane innych osób publikuj tylko za ich zgodą.
