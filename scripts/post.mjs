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
  const { data: accounts } = await zernio.accounts.listAccounts();
  const twitter = accounts.find((a) => a.platform === "twitter");

  if (!twitter) {
    throw new Error(
      "No Twitter account connected to Zernio. Connect one at https://zernio.com or pass twitter_account_id."
    );
  }

  console.log("  Auto-detected Twitter account: " + twitter._id);
  return twitter._id;
}

export async function postTweet({ text, accountId }) {
  const zernio = getClient();

  const { data: post } = await zernio.posts.createPost({
    body: {
      content: text,
      platforms: [{ platform: "twitter", accountId }],
      publishNow: true,
    },
  });

  // Extract the Twitter post URL from the response
  const twitterResult = post.platforms?.find((p) => p.platform === "twitter");
  const postUrl = twitterResult?.platformPostUrl || null;

  return {
    id: post._id,
    url: postUrl,
  };
}
