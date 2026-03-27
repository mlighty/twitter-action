import fs from "fs";
import path from "path";

const HISTORY_DIR = ".twitter";
const HISTORY_FILE = "history.json";

export function readHistory(repoRoot) {
  const filePath = path.resolve(repoRoot, HISTORY_DIR, HISTORY_FILE);
  if (!fs.existsSync(filePath)) {
    return { posts: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function writeHistory(repoRoot, history) {
  const dir = path.resolve(repoRoot, HISTORY_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.resolve(dir, HISTORY_FILE),
    JSON.stringify(history, null, 2) + "\n",
    "utf-8"
  );
}

export function addEntry(history, entry) {
  history.posts.push(entry);
  return history;
}
