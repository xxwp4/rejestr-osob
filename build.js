// Generuje statyczną stronę z data/*.json i sources/ do folderu dist/.
// Uruchom: node build.js          (prawdziwe dane: data/people.json + sources/)
//          node build.js --test   (dane testowe: data/test-people.json + sources-test/ -> dist-test/, noindex)
const fs = require("fs");
const path = require("path");

const TEST = process.argv.includes("--test");
// --preview: prawdziwe dane, ale do podglądu na komputerze (używa go edytor z tools/edytor)
const PREVIEW = process.argv.includes("--preview");
const LOCAL = TEST || PREVIEW;
const ROOT = __dirname;
// wersje lokalne idą do osobnych folderów, żeby nigdy nie wymieszały się z prawdziwą
const OUT = path.join(ROOT, TEST ? "dist-test" : PREVIEW ? "dist-preview" : "dist");
const SRC_DIR = TEST ? "sources-test" : "sources";
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));
const people = JSON.parse(fs.readFileSync(path.join(ROOT, TEST ? "data/test-people.json" : "data/people.json"), "utf8"));
// w wersjach lokalnych linki są względne od korzenia, żeby działały na lokalnym serwerze
const base = LOCAL ? "" : site.url.replace(/\/$/, "");
const today = new Date().toISOString().slice(0, 10);

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
const PL = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
const slugify = (s) =>
  s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL[c]).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const assetUrl = (f) => (/^https?:/.test(f) ? f : `${base}/${f.replace(/^\//, "")}`);
const personUrl = (p) => `${base}/osoby/${p.slug}/`;
const from = (p) => p.cityFrom || (p.city ? `(${p.city})` : "");

// --- dane ---------------------------------------------------------------

const ids = new Set();
const slugs = new Set();
for (const p of people) {
  if (!Number.isInteger(p.id) || p.id < 1) throw new Error(`Osoba "${p.name}" musi mieć numer "id" (1, 2, 3...)`);
  if (ids.has(p.id)) throw new Error(`Powtórzony id ${p.id}`);
  ids.add(p.id);
  p.slug = p.slug || slugify(`${p.name} ${p.city || ""}`);
  if (slugs.has(p.slug)) p.slug += `-${p.id}`;
  slugs.add(p.slug);
  p.summary = p.summary || `${p.name}${p.role ? ` – ${p.role}` : ""} ${from(p)}.`.replace(/\s+\./, ".");
  p.attributes = p.attributes || {};
  p.documents = [];
}

// pliki z sources/ w formacie <id>_<nazwa>.pdf trafiają do osoby o danym id
const byId = new Map(people.map((p) => [p.id, p]));
const srcPath = path.join(ROOT, SRC_DIR);
const sourceFiles = fs.existsSync(srcPath) ? fs.readdirSync(srcPath).sort() : [];
for (const f of sourceFiles) {
  if (f.startsWith(".")) continue;
  const m = f.match(/^(\d+)_(.+)\.(\w+)$/);
  if (!m) { console.warn(`Uwaga: ${SRC_DIR}/${f} nie ma prefiksu "<id>_" – pomijam`); continue; }
  const owner = byId.get(Number(m[1]));
  if (!owner) { console.warn(`Uwaga: ${SRC_DIR}/${f} – brak osoby o id ${m[1]}`); continue; }
  // tytuł i opis z pola "dokumenty" osoby (ustawia je edytor), inaczej tytuł z nazwy pliku
  const meta = (owner.dokumenty || {})[m[2]] || {};
  const title = meta.tytul || m[2].replace(/[_-]+/g, " ");
  owner.documents.push({
    file: f,
    title: title[0].toUpperCase() + title.slice(1),
    description: meta.opis || "",
    ext: m[3].toUpperCase(),
    size: fs.statSync(path.join(srcPath, f)).size,
    href: `${base}/sources/${encodeURIComponent(f)}`,
  });
}
for (const p of people) {
  if (p.photo && !/^https?:/.test(p.photo) && !fs.existsSync(path.join(ROOT, TEST ? "public-test" : "public", p.photo)))
    console.warn(`Uwaga: brak pliku public/${p.photo} (${p.name})`);
  if (!TEST && !Object.values(p.links || {}).some(Boolean))
    console.warn(`Uwaga: ${p.name} nie ma linków do profili zewnętrznych – Google nie ma jak potwierdzić tych danych`);
}

// właściciel strony (site.json -> "owner": id) – jego profil jest "stroną domową" całej witryny
const owner = TEST ? null : byId.get(site.owner) || null;
if (!TEST && site.owner && !owner) console.warn(`Uwaga: owner ${site.owner} z site.json nie istnieje w people.json`);

// --- HTML ---------------------------------------------------------------

