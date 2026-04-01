# Twitter Action

Reusable GitHub Action that generates and posts on-brand tweets for blog content using Claude and the Zernio API. Drop it into any site repo's workflow to automate Twitter/X promotion.

## Usage

```yaml
- uses: mlighty/twitter-action@main
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    zernio_api_key: ${{ secrets.ZERNIO_API_KEY }}
    brand_voice: "Professional, witty, concise"
    posts_per_run: "2"
    dry_run: "false"
```

## How it works

1. **Read** recent blog posts from the consuming repo
2. **Generate** on-brand tweets with Claude
3. **Post** to Twitter/X via Zernio API
4. **Commit** post history to avoid duplicate promotion

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `anthropic_api_key` | Yes | Anthropic API key |
| `zernio_api_key` | Yes | Zernio API key |
| `brand_voice` | No | Brand voice description for tweet generation |
| `posts_per_run` | No | Number of tweets per run (default: 1) |
| `dry_run` | No | Preview without posting (default: false) |
