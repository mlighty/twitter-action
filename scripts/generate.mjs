import Anthropic from "@anthropic-ai/sdk";

const FORMAT_INSTRUCTIONS = {
  hook: "Write an attention-grabbing hook that makes people want to click. Lead with the most compelling part of the article.",
  insight:
    "Share the single most valuable insight or takeaway from this article. Make it self-contained but leave them wanting more.",
  question:
    "Ask a thought-provoking question that the article answers. Make it something the target audience genuinely wonders about.",
  stat: "Lead with a specific data point, statistic, or concrete fact from the article. Numbers and specifics grab attention.",
  tip: "Extract one actionable, specific tip from the article. Make it immediately useful even without clicking through.",
};

export async function generateTweet({
  post,
  format,
  siteUrl,
  brandVoice,
  apiKey,
}) {
  const client = new Anthropic({ apiKey });

  const postUrl = siteUrl.replace(/\/$/, "") + "/blog/" + post.slug;

  const prompt = `Generate a single tweet promoting this blog post.

BLOG POST:
Title: ${post.title}
Description: ${post.description || "N/A"}
Content (first 1500 chars):
${post.body.slice(0, 1500)}

POST URL: ${postUrl}

FORMAT: ${format}
${FORMAT_INSTRUCTIONS[format]}

${brandVoice ? "BRAND VOICE: " + brandVoice : ""}

RULES:
- The URL counts as 23 characters on Twitter (t.co wrapping), so you have ~256 characters for text + space before the URL
- The URL MUST be included exactly as provided
- No emojis unless the brand voice specifically calls for them
- No hashtags unless highly relevant (max 2)
- Must feel natural, not promotional or spammy
- Write ONLY the tweet text, nothing else — no quotes, no labels, no explanation`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  let tweet = response.content[0].text.trim();

  // Strip wrapping quotes if Claude added them
  if (
    (tweet.startsWith('"') && tweet.endsWith('"')) ||
    (tweet.startsWith("'") && tweet.endsWith("'"))
  ) {
    tweet = tweet.slice(1, -1);
  }

  // Verify URL is included
  if (!tweet.includes(postUrl)) {
    tweet = tweet + " " + postUrl;
  }

  return { tweet, postUrl };
}
