# Pallet QR Ingest & Relabel — Design Spec
_Date: 2026-06-16_

## Goal

Let Optimize mode scan a pallet's QR label (printed by a separate receiving app on a Zebra ZT
industrial printer) to load all of its boxes at once, instead of scanning each box individually.
After the operator pulls boxes for a floor pre-order, the app removes those boxes from the
pallet's stored state and reprints an updated QR label on the QLn420 (the handheld's mobile
label printer) so the label posted at the rack location always matches what physically remains.

## Context

- This app runs on a Zebra TC520L handheld with a QLn420 mobile label printer, used for
  **post-receiving floor pre-order verification**: checking optimal box combinations for a
  partial pick against a target piece count.
- A separate "receiving" app (different codebase, prints via a Zebra ZT620 industrial printer)
  produces the original pallet label with an embedded QR code when a pallet is received.
- The QR payload format is **fixed by that other app** — this app must read and write it exactly.
- Today, Optimize only supports scanning individual box barcodes one at a time. This spec adds
  bulk pallet ingest via QR and a relabel-on-pick workflow.

## QR Payload Format (external contract — do not deviate)

Pipe-delimited, 7 fields, decoded by the handheld's hardware scanner straight into the scan field
(scanning a QR behaves identically to scanning a 1D barcode — text + Enter/Tab):

```
PC1|palletId|PN|PO|delivery|COO|q1,q2,q3,...
```

| Field | Meaning |
|---|---|
| `PC1` | Format version literal |
| `palletId` | Pallet number, e.g. `1` (shown as `PLT 1`) |
| `PN` | Part number / SKU-ish identifier, e.g. `SEVENUM` |
| `PO` | Purchase order |
| `delivery` | Delivery reference |
| `COO` | Country of origin |
| `q1,q2,...` | Comma-separated piece counts; box `B0i` (1-based) = `qtys[i-1]` pieces |

`totalCajas = qtys.length`, `totalPiezas = sum(qtys)`. Boxes are never re-numbered — `seq` is
always the 1-based position in `qtys` at the time the pallet was created or last re-encoded.

## Scope

- **Optimize mode only.** Reconcile's pick-vs-list model has no pallet/box-array concept and is
  out of scope.
- Reading (QR → pallet) and writing (pallet → QR label) both live in this app. The receiving app
  and its ZT620 printing are out of scope — never touched, never assumed to change.
- No new localStorage keys — pallet QR metadata is stored on the existing `pallets` array
  (`packcalc_pallets`), no schema migration needed for old saved pallets (missing `meta` is
  treated as `null`/empty, same as a manually-built pallet).

## Data Model Change

Every pallet object gains a `meta` field (previously pallets had no such field):

```js
{
  id, name, rack, boxes: [{seq, pieces}, ...],
  meta: { ver:'PC1', palletId:'', pn:'', po:'', delivery:'', coo:'' }
}
```