function page({ title, description, canonical, body, schema, style = "" }) {
  return `<!DOCTYPE html>
<html lang="${esc(site.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${LOCAL ? `<meta name="robots" content="noindex, nofollow">` : `<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">`}
${schema.map(jsonLd).join("\n")}
${style && `<style>${style}</style>`}
</head>
<body bgcolor="#ffffff" text="#000000" link="#0000ee" vlink="#551a8b" alink="#ff0000">
${body}
<hr>
<address>
<a href="${base}/">${esc(site.name)}</a> &middot; ostatnia zmiana: ${today}
</address>
</body>
</html>
`;
}

const kb = (n) => (n < 1024 ? `${n} B` : `${Math.ceil(n / 1024)} KB`);

function personSchema(p) {
  const s = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${personUrl(p)}#person`,
    name: p.name,
    url: personUrl(p),
    description: p.summary,
  };
  if (p.jobTitle) s.jobTitle = p.jobTitle;
  if (p.city) s.homeLocation = { "@type": "Place", name: p.city, address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "PL" } };
  const a = p.attributes;
  if (a["Szkoła / uczelnia"]) s.alumniOf = { "@type": "EducationalOrganization", name: a["Szkoła / uczelnia"] };
  if (a["Klub"]) s.memberOf = { "@type": "SportsTeam", name: a["Klub"] };
  if (a["Zainteresowania"]) s.knowsAbout = String(a["Zainteresowania"]).split(/,\s*/);
  if (p.photo) s.image = assetUrl(p.photo);
  if (p.email) s.email = `mailto:${p.email}`;
  const sameAs = Object.values(p.links || {}).filter(Boolean);
  if (sameAs.length) s.sameAs = sameAs;
  return s;
}

function personPage(p) {
  const rows = [["Imię i nazwisko", p.name], ["Miejscowość", p.city], ["Kim jest", p.role], ...Object.entries(p.attributes),
    ...(p === owner ? [["Rola na stronie", "autor i administrator serwisu"]] : [])]
    .filter(([, v]) => v !== undefined && v !== "");
  const links = Object.entries(p.links || {}).filter(([, u]) => u);
  const faq = p.faq || [
    { q: `Kim jest ${p.name} ${from(p)}?`, a: p.summary },
    ...(p.cityFrom ? [{ q: `Skąd jest ${p.name}?`, a: `${p.name} jest ${p.cityFrom}.` }] : []),
  ];
  const sameCity = people.filter((o) => o !== p && o.city && o.city === p.city);

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: personUrl(p),
      name: `${p.name} ${from(p)}`,
      dateModified: today,
      mainEntity: personSchema(p),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    ...p.documents.map((d) => ({
      "@context": "https://schema.org",
      "@type": "DigitalDocument",
      name: `${d.title} – ${p.name}`,
      ...(d.description && { description: d.description }),
      url: d.href,
      encodingFormat: d.ext === "PDF" ? "application/pdf" : undefined,
      about: { "@id": `${personUrl(p)}#person` },
    })),
  ];

  const body = `<p><a href="${base}/">&lt;&lt; powrót do listy osób</a></p>
<h1>${esc(p.name)} ${esc(from(p))}</h1>
${p.photo ? `<p><img src="${esc(assetUrl(p.photo))}" alt="${esc(p.name)}" width="160" border="1"></p>` : ""}
<p><b>${esc(p.summary)}</b></p>
${(p.bio || []).map((t) => `<p>${esc(t)}</p>`).join("\n")}
<hr>
<h2>Dane</h2>
<table border="1" cellpadding="4" cellspacing="0">
<caption align="top"><b>Dane: ${esc(p.name)}</b></caption>
<tbody>
${rows.map(([k, v]) => `<tr><th scope="row" align="left" valign="top">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("\n")}
</tbody>
</table>
${p.documents.length ? `<h2>Dokumenty</h2>
<ul>
${p.documents.map((d) => `<li><a href="${esc(d.href)}">${esc(d.title)}</a> [${d.ext}, ${kb(d.size)}]${d.description ? `<br>\n${esc(d.description)}` : ""}</li>`).join("\n")}
</ul>` : ""}
${links.length || p.email ? `<h2>Linki</h2>
<ul>
${links.map(([k, u]) => `<li><a href="${esc(u)}" rel="me">${esc(k)}</a></li>`).join("\n")}
${p.email ? `<li>e-mail: <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></li>` : ""}
</ul>` : ""}
<h2>Pytania</h2>
<dl>
${faq.map((f) => `<dt><b>${esc(f.q)}</b></dt><dd>${esc(f.a)}</dd>`).join("\n")}
</dl>
${sameCity.length ? `<h2>Inne osoby: ${esc(p.city)}</h2>
<ul>
${sameCity.map((o) => `<li><a href="${personUrl(o)}">${esc(o.name)}</a></li>`).join("\n")}
</ul>` : ""}`;

  return page({
    title: `${p.name} ${from(p)}${p.role ? ` – ${p.role}` : ""}`,
    description: p.summary,
    canonical: personUrl(p),
    body,
    schema,
  });
}

// kwadratowe karty na stronie głównej – surowe, jak ze starego katalogu
const GRID_CSS = `
.siatka { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.siatka li { aspect-ratio: 1; border: 1px solid #000; padding: 6px; display: flex; flex-direction: column; overflow: hidden; }
.siatka .foto { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: #c0c0c0; border: 1px inset #808080; margin-bottom: 4px; text-decoration: none; color: #000; font-size: 2.2em; }
.siatka .foto img { width: 100%; height: 100%; object-fit: cover; }
.siatka small { color: #444; }`;

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function card(p) {
  const words = p.name.trim().split(/\s+/);
  const data = { nr: p.id, imie: p.name, nazwisko: `${words.at(-1)} ${words.slice(0, -1).join(" ")}`, miasto: p.city || "", dok: p.documents.length };
  return `<li ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}>
<a class="foto" href="${personUrl(p)}" tabindex="-1" aria-hidden="true">${
    p.photo ? `<img src="${esc(assetUrl(p.photo))}" alt="" loading="lazy">` : esc(initials(p.name))}</a>
<a href="${personUrl(p)}"><b>${esc(p.name)}</b></a>
<small>${esc(p.city || "")}</small>
<small>nr ${p.id}${p.documents.length ? ` &middot; dok.: ${p.documents.length}` : ""}</small>
</li>`;
}

function indexPage() {
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.name,
      url: `${base}/`,
      inLanguage: site.language,
      ...(owner && { author: { "@id": `${personUrl(owner)}#person` }, publisher: { "@id": `${personUrl(owner)}#person` } }),
    },
    ...(owner ? [personSchema(owner)] : []),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: sorted.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: personUrl(p), name: p.name })),
    },
  ];
  const body = `<h1>${esc(site.name)}</h1>
<p>${esc(site.description)}</p>
${owner ? `<p>Prowadzi: <a href="${personUrl(owner)}">${esc(owner.name)}</a> ${esc(from(owner))}</p>` : ""}
${TEST ? `<p><font color="#cc0000"><b>WERSJA TESTOWA – dane fikcyjne.</b></font></p>` : ""}
<hr>
<p>Osób na liście: ${people.length}</p>
<p id="sortuj" hidden>Sortuj według:
<a href="#" data-key="nr" data-num>nr</a> |
<a href="#" data-key="imie">imienia</a> |
<a href="#" data-key="nazwisko">nazwiska</a> |
<a href="#" data-key="miasto">miejscowości</a> |
<a href="#" data-key="dok" data-num>dokumentów</a></p>
<ul class="siatka" id="rejestr" aria-label="Rejestr osób">
${sorted.map(card).join("\n")}
</ul>
<script>
// sortowanie kart; bez JS lista zostaje posortowana po imieniu i nazwisku
(function () {
  var list = document.getElementById("rejestr");
  var bar = document.getElementById("sortuj");
  var links = bar.getElementsByTagName("a");
  var state = { key: "imie", asc: true };
  bar.hidden = false;
  function mark() {
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      a.textContent = a.textContent.replace(/ [\\u25b2\\u25bc]$/, "");
      if (a.getAttribute("data-key") === state.key) a.textContent += state.asc ? " \\u25b2" : " \\u25bc";
    }
  }
  for (var i = 0; i < links.length; i++) links[i].onclick = function (e) {
    e.preventDefault();
    var key = this.getAttribute("data-key"), num = this.hasAttribute("data-num");
    state.asc = state.key === key ? !state.asc : true;
    state.key = key;
    var items = Array.prototype.slice.call(list.children);
    items.sort(function (a, b) {
      var x = a.getAttribute("data-" + key), y = b.getAttribute("data-" + key);
      var r = num ? x - y : x.localeCompare(y, "pl") || a.getAttribute("data-imie").localeCompare(b.getAttribute("data-imie"), "pl");
      return state.asc ? r : -r;
    });
    items.forEach(function (li) { list.appendChild(li); });
    mark();
  };
  mark();
})();
</script>`;
  return page({ title: site.name, description: site.description, canonical: `${base}/`, body, schema, style: GRID_CSS });
}

