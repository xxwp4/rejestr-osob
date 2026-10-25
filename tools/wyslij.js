// Wysyła prawdziwe dane (data/people.json, sources/, public/, data/tex/) i kod na GitHub,
// co uruchamia publikację strony na GitHub Pages.
// Uruchom: npm run wyslij               (opis commita ustawi się sam)
//          npm run wyslij -- "Dodano Jana Kowalskiego"
//          npm run wyslij -- --sprawdz  (tylko pokazuje, co by poszło – niczego nie wysyła)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--sprawdz");
const MESSAGE = process.argv.slice(2).filter((a) => a !== "--sprawdz").join(" ").trim();
// dane testowe nigdy nie mogą trafić do repozytorium (są też w .gitignore)
const BLOCKED = /^(data\/test-people\.json|data\/people\.backup\.json|data\/tex-test\/|sources-test\/|public-test\/|dist[^/]*\/|\.kosz\/)/;

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const step = (text) => console.log(`\n== ${text}`);
function fail(text) {
  console.error(`\nBŁĄD: ${text}`);
  process.exit(1);
}

function findGh() {
  for (const cmd of ["gh", "C:/Program Files/GitHub CLI/gh.exe"]) {
    try { execFileSync(cmd, ["--version"], { stdio: "ignore" }); return cmd; } catch {}
  }
  return null;
}

// 1. strona musi się poprawnie zbudować z prawdziwych danych
step("Sprawdzam, czy strona się buduje");
try {
  console.log(execFileSync(process.execPath, [path.join(ROOT, "build.js")], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());
} catch (e) {
  fail(`strona się nie buduje – popraw dane i spróbuj ponownie:\n${(e.stdout || "") + (e.stderr || "")}`);
}

// 2. co idzie do wysłania
step("Zmiany do wysłania");
git("add", "-A");
const staged = git("diff", "--cached", "--name-status").split("\n").filter(Boolean);
const blocked = staged.map((l) => l.split("\t").pop()).filter((f) => BLOCKED.test(f));
if (blocked.length) {
  git("reset", "-q");
  fail(`te pliki to dane testowe/lokalne i nie mogą trafić na GitHub:\n  ${blocked.join("\n  ")}`);
}
let ahead = 0;
try { ahead = Number(git("rev-list", "--count", "@{u}..HEAD")); } catch {}
if (!staged.length && !ahead) {
  console.log("Brak zmian – na GitHubie jest już aktualna wersja.");
  process.exit(0);
}
staged.forEach((l) => console.log("  " + l.replace("\t", "  ")));

const people = JSON.parse(fs.readFileSync(path.join(ROOT, "data/people.json"), "utf8"));
const docs = fs.existsSync(path.join(ROOT, "sources"))
  ? fs.readdirSync(path.join(ROOT, "sources")).filter((f) => /^\d+_/.test(f)).length
  : 0;
console.log(`Na stronie będzie: ${people.length} osób, ${docs} dokumentów.`);
if (DRY) {
  git("reset", "-q");
  console.log("\nTryb --sprawdz: niczego nie wysłano.");
  process.exit(0);
}

// 3. commit
if (staged.length) {
  step("Zapisuję zmiany (commit)");
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  const message = MESSAGE || `Aktualizacja danych: ${people.length} osób, ${docs} dokumentów (${date})`;
  git("commit", "-q", "-m", message);
  console.log(message);
}

// 4. push
step("Wysyłam na GitHub");
try {
  execFileSync("git", ["push", "-q"], { cwd: ROOT, stdio: "inherit" });
} catch {
  fail("nie udało się wysłać. Sprawdź połączenie i zalogowanie (gh auth status), potem uruchom: npm run wyslij");
}

// 5. adres strony i postęp publikacji
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));
const remote = git("remote", "get-url", "origin").replace(/\.git$/, "");
const gh = findGh();
if (gh) {
  step("Czekam na publikację strony (zwykle ok. 1 minuty)");
  try {
    const repo = remote.replace(/^https:\/\/github\.com\//, "");
    const sha = git("rev-parse", "HEAD");
    let id = "";
    for (let i = 0; i < 10 && !id; i++) {
      id = execFileSync(gh, ["run", "list", "-R", repo, "--commit", sha, "--limit", "1", "--json", "databaseId", "--jq", ".[0].databaseId"], { encoding: "utf8" }).trim();
      if (!id) execFileSync(process.execPath, ["-e", "setTimeout(()=>{},3000)"]);
    }
    if (id) {
      execFileSync(gh, ["run", "watch", id, "-R", repo, "--exit-status", "--interval", "5"], { stdio: "ignore" });
      console.log("Opublikowano.");
    }
  } catch {
    console.log(`Publikacja się nie udała albo jeszcze trwa – zobacz: ${remote}/actions`);
  }
} else {
  console.log(`Postęp publikacji: ${remote}/actions`);
}
console.log(`Strona: ${site.url.replace(/\/?$/, "/")}`);
