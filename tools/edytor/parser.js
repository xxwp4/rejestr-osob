// Parser tekstu z danymi osób -> obiekty dla edytora.
// Format opisany w tools/edytor/INSTRUKCJA.md. Działa w przeglądarce (window.parsujOsoby) i w Node (require).
(function (root) {
  "use strict";

  var PL = { "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z" };
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[ąćęłńóśźż]/g, function (c) { return PL[c]; })
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  }

  // nazwy pól (bez polskich znaków, małymi literami) -> pole w people.json
  var KEYS = {
    name: ["imie i nazwisko", "imie nazwisko", "osoba", "name"],
    city: ["miejscowosc", "miasto", "city"],
    cityFrom: ["skad", "skad jest", "z miasta", "forma z"],
    role: ["kim jest", "rola", "zawod", "role"],
    summary: ["podsumowanie", "streszczenie", "w skrocie", "summary"],
    bio: ["opis", "bio", "o mnie", "o osobie"],
    email: ["e-mail", "email", "mail"],
    attributes: ["atrybuty", "dane", "informacje"],
    links: ["linki", "profile", "media", "social media"],
    faq: ["pytania", "faq", "pytania i odpowiedzi"],
    documents: ["dokumenty", "zalaczniki"],
    docTitle: ["dokument", "nazwa dokumentu"],
    docDesc: ["opis dokumentu"],
    docLatex: ["latex"]
  };
  var LOOKUP = {};
  Object.keys(KEYS).forEach(function (k) { KEYS[k].forEach(function (a) { LOOKUP[a] = k; }); });
  var SECTIONS = ["attributes", "links", "faq", "bio"];

  var SITES = [
    ["instagram.com", "Instagram"], ["facebook.com", "Facebook"], ["fb.com", "Facebook"], ["linkedin.com", "LinkedIn"],
    ["github.com", "GitHub"], ["tiktok.com", "TikTok"], ["youtube.com", "YouTube"], ["youtu.be", "YouTube"],
    ["twitter.com", "X"], ["x.com", "X"], ["kpzkosz", "Statystyki"], ["pzkosz", "Statystyki"], ["90minut", "Statystyki"],
    ["transfermarkt", "Transfermarkt"], ["soundcloud.com", "SoundCloud"], ["spotify.com", "Spotify"], ["twitch.tv", "Twitch"]
  ];
  function siteName(url) {
    var host = url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./, "").toLowerCase();
    for (var i = 0; i < SITES.length; i++) if (host.indexOf(SITES[i][0]) >= 0) return SITES[i][1];
    return host;
  }

  // forma "z …" – najpierw znane miasta, potem proste reguły (wynik do sprawdzenia)
  var MIASTA = {
    "warszawa": "z Warszawy", "krakow": "z Krakowa", "lodz": "z Łodzi", "wroclaw": "z Wrocławia", "poznan": "z Poznania",
    "gdansk": "z Gdańska", "szczecin": "ze Szczecina", "bydgoszcz": "z Bydgoszczy", "lublin": "z Lublina", "bialystok": "z Białegostoku",
    "katowice": "z Katowic", "gdynia": "z Gdyni", "czestochowa": "z Częstochowy", "radom": "z Radomia", "torun": "z Torunia",
    "kielce": "z Kielc", "rzeszow": "z Rzeszowa", "gliwice": "z Gliwic", "olsztyn": "z Olsztyna", "opole": "z Opola",
    "zielona gora": "z Zielonej Góry", "gorzow wielkopolski": "z Gorzowa Wielkopolskiego", "wloclawek": "z Włocławka",
    "inowroclaw": "z Inowrocławia", "grudziadz": "z Grudziądza", "gniezno": "z Gniezna", "swarzedz": "ze Swarzędza",
    "kruszwica": "z Kruszwicy", "chelmno": "z Chełmna", "solec kujawski": "z Solca Kujawskiego", "nakło nad notecia": "z Nakła nad Notecią",
    "naklo nad notecia": "z Nakła nad Notecią", "zakopane": "z Zakopanego", "sopot": "z Sopotu", "elblag": "z Elbląga", "plock": "z Płocka"
  };
  function guessFrom(city) {
    var c = String(city || "").trim();
    if (!c) return "";
    if (MIASTA[norm(c)]) return MIASTA[norm(c)];
    if (/\s/.test(c)) return "";
    var g;
    if (/ia$/.test(c)) g = c.slice(0, -1);
    else if (/[kg]a$/.test(c)) g = c.slice(0, -1) + "i";
    else if (/a$/.test(c)) g = c.slice(0, -1) + "y";
    else if (/[oe]$/.test(c)) g = c.slice(0, -1) + "a";
    else if (/ice$/.test(c)) g = c.slice(0, -1);
    else if (/ek$/.test(c)) g = c.slice(0, -2) + "ka";
    else if (/ów$/.test(c)) g = c.slice(0, -2) + "owa";
    else if (/ń$/.test(c)) g = c.slice(0, -1) + "nia";
    else if (/cz$/.test(c)) g = c + "y";
    else if (/[bcdfghjklłmnprstwzż]$/.test(c)) g = c + "a";
    else return "";
    return (/^[sszśźż][^aąeęioóuy]/i.test(c) ? "ze " : "z ") + g;
  }

  // --- dokumenty LaTeX ------------------------------------------------------

  // nazwy dokumentów urzędowych – takich generator nie tworzy (byłyby podróbkami)
  var OFFICIAL = /prawo jazdy|pozwoleni|zezwoleni|uprawnieni|dowod osobist|paszport|legitymacj|swiadectw|dyplom|zaswiadczeni|akt (urodzenia|malzenstwa|zgonu)|zwolnieni|recept|badani|orzeczeni|certyfikat|licencj|umow/;
  // polecenia, które mogłyby czytać/zapisywać pliki albo psuć szablon
  var FORBIDDEN = /\\(documentclass|usepackage|RequirePackage|input|include|includeonly|includegraphics|openin|openout|read|write|immediate|special|catcode|csname|endcsname|def|edef|gdef|xdef|let|futurelet|makeatletter|newread|newwrite|directlua|jobname|outer)(?![A-Za-z])/;

  // zwraca listę błędów dokumentu { title, description, latex }
  function checkDocument(d) {
    var errors = [];
    var t = norm(d.title);
    if (!t) errors.push("brak nazwy dokumentu (linia „Dokument: …”)");
    else if (OFFICIAL.test(t)) errors.push("„" + d.title + "” to dokument urzędowy – takich generator nie tworzy. Prawdziwy skan wgraj jako plik, albo zrób dokument informacyjny (np. CV, statystyki, lista osiągnięć)");
    if (!String(d.description || "").trim()) errors.push("brak opisu (linia „Opis dokumentu: …”)");
    var src = String(d.latex || "");
    if (!src.trim()) errors.push("brak treści LaTeX – wpisz ją między liniami <<< i >>> pod „LaTeX:”");
    var bad = FORBIDDEN.exec(src);
    if (bad) errors.push("niedozwolone polecenie \\" + bad[1] + " – podaj tylko treść dokumentu, bez preambuły");
    if (/\\(begin|end)\s*\{document\}/.test(src)) errors.push("bez \\begin{document} i \\end{document} – szablon dodaje je sam");
    var depth = 0;
    src.replace(/\\[{}]/g, "").split("").forEach(function (c) { if (c === "{") depth++; else if (c === "}") depth--; });
    if (depth !== 0) errors.push("niezamknięte nawiasy { } w LaTeX");
    return errors.map(function (e) { return (d.title ? d.title + ": " : "") + e; });
  }

  var latexBlocks = [];

  function parseOne(block) {
    var p = { attributes: {}, links: {}, faq: [] };
    var bio = [], section = null, q = null, guessed = false;
    var docs = [], doc = null, errors = [];

    function line(raw) {
      var text = raw.trim();
      if (!text) { if (section === "bio") bio.push(""); return; }
      var item = text.replace(/^[-*•–]\s+/, "");
      var bullet = item !== text;
      var m = /^https?:\/\//i.test(item) ? null : /^([^:]{1,40}):\s*(.*)$/.exec(item);
      var key = m && !bullet ? LOOKUP[norm(m[1])] : null;

      // dokumenty: "Dokument: …", "Opis dokumentu: …", "LaTeX:" + blok <<< >>>
      if (key === "documents") { section = "documents"; return; }
      if (key === "docTitle") {
        doc = { title: m[2].trim(), description: "", latex: "" };
        docs.push(doc);
        section = "documents";
        return;
      }
      if (key === "docDesc" || key === "docLatex") {
        if (!doc) { errors.push("„" + m[1].trim() + "” bez wcześniejszej linii „Dokument: …”"); return; }
        if (key === "docDesc") doc.description = m[2].trim();
        else {
          var tok = /^@@LATEX(\d+)@@$/.exec(m[2].trim());
          doc.latex = tok ? latexBlocks[Number(tok[1])] : "";
        }
        section = "documents";
        return;
      }

      // nagłówek pola, np. "Miejscowość: Toruń" albo "Linki:"
      if (key) {
        section = SECTIONS.indexOf(key) >= 0 ? key : null;
        if (section) { if (m[2].trim()) line(m[2]); return; }
        p[key] = m[2].trim();
        return;
      }

      // dalszy ciąg opisu dokumentu w kolejnych liniach
      if (section === "documents") {
        if (doc && !doc.latex) doc.description += (doc.description ? " " : "") + item;
        return;
      }

      // pytania: "P: …" / "O: …" (albo Pytanie/Odpowiedź, Q/A)
      var qm = /^(p|pytanie|q)\s*[:.)]\s*(.+)$/i.exec(item);
      var am = /^(o|odpowiedz|odpowiedź|a)\s*[:.)]\s*(.+)$/i.exec(item);
      if (qm) { q = { q: qm[2].trim(), a: "" }; p.faq.push(q); section = "faq"; return; }
      if (am && q) { q.a = am[2].trim(); return; }
      if (section === "faq" && q && q.a) { q.a += " " + item; return; }
      if (section === "faq" && m) { q = { q: m[1].trim(), a: m[2].trim() }; p.faq.push(q); return; }

      // w opisie wszystko poza punktami "- klucz: wartość" to tekst
      if (section === "bio" && !(bullet && m)) { bio.push(text); return; }

      var url = (item.match(/https?:\/\/[^\s<>"]+/i) || [])[0];
      if (url) {
        url = url.replace(/[),.;]+$/, "");
        var label = m && !/^https?$/i.test(m[1].trim()) ? m[1].trim() : siteName(url);
        p.links[label] = url;
        return;
      }
      if (m && m[2].trim()) { p.attributes[m[1].trim()] = m[2].trim(); return; }
      bio.push(text);
    }

    block.split("\n").forEach(line);

    p.bio = bio.join("\n").split(/\n\s*\n/).map(function (s) { return s.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    p.faq = p.faq.filter(function (f) { return f.q && f.a; });
    if (p.city && !p.cityFrom) { p.cityFrom = guessFrom(p.city); guessed = !!p.cityFrom; }
    if (p.cityFrom && !/^ze?\s/i.test(p.cityFrom)) p.cityFrom = "z " + p.cityFrom;
    if (/^\s*(<<<|>>>)\s*$/m.test(block)) errors.push("blok LaTeX bez pary <<< / >>> – każdy musi zaczynać się linią <<< i kończyć linią >>>");
    docs.forEach(function (d) { d.errors = checkDocument(d); errors = errors.concat(d.errors); });
    return { person: p, guessedFrom: guessed, documents: docs, errors: errors };
  }

  // tekst z jedną lub wieloma osobami (oddzielonymi linią --- lub ===) -> [{ person, guessedFrom }]
  function parsujOsoby(text) {
    // bloki LaTeX wyjmujemy przed dzieleniem na osoby, żeby ich treść (np. linia ---) nie psuła parsowania
    latexBlocks = [];
    text = String(text || "").replace(/\r/g, "").replace(/^latex:\s*<<<[ \t]*\n([\s\S]*?)\n>>>[ \t]*$/gim, function (all, body) {
      latexBlocks.push(body);
      return "LaTeX: @@LATEX" + (latexBlocks.length - 1) + "@@";
    });
    return text.replace(/ /g, " ")
      .split(/^\s*(?:-{3,}|={3,})\s*$/m)
      .map(parseOne)
      .filter(function (r) { return r.person.name; });
  }

  root.parsujOsoby = parsujOsoby;
  root.sprawdzDokument = checkDocument;
  if (typeof module !== "undefined") module.exports = { parsujOsoby: parsujOsoby, guessFrom: guessFrom, checkDocument: checkDocument };
})(typeof window !== "undefined" ? window : this);
