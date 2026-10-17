/* Adds the sky-field and evidence/report widgets to the existing AstroLens workspace. */
(() => {
 const $=s=>document.querySelector(s);
 const style=document.createElement("link");style.rel="stylesheet";style.href="dashboard-upgrade.css?v=command-center-2";document.head.appendChild(style);
 const nav=document.querySelector(".sidebar");
 if(nav&&!document.querySelector('[data-nav-extra="reports"]')){
   const item=document.createElement("a");item.className="nav-link";item.href="#commandPanels";item.dataset.navExtra="reports";item.innerHTML="<span>⌗</span> Sky Map & Reports";
   const anchor=nav.querySelector(".sidebar-bottom");if(anchor)nav.insertBefore(item,anchor);
 }
 const section=document.createElement("section");section.id="commandPanels";section.className="command-panels command-reports";
 section.innerHTML=`
 <article class="command-panel"><div class="command-panel-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> TARGET CONTEXT</div><h2>Sky map & detection view</h2><p>A navigable visual field for exploring result positions. The background is illustrative, not a survey image or astrometric catalogue.</p></div><span class="panel-tag">SKY FIELD</span></div><canvas id="skyField" class="sky-map" aria-label="Illustrative sky field with clickable candidate markers"></canvas><div class="sky-legend"><span style="--dot:#56d4ff">Selected object</span><span style="--dot:#f4bd73">Review target</span><span style="--dot:#8d9eff">Reference field</span></div><div class="command-actions"><button id="skyReset">Reset view</button><button id="skySelectNext">Select next candidate</button><button id="skySourceNote">Data provenance</button></div><p id="skyCaption">No coordinates are inferred from this illustration. Choose a real archive record to inspect its catalogue source.</p></article>
 <article class="command-panel"><div class="command-panel-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> RESEARCH DESK</div><h2>Reports & validation queue</h2><p>Scientific checks that are complete, pending, or unavailable for the current dataset.</p></div><span class="panel-tag">EVIDENCE LOG</span></div><div class="report-list" id="reportList"><div class="report-row"><span class="report-bullet">↗</span><div><b>Source provenance</b><small>Catalogue records link to their source; sample data remains labelled.</small></div><span class="report-status">AVAILABLE</span></div><div class="report-row"><span class="report-bullet">⌁</span><div><b>Period search</b><small>Run the integrated analysis on a local FITS/CSV light curve.</small></div><span class="report-status">READY</span></div><div class="report-row"><span class="report-bullet">◇</span><div><b>Centroid / pixel vetting</b><small>Requires target-pixel data, not just a light-curve CSV.</small></div><span class="report-status">PENDING</span></div><div class="report-row"><span class="report-bullet">✓</span><div><b>Planet confirmation</b><small>Requires independent validation and supporting observations.</small></div><span class="report-status">NOT CLAIMED</span></div></div><div class="command-actions"><button id="openFullAnalysis">Open full analysis</button><button id="exportCurrentResults">Export candidate list</button></div></article>`;
 const main=$(".main-content"),grid=$(".analysis-grid");if(main&&grid){main.insertBefore(section,grid.nextSibling);const skyPanel=section.querySelector(".command-panel");if(skyPanel)grid.appendChild(skyPanel);}
 function drawSky(){
   const c=$("#skyField");if(!c)return;const r=c.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(window.devicePixelRatio||1,2),w=r.width,h=r.height;c.width=w*dpr;c.height=h*dpr;const x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
   const bg=x.createLinearGradient(0,0,w,h);bg.addColorStop(0,"#061528");bg.addColorStop(.5,"#020711");bg.addColorStop(1,"#0a1728");x.fillStyle=bg;x.fillRect(0,0,w,h);
   let seed=51731;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<Math.floor(w*h/480);i++){const px=rand()*w,py=rand()*h,rr=rand()*1.05+.25;x.beginPath();x.arc(px,py,rr,0,Math.PI*2);x.fillStyle=rand()>.9?"#86d9ff9c":"#c6e5ff80";x.fill();}
   for(let i=0;i<4;i++){const px=w*(.15+rand()*.7),py=h*(.12+rand()*.75);const g=x.createRadialGradient(px,py,1,px,py,Math.min(w,h)*.18);g.addColorStop(0,"#224e7955");g.addColorStop(1,"#07132600");x.fillStyle=g;x.fillRect(0,0,w,h);}
   x.strokeStyle="#6f9ab322";x.lineWidth=1;for(let i=1;i<5;i++){x.beginPath();x.moveTo(w*i/5,0);x.lineTo(w*i/5,h);x.stroke();x.beginPath();x.moveTo(0,h*i/5);x.lineTo(w,h*i/5);x.stroke();}
   const marks=[];for(let i=0;i<13;i++){const px=14+rand()*(w-28),py=14+rand()*(h-28),kind=i%5===0?"#f4bd73":i%3===0?"#8d9eff":"#56d4ff";marks.push({x:px,y:py,kind,id:i});x.beginPath();x.arc(px,py,i%5===0?4:2.6,0,Math.PI*2);x.fillStyle=kind;x.fill();if(i%5===0){x.strokeStyle=kind+"88";x.beginPath();x.arc(px,py,8,0,Math.PI*2);x.stroke();}}
   window.__astroSkyMarks=marks;
   x.fillStyle="#7f9bb6";x.font="9px monospace";x.fillText("ILLUSTRATIVE FIELD · NOT ASTROMETRIC DATA",10,h-10);
 }
 const canvas=$("#skyField");if(canvas)canvas.addEventListener("click",e=>{const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,marks=window.__astroSkyMarks||[];const near=marks.reduce((best,p)=>Math.hypot(p.x-mx,p.y-my)<Math.hypot(best.x-mx,best.y-my)?p:best,marks[0]||{x:mx,y:my,id:0});$("#skyCaption").textContent="Illustrative marker "+(near.id+1)+" selected. This marker has no real celestial coordinates; use NASA/MAST catalogue records for science-grade positions.";});
 $("#skyReset")?.addEventListener("click",()=>{drawSky();$("#skyCaption").textContent="View reset. Background markers are illustrative and are not telescope detections.";});
 let nextMark=0;$("#skySelectNext")?.addEventListener("click",()=>{const m=(window.__astroSkyMarks||[])[nextMark++%((window.__astroSkyMarks||[]).length||1)];if(m)$("#skyCaption").textContent="Illustrative marker "+(m.id+1)+" selected. No real coordinates or detection status are attached to this marker.";});
 $("#skySourceNote")?.addEventListener("click",()=>{$("#skyCaption").textContent="The plotted star field is generated locally for interface navigation only. It does not represent Gaia/TESS positions. Real sky mapping needs catalogue RA/Dec and a sky projection.";});
 $("#openFullAnalysis")?.addEventListener("click",()=>$("#fullAnalysis")?.scrollIntoView({behavior:"smooth",block:"start"}));
 $("#exportCurrentResults")?.addEventListener("click",()=>{const data={note:"This export contains current displayed candidates; demo entries are synthetic and not detections.",candidates:(typeof candidates!=="undefined"?candidates:[]).map(c=>({id:c.id,name:c.name,source:c.sourceLabel||"SYNTHETIC",period:c.period,score:c.score,reason:c.reason,sourceUrl:c.sourceUrl||null}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="astrolens-candidate-list.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const live=$("#liveBtn");if(live)live.addEventListener("click",()=>setTimeout(()=>{const rows=document.querySelectorAll("#candidateList .candidate");const list=$("#reportList");if(list&&rows.length){const row=document.createElement("div");row.className="report-row";row.innerHTML='<span class="report-bullet">↻</span><div><b>Live NASA TOI catalogue</b><small>'+rows.length+' catalogue records are currently displayed. TOIs are candidates, not confirmations.</small></div><span class="report-status">LOADED</span>';list.prepend(row);}},1500));
 window.addEventListener("resize",drawSky);drawSky();
 // Add visual thumbnails to candidate cards without altering the underlying scientific records.
 function decorateCandidates(){
   document.querySelectorAll("#candidateList .candidate").forEach((card,i)=>{
     if(card.querySelector(".candidate-thumb"))return;
     const thumb=document.createElement("div");thumb.className="candidate-thumb";
     const label=document.createElement("span");label.className="candidate-thumb-label";
     const source=card.querySelector(".source-tag")?.textContent?.trim()||"SAMPLE";
     label.textContent=source.toUpperCase();thumb.appendChild(label);card.prepend(thumb);
   });
 }
 const candidateList=$("#candidateList");
 if(candidateList&&typeof MutationObserver!=="undefined")new MutationObserver(decorateCandidates).observe(candidateList,{childList:true,subtree:false});
 decorateCandidates();

})();

/* Final interaction pass: mobile search, compact dock, accessible nav state, and image fallbacks. */
(() => {
 const $ = s => document.querySelector(s);
 const menu = $("#mobileMenu"), sidebar = $("#sidebar");
 if (menu && sidebar) {
   const syncMenu = () => menu.setAttribute("aria-expanded", String(sidebar.classList.contains("open")));
   syncMenu();
   menu.addEventListener("click", syncMenu);
   document.querySelectorAll(".sidebar .nav-link").forEach(link => link.addEventListener("click", () => {
     sidebar.classList.remove("open"); syncMenu();
   }));
   document.addEventListener("click", e => {
     if (window.innerWidth <= 760 && sidebar.classList.contains("open") && !sidebar.contains(e.target) && !menu.contains(e.target)) {
       sidebar.classList.remove("open"); syncMenu();
     }
   });
 }
 const search = $(".top-search"), input = $("#searchInput");
 if (search && input) {
   search.addEventListener("click", e => {
     if (window.innerWidth > 760 || e.target === input) return;
     e.preventDefault();
     search.classList.add("search-open");
     input.style.display = "block";
     input.focus();
   });
   input.addEventListener("blur", () => {
     if (window.innerWidth <= 760 && !input.value.trim()) {
       search.classList.remove("search-open");
       input.style.display = "";
     }
   });
   document.addEventListener("keydown", e => {
     if (e.key === "Escape") {
       search.classList.remove("search-open");
       input.style.display = "";
       input.blur();
     }
   });
 }
 const main = $(".main-content");
 if (main && !$(".mobile-dock")) {
   const dock = document.createElement("nav");
   dock.className = "mobile-dock";
   dock.setAttribute("aria-label", "Quick navigation");
   dock.innerHTML = '<a href="#overview" class="active"><span>⌂</span>Home</a><a href="#explorer"><span>◎</span>Discover</a><a href="#dataLab"><span>⌁</span>Light curve</a><a href="#commandPanels"><span>▦</span>Reports</a>';
   document.body.appendChild(dock);
   dock.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
     dock.querySelectorAll("a").forEach(item => item.classList.toggle("active", item === link));
   }));
 }
 const artwork = [
  {url:"https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26601/PIA26601.jpg",alt:"NASA artist concept of a young exoplanet and warped debris disk"},
  {url:"https://photojournal.jpl.nasa.gov/jpeg/PIA22069.jpg",alt:"NASA artist concept of the rocky exoplanet 55 Cancri e"},
  {url:"https://images-assets.nasa.gov/image/PIA17043/PIA17043~medium.jpg",alt:"NASA artist concept of Europa's icy surface"}
 ];
 function decorate() {
   document.querySelectorAll("#candidateList .candidate").forEach((card,i) => {
     const thumb=card.querySelector(".candidate-thumb");
     if(!thumb)return;
     let img=thumb.querySelector("img");
     if(!img){
       img=document.createElement("img");
       img.loading="lazy";img.decoding="async";
       img.src=artwork[i%artwork.length].url;
       img.alt=artwork[i%artwork.length].alt;
       img.addEventListener("error",()=>{img.remove();thumb.classList.add("artwork-fallback")},{once:true});
       thumb.prepend(img);
     }
     const label=thumb.querySelector(".candidate-thumb-label");
     if(label)label.textContent="NASA ARTWORK · ILLUSTRATIVE";
   });
 }
 const list=$("#candidateList");
 if(list && typeof MutationObserver!=="undefined")new MutationObserver(decorate).observe(list,{childList:true,subtree:false});
 decorate();
})();
