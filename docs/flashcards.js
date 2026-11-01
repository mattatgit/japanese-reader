"use strict";
(function () {
  const storagePrefix = "japanese-reader.v1.flashcards.";
  const day = 86400000;
  const reviewDays = [1, 3, 7, 14, 30, 60];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hasKanji = value => /[\u3400-\u9fff]/u.test(value);
  const hasJapanese = value => /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
  let app = null;
  let state = {mode:"vocab",scope:"recent",query:"",queue:[],position:0,revealed:false,attempt:"",known:0,again:0,message:""};

  function getStored(key, fallback) {
    try {
      const value = localStorage.getItem(storagePrefix + key);
      return value === null ? fallback : JSON.parse(value);
    } catch { return fallback; }
  }
  function setStored(key, value) {
    try { localStorage.setItem(storagePrefix + key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function termAllowed(word, reading, meaning) {
    return typeof word === "string" && word.length > 0 && word.length <= 22 &&
      hasJapanese(word) && !/[|<>~〜/／\n]/u.test(word) &&
      typeof reading === "string" && /[\u3040-\u30ff]/u.test(reading) &&
      typeof meaning === "string" && meaning.trim().length > 0;
  }

  // Only import word, reading and definition. Notes and review history are ignored.
  function parseImport(text) {
    const found = new Map();
    for (const line of String(text).split(/\r?\n/u)) {
      const t = line.trim();
      const cells = t.startsWith("|")
        ? t.replace(/^\|/u,"").replace(/\|$/u,"").split("|").map(x => x.trim())
        : t.includes("\t") ? t.split("\t").map(x => x.trim()) : [];
      if (cells.length < 3) continue;
      const [word, reading, meaning] = cells.map(x => x.replace(/\*\*/gu,"").trim());
      if (!termAllowed(word, reading, meaning) || /[A-Za-z/／]/u.test(reading)) continue;
      found.set(word, {word, reading, meaning});
      if (found.size >= 5000) break;
    }
    return [...found.values()];
  }
  function contextSentence(paragraph, index) {
    let begin = 0;
    for (const mark of ["。","！","？"]) begin = Math.max(begin, paragraph.lastIndexOf(mark,index-1)+1);
    let end = paragraph.length;
    for (const mark of ["。","！","？"]) {
      const n=paragraph.indexOf(mark,index);
      if (n>=0) end=Math.min(end,n+1);
    }
    return paragraph.slice(begin,end).trim().slice(0,140);
  }
  function buildEntries(readings, dictionary, imported) {
    const map = new Map();
    for (const [word, details] of Object.entries(dictionary || {})) {
      if (Array.isArray(details) && termAllowed(word,details[0],details[1]))
        map.set(word, {word, reading:details[0], meaning:details[1], date:"",title:"",example:"",imported:false});
    }
    for (const item of (Array.isArray(imported) ? imported : [])) {
      if (!item || !termAllowed(item.word,item.reading,item.meaning)) continue;
      if (map.has(item.word)) map.get(item.word).imported=true;
      else map.set(item.word,{word:item.word,reading:item.reading,meaning:item.meaning,date:"",title:"",example:"",imported:true});
    }
    const termsByFirst = new Map();
    for (const term of Object.keys(dictionary || {})) {
      if (!map.has(term)) continue;
      const first = term[0];
      if (!termsByFirst.has(first)) termsByFirst.set(first,[]);
      termsByFirst.get(first).push(term);
    }
    for (const terms of termsByFirst.values()) terms.sort((a,b)=>b.length-a.length||a.localeCompare(b,"ja"));
    const sortedReadings=[...(Array.isArray(readings)?readings:[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    for (const reading of sortedReadings) {
      for (const paragraph of (reading.paragraphs||[])) {
        for (let i=0;i<paragraph.length;) {
          const match=(termsByFirst.get(paragraph[i])||[]).find(t=>paragraph.startsWith(t,i));
          if (!match) {i++;continue;}
          const card=map.get(match);
          if (card) {
            card.date=reading.date;
            card.title=reading.title;
            card.example=contextSentence(paragraph,i);
          }
          i+=match.length;
        }
      }
    }
    return [...map.values()];
  }
  function cardId(card, mode) { return mode + ":" + card.word; }
  function nextProgress(previous, remembered, now) {
    const old = previous && typeof previous==="object" ? previous : {};
    const streak=remembered? Math.min(6,Math.max(0,Number(old.streak)||0)+1) : 0;
    const due=remembered ? now + reviewDays[streak-1]*day : now;
    return {streak,due,last:now,successes:(Number(old.successes)||0)+(remembered?1:0),lapses:(Number(old.lapses)||0)+(remembered?0:1)};
  }
  function scopedEntries(entries,readings,mode,scope,query) {
    const latest=new Set([...(readings||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,7).map(r=>r.date));
    const term=String(query||"").trim().toLocaleLowerCase();
    return entries.filter(c=>
      (mode!=="kanji" || hasKanji(c.word)) &&
      (scope==="recent" ? latest.has(c.date) : scope==="archive" ? Boolean(c.date) : scope==="imported" ? c.imported : true) &&
      (!term || (c.word+" "+c.reading+" "+c.meaning).toLocaleLowerCase().includes(term))
    );
  }
  function selectCards(candidates,progress,mode,now,count=10,includeScheduled=false) {
    const due=[],fresh=[],scheduled=[];
    for(const c of candidates) {
      const p=progress[cardId(c,mode)];
      if(!p || !Number.isFinite(p.due)) fresh.push(c);
      else if(p.due<=now) due.push(c);
      else scheduled.push(c);
    }
    const recentFirst=(a,b)=>String(b.date).localeCompare(String(a.date))||a.word.localeCompare(b.word,"ja");
    due.sort((a,b)=>progress[cardId(a,mode)].due-progress[cardId(b,mode)].due || recentFirst(a,b));
    fresh.sort(recentFirst);
    scheduled.sort((a,b)=>progress[cardId(a,mode)].due-progress[cardId(b,mode)].due);
    return [...due,...fresh,...(includeScheduled?scheduled:[])].slice(0,count);
  }
  function currentPool() {
    return scopedEntries(app.entries,app.readings,state.mode,state.scope,state.query);
  }
  function progressData() {
    const data=getStored("progress",{});
    return data && typeof data==="object" && !Array.isArray(data)?data:{};
  }
  function statsFor(pool,progress) {
    let due=0,newCount=0,scheduled=0,studied=0;
    const now=Date.now();
    for(const c of pool) {
      const p=progress[cardId(c,state.mode)];
      if(!p || !Number.isFinite(p.due))newCount++;
      else {studied++;if(p.due<=now)due++;else scheduled++;}
    }
    return {due,newCount,scheduled,studied};
  }
  function resetSession() {
    state.queue=[];state.position=0;state.revealed=false;state.attempt="";state.known=0;state.again=0;
  }
  function savedPrefs() { setStored("prefs",{mode:state.mode,scope:state.scope}); }
  function showStats() {
    const pool=currentPool(),s=statsFor(pool,progressData());
    const el=document.getElementById("fc-stats");
    if(!el)return;
    el.innerHTML='<div><strong>'+pool.length+'</strong><span>in selection</span></div>'+
      '<div><strong>'+s.due+'</strong><span>due for review</span></div>'+
      '<div><strong>'+s.newCount+'</strong><span>not yet studied</span></div>'+
      '<div><strong>'+s.studied+'</strong><span>studied</span></div>';
  }
  function startSession(includeScheduled) {
    const pool=currentPool();
    state.queue=selectCards(pool,progressData(),state.mode,Date.now(),10,includeScheduled);
    state.position=0;state.revealed=false;state.attempt="";state.known=0;state.again=0;
    renderPractice();
  }
  function renderPractice() {
    const el=document.getElementById("fc-practice");
    if(!el)return;
    if(!state.queue.length) {
      const pool=currentPool(),s=statsFor(pool,progressData());
      el.innerHTML='<div class="fc-intro-card"><div class="fc-card-small">READY TO PRACTISE</div>'+
        '<h2>'+(state.mode==="kanji"?"Recall the written kanji":"Remember the reading and meaning")+'</h2>'+
        '<p>'+(state.mode==="kanji"?"See the kana and English meaning, then try writing the Japanese characters before revealing.":"See the Japanese word first, then recall its reading and meaning before revealing.")+'</p>'+
        (pool.length ? (s.due+s.newCount>0
          ? '<button id="fc-start" class="btn primary">Start 10 cards →</button>'
          : '<p class="helper">Nothing is due yet in this selection.</p><button id="fc-start-all" class="btn secondary">Practise ahead of schedule</button>')
          : '<p class="helper">'+(state.scope==="imported"?"Your private list is empty. Import vocabulary below to practise it here.":"No matching words. Try a different filter or search.")+'</p>')+
        '</div>';
      document.getElementById("fc-start")?.addEventListener("click",()=>startSession(false));
      document.getElementById("fc-start-all")?.addEventListener("click",()=>startSession(true));
      return;
    }
    if(state.position >= state.queue.length) {
      el.innerHTML='<div class="fc-intro-card fc-finished"><div class="fc-card-small">SESSION COMPLETE</div>'+
        '<h2>'+state.queue.length+' cards practised</h2>'+
        '<p><strong>'+state.known+'</strong> remembered · <strong>'+state.again+'</strong> to revisit. Cards marked Again will be due in your next session; remembered cards return after increasing intervals.</p>'+
        '<button id="fc-next" class="btn primary">Another 10 cards →</button></div>';
      document.getElementById("fc-next").addEventListener("click",()=>startSession(false));
      return;
    }
    const card=state.queue[state.position];
    const isKanji=state.mode==="kanji";
    const front=isKanji?esc(card.reading):esc(card.word);
    const sub=isKanji?esc(card.meaning):"Say its reading and meaning.";
    const prompt=isKanji?"Write the Japanese word (optional)":"Type the reading or meaning (optional)";
    const answer='<div class="fc-answer-word" lang="ja">'+esc(card.word)+'</div>'+
      '<div class="fc-answer-reading" lang="ja">'+esc(card.reading)+'</div>'+
      '<div class="fc-answer-meaning">'+esc(card.meaning)+'</div>'+
      (card.example?'<p class="fc-example" lang="ja">'+esc(card.example)+'</p>':'')+
      (card.date?'<a class="fc-reading-link" href="#/reading/'+esc(card.date)+'">From '+esc(card.title)+' →</a>':'')+
      (card.imported?'<div class="fc-origin">Also in your imported list</div>':'');
    el.innerHTML='<div class="fc-session-bar"><span>Card '+(state.position+1)+' of '+state.queue.length+'</span>'+
      '<span>'+esc(isKanji?"KANJI RECALL":"VOCABULARY")+'</span></div>'+
      '<div class="fc-flashcard '+(state.revealed?"is-revealed":"")+'" aria-live="polite">'+
      (state.revealed ? '<div class="fc-card-small">ANSWER</div>'+answer+
        (state.attempt.trim()?'<div class="fc-attempt">Your attempt: <span lang="ja">'+esc(state.attempt)+'</span></div>':'') :
        '<div class="fc-card-small">RECALL BEFORE REVEALING</div>'+
        '<div class="fc-front" lang="ja">'+front+'</div><p class="fc-front-sub">'+sub+'</p>')+
      '</div>'+
      (state.revealed ? '<div class="fc-grade"><button class="btn fc-again" id="fc-again">Again · forgot</button><button class="btn primary" id="fc-known">Remembered ✓</button></div>'+
        '<p class="helper fc-grading-note">Judge your own answer; spelling, reading and meaning all count. Nothing you type is uploaded.</p>'
        : '<div class="fc-practice-actions"><label for="fc-attempt">'+esc(prompt)+'</label>'+
          '<input id="fc-attempt" type="text" lang="ja" autocomplete="off" spellcheck="false" value="'+esc(state.attempt)+'" placeholder="'+esc(prompt)+'">'+
          '<button id="fc-reveal" class="btn primary">Reveal answer →</button></div>')+
      '<div class="fc-bar" aria-hidden="true"><div style="width:'+(state.position/state.queue.length*100)+'%"></div></div>';
    if(!state.revealed) {
      const input=document.getElementById("fc-attempt");
      document.getElementById("fc-reveal").addEventListener("click",()=>{state.attempt=input.value;state.revealed=true;renderPractice();});
      input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();state.attempt=input.value;state.revealed=true;renderPractice();}});
      input.addEventListener("input",()=>{state.attempt=input.value;});
    } else {
      document.getElementById("fc-again").addEventListener("click",()=>rate(false));
      document.getElementById("fc-known").addEventListener("click",()=>rate(true));
    }
  }
  function rate(remembered) {
    if(!state.revealed || !state.queue[state.position])return;
    const card=state.queue[state.position],progress=progressData();
    const id=cardId(card,state.mode);
    progress[id]=nextProgress(progress[id],remembered,Date.now());
    const saved=setStored("progress",progress);
    if(!saved)state.message="Browser storage is unavailable: ratings may not persist.";
    if(remembered)state.known++;else state.again++;
    state.position++;state.revealed=false;state.attempt="";
    showStats();renderPractice();
    showMessage();
  }
  function showMessage() {
    const el=document.getElementById("fc-message");
    if(el)el.textContent=state.message;
  }
  function refresh() {
    const imported=getStored("imported",[]);
    app.entries=buildEntries(app.readings,app.dictionary,imported);
    resetSession();
    render(app.root,app.readings,app.dictionary);
  }
  function addImported(content) {
    const additions=parseImport(content);
    if(!additions.length) {
      state.message="No valid vocabulary rows found. Use the Word | Reading | Meaning tables in vocabulary.md (or tab-separated rows).";
      showMessage();return;
    }
    const current=getStored("imported",[]);
    const map=new Map((Array.isArray(current)?current:[]).map(x=>[x.word,x]));
    additions.forEach(c=>map.set(c.word,c));
    if(!setStored("imported",[...map.values()])) {
      state.message="Could not save the imported vocabulary in browser storage.";showMessage();return;
    }
    state.message=additions.length+" vocabulary entries imported locally. Nothing was uploaded.";
    state.scope="imported";savedPrefs();refresh();
  }
  function render(root,readings,dictionary) {
    app={root,readings,dictionary,entries:buildEntries(readings,dictionary,getStored("imported",[]))};
    if(!state.initialized) {
      const prefs=getStored("prefs",{});
      if(["vocab","kanji"].includes(prefs.mode))state.mode=prefs.mode;
      if(["recent","archive","all","imported"].includes(prefs.scope))state.scope=prefs.scope;
      state.initialized=true;
    }
    const imported=getStored("imported",[]);
    const importedCount=Array.isArray(imported)?imported.length:0;
    root.innerHTML='<div class="page-head"><div class="eyebrow">RECALL · REPEAT · REMEMBER</div>'+
      '<h1>Vocabulary & kanji</h1><p class="subtitle">Practise words from recent readings or revisit the full archive. Your cards and review schedule stay in this browser.</p></div>'+
      '<div class="page-grid fc-layout"><section class="panel fc-panel">'+
      '<div class="fc-modes" role="group" aria-label="Practice mode">'+
      '<button class="fc-mode '+(state.mode==="vocab"?"active":"")+'" data-fc-mode="vocab" aria-pressed="'+(state.mode==="vocab")+'">Vocabulary</button>'+
      '<button class="fc-mode '+(state.mode==="kanji"?"active":"")+'" data-fc-mode="kanji" aria-pressed="'+(state.mode==="kanji")+'">Kanji recall</button></div>'+
      '<div class="fc-controls"><label for="fc-scope">Choose words<select id="fc-scope">'+
      '<option value="recent" '+(state.scope==="recent"?"selected":"")+'>Recent · last 7 readings</option>'+
      '<option value="archive" '+(state.scope==="archive"?"selected":"")+'>All published readings</option>'+
      '<option value="all" '+(state.scope==="all"?"selected":"")+'>Full vocabulary dictionary</option>'+
      '<option value="imported" '+(state.scope==="imported"?"selected":"")+'>My imported vocabulary ('+importedCount+')</option>'+
      '</select></label>'+
      '<label for="fc-search">Find a word<input id="fc-search" type="search" value="'+esc(state.query)+'" placeholder="Search Japanese or English…"></label></div>'+
      '<div class="fc-stats" id="fc-stats" aria-live="polite"></div>'+
      '<div id="fc-practice"></div><div id="fc-message" class="fc-message" role="status" aria-live="polite"></div>'+
      '</section><aside class="side fc-sidebar">'+
      '<div class="side-part"><div class="side-label">How it works</div><p class="side-description">Reveal the answer, then choose <strong>Again</strong> or <strong>Remembered</strong>. Cards you forget return sooner. Each mode has separate progress.</p></div>'+
      '<div class="side-part"><div class="side-label">Private vocabulary</div><p class="side-description">To practise words from your private Japanese repo, import its vocabulary.md here. This happens only in your browser; no private learning history goes into the public website.</p>'+
      '<details class="fc-import"><summary>Import private vocabulary</summary>'+
      '<p class="helper"><a href="https://github.com/mattatgit/japanese/blob/main/vocabulary.md" target="_blank" rel="noopener noreferrer">Open vocabulary.md in GitHub</a> and save the file or copy its Markdown tables.</p>'+
      '<label for="fc-import-file" class="fc-file-label">Choose a .md or .txt file</label><input type="file" id="fc-import-file" accept=".md,.txt,text/markdown,text/plain">'+
      '<label for="fc-import-text" class="fc-file-label">Or paste Markdown table rows</label><textarea id="fc-import-text" rows="4" placeholder="| 鑑賞 | かんしょう | art appreciation |"></textarea>'+
      '<button class="btn secondary" id="fc-import-button">Import pasted words</button>'+
      (importedCount?'<button class="btn secondary fc-clear" id="fc-clear-imported">Remove imported list</button>':'')+
      '<p class="helper">Only the first three columns (word, reading, meaning) are used; notes and results are ignored. Save your progress separately if changing browsers.</p></details></div>'+
      '<div class="side-part"><div class="side-label">Storage</div><p class="side-description">Spaced review history lives in this browser’s local storage. It does not sync between devices or GitHub.</p></div>'+
      '</aside></div>';
    document.querySelectorAll("[data-fc-mode]").forEach(button=>button.addEventListener("click",()=>{
      if(state.mode!==button.dataset.fcMode){state.mode=button.dataset.fcMode;resetSession();savedPrefs();render(root,readings,dictionary);}
    }));
    document.getElementById("fc-scope").addEventListener("change",event=>{
      state.scope=event.target.value;resetSession();savedPrefs();render(root,readings,dictionary);
    });
    document.getElementById("fc-search").addEventListener("input",event=>{
      state.query=event.target.value;resetSession();showStats();renderPractice();
    });
    document.getElementById("fc-import-button").addEventListener("click",()=>addImported(document.getElementById("fc-import-text").value));
    document.getElementById("fc-import-file").addEventListener("change",async event=>{
      const file=event.target.files?.[0];
      if(!file)return;
      if(file.size>1000000){state.message="Please choose a vocabulary file under 1 MB.";showMessage();return;}
      try{addImported(await file.text());}catch{state.message="Could not read the file.";showMessage();}
    });
    document.getElementById("fc-clear-imported")?.addEventListener("click",()=>{
      if(window.confirm("Remove your locally imported vocabulary? Existing review ratings will be kept.")){
        setStored("imported",[]);state.message="Imported vocabulary removed from this browser.";refresh();
      }
    });
    showStats();renderPractice();showMessage();
    document.title="Vocabulary & kanji · Japanese Reader";
  }
  window.JapaneseFlashcards={render,testing:{parseImport,buildEntries,scopedEntries,selectCards,nextProgress,cardId}};
})();