- **QR-ingested pallet:** `meta` fields populated from the scanned QR's fields 0–5.
- **Manually-built pallet** (created today's way, by scanning a rack then loose box barcodes):
  `meta = { ver:'PC1', palletId:'', pn:'', po:'', delivery:'', coo:'' }` — present but blank.
  This lets *any* pallet — manual or QR-ingested — produce a valid, re-scannable QR label later;
  manual pallets just have no identity fields and print no PN/PLT line.
- `name`: QR pallet → `PN` (e.g. `SEVENUM`); manual pallet → existing default `Pallet N` behavior,
  unchanged.

## Scan Routing (Optimize scan field)

The existing auto-route (rack regex → set location; else → box piece count) gains a new,
highest-priority branch:

1. **`/^PC\d+\|/`** → parse as a pallet QR (see "QR Parsing" below).
2. **`/^[A-Z]{2}[0-9]{8}$/`** (existing) → set rack on the active pallet.
3. **else** (existing) → clean to digits, count as a box on the active pallet.

Box barcodes and rack codes never contain `|`, so there is no collision risk between the three
branches.

## QR Parsing → New Pallet

A recognized `PC\d+|...` scan **always creates a new pallet** and makes it active (this app never
merges QR data into an existing pallet — "QR first" establishes pallet identity).

**Validation** (reject + `flash()` an error, ingest nothing, on any failure — protects counts):
- Version must match `/^PC\d+$/`.
- Split on `|` must yield exactly 7 fields.
- The 7th field, split on `,`, must be non-empty, and every entry must parse to a finite integer
  `> 0` via the same digit-cleaning rules used elsewhere (no silent NaN/0 boxes).

**On success:**
- `boxes = qtys.map((pieces,i) => ({seq:i+1, pieces}))`
- `meta = {ver, palletId, pn, po, delivery, coo}` (fields 0–5, `ver` from field 0)
- `name = pn || 'Pallet N'` (if `pn` is blank, falls back to the existing default-naming logic
  already used for manual pallets — next unused `Pallet N` number)
- `rack = ''` (not part of the QR; set separately, see below)

**Duplicate-scan guard:** this check only runs at QR-ingest time (never when a manual pallet is
created). Before creating a new pallet, compute a signature
`ver+'|'+palletId+'|'+pn+'|'+po+'|'+delivery` from the incoming QR and compare it against each
existing pallet's `meta`. If a match is found, do not create a duplicate — instead set that
existing pallet as `activeId`, `flash('Pallet already loaded')`, and return. Manual pallets all
share the same blank signature (`PC1|||||`), but since this comparison is never triggered by
manual-pallet creation, that's harmless — two manual pallets are never compared against each
other.

## Rack Location (unchanged mechanism, now decoupled from pallet creation)

Scanning a rack code (`^[A-Z]{2}[0-9]{8}$`) sets `rack` on the **active** pallet, exactly as
today. After a QR scan, the operator may optionally scan the rack label to tag where that pallet
physically sits — this is independent of and after pallet creation. Loose box barcodes can still
be scanned afterward to append to or correct the active pallet (QR or manual) — the box list is
always live state; the QR is just how it got bulk-populated.

## QR Encoding (for printing)

**Encoder:** a small, vetted, public-domain vanilla QR generator (e.g. the Kazuhiko Arase
`qrcode-generator` algorithm) is inlined into `index.html`'s `<script>` block — no CDN, no
build step, no new file. It exposes a function that takes a string and returns a module matrix
(2D boolean grid); the print code renders that matrix as **inline SVG rects** (black squares on
white), built directly into the print iframe's HTML string — not via the existing `<use
href="#i-...">` sprite, since the print iframe is a separate document and cannot reference the
main document's sprite (existing project rule).

**Re-encode string** (used whenever a pallet's label is (re)printed, including the very first
print of a manually-built pallet):

```
PC1|{meta.palletId}|{meta.pn}|{meta.po}|{meta.delivery}|{meta.coo}|{current boxes' pieces, in seq order, comma-joined}
```

- For a manual pallet, `meta.palletId/pn/po/delivery/coo` are all `''`, so the string looks like
  `PC1||||||{qtys}` — still valid per the format (empty fields are valid empty strings), and
  re-scanning it later reconstructs the boxes (with blank identity, as expected for a manual
  pallet).
- Quantities always reflect the pallet's **current** `boxes` array (post-pick, if applicable) —
  never the original QR's `qtys`.

## Label Print Layout (QLn420 113×63mm / A4 fallback)

Extends the existing `printPallet(id)` function (today: plain text, no QR) to mirror the
receiving label's layout:

- Header: `PACKCALC · {meta.pn || '—'}` and, only if `meta.palletId` is non-blank, a second line
  `PLT {meta.palletId}`.
- QR code, top-right, rendered from the re-encode string above.
- `PIECES PER BOX`: `B01..Bn` chips with current per-box piece counts (reuses existing
  `Bnum()`/chip-style formatting already used on-screen, adapted to the plain-text/SVG print
  renderer).
- `TOTAL BOXES` / `TOTAL PIECES` summary row.
- Footer: `{esc(meta.pn) || site} · {date, time} · QLn420`.
- A4 printer mode uses the same content, larger page (existing `printCss()` branch already
  handles page size by `cfg.printer`).
- The existing per-pallet **Print** button in the Board view (`data-printpallet`) now calls this
  upgraded `printPallet(id)` for **any** pallet, QR-ingested or manual.

## Confirm Pick → Remove → Relabel

A new **"Confirm pick"** button is added to the Pick tab, next to the existing **"Print picking
mix"** button. The two are independent: "Print picking mix" stays a non-destructive informational
slip (what to pull); "Confirm pick" is the destructive, after-the-physical-pull action that
updates stored state and reprints affected pallets' labels.

**On tap, in order:**

1. Group `sol.picks` (the current solution's picked boxes) by `palletId` — same grouping the pull
   list already uses.
2. For each affected pallet: remove the picked boxes from `p.boxes` by `seq` (`filter`).
3. For each affected pallet whose `boxes.length` is now `0`: remove it entirely from the
   `pallets` array. If it was `activeId`, clear `activeId` (set to the next remaining pallet, or
   `null` if none remain).
4. For each affected pallet that still has `boxes.length > 0`: re-encode its QR from current
   boxes (see "QR Encoding" above) and print its updated label via `printPallet(id)`.
5. If more than one pallet needs printing, **auto-print all of them in sequence** — chain the
   print calls with a 1200ms delay between each (extending the existing `setTimeout(...,120)`
   pattern in `doPrint`) so each print job's `window.print()` call completes before the next one
   overwrites the shared iframe's content.
6. `saveOpt()`, then `render()`. The Pick tab recomputes against whatever boxes remain (if
   `opt.target` is still set, the next-best mix is shown immediately).

No extra confirmation dialog before the destructive removal — the button is explicitly labeled
"Confirm pick", which already signals deliberate intent, consistent with how every other
single-tap action in this app works (e.g. "Print picking mix" itself).

## Out of Scope

- The receiving app and its Zebra ZT620 printing — never modified, never assumed to change.
- Reconcile mode — no pallet/box-array model exists there; QR ingest stays Optimize-only.
- Any server/network sync of pallet or QR state — everything is local, exactly as today.
- A confirmation/undo step for "Confirm pick" — explicitly decided against; revisit only if real
  usage shows mis-taps are a problem.
