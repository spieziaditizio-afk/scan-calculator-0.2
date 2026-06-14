# Quick Guide & Workflow Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible `?` quick-guide panel to the Reconcile and Optimize module headers, showing numbered workflow steps for experienced operators.

**Architecture:** All changes are in `index.html` (single-file app). A `?` button is added to each module header; tapping it toggles a `<div class="guide-panel">` that slides open between the header and the counters bar using a `max-height` CSS transition. Two JS booleans track open state. A `document` click-outside listener closes any open panel. No localStorage, no changes to existing scan/engine/print/overlay logic.

**Tech Stack:** Vanilla JS, inline CSS/HTML, single `index.html`. Tested with `node --check` + browser verification.

---

## File Structure

| File | Change |
|------|--------|
| `index.html` | All changes — CSS additions, HTML guide panels + `?` buttons, JS state + events |

---

### Task 1: CSS — add guide panel and active button styles

**Files:**
- Modify: `index.html` — CSS section, after `.iconbtn:active` rule (around line 60)

- [ ] **Step 1: Find the existing `.iconbtn:active` rule**

Read `index.html` around line 58–62 to confirm the exact text of the `.iconbtn:active` rule. It looks like:
```
  .iconbtn:active{background:var(--panel3);transform:scale(.94);}
```

- [ ] **Step 2: Add guide panel CSS immediately after `.iconbtn:active`**

Find this exact string:
```
  .iconbtn:active{background:var(--panel3);transform:scale(.94);}
```

Replace with:
```
  .iconbtn:active{background:var(--panel3);transform:scale(.94);}
  .iconbtn.active{color:var(--accent);border-color:var(--accent);}
  .guide-panel{overflow:hidden;max-height:0;transition:max-height .22s cubic-bezier(.4,0,.2,1);background:var(--panel2);border-bottom:1px solid var(--border);}
  .guide-panel.open{max-height:280px;}
  .guide-steps{margin:0;padding:10px 16px 12px 34px;display:flex;flex-direction:column;gap:5px;list-style:decimal;}
  .guide-steps li{font-size:12px;color:var(--muted);line-height:1.4;}
  .guide-steps li::marker{color:var(--accent);font-weight:700;}
  .guide-steps b{color:var(--text);}
```

- [ ] **Step 3: Verify with node --check**

```powershell
$lines = Get-Content "c:\Users\aspiezia\Downloads\scan calculator 0.2\index.html"
$start = ($lines | Select-String -Pattern "^<script>" | Select-Object -First 1).LineNumber
$end   = ($lines | Select-String -Pattern "^</script>" | Select-Object -First 1).LineNumber
$lines[($start)..($end-2)] | Set-Content "tmp-check.js" -Encoding utf8
node --check tmp-check.js
Remove-Item tmp-check.js
```

Expected: no output (exit code 0).

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "feat: add guide panel and active button CSS"
```

---

### Task 2: HTML — add `?` buttons and guide panels to both module headers

**Files:**
- Modify: `index.html` — Reconcile screen (~line 344) and Optimize screen (~line 374)

This task makes two changes: one for the Reconcile screen and one for the Optimize screen.

#### Reconcile screen

- [ ] **Step 1: Add `?` button to the Reconcile header**

Find this exact string:
```
      <button class="iconbtn" data-settings aria-label="Settings"><svg class="ico"><use href="#i-settings"/></svg></button>
    </header>
    <div class="counters">
      <div class="counter target"><div class="ch"><svg class="ico"><use href="#i-target"/></svg><span class="lbl">Pick</span></div><div class="val" id="rc-pick">—</div></div>
```

Replace with:
```
      <button class="iconbtn" data-settings aria-label="Settings"><svg class="ico"><use href="#i-settings"/></svg></button>
      <button class="iconbtn" id="rc-guide-btn" aria-label="Quick guide">?</button>
    </header>
    <div class="guide-panel" id="rc-guide"><ol class="guide-steps">
      <li>Enter the pick quantity in <b>"Pick pieces"</b></li>
      <li>Scan the rack label to set the location</li>
      <li>Scan each box — piece count added automatically</li>
      <li>Check result: <b>EXACT</b> → pull the highlighted boxes · <b>NOT POSSIBLE</b> → see closest option below</li>
      <li>Print or start a new reconciliation</li>
    </ol></div>
    <div class="counters">
      <div class="counter target"><div class="ch"><svg class="ico"><use href="#i-target"/></svg><span class="lbl">Pick</span></div><div class="val" id="rc-pick">—</div></div>
```

#### Optimize screen

- [ ] **Step 2: Add `?` button to the Optimize header**

Find this exact string:
```
      <button class="iconbtn" data-settings aria-label="Settings"><svg class="ico"><use href="#i-settings"/></svg></button>
    </header>
    <div class="counters">
      <div class="counter target"><div class="ch"><svg class="ico"><use href="#i-target"/></svg><span class="lbl">Target</span></div><div class="val" id="op-target">—</div></div>
