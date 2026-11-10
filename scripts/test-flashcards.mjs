import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync("docs/flashcards.js","utf8"),sandbox);
const api=sandbox.window.JapaneseFlashcards.testing;
const readings=JSON.parse(fs.readFileSync("docs/data/readings.json","utf8"));
const dictionary=JSON.parse(fs.readFileSync("docs/data/lexicon.json","utf8"));

const entries=api.buildEntries(readings,dictionary,[]);
assert.ok(entries.length>400,"The full vocabulary bank should include historic entries");
const recording=entries.find(e=>e.word==="録音");
assert.ok(recording,"A recent audio word should be in the bank");
assert.equal(recording.date,"2026-11-02");
assert.ok(recording.example.includes("録音"),"Reading context should be attached");
const recent=api.scopedEntries(entries,readings,"vocab","recent","");
assert.ok(recent.length>30,"Recent readings should produce a useful deck");
const recentDates=new Set([...readings].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,7).map(r=>r.date));
assert.ok(recent.every(c=>recentDates.has(c.date)),"Recent deck should use only the latest seven published readings");
assert.ok(recent.some(c=>c.date===readings.at(-1).date),"Recent deck should include terms from the newest reading");
const old=api.scopedEntries(entries,readings,"vocab","archive","");
assert.ok(old.length>=recent.length);
const kanji=api.scopedEntries(entries,readings,"kanji","recent","");
assert.ok(kanji.length>10 && kanji.every(c=>/[\u3400-\u9fff]/u.test(c.word)));
assert.ok(api.scopedEntries(entries,readings,"vocab","all","ろくおん").some(c=>c.word==="録音"));

const input=[
  "| Word | Reading | Meaning | Notes |",
  "|---|---|---|---|",
  "| 鑑賞 | かんしょう | viewing artworks | weak point: ignored |",
  "| 接合部分 | せつごうぶぶん | joint section | private note: ignored |",
  "| 〜とは限らない | — | grammar | ignore |",
  "| Not Japanese | reading | ignore |",
  "勾配\tこうばい\tslope\tprivate note ignored",
].join("\n");
const imported=api.parseImport(input);
assert.equal(imported.length,3,"Valid words in Markdown and tab-separated tables should import");
assert.equal(imported.find(c=>c.word==="鑑賞").meaning,"viewing artworks");
assert.equal(imported.find(c=>c.word==="接合部分").reading,"せつごうぶぶん");
assert.equal(JSON.stringify(imported).includes("private note"),false,"Never store private note columns");
const combined=api.buildEntries(readings,dictionary,imported);
assert.equal(combined.filter(e=>e.word==="鑑賞").length,1,"Import should not duplicate public entries");
assert.equal(combined.find(e=>e.word==="鑑賞").imported,true,"Existing words can belong to imported list");
const inPrivate=api.scopedEntries(combined,readings,"vocab","imported","");
assert.ok(inPrivate.some(c=>c.word==="鑑賞"));

const now=Date.UTC(2026,10,2);
const key=api.cardId(recording,"vocab");
const fresh=api.selectCards([recording],{},"vocab",now,10);
assert.equal(fresh.length,1,"Unseen cards should be ready");
const first=api.nextProgress(undefined,true,now);
assert.equal(first.streak,1);
assert.equal(first.due,now+86400000,"First remembered review due after a day");
const second=api.nextProgress(first,true,now+86400000);
assert.equal(second.streak,2);
assert.equal(second.due,now+86400000+3*86400000);
const forgotten=api.nextProgress(second,false,now);
assert.equal(forgotten.streak,0);
assert.equal(forgotten.due,now,"Forgotten cards should be ready for the next session");
const notDue=api.selectCards([recording],{[key]:first},"vocab",now,10);
assert.equal(notDue.length,0,"Scheduled cards should stay hidden until due");
const forced=api.selectCards([recording],{[key]:first},"vocab",now,10,true);
assert.equal(forced.length,1,"The learner can practise ahead of schedule");
const prioritize=api.selectCards([recording,...recent.filter(x=>x.word!=="録音").slice(0,2)],{[key]:forgotten},"vocab",now,10);
assert.equal(prioritize[0].word,"録音","Due cards should take priority over fresh cards");
console.log("Flashcards: passed vocabulary, kanji, import, search and spaced-repetition checks.");


