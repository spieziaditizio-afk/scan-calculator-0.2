# Box Delete & Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a × delete button and tap-to-edit overlay to each scanned box chip in both Reconcile and Optimize modes.

**Architecture:** All changes are inside `index.html` (single-file app). The `chip()` function gains an `editable` parameter that renders `.chip-del` and `.chip-pc` elements with data attributes. Event delegation on the chips containers handles delete and edit. A new `#edit-overlay` element (independent of `#overlay`) manages the numeric edit flow. No changes to the subset-sum engine or print logic.

**Tech Stack:** Vanilla JS, inline CSS, single `index.html`. No build step. Tested with Node.js scripts (copy functions to temp file) and `node --check`.

---

## File Structure

| File | Change |
|------|--------|
| `index.html` | All changes — CSS additions, HTML overlay markup, chip() update, edit functions, event delegation |
| `test-chip.js` | Temp test script (delete after use) |

---

### Task 1: Write the failing Node test script

**Files:**
- Create: `test-chip.js` (temp — delete at end)

- [ ] **Step 1: Create test-chip.js with helpers and CURRENT chip() (before changes)**

```javascript
// test-chip.js
"use strict";
const fmt  = n => Number(n||0).toLocaleString('en-US');
const Bnum = seq => 'B'+String(seq).padStart(2,'0');

// CURRENT chip() — copy verbatim from index.html line 627
function chip(seq,pc,pull,newest){
  return '<div class="chip'+(pull?' pull':'')+(newest?' newest':'')+'"><div class="bi">'+Bnum(seq)+'</div><div class="pc">'+fmt(pc)+'</div></div>';
}

let pass=0,fail=0;
function ok(lbl,cond){ if(cond){console.log('PASS: '+lbl);pass++;}else{console.error('FAIL: '+lbl);fail++;} }

// read-only chip must NOT have chip-del or data-seq
const ro = chip(1, 250, false, false);
ok('ro: no chip-del',    !ro.includes('chip-del'));
ok('ro: has .pc',         ro.includes('"pc"'));
ok('ro: no data-seq',    !ro.includes('data-seq'));

// editable chip MUST have chip-del, chip-pc, .editable, data-seq
const ed = chip(3, 500, false, false, true, null);
ok('ed: chip-del',        ed.includes('chip-del'));        // FAIL before Task 4
ok('ed: chip-pc',         ed.includes('chip-pc'));         // FAIL before Task 4
ok('ed: .editable class', ed.includes(' editable'));       // FAIL before Task 4
ok('ed: data-seq=3',      ed.includes('data-seq="3"'));    // FAIL before Task 4
ok('ed: no data-palid',  !ed.includes('data-palid'));

// editable chip with palid (Optimize)
const op = chip(2, 100, false, true, true, 'p1abc');
ok('op: data-palid',      op.includes('data-palid="p1abc"'));  // FAIL before Task 4
ok('op: newest',          op.includes(' newest'));

// pull chip (read-only from pullList — never editable)
const pl = chip(5, 200, true, false);
ok('pl: .pull class',     pl.includes(' pull'));
ok('pl: no chip-del',    !pl.includes('chip-del'));

// Delete logic — recon
let boxes = [{seq:1,pieces:100},{seq:2,pieces:200},{seq:3,pieces:300}];
boxes = boxes.filter(b => b.seq !== 2);
ok('del-recon: length 2',        boxes.length === 2);
ok('del-recon: seq 2 gone',      !boxes.find(b=>b.seq===2));
ok('del-recon: seq 1 kept',      !!boxes.find(b=>b.seq===1));
ok('del-recon: seq 3 kept',      !!boxes.find(b=>b.seq===3));

// Delete logic — opt (by palid + seq)
const pallets = [
  {id:'p1', boxes:[{seq:1,pieces:100},{seq:2,pieces:200}]},
  {id:'p2', boxes:[{seq:1,pieces:300}]}
];
const p = pallets.find(x => x.id==='p1');
p.boxes = p.boxes.filter(b => b.seq !== 1);
ok('del-opt: p1 length 1',       pallets[0].boxes.length === 1);
ok('del-opt: p1 seq1 gone',      !pallets[0].boxes.find(b=>b.seq===1));
ok('del-opt: p2 untouched',      pallets[1].boxes.length === 1);

console.log('\n'+pass+' passed, '+fail+' failed');
if(fail > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to confirm it fails on the editable assertions**

```
node test-chip.js
```

Expected output: several `FAIL: ed:` and `FAIL: op:` lines, process exits with code 1. The `ro`, `pl`, and `del-*` assertions should already pass.

---

### Task 2: CSS — add styles for editable chips and edit overlay

**Files:**
- Modify: `index.html` — CSS section (around lines 182–187)

- [ ] **Step 1: Add `position:relative` to the existing `.chip` rule (line 182)**

Find this exact string and replace it:

```
.chip{background:var(--panel);border:1px solid var(--border);border-radius:11px;padding:7px 9px;min-width:62px;text-align:center;transition:var(--t);}
```

Replace with:

```
.chip{background:var(--panel);border:1px solid var(--border);border-radius:11px;padding:7px 9px;min-width:62px;text-align:center;transition:var(--t);position:relative;}
```

- [ ] **Step 2: Add new CSS rules after the `.chip.newest` rule (after line 187)**

Find this exact string:
```
  .chip.newest{border-color:var(--accent);box-shadow:0 0 0 1px rgba(var(--accent-rgb),.4),0 0 16px -6px rgba(var(--accent-rgb),.7);}
