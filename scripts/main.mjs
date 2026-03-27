#!/usr/bin/env node

import { scanBlogPosts, pickPost } from "./content.mjs";
import { generateTweet } from "./generate.mjs";
import { postTweet, resolveTwitterAccountId } from "./post.mjs";
import { readHistory, writeHistory, addEntry } from "./history.mjs";
import { commitHistory } from "./commit.mjs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
const TWITTER_ACCOUNT_ID = process.env.TWITTER_ACCOUNT_ID || "";
const SITE_URL = process.env.SITE_URL;
const BRAND_VOICE = process.env.BRAND_VOICE || "";
const POSTS_PER_RUN = parseInt(process.env.POSTS_PER_RUN || "1", 10);
const DRY_RUN = process.env.DRY_RUN === "true";

function validateEnv() {
  const required = { ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_REPO, SITE_URL };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error("Missing required environment variables: " + missing.join(", "));
    process.exit(1);
  }
  if (!ZERNIO_API_KEY && !DRY_RUN) {
    console.error("Missing ZERNIO_API_KEY (required unless dry_run is true)");
    process.exit(1);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Twitter Post Action (via Zernio)");
  console.log("=".repeat(60));
  console.log("Site:    " + SITE_URL);
  console.log("Repo:    " + GITHUB_REPO);
  console.log("Mode:    " + (DRY_RUN ? "DRY RUN" : "live"));
  console.log("Posts:   " + POSTS_PER_RUN);
  if (BRAND_VOICE) console.log("Voice:   " + BRAND_VOICE);
  console.log("=".repeat(60));

  validateEnv();

  // Resolve Twitter account ID (auto-detect if not provided)
  let accountId = TWITTER_ACCOUNT_ID;
  if (!DRY_RUN) {
    accountId = await resolveTwitterAccountId(TWITTER_ACCOUNT_ID);
    console.log("Account: " + accountId);
  }

  const repoRoot = process.cwd();
  const posts = scanBlogPosts(repoRoot);
  console.log("\nFound " + posts.length + " blog post(s).");

  if (posts.length === 0) {
    console.log("No blog posts found. Nothing to tweet.");
    return;
  }

  const history = readHistory(repoRoot);
  console.log("History: " + history.posts.length + " prior tweet(s).");

  let posted = 0;

  for (let i = 0; i < POSTS_PER_RUN; i++) {
    const pick = pickPost(posts, history);
    if (!pick) {
      console.log("\nNo posts available to tweet.");
      break;
    }

    const { post, format } = pick;
    console.log("\n--- Tweet " + (i + 1) + " of " + POSTS_PER_RUN + " ---");
    console.log("Post:   " + post.title);
    console.log("File:   " + post.file);
    console.log("Format: " + format);

    // Generate tweet
    console.log("Generating tweet...");
    const { tweet, postUrl } = await generateTweet({
      post,
      format,
      siteUrl: SITE_URL,
      brandVoice: BRAND_VOICE,
      apiKey: ANTHROPIC_API_KEY,
    });

    console.log("\nTweet (" + tweet.length + " chars):");
    console.log("  " + tweet);

    if (DRY_RUN) {
      console.log("\n  [DRY RUN — not posted]");
      addEntry(history, {
        file: post.file,
        title: post.title,
        format,
        date: new Date().toISOString().split("T")[0],
        tweetText: tweet,
        postUrl,
        zernioPostId: null,
        tweetUrl: null,
        dryRun: true,
      });
      posted++;
      continue;
    }

    // Post via Zernio
    console.log("Posting to Twitter via Zernio...");
    const result = await postTweet({ text: tweet, accountId });

    console.log("  Posted: " + (result.url || "ID " + result.id));

    addEntry(history, {
      file: post.file,
      title: post.title,
      format,
      date: new Date().toISOString().split("T")[0],
      tweetText: tweet,
      postUrl,
      zernioPostId: result.id,
      tweetUrl: result.url,
    });

    posted++;
  }

  if (posted === 0) {
    console.log("\nNothing posted. Done.");
    return;
  }

  // Save history locally
  writeHistory(repoRoot, history);
  console.log("\nHistory updated (" + history.posts.length + " total entries).");

  // Commit history back to repo
  if (!DRY_RUN) {
    console.log("Committing history...");
    await commitHistory({ repoRoot, repo: GITHUB_REPO, token: GITHUB_TOKEN });
  }

  console.log("\n" + "=".repeat(60));
  console.log("  Done! Posted " + posted + " tweet(s).");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("\nFatal error:", e);
  process.exit(1);
});
