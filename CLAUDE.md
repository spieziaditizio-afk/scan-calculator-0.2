# Scan Calculator 0.2

Single-file warehouse pick tool: **everything lives in `index.html`** (inline CSS + JS, vanilla, no
framework, no build, no deps, no git). Runs offline from `localStorage` on a Zebra TC520L 5" handheld
(Chromium WebView). UI in English; design = dark OLED + bento grid.

## Run & test (Windows / PowerShell)
- Open the app: `Start-Process index.html` (launches default browser).
- Syntax-check the inline script: extract `<script>…</script>` to a temp `.js`, then `node --check`.
- Test pure logic: copy the engine functions into a temp Node script and assert vs a brute-force
  oracle (this is how the subset-sum engine was verified — 400 random cases vs bitmask brute force).
- Bash tool: cwd resets between calls — always use absolute paths. Prefer Glob over `ls`/`find`.

## Critical rules — getting these wrong corrupts counts
- Box barcode → pieces: strip ALL non-digits + leading zeros → `parseInt` (e.g. `NL-00250-A` → 250).
- Rack location: matches `^[A-Z]{2}[0-9]{8}$` (e.g. `CG35071601`). Stored VERBATIM, never cleaned to a
  number. Auto-routed in the scan field: rack regex → set location; else → count as box. A rack
  miscounted as a box = catastrophic. Box codes must never match the rack regex.
- Subset-sum reconstruction must never reuse the same physical box; verify with edge cases.
- Hands-free scan: process on Enter/Tab suffix OR idle-burst fallback (~100ms). Keep scan field auto-focused.
- Print uses a hidden iframe with dynamic `@page` — it's a SEPARATE document, so it CANNOT use the inline
  SVG sprite. Keep print output plain B/W text only.
- Icons: inline SVG sprite (`<use href="#i-…">`), never emoji.

## localStorage keys
`packcalc_cfg` (printer, mode) · `packcalc_pallets` · `packcalc_active` · `packcalc_opt` (target) ·
`packcalc_reconcile` (pick, rack, boxes).
