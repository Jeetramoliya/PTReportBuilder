# Brand assets

Drop the BlackRoot logo here so the "Powered by" badge (bottom-right of every page)
uses the real artwork instead of the text fallback.

- Preferred: **`blackroot.svg`** (crisp at any size, works on light and dark themes).
- Or: **`blackroot.png`** — a **transparent-background** PNG, roughly 200–400 px tall.

The badge loads `blackroot.svg` first, then `blackroot.png`, and only if neither exists
falls back to the text "BLACKROOT". No code change needed — just add the file and redeploy.