```

Replace with:
```
  .chip.newest{border-color:var(--accent);box-shadow:0 0 0 1px rgba(var(--accent-rgb),.4),0 0 16px -6px rgba(var(--accent-rgb),.7);}
  .chip.editable{padding-right:22px;}
  .chip-pc{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;cursor:pointer;border-radius:5px;padding:1px 3px;margin:-1px -3px;transition:background var(--t);}
  .chip-pc:active{background:rgba(var(--accent-rgb),.18);}
  .chip-del{position:absolute;top:4px;right:4px;width:20px;height:20px;border:none;background:none;color:var(--faint);cursor:pointer;border-radius:5px;font-size:13px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;transition:var(--t);}
  .chip-del:active{color:var(--danger);background:rgba(var(--danger-rgb),.18);}
  #edit-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:200;align-items:center;justify-content:center;}
  #edit-overlay.open{display:flex;}
  #edit-card{background:var(--panel);border:1px solid var(--border2);border-radius:18px;padding:20px;width:min(320px,90vw);display:flex;flex-direction:column;gap:14px;}
  #edit-title{font-weight:700;font-size:15px;color:var(--text);}
  #edit-input{font-family:inherit;font-size:28px;font-weight:800;background:#0c1219;border:1px solid var(--border2);border-radius:11px;color:var(--text);padding:10px 14px;width:100%;text-align:center;font-variant-numeric:tabular-nums;}
  #edit-input:focus{border-color:var(--accent);outline:none;box-shadow:0 0 0 3px rgba(var(--accent-rgb),.22);}
  #edit-btns{display:flex;gap:10px;}
  #edit-btns button{flex:1;height:44px;border-radius:11px;border:1px solid var(--border);font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:var(--t);}
  #edit-cancel{background:var(--panel2);color:var(--muted);}
  #edit-save{background:var(--accent);color:#07090d;border-color:var(--accent);}
```

---

### Task 3: HTML — add the edit overlay element

**Files:**
- Modify: `index.html` — body, after the flash div (line 410)

- [ ] **Step 1: Add `#edit-overlay` after the flash div**

Find this exact string:
```
<div class="flash" id="flash"></div>
```

Replace with:
```
<div class="flash" id="flash"></div>
<div id="edit-overlay">
  <div id="edit-card">
    <div id="edit-title">Edit Box</div>
    <input id="edit-input" inputmode="numeric" autocomplete="off">
    <div id="edit-btns">
      <button id="edit-cancel">Cancel</button>
      <button id="edit-save">Save</button>
    </div>
  </div>
</div>
```

---

### Task 4: JS — update `chip()` to support editable parameter

**Files:**
- Modify: `index.html` — `chip()` function at line 627

- [ ] **Step 1: Replace the current `chip()` function**

