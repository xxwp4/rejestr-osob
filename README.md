# Strona z profilami osób

Statyczna strona generowana z plików JSON i hostowana na GitHub Pages z własną domeną.

## Struktura

- `data/site.json` – adres domeny, nazwa i opis strony
- `data/people.json` – lista osób; każda ma numer `id` i dostaje stronę `/osoby/imie-nazwisko-miasto/`
- `sources/` – dokumenty w formacie `<id>_<nazwa>.pdf`, np. `12_dokument_badania_zab.pdf` pokaże się u osoby z `"id": 12` jako „Dokument badania zab”
- `public/img/` – zdjęcia (w `people.json`: `"photo": "img/nazwa.jpg"`)
- `build.js` – generator, wynik trafia do `dist/`
- `tools/edytor/` – lokalny edytor osób (nie jest publikowany)

## Dodanie osoby – edytor

```bash
npm run edytor
```

Otwórz http://localhost:3000/edytor/. W edytorze:

- dodajesz, poprawiasz i usuwasz osoby (zapis prosto do `data/people.json`),
- wgrywasz zdjęcie i dokumenty – same dostają prefiks numeru osoby (`12_nazwa.pdf`),
- widzisz, jak wynik wyświetli Google, i listę kontrolną jakości profilu,
- „Zbuduj podgląd” tworzy `dist-preview/`, który oglądasz pod http://localhost:3000/,
- „Szybkie dodawanie – wklej tekst” zamienia wklejony tekst (albo plik .txt) na osoby – opis formatu i polecenie dla AI: [tools/edytor/INSTRUKCJA.md](tools/edytor/INSTRUKCJA.md).

Edytor nasłuchuje tylko na tym komputerze, a GitHub publikuje wyłącznie `dist/`, więc ani edytor, ani podgląd nie trafiają do internetu. Usunięte pliki lądują w `.kosz/` (nie w gicie).

Ręcznie: skopiuj blok osoby w `data/people.json`, nadaj nowy `id` i zmień dane, potem `node build.js`.

## Dane testowe

Zbiór testowy to `data/test-people.json` + `sources-test/` + `public-test/`. `node gen-test-data.js [ile]` **dopisuje** losowe osoby na koniec listy (domyślnie 50), `--reset` zaczyna od pustej. To samo robi przycisk „Dodaj losowe” w edytorze (zbiór „Testowy”), gdzie możesz też ręcznie dopisywać i poprawiać osoby.

`node build.js --test` buduje z niego osobną stronę w `dist-test/`, oznaczoną „noindex” (Google jej nie zaindeksuje). Pliki testowe nie trafiają do gita ani na prawdziwą stronę.

## Właściciel strony

`"owner"` w `data/site.json` to `id` osoby prowadzącej stronę. Jej profil jest podlinkowany na stronie głównej i oznaczony w danych dla Google jako autor całej witryny. Uzupełnij mu `links` (GitHub, LinkedIn, uczelnia itp.) – to po nich Google potwierdza, że to prawdziwa osoba. Build ostrzega o każdej osobie bez takich linków.

## Pierwsze wdrożenie

1. Utwórz repozytorium na GitHubie i wypchnij ten folder na gałąź `main`.
2. Repozytorium → **Settings → Pages → Source: GitHub Actions**.
3. W `data/site.json` wpisz swoją domenę w `url`.
4. U rejestratora domeny ustaw DNS:
   - dla domeny głównej (`domena.pl`): rekordy **A** na `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - dla `www.domena.pl`: rekord **CNAME** na `TWOJ-LOGIN.github.io`
5. Settings → Pages → Custom domain: wpisz domenę, po weryfikacji włącz **Enforce HTTPS**.

Każdy `git push` na `main` publikuje stronę automatycznie.

## Google

1. Dodaj domenę w [Google Search Console](https://search.google.com/search-console) (weryfikacja przez rekord TXT w DNS).
2. Zgłoś mapę strony: `https://twoja-domena.pl/sitemap.xml`.
3. Dla nowej osoby użyj „Sprawdzanie adresu URL” → „Poproś o zindeksowanie”.
4. Sprawdź znaczniki: [Rich Results Test](https://search.google.com/test/rich-results).