// --- zapis --------------------------------------------------------------

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

fs.rmSync(OUT, { recursive: true, force: true });
write("index.html", indexPage());
for (const p of people) write(`osoby/${p.slug}/index.html`, personPage(p));
// zdjęcia osób testowych leżą w public-test/, żeby nigdy nie trafiły na prawdziwą stronę
for (const dir of TEST ? ["public", "public-test"] : ["public"])
  if (fs.existsSync(path.join(ROOT, dir))) fs.cpSync(path.join(ROOT, dir), OUT, { recursive: true });
for (const p of people) for (const d of p.documents) {
  fs.mkdirSync(path.join(OUT, "sources"), { recursive: true });
  fs.copyFileSync(path.join(srcPath, d.file), path.join(OUT, "sources", d.file));
}

if (LOCAL) {
  write("robots.txt", "User-agent: *\nDisallow: /\n");
} else {
  const urls = [`${base}/`, ...people.map(personUrl), ...people.flatMap((p) => p.documents.map((d) => d.href))];
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`
  );
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
  // GitHub Pages: plik CNAME podpina własną domenę (niepotrzebny pod adresem *.github.io)
  const host = new URL(base).hostname;
  if (!host.endsWith(".github.io")) write("CNAME", host + "\n");
}

const docs = people.reduce((n, p) => n + p.documents.length, 0);
console.log(`Gotowe${TEST ? " (TEST)" : ""}: ${people.length} osób, ${docs} dokumentów -> ${path.basename(OUT)}/`);
