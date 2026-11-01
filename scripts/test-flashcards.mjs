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
assert.ok(recent.some(c=>c.word==="録音"));
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
