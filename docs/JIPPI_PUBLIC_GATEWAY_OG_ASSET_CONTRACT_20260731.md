# JIPPI public gateway OG asset contract — 2026-07-31

## Incident

The Netlify runtime served both promotion images successfully:

- `/assets/og/room-og.png`
- `/assets/og/tarot-og.png`

The same paths returned 404 through `https://www.jippi.kr` because the Vercel
gateway did not proxy the `/assets/og/*` namespace. The fortune page temporarily
used absolute Netlify URLs to stay visible, which exposed the internal upstream
and left the deployment contract incomplete.

## Canonical fix

The tracked gateway repository is `C:\Users\downf\suneung-viewer`. Its
`vercel.json` owns the public-domain rewrite:

```text
/assets/og/(.*) -> https://jippi-saju.netlify.app/assets/og/$1
```

The customer page must use first-party relative URLs. Netlify remains the asset
source; Vercel remains only the `www.jippi.kr` gateway.

## Required release proof

`scripts/check-jippi-public-gateway-assets.mjs` must return PASS for existing
fortune illustrations, fonts, and both OG images. The fortune repository's
cross-host smoke must also confirm byte equality between `www.jippi.kr` and
`jippi-saju.netlify.app` for the same paths.

Never deploy the Vercel gateway from a copied fortune payload. Use a clean
worktree of the tracked gateway repository, and do not include unrelated dirty
working-tree files.
