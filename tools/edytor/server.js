// Lokalny edytor osób: http://localhost:3000/edytor/
// Uruchom: node tools/edytor/server.js   (albo: npm run edytor)
// Nasłuchuje tylko na 127.0.0.1 – działa wyłącznie na tym komputerze i nie jest częścią strony.
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { addRandomPeople } = require("../../gen-test-data");
const { checkDocument } = require("./parser");

const ROOT = path.resolve(__dirname, "../..");
const SITE = path.join(ROOT, "data/site.json");
const TRASH = path.join(ROOT, ".kosz");
const PORT = Number(process.env.PORT) || 3000;
const MAX_UPLOAD = 50 * 1024 * 1024;
const XELATEX = process.env.XELATEX || "xelatex";

// dwa zbiory: testowy (losowe osoby, noindex, nie trafia na stronę) i prawdziwy (publikowany)
const ZBIORY = {
  test: {
    people: path.join(ROOT, "data/test-people.json"),
    sources: path.join(ROOT, "sources-test"),
    public: path.join(ROOT, "public-test"),
    tex: path.join(ROOT, "data/tex-test"),
    preview: path.join(ROOT, "dist-test"),
    buildArgs: ["--test"],
  },
  prawdziwy: {
    people: path.join(ROOT, "data/people.json"),
    sources: path.join(ROOT, "sources"),
    public: path.join(ROOT, "public"),
    tex: path.join(ROOT, "data/tex"),
    preview: path.join(ROOT, "dist-preview"),
    buildArgs: ["--preview"],
  },
};
let lastPreview = ZBIORY.test.preview;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
};
const PHOTO_EXT = ["jpg", "jpeg", "png", "webp"];

const PL = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
const safeName = (s = "") =>
  s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL[c]).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);

const readPeople = (z) => (fs.existsSync(z.people) ? JSON.parse(fs.readFileSync(z.people, "utf8")) : []);
const writePeople = (z, list) => fs.writeFileSync(z.people, JSON.stringify(list.sort((a, b) => a.id - b.id), null, 2) + "\n");
const findPerson = (list, id) => {
  const p = list.find((x) => x.id === id);
  if (!p) throw new Error(`Nie ma osoby o numerze ${id}`);
  return p;
};

// "12_lista_startow.pdf" -> "lista_startow" (klucz w polu "dokumenty" osoby)
const stemOf = (file) => file.replace(/^\d+_/, "").replace(/\.[^.]+$/, "");

const docsOf = (z, p) =>
  fs.existsSync(z.sources)
    ? fs.readdirSync(z.sources).filter((f) => f.startsWith(`${p.id}_`)).sort()
        .map((file) => ({ file, size: fs.statSync(path.join(z.sources, file)).size, ...((p.dokumenty || {})[stemOf(file)] || {}) }))
    : [];

// --- LaTeX -> PDF ---------------------------------------------------------

