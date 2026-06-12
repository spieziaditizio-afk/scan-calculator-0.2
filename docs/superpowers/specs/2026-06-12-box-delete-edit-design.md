# Box Delete & Edit — Design Spec
_Date: 2026-06-12_

## Goal

Let warehouse operators delete or correct a scanned box without restarting the session. Applies to both Reconcile and Optimize modes.

## Interaction

- Each editable chip gains a visible `×` button (top-right). One tap → immediate delete.
- Tapping the piece-count area of the chip opens a numeric edit overlay.
- Chips in read-only contexts (pull list, pick list) are unchanged — no × or edit.

## Chip structure (editable)

```html
<div class="chip [pull] [newest]"
     data-mode="recon|opt"
     data-seq="3"
     data-palid="p1abc">          <!-- opt only -->
  <div class="bi">B003</div>
  <div class="chip-pc">250</div>
  <button class="chip-del" aria-label="Delete">×</button>
</div>
```

CSS adjustments:
- `.chip` → `position: relative` (for absolute × placement)
- `.chip-del` → small button (~28px), top-right corner, red on hover
- `.chip-pc` → inherits `.pc` styles, adds `cursor: pointer`, subtle hover tint

Read-only chips (pull list, pick list) continue using `.pc` (no `.chip-pc` class, no data attrs, no ×).

## Edit overlay

New element `id="edit-overlay"` (independent from the settings overlay).

```
┌──────────────────────────┐
│  Edit Box B001            │
│  [ 250          ]         │  ← inputmode="numeric", value pre-selected
│  [  Cancel  ]  [ Save ]   │
└──────────────────────────┘
```

Behaviour:
- Opens above a semitransparent backdrop.
- Input pre-filled with current pieces, auto-selected on open.
- Enter → save. Escape → cancel. Tap backdrop → cancel.
- Validation: positive integer > 0. Else: flash "Invalid value", keep overlay open.
- On save: update `pieces` in the correct array, save localStorage, re-render, close overlay, refocus scan field.

## Data flow

**Delete:**
- Reconcile: `recon.boxes = recon.boxes.filter(b => b.seq !== seq)`
- Optimize: find pallet by `palid`, then `p.boxes = p.boxes.filter(b => b.seq !== seq)`
- `seq` values are NOT renumbered after delete (they are display labels / engine IDs).

**Edit:**
- Same lookup as delete, then `b.pieces = newValue`.
- `raw` field on the box is left unchanged (it's just the original barcode string for reference).

## Event delegation

One listener per chips container, not per chip:

| Container  | Target        | Action           |
|------------|---------------|------------------|
| `rc-chips` | `.chip-del`   | delete recon box |
| `rc-chips` | `.chip-pc`    | open edit overlay for recon box |
| `op-chips` | `.chip-del`   | delete opt box   |
| `op-chips` | `.chip-pc`    | open edit overlay for opt box |

## Scope

- `chip()` function: add `editable` parameter (5th, default `false`). When `true`, renders `.chip-pc` and `.chip-del` with data attrs.
- New `openEditBox(mode, seq, palid, currentPieces)` function.
- New `closeEditBox()` function.
- Edit overlay HTML added to `index.html` body (hidden by default).
- CSS additions: `.chip-del`, `.chip-pc`, `#edit-overlay` styles.
- No changes to subset-sum engine, `reconBoxes()`, `flatOpt()`, or print logic.

## Edge cases

- Delete only box → empty state renders normally.
- Edit to same value → no-op, harmless.
- Optimize: delete box from non-active pallet is possible (identified by `palid`).
- Pull/pick chips (read-only) never receive delete/edit — they have no `.chip-pc` or `.chip-del`.
