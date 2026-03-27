import fs from "fs";
import path from "path";

export const FORMATS = ["hook", "insight", "question", "stat", "tip"];

export function scanBlogPosts(repoRoot) {
  const blogDir = path.resolve(repoRoot, "src/content/blog");
  if (!fs.existsSync(blogDir)) return [];

  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".md"));
  const posts = [];

  for (const file of files) {
    const filePath = path.resolve(blogDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    const title =
      fm.match(/title:\s*"([^"]+)"/)?.[1] ||
      fm.match(/title:\s*'([^']+)'/)?.[1];
    const description =
      fm.match(/description:\s*"([^"]+)"/)?.[1] ||
      fm.match(/description:\s*'([^']+)'/)?.[1];
    const dateStr = fm.match(/(?:pubDate|date):\s*"?([^\s"]+)"?/)?.[1];
    const tags =
      fm
        .match(/tags:\s*\[([^\]]*)\]/)?.[1]
        ?.split(",")
        .map((t) => t.trim().replace(/['"]/g, "")) || [];

    if (!title) continue;

    const slug = path.basename(file, ".md");
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    posts.push({
      file: "src/content/blog/" + file,
      title,
      description,
      date: dateStr,
      tags,
      slug,
      body,
    });
  }

  return posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function pickPost(posts, history) {
  const promoted = history.posts || [];

  // Find posts not yet promoted at all
  const unpromoted = posts.filter(
    (p) => !promoted.some((h) => h.file === p.file)
  );

  if (unpromoted.length > 0) {
    return { post: unpromoted[0], format: FORMATS[0] };
  }

  // All promoted at least once — find one with unused formats
  for (const post of posts) {
    const usedFormats = promoted
      .filter((h) => h.file === post.file)
      .map((h) => h.format);
    const unused = FORMATS.filter((f) => !usedFormats.includes(f));
    if (unused.length > 0) {
      return { post, format: unused[0] };
    }
  }

  // All formats exhausted — recycle oldest promotion
  if (posts.length > 0) {
    const oldest = [...promoted].sort((a, b) =>
      a.date.localeCompare(b.date)
    )[0];
    const post = posts.find((p) => p.file === oldest?.file) || posts[0];
    return { post, format: FORMATS[0] };
  }

  return null;
}
