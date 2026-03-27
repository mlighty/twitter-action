import Zernio from "@zernio/node";

let _client = null;

function getClient() {
  if (!_client) {
    _client = new Zernio(); // reads ZERNIO_API_KEY from env
  }
  return _client;
}

export async function resolveTwitterAccountId(accountId) {
  if (accountId) return accountId;

  // No account ID provided — find the first connected Twitter account
  const zernio = getClient();
  const response = await zernio.accounts.listAccounts();

  // Handle different SDK response shapes
  const accounts = Array.isArray(response)
    ? response
    : response.data || response.accounts || [];

  if (!Array.isArray(accounts)) {
    console.log("  Unexpected accounts response: " + JSON.stringify(response).slice(0, 500));
    throw new Error("Could not parse accounts from Zernio. Pass twitter_account_id explicitly.");
  }

  const twitter = accounts.find((a) => a.platform === "twitter");

  if (!twitter) {
    throw new Error(
      "No Twitter account connected to Zernio. Connect one at https://zernio.com or pass twitter_account_id."
    );
  }

  console.log("  Auto-detected Twitter account: " + (twitter._id || twitter.id));
  return twitter._id || twitter.id;
}

export async function postTweet({ text, accountId }) {
  const zernio = getClient();

  const response = await zernio.posts.createPost({
    body: {
      content: text,
      platforms: [{ platform: "twitter", accountId }],
      publishNow: true,
    },
  });

  // Handle different SDK response shapes
  const post = response.data || response.post || response;

  // Extract the Twitter post URL from the response
  const platforms = post.platforms || [];
  const twitterResult = platforms.find((p) => p.platform === "twitter");
  const postUrl = twitterResult?.platformPostUrl || null;

  return {
    id: post._id || post.id || "unknown",
    url: postUrl,
  };
}
