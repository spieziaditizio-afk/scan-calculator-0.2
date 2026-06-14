# Quick Guide & Workflow Panel — Design Spec
_Date: 2026-06-14_

## Goal

Add a collapsible step-by-step workflow reminder to each module (Reconcile and Optimize) so experienced warehouse operators can quickly recall the correct sequence without leaving the screen.

## Context

The app runs on a Zebra TC520L 5" handheld in a warehouse. Operators count box piece-counts with the scanner against packing lists, and calculate optimal box combinations for partial picks. Workers know the process but need an in-app quick reference.

## Interaction

- A `?` icon button is added to the header of each module screen (Reconcile and Optimize).
- Tapping `?` → guide panel slides open below the header (pushes body down).
- The `?` button highlights (accent color) while the panel is open.
- Tapping `?` again → closes panel.
- Tapping anywhere outside the panel → closes panel.
- State is NOT persisted — always closed on module entry.

## Guide Panel Content

### Reconcile (Pick & Reconcile)

```
1. Enter the pick quantity in "Pick pieces"
2. Scan the rack label to set the location
3. Scan each box — piece count added automatically
4. Check result: EXACT → pull the highlighted boxes · NOT POSSIBLE → see closest option below
5. Print or start a new reconciliation
```

### Optimize

```
1. Enter target pieces in "Target pieces"
2. Scan a rack label → starts Pallet 1 at that location
3. Scan boxes on the pallet
4. To add another location, scan the next rack label (auto-creates Pallet 2, etc.)
5. Go to Pick tab → see the optimal box mix ≤ target
6. Print picking mix or add more pallets
```

## HTML Structure

Inserted between `<header>` and `<div class="body">` in each module screen:

```html
<!-- Reconcile -->
<div class="guide-panel" id="rc-guide">
  <ol class="guide-steps">
    <li>Enter the pick quantity in "Pick pieces"</li>
    <li>Scan the rack label to set the location</li>
    <li>Scan each box — piece count added automatically</li>
    <li>Check result: <b>EXACT</b> → pull the highlighted boxes · <b>NOT POSSIBLE</b> → see closest option below</li>
    <li>Print or start a new reconciliation</li>
  </ol>
</div>

<!-- Optimize -->
<div class="guide-panel" id="op-guide">
  <ol class="guide-steps">
    <li>Enter target pieces in "Target pieces"</li>
    <li>Scan a rack label → starts Pallet 1 at that location</li>
    <li>Scan boxes on the pallet</li>
    <li>To add another location, scan the next rack label (auto-creates Pallet 2, etc.)</li>
    <li>Go to <b>Pick</b> tab → see the optimal box mix ≤ target</li>
    <li>Print picking mix or add more pallets</li>
  </ol>
</div>
```

A `?` button (`.iconbtn`) is added to each header beside the existing action buttons.

## CSS

```css
.guide-panel {
  overflow: hidden;
  max-height: 0;
  transition: max-height .22s cubic-bezier(.4,0,.2,1);
  background: var(--panel2);
  border-bottom: 1px solid var(--border);
}
.guide-panel.open {
  max-height: 260px;
}
.guide-steps {
  margin: 0;
  padding: 12px 16px 12px 32px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.guide-steps li {
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.4;
}
.guide-steps li::marker {
  color: var(--accent);
  font-weight: 700;
}
.iconbtn.active { color: var(--accent); border-color: var(--accent); }
```

## JS

```javascript
// State — not persisted
let reconGuideOpen = false;
let optGuideOpen   = false;

function toggleGuide(screen) {
  if (screen === 'recon') {
    reconGuideOpen = !reconGuideOpen;
    $('rc-guide').classList.toggle('open', reconGuideOpen);
    $('rc-guide-btn').classList.toggle('active', reconGuideOpen);
  } else {
    optGuideOpen = !optGuideOpen;
    $('op-guide').classList.toggle('open', optGuideOpen);
    $('op-guide-btn').classList.toggle('active', optGuideOpen);
  }
}

// Click-outside to close
document.addEventListener('click', e => {
  if (reconGuideOpen && !e.target.closest('#rc-guide') && !e.target.closest('#rc-guide-btn')) {
    reconGuideOpen = false;
    $('rc-guide').classList.remove('open');
    $('rc-guide-btn').classList.remove('active');
  }
  if (optGuideOpen && !e.target.closest('#op-guide') && !e.target.closest('#op-guide-btn')) {
    optGuideOpen = false;
    $('op-guide').classList.remove('open');
    $('op-guide-btn').classList.remove('active');
  }
});
```

Event wiring: `$('rc-guide-btn').onclick = () => toggleGuide('recon')` and `$('op-guide-btn').onclick = () => toggleGuide('opt')`.

## Scope

- No changes to: scan wiring, chip rendering, subset-sum engine, print logic, edit/delete overlays, settings overlay.
- No new localStorage keys.
- `?` button uses a plain text `?` character inside the `.iconbtn` — the SVG sprite has no help icon. Button HTML: `<button class="iconbtn" id="rc-guide-btn" aria-label="Quick guide">?</button>`.
- The panel is NOT part of the print output.
