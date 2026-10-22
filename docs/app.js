"use strict";
(function () {
  const root = document.getElementById("main");
  const tip = document.getElementById("vocab-tip");
  const toast = document.getElementById("toast");
  const storagePrefix = "japanese-reader.v1.";
  let readings = [], reviews = [], dictionary = {}, terms = [], activeWord = null;
  let archiveTopic = "All", archiveQuery = "";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const byNewest = (a,b) => b.date.localeCompare(a.date);
  const dateLabel = str => new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(str+"T12:00:00Z"));
  const shortDate = str => new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(str+"T12:00:00Z"));
  function storeGet(key, otherwise) { try { const v=localStorage.getItem(storagePrefix+key); return v===null?otherwise:JSON.parse(v); } catch {return otherwise;} }
  function storeSet(key,val) { try {localStorage.setItem(storagePrefix+key,JSON.stringify(val));} catch {} }
  function storeRemove(key){try {localStorage.removeItem(storagePrefix+key);} catch {}}
  function notify(message) {toast.textContent=message;toast.classList.add("visible");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("visible"),2800);}
  function closeTip(){if(activeWord)activeWord.classList.remove("selected");activeWord=null;tip.hidden=true;}
  function showTip(word) {
    closeTip();activeWord=word;word.classList.add("selected");
    const r=document.createElement("strong"),m=document.createElement("div");
    r.textContent=word.dataset.reading;m.textContent=word.dataset.meaning;
    tip.replaceChildren(r,m);tip.hidden=false;
    requestAnimationFrame(()=>{
      const pos=word.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
      const ww=document.documentElement.clientWidth,wh=document.documentElement.clientHeight;
      let x=pos.left+pos.width/2-w/2,y=pos.bottom+10;
      x=Math.max(10,Math.min(ww-w-10,x));
      if(y+h>wh-10)y=pos.top-h-10;
      if(y<10)y=Math.min(wh-h-10,pos.bottom+10);
      tip.style.left=x+"px";tip.style.top=Math.max(10,y)+"px";
    });
  }
  document.addEventListener("pointerdown",event=>{if(!event.target.closest(".word")&&!event.target.closest("#vocab-tip"))closeTip();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeTip();});
  window.addEventListener("scroll",closeTip,{passive:true});
  window.addEventListener("resize",closeTip);

  function annotateParagraph(paragraph,container) {
    const p=document.createElement("p");let i=0;
    while(i<paragraph.length) {
      let match=null;
      for(const term of terms){if(paragraph.startsWith(term,i)){match=term;break;}}
      if(match){
        const word=document.createElement("span"),ruby=document.createElement("span");
        const record=dictionary[match];
        word.className="word";word.tabIndex=0;word.setAttribute("role","button");
        word.setAttribute("aria-label",match+"; reveal pronunciation and meaning");
        word.dataset.reading=record[0];word.dataset.meaning=record[1];
        word.append(document.createTextNode(match));
        ruby.className="ruby";ruby.textContent=record[0];ruby.setAttribute("aria-hidden","true");word.append(ruby);
        word.addEventListener("click",event=>{event.stopPropagation();activeWord===word?closeTip():showTip(word);});
        word.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();activeWord===word?closeTip():showTip(word);}});
        p.append(word);i+=match.length;
      } else {
        let end=i+1;
        while(end<paragraph.length&&!terms.some(t=>paragraph.startsWith(t,end)))end++;
        p.append(document.createTextNode(paragraph.slice(i,end)));i=end;
      }
    }
    container.append(p);
  }

  function pageHeader(label,title,description){
    return '<div class="page-head"><div class="eyebrow">'+esc(label)+'</div><h1>'+esc(title)+'</h1><p class="subtitle">'+esc(description)+'</p></div>';
  }
  function updateNav(route){
    const section=route.startsWith("/archive")?"archive":route.startsWith("/review")?"reviews":"reading";
    document.querySelectorAll("[data-nav]").forEach(a=>{a.classList.toggle("active",a.dataset.nav===section);if(a.dataset.nav===section)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  }
  function routeParts(){
    const raw=decodeURIComponent(location.hash.replace(/^#\/?/,""));
    const parts=raw.split("/").filter(Boolean);
    return parts.length?parts:["reading"];
  }
  function renderReading(date){
    const current=readings.find(r=>r.date===date)||readings[0];
    if(!current){root.innerHTML='<div class="error">No readings have been published yet.</div>';return;}
    const index=readings.findIndex(r=>r.date===current.date),older=readings[index+1],newer=readings[index-1];
    const review=reviews.find(r=>r.sourceDate===current.date);
    const readDates=storeGet("read",[]);
    root.innerHTML=pageHeader("Daily reading · "+dateLabel(current.date),"A little Japanese, every day.",current.intro)+
      '<div class="page-grid"><article class="panel">'+
      '<div class="read-overline"><span>READING · N2</span><span>'+esc(current.topic)+'</span></div>'+
      '<h2 class="jp-title" lang="ja">'+esc(current.title)+'</h2>'+
      '<p class="read-intro">Hover a word to reveal its reading. Click or tap to see its English meaning.</p>'+
      '<div class="jp-copy" lang="ja" id="passage"></div>'+
      '<div class="read-actions"><button class="btn '+(readDates.includes(current.date)?"":"primary")+'" id="mark-read">'+(readDates.includes(current.date)?"✓ Read":"Mark as read")+'</button><span class="helper">Furigana stays hidden until hover or selection.</span></div>'+
      '<div class="read-actions">'+(older?'<a class="btn secondary" href="#/reading/'+esc(older.date)+'">← Previous</a>':'<span></span>')+(newer?'<a class="btn secondary" href="#/reading/'+esc(newer.date)+'">Next →</a>':'<a class="btn secondary" href="#/archive">Browse archive →</a>')+'</div>'+
      '</article><aside class="side"><div class="side-part"><div class="side-label">Reading length</div><div class="side-number">'+current.paragraphs.join("").length+'</div><div class="side-description">Japanese characters · '+current.paragraphs.length+' paragraphs</div></div>'+
      '<div class="side-part"><div class="side-label">Continue learning</div>'+
      (review?'<a class="side-link" href="#/review/'+esc(review.date)+'">Review for this reading →</a>':'<span class="side-description">No review published for this passage yet.</span>')+
      '<a class="side-link" href="#/archive">All readings →</a></div><div class="side-part"><div class="side-label">Your progress</div><div class="side-number">'+readDates.length+' / '+readings.length+'</div><div class="side-description">Marked as read in this browser only</div></div></aside></div>';
    const passage=document.getElementById("passage");
    current.paragraphs.forEach(p=>annotateParagraph(p,passage));
    document.getElementById("mark-read").addEventListener("click",()=>{
      const dates=storeGet("read",[]);
      storeSet("read",dates.includes(current.date)?dates.filter(d=>d!==current.date):dates.concat(current.date));
      notify(dates.includes(current.date)?"Removed from read list":"Marked as read");
      renderReading(current.date);
    });
    document.title=current.title+" · Japanese Reader";
  }

  function renderArchiveList(){
    const box=document.getElementById("archive-results");if(!box)return;
    const items=readings.filter(r=>(archiveTopic==="All"||r.topic===archiveTopic) && (r.title+" "+r.topic+" "+r.intro+" "+r.paragraphs.join(" ")).toLowerCase().includes(archiveQuery.toLowerCase()));
    box.innerHTML=items.map(r=>
      '<a class="item" href="#/reading/'+esc(r.date)+'"><div class="item-top"><span>'+shortDate(r.date)+'</span><span class="tag">'+esc(r.topic)+'</span></div>'+
      '<h2 lang="ja">'+esc(r.title)+'</h2><p>'+esc(r.intro)+'</p><div class="item-bottom">'+(storeGet("read",[]).includes(r.date)?"✓ Read":"Open reading →")+'</div></a>'
    ).join("") || '<div class="empty">No readings match this search. Try another term or topic.</div>';
    document.getElementById("archive-count").textContent=items.length+" "+(items.length===1?"reading":"readings");
    document.querySelectorAll(".filter").forEach(el=>{el.classList.toggle("active",el.dataset.topic===archiveTopic);el.setAttribute("aria-pressed",String(el.dataset.topic===archiveTopic));});
  }
  function renderArchive(){
    const topics=["All",...new Set(readings.map(r=>r.topic))];
    root.innerHTML=pageHeader("Your library","Reading archive","Return to older passages whenever you have time. Search by Japanese word, title or theme.")+
      '<div class="toolbar"><label class="search"><span aria-hidden="true">⌕ &nbsp;</span><input id="archive-search" type="search" placeholder="Search readings…" value="'+esc(archiveQuery)+'" aria-label="Search readings"></label>'+
      '<div class="filters" aria-label="Filter by topic">'+topics.map(t=>'<button type="button" class="filter" data-topic="'+esc(t)+'">'+esc(t)+'</button>').join("")+'</div></div>'+
      '<p id="archive-count" class="helper"></p><div class="items" id="archive-results"></div>';
    document.getElementById("archive-search").addEventListener("input",e=>{archiveQuery=e.target.value;renderArchiveList();});
    document.querySelectorAll(".filter").forEach(e=>e.addEventListener("click",()=>{archiveTopic=e.dataset.topic;renderArchiveList();}));
    renderArchiveList();document.title="Reading archive · Japanese Reader";
  }
  function renderReviews(){
    root.innerHTML=pageHeader("Practice & recall","Review exercises","Write your answers at your own pace, then copy them into ChatGPT for detailed feedback.")+
      '<div class="notice">Your answers stay in this browser until you choose Copy answers. The site does not score Japanese sentences or send your work anywhere.</div>'+
      '<div class="items">'+reviews.map(r=>
        '<a class="item" href="#/review/'+esc(r.date)+'"><div class="item-top"><span>'+shortDate(r.date)+'</span><span class="tag">'+r.questions.length+' questions</span></div>'+
        '<h2 lang="ja">'+esc(r.title)+'</h2><p>'+esc(r.intro)+'</p>'+
        '<div class="item-bottom">'+(Object.keys(storeGet("draft."+r.date,{})).length?"Continue saved draft →":"Start review →")+'</div></a>'
      ).join("")+'</div>';
    document.title="Reviews · Japanese Reader";
  }
  function answersFromForm(review){
    const values={};
    review.questions.forEach(q=>{
      const name="q-"+q.id;
      if(q.type==="text")values[q.id]=(document.querySelector('[name="'+name+'"]')?.value||"").trim();
      else if(q.type==="single")values[q.id]=document.querySelector('[name="'+name+'"]:checked')?.value||"";
      else values[q.id]=[...document.querySelectorAll('[name="'+name+'"]:checked')].map(x=>x.value);
    });
    return values;
  }
  function renderReview(date){
    const review=reviews.find(r=>r.date===date);
    if(!review){root.innerHTML='<div class="error">Review not found. <a href="#/reviews">Browse available reviews</a>.</div>';return;}
    const saved=storeGet("draft."+review.date,{});
    const reading=readings.find(r=>r.date===review.sourceDate);
    root.innerHTML=pageHeader("Review · "+dateLabel(review.date),review.title,review.intro)+
      '<div class="crumb"><a href="#/reviews">← All reviews</a>'+(reading?' &nbsp;·&nbsp; <a href="#/reading/'+esc(reading.date)+'">Source reading: '+esc(reading.title)+'</a>':'')+'</div>'+
      '<div class="review-intro">Mix Japanese and English if helpful. Partial knowledge is useful; ChatGPT will assess what you understood, what was missing, and how the expression is used. Your draft saves locally as you type.</div>'+
      '<form id="review-form" class="question-list">'+review.questions.map((q,i)=>{
        const name="q-"+q.id, val=saved[q.id];
        let control="";
        if(q.type==="text")control='<textarea name="'+name+'" rows="4" placeholder="'+esc(q.placeholder||"Write your answer here…")+'">'+esc(val||"")+'</textarea>';
        else control='<div class="choices">'+(q.options||[]).map(o=>{
          const selected=q.type==="single"?val===o.id:Array.isArray(val)&&val.includes(o.id);
          return '<label class="choice"><input type="'+(q.type==="single"?"radio":"checkbox")+'" name="'+name+'" value="'+esc(o.id)+'" '+(selected?"checked":"")+'><span><strong>'+esc(o.id)+'.</strong> '+esc(o.label)+'</span></label>';
        }).join("")+'</div>';
        return '<section class="question"><div class="q-no">QUESTION '+(i+1)+' / '+review.questions.length+'</div><p class="q-prompt" lang="ja">'+esc(q.prompt)+'</p>'+control+'</section>';
      }).join("")+'</form>'+
      '<div class="review-actions"><div class="buttons"><button class="btn primary" id="copy-answers" type="button">Copy answers</button><button class="btn secondary" id="clear-draft" type="button">Clear draft</button></div>'+
      '<span class="helper">Saved in this browser only. Copy, then paste into your Japanese Reader ChatGPT project.</span></div>';
    const form=document.getElementById("review-form");
    const save=()=>{storeSet("draft."+review.date,answersFromForm(review));};
    form.addEventListener("input",save);form.addEventListener("change",save);
    document.getElementById("copy-answers").addEventListener("click",async()=>{
      const values=answersFromForm(review);save();
      const lines=["Japanese Reader — review answers","Review: "+review.title,"Review date: "+review.date,"Source reading: "+(reading?.title||review.sourceDate),"",...review.questions.map((q,i)=>{
        const ans=values[q.id];
        let value=Array.isArray(ans)?ans.join(", "):ans;
        if(!value)value="[Not answered]";
        return "Q"+(i+1)+". "+q.prompt+"\nAnswer: "+value;
      }),"","Please review each response as correct / partly correct / incorrect based on substance, explain what I already knew and any missing or mistaken details, and include kanji readings, nuance, and useful examples. Update my private Japanese learning history and weak points in GitHub after reviewing."];
      const text=lines.join("\n\n");
      try {
        if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
        else {
          const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.left="-9999px";document.body.append(ta);ta.select();
          if(!document.execCommand("copy"))throw new Error("Copy not supported");
          ta.remove();
        }
        notify("Answers copied — paste them into ChatGPT");
      } catch {
        window.prompt("Copy these answers to ChatGPT:",text);
        notify("Use the copy window to copy your answers");
      }
    });
    document.getElementById("clear-draft").addEventListener("click",()=>{
      if(window.confirm("Clear all answers saved for this review in this browser?")){storeRemove("draft."+review.date);renderReview(review.date);notify("Draft cleared");}
    });
    document.title=review.title+" · Japanese Reader";
  }

  function render(){
    closeTip();const [section,date]=routeParts();updateNav("/"+section);
    if(section==="archive")renderArchive();
    else if(section==="reviews")renderReviews();
    else if(section==="review")renderReview(date);
    else renderReading(section==="reading"?date:undefined);
    window.scrollTo({top:0,behavior:"instant"});
  }
  async function init(){
    try{
      const paths=["./data/readings.json","./data/reviews.json","./data/lexicon.json"];
      const results=await Promise.all(paths.map(async path=>{
        const response=await fetch(path,{cache:"no-cache"});
        if(!response.ok)throw new Error(path+" returned "+response.status);
        return response.json();
      }));
      readings=results[0].sort(byNewest);reviews=results[1].sort(byNewest);dictionary=results[2];
      terms=Object.keys(dictionary).filter(k=>k.length>0).sort((a,b)=>b.length-a.length || a.localeCompare(b));
      window.addEventListener("hashchange",render);
      render();
    }catch(err){
      root.innerHTML='<div class="error"><strong>Could not load the reading library.</strong><p>'+esc(err.message)+'</p><p>Please open the published GitHub Pages site rather than the HTML file directly, and check that the data files are present.</p></div>';
      console.error("Japanese Reader:",err);
    }
  }
  init();
})();
