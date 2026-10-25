// Dopisuje losowe, fikcyjne osoby do zbioru testowego: data/test-people.json + sources-test/*.pdf
// Uruchom: node gen-test-data.js [ile=50] [--reset]   (potem: node build.js --test)
//   bez --reset nowe osoby są dopisywane na koniec listy z kolejnymi numerami
// Funkcję addRandomPeople używa też edytor (tools/edytor).
const fs = require("fs");
const path = require("path");

const PEOPLE = path.join(__dirname, "data/test-people.json");
const SRC = path.join(__dirname, "sources-test");
let seed = Date.now() >>> 0;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const some = (a, min, max) => [...a].sort(() => rnd() - 0.5).slice(0, int(min, max));

const MALE = ["Jakub", "Kacper", "Szymon", "Filip", "Michał", "Bartosz", "Mateusz", "Wojciech", "Igor", "Oskar", "Patryk", "Dawid", "Adrian", "Kamil", "Hubert"];
const FEMALE = ["Julia", "Zuzanna", "Maja", "Natalia", "Wiktoria", "Oliwia", "Aleksandra", "Martyna", "Karolina", "Weronika", "Hanna", "Amelia", "Paulina", "Nikola", "Laura"];
// [forma męska, forma żeńska]
const SURNAMES = [
  ["Zawadzki", "Zawadzka"], ["Krajewski", "Krajewska"], ["Sobczak", "Sobczak"], ["Wróbel", "Wróbel"], ["Gajewski", "Gajewska"],
  ["Pawlak", "Pawlak"], ["Rutkowski", "Rutkowska"], ["Michalak", "Michalak"], ["Sikora", "Sikora"], ["Baran", "Baran"],
  ["Szczepański", "Szczepańska"], ["Ostrowski", "Ostrowska"], ["Kubiak", "Kubiak"], ["Malinowski", "Malinowska"], ["Jaworski", "Jaworska"],
  ["Adamczyk", "Adamczyk"], ["Dudek", "Dudek"], ["Wieczorek", "Wieczorek"], ["Kołodziej", "Kołodziej"], ["Czarnecki", "Czarnecka"],
];
// [mianownik, "z ..."]
const CITIES = [
  ["Bydgoszcz", "z Bydgoszczy"], ["Toruń", "z Torunia"], ["Włocławek", "z Włocławka"], ["Inowrocław", "z Inowrocławia"],
  ["Kruszwica", "z Kruszwicy"], ["Swarzędz", "ze Swarzędza"], ["Poznań", "z Poznania"], ["Solec Kujawski", "z Solca Kujawskiego"],
  ["Grudziądz", "z Grudziądza"], ["Gniezno", "z Gniezna"], ["Chełmno", "z Chełmna"], ["Nakło nad Notecią", "z Nakła nad Notecią"],
];
const ROLES = [["uczeń", "uczennica"], ["student", "studentka"], ["zawodnik koszykówki", "zawodniczka koszykówki"], ["programista", "programistka"],
  ["mechanik", "mechaniczka"], ["sprzedawca", "sprzedawczyni"], ["ratownik medyczny", "ratowniczka medyczna"], ["grafik", "graficzka"]];
const SCHOOLS = ["Szkoła Podstawowa nr 5 w Swarzędzu", "I Liceum Ogólnokształcące w Bydgoszczy", "Zespół Szkół Technicznych we Włocławku",
  "Uniwersytet Mikołaja Kopernika w Toruniu", "Politechnika Bydgoska", "Technikum Informatyczne w Inowrocławiu"];
const CLUBS = ["Basket 2010 Kruszwica", "MKS Novum Bydgoszcz", "TKM Włocławek", "KSK Noteć Inowrocław", "UKS Basket Toruń", "Astoria Bydgoszcz"];
const POSITIONS = ["rozgrywający", "rzucający obrońca", "niski skrzydłowy", "silny skrzydłowy", "środkowy"];
const HOBBIES = ["koszykówka", "piłka nożna", "gry komputerowe", "fotografia", "wędkarstwo", "muzyka", "motoryzacja", "siłownia", "rower", "gotowanie"];
const LANGS = ["angielski", "niemiecki", "hiszpański", "rosyjski", "francuski"];
const DOCS = ["dokument_badania_zab", "swiadectwo", "dyplom_zawody", "zaswiadczenie_szkolne", "cv", "certyfikat_jezykowy", "karta_zawodnika"];

function randomPerson(id, docFiles) {
  const female = rnd() < 0.5;
  const first = pick(female ? FEMALE : MALE);
  const last = pick(SURNAMES)[female ? 1 : 0];
  const [city, cityFrom] = pick(CITIES);
  const role = pick(ROLES)[female ? 1 : 0];
  const year = int(1995, 2012);
  const name = `${first} ${last}`;

  // losowy zestaw atrybutów
  const pool = {
    "Rocznik": year,
    "Wzrost": `${int(female ? 155 : 168, female ? 185 : 205)} cm`,
    "Szkoła / uczelnia": pick(SCHOOLS),
    "Klub": pick(CLUBS),
    "Pozycja": pick(POSITIONS),
    "Numer na koszulce": `#${int(0, 99)}`,
    "Języki": some(LANGS, 1, 3).join(", "),
    "Zainteresowania": some(HOBBIES, 2, 4).join(", "),
    "Prawo jazdy": pick(["kat. B", "kat. AM", "brak"]),
  };
  const attributes = {};
  for (const k of some(Object.keys(pool), 3, 7)) attributes[k] = pool[k];

  for (const d of some(DOCS, 0, 3)) docFiles.push(`${id}_${d}.pdf`);
  return {
    id,
    name,
    city,
    cityFrom,
    role,
    summary: `${name} to ${role} ${cityFrom}${attributes["Klub"] ? `, ${female ? "związana" : "związany"} z klubem ${attributes["Klub"]}` : ""}.`,
    attributes,
  };
}

// minimalny, poprawny PDF z jedną linijką tekstu
function pdf(text) {
  const t = text.replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 14 Tf 72 760 Td (${t}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

// dopisuje `count` losowych osób na koniec listy; reset = zacznij od pustej listy
function addRandomPeople(count, { reset = false } = {}) {
  if (reset) fs.rmSync(SRC, { recursive: true, force: true });
  const people = !reset && fs.existsSync(PEOPLE) ? JSON.parse(fs.readFileSync(PEOPLE, "utf8")) : [];
  const start = Math.max(0, ...people.map((p) => p.id)) + 1;
  const docFiles = [];
  const added = [];
  for (let id = start; id < start + count; id++) added.push(randomPerson(id, docFiles));
  fs.mkdirSync(SRC, { recursive: true });
  for (const f of docFiles) fs.writeFileSync(path.join(SRC, f), pdf(`Dokument testowy: ${f}`), "latin1");
  fs.writeFileSync(PEOPLE, JSON.stringify([...people, ...added], null, 2) + "\n");
  return { added, docs: docFiles.length, total: people.length + added.length };
}

module.exports = { addRandomPeople };

if (require.main === module) {
  const count = Number(process.argv.find((a) => /^\d+$/.test(a))) || 50;
  const r = addRandomPeople(count, { reset: process.argv.includes("--reset") });
  console.log(`Dopisano ${r.added.length} osób (nr ${r.added[0].id}–${r.added.at(-1).id}) i ${r.docs} PDF-ów. Razem na liście: ${r.total}.`);
}
