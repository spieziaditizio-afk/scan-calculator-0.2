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
// Expected post-Task-4 sig: chip(seq, pc, pull, newest, editable, palid)
const ed = chip(3, 500, false, false, true, null);
ok('ed: chip-del',        ed.includes('chip-del'));        // FAIL before Task 4
ok('ed: chip-pc',         ed.includes('chip-pc'));         // FAIL before Task 4
ok('ed: .editable class', ed.includes(' editable'));       // FAIL before Task 4
ok('ed: data-seq=3',      ed.includes('data-seq="3"'));    // FAIL before Task 4
ok('ed: no data-palid',  !ed.includes('data-palid'));
ok('ed: no pull class',  !ed.includes(' pull'));

// editable chip with palid (Optimize)
const op = chip(2, 100, false, true, true, 'p1abc');
ok('op: data-palid',      op.includes('data-palid="p1abc"'));  // FAIL before Task 4
ok('op: chip-del',        op.includes('chip-del'));            // FAIL before Task 4
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
