# SponsorSpy Indexer

Cloudflare Worker for indexing sponsorship data.

## Development

Run the dev server with auto-rebuild:

```bash
pnpm dev
```

This will:
1. Watch for changes in `src/`
2. Build with esbuild
3. Serve with miniflare on http://localhost:8787

## Build

```bash
pnpm build
```

## Preview

Preview the built worker:

```bash
pnpm preview
```