// Backups are private data: validate before preview or any storage mutation.
sandbox.TextEncoder=TextEncoder;
const storage=new Map();
sandbox.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const prefix='japanese-reader.v1.flashcards.';
storage.set(prefix+'progress',JSON.stringify({[key]:first}));
assert.equal(api.collectionData().progress[key].due,first.due,'Legacy ratings are retained');
assert.ok(api.saveWord({word:'録音',reading:'ろくおん',meaning:'recording'}));
assert.ok(api.saveWord({word:'録音',reading:'ろくおん',meaning:'recording'}));
assert.equal(api.collectionData().saved.length,1,'Repeated popup saves are idempotent');
assert.equal(api.collectionData().progress[key].due,first.due,'Saving never resets ratings');
const savedDeck=api.buildEntries(readings,dictionary,[],api.collectionData().saved);
assert.equal(api.scopedEntries(savedDeck,readings,'vocab','saved','').length,1);
assert.equal(api.scopedEntries(savedDeck,readings,'kanji','saved','')[0].word,'録音');
const backup=api.validateBackup(api.exportBackup());
assert.equal(backup.saved.length,1);
assert.equal(backup.progress[key].due,first.due);
const incoming=api.validateBackup(JSON.stringify({format:'japanese-reader-flashcards',version:1,imported:[],saved:[],progress:{[key]:second,'kanji:録音':forgotten}}));
const merged=api.mergeCollections(backup,incoming);
assert.equal(merged.saved.length,1);
assert.equal(merged.progress[key].last,second.last);
assert.equal(merged.progress['kanji:録音'].lapses,1,'Modes merge independently');
assert.equal(api.mergeCollections(merged,backup).progress[key].last,second.last,'Stale backups cannot regress schedules');
assert.equal(JSON.stringify(api.mergeCollections(merged,incoming)),JSON.stringify(merged),'Re-imports never inflate counters');
const simultaneous={...first,lapses:1};
const tieA=api.mergeCollections({...backup,progress:{[key]:first}},{...backup,progress:{[key]:simultaneous}});
const tieB=api.mergeCollections({...backup,progress:{[key]:simultaneous}},{...backup,progress:{[key]:first}});
assert.equal(JSON.stringify(tieA.progress),JSON.stringify(tieB.progress),'Equal-time conflicts converge');
for(const mutate of [
 d=>d.version=99,d=>d.saved={},d=>d.saved.push(d.saved[0]),
 d=>d.progress[key].due=-1,d=>d.progress[key].streak=7,
 d=>d.progress[key].successes=1.5,d=>d.progress[key].last='yesterday',
 d=>d.progress[key].extra='unexpected',d=>d.saved[0].meaning='x'.repeat(1001),
]) {
 const d=JSON.parse(api.exportBackup());mutate(d);
 assert.throws(()=>api.validateBackup(JSON.stringify(d)));
}
assert.throws(()=>api.validateBackup('{"format":"japanese-reader-flashcards","version":1,"saved":[],"imported":[],"progress":{"__proto__":{}}}'));
assert.throws(()=>api.validateBackup('x'.repeat(2000001)));
assert.throws(()=>api.validateBackup('{invalid JSON'));
const before=JSON.stringify([...storage]);
sandbox.localStorage.setItem=()=>{throw Error('quota');};
assert.equal(api.saveWord({word:'勾配',reading:'こうばい',meaning:'slope'}),false);
assert.equal(JSON.stringify([...storage]),before,'Storage failures preserve previous data');
console.log('Flashcards: backup round trip, legacy migration, saved decks, merge conflicts, validation and storage failure passed.');


// Exercise the user-facing reveal/rating flow with a saved preference for either mode.
for(const mode of ['vocab','kanji']) {
 for(const remembered of [true,false]) {
  const nodes=new Map();
  class Element {
   constructor(){this.html='';this.listeners={};}
   set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Element());}
   get innerHTML(){return this.html;}
   addEventListener(name,fn){this.listeners[name]=fn;}
   click(){assert.ok(this.listeners.click);this.listeners.click();}
  }
  const root=new Element();
  const id=mode+':録音',other=(mode==='kanji'?'vocab':'kanji')+':録音';
  const old={streak:1,due:0,last:0,successes:3,lapses:2};
  const memory=new Map([
   [prefix+'prefs',JSON.stringify({mode,scope:'all'})],
   [prefix+'progress',JSON.stringify({[id]:old,[other]:old})],
   [prefix+'saved',JSON.stringify([{word:'録音',reading:'ろくおん',meaning:'audio recording'}])]
  ]);
  const ui={window:{},TextEncoder,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},
   document:{getElementById:k=>nodes.get(k),querySelectorAll:()=>[]}};
  vm.runInNewContext(fs.readFileSync('docs/flashcards.js','utf8'),ui);
  ui.window.JapaneseFlashcards.render(root,[],{'録音':['ろくおん','audio recording']});
  assert.ok(root.innerHTML.includes('Kanji reading'),'Label describes recognition');
  nodes.get('fc-start').click();
  const front=nodes.get('fc-practice').innerHTML;
  assert.ok(front.includes('録音'),mode+' shows the Japanese word first');
  assert.ok(!front.includes('ろくおん')&&!front.includes('audio recording'),'No answer is exposed before reveal');
  assert.ok(!front.includes('<input'),'No typing or input-method hint is needed');
  assert.ok(!front.includes('id="fc-known"'),'Rating follows reveal');
  nodes.get('fc-reveal').click();
  const answer=nodes.get('fc-practice').innerHTML;
  assert.ok(answer.includes('ろくおん')&&answer.includes('audio recording'),'Reveal shows reading and meaning');
  nodes.get(remembered?'fc-known':'fc-again').click();
  const result=JSON.parse(memory.get(prefix+'collection'));
  assert.equal(result.progress[id].streak,remembered?2:0);
  assert.equal(result.progress[id].successes,remembered?4:3);
  assert.equal(result.progress[id].lapses,remembered?2:3);
  assert.deepEqual(result.progress[other],old,'Other mode history stays intact');
  assert.equal(result.saved.length,1,'Saved list is retained');
 }
}
console.log('Flashcards: both modes show Japanese first, hide answers, reveal without typing and preserve rating history.');