const texEsc = (s = "") =>
  String(s).replace(/[\\{}$&#^_%~]/g, (c) =>
    ({ "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" }[c] || "\\" + c));
// tekst do metadanych PDF jako UTF-16BE (żeby działały polskie znaki)
const pdfStr = (s = "") => `<FEFF${Buffer.from(String(s), "utf16le").swap16().toString("hex").toUpperCase()}>`;

// stały szablon: AI/użytkownik podaje tylko treść, stopka zawsze mówi, że to dokument informacyjny
function texDocument(site, p, d) {
  return `\\documentclass[11pt,a4paper]{article}
\\usepackage{fontspec}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{booktabs,tabularx,longtable,array,multirow,xcolor,graphicx}
\\special{pdf:docinfo<</Title ${pdfStr(d.title)} /Author ${pdfStr(p.name)} /Subject ${pdfStr(d.description)} /Creator ${pdfStr(site.name)}>>}
\\makeatletter
\\def\\@oddfoot{\\hfil\\footnotesize ${texEsc(site.name)} -- dokument informacyjny, nie jest dokumentem urzędowym.\\hfil}
\\let\\@evenfoot\\@oddfoot\\def\\@oddhead{}\\let\\@evenhead\\@oddhead
\\makeatother
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}
\\begin{document}
{\\Large\\bfseries ${texEsc(d.title)}\\par}
\\vspace{2pt}{\\large ${texEsc(p.name)}${p.cityFrom ? " " + texEsc(p.cityFrom) : ""}\\par}
\\vspace{2pt}{\\small\\itshape ${texEsc(d.description)}\\par}
\\vspace{6pt}\\hrule\\vspace{6pt}
${d.latex}
\\end{document}
`;
}

function compileLatex(tex) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rejestr-latex-"));
    fs.writeFileSync(path.join(dir, "doc.tex"), tex);
    const args = ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "doc.tex"];
    execFile(XELATEX, args, { cwd: dir, timeout: 120000, windowsHide: true }, (err, stdout) => {
      const pdf = path.join(dir, "doc.pdf");
      let data = null, why = "";
      if (!err && fs.existsSync(pdf)) data = fs.readFileSync(pdf);
      else if (err && err.code === "ENOENT") why = "nie znaleziono programu xelatex – zainstaluj MiKTeX albo TeX Live";
      else {
        const lines = String(stdout).split(/\r?\n/);
        const i = lines.findIndex((l) => l.startsWith("!"));
        why = i >= 0 ? lines.slice(i, i + 4).join("\n") : String(err && err.message);
      }
      fs.rmSync(dir, { recursive: true, force: true });
      data ? resolve(data) : reject(new Error(`Błąd LaTeX: ${why}`));
    });
  });
}

// nic nie jest kasowane na stałe – usunięte pliki lądują w .kosz/
function trash(file) {
  if (!fs.existsSync(file)) return;
  fs.mkdirSync(TRASH, { recursive: true });
  fs.renameSync(file, path.join(TRASH, `${Date.now()}_${path.basename(file)}`));
}
const trashPhoto = (z, p) => p.photo && !/^https?:/.test(p.photo) && trash(path.join(z.public, p.photo));

// usuwa puste pola, żeby plik z danymi był czytelny
function clean(p) {
  for (const [k, v] of Object.entries(p)) {
    const empty = v === "" || v == null || (Array.isArray(v) ? !v.length : typeof v === "object" && !Object.keys(v).length);
    if (empty) delete p[k];
  }
  return p;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("Plik jest za duży (max 50 MB)")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const send = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};

