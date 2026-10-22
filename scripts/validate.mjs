import fs from "node:fs";

const read = name => JSON.parse(fs.readFileSync("docs/data/" + name + ".json","utf8"));
const fail = message => { throw new Error(message); };
const validDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T00:00:00Z"));
const unique = (items,label) => { const seen = new Set(); for (const value of items){ if(seen.has(value))fail("Duplicate "+label+": "+value); seen.add(value); } };
const nonempty = s => typeof s === "string" && s.trim().length > 0;

const readings = read("readings");
const reviews = read("reviews");
const dictionary = read("lexicon");

if(!Array.isArray(readings)||readings.length<1)fail("No readings");
unique(readings.map(r=>r.date),"reading date");
for (const r of readings) {
  if(!validDate(r.date)||!nonempty(r.title)||!nonempty(r.topic)||!nonempty(r.intro))fail("Invalid reading metadata: "+r.date);
  if(!Array.isArray(r.paragraphs)||r.paragraphs.length<3||r.paragraphs.length>4)fail("Reading should have 3–4 paragraphs: "+r.date);
  if(r.paragraphs.some(p=>!nonempty(p)||p.length<50))fail("Reading has short or missing paragraph: "+r.date);
  const count=r.paragraphs.join("").length;
  if(count<300||count>550)fail("Reading must have 300–550 Japanese characters: "+r.date+" ("+count+")");
}
if(!Array.isArray(reviews))fail("Reviews must be an array");
unique(reviews.map(r=>r.date),"review date");
const sourceDates = new Set(readings.map(r=>r.date));
for(const r of reviews){
  if(!validDate(r.date)||!validDate(r.sourceDate)||!nonempty(r.title)||!nonempty(r.intro)||!sourceDates.has(r.sourceDate))fail("Invalid review metadata/source date: "+r.date);
  if(!Array.isArray(r.questions)||r.questions.length<6||r.questions.length>10)fail("Review must have 6–10 questions: "+r.date);
  unique(r.questions.map(q=>q.id),"question ID in "+r.date);
  for(const q of r.questions){
    if(!nonempty(q.id)||!nonempty(q.prompt)||!["text","single","multiple"].includes(q.type))fail("Invalid question in "+r.date);
    if(q.type!=="text"){
      if(!Array.isArray(q.options)||q.options.length<2)fail("Choices missing in "+r.date);
      unique(q.options.map(o=>o.id),"option ID in "+r.date+"/"+q.id);
      for(const o of q.options)if(!nonempty(o.id)||!nonempty(o.label))fail("Invalid option in "+r.date+"/"+q.id);
    }
    if("answer" in q || "correctAnswer" in q || "correct" in q)fail("Do not publish answer keys: "+r.date+"/"+q.id);
  }
}
if(!dictionary || typeof dictionary!=="object" || Array.isArray(dictionary))fail("Lexicon must be an object");
for(const [word,detail] of Object.entries(dictionary)){
  if(!nonempty(word)||!Array.isArray(detail)||detail.length!==2||!detail.every(nonempty))fail("Invalid lexicon entry: "+word);
}
console.log("Validated "+readings.length+" readings, "+reviews.length+" reviews, "+Object.keys(dictionary).length+" vocabulary definitions.");