Find this exact string:
```
function chip(seq,pc,pull,newest){
  return '<div class="chip'+(pull?' pull':'')+(newest?' newest':'')+'"><div class="bi">'+Bnum(seq)+'</div><div class="pc">'+fmt(pc)+'</div></div>';
}
```

Replace with:
```
function chip(seq,pc,pull,newest,editable,palid){
  let cls='chip'+(pull?' pull':'')+(newest?' newest':'')+(editable?' editable':'');
  let attrs=editable?' data-seq="'+seq+'"'+(palid?' data-palid="'+palid+'"':''):'';
  const pcEl=editable?'<div class="chip-pc">'+fmt(pc)+'</div>':'<div class="pc">'+fmt(pc)+'</div>';
  const delEl=editable?'<button class="chip-del" aria-label="Delete">×</button>':'';
  return '<div class="'+cls+'"'+attrs+'><div class="bi">'+Bnum(seq)+'</div>'+pcEl+delEl+'</div>';
}
```

- [ ] **Step 2: Update test-chip.js to use the new chip() and re-run**

In `test-chip.js`, replace the `chip()` function block with the new implementation above (same code), then run:

```
node test-chip.js
```

Expected output: all assertions PASS, process exits 0.

---

### Task 5: JS — add edit overlay logic

**Files:**
- Modify: `index.html` — JS section, after the `chip()` function (after line 629)

- [ ] **Step 1: Add edit overlay state and functions after `chip()`**

Find this exact string:
```
/* ---- Optimize ---- */
function renderOpt(){
```

Replace with:
```
/* ---- Edit overlay ---- */
let _editCtx=null;
function openEditBox(mode,seq,palid,pieces){
  _editCtx={mode,seq,palid};
  $('edit-title').textContent='Edit Box '+Bnum(seq);
  const inp=$('edit-input'); inp.value=pieces;
  $('edit-overlay').classList.add('open');
  setTimeout(()=>{ inp.focus(); inp.select(); },60);
}
function closeEditBox(){
  $('edit-overlay').classList.remove('open');
  _editCtx=null;
  if(cfg.mode==='reconcile') focusEl('in-rscan');
  if(cfg.mode==='optimize')  focusEl('in-oscan');
}
function saveEditBox(){
  if(!_editCtx) return;
  const v=cleanToPieces($('edit-input').value);
  if(v==null){ flash('Invalid value'); return; }
  const {mode,seq,palid}=_editCtx;
  if(mode==='recon'){
    const b=recon.boxes.find(x=>x.seq===seq); if(b) b.pieces=v;
    saveRecon();
  } else {
    const p=pallets.find(x=>x.id===palid);
    if(p){ const b=p.boxes.find(x=>x.seq===seq); if(b) b.pieces=v; }
    saveOpt();
  }
  closeEditBox(); render();
}

/* ---- Optimize ---- */
function renderOpt(){
```

---

### Task 6: JS — add event delegation for delete and edit

**Files:**
- Modify: `index.html` — Events section, after `$('ov-board').addEventListener` (around line 886)

- [ ] **Step 1: Add chip event delegation and overlay control handlers**

Find this exact string:
```
$('clear-order').onclick=()=>{
```

Replace with:
```
/* Chip delete / edit — Reconcile */
$('rc-chips').addEventListener('click',e=>{
  const del=e.target.closest('.chip-del');
  if(del){ const c=del.closest('.chip'); recon.boxes=recon.boxes.filter(b=>b.seq!==+c.dataset.seq); saveRecon(); render(); return; }
  const pc=e.target.closest('.chip-pc');
  if(pc){ const c=pc.closest('.chip'); const b=recon.boxes.find(x=>x.seq===+c.dataset.seq); if(b) openEditBox('recon',b.seq,null,b.pieces); }
});

/* Chip delete / edit — Optimize */
$('op-chips').addEventListener('click',e=>{
  const del=e.target.closest('.chip-del');
  if(del){
    const c=del.closest('.chip'); const p=pallets.find(x=>x.id===c.dataset.palid);
    if(p){ p.boxes=p.boxes.filter(b=>b.seq!==+c.dataset.seq); } saveOpt(); render(); return;
  }
  const pc=e.target.closest('.chip-pc');
  if(pc){
    const c=pc.closest('.chip'); const p=pallets.find(x=>x.id===c.dataset.palid);
    if(p){ const b=p.boxes.find(x=>x.seq===+c.dataset.seq); if(b) openEditBox('opt',b.seq,c.dataset.palid,b.pieces); }
  }
});

/* Edit overlay controls */
$('edit-save').onclick=saveEditBox;
$('edit-cancel').onclick=closeEditBox;
$('edit-overlay').addEventListener('click',e=>{ if(e.target.id==='edit-overlay') closeEditBox(); });
$('edit-input').addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();saveEditBox();} if(e.key==='Escape') closeEditBox(); });

$('clear-order').onclick=()=>{
```