```

Replace with:
```
      <button class="iconbtn" data-settings aria-label="Settings"><svg class="ico"><use href="#i-settings"/></svg></button>
      <button class="iconbtn" id="op-guide-btn" aria-label="Quick guide">?</button>
    </header>
    <div class="guide-panel" id="op-guide"><ol class="guide-steps">
      <li>Enter target pieces in <b>"Target pieces"</b></li>
      <li>Scan a rack label → starts Pallet 1 at that location</li>
      <li>Scan boxes on the pallet</li>
      <li>To add another location, scan the next rack label (auto-creates Pallet 2, etc.)</li>
      <li>Go to <b>Pick</b> tab → see the optimal box mix ≤ target</li>
      <li>Print picking mix or add more pallets</li>
    </ol></div>
    <div class="counters">
      <div class="counter target"><div class="ch"><svg class="ico"><use href="#i-target"/></svg><span class="lbl">Target</span></div><div class="val" id="op-target">—</div></div>
```

- [ ] **Step 3: Verify with node --check**

```powershell
$lines = Get-Content "c:\Users\aspiezia\Downloads\scan calculator 0.2\index.html"
$start = ($lines | Select-String -Pattern "^<script>" | Select-Object -First 1).LineNumber
$end   = ($lines | Select-String -Pattern "^</script>" | Select-Object -First 1).LineNumber
$lines[($start)..($end-2)] | Set-Content "tmp-check.js" -Encoding utf8
node --check tmp-check.js
Remove-Item tmp-check.js
```

Expected: no output (exit code 0).

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "feat: add guide panel HTML and ? buttons to module headers"
```

---

### Task 3: JS — add toggle logic, click-outside listener, and event wiring

**Files:**
- Modify: `index.html` — JS section

This task has two sub-steps: (A) add the `toggleGuide` function and state vars after the `/* init */` section, and (B) wire the button click events.

- [ ] **Step 1: Add guide panel JS — state, toggle, click-outside, and button wiring — in one replacement**

Find this exact string:
```
/* init */
render();
if(cfg.mode==='reconcile') focusEl('in-rscan');
if(cfg.mode==='optimize') focusEl('in-oscan');
```

Replace with:
```
/* Guide panels */
let reconGuideOpen=false, optGuideOpen=false;
function toggleGuide(screen){
  if(screen==='recon'){
    reconGuideOpen=!reconGuideOpen;
    $('rc-guide').classList.toggle('open',reconGuideOpen);
    $('rc-guide-btn').classList.toggle('active',reconGuideOpen);
  } else {
    optGuideOpen=!optGuideOpen;
    $('op-guide').classList.toggle('open',optGuideOpen);
    $('op-guide-btn').classList.toggle('active',optGuideOpen);
  }
}
document.addEventListener('click',e=>{
  if(reconGuideOpen && !e.target.closest('#rc-guide') && !e.target.closest('#rc-guide-btn')){
    reconGuideOpen=false; $('rc-guide').classList.remove('open'); $('rc-guide-btn').classList.remove('active');
  }
  if(optGuideOpen && !e.target.closest('#op-guide') && !e.target.closest('#op-guide-btn')){
    optGuideOpen=false; $('op-guide').classList.remove('open'); $('op-guide-btn').classList.remove('active');
  }
});

/* init */
$('rc-guide-btn').onclick=()=>toggleGuide('recon');
$('op-guide-btn').onclick=()=>toggleGuide('opt');
render();
if(cfg.mode==='reconcile') focusEl('in-rscan');
if(cfg.mode==='optimize') focusEl('in-oscan');
```

- [ ] **Step 2: Verify with node --check**

```powershell
$lines = Get-Content "c:\Users\aspiezia\Downloads\scan calculator 0.2\index.html"
$start = ($lines | Select-String -Pattern "^<script>" | Select-Object -First 1).LineNumber
$end   = ($lines | Select-String -Pattern "^</script>" | Select-Object -First 1).LineNumber
$lines[($start)..($end-2)] | Set-Content "tmp-check.js" -Encoding utf8
node --check tmp-check.js
Remove-Item tmp-check.js
```

Expected: no output (exit code 0).

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "feat: add guide panel toggle logic, click-outside, and button wiring"
```

---

### Task 4: Browser verification and final commit

**Files:** none — verification only

- [ ] **Step 1: Open the app**

```powershell
Start-Process "c:\Users\aspiezia\Downloads\scan calculator 0.2\index.html"
```

- [ ] **Step 2: Verify Reconcile module**

1. Navigate to Reconcile mode.
2. Confirm `?` button is visible in the header to the right of the Settings gear icon.
3. Tap `?` → guide panel slides open below the header showing 5 numbered steps in accent-colored numbers.
4. Button `?` has accent color border/text while panel is open.
5. Tap `?` again → panel slides closed, button returns to normal.
6. Tap `?` to open, then tap anywhere on the scan field → panel closes.
7. Confirm the counters bar and scan fields are still fully functional.
8. Confirm the guide panel does NOT appear in print output (print a slip and verify).

- [ ] **Step 3: Verify Optimize module**

1. Navigate to Optimize mode.
2. Confirm `?` button in header.
3. Tap `?` → 6-step guide appears.
4. Tap `?` again → closes.
5. Switch to Pick tab, back to Scan tab → panel state resets (closed).
6. Confirm all scan / pallet / pick functionality unaffected.

- [ ] **Step 4: Final commit (if any fixes were needed during verification)**

```
git add index.html
git commit -m "fix: guide panel verification adjustments"
```

Only run this step if you found and fixed issues in Steps 2–3. If everything worked perfectly, skip this commit.
