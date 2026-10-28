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

Na Windowsie: dwuklik w **`edytor.bat`** – uruchamia serwer i sam otwiera edytor w przeglądarce
(jeśli edytor już działa, tylko otwiera kartę). Albo z terminala:

```bash
npm run edytor
```

Adres: http://localhost:3000/edytor/. W edytorze:

- dodajesz, poprawiasz i usuwasz osoby (zapis prosto do `data/people.json`),
- wgrywasz zdjęcie i dokumenty – same dostają prefiks numeru osoby (`12_nazwa.pdf`),
- widzisz, jak wynik wyświetli Google, i listę kontrolną jakości profilu,
- „Zbuduj podgląd” tworzy `dist-preview/`, który oglądasz pod http://localhost:3000/,
- „Skopiuj Prompt” kopiuje polecenie dla AI (razem z wpisanymi nad nim informacjami o osobie), a przyciski Claude / ChatGPT / Gemini dodatkowo otwierają nowy czat – wystarczy Ctrl+V i Enter,
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

## Wysyłanie na GitHub

```bash
npm run wyslij
```

albo przycisk **„Wyślij na GitHub”** w edytorze (widoczny w zbiorze „Prawdziwy”). Skrypt:

1. buduje stronę z prawdziwych danych (błąd = nic nie zostaje wysłane),
2. pokazuje zmienione pliki i liczbę osób/dokumentów,
3. blokuje wysyłkę, jeśli wśród zmian są dane testowe lub lokalne,
4. robi commit (`npm run wyslij -- "własny opis"`) i push,
5. czeka na publikację na GitHub Pages i podaje adres strony.

`npm run wyslij -- --sprawdz` pokazuje, co by poszło, niczego nie wysyłając.

## Google

1. Wejdź na [Google Search Console](https://search.google.com/search-console) → „Dodaj usługę” →
   **„Prefiks URL”** → wpisz adres strony z `data/site.json` (np. `https://xxwp4.github.io/rejestr-osob/`).
2. Wybierz weryfikację **„Tag HTML”**, skopiuj samą wartość `content="…"` i wpisz ją w `data/site.json`:
   `"googleVerification": "wartość"`. Wyślij (`npm run wyslij`), odczekaj minutę i kliknij „Zweryfikuj”.
3. W Search Console → **Mapy witryn** zgłoś adres `sitemap.xml` (np. `https://xxwp4.github.io/rejestr-osob/sitemap.xml`).
4. Po dodaniu nowej osoby: **„Sprawdzanie adresu URL”** → wklej adres jej podstrony → **„Poproś o zindeksowanie”**.
5. Sprawdź dane strukturalne podstrony w [Rich Results Test](https://search.google.com/test/rich-results).

Pierwsze strony pojawiają się w wynikach zwykle po kilku dniach do kilku tygodni; AI Overview pokazuje się tylko
dla części zapytań i nie da się go wymusić. Najwięcej dają: prawdziwe, spójne dane, linki z profili danej osoby
(Instagram, LinkedIn, strona klubu) z powrotem do jej podstrony i własna domena (pod adresem `github.io/rejestr-osob`
plik `robots.txt` nie działa, bo musi leżeć w katalogu głównym domeny – mapę strony trzeba zgłosić ręcznie, jak wyżej).
