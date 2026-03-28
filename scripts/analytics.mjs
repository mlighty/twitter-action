import Zernio from "@zernio/node";

const MIN_WEIGHT = 0.05;
const PRIOR_STRENGTH = 3;
const MIN_AGE_HOURS = 48;

let _client = null;
function getClient() {
  if (!_client) _client = new Zernio();
  return _client;
}

function isOlderThan(dateStr, hours) {
  const posted = new Date(dateStr);
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return posted.getTime() < cutoff;
}

export async function collectMetrics(history) {
  const zernio = getClient();
  const toFetch = history.posts.filter(
    (p) => p.zernioPostId && p.zernioPostId !== "unknown" && !p.metrics && isOlderThan(p.date, MIN_AGE_HOURS)
  );

  if (toFetch.length === 0) return 0;

  let collected = 0;
  for (const post of toFetch) {
    try {
      const response = await zernio.analytics.getAnalytics({
        query: { postId: post.zernioPostId },
      });
      const data = response.data?.analytics || response.analytics || response.data || response;
      const metrics = Array.isArray(data) ? data[0] : data;

      post.metrics = {
        impressions: metrics.impressions || 0,
        likes: metrics.likes || 0,
        comments: metrics.comments || 0,
        shares: metrics.shares || 0,
        clicks: metrics.clicks || 0,
        engagementRate: metrics.engagementRate || 0,
        collectedAt: new Date().toISOString(),
      };
      collected++;
      console.log(
        "  " + post.zernioPostId.slice(0, 8) + ": " +
        post.metrics.engagementRate + "% engagement, " +
        post.metrics.impressions + " impressions"
      );
    } catch (e) {
      console.log("  " + post.zernioPostId.slice(0, 8) + ": skipped (" + e.message.slice(0, 60) + ")");
    }
  }

  return collected;
}

export function computeFormatWeights(postsWithMetrics, formats) {
  const byFormat = {};
  for (const f of formats) byFormat[f] = [];

  for (const p of postsWithMetrics) {
    if (p.metrics && byFormat[p.format] !== undefined) {
      byFormat[p.format].push(p.metrics.engagementRate || 0);
    }
  }

  // Global mean for Bayesian prior
  const allRates = postsWithMetrics
    .filter((p) => p.metrics)
    .map((p) => p.metrics.engagementRate || 0);
  const globalMean =
    allRates.length > 0
      ? allRates.reduce((a, b) => a + b, 0) / allRates.length
      : 1;

  // Bayesian-smoothed score per format
  const scores = {};
  for (const [format, rates] of Object.entries(byFormat)) {
    const sum = rates.reduce((a, b) => a + b, 0);
    const n = rates.length;
    scores[format] = (sum + PRIOR_STRENGTH * globalMean) / (n + PRIOR_STRENGTH);
  }

  // Normalize with minimum floor
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const numFormats = formats.length;
  const reservedFloor = MIN_WEIGHT * numFormats;
  const distributable = 1 - reservedFloor;

  const weights = {};
  for (const format of formats) {
    weights[format] =
      Math.round((MIN_WEIGHT + distributable * (scores[format] / total)) * 1000) / 1000;
  }

  return weights;
}

export function getTopPerformingPosts(postsWithMetrics, max = 3) {
  return [...postsWithMetrics]
    .filter((p) => p.metrics && p.metrics.engagementRate > 0)
    .sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate)
    .slice(0, max);
}

export function getTopTopics(postsWithMetrics, blogPosts) {
  const tagMap = {};
  for (const bp of blogPosts) {
    tagMap[bp.file] = bp.tags || [];
  }

  const tagStats = {};
  for (const p of postsWithMetrics) {
    if (!p.metrics) continue;
    const tags = tagMap[p.file] || [];
    const engagement =
      (p.metrics.likes || 0) +
      (p.metrics.comments || 0) +
      (p.metrics.shares || 0);
    for (const tag of tags) {
      if (!tagStats[tag]) tagStats[tag] = { total: 0, count: 0 };
      tagStats[tag].total += engagement;
      tagStats[tag].count += 1;
    }
  }

  return Object.entries(tagStats)
    .map(([tag, s]) => ({
      tag,
      avgEngagement: Math.round(s.total / s.count),
      postCount: s.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10);
}

export function buildStrategy(history, blogPosts, formats) {
  const postsWithMetrics = history.posts.filter((p) => p.metrics);

  if (postsWithMetrics.length < 5) return null;

  return {
    formatWeights: computeFormatWeights(postsWithMetrics, formats),
    topPerformingPosts: getTopPerformingPosts(postsWithMetrics),
    topTopics: getTopTopics(postsWithMetrics, blogPosts),
    sampleSize: postsWithMetrics.length,
  };
}