---

### Task 7: JS — update `chip()` callers to pass `editable=true`

**Files:**
- Modify: `index.html` — `renderRecon()` line ~599 and `renderOpt()` line ~659

- [ ] **Step 1: Update `renderRecon()` — the scanned chips get `editable=true`**

Find this exact string:
```
    ? boxes.map((b,i)=>chip(b.seq,b.pieces,pullIds.has('r'+b.seq),i===boxes.length-1)).join('')
```

Replace with:
```
    ? boxes.map((b,i)=>chip(b.seq,b.pieces,pullIds.has('r'+b.seq),i===boxes.length-1,true,null)).join('')
```

- [ ] **Step 2: Update `renderOpt()` — the scanned chips on the active pallet get `editable=true` with `palid`**

Find this exact string:
```
    ? ap.boxes.map((b,i)=>chip(b.seq,b.pieces,false,i===ap.boxes.length-1)).join('')
```

Replace with:
```
    ? ap.boxes.map((b,i)=>chip(b.seq,b.pieces,false,i===ap.boxes.length-1,true,ap.id)).join('')
```

Note: `pullList()` (called from `renderRecon`) and `renderPick()` (called from `renderOpt`) both call `chip()` without the `editable` param — they remain read-only, no changes needed.

---

### Task 8: Verify and commit

**Files:**
- Modify: `test-chip.js` (final run, then delete)

- [ ] **Step 1: Run the test script one final time to confirm all assertions pass**

```
node test-chip.js
```

Expected: `20 passed, 0 failed` (all assertions green).

- [ ] **Step 2: Syntax-check the full inline script**

Extract the `<script>` block from `index.html` to a temp file and check it:

```powershell
$lines = Get-Content "index.html"
$start = ($lines | Select-String -Pattern "^<script>" | Select-Object -First 1).LineNumber
$end   = ($lines | Select-String -Pattern "^</script>" | Select-Object -First 1).LineNumber
$lines[($start)..($end-2)] | Set-Content "tmp-check.js" -Encoding utf8
node --check tmp-check.js
Remove-Item tmp-check.js
```

Expected: no output (no syntax errors).

- [ ] **Step 3: Open the app in a browser and test manually**

```powershell
Start-Process "index.html"
```

Reconcile mode checklist:
- Scan a rack code → location sets correctly.
- Scan 3+ boxes → chips appear with `×` button visible on each.
- Tap `×` on a chip → chip disappears, box count decrements, result recalculates.
- Tap the piece number on a chip → edit overlay opens with current value pre-filled and selected.
- Change the value and tap Save → chip updates, result recalculates.
- Tap Cancel → overlay closes, no change.
- Tap outside the overlay card → overlay closes.
- Press Enter in the edit input → saves.
- Press Escape in the edit input → cancels.
- Enter 0 or letters in edit input → flash "Invalid value", overlay stays open.
- Pull list chips (boxes to pull) have NO `×` button.

Optimize mode checklist:
- Scan boxes into a pallet → chips appear with `×`.
- Delete a chip → it disappears, pick solution recalculates.
- Edit a chip's pieces → value updates, solution recalculates.
- Start a second pallet → new pallet chips are also editable.
- Pick list tab chips have NO `×` button.

- [ ] **Step 4: Delete temp test file**

```
Remove-Item test-chip.js
```

- [ ] **Step 5: Commit**

```
git add index.html
git commit -m "feat: add delete and edit to scanned box chips"
```
