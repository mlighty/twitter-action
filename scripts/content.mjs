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

function weightedRandomFormat(formats, weights) {
  const rand = Math.random();
  let cumulative = 0;
  for (const format of formats) {
    cumulative += weights[format] || 1 / formats.length;
    if (rand < cumulative) return format;
  }
  return formats[formats.length - 1];
}

function selectFormat(usedFormats, strategy) {
  const unused = FORMATS.filter((f) => !usedFormats.includes(f));
  if (unused.length === 0) return FORMATS[0];

  if (strategy?.formatWeights) {
    // Re-normalize weights to only unused formats
    const total = unused.reduce((s, f) => s + (strategy.formatWeights[f] || 0), 0);
    if (total > 0) {
      const normalized = {};
      for (const f of unused) {
        normalized[f] = (strategy.formatWeights[f] || 0) / total;
      }
      return weightedRandomFormat(unused, normalized);
    }
  }

  return unused[0];
}

export function pickPost(posts, history, strategy) {
  const promoted = history.posts || [];

  // Build topic boost map from strategy
  const topicBoost = new Map();
  if (strategy?.topTopics) {
    for (const t of strategy.topTopics) {
      topicBoost.set(t.tag, t.avgEngagement);
    }
  }

  // Find posts not yet promoted at all
  const unpromoted = posts.filter(
    (p) => !promoted.some((h) => h.file === p.file)
  );

  // Sort by topic engagement score if strategy available
  if (topicBoost.size > 0 && unpromoted.length > 1) {
    unpromoted.sort((a, b) => {
      const scoreA = (a.tags || []).reduce((s, t) => s + (topicBoost.get(t) || 0), 0);
      const scoreB = (b.tags || []).reduce((s, t) => s + (topicBoost.get(t) || 0), 0);
      return scoreB - scoreA;
    });
  }

  if (unpromoted.length > 0) {
    return { post: unpromoted[0], format: selectFormat([], strategy) };
  }

  // All promoted at least once — find one with unused formats
  for (const post of posts) {
    const usedFormats = promoted
      .filter((h) => h.file === post.file)
      .map((h) => h.format);
    const unused = FORMATS.filter((f) => !usedFormats.includes(f));
    if (unused.length > 0) {
      return { post, format: selectFormat(usedFormats, strategy) };
    }
  }

  // All formats exhausted — recycle oldest promotion
  if (posts.length > 0) {
    const oldest = [...promoted].sort((a, b) =>
      a.date.localeCompare(b.date)
    )[0];
    const post = posts.find((p) => p.file === oldest?.file) || posts[0];
    return { post, format: selectFormat([], strategy) };
  }

  return null;
}