function serveStatic(res, dir, rel, notFound = "404") {
  let file = path.join(dir, decodeURIComponent(rel));
  if (!file.startsWith(dir + path.sep)) { res.writeHead(403); return res.end("403"); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    return res.end(notFound);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
}

async function api(req, res, url) {
  const [, what, arg] = url.pathname.split("/").filter(Boolean);
  const method = req.method;
  const q = url.searchParams;
  const z = ZBIORY[q.get("zbior")] || ZBIORY.test;

  if (what === "site" && method === "GET") return send(res, 200, JSON.parse(fs.readFileSync(SITE, "utf8")));

  if (what === "people" && method === "GET")
    return send(res, 200, readPeople(z).map((p) => ({ ...p, documents: docsOf(z, p) })));

  // zapis osoby: bez id = nowa (dopisana na koniec), z id = edycja (pola spoza formularza zostają)
  if (what === "people" && method === "POST") {
    const body = JSON.parse(await readBody(req, 1e6));
    if (!String(body.name || "").trim()) throw new Error("Imię i nazwisko jest wymagane");
    delete body.documents;
    const list = readPeople(z);
    const id = body.id ? Number(body.id) : Math.max(0, ...list.map((p) => p.id)) + 1;
    const i = list.findIndex((p) => p.id === id);
    const saved = clean({ id, ...(i >= 0 ? list[i] : {}), ...body });
    saved.id = id;
    if (i >= 0) list[i] = saved;
    else list.push(saved);
    writePeople(z, list);
    return send(res, 200, saved);
  }

  if (what === "people" && method === "DELETE") {
    const id = Number(arg);
    const list = readPeople(z);
    const p = findPerson(list, id);
    for (const d of docsOf(z, p)) {
      trash(path.join(z.sources, d.file));
      trash(path.join(z.tex, `${id}_${stemOf(d.file)}.tex`));
    }
    trashPhoto(z, p);
    writePeople(z, list.filter((x) => x.id !== id));
    return send(res, 200, { ok: true });
  }

  // losowe osoby – tylko w zbiorze testowym, zawsze dopisywane na koniec listy
  if (what === "random" && method === "POST") {
    if (z !== ZBIORY.test) throw new Error("Losowe osoby można dodawać tylko do zbioru testowego");
    const count = Math.min(200, Math.max(1, Number(q.get("ile")) || 1));
    const r = addRandomPeople(count);
    return send(res, 200, { added: r.added.map((p) => p.id), docs: r.docs, total: r.total });
  }

  // dokument -> <sources>/<id>_<nazwa>.<rozszerzenie>
  if (what === "files" && method === "POST") {
    const id = Number(arg);
    findPerson(readPeople(z), id);
    const title = String(q.get("name") || "").trim();
    const name = safeName(title);
    const ext = String(q.get("ext") || "").toLowerCase();
    if (!name) throw new Error("Podaj nazwę dokumentu");
    if (!/^[a-z0-9]{1,5}$/.test(ext)) throw new Error("Nieprawidłowe rozszerzenie pliku");
    const file = `${id}_${name}.${ext}`;
    if (fs.existsSync(path.join(z.sources, file))) throw new Error(`Plik ${file} już istnieje – zmień nazwę`);
    const data = await readBody(req, MAX_UPLOAD);
    fs.mkdirSync(z.sources, { recursive: true });
    fs.writeFileSync(path.join(z.sources, file), data);
    const list = readPeople(z);
    const p = findPerson(list, id);
    p.dokumenty = { ...(p.dokumenty || {}), [name]: clean({ tytul: title, opis: String(q.get("opis") || "").trim() }) };
    writePeople(z, list);
    return send(res, 200, { file });
  }

  if (what === "files" && method === "DELETE") {
    const file = path.basename(decodeURIComponent(arg || ""));
    const m = /^(\d+)_/.exec(file);
    if (!m) throw new Error("Nieprawidłowa nazwa pliku");
    trash(path.join(z.sources, file));
    trash(path.join(z.tex, `${m[1]}_${stemOf(file)}.tex`));
    const list = readPeople(z);
    const p = list.find((x) => x.id === Number(m[1]));
    if (p && p.dokumenty) {
      delete p.dokumenty[stemOf(file)];
      if (!Object.keys(p.dokumenty).length) delete p.dokumenty;
      writePeople(z, list);
    }
    return send(res, 200, { ok: true });
  }

  // dokument z LaTeX: body { title, description, latex } -> <sources>/<id>_<nazwa>.pdf (+ źródło w data/tex)
  if (what === "latex" && method === "POST") {
    const id = Number(arg);
    const d = JSON.parse(await readBody(req, 2e6));
    const errors = checkDocument(d);
    if (errors.length) throw new Error(errors.join("\n"));
    const site = JSON.parse(fs.readFileSync(SITE, "utf8"));
    const pdf = await compileLatex(texDocument(site, findPerson(readPeople(z), id), d));
    const name = safeName(d.title);
    const file = `${id}_${name}.pdf`;
    trash(path.join(z.sources, file));
    fs.mkdirSync(z.sources, { recursive: true });
    fs.writeFileSync(path.join(z.sources, file), pdf);
    fs.mkdirSync(z.tex, { recursive: true });
    fs.writeFileSync(path.join(z.tex, `${id}_${name}.tex`), d.latex);
    const list = readPeople(z);
    const p = findPerson(list, id);
    p.dokumenty = { ...(p.dokumenty || {}), [name]: { tytul: d.title.trim(), opis: d.description.trim(), latex: true } };
    writePeople(z, list);
    return send(res, 200, { file, size: pdf.length });
  }

  // źródło LaTeX wygenerowanego dokumentu – do ponownej edycji
  if (what === "latex" && method === "GET") {
    const file = path.basename(String(q.get("file") || ""));
    const m = /^(\d+)_/.exec(file);
    if (!m) throw new Error("Nieprawidłowa nazwa pliku");
    const tex = path.join(z.tex, `${m[1]}_${stemOf(file)}.tex`);
    if (!fs.existsSync(tex)) throw new Error("Ten dokument nie ma źródła LaTeX");
    const meta = (findPerson(readPeople(z), Number(m[1])).dokumenty || {})[stemOf(file)] || {};
    return send(res, 200, { title: meta.tytul || stemOf(file), description: meta.opis || "", latex: fs.readFileSync(tex, "utf8") });
  }

  // zdjęcie -> <public>/img/<id>_<imie_nazwisko>.<rozszerzenie>
  if (what === "photo" && method === "POST") {
    const id = Number(arg);
    const ext = String(q.get("ext") || "").toLowerCase();
    if (!PHOTO_EXT.includes(ext)) throw new Error("Zdjęcie musi być JPG, PNG albo WEBP");
    const data = await readBody(req, MAX_UPLOAD);
    const list = readPeople(z);
    const p = findPerson(list, id);
    trashPhoto(z, p);
    const file = `${id}_${safeName(p.name)}.${ext}`;
    fs.mkdirSync(path.join(z.public, "img"), { recursive: true });
    fs.writeFileSync(path.join(z.public, "img", file), data);
    p.photo = `img/${file}`;
    writePeople(z, list);
    return send(res, 200, p);
  }

  if (what === "photo" && method === "DELETE") {
    const list = readPeople(z);
    const p = findPerson(list, Number(arg));
    trashPhoto(z, p);
    delete p.photo;
    writePeople(z, list);
    return send(res, 200, p);
  }

  if (what === "build" && method === "POST") {
    return execFile(process.execPath, [path.join(ROOT, "build.js"), ...z.buildArgs], { cwd: ROOT }, (err, stdout, stderr) => {
      if (!err) lastPreview = z.preview;
      send(res, err ? 500 : 200, { ok: !err, log: (stdout + stderr).trim() || String(err) });
    });
  }

  send(res, 404, { error: "Nie ma takiej operacji" });
}

http
  .createServer(async (req, res) => {
    // blokada dla innych stron otwartych w przeglądarce (CSRF / DNS rebinding)
    const host = (req.headers.host || "").replace(/:\d+$/, "");
    const origin = req.headers.origin;
    if (!["localhost", "127.0.0.1"].includes(host) || (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      res.writeHead(403);
      return res.end("403");
    }
    const url = new URL(req.url, "http://localhost");
    const z = ZBIORY[url.searchParams.get("zbior")] || ZBIORY.test;
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (url.pathname === "/edytor") { res.writeHead(302, { location: "/edytor/" }); return res.end(); }
      if (url.pathname === "/edytor/") return serveStatic(res, __dirname, "index.html");
      if (url.pathname === "/edytor/parser.js") return serveStatic(res, __dirname, "parser.js");
      if (url.pathname === "/edytor/szablon.txt") return serveStatic(res, __dirname, "szablon.txt");
      if (url.pathname.startsWith("/edytor/pliki/")) return serveStatic(res, z.sources, url.pathname.slice("/edytor/pliki/".length));
      if (url.pathname.startsWith("/edytor/public/")) return serveStatic(res, z.public, url.pathname.slice("/edytor/public/".length));
      // wszystko inne to podgląd ostatnio zbudowanego zbioru
      return serveStatic(res, lastPreview, url.pathname,
        `<p>Brak podglądu. Kliknij „Zbuduj podgląd” w <a href="/edytor/">edytorze</a>.</p>`);
    } catch (e) {
      send(res, 400, { error: e.message });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Edytor: http://localhost:${PORT}/edytor/   (Ctrl+C kończy)`));
