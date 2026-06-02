import fs from "fs";
import path from "path";

async function ghApi(url, { method = "GET", token, body } = {}) {
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
  };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(method + " " + url + " failed (" + res.status + "): " + err);
  }
  return res.json();
}

export async function commitHistory({ repoRoot, repo, token }) {
  const historyPath = path.resolve(repoRoot, ".twitter/history.json");
  if (!fs.existsSync(historyPath)) return;

  const content = fs.readFileSync(historyPath, "utf-8");
  const apiBase = "https://api.github.com/repos/" + repo;

  // Get default branch HEAD
  const repoInfo = await ghApi(apiBase, { token });
  const defaultBranch = repoInfo.default_branch;
  const baseRef = await ghApi(
    apiBase + "/git/ref/heads/" + encodeURIComponent(defaultBranch),
    { token }
  );
  const baseSha = baseRef.object.sha;
  const baseCommit = await ghApi(apiBase + "/git/commits/" + baseSha, {
    token,
  });

  // Create blob + tree + commit
  const blob = await ghApi(apiBase + "/git/blobs", {
    method: "POST",
    token,
    body: { content, encoding: "utf-8" },
  });

  const newTree = await ghApi(apiBase + "/git/trees", {
    method: "POST",
    token,
    body: {
      base_tree: baseCommit.tree.sha,
      tree: [
        {
          path: ".twitter/history.json",
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        },
      ],
    },
  });

  const newCommit = await ghApi(apiBase + "/git/commits", {
    method: "POST",
    token,
    body: {
      message: "chore: update twitter post history",
      tree: newTree.sha,
      parents: [baseSha],
      author: {
        name: "github-actions[bot]",
        email: "41898282+github-actions[bot]@users.noreply.github.com",
        date: new Date().toISOString(),
      },
    },
  });

  // Fast-forward the default branch
  await ghApi(
    apiBase + "/git/refs/heads/" + encodeURIComponent(defaultBranch),
    {
      method: "PATCH",
      token,
      body: { sha: newCommit.sha },
    }
  );

  console.log(
    "History committed to " + defaultBranch + ": " + newCommit.sha.slice(0, 8)
  );
}
