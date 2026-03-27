import { TwitterApi } from "twitter-api-v2";

export async function postTweet({
  text,
  apiKey,
  apiSecret,
  accessToken,
  accessSecret,
}) {
  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret,
  });

  const { data } = await client.v2.tweet(text);

  return {
    id: data.id,
    url: "https://twitter.com/i/status/" + data.id,
  };
}
